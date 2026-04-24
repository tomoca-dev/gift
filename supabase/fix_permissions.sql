-- Fix permissions for the reward system RPCs
-- Run this in your Supabase SQL Editor

-- 1. Grant execute on claim_reward_by_phone to everyone (so landing page can use it)
GRANT EXECUTE ON FUNCTION public.claim_reward_by_phone(text) TO anon, authenticated;

-- 2. Grant execute on validate_reward_qr to authenticated staff
GRANT EXECUTE ON FUNCTION public.validate_reward_qr(text) TO authenticated;

-- 3. Grant execute on redeem_reward_qr to authenticated staff
GRANT EXECUTE ON FUNCTION public.redeem_reward_qr(text) TO authenticated;

-- 4. Ensure reward_customers table is accessible to anon/authenticated if not using RLS policies already
-- (Optional: adjust if your table needs specific policies)
GRANT SELECT ON public.reward_customers TO anon, authenticated;

-- Reload schema cache just in case
NOTIFY pgrst, 'reload schema';
