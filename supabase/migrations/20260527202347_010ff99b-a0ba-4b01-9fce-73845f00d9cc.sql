
-- 1. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS billing_interval text;

-- 2. usage_counters table
CREATE TABLE public.usage_counters (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feature, date)
);

GRANT SELECT ON public.usage_counters TO authenticated;
GRANT ALL ON public.usage_counters TO service_role;

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own usage"
  ON public.usage_counters
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE policies — writes go through SECURITY DEFINER function below.

-- 3. increment_usage RPC
CREATE OR REPLACE FUNCTION public.increment_usage(
  _feature text,
  _limit integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'utc')::date;
  _current integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.usage_counters (user_id, feature, date, count)
  VALUES (_uid, _feature, _today, 0)
  ON CONFLICT (user_id, feature, date) DO NOTHING;

  SELECT count INTO _current
  FROM public.usage_counters
  WHERE user_id = _uid AND feature = _feature AND date = _today
  FOR UPDATE;

  IF _limit >= 0 AND _current >= _limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'used', _current,
      'limit', _limit
    );
  END IF;

  UPDATE public.usage_counters
  SET count = count + 1, updated_at = now()
  WHERE user_id = _uid AND feature = _feature AND date = _today;

  RETURN jsonb_build_object(
    'allowed', true,
    'used', _current + 1,
    'limit', _limit
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_usage(text, integer) TO authenticated;
