SET search_path = public, pg_temp;

CREATE TABLE IF NOT EXISTS public.contact_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  actor_membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS contact_events_contact_idx ON public.contact_events (contact_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS contact_events_org_idx ON public.contact_events (organization_id, occurred_at DESC);
