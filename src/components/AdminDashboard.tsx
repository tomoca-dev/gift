import { useEffect, useState, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { Bot, Users, Gift, CheckCircle2, Clock, BarChart3, LogOut, Loader2, UserPlus, TrendingUp, List, UserCog } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import AdminAnalytics from "@/components/AdminAnalytics";
import AddCustomerDialog from "@/components/AddCustomerDialog";
import ManageCashiers from "@/components/ManageCashiers";
import ExportReports from "@/components/ExportReports";
import SmartImportUI from "./admin/SmartImportUI";
import CampaignManagementUI from "./admin/CampaignManagementUI";
import ImportHistoryUI from "./admin/ImportHistoryUI";
import AuditLogsUI from "./admin/AuditLogsUI";

const FloatingBeansBackgroundLazy = lazy(() =>
  import("@/components/CoffeeScene").then((m) => ({ default: m.FloatingBeansBackground })),
);

type RewardCustomer = Tables<"reward_customers">;

type Tab = "customers" | "campaigns" | "import" | "history" | "analytics" | "staff" | "audit";

const AdminDashboard = () => {
  const { signOut, user } = useAuth();
  const [customers, setCustomers] = useState<RewardCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("customers");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const fetchCustomers = async () => {
    const { data } = await supabase.from("reward_customers").select("*").order("created_at", { ascending: false });
    setCustomers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
    const channel = supabase
      .channel("reward_customers_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "reward_customers" }, () => {
        fetchCustomers();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const total = customers.length;
  const eligible = customers.filter((c) => c.status === "eligible").length;
  const claimed = customers.filter((c) => c.status === "claimed").length;
  const redeemed = customers.filter((c) => c.status === "redeemed").length;

  const stats = [
    { label: "Total Loaded", value: total, icon: Users, color: "text-primary" },
    { label: "Eligible", value: eligible, icon: Gift, color: "text-brass-glow" },
    { label: "Claimed QR", value: claimed, icon: Clock, color: "text-primary" },
    { label: "Redeemed", value: redeemed, icon: CheckCircle2, color: "text-success" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-dark">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark relative overflow-hidden">
      <Suspense fallback={null}>
        <FloatingBeansBackgroundLazy count={25} opacity={0.2} />
      </Suspense>

      <div className="relative z-10 bg-secondary/30 backdrop-blur-sm border-b border-border px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}>
              <BarChart3 className="w-5 h-5 text-primary" />
            </motion.div>
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">TOMOCA Admin</h1>
              <p className="text-xs font-body text-muted-foreground">Reward Management • {user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setAddDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-brass font-body text-sm text-primary-foreground font-semibold"
            >
              <UserPlus className="w-4 h-4" />
              Assign Reward
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTab("import")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/80 backdrop-blur border border-border font-body text-sm text-foreground hover:bg-muted"
            >
              <Bot className="w-4 h-4" />
              Gemini Import
            </motion.button>
            <ExportReports customers={customers} />
            <button onClick={signOut} className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm font-body transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: i * 0.1, type: "spring", stiffness: 200 }}
              whileHover={{ scale: 1.05, y: -4 }}
              className="glass-card rounded-xl p-5"
            >
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}>
                <stat.icon className={`w-5 h-5 ${stat.color} mb-3`} />
              </motion.div>
              <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
              <p className="text-xs font-body text-muted-foreground mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {([
            { key: "campaigns" as Tab, label: "Campaigns", icon: List },
            { key: "import" as Tab, label: "Smart Import", icon: Bot },
            { key: "history" as Tab, label: "Import History", icon: Clock },
            { key: "customers" as Tab, label: "Customers", icon: Users },
            { key: "analytics" as Tab, label: "Analytics", icon: TrendingUp },
            { key: "staff" as Tab, label: "Staff", icon: UserCog },
            { key: "audit" as Tab, label: "Audit Logs", icon: CheckCircle2 },
          ]).map((t) => (
            <motion.button
              key={t.key}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl font-body text-sm font-medium transition-all ${
                tab === t.key ? "bg-gradient-brass text-primary-foreground shadow-sm" : "glass-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </motion.button>
          ))}
        </div>

        {tab === "campaigns" ? (
          <CampaignManagementUI />
        ) : tab === "import" ? (
          <SmartImportUI />
        ) : tab === "history" ? (
          <ImportHistoryUI />
        ) : tab === "analytics" ? (
          <AdminAnalytics customers={customers} />
        ) : tab === "staff" ? (
          <ManageCashiers />
        ) : tab === "audit" ? (
          <AuditLogsUI />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card rounded-xl overflow-hidden backdrop-blur"
          >
            <div className="px-5 py-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="font-display font-bold text-foreground">Customer List</h2>
              <div className="flex items-center gap-3">
                <input 
                  type="text" 
                  placeholder="Search by phone..." 
                  className="px-3 py-1.5 rounded-lg bg-secondary/50 border border-border text-sm font-body focus:outline-none focus:border-primary"
                />
                <select className="px-3 py-1.5 rounded-lg bg-secondary/50 border border-border text-sm font-body text-foreground focus:outline-none focus:border-primary">
                  <option value="all">All Statuses</option>
                  <option value="eligible">Eligible</option>
                  <option value="claimed">Claimed</option>
                  <option value="redeemed">Redeemed</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {["Phone", "Reward", "Backup Code", "Status", "Claimed", "Redeemed", "Actions"].map((h) => (
                      <th key={h} className={`px-5 py-3 text-left text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider ${h === "Actions" ? "text-right" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c, i) => (
                    <motion.tr
                      key={c.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.03 }}
                      className="group border-b border-border/50 hover:bg-secondary/30 transition-colors"
                    >
                      <td className="px-5 py-3 font-body text-sm text-foreground">{c.phone}</td>
                      <td className="px-5 py-3 font-body text-sm text-foreground">{c.reward_type}</td>
                      <td className="px-5 py-3 font-body text-sm text-muted-foreground tracking-wider">{c.redemption_code}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-body font-medium ${
                            c.status === "eligible"
                              ? "bg-primary/10 text-primary"
                              : c.status === "claimed"
                                ? "bg-amber-500/10 text-amber-400"
                                : "bg-success/10 text-success"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-body text-sm text-muted-foreground">{(c as any).claimed_at ? new Date((c as any).claimed_at).toLocaleString() : "—"}</td>
                      <td className="px-5 py-3 font-body text-sm text-muted-foreground">{c.redeemed_at ? new Date(c.redeemed_at).toLocaleString() : "—"}</td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                         <div className="flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                           <button className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded text-xs font-semibold font-body transition-colors">Force Claim</button>
                           <button className="px-2 py-1 bg-success/10 hover:bg-success/20 text-success rounded text-xs font-semibold font-body transition-colors">Redeem</button>
                           <button className="px-2 py-1 bg-secondary hover:bg-secondary/80 text-muted-foreground rounded text-xs font-semibold font-body transition-colors">Reset</button>
                         </div>
                      </td>
                    </motion.tr>
                  ))}
                  {customers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground font-body text-sm">
                        No customers yet. Use Gemini Import or assign rewards manually.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>

      <AddCustomerDialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} onAdded={fetchCustomers} />
    </div>
  );
};

export default AdminDashboard;
