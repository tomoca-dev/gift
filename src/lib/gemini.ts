import { supabase } from "@/integrations/supabase/client";

export interface ImportAnalysisSelection {
  phoneColumn: string;
  rewardTypeColumn?: string;
  suggestedRewardType?: string;
  confidence: number;
  reasoning: string;
  extractedRows?: { phone: string; gift_type: string; name?: string }[];
}

export interface AIAnalyzedRow {
  index: number;
  rawPhone: string;
  normalizedPhone: string;
  rewardType: string;
  status: "valid" | "invalid" | "duplicate" | "suspicious";
  reason: string;
  aiNote?: string;
}

export interface AIAnalysisResult {
  rows: AIAnalyzedRow[];
  summary: string;
  geminiUsed: boolean;
}

const normalizePhone = (input: string | null | undefined): string => {
  if (!input) return "";
  const cleaned = String(input).trim().replace(/[^0-9+]/g, "");
  if (/^09\d{8}$/.test(cleaned)) return `+251${cleaned.slice(1)}`;
  if (/^9\d{8}$/.test(cleaned)) return `+251${cleaned}`;
  if (/^2519\d{8}$/.test(cleaned)) return `+${cleaned}`;
  if (/^\+2519\d{8}$/.test(cleaned)) return cleaned;
  return cleaned;
};

const extractPhone = (input: string | null | undefined): string => {
  if (!input) return "";
  const match = String(input).match(/(\+2519\d{8}|2519\d{8}|09\d{8}|9\d{8})/);
  return match ? match[1] : "";
};

const extractName = (input: string | null | undefined): string => {
  if (!input) return "";
  const text = String(input).trim();
  if (text.includes(" - ")) {
    const parts = text.split(" - ");
    if (parts.length >= 2) return parts.slice(1).join(" - ").trim();
  }
  return text
    .replace(/(\+2519\d{8}|2519\d{8}|09\d{8}|9\d{8})/g, "")
    .replace(/^[-–—:\s]+|[-–—:\s]+$/g, "")
    .trim();
};

const getRawPhoneValue = (row: any): string => {
  const candidates = [
    row?.phone,
    row?.rawPhone,
    row?.phone_raw,
    row?.["phone no"],
    row?.phone_no,
    row?.mobile,
    row?.number,
    row?.tel,
    row?.contact,
    row?.value,
    row?.text,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  for (const value of Object.values(row || {})) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const getGiftTypeValue = (row: any): string => {
  const candidates = [row?.gift_type, row?.giftType, row?.reward_type, row?.rewardType, row?.gift, row?.reward, row?.type];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "1 Free Coffee";
};

const fallbackDiscoverMappings = (headers: string[], sampleRows: any[]): ImportAnalysisSelection => {
  const lowered = headers.map((h) => ({ original: h, lower: String(h).toLowerCase() }));
  const phoneColumn = lowered.find((h) => /phone|mobile|tel|number|contact/.test(h.lower))?.original || headers[0] || "phone";
  const rewardTypeColumn = lowered.find((h) => /gift|reward|type/.test(h.lower))?.original;
  const firstValue = sampleRows?.[0]?.[phoneColumn];
  const reasoning = firstValue && String(firstValue).includes(" - ")
    ? "Fallback mapping detected a single mixed column containing phone and name."
    : "Fallback mapping matched a likely phone column locally.";
  return {
    phoneColumn,
    rewardTypeColumn,
    suggestedRewardType: rewardTypeColumn ? undefined : "1 Free Coffee",
    confidence: 0.72,
    reasoning,
  };
};

const fallbackExtractData = (mode: "text" | "image", content: string): ImportAnalysisSelection => {
  const lines = String(content || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const extractedRows = lines
    .map((line) => ({
      phone: extractPhone(line),
      gift_type: "1 Free Coffee",
      name: extractName(line),
    }))
    .filter((row) => row.phone || row.name);
  return {
    phoneColumn: "phone",
    rewardTypeColumn: "gift_type",
    suggestedRewardType: "1 Free Coffee",
    confidence: mode === "text" ? 0.7 : 0.5,
    reasoning: "Fallback extraction was used locally.",
    extractedRows,
  };
};

const fallbackAnalyzeRows = (rows: any[]): AIAnalysisResult => {
  const seen = new Set<string>();
  const analyzed: AIAnalyzedRow[] = rows.map((row, index) => {
    const rawPhone = getRawPhoneValue(row);
    const normalizedPhone = normalizePhone(extractPhone(rawPhone) || rawPhone);
    const rewardType = getGiftTypeValue(row);
    let status: AIAnalyzedRow["status"] = "valid";
    let reason = "Valid row";
    let aiNote = "";

    if (!/^\+2519\d{8}$/.test(normalizedPhone)) {
      status = "invalid";
      reason = "Invalid Ethiopian mobile number format";
      aiNote = rawPhone ? `Could not safely extract a valid phone from: ${rawPhone}` : "Missing phone value";
    } else if (seen.has(normalizedPhone)) {
      status = "duplicate";
      reason = "Duplicate inside uploaded batch";
      aiNote = "This phone appears more than once in the uploaded file";
    } else if (rawPhone && rawPhone !== normalizedPhone) {
      reason = "Phone extracted from mixed cell text";
      const name = extractName(rawPhone);
      aiNote = name ? `Extracted phone from mixed cell text. Detected name: ${name}` : "Extracted phone from mixed cell text";
    }

    if (status !== "invalid") seen.add(normalizedPhone);

    return { index, rawPhone, normalizedPhone, rewardType, status, reason, aiNote };
  });

  const counts = analyzed.reduce((acc: Record<string, number>, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, { valid: 0, invalid: 0, duplicate: 0, suspicious: 0 });

  return {
    rows: analyzed,
    summary: `Processed ${rows.length} rows locally. Valid: ${counts.valid}, Invalid: ${counts.invalid}, Duplicate: ${counts.duplicate}, Suspicious: ${counts.suspicious}.`,
    geminiUsed: false,
  };
};

export const discoverMappings = async (headers: string[], sampleRows: any[]): Promise<ImportAnalysisSelection | null> => {
  try {
    const { data, error } = await supabase.functions.invoke("analyze-import", {
      body: { action: "DISCOVER", headers, sampleRows },
    });
    if (error) throw error;
    return data as ImportAnalysisSelection;
  } catch (error) {
    console.error("Discovery error:", error);
    return fallbackDiscoverMappings(headers, sampleRows);
  }
};

export const extractData = async (mode: "text" | "image", content: string): Promise<ImportAnalysisSelection | null> => {
  try {
    const { data, error } = await supabase.functions.invoke("analyze-import", {
      body: { action: "EXTRACT", [mode === "text" ? "text" : "image"]: content, mode },
    });
    if (error) throw error;
    return data as ImportAnalysisSelection;
  } catch (error) {
    console.error("Extraction error:", error);
    return fallbackExtractData(mode, content);
  }
};

export const analyzeBulkRows = async (rows: any[]): Promise<AIAnalysisResult | null> => {
  try {
    const { data, error } = await supabase.functions.invoke("analyze-import", {
      body: { action: "ANALYZE", rows },
    });
    if (error) throw error;
    return data as AIAnalysisResult;
  } catch (error) {
    console.error("Bulk analysis error:", error);
    return fallbackAnalyzeRows(rows);
  }
};
