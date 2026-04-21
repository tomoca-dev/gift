import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, Trash2, Loader2, Users, Mail, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Cashier {
  id: string;
  email: string;
  created_at: string;
  branch?: {
    id: string;
    name: string;
  };
}

interface Branch {
  id: string;
  name: string;
}

const ManageCashiers = () => {
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchCashiers = async () => {
    setLoading(true);
    // Fetch branches first
    const { data: branchData } = await supabase.from("branches").select("id, name");
    setBranches(branchData || []);

    const res = await supabase.functions.invoke("manage-staff", {
      body: { action: "list" },
    });
    setCashiers(res.data?.cashiers || []);
    setLoading(false);
  };

  useEffect(() => { fetchCashiers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setCreating(true);
    const res = await supabase.functions.invoke("manage-staff", {
      body: { action: "create", email, password, branchId: selectedBranchId },
    });
    if (res.data?.error) {
      toast({ title: "Error", description: res.data.error, variant: "destructive" });
    } else {
      toast({ title: "Cashier created", description: `${email} added successfully` });
      setEmail("");
      setPassword("");
      setShowForm(false);
      fetchCashiers();
    }
    setCreating(false);
  };

  const handleDelete = async (userId: string, userEmail: string) => {
    if (!confirm(`Remove cashier ${userEmail}?`)) return;
    await supabase.functions.invoke("manage-staff", {
      body: { action: "delete", userId },
    });
    toast({ title: "Removed", description: `${userEmail} removed` });
    fetchCashiers();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Cashier Staff ({cashiers.length})
        </h3>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-brass font-body text-sm text-primary-foreground font-semibold"
        >
          <UserPlus className="w-4 h-4" />
          Add Cashier
        </motion.button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            className="glass-card rounded-xl p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-secondary/80 border border-border text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                placeholder="Password (min 6 chars)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-secondary/80 border border-border text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <select
                value={selectedBranchId}
                onChange={e => setSelectedBranchId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-secondary/80 border border-border text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
                required
              >
                <option value="" disabled>Select Branch Location</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={creating || !email || password.length < 6}
              className="w-full py-2 rounded-lg bg-primary font-body text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Cashier Account"}
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="glass-card rounded-xl overflow-hidden">
        {cashiers.length === 0 ? (
          <p className="px-5 py-8 text-center text-muted-foreground font-body text-sm">
            No cashier accounts yet.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {cashiers.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between px-5 py-3 hover:bg-secondary/30 transition-colors"
              >
                <div>
                  <p className="font-body font-semibold text-sm text-foreground">{c.email}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-primary/10 text-primary tracking-wider">
                      Branch: {c.branch?.name || "Unassigned"}
                    </span>
                    <span className="font-body text-xs text-muted-foreground">
                      Redemptions: <b className="text-foreground">142</b>
                    </span>
                    <span className="font-body text-xs text-muted-foreground opacity-60">
                      Added {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleDelete(c.id, c.email || "")}
                  className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageCashiers;
