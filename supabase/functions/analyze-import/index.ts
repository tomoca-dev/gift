// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { action, headers, sampleRows, text, image, rows, mode } = await req.json();
    const apiKey = Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY');
    if (!apiKey) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // --- ACTION: DISCOVER (Header Mapping) ---
    if (action === 'DISCOVER' || (mode === 'file' && headers)) {
      const prompt = `
        You are an expert data analyst. I have a dataset from a CSV/Excel file.
        Analyze these headers and sample rows to identify the best column for phone numbers and reward types.

        Headers: ${JSON.stringify(headers)}
        Sample Data: ${JSON.stringify(sampleRows)}

        Return JSON ONLY:
        {
          "phoneColumn": "...", 
          "rewardTypeColumn": "...", 
          "suggestedRewardType": "...",
          "reasoning": "...",
          "confidence": 0.95
        }
      `;
      const result = await model.generateContent(prompt);
      const output = JSON.parse(result.response.text().match(/\{[\s\S]*\}/)?.[0] || '{}');
      return new Response(JSON.stringify(output), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- ACTION: EXTRACT (Unstructured Text/Image) ---
    if (action === 'EXTRACT' || mode === 'text' || mode === 'image') {
      let prompt = '';
      let parts = [];

      if (text || mode === 'text') {
        prompt = `
          Extract people and rewards from this unstructured text. 
          Identify phone numbers (Ethiopian format), names, and gift types.
          Rules: Normalize phone numbers to +251 format if possible.
          Text: """${text}"""
          Return JSON: { "extractedRows": [{ "phone": "...", "gift_type": "...", "name": "..." }] }
        `;
        parts.push(prompt);
      } else if (image || mode === 'image') {
        prompt = `
          You are an expert OCR analyst. This image contains a list of reward recipients.
          Extract every phone number (Ethiopian) and gift type.
          Return JSON: { "extractedRows": [{ "phone": "...", "gift_type": "...", "name": "..." }] }
        `;
        parts.push(prompt);
        parts.push({ inlineData: { data: image, mimeType: "image/jpeg" } });
      }

      const result = await model.generateContent(parts);
      const output = JSON.parse(result.response.text().match(/\{[\s\S]*\}/)?.[0] || '{}');
      return new Response(JSON.stringify(output), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- ACTION: ANALYZE (Bulk Row Review & Validation) ---
    if (action === 'ANALYZE' || action === 'analyze') {
      const prompt = `
        You are an expert data cleaner for Ethiopian mobile numbers and gift rewards.
        Analyze the following data list.
        Data: ${JSON.stringify(rows.slice(0, 50))} 

        Rules:
        1. Normalize phone to +251XXXXXXXXX format. 
        2. Flag "suspicious" if the number looks fake (999999999) or isn't Ethiopian.
        3. Flag "duplicate" if it appears twice in the set.
        4. "rewardType" should be a valid gift name.

        Return JSON:
        {
          "rows": [{ "index", "rawPhone", "normalizedPhone", "rewardType", "status", "reason", "aiNote" }],
          "summary": "...",
          "geminiUsed": true
        }
      `;
      const result = await model.generateContent(prompt);
      const output = JSON.parse(result.response.text().match(/\{[\s\S]*\}/)?.[0] || '{}');
      return new Response(JSON.stringify(output), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- ACTION: IMPORT (Final DB Save) ---
    if (action === 'IMPORT' || action === 'import') {
      const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
      const { data: batch } = await supabaseAdmin.from('import_batches').insert({
        uploaded_by: user.id,
        total_rows: rows.length,
        valid_rows: rows.length,
      }).select().single();

      const insertData = rows.map((r: any) => ({
        phone_normalized: r.phone,
        phone_raw: r.phone_raw || r.phone,
        gift_type: r.reward_type || '1 Free Macchiato',
        import_batch_id: batch?.id,
        status: 'eligible'
      }));

      const { data, error } = await supabaseAdmin.from('gift_recipients').upsert(insertData, { onConflict: 'phone_normalized' }).select();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, imported: data.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error(`Unsupported action or mode: ${action || mode}`);

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
