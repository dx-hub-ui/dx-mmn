SET search_path = public, pg_temp;

-- Bookmark table to support Update Feed favoritos
CREATE TABLE IF NOT EXISTS public.notification_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT notification_bookmarks_unique UNIQUE (user_id, notification_id)
);

CREATE INDEX IF NOT EXISTS notification_bookmarks_user_idx
  ON public.notification_bookmarks (user_id, created_at DESC);

ALTER TABLE public.notification_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_bookmarks_select_self ON public.notification_bookmarks;
CREATE POLICY notification_bookmarks_select_self
ON public.notification_bookmarks
FOR SELECT
USING (user_id = auth.uid() AND org_id = current_org());

DROP POLICY IF EXISTS notification_bookmarks_insert_self ON public.notification_bookmarks;
CREATE POLICY notification_bookmarks_insert_self
ON public.notification_bookmarks
FOR INSERT
WITH CHECK (user_id = auth.uid() AND org_id = current_org());

DROP POLICY IF EXISTS notification_bookmarks_delete_self ON public.notification_bookmarks;
CREATE POLICY notification_bookmarks_delete_self
ON public.notification_bookmarks
FOR DELETE
USING (user_id = auth.uid() AND org_id = current_org());

-- View consolidating notifications enriched com dados do ator e metadados mínimos de board
CREATE OR REPLACE VIEW public.v_user_updates AS
SELECT
  n.id,
  n.org_id,
  n.user_id,
  n.type,
  n.source_type,
  n.source_id,
  n.actor_id,
  n.title,
  n.snippet,
  n.link,
  n.status,
  n.created_at,
  n.read_at,
  NULL::uuid AS board_id,
  INITCAP(REPLACE(n.source_type, '_', ' ')) AS board_label,
  p.email AS actor_email,
  p.raw_user_meta_data AS actor_meta,
  COALESCE(
    NULLIF(p.raw_user_meta_data ->> 'name', ''),
    NULLIF(p.raw_user_meta_data ->> 'full_name', ''),
    p.email,
    'Usuário'
  ) AS actor_display_name,
  NULLIF(p.raw_user_meta_data ->> 'avatar_url', '') AS actor_avatar_url
FROM public.notifications n
LEFT JOIN public.profiles p ON p.id = n.actor_id;

COMMENT ON VIEW public.v_user_updates IS 'Materializa notificações por usuário enriquecidas com dados do ator e metadados usados no Update Feed.';
