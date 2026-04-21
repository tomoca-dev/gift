import { supabase } from "@/integrations/supabase/client";

export interface ImportAnalysisSelection {
  phoneColumn: string;
  rewardTypeColumn?: string;
  suggestedRewardType?: string;
  confidence: number;
  reasoning: string;
}

export const analyzeImportFileData = async (headers: string[], sampleRows: any[]): Promise<ImportAnalysisSelection | null> => {
  try {
    const { data, error } = await supabase.functions.invoke("analyze-import", {
      body: { headers, sampleRows }
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
