-- FILE: supabase/migrations/000_auth_roles_multitenant.sql
-- Schema: public
-- Purpose: Multitenant auth/roles, invitations, safe org creation, and base RLS.
-- Idempotent where possible.

-- =========================
-- Extensions & search_path
-- =========================
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

alter database postgres set search_path = public, pg_temp;

set check_function_bodies = off;
set client_min_messages = warning;

-- =========================
-- Enums
-- =========================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'role') then
    create type public.role as enum ('org','leader','rep');
  end if;

  if not exists (select 1 from pg_type where typname = 'contact_status') then
    create type public.contact_status as enum ('novo','qualificado','contatado','followup','ganho','perdido');
  end if;
end $$;

-- =========================
-- Profiles (mirror of auth.users)
-- =========================
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================
-- Organizations
-- =========================
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  country text not null default 'BR',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists idx_organizations_slug on public.organizations(slug);

-- =========================
-- Memberships
-- =========================
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.role not null,
  invited_by_membership_id uuid null references public.memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(organization_id, user_id)
);
create index if not exists idx_memberships_org on public.memberships(organization_id);
create index if not exists idx_memberships_user on public.memberships(user_id);

-- =========================
-- Invitations (magic-link style)
-- =========================
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inviter_membership_id uuid not null references public.memberships(id) on delete cascade,
  role public.role not null,
  token text not null unique, -- short random string
  email text null,            -- optional hint
  expires_at timestamptz not null default now() + interval '14 days',
  redeemed_by_user_id uuid null references auth.users(id) on delete set null,
  redeemed_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint ck_invites_token_len check (length(token) >= 24)
);
create index if not exists idx_invites_org on public.invites(organization_id);
create index if not exists idx_invites_token on public.invites(token);

-- =========================
-- Contacts (minimal CRM core; visibility via RLS)
-- =========================
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete set null,
  handler_user_id uuid null references auth.users(id) on delete set null, -- responsible rep/leader
  full_name text not null,
  email text null,
  whatsapp text null,
  city text null,
  uf text null,
  fonte text null,
  tags text[] not null default '{}',
  status public.contact_status not null default 'novo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_contacts_org on public.contacts(organization_id);
create index if not exists idx_contacts_owner on public.contacts(owner_user_id);
create index if not exists idx_contacts_handler on public.contacts(handler_user_id);

create or replace function public.touch_contacts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_contacts_updated_at on public.contacts;
create trigger trg_contacts_updated_at
before update on public.contacts
for each row execute function public.touch_contacts_updated_at();

-- =========================
-- Helper: current authenticated user
-- =========================
create or replace function public.uid()
returns uuid
language sql
stable
as $$
  select auth.uid()
$$;

-- =========================
-- Views / helper funcs for authz
-- =========================
create or replace view public.v_memberships as
select m.*, (m.user_id = auth.uid()) as is_self
from public.memberships m;

create or replace function public.has_role(p_org uuid, p_min_role public.role)
returns boolean
language plpgsql
stable
as $$
declare
  myrole public.role;
begin
  select role into myrole
  from public.memberships
  where organization_id = p_org and user_id = auth.uid();

  if myrole is null then
    return false;
  end if;

  -- role precedence: org > leader > rep
  if p_min_role = 'rep' then
    return true; -- any member qualifies
  elsif p_min_role = 'leader' then
    return myrole in ('leader','org');
  elsif p_min_role = 'org' then
    return myrole = 'org';
  end if;

  return false;
end;
$$;

-- =========================
-- Secure creator for organizations (also seeds org membership)
-- =========================
create or replace function public.create_organization(p_name text, p_slug text)
returns public.organizations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  org public.organizations;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (p_name, p_slug, auth.uid())
  returning * into org;

  insert into public.memberships (organization_id, user_id, role)
  values (org.id, auth.uid(), 'org')
  on conflict do nothing;

  return org;
end;
$$;

revoke all on function public.create_organization(text, text) from public;
grant execute on function public.create_organization(text, text) to authenticated;

-- =========================
-- Invitation helpers (token gen + redeem)
-- =========================
create or replace function public.generate_invite(
  p_org uuid,
  p_role public.role,
  p_email text default null,
  p_ttl_minutes integer default 20160  -- 14 days
)
returns public.invites
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inv public.invites;
  inviter public.memberships;
  tok text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Only org or leader may invite
  if not public.has_role(p_org, 'leader') then
    raise exception 'insufficient_role';
  end if;

  -- leaders may not invite org owners
  if p_role = 'org' and not public.has_role(p_org, 'org') then
    raise exception 'only_org_can_invite_org_role';
  end if;

  select * into inviter
  from public.memberships
  where organization_id = p_org and user_id = auth.uid();

  if inviter.id is null then
    raise exception 'not_a_member_of_org';
  end if;

  tok := encode(gen_random_bytes(24), 'base64')
           -- URL-safe tweak:
           ::text
           replace('/','_') replace('+','-') replace('=','');

  insert into public.invites (organization_id, inviter_membership_id, role, token, email, expires_at)
  values (p_org, inviter.id, p_role, tok, p_email, now() + make_interval(mins => p_ttl_minutes))
  returning * into inv;

  return inv;
end;
$$;

revoke all on function public.generate_invite(uuid, public.role, text, integer) from public;
grant execute on function public.generate_invite(uuid, public.role, text, integer) to authenticated;

create or replace function public.redeem_invite(p_token text)
returns public.memberships
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inv public.invites;
  mem public.memberships;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into inv
  from public.invites
  where token = p_token;

  if inv.id is null then
    raise exception 'invalid_token';
  end if;

  if inv.redeemed_at is not null then
    raise exception 'already_redeemed';
  end if;

  if inv.expires_at < now() then
    raise exception 'expired_token';
  end if;

  -- upsert membership
  insert into public.memberships (organization_id, user_id, role, invited_by_membership_id)
  values (inv.organization_id, auth.uid(), inv.role, inv.inviter_membership_id)
  on conflict (organization_id, user_id)
  do update set role = excluded.role
  returning * into mem;

  update public.invites
  set redeemed_by_user_id = auth.uid(), redeemed_at = now()
  where id = inv.id;

  return mem;
end;
$$;

revoke all on function public.redeem_invite(text) from public;
grant execute on function public.redeem_invite(text) to authenticated;

-- =========================
-- RLS
-- =========================
alter table public.organizations enable row level security;
alter table public.memberships  enable row level security;
alter table public.invites      enable row level security;
alter table public.contacts     enable row level security;

-- Organizations: members can select; inserts via function; updates only org owners.
drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations
for select using (
  exists (
    select 1 from public.memberships m
    where m.organization_id = organizations.id
      and m.user_id = auth.uid()
  )
);

drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations
for update using (public.has_role(id, 'org'));

-- Memberships: members see all memberships in their org.
drop policy if exists m_select on public.memberships;
create policy m_select on public.memberships
for select using (
  exists (
    select 1 from public.memberships me
    where me.organization_id = memberships.organization_id
      and me.user_id = auth.uid()
  )
);

-- Memberships: only org owners can change roles / delete in their org.
drop policy if exists m_update on public.memberships;
create policy m_update on public.memberships
for update using (public.has_role(organization_id, 'org'));

drop policy if exists m_delete on public.memberships;
create policy m_delete on public.memberships
for delete using (public.has_role(organization_id, 'org'));

-- Memberships: insert is done by redeem_invite() (SECURITY DEFINER), so no open insert policy.

-- Invites: read/create restricted to leaders+ in their org. Update via functions.
drop policy if exists invites_select on public.invites;
create policy invites_select on public.invites
for select using (public.has_role(organization_id, 'leader'));

drop policy if exists invites_insert on public.invites;
create policy invites_insert on public.invites
for insert with check (public.has_role(organization_id, 'leader'));

-- Contacts:
-- org owners see all contacts of org
-- leaders see their own + those where handler is any of their downline (simplified: any in org)
-- reps see contacts where owner_user_id = self or handler_user_id = self
drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts
for select using (
  public.has_role(organization_id, 'org')
  or (
    public.has_role(organization_id, 'leader')
    and exists (
      select 1 from public.memberships me
      where me.organization_id = contacts.organization_id
        and me.user_id = auth.uid()
    )
  )
  or owner_user_id = auth.uid()
  or handler_user_id = auth.uid()
);

drop policy if exists contacts_insert on public.contacts;
create policy contacts_insert on public.contacts
for insert with check (
  exists (
    select 1 from public.memberships me
    where me.organization_id = contacts.organization_id
      and me.user_id = auth.uid()
  )
  and owner_user_id = auth.uid() -- caller owns what they create
);

drop policy if exists contacts_update on public.contacts;
create policy contacts_update on public.contacts
for update using (
  public.has_role(organization_id, 'org')
  or owner_user_id = auth.uid()
  or handler_user_id = auth.uid()
);

drop policy if exists contacts_delete on public.contacts;
create policy contacts_delete on public.contacts
for delete using (
  public.has_role(organization_id, 'org')
);

-- =========================
-- Convenience: get viewer membership for an org
-- =========================
create or replace function public.viewer_membership(p_org uuid)
returns public.memberships
language sql
stable
as $$
  select m.* from public.memberships m
  where m.organization_id = p_org and m.user_id = auth.uid()
$$;

-- Done.
