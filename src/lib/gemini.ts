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
    return null;
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
