SET search_path = public, pg_temp;

-- Harden can_access_membership to avoid ambiguous references when called from RLS
CREATE OR REPLACE FUNCTION public.can_access_membership(p_org_id uuid, p_target_membership_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_previous text := current_setting('row_security', true);
    v_result boolean := false;
BEGIN
    IF p_org_id IS NULL OR p_target_membership_id IS NULL THEN
        RETURN false;
    END IF;

    PERFORM set_config('row_security', 'off', true);

    SELECT EXISTS (
        SELECT 1
        FROM public.visible_membership_ids(p_org_id) visible
        WHERE visible.membership_id = p_target_membership_id
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
