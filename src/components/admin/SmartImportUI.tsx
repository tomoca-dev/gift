import { UploadCloud, CheckCircle, AlertCircle, RefreshCw, FileDown, Loader2, Sparkles, FileText, Type, Image as ImageIcon, Send } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { discoverMappings, extractData, analyzeBulkRows, type ImportAnalysisSelection, type AIAnalyzedRow } from "@/lib/gemini";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type RecipientInsert = Database["public"]["Tables"]["gift_recipients"]["Insert"];

interface ProcessedData {
  rows: AIAnalyzedRow[];
  counts: {
    valid: number;
    invalid: number;
    duplicate: number;
    suspicious: number;
  };
}

export default function SmartImportUI() {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [analysis, setAnalysis] = useState<ImportAnalysisSelection | null>(null);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [importMode, setImportMode] = useState<"file" | "text" | "image">("file");
  const [pasteText, setPasteText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);


  const computeCounts = (rows: AIAnalyzedRow[]) => rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, { valid: 0, invalid: 0, duplicate: 0, suspicious: 0 } as any);

  const inferRowsWithoutAI = (rows: any[]) => {
    const seen = new Set<string>();
    return rows.map((row, index) => {
      const rawValue = String(row.rawPhone ?? row.phone ?? row.value ?? row.text ?? Object.values(row)[0] ?? "").trim();
      const phoneMatch = rawValue.match(/(\+2519\d{8}|2519\d{8}|09\d{8}|9\d{8})/);
      const extracted = phoneMatch ? phoneMatch[1] : rawValue;
      const cleaned = String(extracted).replace(/[^0-9+]/g, "");
      let normalized = cleaned;
      if (/^09\d{8}$/.test(cleaned)) normalized = `+251${cleaned.slice(1)}`;
      else if (/^9\d{8}$/.test(cleaned)) normalized = `+251${cleaned}`;
      else if (/^2519\d{8}$/.test(cleaned)) normalized = `+${cleaned}`;
      const rewardType = String(row.gift_type ?? row.giftType ?? row.rewardType ?? row.reward_type ?? "1 Free Coffee").trim() || "1 Free Coffee";
      let status: AIAnalyzedRow["status"] = "valid";
      let reason = "Fallback validation used";
      if (!/^\+2519\d{8}$/.test(normalized)) {
        status = "invalid";
        reason = "Invalid Ethiopian mobile number format";
      } else if (seen.has(normalized)) {
        status = "duplicate";
        reason = "Duplicate inside uploaded batch";
      } else if (rawValue !== extracted) {
        reason = "Phone extracted from mixed cell text";
      }
      if (status !== "invalid") seen.add(normalized);
      return { index, rawPhone: rawValue, normalizedPhone: normalized, rewardType, status, reason, aiNote: "" } satisfies AIAnalyzedRow;
    });
  };

  const parseDelimitedText = (text: string, delimiter: string) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return { headers: [], data: [] as any[] };
    const headers = lines[0].split(delimiter).map((h) => h.trim());
    const data = lines.slice(1).map((line) => {
      const values = line.split(delimiter);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => row[h || `column_${i+1}`] = (values[i] || "").trim());
      return row;
    });
    return { headers, data };
  };

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
    const errors = processedData.rows.filter(r => r.status !== 'valid');
    if (errors.length === 0) return;
    
    const csv = Papa.unparse(errors);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "import_errors.csv");
    link.style.visibility = "hidden";
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

  const handleTextImport = async () => {
    if (!pasteText.trim()) return;
    setLoading(true);
    setAnalyzing(true);
    
    try {
      const result = await extractData("text", pasteText);
      if (result?.extractedRows) {
        await processRows(result.extractedRows);
      } else {
        toast({ title: "Analysis Failed", description: "Gemini couldn't extract data.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Text extraction error:", error);
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  const processRows = async (rows: any[]) => {
    setAnalyzing(true);
    const aiResult = await analyzeBulkRows(rows);
    setAnalyzing(false);

    const finalRows = aiResult?.rows ?? inferRowsWithoutAI(rows);
    const counts = computeCounts(finalRows);
    setProcessedData({ rows: finalRows, counts });

    if (!aiResult) {
      toast({ title: "Using fallback analysis", description: "The server analyzer was unavailable, so local validation was used." });
    }
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setLoading(true);
    setProcessedData(null);
    setAnalysis(null);

    try {
      if (file.type.startsWith('image/')) {
        setImportMode("image");
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const result = await extractData("image", base64);
          if (result?.extractedRows) await processRows(result.extractedRows);
          setLoading(false);
        };
        reader.readAsDataURL(file);
        return;
      }

      let headers: string[] = [];
      let data: any[] = [];
      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith(".csv")) {
        const text = await file.text();
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        data = result.data as any[];
        headers = result.meta.fields || [];
      } else if (lowerName.endsWith(".tsv")) {
        const text = await file.text();
        ({ headers, data } = parseDelimitedText(text, "	"));
      } else if (lowerName.endsWith(".txt") || lowerName.endsWith(".json") || file.type.startsWith("text/")) {
        const text = await file.text();
        if (lowerName.endsWith(".json")) {
          const parsed = JSON.parse(text);
          data = Array.isArray(parsed) ? parsed : [parsed];
          headers = data.length > 0 ? Object.keys(data[0]) : [];
        } else {
          const nonEmptyLines = text.split(/?
/).map((l) => l.trim()).filter(Boolean);
          const seemsDelimited = nonEmptyLines[0]?.includes(",") || nonEmptyLines[0]?.includes("	") || nonEmptyLines[0]?.includes(";");
          if (seemsDelimited) {
            const delimiter = nonEmptyLines[0].includes("	") ? "	" : (nonEmptyLines[0].includes(";") ? ";" : ",");
            ({ headers, data } = parseDelimitedText(text, delimiter));
          } else {
            data = nonEmptyLines.map((line) => ({ rawPhone: line }));
            headers = ["rawPhone"];
          }
        }
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(firstSheet, { defval: "" }) as any[];
        if (data.length > 0) headers = Object.keys(data[0]);
      }

      if (data.length === 0) {
        toast({ title: "Empty file", description: "No data found.", variant: "destructive" });
        return;
      }

      setAnalyzing(true);
      const mapping = await discoverMappings(headers, data.slice(0, 3));
      const safeMapping = mapping || {
        phoneColumn: headers.find((h) => /phone|mobile|tel|number|contact|no/i.test(h)) || headers[0] || "rawPhone",
        rewardTypeColumn: headers.find((h) => /gift|reward|type/i.test(h)),
        suggestedRewardType: "1 Free Coffee",
        confidence: 0.5,
        reasoning: "Fallback mapping used.",
      };
      setAnalysis(safeMapping as any);

      const rowsToProcess = data.map((row) => ({
        rawPhone: row[safeMapping.phoneColumn] ?? row.rawPhone ?? Object.values(row)[0],
        gift_type: safeMapping.rewardTypeColumn
          ? row[safeMapping.rewardTypeColumn]
          : safeMapping.suggestedRewardType || "1 Free Coffee",
      }));
      await processRows(rowsToProcess);
    } catch (error) {
      console.error("File error:", error);
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  const handleImport = async () => {
    if (!processedData) return;
    const validRows = processedData.rows.filter(r => r.status === 'valid' || r.status === 'suspicious');
    if (validRows.length === 0) return;

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
            giftType: r.rewardType,
            status: r.status,
            reason: r.reason,
            aiNote: r.aiNote,
          })),
        }
      });

      if (error) throw error;
      toast({ title: "Import Successful", description: `Imported ${data.imported} recipients.` });
      setProcessedData(null);
      setIsReviewOpen(false);
    } catch (error) {
      toast({ title: "Import Failed", description: "Error saving data.", variant: "destructive" });
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
            Security Hardened: All AI processing is performed securely on our servers.
          </p>
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider ml-1">Active Campaign</label>
          <select 
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
            className="bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex bg-secondary/30 p-1 rounded-xl w-fit">
        <button 
          onClick={() => setImportMode("file")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-body transition-all ${importMode === "file" ? "bg-background shadow-sm text-primary font-bold" : "text-muted-foreground hover:text-foreground"}`}
        >
          <FileText className="w-4 h-4" />
          File Upload
        </button>
        <button 
          onClick={() => setImportMode("text")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-body transition-all ${importMode === "text" ? "bg-background shadow-sm text-primary font-bold" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Type className="w-4 h-4" />
          Paste Text
        </button>
        <button 
          onClick={() => setImportMode("image")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-body transition-all ${importMode === "image" ? "bg-background shadow-sm text-primary font-bold" : "text-muted-foreground hover:text-foreground"}`}
        >
          <ImageIcon className="w-4 h-4" />
          Scan Image
        </button>
      </div>

      {!processedData ? (
        <div className="space-y-4">
          {importMode === "text" ? (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <textarea 
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste names, phone numbers, and gift types here... (e.g. Abebe 0911223344 Coffee)"
                className="w-full h-48 bg-secondary/20 border border-border rounded-xl p-4 font-body text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              />
              <button 
                onClick={handleTextImport}
                disabled={loading || !pasteText.trim()}
                className="w-full py-4 bg-gradient-brass text-primary-foreground rounded-xl font-body font-bold flex items-center justify-center gap-3 shadow-lg shadow-primary/10 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {loading ? "Gemini is Extracting..." : "Smart Extract with Gemini AI"}
              </button>
            </div>
          ) : (
            <div 
              className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all cursor-pointer ${
                dragActive ? "border-primary bg-primary/5 scale-[1.02]" : "border-border hover:border-primary/50 hover:bg-secondary/20"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => { 
                e.preventDefault(); 
                setDragActive(false); 
                if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} 
                className="hidden" 
                accept={importMode === "file" ? ".csv,.tsv,.txt,.json,.xlsx,.xls,.xlsm,.xlsb,.ods,*/*" : "image/*"}
              />
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  <p className="text-foreground font-body font-medium">{analyzing ? "Gemini AI is analyzing..." : "Processing..."}</p>
                </div>
              ) : (
                <>
                  {importMode === "image" ? <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" /> : <UploadCloud className="w-12 h-12 text-muted-foreground mb-4" />}
                  <p className="text-foreground font-body font-medium mb-1">
                    {importMode === "image" ? "Upload image of your list" : "Drag and drop your file here"}
                  </p>
                  <p className="text-muted-foreground text-sm font-body mb-4">
                    {importMode === "image" ? "We'll use Gemini to scan the text from your photo" : "or click to browse CSV, Excel, TSV, TXT, JSON, or any tabular file"}
                  </p>
                  <button className="px-6 py-2 bg-gradient-brass text-primary-foreground rounded-lg font-body text-sm font-semibold transition-transform active:scale-95">
                    {importMode === "image" ? "Select Image" : "Select File"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
           {analysis && !isReviewOpen && (
             <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
               <div className="flex items-center gap-2 mb-2">
                 <Sparkles className="w-4 h-4 text-primary" />
                 <span className="font-bold text-primary font-body text-xs uppercase tracking-tighter">AI Mapping Report</span>
               </div>
               <p className="text-sm text-foreground font-body italic mb-1">"{analysis.reasoning}"</p>
               <div className="flex gap-4 mt-3">
                 <div className="text-[11px] font-body bg-background/50 px-2 py-1 rounded border border-border">
                   <b className="text-muted-foreground">Phone:</b> {analysis.phoneColumn}
                 </div>
                 {analysis.rewardTypeColumn && (
                   <div className="text-[11px] font-body bg-background/50 px-2 py-1 rounded border border-border">
                     <b className="text-muted-foreground">Reward:</b> {analysis.rewardTypeColumn}
                   </div>
                 )}
               </div>
             </div>
           )}

           {!isReviewOpen ? (
             <>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-success/10 border border-success/20 rounded-lg p-4">
                     <div className="flex items-center gap-2 mb-2">
                       <CheckCircle className="w-4 h-4 text-success" />
                       <span className="font-semibold text-success font-body text-sm">Valid</span>
                     </div>
                     <p className="text-2xl font-bold text-foreground">{processedData.counts.valid}</p>
                  </div>
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                     <div className="flex items-center gap-2 mb-2">
                       <AlertCircle className="w-4 h-4 text-primary" />
                       <span className="font-semibold text-primary font-body text-sm">Suspicious</span>
                     </div>
                     <p className="text-2xl font-bold text-foreground">{processedData.counts.suspicious}</p>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                     <div className="flex items-center gap-2 mb-2">
                       <RefreshCw className="w-4 h-4 text-amber-500" />
                       <span className="font-semibold text-amber-500 font-body text-sm">Duplicates</span>
                     </div>
                     <p className="text-2xl font-bold text-foreground">{processedData.counts.duplicate}</p>
                  </div>
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                     <div className="flex items-center gap-2 mb-2">
                       <AlertCircle className="w-4 h-4 text-destructive" />
                       <span className="font-semibold text-destructive font-body text-sm">Invalid</span>
                     </div>
                     <p className="text-2xl font-bold text-foreground">{processedData.counts.invalid}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4">
                  <button 
                    onClick={downloadErrorFile}
                    disabled={processedData.counts.invalid === 0}
                    className="px-4 py-2 border border-border text-foreground hover:bg-secondary rounded-lg font-body text-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    <FileDown className="w-4 h-4" />
                    Download Errors
                  </button>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setProcessedData(null)}
                      className="px-4 py-2 border border-border text-foreground hover:bg-secondary rounded-lg font-body text-sm"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => setIsReviewOpen(true)}
                      className="px-6 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg font-body text-sm font-semibold flex items-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95"
                    >
                      Review & Import
                    </button>
                  </div>
                </div>
             </>
           ) : (
             <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <h3 className="font-display font-semibold text-lg text-foreground">Review & Clean Data</h3>
                    <p className="text-xs text-muted-foreground font-body">Double click any cell to edit. Suspicious rows are flagged by Gemini AI.</p>
                  </div>
                </div>
                
                <div className="border border-border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                  <table className="w-full text-left font-body text-sm">
                    <thead className="bg-secondary/50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 border-b border-border text-muted-foreground font-medium">Status</th>
                        <th className="px-4 py-2 border-b border-border text-muted-foreground font-medium">Phone (Target)</th>
                        <th className="px-4 py-2 border-b border-border text-muted-foreground font-medium">Reward</th>
                        <th className="px-4 py-2 border-b border-border text-muted-foreground font-medium">AI Reason/Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedData.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-2 border-b border-border">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              row.status === "valid" ? "bg-success/10 text-success" :
                              row.status === "suspicious" ? "bg-primary/10 text-primary" :
                              row.status === "duplicate" ? "bg-amber-500/10 text-amber-500" :
                              "bg-destructive/10 text-destructive"
                            }`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 border-b border-border">
                            <input 
                              type="text" 
                              value={row.normalizedPhone}
                              onChange={(e) => handleEditRow(idx, 'normalizedPhone', e.target.value)}
                              className="bg-transparent border-none focus:ring-1 focus:ring-primary rounded px-1 w-full"
                            />
                          </td>
                          <td className="px-4 py-2 border-b border-border">
                            <input 
                              type="text" 
                              value={row.rewardType}
                              onChange={(e) => handleEditRow(idx, 'rewardType', e.target.value)}
                              className="bg-transparent border-none focus:ring-1 focus:ring-primary rounded px-1 w-full"
                            />
                          </td>
                          <td className="px-4 py-2 border-b border-border text-[11px] leading-tight">
                            <span className="text-foreground font-semibold">{row.reason}</span>
                            {row.aiNote && <p className="text-primary mt-0.5">{row.aiNote}</p>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button 
                    onClick={() => setIsReviewOpen(false)}
                    className="px-4 py-2 border border-border text-foreground hover:bg-secondary rounded-lg font-body text-sm"
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleImport}
                    disabled={importing || (processedData.counts.valid + processedData.counts.suspicious) === 0}
                    className="px-8 py-2 bg-gradient-brass text-primary-foreground rounded-lg font-body text-sm font-bold flex items-center gap-2 shadow-xl shadow-primary/20 transition-all active:scale-95"
                  >
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {importing ? "Importing..." : `Finalize & Import ${processedData.counts.valid + processedData.counts.suspicious} Rows`}
                  </button>
                </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
}

