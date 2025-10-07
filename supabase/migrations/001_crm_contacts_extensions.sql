SET search_path = public, pg_temp;

ALTER TYPE public.status RENAME VALUE 'ganho' TO 'cadastrado';

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS next_action_note text,
  ADD COLUMN IF NOT EXISTS referred_by_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS score integer DEFAULT NULL;

CREATE INDEX IF NOT EXISTS contacts_referred_by_contact_idx ON public.contacts (referred_by_contact_id);

CREATE UNIQUE INDEX IF NOT EXISTS contacts_org_phone_unique
  ON public.contacts (organization_id, whatsapp)
  WHERE whatsapp IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contacts_org_email_unique
  ON public.contacts (organization_id, email)
  WHERE email IS NOT NULL;

UPDATE public.contacts
SET email = lower(email)
WHERE email IS NOT NULL;
