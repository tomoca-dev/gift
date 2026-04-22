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

/**
 * DISCOVER: Identifies column mappings from file headers and samples
 */
export const discoverMappings = async (headers: string[], sampleRows: any[]): Promise<ImportAnalysisSelection | null> => {
  try {
    const { data, error } = await supabase.functions.invoke("analyze-import", {
      body: { action: "DISCOVER", headers, sampleRows }
    });
    if (error) throw error;
    return data as ImportAnalysisSelection;
  } catch (error) {
    console.error("Discovery error:", error);
    if (headers.length === 0) return null;
    const phoneColumn = headers.find((h) => /phone|mobile|tel|number|contact|no/i.test(h)) || headers[0];
    const rewardTypeColumn = headers.find((h) => /gift|reward|type/i.test(h));
    return {
      phoneColumn,
      rewardTypeColumn,
      suggestedRewardType: "1 Free Coffee",
      confidence: 0.5,
      reasoning: "Fallback mapping used because server discovery was unavailable.",
    };
  }
};

/**
 * EXTRACT: Pulls structured data from raw text or image base64
 */
export const extractData = async (
  mode: "text" | "image", 
  content: string 
): Promise<ImportAnalysisSelection | null> => {
  try {
    const { data, error } = await supabase.functions.invoke("analyze-import", {
      body: { action: "EXTRACT", [mode === "text" ? "text" : "image"]: content, mode }
    });
    if (error) throw error;
    return data as ImportAnalysisSelection;
  } catch (error) {
    console.error("Extraction error:", error);
    if (mode === "text") {
      const extractedRows = content
        .split(/?
/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => ({ phone: line, gift_type: "1 Free Coffee" }));
      return {
        phoneColumn: "phone",
        rewardTypeColumn: "gift_type",
        suggestedRewardType: "1 Free Coffee",
        confidence: 0.5,
        reasoning: "Fallback text extraction used because server extraction was unavailable.",
        extractedRows,
      };
    }
    return null;
  }
};

/**
 * ANALYZE: Performs deep validation and normalization on a list of rows
 */
export const analyzeBulkRows = async (rows: any[]): Promise<AIAnalysisResult | null> => {
  try {
    const { data, error } = await supabase.functions.invoke("analyze-import", {
      body: { action: "ANALYZE", rows }
    });
    if (error) throw error;
    return data as AIAnalysisResult;
  } catch (error) {
    console.error("Bulk analysis error:", error);
    return null;
  }
};
