import { Download, FileText } from "lucide-react";

export default function ImportHistoryUI() {
  const mockHistory = [
    { id: 1, file: "april_customers_batch1.csv", total: 1000, valid: 980, invalid: 5, duplicates: 15, uploadedBy: "admin@tomoca.com", date: "2026-04-18 10:30 AM" },
    { id: 2, file: "vip_list_q1.xlsx", total: 250, valid: 250, invalid: 0, duplicates: 0, uploadedBy: "manager@tomoca.com", date: "2026-04-10 14:15 PM" },
  ];

  return (
    <div className="glass-card rounded-xl overflow-hidden backdrop-blur">
      <div className="px-6 py-5 border-b border-border">
        <h2 className="font-display font-bold text-xl text-foreground">Import History</h2>
        <p className="text-sm text-muted-foreground font-body">Review past data uploads and stats.</p>
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-secondary/10">
            <th className="px-6 py-4 text-left text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">File Name</th>
            <th className="px-6 py-4 text-left text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">Stats</th>
            <th className="px-6 py-4 text-left text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">Uploaded By</th>
            <th className="px-6 py-4 text-left text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
            <th className="px-6 py-4 text-right text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">Report</th>
          </tr>
        </thead>
        <tbody>
          {mockHistory.map((row) => (
            <tr key={row.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
              <td className="px-6 py-4 font-body font-medium text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                {row.file}
              </td>
              <td className="px-6 py-4">
                <div className="flex gap-3 text-xs font-body">
                  <span className="text-muted-foreground">Total: <b className="text-foreground">{row.total}</b></span>
                  <span className="text-success">Valid: <b className="text-success">{row.valid}</b></span>
                  {row.invalid > 0 && <span className="text-destructive">Inv: <b className="text-destructive">{row.invalid}</b></span>}
                  {row.duplicates > 0 && <span className="text-amber-500">Dup: <b className="text-amber-500">{row.duplicates}</b></span>}
                </div>
              </td>
              <td className="px-6 py-4 font-body text-sm text-muted-foreground">{row.uploadedBy}</td>
              <td className="px-6 py-4 font-body text-sm text-muted-foreground">{row.date}</td>
              <td className="px-6 py-4 text-right">
                <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded">
                  <Download className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
