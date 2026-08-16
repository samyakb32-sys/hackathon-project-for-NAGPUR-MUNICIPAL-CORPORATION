import { supabase } from "./supabase.js";

/** Computes a real trend forecast from actual submitted grievances —
 * counts per day, then a plain linear-regression line projected 7 days
 * forward. This is honest "trend forecasting", not a trained ML model —
 * with only a handful of real grievances so far, a bigger model would
 * just be fitting noise. As more real citizens submit grievances, this
 * trend becomes more meaningful on its own.
 *
 * Throws if Supabase isn't configured or there isn't enough real data yet
 * (fewer than 3 distinct days) — callers should fall back to the seeded
 * demo forecast in that case, same pattern as the other live features. */
export async function fetchGrievanceTrend() {
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase.from("grievances").select("created_at");
  if (error) throw error;

  const counts = {};
  (data || []).forEach((row) => {
    const day = row.created_at.slice(0, 10);
    counts[day] = (counts[day] || 0) + 1;
  });

  const days = Object.keys(counts).sort();
  if (days.length < 3) throw new Error("Not enough live data for a trend yet");

  const ys = days.map((d) => counts[d]);
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

  const fmtLabel = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  const series = days.map((d, i) => ({
    day: fmtLabel(d),
    observed: ys[i],
    predicted: i === n - 1 ? ys[i] : null, // handoff point, matches the observed→predicted visual break
  }));

  const lastDate = new Date(days[days.length - 1]);
  for (let i = 1; i <= 7; i++) {
    const projectedDate = new Date(lastDate);
    projectedDate.setDate(projectedDate.getDate() + i);
    series.push({
      day: fmtLabel(projectedDate.toISOString().slice(0, 10)),
      observed: null,
      predicted: Math.max(0, Math.round(intercept + slope * (n - 1 + i))),
    });
  }

  return series;
}
