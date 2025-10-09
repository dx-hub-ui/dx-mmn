SET search_path = public, pg_temp;

-- Ensure memberships.user_id points to public.profiles for PostgREST relationship discovery
ALTER TABLE public.memberships
  DROP CONSTRAINT IF EXISTS memberships_user_id_fkey;

ALTER TABLE public.memberships
  ADD CONSTRAINT memberships_user_id_profiles_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles (id)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT memberships_user_id_profiles_fkey ON public.memberships IS 'Links memberships to mirrored auth profiles so Supabase can expose the relationship.';
