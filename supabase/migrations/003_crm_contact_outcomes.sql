SET search_path = public, pg_temp;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS lost_reason text,
  ADD COLUMN IF NOT EXISTS lost_review_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS contacts_archived_at_idx ON public.contacts (archived_at);
