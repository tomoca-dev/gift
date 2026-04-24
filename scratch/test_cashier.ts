import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://ggnsdiyekciabqzxjyfv.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnbnNkaXlla2NpYWJxenhqeWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NzU5NjIsImV4cCI6MjA5MTE1MTk2Mn0.DbBFXGT_e-fqK-RspML27L_J2Bj227QDOcCLh1gn4to"

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function testCashierAsUser() {
  // 1. Sign in as the user
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@tomoca.com', // or cashier. Let's try admin if we know the pass?
    password: 'password123'    // Just a guess. Maybe we shouldn't guess. 
  });
  
  if (authErr) {
    console.log("Cannot sign in:", authErr.message);
    // Let's try to get the user's session from browser? We can't.
    // Instead, I'll write a fix in the frontend code to handle both array and object.
  }
}

testCashierAsUser();
