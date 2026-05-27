
DROP FUNCTION IF EXISTS public.increment_usage(text, integer);

CREATE OR REPLACE FUNCTION public.increment_usage(
  _user_id uuid,
  _feature text,
  _limit integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'utc')::date;
  _current integer;
BEGIN
  INSERT INTO public.usage_counters (user_id, feature, date, count)
  VALUES (_user_id, _feature, _today, 0)
  ON CONFLICT (user_id, feature, date) DO NOTHING;

  SELECT count INTO _current
  FROM public.usage_counters
  WHERE user_id = _user_id AND feature = _feature AND date = _today
  FOR UPDATE;

  IF _limit >= 0 AND _current >= _limit THEN
    RETURN jsonb_build_object('allowed', false, 'used', _current, 'limit', _limit);
  END IF;

  UPDATE public.usage_counters
  SET count = count + 1, updated_at = now()
  WHERE user_id = _user_id AND feature = _feature AND date = _today;

  RETURN jsonb_build_object('allowed', true, 'used', _current + 1, 'limit', _limit);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_usage(uuid, text, integer) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.increment_usage(uuid, text, integer) TO service_role;
