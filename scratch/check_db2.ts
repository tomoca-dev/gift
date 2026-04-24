import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://ggnsdiyekciabqzxjyfv.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnbnNkaXlla2NpYWJxenhqeWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NzU5NjIsImV4cCI6MjA5MTE1MTk2Mn0.DbBFXGT_e-fqK-RspML27L_J2Bj227QDOcCLh1gn4to"

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function check() {
  const { data, error } = await supabase
    .from('reward_customers')
    .select('*')
    .limit(5)
  
  if (error) {
    console.error('Error querying reward_customers:', error)
  } else {
    console.log('Sample reward_customers:', data)
  }

  // Also let's see how claim_reward_by_phone acts on one of these phones
  if (data && data.length > 0) {
    const testPhone = data[0].phone
    console.log('Testing claim_reward_by_phone with phone:', testPhone)
    const res = await supabase.rpc('claim_reward_by_phone', { input_phone: testPhone })
    console.log('RPC result:', res.data, res.error)
  }
}

check()
