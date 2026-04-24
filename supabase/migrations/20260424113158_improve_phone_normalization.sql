-- 1) Improved, aggressive phone normalization
CREATE OR REPLACE FUNCTION public.normalize_phone(input_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned text;
BEGIN
  IF input_phone IS NULL THEN
    RETURN NULL;
  END IF;

  -- Remove all non-digits
  cleaned := regexp_replace(input_phone, '[^0-9]', '', 'g');

  -- Handle 10-digit Ethiopian numbers (09... or 07...)
  IF cleaned ~ '^(09|07)[0-9]{8}$' THEN
    RETURN '+251' || substr(cleaned, 2);
  END IF;

  -- Handle 9-digit Ethiopian numbers (9... or 7...)
  IF cleaned ~ '^(9|7)[0-9]{8}$' THEN
    RETURN '+251' || cleaned;
  END IF;

  -- Handle 12-digit numbers starting with 251
  IF cleaned ~ '^251(9|7)[0-9]{8}$' THEN
    RETURN '+' || cleaned;
  END IF;

  -- Fallback: If it's already a full normalized number (13 digits starting with 251)
  -- we just return it with a +
  IF length(cleaned) >= 12 AND cleaned LIKE '251%' THEN
    RETURN '+' || cleaned;
  END IF;

  RETURN cleaned;
END;
$$;

-- 2) Re-normalize all existing recipients to ensure matching works
UPDATE public.gift_recipients
SET phone_normalized = public.normalize_phone(phone_normalized);

-- 3) Update claim_reward_by_phone to use the new normalization and be more robust
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
  -- We normalize the input first
  v_phone := public.normalize_phone(input_phone);
  
  IF v_phone IS NULL OR length(v_phone) < 10 THEN
    RETURN QUERY SELECT NULL::uuid, 'Invalid phone format.'::text, input_phone, NULL, NULL, NULL, NULL, 'not-approved';
    RETURN;
  END IF;

  -- Atomic update
  UPDATE public.gift_recipients
  SET status = 'claimed', claimed_at = now()
  WHERE phone_normalized = v_phone AND status = 'eligible'
  RETURNING * INTO v_recipient;

  IF NOT FOUND THEN
    -- If not eligible, find the row anyway to see WHY (e.g. already claimed)
    SELECT * INTO v_recipient FROM public.gift_recipients WHERE phone_normalized = v_phone LIMIT 1;
    
    IF NOT FOUND THEN
      -- Try one last time without normalization just in case of weird data
      SELECT * INTO v_recipient FROM public.gift_recipients WHERE phone_raw = input_phone OR phone_normalized = input_phone LIMIT 1;
    END IF;

    IF NOT FOUND THEN
      RETURN QUERY SELECT NULL::uuid, 'Phone number not found in our records.'::text, v_phone, NULL, NULL, NULL, NULL, 'not-approved';
    ELSIF v_recipient.status = 'redeemed' THEN
      RETURN QUERY SELECT v_recipient.id, 'Gift already redeemed.'::text, v_recipient.phone_normalized, NULL, NULL, NULL, v_recipient.gift_type, 'already-redeemed';
    ELSIF v_recipient.status = 'claimed' THEN
      -- If they already claimed but haven't redeemed, we can just return their active session or a message
      RETURN QUERY SELECT v_recipient.id, 'Already received. Check your QR code.'::text, v_recipient.phone_normalized, NULL, NULL, NULL, v_recipient.gift_type, 'already-redeemed';
    ELSE
      -- This shouldn't really happen if the update above failed, but safety first
      RETURN QUERY SELECT v_recipient.id, 'Gift not available for this number.'::text, v_recipient.phone_normalized, NULL, NULL, NULL, v_recipient.gift_type, 'not-approved';
    END IF;
    RETURN;
  END IF;

  v_token := encode(gen_random_bytes(24), 'hex');
  v_expires_at := now() + interval '2 minutes';
  INSERT INTO public.gift_qr_sessions(recipient_id, token, expires_at) VALUES (v_recipient.id, v_token, v_expires_at);
  
  RETURN QUERY SELECT v_recipient.id, 'Approved!'::text, v_phone, v_expires_at, v_token, upper(right(v_token, 8)), v_recipient.gift_type, 'approved';
END;
$$;
