SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_slug_base text;
    v_slug text;
    v_suffix integer := 1;
    v_name text;
    v_org_id uuid;
BEGIN
    INSERT INTO public.profiles (id, email, raw_user_meta_data, created_at)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data, timezone('utc'::text, now()))
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    v_name := COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'company'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
      INITCAP(regexp_replace(split_part(COALESCE(NEW.email, 'Equipe'), '@', 1), '[-_.]+', ' ', 'g'))
    );

    v_slug_base := lower(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'company', split_part(COALESCE(NEW.email, 'user'), '@', 1)), '[^a-z0-9-]+', '-', 'g'));
    v_slug_base := regexp_replace(COALESCE(v_slug_base, ''), '-{2,}', '-', 'g');
    v_slug_base := trim(both '-' from v_slug_base);

    IF v_slug_base IS NULL OR v_slug_base = '' THEN
        v_slug_base := 'org-' || replace(left(NEW.id::text, 8), '-', '');
    END IF;

    v_slug := v_slug_base;
    WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_slug) LOOP
        v_slug := v_slug_base || '-' || v_suffix::text;
        v_suffix := v_suffix + 1;
    END LOOP;

    INSERT INTO public.organizations (slug, name, created_by)
    VALUES (
      v_slug,
      COALESCE(v_name, INITCAP(replace(v_slug, '-', ' '))),
      NEW.id
    )
    RETURNING id INTO v_org_id;

    INSERT INTO public.memberships (organization_id, user_id, role, status)
    VALUES (v_org_id, NEW.id, 'org', 'active')
    ON CONFLICT (organization_id, user_id) DO UPDATE
      SET role = EXCLUDED.role,
          status = EXCLUDED.status;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_deleted_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    DELETE FROM public.profiles WHERE id = OLD.id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

CREATE TRIGGER on_auth_user_deleted
AFTER DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_deleted_user();
