import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchRainForecast, fetchAQI } from "./lib/liveData.js";
import { fetchGrievanceTrend } from "./lib/forecast.js";
import { classifyGrievance } from "./lib/classify.js";
import { resetPasswordWithDob } from "./lib/resetPassword.js";
import { fetchSiteContent, SITE_CONTENT_DEFAULTS } from "./lib/siteContent.js";
import { supabase } from "./lib/supabase.js";

/* ═══════════════════════════════════════════════════════════════════════════
   NAGPUR COMMAND — Civic Foresight Dashboard
   AI-Powered Integrated Urban Intelligence & Proactive Governance

   Single-page app. Sidebar navigation switches between 6 sections.
   The Ambazari alert on the Command screen opens a detail modal.
   All data is seeded/representative — no live PII.

   Theme: premium light UI — kinetic hero headline, count-up KPI cards,
   floating-elevation cards, animated page transitions.
   ═══════════════════════════════════════════════════════════════════════════ */


/* ─────────────────────────────── SECTION 1: DATA ─────────────────────────── */

// Sidebar navigation items
const NAV = [
  { id: "command",    label: "Command" },
  { id: "grievances", label: "Grievances" },
  { id: "hotspots",   label: "Hotspots & Forecast" },
  { id: "advisory",   label: "Advisory" },
  { id: "field",      label: "Field Teams" },
  { id: "trust",      label: "Trust" },
  // "officer" is intentionally not in this list — the Officer Console has
  // its own door (TopBar "Login as Officer" / the profile dropdown once
  // signed in as one), not a sidebar item everyone sees.
];

const SCREEN_TITLES = {
  command: "Command Center",
  grievances: "Triage Inbox",
  hotspots: "Hotspots & Forecast",
  advisory: "Advisory Composer",
  field: "Field Teams",
  officer: "Officer Console",
  trust: "Trust & Ethics",
};

// Proactive alerts shown on the Command screen
const ALERTS = [
  {
    id: "ambazari",
    level: "CRITICAL",
    ward: "Ambazari",
    conf: 92,
    text: "68mm rain forecast in 36h, 14 open drain complaints. Waterlogging likely.",
    // Extra fields below only exist on this alert — it's the one that opens the modal
    wardId: "W-042",
    priority: "P0",
    status: "Unassigned",
    rain: [
      { t: "12h", v: 14 },
      { t: "24h", v: 28 },
      { t: "36h", v: 68 },   // ← the peak, highlighted red
      { t: "48h", v: 22 },
      { t: "60h", v: 9  },
    ],
    history:
      "This pattern matches the flash flood event of July 14, 2022, where 72mm of " +
      "rain caused overflow at the Ambazari Lake spillway within 4 hours.",
    complaints: [
      { id: "#GR-8821", text: "Main Drain Blockage",   sev: "Critical" },
      { id: "#GR-8845", text: "Silt Accumulation",     sev: "Warning"  },
      { id: "#GR-8901", text: "Manhole Cover Missing", sev: "Info"     },
    ],
    teams: ["RRT-Alpha (2km)", "Drain-Unit 4 (5km)"],
  },
  {
    id: "lakadganj",
    level: "WARNING",
    ward: "Lakadganj",
    conf: 78,
    text: "Garbage complaints up 3.2x, route failure predicted.",
  },
  {
    id: "gandhibagh",
    level: "INFO",
    ward: "Gandhibagh",
    conf: 85,
    text: "Air quality index predicted to hit 250 in 12h due to construction dust.",
  },
];

// Multilingual citizen complaints for the Grievance Triage screen
const GRIEVANCES = [
  {
    id: "#GR-9012",
    text: "रस्त्यावर मोठा खड्डा आहे",              // Marathi
    en: "There is a large pothole on the road.",
    dept: "PUBLIC WORKS",
    ward: "Dharampeth, VIP Road",
    conf: 94,
    sla: "safe",
    similar: [
      { id: "#GR-8802", status: "RESOLVED", text: "Pothole near Dharampeth college gate..." },
      { id: "#GR-8711", status: "CLOSED",   text: "Road damage after heavy rain..." },
    ],
  },
  {
    id: "#GR-9013",
    text: "नाली जाम है, पानी बाहर आ रहा है",       // Hindi
    en: "Drain is blocked, water is overflowing.",
    dept: "HEALTH",
    ward: "Sitabuldi",
    conf: 88,
    sla: "risk",
    similar: [
      { id: "#GR-8790", status: "RESOLVED", text: "Drain overflow near Sitabuldi market..." },
    ],
  },
  {
    id: "#GR-9005",
    text: "चौकात पथदिवे काम करत नाहीत",           // Marathi
    en: "Streetlights not working in square",
    dept: "ELECTRICAL",
    ward: "Mahal",
    conf: 90,
    sla: "breached",
    similar: [
      { id: "#GR-8654", status: "CLOSED", text: "Streetlight outage, Mahal chowk..." },
    ],
  },
  {
    id: "#GR-9015",
    text: "बाजार के पास पाइपलाइन फट गई",          // Hindi
    en: "Pipeline burst near market",
    dept: "WATER",
    ward: "Itwari",
    conf: 91,
    sla: "safe",
    similar: [
      { id: "#GR-8501", status: "RESOLVED", text: "Water pipeline leak, Itwari bazaar..." },
    ],
  },
];

// 14-day complaint volume: first 7 days observed, last 7 predicted
const FORECAST = [
  { day: "D1",  observed: 210, predicted: null },
  { day: "D2",  observed: 225, predicted: null },
  { day: "D3",  observed: 240, predicted: null },
  { day: "D4",  observed: 230, predicted: null },
  { day: "D5",  observed: 255, predicted: null },
  { day: "D6",  observed: 260, predicted: null },
  { day: "D7",  observed: 270, predicted: 270 },  // ← handoff point, both series meet
  { day: "D8",  observed: null, predicted: 290 },
  { day: "D9",  observed: null, predicted: 310 },
  { day: "D10", observed: null, predicted: 330 },
  { day: "D11", observed: null, predicted: 350 },
  { day: "D12", observed: null, predicted: 380 },
  { day: "D13", observed: null, predicted: 410 },
  { day: "D14", observed: null, predicted: 440 },
];

// 30-day PM10 readings. NCAP annual benchmark is 60 µg/m³ — bars above it turn red.
const PM10 = [
  { d: "Oct 01", v: 35 }, { d: "Oct 03", v: 42 }, { d: "Oct 05", v: 68 },
  { d: "Oct 07", v: 55 }, { d: "Oct 09", v: 38 }, { d: "Oct 11", v: 44 },
  { d: "Oct 13", v: 58 }, { d: "Oct 15", v: 48 }, { d: "Oct 17", v: 40 },
  { d: "Oct 19", v: 46 }, { d: "Oct 21", v: 70 }, { d: "Oct 23", v: 75 },
  { d: "Oct 25", v: 62 }, { d: "Oct 27", v: 45 }, { d: "Oct 29", v: 39 },
];

// Field crews for the Field Teams screen
const TEAMS = [
  {
    name: "RRT-Alpha",
    status: "in_progress",
    task: "Desilting",
    loc: "Ambazari",
    eta: "45m",
    history: [
      { t: "09:00", label: "Dispatched from HQ" },
      { t: "09:15", label: "On Site - Ambazari Sector 4" },
      { t: "10:30", label: "Task Completed: Drain Cleared", done: true },
    ],
  },
  {
    name: "Drain-Unit 4",
    status: "in_progress",
    task: "Drainage Repair",
    loc: "Sitabuldi",
    eta: "12m",
    history: [
      { t: "10:05", label: "Dispatched from Depot 2" },
      { t: "10:18", label: "En route to Sitabuldi", done: true },
    ],
  },
  {
    name: "Drain-Unit 2",
    status: "available",
    task: null,
    loc: "HQ Depot",
    eta: null,
    history: [],
  },
  {
    name: "RRT-Bravo",
    status: "unavailable",
    task: null,
    loc: "Off duty",
    eta: null,
    history: [],
  },
];

// Recommended interventions on the Hotspots screen
const INTERVENTIONS = [
  {
    ward: "Dharampeth",
    title: "Deploy Desilting Crews",
    desc: "Mandatory deployment of additional desilting crews to critical zones.",
    impact: "85% reduction in localized waterlogging risk",
  },
  {
    ward: "Sitabuldi",
    title: "Activate Smog Towers",
    desc: "Initiate high-capacity air filtration protocols at central transit hubs.",
    impact: "Contain AQI escalation within commercial zones",
  },
  {
    ward: "Mahal",
    title: "Community Outreach",
    desc: "Dispatch civic liaison teams to address localized civic grievances.",
    impact: "Improvement in immediate citizen trust metrics",
  },
];

// Ethics sections on the Trust screen
const ETHICS_SECTIONS = [
  {
    icon: "⚖️",
    title: "We follow India's data protection law",
    body:
      "We follow India's Digital Personal Data Protection Act of 2023. We only use " +
      "your data to run city services — never for anything else.",
  },
  {
    icon: "🔻",
    title: "We collect as little as possible",
    body:
      "We only save the information we actually need to fix problems. " +
      "Anything extra is thrown away right away, not stored.",
  },
  {
    icon: "👁️",
    title: "We hide who you are",
    body:
      "Maps and charts only show group totals, not individual people. " +
      "A citizen's report is separated from their identity before any computer looks at it.",
  },
  {
    icon: "🤝",
    title: "A person always decides, not the computer",
    body:
      "Our computer only points out patterns and possible problems — it never acts on its " +
      "own. Every dispatch, message, or approval needs a real officer to click \"yes\" first.",
  },
];

const ADVISORY_MESSAGES = {
  English:
    "CRITICAL: Ambazari residents, 68mm rain forecast in 36h. Risk of waterlogging " +
    "near lake spillway. Move vehicles to higher ground.",
  "मराठी":
    "अत्यावश्यक: अंबाझरी रहिवाशांनो, ३६ तासांत ६८ मिमी पावसाचा अंदाज. तलावाजवळ " +
    "पाणी साचण्याचा धोका. वाहने उंच ठिकाणी हलवा.",
  "हिंदी":
    "अत्यावश्यक: अंबाझरी निवासियों, 36 घंटे में 68 मिमी वर्षा का पूर्वानुमान। झील " +
    "के पास जलभराव का खतरा। वाहनों को ऊँचे स्थान पर ले जाएँ।",
};


/* ──────────────────── SECTION 2: SMALL REUSABLE UI PIECES ────────────────── */

const CARD_SHADOW = "0 1px 2px rgba(16,24,40,.04), 0 12px 24px -10px rgba(16,24,40,.10)";

/** Counts up from 0 to each target over ~1.1s with a cubic ease-out — runs
 * once per mount, so it naturally replays whenever the parent screen
 * (which unmounts on navigation) comes back into view. */
function useCountUp(targets) {
  const [vals, setVals] = useState(() => targets.map(() => 0));
  useEffect(() => {
    let raf;
    const start = performance.now();
    const dur = 1100;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVals(targets.map((t) => Math.round(t * eased)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return vals;
}

const fmt = (n) => n.toLocaleString("en-IN");

/** Fetches real external data and falls back to seeded demo data if the
 * request fails (offline, rate-limited) — the dashboard should never break
 * during a live run just because a public API hiccupped.
 *
 * `key` controls when the effect re-runs (e.g. the alert's id) — components
 * like the alert modal stay mounted with a null payload until opened, so
 * without a key the fetch would only ever fire once, before real data
 * exists to fall back to. `fallback` is read via a ref so the catch handler
 * always uses the fallback current at fetch time, not the one captured when
 * the effect was set up. */
function useLive(fetchFn, fallback, key) {
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;
  const [state, setState] = useState({ data: fallback, live: false, loading: true });
  useEffect(() => {
    let cancelled = false;
    fetchFn()
      .then((data) => { if (!cancelled) setState({ data, live: true, loading: false }); })
      .catch(() => { if (!cancelled) setState({ data: fallbackRef.current, live: false, loading: false }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

/**
 * A single KPI card: white, rounded-2xl, soft floating shadow, lifts on hover.
 * `tone` controls the colour of the small delta pill:
 *   "up"      → red    (a metric going the wrong way)
 *   "down"    → green  (a metric improving)
 *   "neutral" → grey
 */
function StatCard({ label, value, suffix, sub, tone = "neutral", accent = false }) {
  const toneStyles = {
    up:      "text-red-600 bg-red-50",
    down:    "text-emerald-600 bg-emerald-50",
    neutral: "text-slate-600 bg-slate-100",
  };

  return (
    <div
      className="bg-white rounded-2xl p-6 transition-transform duration-300 ease-out hover:-translate-y-1"
      style={{ boxShadow: CARD_SHADOW }}
    >
      <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
        {label}
      </div>
      <div
        className={`text-[34px] font-extrabold mt-1.5 tabular-nums ${accent ? "text-indigo-600" : "text-slate-900"}`}
        style={{ fontFamily: "'Inter Tight', sans-serif" }}
      >
        {value}
        {suffix && <span className="text-base font-semibold text-slate-400"> {suffix}</span>}
      </div>
      {sub && (
        <span className={`inline-block mt-2.5 text-xs font-semibold px-2.5 py-0.5 rounded-lg ${toneStyles[tone]}`}>
          {sub}
        </span>
      )}
    </div>
  );
}

/**
 * Semi-circular gauge — a tick-mark arc filling clockwise to `value`
 * percent, with the percentage in the middle. Used wherever a single
 * live reading (AQI, SLA risk) benefits from an at-a-glance dial instead
 * of just a number.
 */
function Gauge({ value, color = "#4338ca", showLabels = false, min = "0", max = "100" }) {
  const clamped = Math.max(0, Math.min(100, value));
  const ticks = 40;
  const activeCount = Math.round((clamped / 100) * ticks);
  const cx = 100, cy = 100, rOuter = 80, rInner = 70;

  const tickEls = Array.from({ length: ticks }, (_, i) => {
    const angle = Math.PI + (i / (ticks - 1)) * Math.PI; // sweep π → 2π
    const x1 = cx + rInner * Math.cos(angle);
    const y1 = cy + rInner * Math.sin(angle);
    const x2 = cx + rOuter * Math.cos(angle);
    const y2 = cy + rOuter * Math.sin(angle);
    return (
      <line
        key={i}
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={i < activeCount ? color : "#e2e2e7"}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    );
  });

  return (
    <div>
      <svg viewBox="0 0 200 120" className="w-full" style={{ maxWidth: 220, margin: "0 auto", display: "block" }}>
        {tickEls}
        <text x={cx} y="105" textAnchor="middle" fontSize="22" fontWeight="700" fill="#1a1a22">
          {clamped}%
        </text>
      </svg>
      {showLabels && (
        <div className="flex justify-between text-[11px] text-slate-400 px-2" style={{ maxWidth: 220, margin: "0 auto" }}>
          <span>{min}</span>
          <span>{max}</span>
        </div>
      )}
    </div>
  );
}

/** A small coloured label pill. */
function Badge({ children, tone = "slate" }) {
  const toneStyles = {
    slate: "bg-slate-100 text-slate-600",
    red:   "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-emerald-50 text-emerald-600",
    blue:  "bg-blue-50 text-blue-700",
  };

  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap ${toneStyles[tone]}`}>
      {children}
    </span>
  );
}

/**
 * Consistent page header used at the top of every screen — a small
 * indigo eyebrow label, a bold heading, an optional trailing badge
 * (e.g. a live-status chip), and an optional subtitle. Keeps the same
 * visual weight/rhythm across screens instead of each one improvising
 * its own heading size and spacing.
 */
function ScreenHeader({ eyebrow, title, subtitle, badge, action }) {
  return (
    <div className="mb-6">
      {eyebrow && (
        <div className="text-xs font-bold tracking-[0.12em] text-indigo-600 mb-2">{eyebrow}</div>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h1
            className="text-[28px] font-extrabold text-slate-900"
            style={{ fontFamily: "'Inter Tight', sans-serif" }}
          >
            {title}
          </h1>
          {badge}
        </div>
        {action}
      </div>
      {subtitle && <p className="text-sm text-slate-400 mt-1.5 max-w-2xl">{subtitle}</p>}
    </div>
  );
}

/**
 * Hero headline where each word fades/blurs in with a staggered delay —
 * the "kinetic" entrance used on the Command screen.
 */
function KineticHeadline({ words }) {
  return (
    <div
      className="font-extrabold leading-[1.03] tracking-tight"
      style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: "clamp(40px,6vw,72px)" }}
    >
      {words.map((w, i) => (
        <React.Fragment key={i}>
          <span
            className="kinetic-word inline-block"
            style={{ animationDelay: `${0.02 + i * 0.08}s`, color: w.color }}
          >
            {w.text}
          </span>
          {w.break ? <br /> : " "}
        </React.Fragment>
      ))}
    </div>
  );
}


/* ───────────────── SECTION 3: CHARTS (hand-built SVG, no library) ────────── */

/**
 * Vertical bar chart drawn as raw SVG.
 *   highlightMax → colours the single tallest bar red (used for rainfall peak)
 *   threshold    → draws a dashed red line and reddens every bar above it (used for PM10)
 */
function BarChart({ data, height = 100, highlightMax = false, threshold = null, labels = [] }) {
  const width = 320;
  const peak = Math.max(...data.map((d) => d.v));
  const ceiling = Math.max(peak, threshold || 0) * 1.15;  // headroom above tallest bar
  const barSlot = width / data.length;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
        {/* Threshold line (only for PM10) */}
        {threshold && (
          <line
            x1="0" x2={width}
            y1={height - (threshold / ceiling) * height}
            y2={height - (threshold / ceiling) * height}
            stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4 3"
          />
        )}

        {/* The bars */}
        {data.map((d, i) => {
          const barHeight = (d.v / ceiling) * height;
          const isFlagged = highlightMax
            ? d.v === peak                       // rainfall: flag the peak
            : threshold && d.v > threshold;      // PM10: flag anything over the line

          return (
            <rect
              key={i}
              x={i * barSlot + barSlot * 0.18}
              y={height - barHeight}
              width={barSlot * 0.64}
              height={barHeight}
              rx="2"
              fill={isFlagged ? "#dc2626" : "#6366f1"}
            />
          );
        })}
      </svg>

      {/* X-axis labels underneath */}
      {labels.length > 0 && (
        <div className="flex justify-between text-[9px] text-slate-400 mt-1">
          {labels.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      )}
    </div>
  );
}

/**
 * Two-series line chart: a solid navy "Observed" line, then a dashed amber
 * "Predicted" line. The visual break between them is the whole point of the
 * screen — it's what makes the AI's contribution legible at a glance.
 */
function LineChart({ data, height = 150 }) {
  const width = 340;
  const allValues = data.map((d) => d.observed ?? d.predicted ?? 0);
  const ceiling = Math.max(...allValues) * 1.1;
  const stepX = width / (data.length - 1);

  // Convert a data value into a Y pixel coordinate (SVG Y grows downward)
  const toY = (v) => height - (v / ceiling) * height;

  const observedPoints = data
    .map((d, i) => (d.observed != null ? [i * stepX, toY(d.observed)] : null))
    .filter(Boolean);

  const predictedPoints = data
    .map((d, i) => (d.predicted != null ? [i * stepX, toY(d.predicted)] : null))
    .filter(Boolean);

  const toPath = (pts) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
        {/* Solid line = what actually happened */}
        <path d={toPath(observedPoints)} fill="none" stroke="#1e1b4b" strokeWidth="2.5" />
        {/* Dashed line = what the model expects next */}
        <path d={toPath(predictedPoints)} fill="none" stroke="#d97706" strokeWidth="2.5" strokeDasharray="5 4" />

        {observedPoints.map((p, i) => (
          <circle key={`o${i}`} cx={p[0]} cy={p[1]} r="2.5" fill="#1e1b4b" />
        ))}
        {predictedPoints.map((p, i) => (
          <circle key={`p${i}`} cx={p[0]} cy={p[1]} r="2.5" fill="#d97706" />
        ))}

        {/* Inline legend, top-right */}
        <text x={width - 4} y={12} textAnchor="end" fontSize="9" fill="#1e1b4b" fontWeight="700">
          Observed
        </text>
        <text x={width - 4} y={24} textAnchor="end" fontSize="9" fill="#d97706" fontWeight="700">
          Predicted
        </text>
      </svg>

      <div className="flex justify-between text-[9px] text-slate-400 mt-1">
        {data.filter((_, i) => i % 2 === 0).map((f) => <span key={f.day}>{f.day}</span>)}
      </div>
    </div>
  );
}

// Real, approximate coordinates for Nagpur localities named across the app.
const WARDS = {
  sitabuldi:  { lat: 21.1462, lng: 79.0790 },
  gandhibagh: { lat: 21.1544, lng: 79.1119 },
  lakadganj:  { lat: 21.1602, lng: 79.1197 },
  dharampeth: { lat: 21.1394, lng: 79.0637 },
  mahal:      { lat: 21.1489, lng: 79.1050 },
  ambazari:   { lat: 21.1225, lng: 79.0378 },
  itwari:     { lat: 21.1531, lng: 79.1114 },
};
const NAGPUR_CENTER = [21.1458, 79.0882];

// What each map "layer" button on the Command screen actually shows —
// three different, real marker sets, not the same map redrawn.
const COMMAND_LAYER_MARKERS = {
  "Grievances": [
    { ward: "sitabuldi", color: "#f43f5e", label: "Sitabuldi — most complaints", size: 16 },
    { ward: "gandhibagh", color: "#f59e0b", label: "Gandhibagh — some complaints", size: 13 },
    { ward: "lakadganj", color: "#6366f1", label: "Lakadganj — few complaints", size: 10 },
  ],
  "Flood Risk": [
    { ward: "ambazari", color: "#dc2626", label: "Ambazari — high flood risk", size: 16 },
    { ward: "sitabuldi", color: "#f59e0b", label: "Sitabuldi — some flood risk", size: 12 },
    { ward: "dharampeth", color: "#6366f1", label: "Dharampeth — low flood risk", size: 10 },
  ],
  "Air Quality": [
    { ward: "itwari", color: "#dc2626", label: "Itwari — bad air", size: 16 },
    { ward: "mahal", color: "#f59e0b", label: "Mahal — okay air", size: 12 },
    { ward: "dharampeth", color: "#6366f1", label: "Dharampeth — good air", size: 10 },
  ],
};

/**
 * A real, interactive map of Nagpur (OpenStreetMap tiles via Leaflet — free,
 * no API key needed) with coloured markers at real ward coordinates.
 * `markers`: [{ ward, label, color, size? }]
 */
/** Explains what each coloured dot on a map means — without this, a dot is
 * just a dot until you hover it. Always visible under the map. */
function MapLegend({ markers }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5 px-1">
      {markers.map((m) => (
        <div key={m.label} className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="rounded-full flex-shrink-0" style={{ width: 9, height: 9, background: m.color }} />
          {m.label}
        </div>
      ))}
    </div>
  );
}

function NagpurMap({ markers, caption, height = 280, zoom = 12, legend = true }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: NAGPUR_CENTER,
      zoom,
      scrollWheelZoom: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;
    layerRef.current.clearLayers();
    markers.forEach((m) => {
      const pos = WARDS[m.ward];
      if (!pos) return;
      const size = m.size ?? 14;
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${m.color};border:2px solid white;box-shadow:0 0 0 4px ${m.color}55"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      L.marker([pos.lat, pos.lng], { icon })
        .bindTooltip(m.label, { direction: "top", offset: [0, -size / 2] })
        .addTo(layerRef.current);
    });
  }, [markers]);

  return (
    <div>
      <div className="relative rounded-2xl overflow-hidden" style={{ height }}>
        <div ref={containerRef} className="w-full h-full" />
        {caption && (
          <div className="absolute bottom-3 left-3 z-[1000] text-[11px] text-slate-700 bg-white/90 px-2 py-1 rounded shadow">
            {caption}
          </div>
        )}
      </div>
      {legend && <MapLegend markers={markers} />}
    </div>
  );
}


/* ──────────────────────── SECTION 4: TOP HEADER BAR ──────────────────────── */

function TopBar({ title, session, isOfficer, onOpenAuth, onOpenOfficerAuth, onOpenOfficerConsole }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="h-[68px] flex-shrink-0 flex items-center justify-between px-9 border-b border-slate-100 bg-white">
      <div className="text-[15px] font-bold text-slate-900" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
        {title}
      </div>
      <div className="flex items-center gap-3.5">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-[7px] h-[7px] rounded-full bg-emerald-600 pulse-dot" />
          Live · Oct 24, 2023
        </div>

        {!supabase ? (
          <div className="w-8 h-8 rounded-full bg-indigo-950 text-white flex items-center justify-center text-xs font-bold">
            A
          </div>
        ) : session ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-8 h-8 rounded-full bg-indigo-950 text-white flex items-center justify-center text-xs font-bold"
            >
              {session.user.email[0].toUpperCase()}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-11 bg-white rounded-xl border border-slate-100 p-3 w-56 z-[1100]" style={{ boxShadow: CARD_SHADOW }}>
                <div className="text-[11px] text-slate-400">Signed in as</div>
                <div className="text-sm font-semibold text-slate-800 truncate mb-3">
                  {session.user.email}
                  {isOfficer && <span className="ml-1.5 text-[10px] font-bold text-indigo-600 align-middle">OFFICER</span>}
                </div>
                {isOfficer && (
                  <button
                    onClick={() => { onOpenOfficerConsole(); setMenuOpen(false); }}
                    className="w-full text-xs font-bold text-indigo-600 border border-indigo-200 rounded-lg py-1.5 hover:bg-indigo-50 mb-2"
                  >
                    Officer Console
                  </button>
                )}
                <button
                  onClick={() => { supabase.auth.signOut(); setMenuOpen(false); }}
                  className="w-full text-xs font-bold text-red-600 border border-red-200 rounded-lg py-1.5 hover:bg-red-50"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenOfficerAuth}
              className="text-xs font-bold text-indigo-600 border border-indigo-200 px-3.5 py-2 rounded-[10px] hover:bg-indigo-50 whitespace-nowrap"
            >
              Login as Officer
            </button>
            <button
              onClick={onOpenAuth}
              className="text-xs font-bold bg-indigo-950 text-white px-3.5 py-2 rounded-[10px] hover:bg-indigo-900 whitespace-nowrap"
            >
              Sign In / Sign Up
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


/* ───────────────────────── SECTION 5: COMMAND SCREEN ─────────────────────── */

function CommandView({ onOpenAlert }) {
  const counts = useCountUp([2431, 188, 7, 16]);
  const [mapLayer, setMapLayer] = useState("Grievances");
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const visibleAlerts = ALERTS.filter((a) => !dismissedAlerts.includes(a.id));
  const [content, setContent] = useState({});

  useEffect(() => { fetchSiteContent().then(setContent); }, []);

  const eyebrow = content.command_eyebrow || SITE_CONTENT_DEFAULTS.command_eyebrow;
  const headline = content.command_headline || SITE_CONTENT_DEFAULTS.command_headline;
  const subtitle = content.command_subtitle || SITE_CONTENT_DEFAULTS.command_subtitle;

  return (
    <div>
      {/* Kinetic hero headline */}
      <div className="pb-9 mb-9 border-b border-slate-100">
        <div className="text-xs font-bold tracking-[0.12em] text-indigo-600 mb-3.5">
          {eyebrow}
        </div>
        {headline === SITE_CONTENT_DEFAULTS.command_headline ? (
          <KineticHeadline
            words={[
              { text: "188", color: "#4338ca" },
              { text: "problems", break: true },
              { text: "found", },
              { text: "before", break: true },
              { text: "they", },
              { text: "happen." },
            ]}
          />
        ) : (
          <div
            className="font-extrabold leading-[1.03] tracking-tight text-slate-900"
            style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: "clamp(40px,6vw,72px)" }}
          >
            {headline}
          </div>
        )}
        <p className="text-[17px] leading-relaxed text-slate-500 max-w-xl mt-4">
          {subtitle}
        </p>
      </div>

      {/* Four headline KPIs. "Predicted SLA Breaches" is the proactive one. */}
      <div className="grid grid-cols-4 gap-5 mb-7">
        <StatCard label="Open Grievances" value={fmt(counts[0])} sub="+12% vs LW" tone="up" />
        <StatCard label="Predicted SLA Breaches (7D)" value={fmt(counts[1])} sub="— Stable" tone="neutral" accent />
        <StatCard label="Active Hotspots" value={fmt(counts[2])} sub="-2 vs LW" tone="down" />
        <StatCard label="Avg Resolution Time" value={counts[3]} suffix="days" sub="+1 day" tone="up" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Map panel */}
        <div className="col-span-2 bg-white rounded-[22px] p-5" style={{ boxShadow: CARD_SHADOW }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              {["Grievances", "Flood Risk", "Air Quality"].map((layer) => (
                <button
                  key={layer}
                  onClick={() => setMapLayer(layer)}
                  className={`text-xs font-semibold px-3.5 py-1.5 rounded-[10px] transition-colors ${
                    mapLayer === layer
                      ? "bg-indigo-950 text-white"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {layer}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-400">Ward Filter: All Wards</span>
          </div>

          <NagpurMap caption={`Showing: ${mapLayer}`} markers={COMMAND_LAYER_MARKERS[mapLayer]} />
        </div>

        {/* Proactive alerts feed */}
        <div className="bg-white rounded-[22px] p-5" style={{ boxShadow: CARD_SHADOW }}>
          <div className="flex items-center justify-between mb-4">
            <div className="font-bold text-slate-900" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
              Proactive Alerts
            </div>
            <Badge tone="blue">{visibleAlerts.length} New</Badge>
          </div>

          <div className="space-y-2.5">
            {visibleAlerts.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">No active alerts.</p>
            )}
            {visibleAlerts.map((alert) => {
              const tone =
                alert.level === "CRITICAL" ? "red" :
                alert.level === "WARNING"  ? "amber" : "slate";

              const borderColour =
                alert.level === "CRITICAL" ? "border-red-200" :
                alert.level === "WARNING"  ? "border-amber-200" : "border-slate-100";

              return (
                <div key={alert.id} className={`border ${borderColour} rounded-2xl p-3.5`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <Badge tone={tone}>{alert.level} · {alert.ward.toUpperCase()}</Badge>
                    <span className="text-[11px] text-slate-400">{alert.conf}% Conf.</span>
                  </div>

                  <p className="text-[13px] text-slate-500 mb-2.5">{alert.text}</p>

                  <div className="flex gap-2">
                    {/* Only the Ambazari alert has a full detail payload to open */}
                    <button
                      onClick={() => alert.rain && onOpenAlert(alert)}
                      className="text-xs font-bold bg-indigo-950 text-white px-3.5 py-1.5 rounded-[9px] hover:bg-indigo-900"
                    >
                      ASSIGN
                    </button>
                    <button
                      onClick={() => setDismissedAlerts((cur) => [...cur, alert.id])}
                      className="text-xs font-bold border border-slate-200 text-slate-500 bg-white px-3.5 py-1.5 rounded-[9px] hover:bg-slate-50"
                    >
                      DISMISS
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 text-center mt-6">
        Demo data — representative, not live PII.
      </p>
    </div>
  );
}


/* ────────────────────── SECTION 6: ALERT DETAIL MODAL ────────────────────── */

function AlertDetailModal({ alert, onClose, onIssueAdvisory }) {
  // Hook must run every render regardless of `alert`, so it's called before
  // the early return below (real precipitation forecast for Nagpur, falls
  // back to the alert's seeded rain data if the live fetch fails).
  const rainState = useLive(fetchRainForecast, alert?.rain ?? [], alert?.id);
  const [assigned, setAssigned] = useState(false);
  useEffect(() => { setAssigned(false); }, [alert?.id]);

  if (!alert) return null;   // nothing selected → render nothing

  const rain = rainState.data;
  const peakBucket = rain.length ? rain.reduce((max, r) => (r.v > max.v ? r : max), rain[0]) : { t: "36h", v: 0 };

  return (
    <div className="fixed inset-0 bg-[#0a0a10]/60 flex items-center justify-center z-[1100] p-6">
      <div
        className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: "0 40px 80px -20px rgba(0,0,0,.35)" }}
      >
        {/* Red header — signals criticality immediately */}
        <div className="bg-red-600 text-white px-7 py-5 rounded-t-3xl flex items-start justify-between">
          <div>
            <div className="font-extrabold text-[17px]" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
              ALERT DETAIL: AMBAZARI FLOOD RISK (CRITICAL)
            </div>
            <div className="text-xs opacity-90 mt-1">
              Ward ID: {alert.wardId} &nbsp;|&nbsp; Priority: {alert.priority} &nbsp;|&nbsp; Status: {assigned ? "Assigned" : alert.status}
            </div>
          </div>
          <button onClick={onClose} className="text-2xl leading-none hover:opacity-70">×</button>
        </div>

        <div className="p-7 grid grid-cols-2 gap-7">

          {/* LEFT COLUMN — the reasoning behind the prediction */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 mb-2 flex items-center gap-2">
              WEATHER INTELLIGENCE
              {rainState.live ? (
                <span className="text-emerald-600 font-bold">● LIVE · Open-Meteo</span>
              ) : (
                <span className="text-slate-300 font-semibold">demo data</span>
              )}
            </div>
            <div className="bg-[#f7f7f9] rounded-2xl p-4">
              <div className="text-[30px] font-extrabold text-indigo-950" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
                {peakBucket.v}mm
              </div>
              <div className="text-xs text-slate-400 mb-3">
                {rainState.live
                  ? `Live forecast, heaviest in the ${peakBucket.t} window`
                  : "Forecasted in 36h"}
              </div>
              <BarChart
                data={rain}
                height={100}
                highlightMax
                labels={rain.map((r) => r.t)}
              />
            </div>

            {/* This is the credibility moment — the model isn't guessing, it's
                pattern-matching against a real historical event. */}
            <div className="text-[11px] font-bold text-slate-400 mt-4 mb-2">HISTORICAL CONTEXT</div>
            <div className="bg-[#f7f7f9] border-l-[3px] border-indigo-600 rounded-r-xl p-3 text-sm text-slate-700 leading-relaxed">
              <strong>92% Confidence Score:</strong> {alert.history}
            </div>

            <div className="text-[11px] font-bold text-slate-400 mt-4 mb-2">
              ASSET STATUS: OPEN COMPLAINTS (14)
            </div>
            <div className="space-y-1.5">
              {alert.complaints.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm bg-[#f7f7f9] rounded-lg px-3 py-2">
                  <span>{c.id}: {c.text}</span>
                  <Badge tone={
                    c.sev === "Critical" ? "red" :
                    c.sev === "Warning"  ? "amber" : "slate"
                  }>
                    {c.sev}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT COLUMN — what the officer can actually do about it */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 mb-2">WHERE THIS IS HAPPENING</div>
            <NagpurMap
              caption="Ambazari, Nagpur"
              height={220}
              zoom={14}
              legend={false}
              markers={[{ ward: "ambazari", color: "#dc2626", label: "Ambazari — flood risk here", size: 18 }]}
            />

            <div className="text-[11px] font-bold text-slate-400 mt-4 mb-2">AVAILABLE FIELD TEAMS</div>
            <div className="flex gap-2 mb-4 flex-wrap">
              {alert.teams.map((team) => (
                <span key={team} className="flex items-center gap-1.5 text-xs border border-slate-200 rounded-[10px] px-3 py-1.5">
                  <span className="w-[7px] h-[7px] rounded-full bg-emerald-600" />
                  {team}
                </span>
              ))}
            </div>

            <button
              onClick={() => setAssigned(true)}
              disabled={assigned}
              className="w-full bg-indigo-950 text-white rounded-xl py-3 text-[13px] font-bold mb-2 hover:bg-indigo-900 disabled:opacity-50"
            >
              {assigned ? "✓ TEAM ASSIGNED" : <>➤ &nbsp;ASSIGN RAPID RESPONSE TEAM</>}
            </button>

            {/* Jumps the user to the Advisory screen — this is the
                "prediction becomes citizen warning" handoff. */}
            <button
              onClick={onIssueAdvisory}
              className="w-full border border-indigo-950 text-indigo-950 rounded-xl py-3 text-[13px] font-bold hover:bg-indigo-50"
            >
              📢 &nbsp;ISSUE PUBLIC ADVISORY
            </button>
          </div>
        </div>

        <div className="px-7 pb-7 flex justify-end">
          <button
            onClick={onClose}
            className="border border-slate-300 text-slate-500 bg-white rounded-[10px] px-4 py-2.5 text-[13px] hover:bg-slate-50"
          >
            CLOSE DETAIL
          </button>
        </div>
      </div>
    </div>
  );
}


/* ───────────────────── SECTION 7: GRIEVANCE TRIAGE SCREEN ────────────────── */

// Maps the sla field to [badge tone, human label]
const SLA_DISPLAY = {
  safe:     ["green", "Safe"],
  risk:     ["amber", "At Risk"],
  breached: ["red",   "Breached"],
};

// Small status dot shown before the ID in the triage list — a decision
// made at a glance, without reading the whole row.
const STATUS_DOT = {
  approved:   "bg-emerald-500",
  escalated:  "bg-amber-500",
  reassigned: "bg-red-500",
};

function GrievanceTriage({ session, isOfficer, isBlocked, onOpenAuth }) {
  const [grievances, setGrievances] = useState(GRIEVANCES);
  const [live, setLive] = useState(false);
  const [selectedId, setSelectedId] = useState(GRIEVANCES[0].id);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ text: "", en: "", ward: "", lang: "English" });
  const [submitting, setSubmitting] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [slaFilter, setSlaFilter] = useState("All");
  const [deptFilter, setDeptFilter] = useState("All Departments");
  const [wardFilter, setWardFilter] = useState("All Wards");

  const loadGrievances = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("grievances")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data && data.length) {
      const mapped = data.map((g) => ({
        ...g,
        id: `#GR-${String(g.id).padStart(4, "0")}`,
        rawId: g.id,
      }));
      setGrievances(mapped);
      setLive(true);
      setSelectedId((cur) => (mapped.some((g) => g.id === cur) ? cur : mapped[0].id));
    }
  };

  useEffect(() => { loadGrievances(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const selected = grievances.find((g) => g.id === selectedId) || grievances[0];

  const departments = ["All Departments", ...new Set(grievances.map((g) => g.dept).filter(Boolean))];
  const wards = ["All Wards", ...new Set(grievances.map((g) => g.ward).filter(Boolean))];

  const filteredGrievances = grievances.filter((g) => {
    if (slaFilter === "At Risk" && g.sla !== "risk") return false;
    if (slaFilter === "Breached" && g.sla !== "breached") return false;
    if (deptFilter !== "All Departments" && g.dept !== deptFilter) return false;
    if (wardFilter !== "All Wards" && g.ward !== wardFilter) return false;
    return true;
  });

  const submitGrievance = async (e) => {
    e.preventDefault();
    if (!supabase || !form.text.trim() || isBlocked) return;
    setSubmitting(true);

    // Ask the AI classifier for a department guess + confidence + a
    // translation, if the citizen didn't already provide one. Never blocks
    // the submission — on any failure it's just left PENDING REVIEW for an
    // officer, same as before this existed.
    const ai = await classifyGrievance(form.text);

    const { error } = await supabase.from("grievances").insert({
      text: form.text.trim(),
      en: form.en.trim() || ai?.english || null,
      ward: form.ward.trim() || null,
      lang: form.lang,
      dept: ai?.department || "PENDING REVIEW",
      conf: ai?.confidence ?? null,
      user_id: session?.user?.id ?? null,
    });
    setSubmitting(false);
    if (!error) {
      setForm({ text: "", en: "", ward: "", lang: "English" });
      setShowForm(false);
      await loadGrievances();
    }
  };

  const triageAction = async (status) => {
    if (!supabase || !session || !selected?.rawId) return;
    setActionBusy(true);
    setActionError("");
    const { error } = await supabase.from("grievances").update({ status }).eq("id", selected.rawId);
    if (error) {
      setActionError(error.message);
    } else {
      // Reflect the change immediately instead of waiting on the refetch,
      // so the click visibly does something even if the refetch is slow.
      setGrievances((cur) => cur.map((g) => (g.id === selectedId ? { ...g, status } : g)));

      // Jump to the next pending grievance so the officer can keep
      // triaging without clicking back into the list every time.
      const isPending = (g) => (g.status === "new" || !g.status) && g.id !== selectedId;
      const curIndex = filteredGrievances.findIndex((g) => g.id === selectedId);
      const next =
        filteredGrievances.slice(curIndex + 1).find(isPending) ??
        filteredGrievances.find(isPending);
      if (next) setSelectedId(next.id);

      await loadGrievances();
    }
    setActionBusy(false);
  };

  const deleteGrievance = async () => {
    if (!supabase || !session || !isOfficer || !selected?.rawId) return;
    if (!window.confirm(`Delete ${selected.id} permanently? This can't be undone.`)) return;
    setActionBusy(true);
    setActionError("");
    const { error } = await supabase.from("grievances").delete().eq("id", selected.rawId);
    if (error) {
      setActionError(error.message);
    } else {
      const remaining = filteredGrievances.filter((g) => g.id !== selectedId);
      if (remaining.length) setSelectedId(remaining[0].id);
      await loadGrievances();
    }
    setActionBusy(false);
  };

  return (
    <div className="grid grid-cols-3 gap-7">

      {/* LEFT — the inbox table */}
      <div className="col-span-2">
        <div className="flex items-start justify-between mb-1">
          <div>
            <div className="text-xs font-bold tracking-[0.12em] text-indigo-600 mb-2">CITIZEN GRIEVANCES</div>
            <h1 className="text-[28px] font-extrabold text-slate-900" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
              Triage Inbox
            </h1>
            <p className="text-sm text-slate-400">
              Complaints from citizens. The AI reads each one and guesses which department
              should handle it — an officer checks and approves before anything happens.
              {live ? (
                <span className="text-emerald-600 font-bold"> ● LIVE · Supabase</span>
              ) : (
                <span className="text-slate-300 font-semibold"> demo data</span>
              )}
            </p>
          </div>
          {supabase && (
            session && isBlocked ? (
              <div className="text-xs font-bold text-red-600 border border-red-200 bg-red-50 px-3.5 py-2 rounded-[10px] whitespace-nowrap">
                Your account is blocked from submitting grievances
              </div>
            ) : (
              <button
                onClick={() => {
                  if (!session) { onOpenAuth?.(); return; }
                  setShowForm((v) => !v);
                }}
                className="text-xs font-bold bg-indigo-950 text-white px-3.5 py-2 rounded-[10px] hover:bg-indigo-900 whitespace-nowrap"
              >
                + New Grievance
              </button>
            )
          )}
        </div>

        {showForm && (
          <form onSubmit={submitGrievance} className="bg-white rounded-2xl p-4 my-4 space-y-2.5" style={{ boxShadow: CARD_SHADOW }}>
            <div className="text-[11px] font-bold text-slate-400">
              CITIZEN INTAKE — submits directly into the live triage inbox
            </div>
            <textarea
              required
              placeholder="Describe the issue, in any language..."
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              className="w-full border border-slate-200 rounded-xl p-2.5 text-sm h-20"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                placeholder="English translation (optional)"
                value={form.en}
                onChange={(e) => setForm({ ...form, en: e.target.value })}
                className="col-span-2 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
              />
              <select
                value={form.lang}
                onChange={(e) => setForm({ ...form, lang: e.target.value })}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs"
              >
                <option>English</option>
                <option>मराठी</option>
                <option>हिंदी</option>
              </select>
            </div>
            <input
              placeholder="Ward"
              value={form.ward}
              onChange={(e) => setForm({ ...form, ward: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-indigo-950 text-white rounded-lg py-2 text-xs font-bold disabled:opacity-50"
              >
                {submitting ? "AI is reading it…" : "Submit Grievance"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-xs text-slate-400 px-3">
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="flex gap-2 mb-4 mt-4 items-center">
          {["All", "At Risk", "Breached"].map((filter) => (
            <button
              key={filter}
              onClick={() => setSlaFilter(filter)}
              className={`text-xs font-bold px-3.5 py-1.5 rounded-[10px] ${
                slaFilter === filter
                  ? "bg-indigo-950 text-white"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {filter.toUpperCase()}
            </button>
          ))}

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-[10px] px-2.5 py-1.5 ml-auto text-slate-500"
          >
            {departments.map((d) => <option key={d}>{d}</option>)}
          </select>
          <select
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-[10px] px-2.5 py-1.5 text-slate-500"
          >
            {wards.map((w) => <option key={w}>{w}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-[18px] overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
          {/* Column headers */}
          <div className="grid grid-cols-[90px_1fr_130px_60px_90px] px-[18px] py-3 text-[11px] font-bold text-slate-400 border-b border-slate-50">
            <span>ID</span>
            <span>COMPLAINT TEXT</span>
            <span>AI PREDICTION</span>
            <span>CONF.</span>
            <span>SLA</span>
          </div>

          {/* Rows — clicking one loads it into the detail panel on the right */}
          {filteredGrievances.map((g) => {
            const [tone, label] = SLA_DISPLAY[g.sla] ?? SLA_DISPLAY.safe;

            return (
              <button
                key={g.id}
                onClick={() => { setSelectedId(g.id); setActionError(""); }}
                className={`w-full text-left grid grid-cols-[90px_1fr_130px_60px_90px] px-[18px] py-3.5 border-b border-slate-50 items-center transition-colors ${
                  selectedId === g.id ? "bg-indigo-50/70" : "hover:bg-slate-50"
                }`}
              >
                <span className="text-xs font-mono text-indigo-600 flex items-center gap-1.5">
                  {STATUS_DOT[g.status] && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[g.status]}`} />}
                  {g.id}
                </span>
                <span>
                  {/* Original language first, translation underneath —
                      this ordering is deliberate: the citizen's own words lead. */}
                  <div className="text-sm text-slate-800">{g.text}</div>
                  <div className="text-xs text-slate-400">{g.en}</div>
                </span>
                <span><Badge>{g.dept}</Badge></span>
                <span className="text-xs text-slate-400">{g.conf != null ? `${g.conf}%` : "—"}</span>
                <span><Badge tone={tone}>{label}</Badge></span>
              </button>
            );
          })}
          {filteredGrievances.length === 0 && (
            <div className="px-[18px] py-8 text-sm text-slate-400 text-center">
              No grievances match this filter.
            </div>
          )}
        </div>

        <div className="text-xs text-slate-400 mt-3">
          {live
            ? `Showing ${filteredGrievances.length} of ${grievances.length} live grievances`
            : `Showing ${filteredGrievances.length} of ${grievances.length} demo grievances`}
        </div>
      </div>

      {/* RIGHT — detail panel for the selected complaint */}
      <div className="bg-white rounded-[18px] p-[22px] h-fit" style={{ boxShadow: CARD_SHADOW }}>
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-sm font-bold text-indigo-600">{selected.id}</span>
          <Badge tone="blue">{selected.status ? selected.status.toUpperCase() : "TRIAGE"}</Badge>
        </div>
        <div className="text-xs text-slate-400 mb-4">
          {selected.created_at
            ? `Submitted ${new Date(selected.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
            : "Submitted 2 hours ago"}
        </div>

        <div className="text-[11px] font-bold text-slate-400 mb-1">CITIZEN REPORT</div>
        <div className="bg-[#f7f7f9] rounded-xl p-3 mb-2">
          <div className="text-sm font-medium">"{selected.text}"</div>
          {selected.en && <div className="text-xs text-slate-400 mt-1">🌐 "{selected.en}"</div>}
        </div>
        <div className="text-xs text-slate-400 mb-4">
          📍 {selected.ward || "Ward pending"} &nbsp;·&nbsp; Anonymized Citizen
        </div>

        <div className="text-[11px] font-bold text-slate-400 mb-2">SYSTEM ANALYSIS</div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-[#f7f7f9] rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400">PREDICTED DEPT</div>
            <div className="text-sm font-bold">{selected.dept}</div>
          </div>
          <div className="bg-[#f7f7f9] rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400">CONFIDENCE</div>
            <div className="text-sm font-bold text-indigo-600">{selected.conf != null ? `${selected.conf}%` : "Pending triage"}</div>
          </div>
        </div>

        {selected.similar && (
          <>
            <div className="text-[11px] font-bold text-slate-400 mb-2">
              SIMILAR HISTORY (30 DAYS)
            </div>
            <div className="space-y-2 mb-4">
              {selected.similar.map((s) => (
                <div key={s.id} className="border border-slate-100 rounded-[10px] p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono">{s.id}</span>
                    <Badge tone="slate">{s.status}</Badge>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{s.text}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* The line that keeps this defensible in front of judges */}
        <p className="text-[11px] text-center text-slate-400 mb-3">
          AI recommends. Officer decides.
        </p>

        {actionError && (
          <p className="text-[11px] text-center text-red-600 mb-2">
            Couldn't save: {actionError}
          </p>
        )}

        {live && !session && (
          <p className="text-[11px] text-center text-amber-600 mb-2">
            Sign in as an officer (top right) to approve, reassign, or escalate.
          </p>
        )}

        <button
          onClick={() => triageAction("approved")}
          disabled={live && (!session || actionBusy)}
          className="w-full bg-indigo-950 text-white rounded-xl py-2.5 text-[13px] font-bold mb-2 hover:bg-indigo-900 disabled:opacity-40"
        >
          ✓ &nbsp;APPROVE &amp; ASSIGN
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => triageAction("reassigned")}
            disabled={live && (!session || actionBusy)}
            className="flex-1 border border-slate-200 text-slate-500 bg-white rounded-xl py-2 text-xs font-bold hover:bg-slate-50 disabled:opacity-40"
          >
            ↻ REASSIGN
          </button>
          <button
            onClick={() => triageAction("escalated")}
            disabled={live && (!session || actionBusy)}
            className="flex-1 border border-red-200 text-red-600 bg-white rounded-xl py-2 text-xs font-bold hover:bg-red-50 disabled:opacity-40"
          >
            ↗ ESCALATE
          </button>
        </div>

        {isOfficer && (
          <button
            onClick={deleteGrievance}
            disabled={actionBusy}
            className="w-full text-red-500 text-[11px] font-bold py-2 mt-2 hover:text-red-700 disabled:opacity-40"
          >
            🗑 Delete Grievance
          </button>
        )}
      </div>
    </div>
  );
}


/* ─────────────────── SECTION 8: HOTSPOTS & FORECAST SCREEN ───────────────── */

function HotspotForecast() {
  const aqiState = useLive(fetchAQI, { pm10: null, aqi: null });
  const trendState = useLive(fetchGrievanceTrend, FORECAST);

  return (
    <div>
      <ScreenHeader
        eyebrow="PREDICTIVE ANALYTICS"
        title="Hotspots & Forecast"
        subtitle="Where problems are clustering, and where complaint volume is headed next."
        badge={
          (aqiState.live || trendState.live) && (
            <Badge tone="green">● LIVE DATA</Badge>
          )
        }
      />
      <div className="grid grid-cols-2 gap-6 mb-6">

        {/* Spatial clusters */}
        <div className="bg-white rounded-[20px] p-5" style={{ boxShadow: CARD_SHADOW }}>
          <div className="font-bold text-slate-900 mb-3" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
            Where Problems Are
          </div>
          <NagpurMap
            markers={[
              { ward: "dharampeth", color: "#f43f5e", label: "Dharampeth — 412 complaints", size: 16 },
              { ward: "sitabuldi", color: "#f59e0b", label: "Sitabuldi — 185 complaints", size: 13 },
              { ward: "mahal", color: "#6366f1", label: "Mahal — 89 complaints", size: 10 },
            ]}
          />
        </div>

        {/* Two stacked charts */}
        <div className="space-y-6">
          <div className="bg-white rounded-[20px] p-5" style={{ boxShadow: CARD_SHADOW }}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-slate-900" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
                Complaint Volume Forecast
              </div>
              <div className="text-[11px]">
                {trendState.live ? (
                  <span className="text-emerald-600 font-bold">● LIVE trend, real grievances</span>
                ) : (
                  <span className="text-slate-400">demo data</span>
                )}
              </div>
            </div>
            <LineChart data={trendState.data} height={150} />
          </div>

          <div className="bg-white rounded-[20px] p-5" style={{ boxShadow: CARD_SHADOW }}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-slate-900" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
                PM10 Air Quality Levels
              </div>
              <div className="flex items-center gap-2">
                {aqiState.live && aqiState.data.pm10 != null && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    ● LIVE PM10: {aqiState.data.pm10} µg/m³
                  </span>
                )}
                <div className="text-[11px] text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                  Threshold: 60 µg/m³
                </div>
              </div>
            </div>
            <div className="text-[10px] text-slate-300 mb-1">
              30-day trend below is representative demo data{aqiState.live ? " — live current reading above" : ""}.
            </div>
            {aqiState.live && aqiState.data.pm10 != null && (
              <div className="mb-2 -mt-1">
                <Gauge
                  value={Math.round((aqiState.data.pm10 / 60) * 100)}
                  color={aqiState.data.pm10 > 60 ? "#dc2626" : "#4338ca"}
                />
                <div className="text-center text-[11px] text-slate-400 -mt-2">% of NCAP threshold, live</div>
              </div>
            )}
            <BarChart
              data={PM10}
              height={150}
              threshold={60}
              labels={PM10.filter((_, i) => i % 3 === 0).map((p) => p.d)}
            />
          </div>
        </div>
      </div>

      {/* Recommended interventions — turns analysis into a decision */}
      <div>
        <div className="font-bold text-slate-900 mb-3.5" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
          ⚡ Tactical Interventions
        </div>
        <div className="grid grid-cols-3 gap-4">
          {INTERVENTIONS.map((c) => (
            <div
              key={c.ward}
              className="bg-white rounded-[18px] p-5 transition-transform duration-300 ease-out hover:-translate-y-1"
              style={{ boxShadow: CARD_SHADOW }}
            >
              <Badge>{c.ward.toUpperCase()}</Badge>
              <div className="font-bold text-slate-900 mt-2.5" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
                {c.title}
              </div>
              <p className="text-[13px] text-slate-400 mt-1 mb-3">{c.desc}</p>
              <div className="text-[10px] font-bold text-slate-400">EXPECTED IMPACT</div>
              <div className="text-[13px] text-slate-600">{c.impact}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


/* ────────────────────── SECTION 9: ADVISORY COMPOSER ─────────────────────── */

const ADVISORY_APPROVAL_STEPS = [
  { label: "Drafted by",     who: "Officer K. Deshmukh" },
  { label: "Verified by",    who: "Chief Engineer" },
  { label: "Final Approval", who: "Commissioner" },
];

function Advisory() {
  const [lang, setLang] = useState("English");
  const [severity, setSeverity] = useState("Critical");
  const [wards, setWards] = useState(["Ambazari", "Sitabuldi", "Gandhibagh"]);
  const [approvedSteps, setApprovedSteps] = useState(1); // "Drafted by" starts done

  const addWard = () => {
    const w = window.prompt("Add a ward to target:");
    if (w && w.trim() && !wards.includes(w.trim())) setWards((cur) => [...cur, w.trim()]);
  };
  const removeWard = (w) => setWards((cur) => cur.filter((x) => x !== w));
  const requestVerification = () => setApprovedSteps((n) => Math.min(n + 1, ADVISORY_APPROVAL_STEPS.length));

  return (
    <div className="grid grid-cols-3 gap-7">

      {/* LEFT — the composer form */}
      <div className="col-span-2">
        <div className="text-xs text-slate-400 mb-1">Advisories &gt; New Composer</div>
        <h1 className="text-[28px] font-extrabold text-slate-900 mb-6" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
          Advisory Composer
        </h1>

        <div className="text-[11px] font-bold text-slate-400 mb-2">SOURCE ALERT / TRIGGER</div>
        <div className="border border-slate-200 rounded-2xl px-4 py-3 mb-5 text-sm">
          Ambazari Flood Risk (Predicted)
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <div className="text-[11px] font-bold text-slate-400 mb-2">SEVERITY LEVEL</div>
            <div className="flex gap-2">
              {["Info", "Warning", "Critical"].map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={`text-xs font-bold px-3.5 py-1.5 rounded-[10px] border transition-colors ${
                    severity === s
                      ? "bg-red-50 text-red-600 border-red-200"
                      : "border-slate-200 text-slate-400 hover:bg-slate-50"
                  }`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate-400 mb-2">ACTIVE WINDOW</div>
            <div className="border border-slate-200 rounded-[10px] px-3 py-2 text-xs text-slate-400">
              10/24/2023 6:00 PM &nbsp;–&nbsp; 10/26/2023
            </div>
          </div>
        </div>

        <div className="text-[11px] font-bold text-slate-400 mb-2">AFFECTED WARDS (TARGETING)</div>
        <div className="flex gap-2 mb-5 flex-wrap items-center">
          {wards.map((w) => (
            <button
              key={w}
              onClick={() => removeWard(w)}
              className="bg-[#eef0fd] text-[#3730a3] text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-[#e0e3fb]"
            >
              {w} ✕
            </button>
          ))}
          <button onClick={addWard} className="text-xs text-slate-400 hover:text-slate-600">⊕ Add Ward</button>
        </div>

        <div className="text-[11px] font-bold text-slate-400 mb-2">DISTRIBUTION CHANNELS</div>
        <div className="flex gap-4 mb-5 text-[13px] text-slate-600 flex-wrap">
          {["SMS (Priority)", "WhatsApp API", "NMC App Push", "Public Display Boards"].map((c) => (
            <label key={c} className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-indigo-600" />
              {c}
            </label>
          ))}
        </div>

        {/* Language tabs actually swap the message body */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-bold text-slate-400">🗣 MULTILINGUAL MESSAGE PAYLOAD</div>
          <div className="flex gap-3 text-xs">
            {["English", "मराठी", "हिंदी"].map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={lang === l ? "font-bold text-indigo-600" : "text-slate-400 hover:text-slate-600"}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <textarea
          key={lang}                              // remount so the new text shows
          className="w-full border border-slate-200 rounded-2xl p-3.5 text-sm text-slate-700 h-24"
          defaultValue={ADVISORY_MESSAGES[lang]}
        />
        <div className="text-[11px] text-slate-400 mt-1">
          👥 47,000 residents &nbsp;·&nbsp; 💬 1/2 segments
        </div>
      </div>

      {/* RIGHT — preview + approval chain */}
      <div>
        <div className="text-[11px] font-bold text-slate-400 mb-2">CITIZEN PREVIEW</div>
        <div className="bg-gradient-to-b from-[#1e2233] to-[#12141c] rounded-[22px] p-[18px] mb-6">
          <div className="text-white text-center mb-3">
            <div className="text-2xl font-light">10:42</div>
            <div className="text-[10px] opacity-70">Tuesday, Oct 24</div>
          </div>
          <div className="bg-white/[.08] rounded-xl p-3">
            <div className="text-white text-xs font-bold mb-1">🔔 NMC ALERTS · now</div>
            <div className="text-slate-300 text-xs leading-relaxed">
              {ADVISORY_MESSAGES[lang].slice(0, 95)}...
            </div>
          </div>
        </div>

        {/* Human approval chain — nothing goes out automatically */}
        <div className="text-[11px] font-bold text-slate-400 mb-3">DISPATCH AUTHORIZATION</div>
        <div className="space-y-3 mb-6">
          {ADVISORY_APPROVAL_STEPS.map((step, i) => {
            const done = i < approvedSteps;
            return (
              <div key={i} className="flex items-center gap-2.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] ${
                  done ? "bg-indigo-950" : "border border-slate-300"
                }`}>
                  {done && "✓"}
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">{step.label}</div>
                  <div className="text-[13px] font-semibold text-slate-700">
                    {step.who}{!done && " (Pending)"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={requestVerification}
          disabled={approvedSteps >= ADVISORY_APPROVAL_STEPS.length}
          className="w-full bg-indigo-950 text-white rounded-xl py-3 text-[13px] font-bold hover:bg-indigo-900 disabled:opacity-50"
        >
          {approvedSteps >= ADVISORY_APPROVAL_STEPS.length ? "✓ FULLY APPROVED" : <>➤ &nbsp;REQUEST VERIFICATION</>}
        </button>
      </div>
    </div>
  );
}


/* ───────────────────── SECTION 10: FIELD TEAMS SCREEN ────────────────────── */

const TEAM_STATUS_DISPLAY = {
  available:   ["green", "AVAILABLE"],
  in_progress: ["blue",  "IN PROGRESS"],
  unavailable: ["slate", "UNAVAILABLE"],
};

function AddTeamModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [task, setTask] = useState("");
  const [loc, setLoc] = useState("");
  const [eta, setEta] = useState("");
  const [status, setStatus] = useState("available");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    const err = await onAdd({
      name: name.trim(),
      task: task.trim() || null,
      loc: loc.trim() || null,
      eta: eta.trim() || null,
      status,
    });
    setBusy(false);
    if (err) setError(err);
    else onClose();
  };

  return (
    <div className="fixed inset-0 bg-[#0a0a10]/60 flex items-center justify-center z-[1100] p-6" onClick={onClose}>
      <div
        className="bg-white rounded-3xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: "0 40px 80px -20px rgba(0,0,0,.35)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="font-extrabold text-lg" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
            Add a Team
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-slate-400 hover:text-slate-600">×</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            value={name} onChange={(e) => setName(e.target.value)} placeholder="Team name, e.g. RRT-Bravo" required
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={status} onChange={(e) => setStatus(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="available">Available</option>
            <option value="in_progress">In Progress</option>
            <option value="unavailable">Unavailable</option>
          </select>
          <input
            value={task} onChange={(e) => setTask(e.target.value)} placeholder="Current task (optional)"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Location / ward (optional)"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={eta} onChange={(e) => setEta(e.target.value)} placeholder="ETA, e.g. 12m (optional)"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
          {error && <div className="text-xs text-red-600">{error}</div>}
          <button type="submit" disabled={busy} className="w-full bg-indigo-950 text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-50">
            {busy ? "Adding…" : "Add Team"}
          </button>
        </form>
      </div>
    </div>
  );
}

function FieldTeams({ session, onOpenAuth }) {
  const [teams, setTeams] = useState(TEAMS);
  const [live, setLive] = useState(false);
  const [active, setActive] = useState(TEAMS[0]);
  const [dispatched, setDispatched] = useState(false);
  const [showAddTeam, setShowAddTeam] = useState(false);

  const loadTeams = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("teams").select("*").order("created_at", { ascending: false });
    if (!error && data && data.length) {
      const mapped = data.map((t) => ({ ...t, history: t.history || [] }));
      setTeams(mapped);
      setLive(true);
      setActive((cur) => (mapped.some((t) => t.id === cur?.id) ? cur : mapped[0]));
    }
  };

  useEffect(() => { loadTeams(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const addTeam = async (team) => {
    if (!supabase) return "Backend not configured.";
    if (!session) return "Sign in as an officer to add a team.";
    const { error } = await supabase.from("teams").insert(team);
    if (error) return error.message;
    await loadTeams();
    return null;
  };

  const total = teams.length;
  const available = teams.filter((t) => t.status === "available").length;
  const inProgress = teams.filter((t) => t.status === "in_progress" || t.status === "ON SITE" || t.status === "EN ROUTE").length;
  const unavailable = teams.filter((t) => t.status === "unavailable").length;

  return (
    <div>
      <ScreenHeader
        eyebrow="LIVE DEPLOYMENT"
        title="Field Teams"
        subtitle="Where crews are right now, and what's still waiting to be assigned."
        badge={live ? <Badge tone="green">● LIVE</Badge> : <Badge tone="slate">demo data</Badge>}
        action={
          <button
            onClick={() => (session ? setShowAddTeam(true) : onOpenAuth())}
            className="text-xs font-bold bg-indigo-950 text-white px-3.5 py-2 rounded-[10px] hover:bg-indigo-900"
          >
            + Add Team
          </button>
        }
      />
      <div className="grid grid-cols-4 gap-5 mb-6">
        <StatCard label="Total Teams" value={total} tone="neutral" />
        <StatCard label="Available" value={available} tone="down" />
        <StatCard label="In Progress" value={inProgress} tone="neutral" />
        <StatCard label="Unavailable" value={unavailable} tone="up" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-[20px] p-5" style={{ boxShadow: CARD_SHADOW }}>
            <NagpurMap
              height={260}
              markers={[
                { ward: "ambazari", color: "#6366f1", label: "RRT-Alpha — on site, Ambazari", size: 16 },
                { ward: "sitabuldi", color: "#6366f1", label: "Drain-Unit 4 — on the way, Sitabuldi", size: 13 },
              ]}
            />
          </div>

          {/* Timeline for whichever crew is selected on the right */}
          <div className="bg-white rounded-[20px] p-5" style={{ boxShadow: CARD_SHADOW }}>
            <div className="font-bold text-slate-900 mb-3.5" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
              🕘 {active?.name} Operational History
            </div>
            <div className="flex gap-6">
              <div className="flex-1 space-y-2.5">
                {(active?.history || []).length === 0 && (
                  <div className="text-sm text-slate-400">No history recorded for this team yet.</div>
                )}
                {(active?.history || []).map((h, i) => (
                  <div key={i} className="flex gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                      h.done ? "bg-indigo-950" : "border-2 border-slate-300"
                    }`} />
                    <div>
                      <div className="text-xs text-slate-400">{h.t}</div>
                      <div className={`text-sm ${h.done ? "font-semibold text-slate-800" : "text-slate-500"}`}>
                        {h.label}
                      </div>
                      {h.done && (
                        <div className="text-xs text-slate-400">
                          Status flagged green. Ready for reassignment.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Photo verification — closes the loop on "was it actually fixed?" */}
              <div className="w-32 border border-slate-200 rounded-xl p-2 h-fit">
                <div className="text-[10px] text-slate-400 mb-1">Evidence</div>
                <div className="bg-slate-100 rounded-lg h-20 flex items-center justify-center text-2xl">
                  📷
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right rail — crew list + the unassigned predicted task */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-bold text-slate-900" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
              Team Roster
            </div>
            <Badge tone="blue">{total} Total</Badge>
          </div>

          {teams.map((t) => {
            const [tone, label] = TEAM_STATUS_DISPLAY[t.status] ?? [t.status === "ON SITE" ? "blue" : "amber", t.status];
            return (
              <button
                key={t.id ?? t.name}
                onClick={() => setActive(t)}
                className={`w-full text-left border rounded-2xl p-3.5 transition-colors ${
                  active?.name === t.name
                    ? "border-indigo-200 bg-indigo-50/70"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-slate-900">{t.name}</span>
                  <Badge tone={tone}>{label}</Badge>
                </div>
                {t.task && <div className="text-xs text-slate-400">Task: {t.task}</div>}
                {t.loc && <div className="text-xs text-slate-400">Loc: {t.loc}</div>}
                {t.eta && <div className="text-[11px] text-slate-400 mt-1">⏱ Time: {t.eta}</div>}
              </button>
            );
          })}
          {teams.length === 0 && (
            <div className="text-sm text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-2xl">
              No teams yet. Add one to get started.
            </div>
          )}

          {/* The proactive payoff: a task created by a prediction,
              not by a citizen complaint. */}
          {!dispatched ? (
            <div className="border border-red-100 bg-red-50/60 rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 text-red-600 font-bold text-sm mb-2">
                ⚠ Critical Unassigned Task
              </div>
              <div className="font-bold text-sm text-slate-900">Predicted Waterlogging</div>
              <div className="text-xs text-slate-400 mb-3">📍 Ambazari Sector 9</div>

              <div className="bg-white rounded-xl p-2.5 border border-red-100">
                <div className="text-[10px] font-bold text-slate-400">SYSTEM SUGGESTION</div>
                <div className="text-sm font-bold text-indigo-600">Assign: Drain-Unit 2</div>
                <div className="text-xs text-slate-400 mb-2">🚚 4km away (Est. ETA 12m)</div>
                <button
                  onClick={() => setDispatched(true)}
                  className="w-full bg-indigo-950 text-white rounded-lg py-2 text-xs font-bold hover:bg-indigo-900"
                >
                  ➤ DISPATCH NOW
                </button>
              </div>
            </div>
          ) : (
            <div className="border border-emerald-100 bg-emerald-50/60 rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-sm">
                ✓ Drain-Unit 2 Dispatched
              </div>
              <div className="text-xs text-slate-500 mt-1">Heading to Ambazari Sector 9 · ETA 12m</div>
            </div>
          )}
        </div>
      </div>

      {showAddTeam && <AddTeamModal onClose={() => setShowAddTeam(false)} onAdd={addTeam} />}
    </div>
  );
}


/* ─────────────────── SECTION 10.5: OFFICER CONSOLE SCREEN ────────────────── */

function OfficerConsole({ session, isOfficer, onOpenAuth }) {
  const [grievances, setGrievances] = useState(GRIEVANCES);
  const [live, setLive] = useState(false);
  const [autoMode, setAutoMode] = useState(() => localStorage.getItem("nc-ai-auto-mode") === "1");
  const [threshold, setThreshold] = useState(90);
  const [autoLog, setAutoLog] = useState([]); // ids auto-approved this session
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [citizens, setCitizens] = useState([]);
  const [citizenBusyId, setCitizenBusyId] = useState(null);
  const [contentForm, setContentForm] = useState(SITE_CONTENT_DEFAULTS);
  const [contentSaving, setContentSaving] = useState(false);
  const [contentSaved, setContentSaved] = useState(false);

  const loadGrievances = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("grievances")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data && data.length) {
      const mapped = data.map((g) => ({
        ...g,
        id: `#GR-${String(g.id).padStart(4, "0")}`,
        rawId: g.id,
      }));
      setGrievances(mapped);
      setLive(true);
    }
  };

  const loadCitizens = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, blocked, created_at")
      .eq("role", "citizen")
      .order("created_at", { ascending: false });
    if (!error && data) setCitizens(data);
  };

  const toggleBlocked = async (citizen) => {
    if (!supabase || !session) return;
    setCitizenBusyId(citizen.id);
    const { error } = await supabase.from("profiles").update({ blocked: !citizen.blocked }).eq("id", citizen.id);
    if (!error) {
      setCitizens((cur) => cur.map((c) => (c.id === citizen.id ? { ...c, blocked: !c.blocked } : c)));
    }
    setCitizenBusyId(null);
  };

  useEffect(() => {
    loadGrievances();
    loadCitizens();
    fetchSiteContent().then((data) => setContentForm({ ...SITE_CONTENT_DEFAULTS, ...data }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { localStorage.setItem("nc-ai-auto-mode", autoMode ? "1" : "0"); }, [autoMode]);

  const saveSiteContent = async () => {
    if (!supabase || !session) return;
    setContentSaving(true);
    setContentSaved(false);
    const rows = Object.entries(contentForm).map(([key, value]) => ({ key, value }));
    const { error } = await supabase.from("site_content").upsert(rows, { onConflict: "key" });
    setContentSaving(false);
    if (!error) {
      setContentSaved(true);
      setTimeout(() => setContentSaved(false), 2000);
    }
  };

  // Auto-approves anything above the confidence threshold whenever the
  // pending list, toggle, or threshold changes — no separate polling loop.
  // Below the threshold always waits for the officer, no matter what.
  useEffect(() => {
    if (!autoMode || !live || !session || !supabase) return;
    const qualifying = grievances.filter(
      (g) => (g.status === "new" || !g.status) && g.conf != null && g.conf >= threshold
    );
    if (qualifying.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const g of qualifying) {
        const { error } = await supabase.from("grievances").update({ status: "approved" }).eq("id", g.rawId);
        if (!error && !cancelled) {
          setAutoLog((cur) => [{ id: g.id, dept: g.dept, conf: g.conf, at: Date.now() }, ...cur].slice(0, 20));
        }
      }
      if (!cancelled) await loadGrievances();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, threshold, live, session, grievances]);

  const decide = async (g, status) => {
    if (!supabase || !session) return;
    setBusyId(g.id);
    setActionError("");
    const { error } = await supabase.from("grievances").update({ status }).eq("id", g.rawId);
    if (error) {
      setActionError(error.message);
    } else {
      setGrievances((cur) => cur.map((x) => (x.id === g.id ? { ...x, status } : x)));
      await loadGrievances();
    }
    setBusyId(null);
  };

  const pending = grievances.filter((g) => g.status === "new" || !g.status);
  // When auto-triage is off, nothing gets auto-approved, so every pending
  // item needs a manual decision — only exclude the high-confidence ones
  // once auto-triage is actually on and handling them.
  const needsReview = pending.filter(
    (g) => !autoMode || !(g.conf != null && g.conf >= threshold)
  );

  if (!supabase) {
    return (
      <ScreenHeader
        eyebrow="OFFICER CONSOLE"
        title="Officer Console"
        subtitle="Backend not configured — connect Supabase to enable officer sign-in and AI-assisted decisions."
      />
    );
  }

  return (
    <div>
      <ScreenHeader
        eyebrow="OFFICER CONSOLE"
        title="Officer Console"
        subtitle="Sign in to review AI predictions. Turn on auto-triage to let high-confidence predictions get approved automatically — everything else still waits for you."
        badge={live ? <Badge tone="green">● LIVE</Badge> : <Badge tone="slate">demo data</Badge>}
      />

      {!session ? (
        <div className="bg-white rounded-[18px] p-8 text-center" style={{ boxShadow: CARD_SHADOW }}>
          <div className="text-sm text-slate-500 mb-4">Sign in as an officer to review and decide on grievances.</div>
          <button
            onClick={onOpenAuth}
            className="bg-indigo-950 text-white rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-indigo-900"
          >
            Login as Officer
          </button>
        </div>
      ) : !isOfficer ? (
        <div className="bg-white rounded-[18px] p-8 text-center" style={{ boxShadow: CARD_SHADOW }}>
          <div className="text-sm text-slate-500">
            This account isn't an officer account. Sign out and use "Login as Officer" with an officer account.
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-[18px] p-5 mb-6 flex items-start justify-between gap-6 flex-wrap" style={{ boxShadow: CARD_SHADOW }}>
            <div>
              <div className="text-sm font-bold text-slate-900 mb-0.5">AI Auto-Triage</div>
              <div className="text-xs text-slate-400 max-w-md">
                When on, grievances the AI is at least {threshold}% confident about are approved
                automatically. Everything below that always waits for you.
              </div>
            </div>
            <div className="flex items-center gap-4 pt-0.5">
              <label className="flex items-center gap-2 text-xs text-slate-500">
                Threshold
                <input
                  type="range"
                  min="70"
                  max="99"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-28 accent-indigo-600"
                />
                <span className="font-bold text-indigo-600 w-9">{threshold}%</span>
              </label>
              <button
                onClick={() => setAutoMode((v) => !v)}
                aria-pressed={autoMode}
                className={`w-14 h-8 rounded-full relative transition-colors ${autoMode ? "bg-emerald-500" : "bg-slate-200"}`}
              >
                <span
                  className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform ${autoMode ? "translate-x-7" : "translate-x-1"}`}
                />
              </button>
            </div>
          </div>

          {actionError && (
            <div className="text-xs text-red-600 mb-4">Couldn't save: {actionError}</div>
          )}

          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-[11px] font-bold text-slate-400 mb-2">
                NEEDS YOUR DECISION ({needsReview.length})
              </div>
              <div className="space-y-2">
                {needsReview.map((g) => (
                  <div key={g.id} className="bg-white rounded-xl p-3.5" style={{ boxShadow: CARD_SHADOW }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs text-indigo-600">{g.id}</span>
                      <span className="text-xs text-slate-400">
                        {g.conf != null ? `${g.conf}% conf.` : "no AI read"}
                      </span>
                    </div>
                    <div className="text-sm text-slate-800 mb-0.5">{g.text}</div>
                    {g.en && <div className="text-xs text-slate-400 mb-2">{g.en}</div>}
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => decide(g, "approved")}
                        disabled={busyId === g.id}
                        className="flex-1 bg-indigo-950 text-white rounded-lg py-1.5 text-[11px] font-bold hover:bg-indigo-900 disabled:opacity-40"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => decide(g, "reassigned")}
                        disabled={busyId === g.id}
                        className="flex-1 border border-slate-200 text-slate-500 rounded-lg py-1.5 text-[11px] font-bold hover:bg-slate-50 disabled:opacity-40"
                      >
                        Reassign
                      </button>
                      <button
                        onClick={() => decide(g, "escalated")}
                        disabled={busyId === g.id}
                        className="flex-1 border border-red-200 text-red-600 rounded-lg py-1.5 text-[11px] font-bold hover:bg-red-50 disabled:opacity-40"
                      >
                        Escalate
                      </button>
                    </div>
                  </div>
                ))}
                {needsReview.length === 0 && (
                  <div className="text-sm text-slate-400 text-center py-8">Nothing waiting on you right now.</div>
                )}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-400 mb-2">
                AUTO-APPROVED BY AI ({autoLog.length}{!autoMode && " · auto-triage is off"})
              </div>
              <div className="space-y-2">
                {autoLog.map((entry) => (
                  <div key={entry.id + entry.at} className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs text-emerald-700">{entry.id}</span>
                      <span className="text-xs text-slate-500 ml-2">{entry.dept}</span>
                    </div>
                    <span className="text-xs font-bold text-emerald-700">{entry.conf}%</span>
                  </div>
                ))}
                {autoLog.length === 0 && (
                  <div className="text-sm text-slate-400 text-center py-8">
                    {autoMode
                      ? "No high-confidence grievances to auto-approve yet."
                      : "Turn on auto-triage to see what it would approve."}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="text-[11px] font-bold text-slate-400 mb-2">
              CITIZEN ACCOUNTS ({citizens.length})
            </div>
            <div className="bg-white rounded-[18px] overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
              {citizens.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-800">{c.email}</span>
                    {c.blocked && <Badge tone="red">BLOCKED</Badge>}
                  </div>
                  <button
                    onClick={() => toggleBlocked(c)}
                    disabled={citizenBusyId === c.id}
                    className={`text-[11px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-40 ${
                      c.blocked
                        ? "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        : "border border-red-200 text-red-600 hover:bg-red-50"
                    }`}
                  >
                    {c.blocked ? "Unblock" : "Block"}
                  </button>
                </div>
              ))}
              {citizens.length === 0 && (
                <div className="text-sm text-slate-400 text-center py-8">No citizen accounts yet.</div>
              )}
            </div>
          </div>

          <div className="mt-8">
            <div className="text-[11px] font-bold text-slate-400 mb-2">
              SITE CONTENT — COMMAND CENTER HERO
            </div>
            <div className="bg-white rounded-[18px] p-5 space-y-3" style={{ boxShadow: CARD_SHADOW }}>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Eyebrow label</label>
                <input
                  value={contentForm.command_eyebrow}
                  onChange={(e) => setContentForm({ ...contentForm, command_eyebrow: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Headline</label>
                <textarea
                  value={contentForm.command_headline}
                  onChange={(e) => setContentForm({ ...contentForm, command_headline: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-16"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Subtitle</label>
                <textarea
                  value={contentForm.command_subtitle}
                  onChange={(e) => setContentForm({ ...contentForm, command_subtitle: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-20"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={saveSiteContent}
                  disabled={contentSaving}
                  className="bg-indigo-950 text-white rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-indigo-900 disabled:opacity-50"
                >
                  {contentSaving ? "Saving…" : "Save Changes"}
                </button>
                {contentSaved && <span className="text-xs text-emerald-600 font-bold">✓ Saved — live on Command Center now</span>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


/* ──────────────────────── SECTION 11: TRUST SCREEN ───────────────────────── */

function Trust() {
  const [showRecord, setShowRecord] = useState(false);
  const [records, setRecords] = useState(null);

  const openRecord = async () => {
    setShowRecord(true);
    if (!supabase) return;
    const { data } = await supabase
      .from("grievances")
      .select("id, status, dept, created_at")
      .order("created_at", { ascending: false });
    setRecords(data || []);
  };

  return (
    <div className="grid grid-cols-3 gap-7">

      {/* LEFT — the compliance sections */}
      <div className="col-span-2">
        <div className="text-xs font-bold text-slate-400 tracking-wide mb-1">
          RULES &amp; TRUST
        </div>
        <h1 className="text-[28px] font-extrabold text-slate-900 mb-3" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
          How We Protect Your Privacy
        </h1>
        <p className="text-sm text-slate-500 mb-6 max-w-xl">
          Here's exactly what we do — and don't do — with your data, in plain words.
        </p>

        <div className="grid grid-cols-2 gap-4">
          {ETHICS_SECTIONS.map((s) => (
            <div key={s.title} className="bg-white rounded-[18px] p-[22px]" style={{ boxShadow: CARD_SHADOW }}>
              <div className="text-[22px]">{s.icon}</div>
              <div className="font-bold text-slate-900 my-2" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
                {s.title}
              </div>
              <p className="text-[13px] text-slate-500 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT — the refusal panel. This is the slide that earns credibility. */}
      <div className="space-y-4">
        <div className="bg-gradient-to-b from-[#1e2233] to-[#12141c] text-white rounded-[18px] p-5">
          <div className="flex items-start gap-2 font-bold mb-3 text-lg leading-tight">
            <span className="text-red-400">🚫</span>
            <span>Things we chose NOT to build</span>
          </div>
          <p className="text-xs text-slate-300 mb-4 leading-relaxed">
            We care more about your freedom and privacy than about watching people. We will
            never add:
          </p>
          <ul className="space-y-2.5 text-sm font-semibold">
            {["No Facial Recognition", "No Predicting Who Will Commit a Crime", "No Tracking Individual People"].map((item) => (
              <li key={item} className="flex items-center gap-2 text-red-400">
                <span>✕</span> {item.toUpperCase()}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-[18px] p-5" style={{ boxShadow: CARD_SHADOW }}>
          <div className="text-xs font-bold text-slate-400 mb-1">EVERY ACTION IS RECORDED</div>
          <p className="text-xs text-slate-500 mb-2 leading-relaxed">
            Every time someone looks at data or the computer suggests something, we write it
            down. Independent reviewers can check this record any time.
          </p>
          <button onClick={openRecord} className="text-xs font-bold text-indigo-600 hover:underline">
            See the Full Record →
          </button>
        </div>
      </div>

      {showRecord && (
        <div className="fixed inset-0 bg-[#0a0a10]/60 flex items-center justify-center z-[1100] p-6" onClick={() => setShowRecord(false)}>
          <div
            className="bg-white rounded-3xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: "0 40px 80px -20px rgba(0,0,0,.35)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="font-extrabold text-lg" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
                Full Record
              </div>
              <button onClick={() => setShowRecord(false)} className="text-2xl leading-none text-slate-400 hover:text-slate-600">×</button>
            </div>
            {!supabase ? (
              <p className="text-sm text-slate-500">
                Connect a backend to see the real record — right now this demo only has seeded sample data.
              </p>
            ) : records === null ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : records.length === 0 ? (
              <p className="text-sm text-slate-400">No grievances submitted yet.</p>
            ) : (
              <div className="space-y-2">
                {records.map((r) => (
                  <div key={r.id} className="flex items-center justify-between border border-slate-100 rounded-xl px-3 py-2 text-sm">
                    <span className="font-mono text-xs text-indigo-600">#GR-{String(r.id).padStart(4, "0")}</span>
                    <span className="text-xs text-slate-500">{r.dept}</span>
                    <Badge tone="slate">{(r.status || "new").toUpperCase()}</Badge>
                    <span className="text-[11px] text-slate-400">
                      {new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


/* ──────────────────── SECTION 11.5: SIGN IN / SIGN UP MODAL ──────────────── */

/** Full sign-in/sign-up dialog, opened from the top bar. Session state lives
 * in the root shell (via Supabase's own auth listener); this only drives
 * the form. Closes itself on a successful sign-in. */
function AuthModal({ onClose, variant = "citizen", onOfficerLogin }) {
  const isOfficer = variant === "officer";
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "reset"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [resetDob, setResetDob] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  if (!supabase) return null;

  const switchMode = (m) => { setMode(m); setError(""); setInfo(""); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");

    if (mode === "reset") {
      const err = await resetPasswordWithDob(email, resetDob, newPassword);
      setBusy(false);
      if (err) setError(err);
      else {
        setInfo("Password updated. You can sign in now.");
        setMode("signin");
        setPassword("");
      }
      return;
    }

    if (mode === "signin") {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setBusy(false);
        setError(err.message);
        return;
      }
      if (isOfficer) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .maybeSingle();
        if (profile?.role !== "officer") {
          await supabase.auth.signOut();
          setBusy(false);
          setError("This account isn't an officer account.");
          return;
        }
      }
      setBusy(false);
      onClose();
      if (isOfficer) onOfficerLogin?.();
    } else {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { dob } },
      });
      setBusy(false);
      if (err) setError(err.message);
      else setInfo("Account created. Check your email to confirm it, then sign in.");
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0a0a10]/60 flex items-center justify-center z-[1100] p-6" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()} style={{ boxShadow: "0 40px 80px -20px rgba(0,0,0,.35)" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-extrabold text-lg" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
            {mode === "reset" ? "Reset Password" : isOfficer ? "Officer Login" : mode === "signin" ? "Sign In" : "Create an Account"}
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-slate-400 hover:text-slate-600">×</button>
        </div>

        {mode !== "reset" && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => switchMode("signin")}
              className={`flex-1 text-xs font-bold py-2 rounded-lg ${mode === "signin" ? "bg-indigo-950 text-white" : "bg-slate-100 text-slate-500"}`}
            >
              Sign In
            </button>
            {!isOfficer && (
              <button
                onClick={() => switchMode("signup")}
                className={`flex-1 text-xs font-bold py-2 rounded-lg ${mode === "signup" ? "bg-indigo-950 text-white" : "bg-slate-100 text-slate-500"}`}
              >
                Sign Up
              </button>
            )}
          </div>
        )}

        {mode === "reset" ? (
          <form onSubmit={handleSubmit} className="space-y-2.5">
            <p className="text-xs text-slate-400 mb-1">
              Enter your email, date of birth, and a new password.
            </p>
            <input
              type="email" required placeholder="Email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="date" required
              value={resetDob} onChange={(e) => setResetDob(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600"
            />
            <input
              type="password" required minLength={6} placeholder="New password (6+ characters)"
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            {error && <div className="text-xs text-red-600">{error}</div>}
            {info && <div className="text-xs text-emerald-600">{info}</div>}
            <button type="submit" disabled={busy} className="w-full bg-indigo-950 text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-50">
              {busy ? "Please wait…" : "Reset Password"}
            </button>
            <button type="button" onClick={() => switchMode("signin")} className="w-full text-xs text-slate-400 hover:text-slate-600 pt-1">
              ← Back to Sign In
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-2.5">
            <input
              type="email" required placeholder="Email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="password" required minLength={6} placeholder="Password (6+ characters)"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            {mode === "signup" && (
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Date of birth (used to reset your password later)
                </label>
                <input
                  type="date" required
                  value={dob} onChange={(e) => setDob(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600"
                />
              </div>
            )}
            {mode === "signin" && (
              <button type="button" onClick={() => switchMode("reset")} className="text-xs text-indigo-600 hover:underline">
                Forgot password?
              </button>
            )}
            {error && <div className="text-xs text-red-600">{error}</div>}
            {info && <div className="text-xs text-emerald-600">{info}</div>}
            <button type="submit" disabled={busy} className="w-full bg-indigo-950 text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-50">
              {busy ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}


/* ─────────────────────── SECTION 12: ROOT APP SHELL ──────────────────────── */

export default function NagpurCommand() {
  const [view, setView] = useState("command");        // which screen is showing
  const [openAlert, setOpenAlert] = useState(null);   // null = modal closed
  const [session, setSession] = useState(null);       // auth session, null = signed out
  const [isOfficer, setIsOfficer] = useState(false);  // does the signed-in session have the officer role
  const [isBlocked, setIsBlocked] = useState(false);  // has an officer blocked this citizen account
  const [authOpen, setAuthOpen] = useState(null);     // null closed, "citizen" or "officer" picks the modal variant

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session) { setIsOfficer(false); setIsBlocked(false); return; }
    let cancelled = false;
    supabase.from("profiles").select("role, blocked").eq("id", session.user.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setIsOfficer(data?.role === "officer");
        setIsBlocked(!!data?.blocked);
      });
    return () => { cancelled = true; };
  }, [session]);

  return (
    <div
      className="flex h-screen text-[#0b0b12]"
      style={{
        fontFamily: "'Inter', sans-serif",
        backgroundColor: "#eef0fb",
        backgroundImage:
          "radial-gradient(65vw 65vh at 0% -10%, rgba(79,70,229,0.90), transparent 55%)," +
          "radial-gradient(55vw 60vh at 105% 0%, rgba(147,51,234,0.90), transparent 55%)," +
          "radial-gradient(60vw 60vh at 15% 115%, rgba(30,27,75,0.90), transparent 60%)," +
          "radial-gradient(40vw 40vh at 90% 100%, rgba(99,102,241,0.90), transparent 55%)," +
          "linear-gradient(180deg, #eef0fb 0%, #f6f6fb 100%)",
        backgroundAttachment: "fixed",
      }}
    >

      {/* ── Sidebar ── */}
      <div className="w-[236px] bg-white border-r border-slate-100 flex flex-col flex-shrink-0 py-7 px-4">
        <div className="px-3 pb-[30px]">
          <div className="font-extrabold text-[19px] tracking-tight" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
            NAGPUR
          </div>
          <div className="text-[11px] font-bold tracking-[0.14em] text-indigo-600 mt-0.5">
            COMMAND CENTER
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-[3px]">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={`text-left px-3.5 py-2.5 rounded-xl text-sm transition-colors ${
                view === n.id
                  ? "bg-indigo-600 text-white font-bold"
                  : "text-slate-500 font-semibold hover:bg-slate-50"
              }`}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <div className="pt-3.5 px-3 text-[11px] text-slate-400 border-t border-slate-100 mt-2">
          Nagpur Municipal Corporation<br />Command v2 · Demo data
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          title={SCREEN_TITLES[view]}
          session={session}
          isOfficer={isOfficer}
          onOpenAuth={() => setAuthOpen("citizen")}
          onOpenOfficerAuth={() => setAuthOpen("officer")}
          onOpenOfficerConsole={() => setView("officer")}
        />
        <div className="flex-1 overflow-y-auto">
          <div key={view} className="page-anim px-11 pt-10 pb-14">
            {view === "command"    && <CommandView onOpenAlert={setOpenAlert} />}
            {view === "grievances" && <GrievanceTriage session={session} isOfficer={isOfficer} isBlocked={isBlocked} onOpenAuth={() => setAuthOpen("citizen")} />}
            {view === "hotspots"   && <HotspotForecast />}
            {view === "advisory"   && <Advisory />}
            {view === "field"      && <FieldTeams session={session} onOpenAuth={() => setAuthOpen("citizen")} />}
            {view === "officer"    && <OfficerConsole session={session} isOfficer={isOfficer} onOpenAuth={() => setAuthOpen("officer")} />}
            {view === "trust"      && <Trust />}
          </div>
        </div>
      </div>

      {/* ── Modal (renders above everything when an alert is selected) ── */}
      <AlertDetailModal
        alert={openAlert}
        onClose={() => setOpenAlert(null)}
        onIssueAdvisory={() => {
          setOpenAlert(null);   // close the modal
          setView("advisory");  // ...and jump to the Advisory screen
        }}
      />

      {authOpen && (
        <AuthModal
          variant={authOpen}
          onClose={() => setAuthOpen(null)}
          onOfficerLogin={() => setView("officer")}
        />
      )}
    </div>
  );
}
