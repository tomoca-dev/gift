import { UploadCloud, CheckCircle, AlertCircle, RefreshCw, FileDown, Loader2, Sparkles, FileText, Type, Image as ImageIcon, Send } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { analyzeImportFileData, extractUnstructuredData, type ImportAnalysisSelection } from "@/lib/gemini";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type RecipientInsert = Database["public"]["Tables"]["gift_recipients"]["Insert"];

interface ImportRow {
  [key: string]: any;
}

interface ProcessedData {
  valid: RecipientInsert[];
  invalid: ImportRow[];
  duplicates: ImportRow[];
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
    if (!processedData || processedData.invalid.length === 0) return;
    
    const csv = Papa.unparse(processedData.invalid);
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

  const handleEditRow = (index: number, field: keyof RecipientInsert, value: string) => {
    if (!processedData) return;
    const newValid = [...processedData.valid];
    newValid[index] = { ...newValid[index], [field]: value };
    setProcessedData({ ...processedData, valid: newValid });
  };

  const handleTextImport = async () => {
    if (!pasteText.trim()) return;
    setLoading(true);
    setAnalyzing(true);
    setAnalysis(null);
    setProcessedData(null);

    try {
      const result = await extractUnstructuredData("text", pasteText);
      if (result?.extractedRows) {
        processExtractedRows(result.extractedRows);
        setAnalysis(result);
      } else {
        toast({ title: "Analysis Failed", description: "Gemini couldn't extract data from that text.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Text extraction error:", error);
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  const processExtractedRows = (rows: any[]) => {
    const valid: RecipientInsert[] = [];
    const invalid: any[] = [];
    const duplicates: any[] = [];
    const seenPhones = new Set<string>();

    rows.forEach(row => {
      const rawPhone = String(row.phone || "");
      const cleanedPhone = rawPhone.replace(/[^0-9+]/g, "");
      
      let normalized = cleanedPhone;
      if (cleanedPhone.startsWith("09")) normalized = "+2519" + cleanedPhone.substring(2);
      else if (cleanedPhone.startsWith("9")) normalized = "+2519" + cleanedPhone.substring(1);
      else if (cleanedPhone.startsWith("2519")) normalized = "+" + cleanedPhone;

      const isValidReg = normalized.match(/^\+2519[0-9]{8}$/);
      const giftType = row.gift_type || "Standard Gift";

      if (!isValidReg) {
        invalid.push(row);
      } else if (seenPhones.has(normalized)) {
        duplicates.push(row);
      } else {
        seenPhones.add(normalized);
        valid.push({ 
          phone_raw: rawPhone, 
          phone_normalized: normalized, 
          gift_type: String(giftType),
          campaign_id: selectedCampaignId,
          status: "eligible"
        });
      }
    });

    setProcessedData({ valid, invalid, duplicates });
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setLoading(true);
    setAnalysis(null);
    setProcessedData(null);
    setIsReviewOpen(false);

    try {
      // Check for Image Import (OCR)
      if (file.type.startsWith('image/')) {
          setImportMode("image");
          setAnalyzing(true);
          const reader = new FileReader();
          reader.onloadend = async () => {
              const base64String = (reader.result as string).split(',')[1];
              const result = await extractUnstructuredData("image", base64String);
              if (result?.extractedRows) {
                  processExtractedRows(result.extractedRows);
                  setAnalysis(result);
              }
              setLoading(false);
              setAnalyzing(false);
          };
          reader.readAsDataURL(file);
          return;
      }

      let headers: string[] = [];
      let data: any[] = [];

      if (file.name.endsWith(".csv")) {
        const text = await file.text();
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        data = result.data;
        headers = result.meta.fields || [];
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(sheet);
        if (data.length > 0) {
          headers = Object.keys(data[0]);
        }
      }

      if (data.length === 0) {
        toast({ title: "Empty file", description: "The uploaded file contains no data.", variant: "destructive" });
        setLoading(false);
        return;
      }

      setAnalyzing(true);
      const aiAnalysis = await analyzeImportFileData(headers, data.slice(0, 3));
      setAnalysis(aiAnalysis);
      setAnalyzing(false);

      if (aiAnalysis) {
        const rowsToProcess = data.map(row => ({
            phone: row[aiAnalysis.phoneColumn],
            gift_type: aiAnalysis.rewardTypeColumn ? row[aiAnalysis.rewardTypeColumn] : aiAnalysis.suggestedRewardType
        }));
        processExtractedRows(rowsToProcess);
      }

    } catch (error) {
      console.error("Error processing file:", error);
      toast({ title: "Processing Error", description: "Failed to read the file.", variant: "destructive" });
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  const handleImport = async () => {
    if (!processedData || processedData.valid.length === 0) return;
    setImporting(true);

    try {
      // 1. Create a batch record
      const { data: batch, error: batchErr } = await supabase
        .from("import_batches")
        .insert({
          total_rows: processedData.valid.length + processedData.invalid.length + processedData.duplicates.length,
          valid_rows: processedData.valid.length,
          invalid_rows: processedData.invalid.length,
          duplicate_rows: processedData.duplicates.length,
          original_filename: fileName || "Manual Import"
        })
        .select()
        .single();

      if (batchErr) throw batchErr;

      // 2. Prepare data with batch ID
      const rowsToInsert: RecipientInsert[] = processedData.valid.map(r => ({ 
        ...r, 
        import_batch_id: batch.id 
      }));
      
      // 3. Process in chunks (100 rows each)
      const chunkSize = 100;
      let successCount = 0;

      for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
          const chunk = rowsToInsert.slice(i, i + chunkSize);
          
          // Use upsert with ignoreDuplicates to skip existing phone numbers in DB
          const { error: insertErr } = await supabase
            .from("gift_recipients")
            .upsert(chunk, { 
                onConflict: 'phone_normalized',
                ignoreDuplicates: true 
            });

          if (insertErr) {
              console.error(`Error inserting chunk ${i / chunkSize}:`, insertErr);
              // We continue with other chunks even if one fails, but track error
          } else {
              successCount += chunk.length;
          }
      }

      toast({ 
          title: "Import Complete", 
          description: `Processed ${rowsToInsert.length} rows. New recipients added (skipped existing).` 
      });
      
      setProcessedData(null);
      setAnalysis(null);
      setIsReviewOpen(false);
    } catch (error) {
      console.error("Import error:", error);
      toast({ title: "Import Failed", description: "An error occurred while saving the data.", variant: "destructive" });
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
                accept={importMode === "file" ? ".csv,.xlsx,.xls" : "image/*"}
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
                    {importMode === "image" ? "We'll use Gemini to scan the text from your photo" : "or click to browse CSV or Excel"}
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
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-success/10 border border-success/20 rounded-lg p-4">
                     <div className="flex items-center gap-2 mb-2">
                       <CheckCircle className="w-4 h-4 text-success" />
                       <span className="font-semibold text-success font-body text-sm">Valid Rows</span>
                     </div>
                     <p className="text-2xl font-bold text-foreground">{processedData.valid.length}</p>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                     <div className="flex items-center gap-2 mb-2">
                       <RefreshCw className="w-4 h-4 text-amber-500" />
                       <span className="font-semibold text-amber-500 font-body text-sm">Duplicates</span>
                     </div>
                     <p className="text-2xl font-bold text-foreground">{processedData.duplicates.length}</p>
                  </div>
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                     <div className="flex items-center gap-2 mb-2">
                       <AlertCircle className="w-4 h-4 text-destructive" />
                       <span className="font-semibold text-destructive font-body text-sm">Invalid</span>
                     </div>
                     <p className="text-2xl font-bold text-foreground">{processedData.invalid.length}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4">
                  <button 
                    onClick={downloadErrorFile}
                    disabled={processedData.invalid.length === 0}
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
                  <h3 className="font-display font-semibold text-lg text-foreground">Review Cleaned Data</h3>
                  <p className="text-xs text-muted-foreground font-body">Double click any cell to edit</p>
                </div>
                
                <div className="border border-border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                  <table className="w-full text-left font-body text-sm">
                    <thead className="bg-secondary/50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 border-b border-border text-muted-foreground font-medium">#</th>
                        <th className="px-4 py-2 border-b border-border text-muted-foreground font-medium">Normalized Phone</th>
                        <th className="px-4 py-2 border-b border-border text-muted-foreground font-medium">Gift Type</th>
                        <th className="px-4 py-2 border-b border-border text-muted-foreground font-medium">Original Raw</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedData.valid.map((row, idx) => (
                        <tr key={idx} className="hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-2 border-b border-border text-muted-foreground">{idx + 1}</td>
                          <td className="px-4 py-2 border-b border-border">
                            <input 
                              type="text" 
                              value={row.phone_normalized}
                              onChange={(e) => handleEditRow(idx, 'phone_normalized', e.target.value)}
                              className="bg-transparent border-none focus:ring-1 focus:ring-primary rounded px-1 w-full"
                            />
                          </td>
                          <td className="px-4 py-2 border-b border-border">
                            <input 
                              type="text" 
                              value={row.gift_type}
                              onChange={(e) => handleEditRow(idx, 'gift_type', e.target.value)}
                              className="bg-transparent border-none focus:ring-1 focus:ring-primary rounded px-1 w-full"
                            />
                          </td>
                          <td className="px-4 py-2 border-b border-border text-muted-foreground truncate max-w-[150px]">{row.phone_raw}</td>
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
                    disabled={importing || processedData.valid.length === 0}
                    className="px-8 py-2 bg-gradient-brass text-primary-foreground rounded-lg font-body text-sm font-bold flex items-center gap-2 shadow-xl shadow-primary/20 transition-all active:scale-95"
                  >
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {importing ? "Importing..." : `Finalize & Import ${processedData.valid.length} Rows`}
                  </button>
                </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
}
