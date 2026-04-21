import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bot, FileUp, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type PreviewRow = {
  index: number;
  rawPhone: string;
  normalizedPhone: string;
  rewardType: string;
  status: "valid" | "invalid" | "duplicate" | "suspicious";
  reason: string;
  aiNote?: string;
};

interface AIImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

function parseCsv(text: string): { phone: string; reward_type: string }[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const [headerLine, ...dataLines] = lines;
  const headers = headerLine.split(",").map((h) => h.trim().toLowerCase());
  const phoneIndex = headers.findIndex((h) => h.includes("phone"));
  const rewardIndex = headers.findIndex((h) => h.includes("reward"));

  return dataLines.map((line) => {
    const cells = line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
    return {
      phone: cells[phoneIndex >= 0 ? phoneIndex : 0] || "",
      reward_type: cells[rewardIndex >= 0 ? rewardIndex : 1] || "1 Free Macchiato",
    };
  });
}

const AIImportDialog = ({ open, onClose, onImported }: AIImportDialogProps) => {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<{ phone: string; reward_type: string }[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [geminiUsed, setGeminiUsed] = useState(false);

  const counts = useMemo(() => preview.reduce(
    (acc, row) => {
      acc[row.status] += 1;
      return acc;
    },
    { valid: 0, invalid: 0, duplicate: 0, suspicious: 0 },
  ), [preview]);

  const reset = () => {
    setFileName("");
    setRows([]);
    setPreview([]);
    setSummary("");
    setGeminiUsed(false);
    setLoading(false);
    setImporting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const parsed = parseCsv(text);
    if (!parsed.length) {
      toast.error("No rows were found in that CSV file.");
      return;
    }

    setRows(parsed);
    setFileName(file.name);
    setPreview([]);
    setSummary("");
    setGeminiUsed(false);
  };

  const analyze = async () => {
    if (!rows.length) return;

    setLoading(true);
    const { data, error } = await supabase.functions.invoke("analyze-import", {
      body: { action: "analyze", rows },
    });
    setLoading(false);

    if (error) {
      console.error("Gemini Analysis Error:", error);
      toast.error(error.message || "AI import analysis failed. Check function logs.");
      setPreview([]);
      return;
    }

    if (!data?.rows) {
      toast.error("AI returned no rows. Try a different file.");
      return;
    }

    setPreview(data.rows || []);
    setSummary(data.summary || "Analysis completed.");
    setGeminiUsed(Boolean(data.geminiUsed));
    toast.success("AI Analysis complete. Review the results below.");
  };

  const importValidRows = async () => {
    const validRows = preview.filter((row) => row.status === "valid").map((row) => ({
      phone: row.normalizedPhone,
      reward_type: row.rewardType,
    }));

    if (!validRows.length) {
      toast.error("There are no valid rows to import.");
      return;
    }

    setImporting(true);
    const { data, error } = await supabase.functions.invoke("analyze-import", {
      body: { action: "import", rows: validRows },
    });
    setImporting(false);

    if (error) {
      toast.error(error.message || "Import failed.");
      return;
    }

    toast.success(`Imported ${data.imported} customers.`);
    onImported();
    handleClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-4xl glass-card rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-brass flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Gemini Import Analyzer</h2>
              <p className="text-xs text-muted-foreground font-body">Analyze Ethiopian phone numbers before storing them in Supabase.</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          <div className="space-y-4">
            <label className="block rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-center cursor-pointer hover:bg-secondary/60 transition-colors">
              <FileUp className="w-8 h-8 text-primary mx-auto mb-3" />
              <p className="font-body text-sm text-foreground mb-1">Upload CSV file</p>
              <p className="font-body text-xs text-muted-foreground">Use columns like phone,reward_type</p>
              <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </label>

            {fileName && (
              <div className="rounded-xl bg-secondary/60 p-4 text-sm font-body text-foreground">
                <p className="font-semibold mb-1">Selected file</p>
                <p className="text-muted-foreground">{fileName}</p>
                <p className="text-muted-foreground mt-1">{rows.length} rows parsed</p>
              </div>
            )}

            <button
              onClick={analyze}
              disabled={!rows.length || loading}
              className="w-full py-3 rounded-xl bg-gradient-brass font-body font-semibold text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? "Analyzing..." : "Analyze with Gemini"}
            </button>

            <button
              onClick={importValidRows}
              disabled={!preview.length || importing || counts.valid === 0}
              className="w-full py-3 rounded-xl bg-success text-success-foreground font-body font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {importing ? "Importing..." : `Import ${counts.valid} valid rows`}
            </button>

            {preview.length > 0 && (
              <div className="rounded-2xl bg-secondary/40 p-4 space-y-2 text-sm font-body">
                <p className="text-foreground font-semibold">Analysis summary</p>
                <p className="text-muted-foreground">{summary}</p>
                <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                  <div className="rounded-lg bg-background/40 p-3 text-foreground">Valid: {counts.valid}</div>
                  <div className="rounded-lg bg-background/40 p-3 text-foreground">Suspicious: {counts.suspicious}</div>
                  <div className="rounded-lg bg-background/40 p-3 text-foreground">Duplicates: {counts.duplicate}</div>
                  <div className="rounded-lg bg-background/40 p-3 text-foreground">Invalid: {counts.invalid}</div>
                </div>
                <p className="text-[11px] text-muted-foreground">{geminiUsed ? "Gemini AI review completed." : "Rule-based fallback was used."}</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border overflow-hidden bg-secondary/20">
            <div className="grid grid-cols-[110px_1fr_1fr_120px] gap-3 px-4 py-3 border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-body">
              <span>Status</span>
              <span>Raw</span>
              <span>Normalized</span>
              <span>Reward</span>
            </div>
            <div className="max-h-[480px] overflow-y-auto divide-y divide-border/60">
              {preview.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground font-body text-sm">Upload a CSV, then run Gemini analysis to preview rows.</div>
              ) : (
                preview.map((row) => (
                  <div key={`${row.index}-${row.rawPhone}`} className="px-4 py-3 grid grid-cols-[110px_1fr_1fr_120px] gap-3 text-sm font-body items-start">
                    <div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        row.status === "valid" ? "bg-success/10 text-success" :
                        row.status === "suspicious" ? "bg-primary/10 text-primary" :
                        row.status === "duplicate" ? "bg-amber-500/10 text-amber-400" :
                        "bg-destructive/10 text-destructive"
                      }`}>
                        {row.status}
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{row.reason}</p>
                      {row.aiNote ? <p className="text-[11px] text-primary mt-1 leading-relaxed">{row.aiNote}</p> : null}
                    </div>
                    <div className="text-foreground break-all">{row.rawPhone || "—"}</div>
                    <div className="text-muted-foreground break-all">{row.normalizedPhone || "—"}</div>
                    <div className="text-foreground">{row.rewardType}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AIImportDialog;
