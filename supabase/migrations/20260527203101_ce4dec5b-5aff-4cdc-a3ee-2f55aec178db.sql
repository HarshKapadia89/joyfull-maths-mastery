
CREATE OR REPLACE FUNCTION public.tier_from_price(_price_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _price_id LIKE 'plus_%'   THEN 'plus'
    WHEN _price_id LIKE 'pro_%'    THEN 'pro'
    WHEN _price_id LIKE 'family_%' THEN 'family'
    ELSE 'free'
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.tier_from_price(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_tier() FROM PUBLIC, anon, authenticated;
