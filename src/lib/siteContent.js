import { supabase } from "./supabase.js";

/** Editable front-page text fields, keyed the same way as the
 * site_content table. Anything not overridden there falls back to these. */
export const SITE_CONTENT_DEFAULTS = {
  command_eyebrow: "TODAY'S FORECAST FOR NAGPUR",
  command_headline: "188 problems found before they happen.",
  command_subtitle:
    "This tool looks for floods, bad air, and slow complaints before they get worse — and " +
    "warns the team early. A human officer always makes the final decision; the computer " +
    "only suggests.",
};

/** Loads all site_content rows into a { key: value } map. Returns {} on
 * any failure so callers just fall back to SITE_CONTENT_DEFAULTS. */
export async function fetchSiteContent() {
  if (!supabase) return {};
  const { data, error } = await supabase.from("site_content").select("key, value");
  if (error || !data) return {};
  return Object.fromEntries(data.map((row) => [row.key, row.value]));
}
