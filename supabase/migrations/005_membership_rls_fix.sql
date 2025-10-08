SET search_path = public, pg_temp;

DROP POLICY IF EXISTS memberships_select_org ON public.memberships;

CREATE OR REPLACE FUNCTION public.can_access_membership(org_id uuid, membership_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.visible_membership_ids(org_id) v
    WHERE v.membership_id = membership_id
  );
$$;

CREATE POLICY memberships_select_visible
ON public.memberships
FOR SELECT
USING (
  public.can_access_membership(memberships.organization_id, memberships.id)
);
