import { motion } from "framer-motion";
import { Download, FileSpreadsheet } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type RewardCustomer = Tables<"reward_customers">;

interface ExportReportsProps {
  customers: RewardCustomer[];
}

const ExportReports = ({ customers }: ExportReportsProps) => {
  const exportCSV = () => {
    const headers = ["Phone", "Reward Type", "Status", "Code", "Redeemed At", "Store", "Created At"];
    const rows = customers.map(c => [
      c.phone,
      c.reward_type,
      c.status,
      c.redemption_code,
      c.redeemed_at ? new Date(c.redeemed_at).toLocaleString() : "",
      c.store_name || "",
      new Date(c.created_at).toLocaleString(),
    ]);

    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tomoca-rewards-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const data = customers.map(c => ({
      phone: c.phone,
      reward_type: c.reward_type,
      status: c.status,
      redemption_code: c.redemption_code,
      redeemed_at: c.redeemed_at,
      store_name: c.store_name,
      created_at: c.created_at,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tomoca-rewards-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex items-center gap-2">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={exportCSV}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/80 backdrop-blur border border-border font-body text-sm text-foreground hover:bg-muted transition-colors"
      >
        <FileSpreadsheet className="w-4 h-4" />
        CSV
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={exportJSON}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/80 backdrop-blur border border-border font-body text-sm text-foreground hover:bg-muted transition-colors"
      >
        <Download className="w-4 h-4" />
        JSON
      </motion.button>
    </div>
  );
};

export default ExportReports;
