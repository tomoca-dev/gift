import { supabase } from "@/integrations/supabase/client";

export interface ImportAnalysisSelection {
  phoneColumn: string;
  rewardTypeColumn?: string;
  suggestedRewardType?: string;
  confidence: number;
  reasoning: string;
  extractedRows?: { phone: string; gift_type: string; name?: string }[];
}

export const analyzeImportFileData = async (headers: string[], sampleRows: any[]): Promise<ImportAnalysisSelection | null> => {
  try {
    const { data, error } = await supabase.functions.invoke("analyze-import", {
      body: { mode: "file", headers, sampleRows }
    });

    if (error) {
      console.error("Error calling analyze-import function:", error);
      return null;
    }

    return data as ImportAnalysisSelection;
  } catch (error) {
    console.error("Exception when calling analyze-import:", error);
    return null;
  }
};

export const extractUnstructuredData = async (
  mode: "text" | "image", 
  content: string // Raw text or Base64 image
): Promise<ImportAnalysisSelection | null> => {
  try {
    const payload = mode === "text" ? { mode, text: content } : { mode, image: content };
    
    const { data, error } = await supabase.functions.invoke("analyze-import", {
      body: payload
    });

    if (error) {
      console.error("Error calling extract-unstructured function:", error);
      return null;
    }

    return data as ImportAnalysisSelection;
  } catch (error) {
    console.error("Exception when calling extract-unstructured:", error);
    return null;
  }
};
