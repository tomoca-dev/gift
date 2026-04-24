-- =========================================================
-- CUSTOMER CLAIM + CASHIER QR/CODE VERIFICATION FIX
-- Run this after the main schema. It creates the RPCs used by the frontend.
-- Supports:
--   1) Customer phone claim/authentication
--   2) Unique QR token per customer claim, 2-minute expiry
--   3) Cashier QR scan validation
--   4) Cashier backup code verification using the last 8 token characters
-- =========================================================

create extension if not exists pgcrypto;

-- Make sure gift_type has a safe default for manual/imported rows.
alter table public.gift_recipients
alter column gift_type set default '1 Free Coffee';

-- Helpful index for token/code lookup.
create index if not exists gift_qr_sessions_token_idx on public.gift_qr_sessions(token);
create index if not exists gift_qr_sessions_token_suffix_idx on public.gift_qr_sessions((right(token, 8)));

-- ---------------------------------------------------------
-- Customer phone claim RPC
-- ---------------------------------------------------------
drop function if exists public.claim_reward_by_phone(text);
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

  select *
  into v_recipient
  from public.gift_recipients
  where phone_normalized = v_phone
  limit 1
  for update;

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
    return;
  end if;

  if v_recipient.status in ('claimed', 'redeemed') then
    return query select
      v_recipient.id,
      'You have already received your gift.'::text,
      v_recipient.phone_normalized,
      null::timestamptz,
      null::text,
      null::text,
      v_recipient.gift_type,
      'already-redeemed'::text;
    return;
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');
  v_expires_at := now() + interval '2 minutes';

  update public.gift_recipients
  set status = 'claimed',
      claimed_at = now()
  where id = v_recipient.id;

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

revoke all on function public.claim_reward_by_phone(text) from public;
grant execute on function public.claim_reward_by_phone(text) to anon, authenticated;

-- ---------------------------------------------------------
-- Cashier validate QR/token/backup-code RPC
-- ---------------------------------------------------------
drop function if exists public.validate_reward_qr(text);
create or replace function public.validate_reward_qr(input_code text)
returns table (
  customer_id uuid,
  message text,
  phone text,
  qr_expires_at timestamptz,
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
  v_is_staff boolean;
begin
  v_code := trim(coalesce(input_code, ''));

  if auth.uid() is null then
    return query select null::uuid, 'Authentication required.'::text, null::text, null::timestamptz, null::text, null::text, 'invalid'::text;
    return;
  end if;

  select exists(
    select 1 from public.staff_profiles
    where user_id = auth.uid()
      and active = true
      and role in ('admin', 'cashier')
  ) into v_is_staff;

  if not v_is_staff then
    return query select null::uuid, 'Only active staff can validate gifts.'::text, null::text, null::timestamptz, null::text, null::text, 'invalid'::text;
    return;
  end if;

  select *
  into v_session
  from public.gift_qr_sessions
  where lower(token) = lower(v_code)
     or upper(right(token, 8)) = upper(v_code)
  order by created_at desc
  limit 1;

  if not found then
    return query select null::uuid, 'Invalid QR or backup code.'::text, null::text, null::timestamptz, null::text, null::text, 'invalid'::text;
    return;
  end if;

  select *
  into v_recipient
  from public.gift_recipients
  where id = v_session.recipient_id
  limit 1;

  if not found then
    return query select null::uuid, 'Recipient not found.'::text, null::text, null::timestamptz, null::text, null::text, 'invalid'::text;
    return;
  end if;

  if v_session.used_at is not null or v_recipient.status = 'redeemed' then
    return query select v_recipient.id, 'Gift already redeemed.'::text, v_recipient.phone_normalized, v_session.expires_at, upper(right(v_session.token, 8)), v_recipient.gift_type, 'already-used'::text;
    return;
  end if;

  if v_session.expires_at < now() then
    return query select v_recipient.id, 'QR code expired.'::text, v_recipient.phone_normalized, v_session.expires_at, upper(right(v_session.token, 8)), v_recipient.gift_type, 'expired'::text;
    return;
  end if;

  if v_recipient.status <> 'claimed' then
    return query select v_recipient.id, 'Gift is not ready for redemption.'::text, v_recipient.phone_normalized, v_session.expires_at, upper(right(v_session.token, 8)), v_recipient.gift_type, 'invalid'::text;
    return;
  end if;

  return query select v_recipient.id, 'Valid gift. Ready to redeem.'::text, v_recipient.phone_normalized, v_session.expires_at, upper(right(v_session.token, 8)), v_recipient.gift_type, 'valid'::text;
end;
$$;

revoke all on function public.validate_reward_qr(text) from public;
grant execute on function public.validate_reward_qr(text) to authenticated;

-- ---------------------------------------------------------
-- Cashier redeem QR/token/backup-code RPC
-- ---------------------------------------------------------
drop function if exists public.redeem_reward_qr(text);
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

  select *
  into v_session
  from public.gift_qr_sessions
  where lower(token) = lower(v_code)
     or upper(right(token, 8)) = upper(v_code)
  order by created_at desc
  limit 1
  for update;

  if not found then
    return query select null::uuid, 'Invalid QR or backup code.'::text, null::text, null::timestamptz, null::text, null::text, 'invalid'::text;
    return;
  end if;

  select *
  into v_recipient
  from public.gift_recipients
  where id = v_session.recipient_id
  limit 1
  for update;

  if not found then
    return query select null::uuid, 'Recipient not found.'::text, null::text, null::timestamptz, null::text, null::text, 'invalid'::text;
    return;
  end if;

  if v_session.used_at is not null or v_recipient.status = 'redeemed' then
    return query select v_recipient.id, 'Gift already redeemed.'::text, v_recipient.phone_normalized, v_recipient.redeemed_at, upper(right(v_session.token, 8)), v_recipient.gift_type, 'already-used'::text;
    return;
  end if;

  if v_session.expires_at < v_now then
    return query select v_recipient.id, 'QR code expired.'::text, v_recipient.phone_normalized, null::timestamptz, upper(right(v_session.token, 8)), v_recipient.gift_type, 'expired'::text;
    return;
  end if;

  if v_recipient.status <> 'claimed' then
    return query select v_recipient.id, 'Gift is not in a redeemable state.'::text, v_recipient.phone_normalized, null::timestamptz, upper(right(v_session.token, 8)), v_recipient.gift_type, 'invalid'::text;
    return;
  end if;

  update public.gift_qr_sessions
  set used_at = v_now
  where id = v_session.id;

  update public.gift_recipients
  set status = 'redeemed',
      redeemed_at = v_now,
      redeemed_by = auth.uid(),
      branch_id = v_staff.branch_id
  where id = v_recipient.id;

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

revoke all on function public.redeem_reward_qr(text) from public;
grant execute on function public.redeem_reward_qr(text) to authenticated;
