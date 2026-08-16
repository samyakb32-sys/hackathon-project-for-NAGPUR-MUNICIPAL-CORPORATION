// Supabase Edge Function — classifies a citizen grievance using NVIDIA NIM
// (meta/llama-3.2-3b-instruct). Runs server-side so the NVIDIA API key is
// never exposed to the browser.
//
// Deploy: supabase functions deploy classify-grievance
// Secret:  supabase secrets set NVIDIA_API_KEY=your-key-here
// (or set both via the Supabase Dashboard: Edge Functions tab)

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEPARTMENTS = ["PUBLIC WORKS", "WATER", "ELECTRICAL", "HEALTH", "SANITATION", "TRAFFIC", "OTHER"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'text'" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("NVIDIA_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "NVIDIA_API_KEY not configured" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const systemPrompt =
      "You are a municipal complaint classifier for Nagpur Municipal Corporation, India. " +
      "Citizens write complaints in English, Hindi, or Marathi. " +
      `Reply with ONLY a JSON object, no other text, in this exact shape: ` +
      `{"department": one of ${JSON.stringify(DEPARTMENTS)}, "confidence": integer 0-100, ` +
      `"language": one of ["English","हिंदी","मराठी"], "english": "English translation of the complaint"}.`;

    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta/llama-3.2-3b-instruct",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.2,
        top_p: 0.7,
        max_tokens: 200,
        stream: false,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return new Response(JSON.stringify({ error: `NVIDIA API error: ${res.status}`, detail }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const completion = await res.json();
    const raw = completion?.choices?.[0]?.message?.content ?? "";

    // The model may wrap the JSON in prose or a code fence despite instructions — extract it.
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return new Response(JSON.stringify({ error: "Could not parse model output", raw }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(match[0]);
    const department = DEPARTMENTS.includes(parsed.department) ? parsed.department : "OTHER";
    const confidence = Number.isFinite(parsed.confidence)
      ? Math.max(0, Math.min(100, Math.round(parsed.confidence)))
      : null;

    return new Response(
      JSON.stringify({
        department,
        confidence,
        language: parsed.language || null,
        english: parsed.english || null,
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
