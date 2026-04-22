import { useEffect, useState } from "react";
import { Activity, ShieldAlert, Cpu, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AuditLog {
  id: string;
  action: string;
  target_table: string;
  details: any;
  created_at: string;
  actor_user_id: string | null;
}

export default function AuditLogsUI() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error) setLogs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getLogIcon = (action: string) => {
    if (action.includes("redeem")) return { icon: Activity, color: "text-success", bg: "bg-success/10" };
    if (action.includes("claim")) return { icon: ShieldAlert, color: "text-amber-500", bg: "bg-amber-500/10" };
    return { icon: Cpu, color: "text-primary", bg: "bg-primary/10" };
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden backdrop-blur">
      <div className="px-6 py-5 border-b border-border flex justify-between items-center">
        <div>
          <h2 className="font-display font-bold text-xl text-foreground">Audit Logs</h2>
          <p className="text-sm text-muted-foreground font-body">Read-only timeline of system actions for accountability.</p>
        </div>
        <button onClick={fetchLogs} className="text-xs text-primary hover:underline font-body">Refresh</button>
      </div>
      
      <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto custom-scrollbar">
        {logs.map((log) => {
          const style = getLogIcon(log.action);
          return (
            <div key={log.id} className="flex gap-4">
              <div className={`mt-1 flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full ${style.bg}`}>
                <style.icon className={`w-5 h-5 ${style.color}`} />
              </div>
              <div className="flex-1 border-b border-border/50 pb-6 last:border-0 last:pb-0">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-body font-semibold text-foreground text-sm uppercase tracking-tight">{log.action.replace(/_/g, ' ')}</h3>
                  <span className="text-[10px] text-muted-foreground font-body uppercase tracking-widest bg-secondary/50 px-2 py-0.5 rounded">
                    {new Date(log.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground font-body leading-relaxed mb-2">
                  Action on <b className="text-foreground">{log.target_table}</b>: 
                  <span className="ml-1 opacity-80">{JSON.stringify(log.details)}</span>
                </p>
                <div className="text-[10px] text-muted-foreground/60 font-body uppercase tracking-wider">
                  Actor ID: {log.actor_user_id || "System/Public"}
                </div>
              </div>
            </div>
          );
        })}
        {logs.length === 0 && (
          <p className="text-center py-12 text-muted-foreground font-body text-sm">No logs found yet.</p>
        )}
      </div>
    </div>
  );
}
