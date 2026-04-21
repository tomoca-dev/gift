import { Activity, ShieldAlert, Cpu } from "lucide-react";

export default function AuditLogsUI() {
  const mockLogs = [
    { id: 1, action: "Manual Force Redeem", detail: "Admin forced REDEEM for +251911223344", user: "admin@tomoca.com", time: "10 mins ago", icon: ShieldAlert, color: "text-amber-500", bg: "bg-amber-500/10" },
    { id: 2, action: "QR Scan Redeem", detail: "Cashier scanned and redeemed Free Macchiato for +251922334455", user: "cashier_bole@tomoca.com", time: "1 hour ago", icon: Activity, color: "text-success", bg: "bg-success/10" },
    { id: 3, action: "Smart Import", detail: "Gemini finished import. Cleaned 200 rows.", user: "System", time: "Yesterday", icon: Cpu, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <div className="glass-card rounded-xl overflow-hidden backdrop-blur">
      <div className="px-6 py-5 border-b border-border">
        <h2 className="font-display font-bold text-xl text-foreground">Audit Logs</h2>
        <p className="text-sm text-muted-foreground font-body">Read-only timeline of system actions for accountability.</p>
      </div>
      
      <div className="p-6 space-y-6">
        {mockLogs.map((log) => (
          <div key={log.id} className="flex gap-4">
            <div className={`mt-1 flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full ${log.bg}`}>
              <log.icon className={`w-5 h-5 ${log.color}`} />
            </div>
            <div className="flex-1 border-b border-border/50 pb-6 last:border-0 last:pb-0">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-body font-semibold text-foreground text-sm">{log.action}</h3>
                <span className="text-xs text-muted-foreground font-body">{log.time}</span>
              </div>
              <p className="text-sm text-muted-foreground font-body leading-relaxed mb-2">
                {log.detail}
              </p>
              <div className="text-xs text-muted-foreground/60 font-body">User: {log.user}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
