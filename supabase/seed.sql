-- Seed data for local development
SET search_path = public, pg_temp;

-- Create demo users in auth schema (passwordless, for local testing only)
INSERT INTO auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com', '{"name": "Org Owner"}', '{"provider": "email"}'),
  ('22222222-2222-2222-2222-222222222222', 'leader@example.com', '{"name": "Top Leader"}', '{"provider": "email"}'),
  ('33333333-3333-3333-3333-333333333333', 'rep1@example.com', '{"name": "Rep One"}', '{"provider": "email"}'),
  ('44444444-4444-4444-4444-444444444444', 'rep2@example.com', '{"name": "Rep Two"}', '{"provider": "email"}')
ON CONFLICT (id) DO NOTHING;

-- Organization
INSERT INTO public.organizations (id, slug, name, country, created_by)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'acme', 'ACME Marketing', 'BR', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

-- Memberships hierarchy
INSERT INTO public.memberships (id, organization_id, user_id, role, status)
VALUES
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'org', 'active'),
  ('bbbb2222-bbbb-2222-bbbb-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'leader', 'active'),
  ('cccc3333-cccc-3333-cccc-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'rep', 'active'),
  ('dddd4444-dddd-4444-dddd-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'rep', 'active')
ON CONFLICT (id) DO NOTHING;

UPDATE public.memberships
SET parent_leader_id = 'bbbb2222-bbbb-2222-bbbb-222222222222'
WHERE id IN ('cccc3333-cccc-3333-cccc-333333333333', 'dddd4444-dddd-4444-dddd-444444444444');

-- Contacts distributed across memberships
INSERT INTO public.contacts (
  id,
  organization_id,
  owner_membership_id,
  name,
  email,
  whatsapp,
  city,
  uf,
  source,
  tags,
  status,
  invited_by,
  notes,
  last_touch_at,
  next_action_at
) VALUES
  ('10000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaa1111-aaaa-1111-aaaa-111111111111', 'Maria Lima', 'maria@clientes.com', '+55 11 90000-0001', 'São Paulo', 'SP', 'webinar', ARRAY['vip','sp'], 'qualificado', NULL, 'Cliente premium em potencial', timezone('utc', now()) - interval '7 days', timezone('utc', now()) + interval '3 days'),
  ('10000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaa1111-aaaa-1111-aaaa-111111111111', 'João Pedro', 'joao@clientes.com', '+55 11 90000-0002', 'Campinas', 'SP', 'indicação', ARRAY['org'], 'contatado', NULL, NULL, timezone('utc', now()) - interval '2 days', timezone('utc', now()) + interval '5 days'),
  ('10000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbb2222-bbbb-2222-bbbb-222222222222', 'Ana Souza', 'ana@clientes.com', '+55 21 90000-0003', 'Rio de Janeiro', 'RJ', 'evento', ARRAY['top'], 'followup', 'aaaa1111-aaaa-1111-aaaa-111111111111', 'Aguardando retorno pós evento', timezone('utc', now()) - interval '1 day', timezone('utc', now()) + interval '2 days'),
  ('10000000-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbb2222-bbbb-2222-bbbb-222222222222', 'Carlos Dias', 'carlos@clientes.com', '+55 31 90000-0004', 'Belo Horizonte', 'MG', 'facebook', ARRAY['mineiro'], 'contatado', NULL, NULL, timezone('utc', now()) - interval '4 days', timezone('utc', now()) + interval '4 days'),
  ('10000000-0000-0000-0000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccc3333-cccc-3333-cccc-333333333333', 'Fernanda Alves', 'fernanda@clientes.com', '+55 41 90000-0005', 'Curitiba', 'PR', 'instagram', ARRAY['lead-frio'], 'novo', 'bbbb2222-bbbb-2222-bbbb-222222222222', 'Requer aquecimento inicial', NULL, timezone('utc', now()) + interval '6 days'),
  ('10000000-0000-0000-0000-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccc3333-cccc-3333-cccc-333333333333', 'Gustavo Nunes', 'gustavo@clientes.com', '+55 21 90000-0006', 'Niterói', 'RJ', 'indicação', ARRAY['quente'], 'qualificado', 'bbbb2222-bbbb-2222-bbbb-222222222222', 'Pronto para apresentação', timezone('utc', now()) - interval '3 days', timezone('utc', now()) + interval '1 day'),
  ('10000000-0000-0000-0000-000000000007', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddd4444-dddd-4444-dddd-444444444444', 'Helena Prado', 'helena@clientes.com', '+55 71 90000-0007', 'Salvador', 'BA', 'facebook', ARRAY['ba'], 'contatado', 'bbbb2222-bbbb-2222-bbbb-222222222222', 'Enviado material inicial', timezone('utc', now()) - interval '5 days', timezone('utc', now()) + interval '7 days'),
  ('10000000-0000-0000-0000-000000000008', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddd4444-dddd-4444-dddd-444444444444', 'Igor Silva', 'igor@clientes.com', '+55 81 90000-0008', 'Recife', 'PE', 'webinar', ARRAY['nordeste'], 'followup', 'bbbb2222-bbbb-2222-bbbb-222222222222', 'Agendar call de alinhamento', timezone('utc', now()) - interval '6 days', timezone('utc', now()) + interval '2 days'),
  ('10000000-0000-0000-0000-000000000009', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbb2222-bbbb-2222-bbbb-222222222222', 'Julia Castro', 'julia@clientes.com', '+55 48 90000-0009', 'Florianópolis', 'SC', 'linkedin', ARRAY['sul'], 'ganho', 'aaaa1111-aaaa-1111-aaaa-111111111111', 'Fechou contrato', timezone('utc', now()) - interval '15 days', timezone('utc', now()) + interval '14 days'),
  ('10000000-0000-0000-0000-000000000010', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccc3333-cccc-3333-cccc-333333333333', 'Kleber Ramos', 'kleber@clientes.com', '+55 62 90000-0010', 'Goiânia', 'GO', 'indicação', ARRAY['follow'], 'perdido', 'bbbb2222-bbbb-2222-bbbb-222222222222', 'Preferiu concorrente', timezone('utc', now()) - interval '10 days', timezone('utc', now()) + interval '9 days')
ON CONFLICT (id) DO NOTHING;

-- Guidance for testing RLS scenarios locally
-- Use supabase start then supabase login; run `supabase functions serve` or JWT overrides in Supabase Studio.
-- You can simulate each role by issuing a JWT with the corresponding user id above (owner, leader, rep1, rep2).
-- With auth.uid() set to leader (2222...), verify that SELECT on public.contacts returns their contacts plus reps in the hierarchy.
-- With auth.uid() set to rep1 (3333...), ensure they cannot read or update contacts owned by rep2 (4444...).
