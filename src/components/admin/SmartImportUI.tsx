import { UploadCloud, CheckCircle, FileDown, Loader2, Sparkles, FileText, Type, Image as ImageIcon, Send } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { discoverMappings, extractData, analyzeBulkRows, type ImportAnalysisSelection, type AIAnalyzedRow } from "@/lib/gemini";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ProcessedData {
  rows: AIAnalyzedRow[];
  counts: {
    valid: number;
    invalid: number;
    duplicate: number;
    suspicious: number;
  };
}

const parseAnyFile = async (file: File): Promise<{ headers: string[]; data: any[] }> => {
  const extension = (file.name.split(".").pop() || "").toLowerCase();
  const mime = file.type || "";

  if (mime.startsWith("image/")) return { headers: [], data: [] };

  const spreadsheetExtensions = ["xlsx", "xls", "xlsm", "xlsb", "ods"];
  const textLikeExtensions = ["csv", "tsv", "txt", "json"];

  if (spreadsheetExtensions.includes(extension)) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];
    return { headers: data.length ? Object.keys(data[0]) : [], data };
  }

  const text = await file.text();
  const nonEmptyLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (extension === "json" || mime.includes("json")) {
    const parsed = JSON.parse(text);
    const data = Array.isArray(parsed) ? parsed : [parsed];
    return { headers: data.length ? Object.keys(data[0]) : [], data };
  }

  const firstLine = nonEmptyLines[0] || "";
  const seemsDelimited = firstLine.includes(",") || firstLine.includes("	") || firstLine.includes(";") || firstLine.includes("|");
  if (textLikeExtensions.includes(extension) || mime.startsWith("text/") || seemsDelimited) {
    const delimiter = firstLine.includes("	")
      ? "	"
      : firstLine.includes(";") && !firstLine.includes(",")
        ? ";"
        : firstLine.includes("|") && !firstLine.includes(",")
          ? "|"
          : ",";
    const result = Papa.parse(text, { header: true, skipEmptyLines: true, delimiter });
    const data = Array.isArray(result.data) ? (result.data as any[]) : [];
    const headers = result.meta.fields || (data.length ? Object.keys(data[0]) : []);
    if (data.length && headers.length) return { headers, data };
  }

  return { headers: ["value"], data: nonEmptyLines.map((line) => ({ value: line })) };
};

export default function SmartImportUI() {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [analysis, setAnalysis] = useState<ImportAnalysisSelection | null>(null);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [fileName, setFileName] = useState("");
  const [importMode, setImportMode] = useState<"file" | "text" | "image">("file");
  const [pasteText, setPasteText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      const { data } = await supabase.from("gift_campaigns").select("id, name").eq("active", true);
      if (data) {
        setCampaigns(data);
        if (data.length > 0) setSelectedCampaignId(data[0].id);
      }
    };
    fetchCampaigns();
  }, []);

  const downloadErrorFile = () => {
    if (!processedData) return;
    const errors = processedData.rows.filter((r) => r.status !== "valid");
    if (!errors.length) return;
    const csv = Papa.unparse(errors);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = "import_errors.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEditRow = (index: number, field: keyof AIAnalyzedRow, value: string) => {
    if (!processedData) return;
    const newRows = [...processedData.rows];
    newRows[index] = { ...newRows[index], [field]: value };
    setProcessedData({ ...processedData, rows: newRows });
  };

  const processRows = async (rows: any[]) => {
    setAnalyzing(true);
    const aiResult = await analyzeBulkRows(rows);
    setAnalyzing(false);
    if (!aiResult) {
      toast({ title: "Validation Error", description: "Could not validate rows.", variant: "destructive" });
      return;
    }
    const counts = aiResult.rows.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, { valid: 0, invalid: 0, duplicate: 0, suspicious: 0 } as any);
    setProcessedData({ rows: aiResult.rows, counts });
  };

  const handleTextImport = async () => {
    if (!pasteText.trim()) return;
    setLoading(true);
    try {
      const result = await extractData("text", pasteText);
      if (result?.extractedRows?.length) await processRows(result.extractedRows);
      else await processRows(pasteText.split(/\r?\n/).filter(Boolean).map((line) => ({ rawPhone: line, gift_type: "1 Free Coffee" })));
    } catch (error) {
      console.error("Text extraction error:", error);
      toast({ title: "Analysis Failed", description: "Could not parse pasted data.", variant: "destructive" });
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setLoading(true);
    setProcessedData(null);
    setAnalysis(null);
    try {
      if (file.type.startsWith("image/")) {
        setImportMode("image");
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64 = (reader.result as string).split(",")[1];
            const result = await extractData("image", base64);
            if (result?.extractedRows?.length) await processRows(result.extractedRows);
            else toast({ title: "Analysis Failed", description: "No rows found in image.", variant: "destructive" });
          } finally {
            setLoading(false);
          }
        };
        reader.readAsDataURL(file);
        return;
      }

      const { headers, data } = await parseAnyFile(file);
      if (!data.length) {
        toast({ title: "Empty file", description: "No data found.", variant: "destructive" });
        return;
      }

      const mapping = await discoverMappings(headers, data.slice(0, 3));
      setAnalysis(mapping);
      const rowsToProcess = data.map((row) => ({
        rawPhone: row[mapping?.phoneColumn || headers[0] || "value"] ?? row.value ?? Object.values(row)[0],
        gift_type: mapping?.rewardTypeColumn ? row[mapping.rewardTypeColumn] : mapping?.suggestedRewardType || "1 Free Coffee",
      }));
      await processRows(rowsToProcess);
    } catch (error) {
      console.error("File error:", error);
      toast({ title: "Import Failed", description: "Could not read this file.", variant: "destructive" });
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  const handleImport = async () => {
    if (!processedData) return;
    const validRows = processedData.rows.filter((r) => r.status === "valid" || r.status === "suspicious");
    if (!validRows.length) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-import", {
        body: {
          action: "IMPORT",
          campaignId: selectedCampaignId,
          fileName,
          sourceType: importMode,
          summary: "Gemini-assisted import",
          rows: validRows.map((r) => ({
            rawPhone: r.rawPhone,
            normalizedPhone: r.normalizedPhone,
            giftType: r.rewardType || "1 Free Coffee",
            status: r.status,
            reason: r.reason,
            aiNote: r.aiNote,
          })),
        },
      });
      if (error) throw error;
      toast({ title: "Import Successful", description: `Imported ${data.imported} recipients.` });
      setProcessedData(null);
    } catch (error) {
      console.error("Import error:", error);
      toast({ title: "Import Failed", description: "Error saving data. Make sure you are logged in as admin.", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="glass-card p-6 rounded-xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="font-display font-bold text-xl text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Smart Import System
          </h2>
          <p className="text-sm text-muted-foreground font-body">
            Import CSV, Excel, JSON, TXT, pasted text, images, and mixed phone-name data.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider ml-1">Active Campaign</label>
          <select value={selectedCampaignId} onChange={(e) => setSelectedCampaignId(e.target.value)} className="bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/40">
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex bg-secondary/30 p-1 rounded-xl w-fit">
        <button onClick={() => setImportMode("file")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-body transition-all ${importMode === "file" ? "bg-background shadow-sm text-primary font-bold" : "text-muted-foreground hover:text-foreground"}`}><FileText className="w-4 h-4" />File Upload</button>
        <button onClick={() => setImportMode("text")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-body transition-all ${importMode === "text" ? "bg-background shadow-sm text-primary font-bold" : "text-muted-foreground hover:text-foreground"}`}><Type className="w-4 h-4" />Paste Text</button>
        <button onClick={() => setImportMode("image")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-body transition-all ${importMode === "image" ? "bg-background shadow-sm text-primary font-bold" : "text-muted-foreground hover:text-foreground"}`}><ImageIcon className="w-4 h-4" />Image OCR</button>
      </div>

      {importMode === "file" && (
        <div onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }} onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); setDragActive(false); const file = e.dataTransfer.files?.[0]; if (file) handleFile(file); }} className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
          <input ref={fileInputRef} type="file" className="hidden" accept=".csv,.tsv,.txt,.json,.xlsx,.xls,.xlsm,.xlsb,.ods,image/*,*/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />
          <div className="space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"><UploadCloud className="w-6 h-6 text-primary" /></div>
            <div>
              <p className="font-medium text-foreground">Drop any data file here</p>
              <p className="text-sm text-muted-foreground">CSV, Excel, JSON, text, images, or mixed phone-name lists</p>
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium">Choose File</button>
          </div>
        </div>
      )}

      {importMode === "text" && (
        <div className="space-y-3">
          <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} className="w-full min-h-[180px] bg-secondary/30 border border-border rounded-xl p-4 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/40" placeholder="Paste phone numbers, phone-name rows, CSV text, JSON, or other raw data here" />
          <button onClick={handleTextImport} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium"><Send className="w-4 h-4" />Analyze Text</button>
        </div>
      )}

      {importMode === "image" && (
        <div className="border border-border rounded-xl p-4 bg-secondary/20 text-sm text-muted-foreground">Use the file upload area above and select an image. The system will try to extract phone rows from the image.</div>
      )}

      {(loading || analyzing || importing) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />{importing ? "Importing valid rows..." : analyzing ? "Analyzing data..." : "Loading file..."}</div>
      )}

      {processedData && (
        <div className="space-y-4 border border-border rounded-xl p-4 bg-secondary/10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg bg-background p-3"><div className="text-muted-foreground">Valid</div><div className="text-lg font-bold">{processedData.counts.valid || 0}</div></div>
            <div className="rounded-lg bg-background p-3"><div className="text-muted-foreground">Invalid</div><div className="text-lg font-bold">{processedData.counts.invalid || 0}</div></div>
            <div className="rounded-lg bg-background p-3"><div className="text-muted-foreground">Duplicate</div><div className="text-lg font-bold">{processedData.counts.duplicate || 0}</div></div>
            <div className="rounded-lg bg-background p-3"><div className="text-muted-foreground">Suspicious</div><div className="text-lg font-bold">{processedData.counts.suspicious || 0}</div></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleImport} disabled={importing} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"><CheckCircle className="w-4 h-4" />Import Valid Rows</button>
            <button onClick={downloadErrorFile} className="inline-flex items-center gap-2 bg-secondary px-4 py-2 rounded-lg text-sm font-medium"><FileDown className="w-4 h-4" />Download Error File</button>
          </div>
          <div className="overflow-auto max-h-[420px] rounded-xl border border-border bg-background">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-secondary/60">
                <tr>
                  <th className="text-left p-3">Raw</th>
                  <th className="text-left p-3">Normalized</th>
                  <th className="text-left p-3">Gift</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Reason</th>
                </tr>
              </thead>
              <tbody>
                {processedData.rows.slice(0, 500).map((row, index) => (
                  <tr key={`${row.normalizedPhone}-${index}`} className="border-t border-border">
                    <td className="p-3">{row.rawPhone}</td>
                    <td className="p-3"><input value={row.normalizedPhone} onChange={(e) => handleEditRow(index, "normalizedPhone", e.target.value)} className="w-full bg-secondary/40 border border-border rounded px-2 py-1" /></td>
                    <td className="p-3"><input value={row.rewardType} onChange={(e) => handleEditRow(index, "rewardType", e.target.value)} className="w-full bg-secondary/40 border border-border rounded px-2 py-1" /></td>
                    <td className="p-3">{row.status}</td>
                    <td className="p-3">{row.reason || row.aiNote}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {processedData.rows.length > 500 && <p className="text-xs text-muted-foreground">Showing first 500 rows for preview.</p>}
        </div>
      )}
    </div>
  );
}
