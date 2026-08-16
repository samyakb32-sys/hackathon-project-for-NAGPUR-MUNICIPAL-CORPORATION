/* Live external data feeds — real rainfall forecast + real air quality for
 * Nagpur. Both degrade gracefully: if a fetch fails (offline, rate-limited,
 * blocked), callers fall back to the seeded demo numbers so the dashboard
 * never breaks during a live run. */

const NAGPUR_LAT = 21.1458;
const NAGPUR_LON = 79.0882;

/** Real hourly rainfall forecast from Open-Meteo (no API key required),
 * bucketed into 12h-wide windows (0-12h, 12-24h, ... 48-60h) — rainfall
 * *within* each window, not cumulative-from-now. Cumulative totals are
 * monotonically increasing, so the last bucket would always be "the peak"
 * and the chart's peak-highlighting would be meaningless; per-window totals
 * can rise and fall like a real storm, which is what the chart is for. */
export async function fetchRainForecast() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${NAGPUR_LAT}&longitude=${NAGPUR_LON}` +
    `&hourly=precipitation&forecast_days=3&timezone=Asia%2FKolkata`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo request failed: ${res.status}`);

  const json = await res.json();
  const precip = json?.hourly?.precipitation;
  if (!Array.isArray(precip)) throw new Error("Open-Meteo response missing hourly precipitation");

  const buckets = [12, 24, 36, 48, 60];
  let prevHour = 0;
  return buckets.map((h) => {
    const windowSum = precip.slice(prevHour, h).reduce((sum, mm) => sum + (mm || 0), 0);
    prevHour = h;
    return { t: `${h}h`, v: Math.round(windowSum * 10) / 10 };
  });
}

/** Real current AQI / PM10 reading for Nagpur from the WAQI public API.
 * Uses VITE_WAQI_TOKEN if set (get a free instant token at
 * https://aqicn.org/data-platform/token/); falls back to WAQI's shared
 * "demo" token, which is rate-limited and not reliable for a live demo. */
export async function fetchAQI() {
  const token = import.meta.env.VITE_WAQI_TOKEN || "demo";
  const res = await fetch(`https://api.waqi.info/feed/nagpur/?token=${token}`);
  if (!res.ok) throw new Error(`WAQI request failed: ${res.status}`);

  const json = await res.json();
  if (json.status !== "ok") throw new Error(json.data || "WAQI returned an error");

  return {
    pm10: json.data.iaqi?.pm10?.v ?? null,
    aqi: json.data.aqi ?? null,
    stationTime: json.data.time?.s ?? null,
  };
}
