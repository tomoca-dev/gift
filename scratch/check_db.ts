import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function checkNumber() {
  const number = '+251966923206'
  const { data, error } = await supabase
    .from('gift_recipients')
    .select('*')
    .eq('phone_normalized', number)
  
  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Results:', data)
  }

  const { data: all, error: err2 } = await supabase
    .from('gift_recipients')
    .select('phone_normalized, status')
    .limit(10)
  
  console.log('Sample data:', all)
}

checkNumber()
