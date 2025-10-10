SET search_path = public, pg_temp;

-- Extensions required for cron + http callbacks
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA public;

-- Helper function: current_org()
CREATE OR REPLACE FUNCTION public.current_org()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
SELECT
  NULLIF(current_setting('request.jwt.claim.org_id', true), '')::uuid;
$$;

COMMENT ON FUNCTION public.current_org IS 'Extracts org_id from JWT claims propagated by the API layer.';

-- Helper function validating visibility for notification targets
CREATE OR REPLACE FUNCTION public.can_view_target(
  target_org_id uuid,
  target_user_id uuid,
  target_source_type text,
  target_source_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  membership_count integer;
BEGIN
  SELECT COUNT(1)
  INTO membership_count
  FROM public.memberships
  WHERE organization_id = target_org_id
    AND user_id = target_user_id
    AND status = 'active';

  IF membership_count = 0 THEN
    RETURN FALSE;
  END IF;

  -- future visibility hooks per source type live here
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.can_view_target IS 'Ensures the target user belongs to the organization before inserting notifications.';

-- user preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_on_mention_weekly boolean NOT NULL DEFAULT TRUE,
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_preferences_unique_per_user_org UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS user_preferences_user_idx ON public.user_preferences (user_id);
CREATE INDEX IF NOT EXISTS user_preferences_org_idx ON public.user_preferences (org_id);

CREATE OR REPLACE FUNCTION public.touch_user_preferences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_preferences_touch ON public.user_preferences;
CREATE TRIGGER user_preferences_touch
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW
EXECUTE FUNCTION public.touch_user_preferences_updated_at();

-- notifications main table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text,
  snippet text,
  link text,
  status text NOT NULL DEFAULT 'unread',
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  read_at timestamptz,
  CONSTRAINT notifications_status_valid CHECK (status IN ('unread', 'read', 'hidden'))
);

CREATE INDEX notifications_org_user_created_idx ON public.notifications (org_id, user_id, created_at DESC, id DESC);
CREATE INDEX notifications_user_status_idx ON public.notifications (user_id, status);
CREATE INDEX notifications_source_idx ON public.notifications (source_type, source_id);

-- notification counters
CREATE TABLE public.notification_counters (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  unread_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (org_id, user_id)
);

CREATE INDEX notification_counters_user_idx ON public.notification_counters (user_id);

CREATE OR REPLACE FUNCTION public.touch_notification_counters_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notification_counters_touch ON public.notification_counters;
CREATE TRIGGER notification_counters_touch
BEFORE UPDATE ON public.notification_counters
FOR EACH ROW
EXECUTE FUNCTION public.touch_notification_counters_updated_at();

-- mutes table
CREATE TABLE public.notification_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scope text NOT NULL,
  source_type text,
  source_id uuid,
  type text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT notification_mutes_scope_valid CHECK (scope IN ('source', 'type')),
  CONSTRAINT notification_mutes_source_requirements CHECK (
    (scope = 'source' AND source_type IS NOT NULL AND source_id IS NOT NULL AND type IS NULL)
    OR (scope = 'type' AND type IS NOT NULL AND source_type IS NULL AND source_id IS NULL)
  )
);

CREATE INDEX notification_mutes_user_idx ON public.notification_mutes (user_id, scope);
CREATE INDEX notification_mutes_source_idx ON public.notification_mutes (source_type, source_id);
CREATE INDEX notification_mutes_type_idx ON public.notification_mutes (type);

-- read timestamp helper
CREATE OR REPLACE FUNCTION public.normalize_notification_read_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'read' AND NEW.read_at IS NULL THEN
    NEW.read_at = timezone('utc'::text, now());
  END IF;
  IF NEW.status = 'unread' THEN
    NEW.read_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_before_update ON public.notifications;
CREATE TRIGGER notifications_before_update
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.normalize_notification_read_at();

-- counter maintenance
CREATE OR REPLACE FUNCTION public.sync_notification_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'unread' THEN
      INSERT INTO public.notification_counters AS c (org_id, user_id, unread_count)
      VALUES (NEW.org_id, NEW.user_id, 1)
      ON CONFLICT (org_id, user_id)
      DO UPDATE SET unread_count = c.unread_count + 1;
    ELSE
      INSERT INTO public.notification_counters (org_id, user_id, unread_count)
      VALUES (NEW.org_id, NEW.user_id, 0)
      ON CONFLICT DO NOTHING;
    END IF;
    PERFORM pg_notify(
      'realtime:notifications:user_' || NEW.user_id::text,
      json_build_object('event', 'notification.created', 'id', NEW.id, 'org_id', NEW.org_id)::text
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'unread' AND NEW.status <> 'unread' THEN
      UPDATE public.notification_counters
      SET unread_count = GREATEST(unread_count - 1, 0)
      WHERE org_id = OLD.org_id AND user_id = OLD.user_id;
    ELSIF OLD.status <> 'unread' AND NEW.status = 'unread' THEN
      INSERT INTO public.notification_counters AS c (org_id, user_id, unread_count)
      VALUES (NEW.org_id, NEW.user_id, 1)
      ON CONFLICT (org_id, user_id)
      DO UPDATE SET unread_count = c.unread_count + 1;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'unread' THEN
      UPDATE public.notification_counters
      SET unread_count = GREATEST(unread_count - 1, 0)
      WHERE org_id = OLD.org_id AND user_id = OLD.user_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS notifications_after_insert ON public.notifications;
CREATE TRIGGER notifications_after_insert
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.sync_notification_counters();

DROP TRIGGER IF EXISTS notifications_after_update ON public.notifications;
CREATE TRIGGER notifications_after_update
AFTER UPDATE OF status ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.sync_notification_counters();

DROP TRIGGER IF EXISTS notifications_after_delete ON public.notifications;
CREATE TRIGGER notifications_after_delete
AFTER DELETE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.sync_notification_counters();

-- view to expose unread status quickly
CREATE OR REPLACE VIEW public.notification_status_view AS
SELECT
  n.id,
  n.org_id,
  n.user_id,
  (n.status = 'unread') AS is_unread
FROM public.notifications n;

-- insertion RPC honoring mutes
CREATE OR REPLACE FUNCTION public.queue_notification(
  p_org_id uuid,
  p_user_id uuid,
  p_type text,
  p_source_type text,
  p_source_id uuid,
  p_actor_id uuid,
  p_title text,
  p_snippet text,
  p_link text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  muted boolean;
  new_id uuid;
BEGIN
  IF NOT public.can_view_target(p_org_id, p_user_id, p_source_type, p_source_id) THEN
    RAISE EXCEPTION 'Target user cannot view source %:% inside org %', p_source_type, p_source_id, p_org_id
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.notification_mutes m
    WHERE m.org_id = p_org_id
      AND m.user_id = p_user_id
      AND (
        (m.scope = 'type' AND m.type = p_type)
        OR (m.scope = 'source' AND m.source_type = p_source_type AND m.source_id = p_source_id)
      )
  ) INTO muted;

  IF muted THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (
    org_id,
    user_id,
    type,
    source_type,
    source_id,
    actor_id,
    title,
    snippet,
    link
  )
  VALUES (
    p_org_id,
    p_user_id,
    p_type,
    p_source_type,
    p_source_id,
    p_actor_id,
    p_title,
    p_snippet,
    p_link
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

COMMENT ON FUNCTION public.queue_notification IS 'Creates a notification if the user is not muted for the given source/type.';

-- weekly digest RPC with http callback
CREATE TABLE IF NOT EXISTS public.notification_digest_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  sent_at timestamptz,
  error_message text
);

CREATE INDEX notification_digest_events_user_idx ON public.notification_digest_events (user_id, status);

CREATE OR REPLACE FUNCTION public.send_weekly_mentions_digest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target record;
  delivery_url text;
  secret text;
  response jsonb;
  http_status integer;
  http_body jsonb;
BEGIN
  delivery_url := nullif(current_setting('app.weekly_digest_webhook', true), '');
  secret := nullif(current_setting('app.internal_webhook_secret', true), '');

  FOR target IN (
    SELECT
      u.org_id,
      u.user_id,
      u.email_on_mention_weekly,
      u.timezone,
      p.email,
      coalesce((p.raw_user_meta_data->>'full_name'), p.email, 'Usuário') AS full_name
    FROM public.user_preferences u
    JOIN public.profiles p ON p.id = u.user_id
    WHERE u.email_on_mention_weekly IS TRUE
  ) LOOP
    INSERT INTO public.notification_digest_events (org_id, user_id, payload)
    VALUES (
      target.org_id,
      target.user_id,
      json_build_object(
        'org_id', target.org_id,
        'user_id', target.user_id,
        'timezone', target.timezone,
        'email', target.email,
        'full_name', target.full_name
      )
    )
    RETURNING payload INTO http_body;

    IF delivery_url IS NOT NULL THEN
      BEGIN
        response := extensions.http_post(
          delivery_url,
          json_build_object(
            'Content-Type', 'application/json',
            'x-internal-secret', coalesce(secret, '')
          ),
          json_build_object('payload', http_body)::text
        );
        http_status := (response->>'status')::integer;
        IF http_status BETWEEN 200 AND 299 THEN
          UPDATE public.notification_digest_events
          SET status = 'sent', sent_at = timezone('utc'::text, now())
          WHERE payload = http_body;
          PERFORM pg_notify(
            'realtime:notifications:digest',
            json_build_object('event', 'notifications.weekly_digest_sent', 'user_id', target.user_id)::text
          );
        ELSE
          UPDATE public.notification_digest_events
          SET status = 'error', error_message = coalesce(response->>'content', 'HTTP failure')
          WHERE payload = http_body;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        UPDATE public.notification_digest_events
        SET status = 'error', error_message = SQLERRM
        WHERE payload = http_body;
      END;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.send_weekly_mentions_digest IS 'Aggregates mention notifications per user and dispatches them through the configured webhook.';

-- schedule weekly digest (Sunday 06:00)
SELECT cron.schedule(
  'notifications_weekly_digest',
  '0 6 * * 0',
  $$SELECT public.send_weekly_mentions_digest();$$
) ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_digest_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY notifications_select_self
ON public.notifications
FOR SELECT
USING (user_id = auth.uid() AND org_id = public.current_org());

CREATE POLICY notifications_update_self
ON public.notifications
FOR UPDATE
USING (user_id = auth.uid() AND org_id = public.current_org())
WITH CHECK (user_id = auth.uid() AND org_id = public.current_org());

CREATE POLICY notification_counters_select_self
ON public.notification_counters
FOR SELECT
USING (user_id = auth.uid() AND org_id = public.current_org());

CREATE POLICY notification_counters_update_self
ON public.notification_counters
FOR UPDATE
USING (user_id = auth.uid() AND org_id = public.current_org())
WITH CHECK (user_id = auth.uid() AND org_id = public.current_org());

CREATE POLICY notification_mutes_manage_self
ON public.notification_mutes
FOR ALL
USING (user_id = auth.uid() AND org_id = public.current_org())
WITH CHECK (user_id = auth.uid() AND org_id = public.current_org());

CREATE POLICY user_preferences_manage_self
ON public.user_preferences
FOR ALL
USING (user_id = auth.uid() AND org_id = public.current_org())
WITH CHECK (user_id = auth.uid() AND org_id = public.current_org());

CREATE POLICY notification_digest_events_select_self
ON public.notification_digest_events
FOR SELECT
USING (user_id = auth.uid());

GRANT EXECUTE ON FUNCTION public.queue_notification(uuid, uuid, text, text, uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_weekly_mentions_digest() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_current_org(p_org_id uuid)
RETURNS void
LANGUAGE sql
VOLATILE
SET search_path = public, pg_temp
AS $$
  SELECT set_config('request.jwt.claim.org_id', COALESCE(p_org_id::text, ''), true);
$$;

GRANT EXECUTE ON FUNCTION public.set_current_org(uuid) TO authenticated;
