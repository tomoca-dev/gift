-- 1) Drop existing functions to reset signatures
DROP FUNCTION IF EXISTS public.claim_reward_by_phone(text);
DROP FUNCTION IF EXISTS public.redeem_reward_qr(text);
DROP FUNCTION IF EXISTS public.validate_reward_qr(text);

-- 2) Re-create claim_reward_by_phone (Atomic update, No FOR UPDATE)
CREATE OR REPLACE FUNCTION public.claim_reward_by_phone(input_phone text)
RETURNS TABLE (
  customer_id uuid,
  message text,
  phone text,
  qr_expires_at timestamptz,
  qr_token text,
  redemption_code text,
  reward_type text,
  status text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_phone text;
  v_recipient public.gift_recipients%rowtype;
  v_token text;
  v_expires_at timestamptz;
BEGIN
  v_phone := public.normalize_phone(input_phone);
  IF v_phone IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, 'Invalid phone number format.'::text, input_phone, NULL, NULL, NULL, NULL, 'not-approved';
    RETURN;
  END IF;

  UPDATE public.gift_recipients
  SET status = 'claimed', claimed_at = now()
  WHERE phone_normalized = v_phone AND status = 'eligible'
  RETURNING * INTO v_recipient;

  IF NOT FOUND THEN
    SELECT * INTO v_recipient FROM public.gift_recipients WHERE phone_normalized = v_phone LIMIT 1;
    IF NOT FOUND THEN
      RETURN QUERY SELECT NULL::uuid, 'Phone number not eligible.'::text, v_phone, NULL, NULL, NULL, NULL, 'not-approved';
    ELSE
      RETURN QUERY SELECT v_recipient.id, 'Already received your gift.'::text, v_recipient.phone_normalized, NULL, NULL, NULL, v_recipient.gift_type, 'already-redeemed';
    END IF;
    RETURN;
  END IF;

  v_token := encode(gen_random_bytes(24), 'hex');
  v_expires_at := now() + interval '2 minutes';
  INSERT INTO public.gift_qr_sessions(recipient_id, token, expires_at) VALUES (v_recipient.id, v_token, v_expires_at);
  
  RETURN QUERY SELECT v_recipient.id, 'Gift claimed successfully.'::text, v_phone, v_expires_at, v_token, upper(right(v_token, 8)), v_recipient.gift_type, 'approved';
END;
$$;

-- 3) Re-create validate_reward_qr
CREATE OR REPLACE FUNCTION public.validate_reward_qr(input_code text)
RETURNS TABLE (
  customer_id uuid, message text, phone text, qr_expires_at timestamptz,
  redemption_code text, reward_type text, status text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session public.gift_qr_sessions%rowtype;
  v_recipient public.gift_recipients%rowtype;
BEGIN
  SELECT * INTO v_session FROM public.gift_qr_sessions
  WHERE lower(token) = lower(input_code) OR upper(right(token, 8)) = upper(input_code)
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, 'Invalid code.'::text, NULL, NULL, NULL, NULL, 'invalid';
    RETURN;
  END IF;

  SELECT * INTO v_recipient FROM public.gift_recipients WHERE id = v_session.recipient_id LIMIT 1;
  IF v_session.used_at IS NOT NULL OR v_recipient.status = 'redeemed' THEN
    RETURN QUERY SELECT v_recipient.id, 'Already redeemed.'::text, v_recipient.phone_normalized, v_session.expires_at, upper(right(v_session.token, 8)), v_recipient.gift_type, 'already-used';
  ELSIF v_session.expires_at < now() THEN
    RETURN QUERY SELECT v_recipient.id, 'Code expired.'::text, v_recipient.phone_normalized, v_session.expires_at, upper(right(v_session.token, 8)), v_recipient.gift_type, 'expired';
  ELSE
    RETURN QUERY SELECT v_recipient.id, 'Valid code.'::text, v_recipient.phone_normalized, v_session.expires_at, upper(right(v_session.token, 8)), v_recipient.gift_type, 'valid';
  END IF;
END;
$$;

-- 4) Re-create redeem_reward_qr (Atomic updates, No FOR UPDATE)
CREATE OR REPLACE FUNCTION public.redeem_reward_qr(input_code text)
RETURNS TABLE (
  customer_id uuid, message text, phone text, redeemed_at timestamptz,
  redemption_code text, reward_type text, status text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session public.gift_qr_sessions%rowtype;
  v_recipient public.gift_recipients%rowtype;
  v_staff public.staff_profiles%rowtype;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_staff FROM public.staff_profiles WHERE user_id = auth.uid() AND active = TRUE LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, 'Staff access required.'::text, NULL, NULL, NULL, NULL, 'invalid';
    RETURN;
  END IF;

  UPDATE public.gift_qr_sessions SET used_at = v_now
  WHERE (lower(token) = lower(input_code) OR upper(right(token, 8)) = upper(input_code))
    AND used_at IS NULL AND expires_at > v_now
  RETURNING * INTO v_session;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, 'Invalid or expired code.'::text, NULL, NULL, NULL, NULL, 'invalid';
    RETURN;
  END IF;

  UPDATE public.gift_recipients SET status = 'redeemed', redeemed_at = v_now, redeemed_by = auth.uid(), branch_id = v_staff.branch_id
  WHERE id = v_session.recipient_id AND status = 'claimed'
  RETURNING * INTO v_recipient;

  RETURN QUERY SELECT v_recipient.id, 'Redeemed successfully.'::text, v_recipient.phone_normalized, v_now, upper(right(v_session.token, 8)), v_recipient.gift_type, 'valid';
END;
$$;

-- 5) Re-grant permissions
GRANT EXECUTE ON FUNCTION public.claim_reward_by_phone(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_reward_qr(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_reward_qr(text) TO authenticated;
