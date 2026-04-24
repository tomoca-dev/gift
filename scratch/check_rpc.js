import fetch from 'node-fetch'; // wait, node 18+ has fetch natively

const SUPABASE_URL = "https://ggnsdiyekciabqzxjyfv.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnbnNkaXlla2NpYWJxenhqeWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NzU5NjIsImV4cCI6MjA5MTE1MTk2Mn0.DbBFXGT_e-fqK-RspML27L_J2Bj227QDOcCLh1gn4to"

async function checkApi() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_ANON_KEY}`, {
    headers: {
      'Accept': 'application/openapi+json'
    }
  });
  
  if (!res.ok) {
    console.error("Failed", await res.text());
    return;
  }
  
  const data = await res.json();
  const paths = Object.keys(data.paths);
  const rpcs = paths.filter(p => p.startsWith('/rpc/'));
  console.log("Available RPCs:", rpcs);
  
  // also check tables
  const tables = paths.filter(p => !p.startsWith('/rpc/') && !p.startsWith('/'));
  console.log("Available tables:", tables);
}

checkApi();
