import { useState, useEffect, useContext, createContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: "admin" | "cashier" | "none" | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; role?: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"admin" | "cashier" | "none" | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchRole(session.user.id), 0);
      } else {
        setRole(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchRole = async (userId: string) => {
    // Try staff_profiles first (new schema)
    const { data: profileData } = await supabase
      .from("staff_profiles")
      .select("role, branch_id")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (profileData) {
      setRole((profileData.role as "admin" | "cashier") ?? "none");
      return;
    }

    // Fallback to user_roles (old schema)
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    
    setRole((roleData?.role as "admin" | "cashier") ?? "none");
  };

  const signIn = async (email: string, password: string) => {
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (authData?.user && authData?.session) {
      setUser(authData.user);
      setSession(authData.session);
      
      // Try staff_profiles first
      const { data: profileData } = await supabase
        .from("staff_profiles")
        .select("role, branch_id")
        .eq("user_id", authData.user.id)
        .maybeSingle();
      
      let userRole: "admin" | "cashier" | "none" = "none";
      
      if (profileData) {
        userRole = (profileData.role as "admin" | "cashier") ?? "none";
      } else {
        // Fallback to user_roles
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", authData.user.id)
          .maybeSingle();
        userRole = (roleData?.role as "admin" | "cashier") ?? "none";
      }
      
      setRole(userRole);
      return { error: null, role: userRole };
    }
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, role, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
