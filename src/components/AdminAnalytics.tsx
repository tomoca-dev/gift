import { useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { Tables } from "@/integrations/supabase/types";

type RewardCustomer = Tables<"gift_recipients">;

interface AdminAnalyticsProps {
  customers: RewardCustomer[];
}

const COLORS = ["hsl(36, 60%, 50%)", "hsl(142, 60%, 45%)", "hsl(0, 0%, 45%)", "hsl(0, 60%, 50%)"];

const AdminAnalytics = ({ customers }: AdminAnalyticsProps) => {
  const statusData = useMemo(() => {
    const counts = { eligible: 0, claimed: 0, redeemed: 0 };
    customers.forEach(c => {
      if (c.status in counts) counts[c.status as keyof typeof counts]++;
    });
    return [
      { name: "Available", value: counts.eligible },
      { name: "Claimed", value: counts.claimed },
      { name: "Redeemed", value: counts.redeemed },
    ];
  }, [customers]);

  const rewardTypeData = useMemo(() => {
    const map: Record<string, number> = {};
    customers.forEach(c => {
      map[c.gift_type] = (map[c.gift_type] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [customers]);

  const dailyData = useMemo(() => {
    const map: Record<string, { date: string; loaded: number; redeemed: number }> = {};
    customers.forEach(c => {
      const day = new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (!map[day]) map[day] = { date: day, loaded: 0, redeemed: 0 };
      map[day].loaded++;
    });
    customers.filter(c => c.redeemed_at).forEach(c => {
      const day = new Date(c.redeemed_at!).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (!map[day]) map[day] = { date: day, loaded: 0, redeemed: 0 };
      map[day].redeemed++;
    });
    return Object.values(map).slice(-14);
  }, [customers]);

  const redemptionRate = customers.length
    ? Math.round((customers.filter(c => c.status === "redeemed").length / customers.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Redemption Rate */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card rounded-xl p-6"
      >
        <h3 className="font-display font-bold text-foreground mb-1">Redemption Rate</h3>
        <p className="text-muted-foreground font-body text-xs mb-4">Percentage of loaded rewards that have been redeemed</p>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-4 rounded-full bg-secondary/80 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${redemptionRate}%` }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
              className="h-full rounded-full bg-gradient-brass"
            />
          </div>
          <span className="text-2xl font-display font-bold text-foreground">{redemptionRate}%</span>
        </div>
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-xl p-6"
        >
          <h3 className="font-display font-bold text-foreground mb-1">Status Breakdown</h3>
          <p className="text-muted-foreground font-body text-xs mb-4">Distribution of reward statuses</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
                animationBegin={300}
                animationDuration={1000}
              >
                {statusData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "hsl(30, 15%, 12%)", border: "1px solid hsl(30, 10%, 20%)", borderRadius: 8, color: "#fff", fontSize: 12 }}
              />
              <Legend
                formatter={(value) => <span style={{ color: "hsl(30, 10%, 60%)", fontSize: 12 }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Reward Types Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-xl p-6"
        >
          <h3 className="font-display font-bold text-foreground mb-1">Reward Types</h3>
          <p className="text-muted-foreground font-body text-xs mb-4">Count by reward category</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rewardTypeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(30, 10%, 20%)" />
              <XAxis dataKey="name" tick={{ fill: "hsl(30, 10%, 60%)", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(30, 10%, 60%)", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "hsl(30, 15%, 12%)", border: "1px solid hsl(30, 10%, 20%)", borderRadius: 8, color: "#fff", fontSize: 12 }}
              />
              <Bar dataKey="value" fill="hsl(36, 60%, 50%)" radius={[6, 6, 0, 0]} animationDuration={1000} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Daily Trend Line Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card rounded-xl p-6"
      >
        <h3 className="font-display font-bold text-foreground mb-1">Daily Activity</h3>
        <p className="text-muted-foreground font-body text-xs mb-4">Loaded vs redeemed rewards over time</p>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(30, 10%, 20%)" />
            <XAxis dataKey="date" tick={{ fill: "hsl(30, 10%, 60%)", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(30, 10%, 60%)", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "hsl(30, 15%, 12%)", border: "1px solid hsl(30, 10%, 20%)", borderRadius: 8, color: "#fff", fontSize: 12 }}
            />
            <Legend formatter={(value) => <span style={{ color: "hsl(30, 10%, 60%)", fontSize: 12 }}>{value}</span>} />
            <Line type="monotone" dataKey="loaded" stroke="hsl(36, 60%, 50%)" strokeWidth={2} dot={{ r: 4, fill: "hsl(36, 60%, 50%)" }} animationDuration={1200} />
            <Line type="monotone" dataKey="redeemed" stroke="hsl(142, 60%, 45%)" strokeWidth={2} dot={{ r: 4, fill: "hsl(142, 60%, 45%)" }} animationDuration={1200} />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
};

export default AdminAnalytics;
