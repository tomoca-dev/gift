-- =========================================================
-- FIX FOR "FOR UPDATE cannot be applied to the nullable side of an outer join"
-- This error happens in Supabase/Postgres when using FOR UPDATE on a table 
-- with RLS policies that involve joins or subqueries.
--
-- We refactor the RPCs to use UPDATE ... RETURNING or simple SELECTs
-- while maintaining data integrity.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Refactored Customer phone claim RPC
-- ---------------------------------------------------------
create or replace function public.claim_reward_by_phone(input_phone text)
returns table (
  customer_id uuid,
  message text,
  phone text,
  qr_expires_at timestamptz,
  qr_token text,
  redemption_code text,
  reward_type text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_recipient public.gift_recipients%rowtype;
  v_token text;
  v_expires_at timestamptz;
begin
  v_phone := public.normalize_phone(input_phone);

  if v_phone is null or v_phone !~ '^\+2519[0-9]{8}$' then
    return query select
      null::uuid,
      'Invalid phone number.'::text,
      null::text,
      null::timestamptz,
      null::text,
      null::text,
      null::text,
      'not-approved'::text;
    return;
  end if;

  -- Atomic update: attempt to claim only if status is 'eligible'
  -- This avoids the need for FOR UPDATE and handles race conditions.
  update public.gift_recipients
  set status = 'claimed',
      claimed_at = now()
  where phone_normalized = v_phone
    and status = 'eligible'
  returning * into v_recipient;

  -- If not found by the update, it's either not eligible or already claimed.
  if not found then
    select * into v_recipient
    from public.gift_recipients
    where phone_normalized = v_phone
    limit 1;

    if not found then
      return query select
        null::uuid,
        'Phone number not eligible for this promotion.'::text,
        v_phone,
        null::timestamptz,
        null::text,
        null::text,
        null::text,
        'not-approved'::text;
    else
      return query select
        v_recipient.id,
        'You have already received your gift.'::text,
        v_recipient.phone_normalized,
        null::timestamptz,
        null::text,
        null::text,
        v_recipient.gift_type,
        'already-redeemed'::text;
    end if;
    return;
  end if;

  -- Success: Generate token
  v_token := encode(gen_random_bytes(24), 'hex');
  v_expires_at := now() + interval '2 minutes';

  insert into public.gift_qr_sessions(recipient_id, token, expires_at)
  values (v_recipient.id, v_token, v_expires_at);

  insert into public.audit_logs(actor_user_id, action, target_table, target_id, details)
  values (
    null,
    'claim_reward_by_phone',
    'gift_recipients',
    v_recipient.id,
    jsonb_build_object(
      'phone_normalized', v_phone,
      'qr_expires_at', v_expires_at,
      'backup_code', upper(right(v_token, 8))
    )
  );

  return query select
    v_recipient.id,
    'Gift claimed successfully.'::text,
    v_phone,
    v_expires_at,
    v_token,
    upper(right(v_token, 8)),
    v_recipient.gift_type,
    'approved'::text;
end;
$$;

-- ---------------------------------------------------------
-- 2) Refactored Cashier redeem QR/token/backup-code RPC
-- ---------------------------------------------------------
create or replace function public.redeem_reward_qr(input_code text)
returns table (
  customer_id uuid,
  message text,
  phone text,
  redeemed_at timestamptz,
  redemption_code text,
  reward_type text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_session public.gift_qr_sessions%rowtype;
  v_recipient public.gift_recipients%rowtype;
  v_staff public.staff_profiles%rowtype;
  v_now timestamptz := now();
begin
  v_code := trim(coalesce(input_code, ''));

  if auth.uid() is null then
    return query select null::uuid, 'Authentication required.'::text, null::text, null::timestamptz, null::text, null::text, 'invalid'::text;
    return;
  end if;

  select *
  into v_staff
  from public.staff_profiles
  where user_id = auth.uid()
    and active = true
    and role in ('admin', 'cashier')
  limit 1;

  if not found then
    return query select null::uuid, 'Only active staff can redeem gifts.'::text, null::text, null::timestamptz, null::text, null::text, 'invalid'::text;
    return;
  end if;

  -- 1. Atomic update of the session to prevent double use.
  update public.gift_qr_sessions
  set used_at = v_now
  where (lower(token) = lower(v_code) or upper(right(token, 8)) = upper(v_code))
    and used_at is null
    and expires_at > v_now
  returning * into v_session;

  if not found then
    -- Check why it failed
    select * into v_session
    from public.gift_qr_sessions
    where lower(token) = lower(v_code) or upper(right(token, 8)) = upper(v_code)
    order by created_at desc
    limit 1;

    if not found then
      return query select null::uuid, 'Invalid QR or backup code.'::text, null::text, null::timestamptz, null::text, null::text, 'invalid'::text;
    elsif v_session.used_at is not null then
      return query select v_session.recipient_id, 'Gift already redeemed.'::text, null::text, v_session.used_at, upper(right(v_session.token, 8)), null::text, 'already-used'::text;
    else
      return query select v_session.recipient_id, 'QR code expired.'::text, null::text, null::timestamptz, upper(right(v_session.token, 8)), null::text, 'expired'::text;
    end if;
    return;
  end if;

  -- 2. Atomic update of the recipient status
  update public.gift_recipients
  set status = 'redeemed',
      redeemed_at = v_now,
      redeemed_by = auth.uid(),
      branch_id = v_staff.branch_id
  where id = v_session.recipient_id
    and status = 'claimed'
  returning * into v_recipient;

  if not found then
    -- This should be rare as we already locked the session.
    -- Rollback session use (optional but good for consistency)
    update public.gift_qr_sessions set used_at = null where id = v_session.id;
    return query select v_session.recipient_id, 'Gift is not in a redeemable state.'::text, null::text, null::timestamptz, upper(right(v_session.token, 8)), null::text, 'invalid'::text;
    return;
  end if;

  insert into public.audit_logs(actor_user_id, action, target_table, target_id, details)
  values (
    auth.uid(),
    'redeem_reward_qr',
    'gift_recipients',
    v_recipient.id,
    jsonb_build_object(
      'cashier_user_id', auth.uid(),
      'branch_id', v_staff.branch_id,
      'qr_session_id', v_session.id,
      'backup_code', upper(right(v_session.token, 8))
    )
  );

  return query select v_recipient.id, 'Gift redeemed successfully.'::text, v_recipient.phone_normalized, v_now, upper(right(v_session.token, 8)), v_recipient.gift_type, 'valid'::text;
end;
$$;
