
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- helper: map price_id -> tier
CREATE OR REPLACE FUNCTION public.tier_from_price(_price_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _price_id LIKE 'plus_%'   THEN 'plus'
    WHEN _price_id LIKE 'pro_%'    THEN 'pro'
    WHEN _price_id LIKE 'family_%' THEN 'family'
    ELSE 'free'
  END;
$$;

-- trigger: keep profiles.subscription_tier in sync
CREATE OR REPLACE FUNCTION public.sync_profile_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tier text;
  _interval text;
  _active boolean;
BEGIN
  _tier := public.tier_from_price(NEW.price_id);
  _interval := CASE WHEN NEW.price_id LIKE '%_annual' THEN 'annual' ELSE 'monthly' END;
  _active := NEW.status IN ('active', 'trialing', 'past_due')
             OR (NEW.status = 'canceled' AND NEW.current_period_end > now());

  UPDATE public.profiles
  SET subscription_tier = CASE WHEN _active THEN _tier ELSE 'free' END,
      subscription_expires_at = NEW.current_period_end,
      billing_interval = CASE WHEN _active THEN _interval ELSE NULL END,
      stripe_customer_id = NEW.stripe_customer_id,
      stripe_subscription_id = NEW.stripe_subscription_id
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER subscriptions_sync_profile
AFTER INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_tier();
