import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { History, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type RewardCustomer = Tables<"reward_customers">;

const RedemptionHistory = () => {
  const [records, setRecords] = useState<RewardCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from("reward_customers")
        .select("*")
        .eq("status", "redeemed")
        .gte("redeemed_at", today.toISOString())
        .order("redeemed_at", { ascending: false });

      setRecords(data || []);
      setLoading(false);
    };
    fetch();

    const channel = supabase
      .channel("cashier_history")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "reward_customers" }, () => {
        fetch();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2 mb-2">
        <History className="w-4 h-4 text-primary" />
        <h3 className="font-display font-bold text-foreground text-sm">
          Today's Redemptions ({records.length})
        </h3>
      </div>

      {records.length === 0 ? (
        <p className="text-muted-foreground font-body text-sm text-center py-6">
          No redemptions today yet.
        </p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {records.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card rounded-lg p-3 flex items-center justify-between"
            >
              <div>
                <p className="font-body text-sm text-foreground">{r.phone}</p>
                <p className="font-body text-xs text-muted-foreground">{r.reward_type}</p>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span className="font-body text-xs text-muted-foreground">
                  {r.redeemed_at ? new Date(r.redeemed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default RedemptionHistory;
