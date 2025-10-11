-- Remove valor 'qualificado' do enum public.status e consolida em 'followup'
SET search_path = public, pg_temp;

ALTER TABLE public.contacts ALTER COLUMN status DROP DEFAULT;

UPDATE public.contacts
SET status = 'followup'
WHERE status::text = 'qualificado';

CREATE TYPE public.status_new AS ENUM ('novo', 'contatado', 'followup', 'cadastrado', 'perdido');

ALTER TABLE public.contacts
ALTER COLUMN status TYPE public.status_new
USING status::text::public.status_new;

DROP TYPE public.status;

ALTER TYPE public.status_new RENAME TO status;

ALTER TABLE public.contacts ALTER COLUMN status SET DEFAULT 'novo';
