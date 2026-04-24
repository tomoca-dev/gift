import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://ggnsdiyekciabqzxjyfv.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnbnNkaXlla2NpYWJxenhqeWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NzU5NjIsImV4cCI6MjA5MTE1MTk2Mn0.DbBFXGT_e-fqK-RspML27L_J2Bj227QDOcCLh1gn4to"

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function check() {
  const res1 = await supabase.rpc('claim_gift_by_phone', { input_phone: '+251922334455' })
  console.log('claim_gift_by_phone:', res1.data, res1.error)

  const res2 = await supabase.rpc('claim_reward_by_phone', { input_phone: '+251922334455' })
  console.log('claim_reward_by_phone:', res2.data, res2.error)
}

check()
