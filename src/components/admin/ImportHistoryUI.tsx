import { useEffect, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ImportBatch {
  id: string;
  original_filename: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  created_at: string;
  source_type: string;
}

export default function ImportHistoryUI() {
  const [history, setHistory] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("import_batches")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setHistory((data as unknown as ImportBatch[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

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
          <h2 className="font-display font-bold text-xl text-foreground">Import History</h2>
          <p className="text-sm text-muted-foreground font-body">Review past data uploads and stats.</p>
        </div>
        <button onClick={fetchHistory} className="text-xs text-primary hover:underline font-body">Refresh</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/10">
              <th className="px-6 py-4 text-left text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">File / Source</th>
              <th className="px-6 py-4 text-left text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">Stats</th>
              <th className="px-6 py-4 text-left text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
              <th className="px-6 py-4 text-right text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                <td className="px-6 py-4 font-body font-medium text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <div>
                    <div className="text-sm">{row.original_filename || "Manual Paste"}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{row.source_type}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-3 text-xs font-body">
                    <span className="text-muted-foreground">Total: <b className="text-foreground">{row.total_rows}</b></span>
                    <span className="text-success">Valid: <b className="text-success">{row.valid_rows}</b></span>
                    {row.invalid_rows > 0 && <span className="text-destructive">Inv: <b className="text-destructive">{row.invalid_rows}</b></span>}
                    {row.duplicate_rows > 0 && <span className="text-amber-500">Dup: <b className="text-amber-500">{row.duplicate_rows}</b></span>}
                  </div>
                </td>
                <td className="px-6 py-4 font-body text-sm text-muted-foreground">
                  {new Date(row.created_at).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded">
                    <Download className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground font-body text-sm">
                  No import history yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
