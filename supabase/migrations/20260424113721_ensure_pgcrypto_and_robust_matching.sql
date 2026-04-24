-- 1) Ensure pgcrypto exists for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Make claim_reward_by_phone even more robust by trying multiple matching strategies
CREATE OR REPLACE FUNCTION public.claim_reward_by_phone(input_phone text)
RETURNS TABLE (
  customer_id uuid, message text, phone text, qr_expires_at timestamptz,
  qr_token text, redemption_code text, reward_type text, status text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_phone text;
  v_recipient public.gift_recipients%rowtype;
  v_token text;
  v_expires_at timestamptz;
BEGIN
  -- Normalize input
  v_phone := public.normalize_phone(input_phone);
  
  -- Attempt 1: Match by normalized phone and status 'eligible'
  UPDATE public.gift_recipients
  SET status = 'claimed', claimed_at = now()
  WHERE phone_normalized = v_phone AND status = 'eligible'
  RETURNING * INTO v_recipient;

  -- Attempt 2: If failed, check if the row exists but has wrong status
  IF NOT FOUND THEN
    SELECT * INTO v_recipient FROM public.gift_recipients 
    WHERE phone_normalized = v_phone 
       OR phone_raw = input_phone 
       OR phone_normalized = input_phone
    LIMIT 1;
    
    IF NOT FOUND THEN
      -- Final attempt: very loose digit-only match
      SELECT * INTO v_recipient FROM public.gift_recipients 
      WHERE regexp_replace(phone_normalized, '[^0-9]', '', 'g') = regexp_replace(input_phone, '[^0-9]', '', 'g')
      LIMIT 1;
    END IF;

    IF NOT FOUND THEN
      RETURN QUERY SELECT NULL::uuid, 'Phone number not found in eligible list.'::text, v_phone, NULL, NULL, NULL, NULL, 'not-approved';
    ELSIF v_recipient.status = 'redeemed' THEN
      RETURN QUERY SELECT v_recipient.id, 'This gift has already been redeemed.'::text, v_recipient.phone_normalized, NULL, NULL, NULL, v_recipient.gift_type, 'already-redeemed';
    ELSIF v_recipient.status = 'claimed' THEN
      -- If already claimed, check if they have a session
      SELECT * INTO v_token, v_expires_at FROM (
        SELECT token, expires_at FROM public.gift_qr_sessions 
        WHERE recipient_id = v_recipient.id AND used_at IS NULL AND expires_at > now()
        ORDER BY created_at DESC LIMIT 1
      ) s;
      
      IF v_token IS NOT NULL THEN
        RETURN QUERY SELECT v_recipient.id, 'You have an active claim.'::text, v_recipient.phone_normalized, v_expires_at, v_token, upper(right(v_token, 8)), v_recipient.gift_type, 'approved';
      ELSE
        RETURN QUERY SELECT v_recipient.id, 'Gift already claimed but session expired.'::text, v_recipient.phone_normalized, NULL, NULL, NULL, v_recipient.gift_type, 'already-redeemed';
      END IF;
    ELSE
      -- Any other status mismatch
      RETURN QUERY SELECT v_recipient.id, 'Phone exists but status is ' || v_recipient.status, v_recipient.phone_normalized, NULL, NULL, NULL, v_recipient.gift_type, 'not-approved';
    END IF;
    RETURN;
  END IF;

  -- Successfully claimed a new one
  v_token := encode(gen_random_bytes(24), 'hex');
  v_expires_at := now() + interval '2 minutes';
  INSERT INTO public.gift_qr_sessions(recipient_id, token, expires_at) VALUES (v_recipient.id, v_token, v_expires_at);
  
  RETURN QUERY SELECT v_recipient.id, 'Success! Show this to the cashier.'::text, v_phone, v_expires_at, v_token, upper(right(v_token, 8)), v_recipient.gift_type, 'approved';
END;
$$;
