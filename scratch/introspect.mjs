const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

async function run() {
  const url = `${supabaseUrl}/rest/v1/?apikey=${supabaseAnonKey}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log("Raw API Response keys:", Object.keys(data));
  if (data.paths) {
      const rpcs = Object.keys(data.paths).filter(p => p.startsWith('/rpc/'));
      console.log("Available RPCs:", rpcs);
  } else {
      console.log("Data:", data);
  }
}
run();
