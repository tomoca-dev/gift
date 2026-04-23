// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ManageStaffRequest {
  action: "list" | "create" | "delete";
  email?: string;
  password?: string;
  branchId?: string;
  userId?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase configuration");
    }

    // Authenticate the caller (must be an admin)
    const clientAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const { data: { user }, error: authError } = await clientAuth.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    // Service role client for sensitive operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    });

    // Check if the user is an admin
    const { data: profile } = await supabaseAdmin
      .from("staff_profiles")
      .select("role")
      .eq("user_id", user.id)
      .eq("active", true)
      .single();

    if (profile?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const { action, email, password, branchId, userId } = await req.json() as ManageStaffRequest;

    if (action === "list") {
      // List staff from public profiles
      const { data: staff, error } = await supabaseAdmin
        .from("staff_profiles")
        .select(`
          id,
          user_id,
          role,
          created_at,
          branch:branches(id, name)
        `)
        .eq("active", true);

      if (error) throw error;

      // Map to include email from auth (requires admin access)
      const staffWithEmails = await Promise.all((staff || []).map(async (s: any) => {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(s.user_id);
        return {
          id: s.user_id,
          email: authUser?.user?.email || "Unknown",
          created_at: s.created_at,
          branch: s.branch
        };
      }));

      return new Response(JSON.stringify({ cashiers: staffWithEmails }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "create") {
      if (!email || !password) throw new Error("Email and password required");

      // 1. Create auth user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError) throw createError;

      // 2. Create staff profile
      const { error: profileError } = await supabaseAdmin
        .from("staff_profiles")
        .insert({
          user_id: newUser.user.id,
          role: "cashier",
          branch_id: branchId || null,
        });

      if (profileError) {
        // Rollback auth user if profile creation fails
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        throw profileError;
      }

      return new Response(JSON.stringify({ success: true, user: newUser.user }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "delete") {
      if (!userId) throw new Error("User ID required");

      // 1. Delete auth user (cascades to profile)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteError) throw deleteError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error("Invalid action");

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
