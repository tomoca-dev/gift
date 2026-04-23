// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(input: string | null | undefined): string {
  if (!input) return "";
  const cleaned = input.trim().replace(/[^0-9+]/g, "");
  if (/^09\d{8}$/.test(cleaned)) return `+251${cleaned.slice(1)}`;
  if (/^9\d{8}$/.test(cleaned)) return `+251${cleaned}`;
  if (/^2519\d{8}$/.test(cleaned)) return `+${cleaned}`;
  if (/^\+2519\d{8}$/.test(cleaned)) return cleaned;
  return cleaned;
}

function extractPhoneFromText(input: string | null | undefined): string {
  if (!input) return "";
  const match = String(input).match(/(\+2519\d{8}|2519\d{8}|09\d{8}|9\d{8})/);
  return match ? match[1] : "";
}

function extractNameFromCombinedCell(input: string | null | undefined): string {
  if (!input) return "";
  const text = String(input).trim();
  if (text.includes(" - ")) {
    const parts = text.split(" - ");
    if (parts.length >= 2) return parts.slice(1).join(" - ").trim();
  }
  return text.replace(/(\+2519\d{8}|2519\d{8}|09\d{8}|9\d{8})/g, "").replace(/^[-–—:\s]+|[-–—:\s]+$/g, "").trim();
}

function getRawPhoneValue(row: Record<string, unknown>): string {
  const candidates = [row.phone, row.rawPhone, row.phone_raw, row["phone no"], row.phone_no, row.mobile, row.number, row.tel, row.contact, row.value, row.text];
  for (const c of candidates) if (typeof c === "string" && c.trim()) return c.trim();
  for (const value of Object.values(row)) if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}

function getGiftTypeValue(row: Record<string, unknown>): string {
  const candidates = [row.gift_type, row.giftType, row.reward_type, row.rewardType, row.gift, row.reward, row.type];
  for (const c of candidates) if (typeof c === "string" && c.trim()) return c.trim();
  return "1 Free Coffee";
}

function basicAnalyzeRows(rows: Record<string, unknown>[]) {
  const seen = new Set<string>();
  const analyzed = rows.map((row, index) => {
    const rawCell = getRawPhoneValue(row);
    const extractedPhone = extractPhoneFromText(rawCell);
    const normalizedPhone = normalizePhone(extractedPhone || rawCell);
    const name = extractNameFromCombinedCell(rawCell);
    const giftType = getGiftTypeValue(row);
    let status: "valid" | "invalid" | "duplicate" | "suspicious" = "valid";
    let reason = "Valid row";
    let aiNote = name ? `Detected name: ${name}` : "";
    if (!normalizedPhone || !/^\+2519\d{8}$/.test(normalizedPhone)) {
      status = "invalid";
      reason = "Invalid Ethiopian mobile number format";
      aiNote = rawCell ? `Could not safely extract a valid phone from: ${rawCell}` : "Missing phone value";
    } else if (seen.has(normalizedPhone)) {
      status = "duplicate";
      reason = "Duplicate inside uploaded batch";
      aiNote = "This phone appears more than once in the uploaded file";
    } else if (rawCell && rawCell !== extractedPhone && rawCell !== normalizedPhone) {
      reason = "Phone extracted from mixed cell text";
      aiNote = name ? `Extracted phone from mixed cell text. Detected name: ${name}` : "Extracted phone from mixed cell text";
    }
    if (status !== "invalid") seen.add(normalizedPhone);
    return { index, rawPhone: rawCell, normalizedPhone, rewardType: giftType, giftType, status, reason, aiNote, name };
  });
  const counts = analyzed.reduce((acc, row) => { acc[row.status] = (acc[row.status] || 0) + 1; return acc; }, { valid: 0, invalid: 0, duplicate: 0, suspicious: 0 } as Record<string, number>);
  return { rows: analyzed, summary: `Processed ${rows.length} rows. Valid: ${counts.valid}, Invalid: ${counts.invalid}, Duplicate: ${counts.duplicate}, Suspicious: ${counts.suspicious}.`, geminiUsed: false };
}

async function callGemini(prompt: string) {
  const apiKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") || Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("Missing Gemini API key");
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Gemini did not return valid JSON");
  return JSON.parse(match[0]);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders, status: 200 });

  try {
    const body = await req.json();
    const action = body?.action;
    const readOnlyAction = action === "DISCOVER" || action === "EXTRACT" || action === "ANALYZE" || action === "analyze";

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return json({ error: "Missing Supabase environment variables" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    let user = null;
    let staffRow = null;

    if (authHeader) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
      const userResp = await supabase.auth.getUser();
      user = userResp.data.user;
      if (user) {
        const staffResp = await supabase.from("staff_profiles").select("role, active").eq("user_id", user.id).maybeSingle();
        staffRow = staffResp.data;
      }
    }

    if (!readOnlyAction) {
      if (!user) return json({ error: "Unauthorized" }, 401);
      if (!staffRow || staffRow.role !== "admin" || !staffRow.active) return json({ error: "Admin access required" }, 403);
    }

    const { headers = [], sampleRows = [], text, image, rows = [], mode, campaignId = null, fileName = "smart-import", sourceType = "file", summary = "Gemini-assisted import" } = body;

    if (action === "DISCOVER" || (mode === "file" && headers?.length)) {
      const fallbackPhoneColumn = headers.find((h: string) => /phone|mobile|tel|number|contact/i.test(h)) || headers[0] || "phone";
      const fallbackGiftColumn = headers.find((h: string) => /gift|reward|type/i.test(h)) || null;
      try {
        const aiResult = await callGemini(`You are analyzing spreadsheet headers for a one-time gift campaign in Ethiopia. Return strict JSON: {"phoneColumn": string, "rewardTypeColumn": string | null, "suggestedRewardType": string | null, "confidence": number, "reasoning": string}. Important: some files may have a single column like "phone no" and cells like "251911510367 - Misbah Ali Mohammed". Headers: ${JSON.stringify(headers)} Sample rows: ${JSON.stringify(sampleRows)}`);
        return json({ phoneColumn: aiResult.phoneColumn || fallbackPhoneColumn, rewardTypeColumn: aiResult.rewardTypeColumn ?? fallbackGiftColumn, suggestedRewardType: aiResult.suggestedRewardType || "1 Free Coffee", confidence: aiResult.confidence ?? 0.8, reasoning: aiResult.reasoning || "Gemini mapping completed." });
      } catch {
        return json({ phoneColumn: fallbackPhoneColumn, rewardTypeColumn: fallbackGiftColumn, suggestedRewardType: "1 Free Coffee", confidence: 0.72, reasoning: "Fallback header detection used." });
      }
    }

    if (action === "EXTRACT" || mode === "text" || mode === "image") {
      if (mode === "text" || text) {
        try {
          const aiResult = await callGemini(`Extract recipient rows from this text. Return strict JSON: {"phoneColumn":"phone","rewardTypeColumn":"gift_type","suggestedRewardType":"1 Free Coffee","confidence":0.95,"reasoning":"short explanation","extractedRows":[{"phone":"0911223344","gift_type":"1 Free Coffee","name":"Abebe"}]}. Rules: Ethiopian mobile numbers only. Text may contain lines like "251911510367 - Misbah Ali Mohammed". Text: ${String(text || "").slice(0, 50000)}`);
          return json(aiResult);
        } catch {
          const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          return json({ phoneColumn: "phone", rewardTypeColumn: "gift_type", suggestedRewardType: "1 Free Coffee", confidence: 0.7, reasoning: "Fallback text extraction used.", extractedRows: lines.map((line) => ({ phone: extractPhoneFromText(line), gift_type: "1 Free Coffee", name: extractNameFromCombinedCell(line) })) });
        }
      }
      return json({ error: "Image extraction is not configured for this request." }, 400);
    }

    if (action === "ANALYZE" || action === "analyze") {
      const fallback = basicAnalyzeRows(Array.isArray(rows) ? rows : []);
      try {
        const aiResult = await callGemini(`You are reviewing import rows for a one-time gift campaign. Return strict JSON: {"summary": string, "rows": [{"index": number, "status": "valid" | "invalid" | "duplicate" | "suspicious", "reason": string, "aiNote": string}]}. Do not invent phone numbers. Input rows: ${JSON.stringify(fallback.rows.slice(0, 500))}`);
        const map = new Map<number, any>();
        for (const row of aiResult.rows || []) map.set(row.index, row);
        const mergedRows = fallback.rows.map((row) => {
          const ai = map.get(row.index);
          if (!ai) return row;
          return { ...row, status: ["valid", "invalid", "duplicate", "suspicious"].includes(ai.status) ? ai.status : row.status, reason: ai.reason || row.reason, aiNote: ai.aiNote || row.aiNote };
        });
        return json({ rows: mergedRows, summary: aiResult.summary || fallback.summary, geminiUsed: true });
      } catch {
        return json(fallback);
      }
    }

    if (action === "IMPORT" || action === "import") {
      const importRows = Array.isArray(rows) ? rows : [];
      if (!importRows.length) return json({ error: "No rows provided for import" }, 400);
      const batchResp = await supabaseAdmin.rpc("create_import_batch", { p_original_filename: fileName, p_source_type: sourceType, p_gemini_used: true, p_gemini_summary: summary });
      if (batchResp.error) return json({ error: batchResp.error.message }, 400);
      const batchId = batchResp.data;
      const chunkSize = 500;
      for (let start = 0; start < importRows.length; start += chunkSize) {
        const chunk = importRows.slice(start, start + chunkSize).map((row: any, offset: number) => ({
          batch_id: batchId,
          row_index: start + offset,
          raw_phone: String(row.rawPhone ?? row.phone_raw ?? row.phone ?? ""),
          normalized_phone: row.normalizedPhone || normalizePhone(extractPhoneFromText(String(row.rawPhone ?? row.phone_raw ?? row.phone ?? ""))),
          gift_type: row.giftType ?? row.gift_type ?? row.rewardType ?? row.reward_type ?? "1 Free Coffee",
          status: row.status ?? "valid",
          reason: row.reason ?? null,
          ai_note: row.aiNote ?? null,
        }));
        const insertResp = await supabaseAdmin.from("import_batch_rows").insert(chunk);
        if (insertResp.error) return json({ error: `Failed adding batch rows: ${insertResp.error.message}` }, 400);
      }
      const finalizeResp = await supabaseAdmin.rpc("finalize_import_batch", { p_batch_id: batchId, p_campaign_id: campaignId || null });
      if (finalizeResp.error) return json({ error: finalizeResp.error.message }, 400);
      return json(finalizeResp.data);
    }

    return json({ error: `Unsupported action or mode: ${action || mode}` }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
