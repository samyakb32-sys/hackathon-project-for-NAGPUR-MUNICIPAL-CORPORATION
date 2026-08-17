import { supabase } from "./supabase.js";

// Fits a plain linear-regression line through evenly-spaced counts and
// projects it `ahead` steps forward. Honest trend forecasting, not a
// trained model — with only a handful of real points, anything fancier
// would just be fitting noise.
function projectTrend(ys, ahead) {
  const n = ys.length;
  const xMean = (n - 1) / 2;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (ys[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  return Array.from({ length: ahead }, (_, i) =>
    Math.max(0, Math.round(intercept + slope * (n + i)))
  );
}

// Counts rows into buckets keyed by the first `keyLength` characters of
// their timestamp — 10 chars = calendar day ("2026-08-17"), 13 chars =
// hour ("2026-08-17T14").
function bucketBy(rows, keyLength) {
  const counts = {};
  rows.forEach((row) => {
    const key = row.created_at.slice(0, keyLength);
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.keys(counts).sort().map((key) => ({ key, count: counts[key] }));
}

/** Computes a real trend forecast from actual submitted grievances.
 * Buckets by calendar day when there are at least 3 different days of
 * data; a fresh project won't have that yet, so it falls back to bucketing
 * by hour within today so a live trend still shows up from a demo's first
 * few submissions instead of only ever showing seeded data.
 *
 * Throws if Supabase isn't configured or there's truly not enough data yet
 * (fewer than 3 buckets either way) — callers fall back to the seeded demo
 * forecast in that case, same pattern as the other live features. */
export async function fetchGrievanceTrend() {
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase.from("grievances").select("created_at");
  if (error) throw error;
  const rows = data || [];

  let buckets = bucketBy(rows, 10);   // by day
  let unit = "day";
  if (buckets.length < 3) {
    buckets = bucketBy(rows, 13);     // by hour, within today
    unit = "hour";
  }
  if (buckets.length < 3) throw new Error("Not enough live data for a trend yet");

  const fmtLabel = (key) =>
    unit === "day"
      ? new Date(key).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
      : new Date(`${key}:00:00`).toLocaleTimeString("en-IN", { hour: "numeric" });

  const stepMs = unit === "day" ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  const toMs = (key) => new Date(unit === "day" ? key : `${key}:00:00`).getTime();

  const ys = buckets.map((b) => b.count);
  const n = ys.length;

  const series = buckets.map((b, i) => ({
    day: fmtLabel(b.key),
    observed: b.count,
    predicted: i === n - 1 ? b.count : null, // handoff point, matches the observed→predicted visual break
  }));

  const lastMs = toMs(buckets[n - 1].key);
  const toKey = (ms) =>
    unit === "day"
      ? new Date(ms).toISOString().slice(0, 10)
      : new Date(ms).toISOString().slice(0, 13);

  projectTrend(ys, 7).forEach((v, i) => {
    series.push({
      day: fmtLabel(toKey(lastMs + stepMs * (i + 1))),
      observed: null,
      predicted: v,
    });
  });

  return series;
}
