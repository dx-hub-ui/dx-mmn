SET search_path = public, pg_temp;

DROP POLICY IF EXISTS memberships_select_visible ON public.memberships;

CREATE OR REPLACE FUNCTION public.can_access_membership(org_id uuid, target_membership_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_previous text := current_setting('row_security', true);
    v_result boolean := false;
BEGIN
    PERFORM set_config('row_security', 'off', true);

    SELECT EXISTS (
        SELECT 1
        FROM public.visible_membership_ids(org_id) v
        WHERE v.membership_id = target_membership_id
    )
    INTO v_result;

    IF v_previous IS NULL OR v_previous = '' THEN
        PERFORM set_config('row_security', 'on', true);
    ELSE
        PERFORM set_config('row_security', v_previous, true);
    END IF;

    RETURN COALESCE(v_result, false);
EXCEPTION
    WHEN others THEN
        IF v_previous IS NULL OR v_previous = '' THEN
            PERFORM set_config('row_security', 'on', true);
        ELSE
            PERFORM set_config('row_security', v_previous, true);
        END IF;
        RAISE;
END;
$$;

CREATE POLICY memberships_select_visible
ON public.memberships
FOR SELECT
USING (
  public.can_access_membership(memberships.organization_id, memberships.id)
);
