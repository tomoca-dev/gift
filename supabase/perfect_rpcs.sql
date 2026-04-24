-- DROP EXISTING FUNCTIONS FIRST
DROP FUNCTION IF EXISTS public.claim_reward_by_phone(text);
DROP FUNCTION IF EXISTS public.validate_reward_qr(text);
DROP FUNCTION IF EXISTS public.redeem_reward_qr(text);

-- 1. claim_reward_by_phone
CREATE OR REPLACE FUNCTION public.claim_reward_by_phone(input_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  customer_row public.reward_customers%rowtype;
  new_token text;
  new_expiry timestamptz;
BEGIN
  -- Find the customer
  SELECT *
  INTO customer_row
  FROM public.reward_customers
  WHERE phone = input_phone
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not eligible for this promotion.');
  END IF;

  IF customer_row.status = 'redeemed' THEN
    RETURN jsonb_build_object('success', false, 'message', 'You have already redeemed your gift.');
  END IF;

  -- Generate token
  new_token := encode(gen_random_bytes(24), 'hex');
  new_expiry := now() + interval '5 minutes';

  UPDATE public.reward_customers
  SET status = 'claimed',
      claim_token = new_token,
      claimed_at = now(),
      claim_expires_at = new_expiry
  WHERE id = customer_row.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Success',
    'customer_id', customer_row.id,
    'phone', customer_row.phone,
    'qr_token', new_token,
    'qr_expires_at', new_expiry,
    'redemption_code', customer_row.redemption_code,
    'reward_type', customer_row.reward_type,
    'status', 'valid'
  );
END;
$$;

-- 2. validate_reward_qr
CREATE OR REPLACE FUNCTION public.validate_reward_qr(input_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  customer_row public.reward_customers%rowtype;
BEGIN
  SELECT *
  INTO customer_row
  FROM public.reward_customers
  WHERE claim_token = input_code OR redemption_code = input_code
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'status', 'invalid', 'message', 'QR code not found.');
  END IF;

  IF customer_row.status = 'redeemed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'already-used',
      'message', 'Already redeemed.',
      'phone', customer_row.phone,
      'reward_type', customer_row.reward_type
    );
  END IF;

  IF customer_row.claim_expires_at IS NOT NULL AND customer_row.claim_expires_at < now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'expired',
      'message', 'QR code expired.',
      'phone', customer_row.phone,
      'reward_type', customer_row.reward_type,
      'qr_expires_at', customer_row.claim_expires_at
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'valid',
    'message', 'Valid - ready to redeem.',
    'phone', customer_row.phone,
    'reward_type', customer_row.reward_type,
    'redemption_code', customer_row.redemption_code,
    'qr_expires_at', customer_row.claim_expires_at
  );
END;
$$;

-- 3. redeem_reward_qr
CREATE OR REPLACE FUNCTION public.redeem_reward_qr(input_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  customer_row public.reward_customers%rowtype;
BEGIN
  SELECT *
  INTO customer_row
  FROM public.reward_customers
  WHERE claim_token = input_code OR redemption_code = input_code
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'status', 'invalid', 'message', 'Unable to redeem this gift.');
  END IF;

  IF customer_row.status = 'redeemed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'already-used',
      'message', 'Already redeemed.',
      'phone', customer_row.phone,
      'reward_type', customer_row.reward_type
    );
  END IF;

  UPDATE public.reward_customers
  SET status = 'redeemed',
      redeemed_at = now(),
      redeemed_by = auth.uid()
  WHERE id = customer_row.id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'valid',
    'message', 'Gift redeemed successfully!',
    'phone', customer_row.phone,
    'reward_type', customer_row.reward_type,
    'redemption_code', customer_row.redemption_code,
    'redeemed_at', now()
  );
END;
$$;

-- 4. Grant permissions so the frontend app can actually call these functions
GRANT EXECUTE ON FUNCTION public.claim_reward_by_phone(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_reward_qr(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_reward_qr(text) TO authenticated;

-- 5. Force Supabase to reload its API
NOTIFY pgrst, 'reload schema';
