
REVOKE EXECUTE ON FUNCTION public.increment_usage(text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_usage(text, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_usage(text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_usage(text, integer) TO service_role;
