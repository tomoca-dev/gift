import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log("Checking DB...");
  const { data: customers } = await supabase
    .from("reward_customers")
    .select("*")
    .limit(5);

  console.log("Sample Customers:", customers);

  if (customers && customers.length > 0) {
    const testPhone = customers[0].phone;
    console.log(`Testing claim_reward_by_phone for ${testPhone}...`);
    
    const { data: rpcData, error: rpcError } = await supabase.rpc("claim_reward_by_phone", {
      input_phone: testPhone,
    });
    
    console.log("RPC Data:", rpcData);
    console.log("RPC Error:", rpcError);

    // Test without +
    const testPhoneNoPlus = testPhone.replace('+', '');
    console.log(`Testing claim_reward_by_phone for ${testPhoneNoPlus}...`);
    
    const { data: rpcData2, error: rpcError2 } = await supabase.rpc("claim_reward_by_phone", {
      input_phone: testPhoneNoPlus,
    });
    console.log("RPC Data No Plus:", rpcData2);
  }
}

check();
