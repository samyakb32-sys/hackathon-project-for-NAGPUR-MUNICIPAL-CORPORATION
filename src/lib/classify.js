import { supabase } from "./supabase.js";

/** Classifies a citizen grievance via the classify-grievance Supabase Edge
 * Function (which calls NVIDIA's meta/llama-3.2-3b-instruct server-side,
 * falling back to a second NVIDIA model if that call fails, so the API key
 * never reaches the browser). Returns null on any failure — callers should
 * fall back to leaving the grievance as "PENDING REVIEW" for an officer to
 * triage manually, the same honest degrade pattern used everywhere else in
 * the app. */
export async function classifyGrievance(text) {
  if (!supabase || !text?.trim()) return null;
  try {
    const { data, error } = await supabase.functions.invoke("classify-grievance", {
      body: { text: text.trim() },
    });
    if (error || !data || data.error) return null;
    return {
      department: data.department ?? null,
      confidence: data.confidence ?? null,
      language: data.language ?? null,
      english: data.english ?? null,
      model: data.model ?? null,
      usedFallback: !!data.fallbackReason,
    };
  } catch {
    return null;
  }
}
