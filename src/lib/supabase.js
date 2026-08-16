import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Null when Supabase isn't configured (missing env vars) — callers should
 * treat that as "backend unavailable" and fall back to seeded demo data,
 * the same way the live weather/AQI fetches degrade gracefully. */
export const supabase = url && key ? createClient(url, key) : null;
