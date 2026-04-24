import { useEffect, useState, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { ScanLine, CheckCircle2, XCircle, AlertTriangle, Clock, LogOut, Coffee } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import QRScanner from "@/components/QRScanner";
import RedemptionHistory from "@/components/RedemptionHistory";
import { maskPhone } from "@/lib/phone";
import { supabase } from "@/integrations/supabase/client";
import type { CashierCheckResult } from "@/hooks/useRewardSystem";

const FloatingBeansBackgroundLazy = lazy(() =>
  import("@/components/CoffeeScene").then((m) => ({ default: m.FloatingBeansBackground })),
);

interface CashierScreenProps {
  onValidate: (code: string) => Promise<CashierCheckResult>;
  onRedeem: (code: string) => Promise<CashierCheckResult>;
}

type RedeemResult = CashierCheckResult["status"] | null;

const resultConfig = {
  valid: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10", label: "Valid — Ready to Redeem", showButton: true },
  "already-used": { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", label: "Already Used", showButton: false },
  expired: { icon: Clock, color: "text-primary", bg: "bg-primary/10", label: "QR Expired", showButton: false },
  invalid: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", label: "Invalid Code", showButton: false },
};

const CashierScreen = ({ onValidate, onRedeem }: CashierScreenProps) => {
  const { signOut, user } = useAuth();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<RedeemResult>(null);
  const [details, setDetails] = useState<CashierCheckResult | null>(null);
  const [redeemed, setRedeemed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ scans: 0, valid: 0, redeemed: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString();

      const [{ count: scansCount }, { count: redeemedCount }] = await Promise.all([
        supabase
          .from("reward_customers")
          .select("id", { count: "exact", head: true })
          .in("status", ["claimed", "redeemed"])
          .gte("claimed_at", todayIso),
        supabase
          .from("reward_customers")
          .select("id", { count: "exact", head: true })
          .eq("status", "redeemed")
          .gte("redeemed_at", todayIso),
      ]);

      setStats({
        scans: scansCount ?? 0,
        valid: (scansCount ?? 0) - (redeemedCount ?? 0),
        redeemed: redeemedCount ?? 0,
      });
    };

    fetchStats();

    // Refresh stats in real-time on any DB update
    const channel = supabase
      .channel("cashier_stats")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "reward_customers" }, fetchStats)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      void processCode(token);
      window.history.replaceState({}, document.title, "/cashier");
    }
  }, []);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    await processCode(code.trim());
  };

  const playSoundAndVibrate = (type: "success" | "error") => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(type === "success" ? [100, 50, 100] : [300]);
      }
      // Mock audio since we don't have real mp3s in public yet
      // const audio = new Audio(type === "success" ? "/success.mp3" : "/error.mp3");
      // audio.play().catch(() => {});
    } catch(e) {}
  };

  const processCode = async (rawCode: string) => {
    if (!rawCode) return;
    setCode(rawCode);
    setLoading(true);
    const response = await onValidate(rawCode);
    setDetails(response);
    setResult(response.status);
    setRedeemed(false);
    setLoading(false);
    playSoundAndVibrate(response.status === "valid" ? "success" : "error");
  };

  const handleRedeem = async () => {
    setLoading(true);
    const response = await onRedeem(code.trim());
    setDetails(response);
    setResult(response.status);
    setRedeemed(response.status === "valid");
    setLoading(false);
    if (response.status === "valid") playSoundAndVibrate("success");
  };

  return (
    <div className="min-h-screen bg-gradient-dark flex flex-col relative overflow-hidden">
      <Suspense fallback={null}>
        <FloatingBeansBackgroundLazy count={15} opacity={0.3} />
      </Suspense>

      <div className="relative z-10 bg-secondary/50 backdrop-blur-sm border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
              <ScanLine className="w-5 h-5 text-primary" />
            </motion.div>
            <div>
              <h1 className="font-display text-lg font-bold text-foreground">TOMOCA Cashier</h1>
              <p className="text-xs font-body text-muted-foreground">Branch: <strong className="text-foreground">Bole</strong> • {user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-1.5 px-2 py-1 bg-success/20 text-success rounded text-[10px] uppercase font-bold tracking-widest hidden sm:flex">
                <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse"></div>
                Online
             </div>
             <button onClick={signOut} className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm font-body transition-colors">
               <LogOut className="w-4 h-4" />
               <span className="hidden sm:inline">Logout</span>
             </button>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center px-6 py-6 overflow-y-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-6">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }} className="w-16 h-16 rounded-full bg-gradient-brass flex items-center justify-center mx-auto glow-brass">
            <Coffee className="w-8 h-8 text-primary-foreground" />
          </motion.div>

          <div className="w-full flex justify-between px-5 py-3 bg-secondary/30 rounded-xl border border-primary/20 backdrop-blur mb-2">
             <div className="text-center">
               <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1 font-body">Scans Today</p>
               <p className="text-lg font-bold text-foreground font-display">{stats.scans}</p>
             </div>
             <div className="w-px bg-border"></div>
             <div className="text-center">
               <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1 font-body">Valid</p>
               <p className="text-lg font-bold text-success font-display">{stats.valid}</p>
             </div>
             <div className="w-px bg-border"></div>
             <div className="text-center">
               <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1 font-body">Redeemed</p>
               <p className="text-lg font-bold text-primary font-display">{stats.redeemed}</p>
             </div>
          </div>

          <h2 className="text-xl font-display font-bold text-foreground text-center">Validate Reward</h2>

          <QRScanner onScan={processCode} />

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs font-body text-muted-foreground">or enter backup code</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleCheck} className="space-y-4">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste token or enter backup code"
              className="w-full px-4 py-4 rounded-xl bg-secondary/80 backdrop-blur border border-border text-foreground font-body tracking-wide text-center text-lg placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} type="submit" disabled={!code.trim() || loading} className="w-full py-3 rounded-xl bg-gradient-brass font-body font-semibold text-primary-foreground disabled:opacity-50">
              {loading ? "Checking..." : "Check Gift"}
            </motion.button>
          </form>

          {result && (
            <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="space-y-4">
              {(() => {
                const cfg = resultConfig[result];
                const Icon = cfg.icon;
                return (
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className={`${cfg.bg} backdrop-blur rounded-xl p-6 text-center`}>
                    <Icon className={`w-10 h-10 ${cfg.color} mx-auto mb-3`} />
                    <p className={`font-body font-semibold ${cfg.color}`}>{cfg.label}</p>
                    {details?.message ? <p className="text-xs text-muted-foreground mt-2">{details.message}</p> : null}
                  </motion.div>
                );
              })()}

              {details?.phone || details?.reward_type ? (
                <div className="glass-card rounded-xl p-4 space-y-2 text-sm font-body">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="text-foreground font-semibold">{details.phone ? maskPhone(details.phone) : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Gift</span>
                    <span className="text-foreground font-semibold text-right">{details.reward_type || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Backup code</span>
                    <span className="text-foreground font-semibold">{details.redemption_code || "—"}</span>
                  </div>
                </div>
              ) : null}

              {result === "valid" && !redeemed && (
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleRedeem} disabled={loading} className="w-full py-4 rounded-xl bg-success font-body font-bold text-success-foreground text-xl shadow-lg shadow-success/20 disabled:opacity-50">
                  REDEEM NOW
                </motion.button>
              )}
            </motion.div>
          )}

          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-4">
               <h3 className="font-display font-bold text-foreground">Recent Scans</h3>
            </div>
            <RedemptionHistory />
          </div>
        </motion.div>
      </div>

      {/* HUGE SUCCESS OVERLAY */}
      {redeemed && (
         <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="fixed inset-0 z-50 bg-success flex flex-col items-center justify-center p-6 text-center"
         >
            <motion.div 
               initial={{ scale: 0 }} 
               animate={{ scale: 1 }} 
               transition={{ type: "spring", stiffness: 150, delay: 0.1 }}
               className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center mb-8 backdrop-blur"
            >
               <CheckCircle2 className="w-20 h-20 text-white" />
            </motion.div>
            <h2 className="text-4xl font-display font-bold text-white mb-2">REDEEMED!</h2>
            <p className="text-white/80 font-body text-xl mb-8">
               {details?.reward_type || "Reward"} successfully given.
            </p>
            <p className="text-white/60 font-body text-sm mb-12">
               Customer: {details?.phone ? maskPhone(details?.phone) : "Unknown"}
            </p>
            
            <motion.button 
               whileHover={{ scale: 1.05 }} 
               whileTap={{ scale: 0.95 }}
               onClick={() => {
                  setRedeemed(false);
                  setResult(null);
                  setCode("");
                  setDetails(null);
               }}
               className="px-8 py-4 bg-white text-success font-bold font-body rounded-full text-lg shadow-xl"
            >
               Scan Next Customer
            </motion.button>
         </motion.div>
      )}
    </div>
  );
};

export default CashierScreen;
