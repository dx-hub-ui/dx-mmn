SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.send_weekly_mentions_digest() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.send_weekly_mentions_digest() TO service_role;
