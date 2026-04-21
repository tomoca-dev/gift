// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get User and Service Role Client for verification (bypass RLS to ensure role check is definitive)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check Admin Role
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('staff_profiles')
      .select('role')
      .eq('user_id', user.id)
      .eq('active', true)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Access denied. Admin role required.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { mode, headers, sampleRows, text, image } = await req.json();
    const apiKey = Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY');

    if (!apiKey) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    let prompt = '';
    let imagePart = null;

    if (mode === 'text') {
      prompt = `
        You are an expert data extractor. I have a block of raw, unstructured text that contains a list of people and rewards.
        I need you to extract every person, their phone number, and their gift/reward type.
        
        Text: """${text}"""
        
        Rules:
        1. Extract phone numbers and normalize them (digits and + only).
        2. Identify the coffee/gift type for each person if mentioned.
        3. If no reward is mentioned, suggest a logical default (e.g., "Standard Coffee").
        4. Return a JSON array of objects.
        
        Expected JSON: { "extractedRows": [{ "phone": "...", "gift_type": "...", "name": "..." }] }
      `;
    } else if (mode === 'image') {
      imagePart = {
        inlineData: {
          data: image, // base64
          mimeType: "image/jpeg"
        }
      };
      prompt = `
        You are an expert OCR and data analyst. This image is a photo or screenshot of a list of reward recipients.
        Extract every phone number and gift type from this image.
        
        Rules:
        1. Identify names, phone numbers, and gift types.
        2. Normalize phone numbers.
        3. Return a JSON array of objects.
        
        Expected JSON: { "extractedRows": [{ "phone": "...", "gift_type": "...", "name": "..." }] }
      `;
    } else {
      // DEFAULT: Structured File (Column Mapping)
      prompt = `
        You are an expert data analyst. I have a dataset from a CSV/Excel file.
        Analyze headers and sample rows to identify the best column for phone numbers and reward types.

        Headers: ${JSON.stringify(headers)}
        Sample Data: ${JSON.stringify(sampleRows)}

        Return JSON ONLY:
        {
          "phoneColumn": "...", 
          "rewardTypeColumn": "...", 
          "suggestedRewardType": "...",
          "reasoning": "..."
        }
      `;
    }

    const result = imagePart 
      ? await model.generateContent([prompt, imagePart])
      : await model.generateContent(prompt);
      
    const response = await result.response;
    const responseText = response.text();
    
    // Extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (!analysis) {
        throw new Error('Gemini failed to generate compatible analysis JSON.');
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Edge Function Error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: errorMessage === 'Unauthorized' ? 401 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});


