-- Ensure search_path is safe
SET search_path = public, pg_temp;

-- Roles enum
CREATE TYPE public.role AS ENUM ('org', 'leader', 'rep');

-- Contact status enum
CREATE TYPE public.status AS ENUM ('novo', 'qualificado', 'contatado', 'followup', 'ganho', 'perdido');

-- Mirror auth.users
CREATE TABLE public.profiles (
    id uuid PRIMARY KEY,
    email text,
    raw_user_meta_data jsonb,
    created_at timestamptz DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.profiles IS 'Mirror table for auth.users to simplify joins under RLS.';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, raw_user_meta_data, created_at)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data, timezone('utc'::text, now()))
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Organizations
CREATE TABLE public.organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    country text NOT NULL DEFAULT 'BR',
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON COLUMN public.organizations.slug IS 'Unique slug used in URLs.';

-- Memberships
CREATE TABLE public.memberships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.role NOT NULL,
    invited_by uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
    parent_leader_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT memberships_parent_leader_role CHECK (
        parent_leader_id IS NULL OR role = 'rep'
    )
);

ALTER TABLE public.memberships
ADD CONSTRAINT memberships_unique_user_per_org UNIQUE (organization_id, user_id);

CREATE INDEX memberships_org_idx ON public.memberships (organization_id);
CREATE INDEX memberships_user_idx ON public.memberships (user_id);
CREATE INDEX memberships_invited_by_idx ON public.memberships (invited_by);
CREATE INDEX memberships_parent_leader_idx ON public.memberships (parent_leader_id);
CREATE UNIQUE INDEX memberships_org_id_idx ON public.memberships (organization_id, id);

ALTER TABLE public.memberships
ADD CONSTRAINT memberships_parent_same_org FOREIGN KEY (organization_id, parent_leader_id)
REFERENCES public.memberships (organization_id, id);

COMMENT ON COLUMN public.memberships.parent_leader_id IS 'Links reps to their leader membership for hierarchy traversal.';

-- Contacts
CREATE TABLE public.contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    owner_membership_id uuid NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
    name text NOT NULL,
    email text,
    whatsapp text,
    city text,
    uf text,
    source text,
    tags text[] DEFAULT ARRAY[]::text[],
    status public.status NOT NULL DEFAULT 'novo',
    last_touch_at timestamptz,
    next_action_at timestamptz,
    notes text,
    invited_by uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
    avatar text,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX contacts_org_idx ON public.contacts (organization_id);
CREATE INDEX contacts_owner_idx ON public.contacts (owner_membership_id);
CREATE INDEX contacts_status_idx ON public.contacts (status);
CREATE INDEX contacts_org_owner_status_idx ON public.contacts (organization_id, owner_membership_id, status);
CREATE INDEX contacts_tags_gin_idx ON public.contacts USING GIN (tags);

CREATE OR REPLACE FUNCTION public.set_contacts_updated_at()
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

CREATE TRIGGER contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.set_contacts_updated_at();

-- Invite links
CREATE TABLE public.invite_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    generated_by_membership_id uuid NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
    role_to_assign public.role NOT NULL,
    parent_leader_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
    token text NOT NULL UNIQUE,
    max_uses integer NOT NULL DEFAULT 1 CHECK (max_uses > 0),
    used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT invite_links_role_check CHECK (role_to_assign IN ('leader', 'rep'))
);

CREATE INDEX invite_links_org_idx ON public.invite_links (organization_id);
CREATE INDEX invite_links_token_idx ON public.invite_links (token);

-- Helper function to compute membership visibility
CREATE OR REPLACE FUNCTION public.visible_membership_ids(org_id uuid)
RETURNS TABLE(membership_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
WITH current_member AS (
    SELECT id, role
    FROM public.memberships
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND status = 'active'
),
recursive_tree AS (
    SELECT m.id, m.parent_leader_id, m.role
    FROM public.memberships m
    JOIN current_member cm ON m.id = cm.id
    WHERE m.status = 'active'
  UNION ALL
    SELECT child.id, child.parent_leader_id, child.role
    FROM public.memberships child
    JOIN recursive_tree rt ON child.parent_leader_id = rt.id
    WHERE child.status = 'active'
)
SELECT m.id AS membership_id
FROM public.memberships m
JOIN current_member cm ON TRUE
WHERE m.organization_id = org_id
  AND m.status = 'active'
  AND (
        cm.role = 'org'
        OR (cm.role = 'leader' AND m.id IN (SELECT id FROM recursive_tree))
        OR (cm.role = 'rep' AND m.id = cm.id)
      );
$$;

COMMENT ON FUNCTION public.visible_membership_ids IS 'Returns membership ids visible to the current user within an organization based on hierarchy.';

-- Enable RLS and policies
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_links ENABLE ROW LEVEL SECURITY;

-- memberships policies
CREATE POLICY memberships_select_self
ON public.memberships
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY memberships_select_org
ON public.memberships
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.memberships m2
        WHERE m2.organization_id = memberships.organization_id
          AND m2.user_id = auth.uid()
          AND m2.role = 'org'
          AND m2.status = 'active'
    )
);

-- invite_links policies
CREATE POLICY invite_links_select_generators
ON public.invite_links
FOR SELECT
USING (
    generated_by_membership_id IN (
        SELECT membership_id FROM public.visible_membership_ids(invite_links.organization_id)
    )
);

CREATE POLICY invite_links_select_org
ON public.invite_links
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.memberships m2
        WHERE m2.organization_id = invite_links.organization_id
          AND m2.user_id = auth.uid()
          AND m2.role = 'org'
          AND m2.status = 'active'
    )
);

-- contacts policies
CREATE POLICY contacts_select_visible
ON public.contacts
FOR SELECT
USING (
    owner_membership_id IN (
        SELECT membership_id FROM public.visible_membership_ids(contacts.organization_id)
    )
);

CREATE POLICY contacts_insert_visible
ON public.contacts
FOR INSERT
WITH CHECK (
    owner_membership_id IN (
        SELECT membership_id FROM public.visible_membership_ids(contacts.organization_id)
    )
);

CREATE POLICY contacts_update_visible
ON public.contacts
FOR UPDATE
USING (
    owner_membership_id IN (
        SELECT membership_id FROM public.visible_membership_ids(contacts.organization_id)
    )
)
WITH CHECK (
    owner_membership_id IN (
        SELECT membership_id FROM public.visible_membership_ids(contacts.organization_id)
    )
);

