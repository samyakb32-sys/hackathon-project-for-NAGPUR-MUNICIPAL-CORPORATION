import React, { useState, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   NAGPUR COMMAND — Civic Foresight Dashboard
   AI-Powered Integrated Urban Intelligence & Proactive Governance
   
   Single-page app. Sidebar navigation switches between 6 sections.
   The Ambazari alert on the Command screen opens a detail modal.
   All data is seeded/representative — no live PII.
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
];

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
    status: "ON SITE",
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
    status: "EN ROUTE",
    task: "Drainage Repair",
    loc: "Sitabuldi",
    eta: "12m",
    history: [
      { t: "10:05", label: "Dispatched from Depot 2" },
      { t: "10:18", label: "En route to Sitabuldi", done: true },
    ],
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
    title: "DPDP Act 2023 Compliance",
    body:
      "The NMC Command Centre operates in strict adherence to India's Digital Personal " +
      "Data Protection Act of 2023. Data processing is conducted solely for the purpose " +
      "of municipal administration and civic service delivery, ensuring unambiguous " +
      "consent or legitimate civic purpose as defined under the Act.",
  },
  {
    icon: "🔻",
    title: "Data Minimisation",
    body:
      "Our systems enforce a strict data minimisation policy. We collect only the " +
      "telemetry, geospatial, and reporting data strictly necessary for municipal " +
      "operations. Extraneous metadata is automatically discarded at the ingestion layer.",
  },
  {
    icon: "👁️",
    title: "Anonymisation",
    body:
      "To protect citizen identity, all analytical dashboards and geospatial views employ " +
      "spatial aggregation and k-anonymity techniques. Individual citizen reports are " +
      "decoupled from PII before entering predictive models.",
  },
  {
    icon: "🤝",
    title: "Human-in-the-Loop Principle",
    body:
      "Artificial Intelligence and predictive algorithms within the Command Centre are " +
      "strictly advisory. They surface anomalies, patterns and risk scores — but every " +
      "routing, dispatch or public advisory action requires explicit officer approval.",
  },
];


/* ──────────────────── SECTION 2: SMALL REUSABLE UI PIECES ────────────────── */

/**
 * A single KPI card. `tone` controls the colour of the small delta pill:
 *   "up"      → red    (a metric going the wrong way)
 *   "down"    → green  (a metric improving)
 *   "neutral" → grey
 */
function StatCard({ label, value, sub, tone = "neutral" }) {
  const toneStyles = {
    up:      "text-red-600 bg-red-50",
    down:    "text-emerald-600 bg-emerald-50",
    neutral: "text-slate-500 bg-slate-100",
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-[11px] tracking-wide text-slate-500 uppercase font-medium">
        {label}
      </div>
      <div className="text-3xl font-bold text-slate-900 mt-1">{value}</div>
      {sub && (
        <span className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded ${toneStyles[tone]}`}>
          {sub}
        </span>
      )}
    </div>
  );
}

/** A small coloured label pill. */
function Badge({ children, tone = "slate" }) {
  const toneStyles = {
    slate: "bg-slate-100 text-slate-600",
    red:   "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
    green: "bg-emerald-100 text-emerald-700",
    blue:  "bg-blue-100 text-blue-700",
  };

  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded whitespace-nowrap ${toneStyles[tone]}`}>
      {children}
    </span>
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
              fill={isFlagged ? "#dc2626" : "#818cf8"}
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
        <path d={toPath(observedPoints)} fill="none" stroke="#312e81" strokeWidth="2.5" />
        {/* Dashed line = what the model expects next */}
        <path d={toPath(predictedPoints)} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="5 4" />

        {observedPoints.map((p, i) => (
          <circle key={`o${i}`} cx={p[0]} cy={p[1]} r="2.5" fill="#312e81" />
        ))}
        {predictedPoints.map((p, i) => (
          <circle key={`p${i}`} cx={p[0]} cy={p[1]} r="2.5" fill="#f59e0b" />
        ))}

        {/* Inline legend, top-right */}
        <text x={width - 4} y={12} textAnchor="end" fontSize="9" fill="#312e81" fontWeight="600">
          Observed
        </text>
        <text x={width - 4} y={24} textAnchor="end" fontSize="9" fill="#f59e0b" fontWeight="600">
          Predicted
        </text>
      </svg>

      <div className="flex justify-between text-[9px] text-slate-400 mt-1">
        {data.filter((_, i) => i % 2 === 0).map((f) => <span key={f.day}>{f.day}</span>)}
      </div>
    </div>
  );
}

/**
 * Stylised hexagonal density map standing in for a real H3 geospatial layer.
 * Colours are seeded once via useMemo so they stay stable across re-renders
 * (otherwise the map would flicker every time a parent state changes).
 */
function HexMap({ caption }) {
  const hexColours = useMemo(
    () =>
      Array.from({ length: 48 }).map(() => {
        const r = Math.random();
        if (r > 0.85) return "#dc2626";  // red    — critical density
        if (r > 0.65) return "#f59e0b";  // amber  — elevated
        if (r > 0.40) return "#818cf8";  // indigo — moderate
        return "#334155";                // slate  — low
      }),
    []
  );

  const COLS = 8;

  return (
    <div className="relative bg-slate-900 rounded-lg overflow-hidden h-full min-h-[280px] flex items-center justify-center">
      <svg viewBox="0 0 400 260" className="w-full h-full">
        {hexColours.map((colour, i) => {
          const row = Math.floor(i / COLS);
          const col = i % COLS;
          // Offset every other row by half a hex to get the honeycomb interlock
          const x = col * 48 + (row % 2 === 0 ? 0 : 24) + 20;
          const y = row * 40 + 20;

          return (
            <polygon
              key={i}
              points="20,0 40,11.5 40,34.5 20,46 0,34.5 0,11.5"
              transform={`translate(${x - 20}, ${y - 23}) scale(0.55)`}
              fill={colour}
              opacity="0.75"
              stroke="#0f172a"
              strokeWidth="1"
            />
          );
        })}
      </svg>

      {caption && (
        <div className="absolute bottom-3 left-3 bg-slate-950/80 text-white text-xs px-2 py-1 rounded border border-slate-700">
          {caption}
        </div>
      )}
    </div>
  );
}


/* ──────────────────────── SECTION 4: TOP HEADER BAR ──────────────────────── */

function TopBar() {
  const [lang, setLang] = useState("EN");

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
      {/* Municipal identity */}
      <div>
        <div className="text-lg font-bold text-slate-900 leading-tight">NAGPUR MUNICIPAL</div>
        <div className="text-lg font-bold text-slate-900 leading-tight -mt-1">CORPORATION</div>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md mx-8">
        <input
          className="w-full bg-slate-100 rounded-md px-3 py-2 text-sm text-slate-600 outline-none"
          placeholder="🔍  Search ID, ward, keyword..."
        />
      </div>

      {/* Language toggle + date + avatar */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-xs font-medium border border-slate-200 rounded-md px-2 py-1.5">
          {["EN", "हिंदी", "मराठी"].map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                lang === l ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="text-xs font-medium text-slate-600 border border-slate-200 rounded-md px-2 py-1.5">
          📅 Oct 24, 2023
        </div>

        <div className="w-8 h-8 rounded-full bg-indigo-900 text-white flex items-center justify-center text-xs font-bold">
          A
        </div>
      </div>
    </div>
  );
}


/* ───────────────────────── SECTION 5: COMMAND SCREEN ─────────────────────── */

function CommandView({ onOpenAlert }) {
  return (
    <div className="p-6 space-y-6">
      {/* Four headline KPIs. "Predicted SLA Breaches" is the proactive one. */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Open Grievances"              value="2,431"    sub="+12% vs LW" tone="up" />
        <StatCard label="Predicted SLA Breaches (7D)"  value="188"      sub="— Stable"   tone="neutral" />
        <StatCard label="Active Hotspots"              value="7"        sub="-2 vs LW"   tone="down" />
        <StatCard label="Avg Resolution Time"          value="16 days"  sub="+1 day"     tone="up" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Map panel */}
        <div className="col-span-2 bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-2">
              {["Grievances", "Flood Risk", "Air Quality"].map((layer, i) => (
                <button
                  key={layer}
                  className={`text-xs font-medium px-3 py-1.5 rounded-md ${
                    i === 0
                      ? "bg-indigo-900 text-white"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {layer}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-400">Ward Filter: All Wards</span>
          </div>

          <HexMap caption="Sitabuldi · Gandhibagh · Lakadganj" />
        </div>

        {/* Proactive alerts feed */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-slate-900">Proactive Alerts</div>
            <Badge tone="blue">3 New</Badge>
          </div>

          <div className="space-y-3">
            {ALERTS.map((alert) => {
              const tone =
                alert.level === "CRITICAL" ? "red" :
                alert.level === "WARNING"  ? "amber" : "slate";

              const borderColour =
                alert.level === "CRITICAL" ? "border-red-300" :
                alert.level === "WARNING"  ? "border-amber-300" : "border-slate-200";

              return (
                <div key={alert.id} className={`border ${borderColour} rounded-lg p-3`}>
                  <div className="flex items-center justify-between mb-1">
                    <Badge tone={tone}>[{alert.level}] {alert.ward.toUpperCase()}</Badge>
                    <span className="text-[11px] text-slate-500">{alert.conf}% Conf.</span>
                  </div>

                  <p className="text-xs text-slate-600 mb-2">{alert.text}</p>

                  <div className="flex gap-2">
                    {/* Only the Ambazari alert has a full detail payload to open */}
                    <button
                      onClick={() => alert.rain && onOpenAlert(alert)}
                      className="text-xs font-semibold bg-indigo-900 text-white px-3 py-1.5 rounded-md hover:bg-indigo-800"
                    >
                      ASSIGN
                    </button>
                    <button className="text-xs font-semibold border border-slate-200 text-slate-600 px-3 py-1.5 rounded-md hover:bg-slate-50">
                      DISMISS
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        Demo data — representative, not live PII.
      </p>
    </div>
  );
}


/* ────────────────────── SECTION 6: ALERT DETAIL MODAL ────────────────────── */

function AlertDetailModal({ alert, onClose, onIssueAdvisory }) {
  if (!alert) return null;   // nothing selected → render nothing

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-6">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">

        {/* Red header — signals criticality immediately */}
        <div className="bg-red-600 text-white px-6 py-4 rounded-t-xl flex items-start justify-between">
          <div>
            <div className="font-bold text-lg">
              ALERT DETAIL: AMBAZARI FLOOD RISK (CRITICAL)
            </div>
            <div className="text-xs opacity-90 mt-1">
              Ward ID: {alert.wardId} &nbsp;|&nbsp; Priority: {alert.priority} &nbsp;|&nbsp; Status: {alert.status}
            </div>
          </div>
          <button onClick={onClose} className="text-2xl leading-none hover:opacity-70">×</button>
        </div>

        <div className="p-6 grid grid-cols-2 gap-6">

          {/* LEFT COLUMN — the reasoning behind the prediction */}
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-2">WEATHER INTELLIGENCE</div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-indigo-900">68mm</div>
              <div className="text-xs text-slate-500 mb-3">Forecasted in 36h</div>
              <BarChart
                data={alert.rain}
                height={100}
                highlightMax
                labels={alert.rain.map((r) => r.t)}
              />
            </div>

            {/* This is the credibility moment — the model isn't guessing, it's
                pattern-matching against a real historical event. */}
            <div className="text-xs font-semibold text-slate-500 mt-4 mb-2">HISTORICAL CONTEXT</div>
            <div className="bg-slate-50 border-l-4 border-indigo-900 rounded-r-lg p-3 text-sm text-slate-700">
              <strong>92% Confidence Score:</strong> {alert.history}
            </div>

            <div className="text-xs font-semibold text-slate-500 mt-4 mb-2">
              ASSET STATUS: OPEN COMPLAINTS (14)
            </div>
            <div className="space-y-1.5">
              {alert.complaints.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm bg-slate-50 rounded px-3 py-2">
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
            <div className="text-xs font-semibold text-slate-500 mb-2">LOCALIZED RISK MAP</div>
            <HexMap caption="Zoom: Ward Level" />

            <div className="text-xs font-semibold text-slate-500 mt-4 mb-2">AVAILABLE FIELD TEAMS</div>
            <div className="flex gap-2 mb-4 flex-wrap">
              {alert.teams.map((team) => (
                <span key={team} className="flex items-center gap-1.5 text-xs border border-slate-200 rounded-md px-3 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {team}
                </span>
              ))}
            </div>

            <button className="w-full bg-indigo-900 text-white rounded-md py-2.5 text-sm font-semibold mb-2 hover:bg-indigo-800">
              ➤ &nbsp;ASSIGN RAPID RESPONSE TEAM
            </button>

            {/* Jumps the user to the Advisory screen — this is the
                "prediction becomes citizen warning" handoff. */}
            <button
              onClick={onIssueAdvisory}
              className="w-full border border-indigo-900 text-indigo-900 rounded-md py-2.5 text-sm font-semibold hover:bg-indigo-50"
            >
              📢 &nbsp;ISSUE PUBLIC ADVISORY
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 flex justify-end">
          <button
            onClick={onClose}
            className="border border-slate-300 text-slate-600 rounded-md px-4 py-2 text-sm hover:bg-slate-50"
          >
            CLOSE DETAIL
          </button>
        </div>
      </div>
    </div>
  );
}


/* ───────────────────── SECTION 7: GRIEVANCE TRIAGE SCREEN ────────────────── */

function GrievanceTriage() {
  const [selected, setSelected] = useState(GRIEVANCES[0]);

  // Maps the sla field to [badge tone, human label]
  const SLA_DISPLAY = {
    safe:     ["green", "Safe"],
    risk:     ["amber", "At Risk"],
    breached: ["red",   "Breached"],
  };

  return (
    <div className="p-6 grid grid-cols-3 gap-6">

      {/* LEFT — the inbox table */}
      <div className="col-span-2">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Triage Inbox</h1>
        <p className="text-sm text-slate-500 mb-4">
          Incoming citizen grievances requiring AI verification and officer assignment.
        </p>

        <div className="flex gap-2 mb-4 items-center">
          {["All", "At Risk", "Breached"].map((filter, i) => (
            <button
              key={filter}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md ${
                i === 0
                  ? "bg-indigo-900 text-white"
                  : "border border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              {filter.toUpperCase()}
            </button>
          ))}

          <select className="text-xs border border-slate-200 rounded-md px-2 py-1.5 ml-auto text-slate-500">
            <option>All Departments</option>
          </select>
          <select className="text-xs border border-slate-200 rounded-md px-2 py-1.5 text-slate-500">
            <option>All Wards</option>
          </select>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[90px_1fr_130px_60px_90px] px-4 py-2 text-[11px] font-semibold text-slate-400 border-b border-slate-100">
            <span>ID</span>
            <span>COMPLAINT TEXT</span>
            <span>AI PREDICTION</span>
            <span>CONF.</span>
            <span>SLA</span>
          </div>

          {/* Rows — clicking one loads it into the detail panel on the right */}
          {GRIEVANCES.map((g) => {
            const [tone, label] = SLA_DISPLAY[g.sla];

            return (
              <button
                key={g.id}
                onClick={() => setSelected(g)}
                className={`w-full text-left grid grid-cols-[90px_1fr_130px_60px_90px] px-4 py-3 border-b border-slate-50 items-center transition-colors ${
                  selected.id === g.id ? "bg-indigo-50" : "hover:bg-slate-50"
                }`}
              >
                <span className="text-xs font-mono text-indigo-900">{g.id}</span>
                <span>
                  {/* Original language first, translation underneath —
                      this ordering is deliberate: the citizen's own words lead. */}
                  <div className="text-sm text-slate-800">{g.text}</div>
                  <div className="text-xs text-slate-400">{g.en}</div>
                </span>
                <span><Badge>{g.dept}</Badge></span>
                <span className="text-xs text-slate-500">{g.conf}%</span>
                <span><Badge tone={tone}>{label}</Badge></span>
              </button>
            );
          })}
        </div>

        <div className="text-xs text-slate-400 mt-3">
          Showing 1–4 of 124 grievances
        </div>
      </div>

      {/* RIGHT — detail panel for the selected complaint */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 h-fit">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-sm font-bold text-indigo-900">{selected.id}</span>
          <Badge tone="blue">TRIAGE</Badge>
        </div>
        <div className="text-xs text-slate-400 mb-4">Submitted 2 hours ago</div>

        <div className="text-[11px] font-semibold text-slate-500 mb-1">CITIZEN REPORT</div>
        <div className="bg-slate-50 rounded-lg p-3 mb-2">
          <div className="text-sm font-medium">"{selected.text}"</div>
          <div className="text-xs text-slate-400 mt-1">🌐 "{selected.en}"</div>
        </div>
        <div className="text-xs text-slate-500 mb-4">
          📍 {selected.ward} &nbsp;·&nbsp; Anonymized Citizen
        </div>

        <div className="text-[11px] font-semibold text-slate-500 mb-2">SYSTEM ANALYSIS</div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-[10px] text-slate-400">PREDICTED DEPT</div>
            <div className="text-sm font-semibold">{selected.dept}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-[10px] text-slate-400">CONFIDENCE</div>
            <div className="text-sm font-bold text-indigo-900">{selected.conf}%</div>
          </div>
        </div>

        {selected.similar && (
          <>
            <div className="text-[11px] font-semibold text-slate-500 mb-2">
              SIMILAR HISTORY (30 DAYS)
            </div>
            <div className="space-y-2 mb-4">
              {selected.similar.map((s) => (
                <div key={s.id} className="border border-slate-100 rounded-lg p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono">{s.id}</span>
                    <Badge tone="slate">{s.status}</Badge>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{s.text}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* The line that keeps this defensible in front of judges */}
        <p className="text-[11px] text-center text-slate-400 mb-3">
          AI recommends. Officer decides.
        </p>

        <button className="w-full bg-indigo-900 text-white rounded-md py-2.5 text-sm font-semibold mb-2 hover:bg-indigo-800">
          ✓ &nbsp;APPROVE &amp; ASSIGN
        </button>
        <div className="flex gap-2">
          <button className="flex-1 border border-slate-200 text-slate-600 rounded-md py-2 text-xs font-semibold hover:bg-slate-50">
            ↻ REASSIGN
          </button>
          <button className="flex-1 border border-red-200 text-red-600 rounded-md py-2 text-xs font-semibold hover:bg-red-50">
            ↗ ESCALATE
          </button>
        </div>
      </div>
    </div>
  );
}


/* ─────────────────── SECTION 8: HOTSPOTS & FORECAST SCREEN ───────────────── */

function HotspotForecast() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 gap-6">

        {/* Spatial clusters */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="font-bold text-slate-900">Spatial Intelligence</div>
            <div className="flex gap-1 ml-auto">
              {["Grievance", "Flood", "Air Quality"].map((t, i) => (
                <button
                  key={t}
                  className={`text-[10px] font-medium px-2 py-1 rounded ${
                    i === 0 ? "bg-indigo-900 text-white" : "border border-slate-200 text-slate-500"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <HexMap caption="Dharampeth 412 · Sitabuldi 185 · Mahal 89" />
        </div>

        {/* Two stacked charts */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-slate-900">Complaint Volume Forecast</div>
              <div className="text-[11px] text-slate-400">14-Day Trajectory (95% CI)</div>
            </div>
            <LineChart data={FORECAST} height={150} />
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-slate-900">PM10 Air Quality Levels</div>
              <div className="text-[11px] text-red-600 bg-red-50 px-2 py-0.5 rounded">
                Threshold: 60 µg/m³
              </div>
            </div>
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
        <div className="font-bold text-slate-900 mb-3">⚡ Tactical Interventions</div>
        <div className="grid grid-cols-3 gap-4">
          {INTERVENTIONS.map((c) => (
            <div key={c.ward} className="bg-white border border-slate-200 rounded-lg p-4">
              <Badge>{c.ward.toUpperCase()}</Badge>
              <div className="font-bold text-slate-900 mt-2">{c.title}</div>
              <p className="text-xs text-slate-500 mt-1 mb-3">{c.desc}</p>
              <div className="text-[10px] font-semibold text-slate-400">EXPECTED IMPACT</div>
              <div className="text-xs text-slate-600">{c.impact}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


/* ────────────────────── SECTION 9: ADVISORY COMPOSER ─────────────────────── */

function Advisory() {
  const [lang, setLang] = useState("English");
  const [severity, setSeverity] = useState("Critical");

  // Same advisory, three languages — the multilingual capability made visible
  const MESSAGES = {
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

  return (
    <div className="p-6 grid grid-cols-3 gap-6">

      {/* LEFT — the composer form */}
      <div className="col-span-2">
        <div className="text-xs text-slate-400 mb-1">Advisories &gt; New Composer</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Advisory Composer</h1>

        <div className="text-xs font-semibold text-slate-500 mb-2">SOURCE ALERT / TRIGGER</div>
        <div className="border border-slate-200 rounded-lg px-4 py-3 mb-5 text-sm">
          Ambazari Flood Risk (Predicted)
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-2">SEVERITY LEVEL</div>
            <div className="flex gap-2">
              {["Info", "Warning", "Critical"].map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors ${
                    severity === s
                      ? "bg-red-50 text-red-600 border-red-200"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-500 mb-2">ACTIVE WINDOW</div>
            <div className="border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-500">
              10/24/2023 6:00 PM &nbsp;–&nbsp; 10/26/2023
            </div>
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-500 mb-2">AFFECTED WARDS (TARGETING)</div>
        <div className="flex gap-2 mb-5 flex-wrap items-center">
          {["Ambazari", "Sitabuldi", "Gandhibagh"].map((w) => (
            <span key={w} className="bg-indigo-50 text-indigo-900 text-xs font-medium px-3 py-1 rounded-full">
              {w} ✕
            </span>
          ))}
          <button className="text-xs text-slate-400 hover:text-slate-600">⊕ Add Ward</button>
        </div>

        <div className="text-xs font-semibold text-slate-500 mb-2">DISTRIBUTION CHANNELS</div>
        <div className="flex gap-4 mb-5 text-xs text-slate-600 flex-wrap">
          {["SMS (Priority)", "WhatsApp API", "NMC App Push", "Public Display Boards"].map((c) => (
            <label key={c} className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-indigo-900" />
              {c}
            </label>
          ))}
        </div>

        {/* Language tabs actually swap the message body */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-slate-500">🗣 MULTILINGUAL MESSAGE PAYLOAD</div>
          <div className="flex gap-3 text-xs">
            {["English", "मराठी", "हिंदी"].map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={lang === l ? "font-bold text-indigo-900 underline" : "text-slate-400 hover:text-slate-600"}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <textarea
          key={lang}                              // remount so the new text shows
          className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-700 h-24"
          defaultValue={MESSAGES[lang]}
        />
        <div className="text-[11px] text-slate-400 mt-1">
          👥 47,000 residents &nbsp;·&nbsp; 💬 1/2 segments
        </div>
      </div>

      {/* RIGHT — preview + approval chain */}
      <div>
        <div className="text-xs font-semibold text-slate-500 mb-2">CITIZEN PREVIEW</div>
        <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl p-4 mb-6">
          <div className="text-white text-center mb-3">
            <div className="text-2xl font-light">10:42</div>
            <div className="text-[10px] opacity-70">Tuesday, Oct 24</div>
          </div>
          <div className="bg-slate-700/80 backdrop-blur rounded-lg p-3">
            <div className="text-white text-xs font-semibold mb-1">🔔 NMC ALERTS · now</div>
            <div className="text-slate-200 text-xs leading-relaxed">
              {MESSAGES[lang].slice(0, 95)}...
            </div>
          </div>
        </div>

        {/* Human approval chain — nothing goes out automatically */}
        <div className="text-xs font-semibold text-slate-500 mb-3">DISPATCH AUTHORIZATION</div>
        <div className="space-y-3 mb-6">
          {[
            { label: "Drafted by",     who: "Officer K. Deshmukh",       done: true  },
            { label: "Verified by",    who: "Chief Engineer (Pending)",  done: false },
            { label: "Final Approval", who: "Commissioner (Pending)",    done: false },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] ${
                step.done ? "bg-indigo-900" : "border border-slate-300"
              }`}>
                {step.done && "✓"}
              </div>
              <div>
                <div className="text-[11px] text-slate-400">{step.label}</div>
                <div className="text-xs font-medium text-slate-700">{step.who}</div>
              </div>
            </div>
          ))}
        </div>

        <button className="w-full bg-indigo-900 text-white rounded-md py-2.5 text-sm font-semibold hover:bg-indigo-800">
          ➤ &nbsp;REQUEST VERIFICATION
        </button>
      </div>
    </div>
  );
}


/* ───────────────────── SECTION 10: FIELD TEAMS SCREEN ────────────────────── */

function FieldTeams() {
  const [active, setActive] = useState(TEAMS[0]);

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Teams Deployed"        value="42"   sub="+2 from shift start" tone="neutral" />
        <StatCard label="Tasks In Progress"     value="18"   sub="-4 pending"          tone="down" />
        <StatCard label="Tasks Completed Today" value="124"  sub="+12% vs avg"         tone="down" />
        <StatCard label="Avg Response Time"     value="24m"  sub="+2m target"          tone="up" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <HexMap caption="RRT-Alpha (On Site) · Drain-Unit 4 (En Route) · Unit 7 (Idle)" />
          </div>

          {/* Timeline for whichever crew is selected on the right */}
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="font-bold text-slate-900 mb-3">
              🕘 {active.name} Operational History
            </div>
            <div className="flex gap-6">
              <div className="flex-1 space-y-3">
                {active.history.map((h, i) => (
                  <div key={i} className="flex gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                      h.done ? "bg-indigo-900" : "border-2 border-slate-300"
                    }`} />
                    <div>
                      <div className="text-xs text-slate-400">{h.t}</div>
                      <div className={`text-sm ${h.done ? "font-semibold text-slate-800" : "text-slate-600"}`}>
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
              <div className="w-32 border border-slate-200 rounded-lg p-2 h-fit">
                <div className="text-[10px] text-slate-400 mb-1">Evidence</div>
                <div className="bg-slate-200 rounded h-20 flex items-center justify-center text-2xl">
                  📷
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right rail — crew list + the unassigned predicted task */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-bold text-slate-900">Active Deployments</div>
            <Badge tone="blue">18 Active</Badge>
          </div>

          {TEAMS.map((t) => (
            <button
              key={t.name}
              onClick={() => setActive(t)}
              className={`w-full text-left border rounded-lg p-3 transition-colors ${
                active.name === t.name
                  ? "border-indigo-300 bg-indigo-50"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-slate-900">{t.name}</span>
                <Badge tone={t.status === "ON SITE" ? "blue" : "amber"}>{t.status}</Badge>
              </div>
              <div className="text-xs text-slate-500">Task: {t.task}</div>
              <div className="text-xs text-slate-500">Loc: {t.loc}</div>
              <div className="text-[11px] text-slate-400 mt-1">⏱ Time: {t.eta}</div>
            </button>
          ))}

          {/* The proactive payoff: a task created by a prediction,
              not by a citizen complaint. */}
          <div className="border border-red-200 bg-red-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-red-700 font-semibold text-sm mb-2">
              ⚠ Critical Unassigned Task
            </div>
            <div className="font-semibold text-sm text-slate-900">Predicted Waterlogging</div>
            <div className="text-xs text-slate-500 mb-3">📍 Ambazari Sector 9</div>

            <div className="bg-white rounded-lg p-2.5 border border-red-100">
              <div className="text-[10px] font-semibold text-slate-400">SYSTEM SUGGESTION</div>
              <div className="text-sm font-semibold text-indigo-900">Assign: Drain-Unit 2</div>
              <div className="text-xs text-slate-500 mb-2">🚚 4km away (Est. ETA 12m)</div>
              <button className="w-full bg-indigo-900 text-white rounded-md py-2 text-xs font-semibold hover:bg-indigo-800">
                ➤ DISPATCH NOW
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ──────────────────────── SECTION 11: TRUST SCREEN ───────────────────────── */

function Trust() {
  return (
    <div className="p-6 grid grid-cols-3 gap-6">

      {/* LEFT — the compliance sections */}
      <div className="col-span-2">
        <div className="text-xs font-semibold text-slate-400 tracking-wide mb-1">
          COMPLIANCE &amp; GOVERNANCE
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">Ethics &amp; Legal Position</h1>
        <p className="text-sm text-slate-600 mb-6 max-w-xl">
          The Nagpur Municipal Corporation's data governance framework prioritizes citizen
          privacy, operational transparency, and strictly defined scopes for algorithmic
          intervention.
        </p>

        <div className="space-y-4">
          {ETHICS_SECTIONS.map((s) => (
            <div key={s.title} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="font-bold text-slate-900 flex items-center gap-2 mb-1.5">
                <span>{s.icon}</span> {s.title}
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT — the refusal panel. This is the slide that earns credibility. */}
      <div className="space-y-4">
        <div className="bg-slate-900 text-white rounded-lg p-5">
          <div className="flex items-start gap-2 font-bold mb-3 text-lg leading-tight">
            <span className="text-red-500">🚫</span>
            <span>What we deliberately did not build</span>
          </div>
          <p className="text-xs text-slate-300 mb-4 leading-relaxed">
            In our pursuit of a smart city, we prioritize civil liberties over surveillance
            capabilities. The following technologies are explicitly excluded from the NMC
            architecture:
          </p>
          <ul className="space-y-2.5 text-sm font-semibold">
            {["No Facial Recognition", "No Predictive Policing", "No Citizen Profiling"].map((item) => (
              <li key={item} className="flex items-center gap-2 text-red-400">
                <span>✕</span> {item.toUpperCase()}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-slate-500 mb-1">AUDIT TRAIL</div>
          <p className="text-xs text-slate-500 mb-2 leading-relaxed">
            All data access and algorithmic decisions are immutably logged for periodic
            review by independent ethics boards.
          </p>
          <button className="text-xs font-semibold text-indigo-900 hover:underline">
            View Audit Policy →
          </button>
        </div>
      </div>
    </div>
  );
}


/* ─────────────────────── SECTION 12: ROOT APP SHELL ──────────────────────── */

export default function NagpurCommand() {
  const [view, setView] = useState("command");        // which screen is showing
  const [openAlert, setOpenAlert] = useState(null);   // null = modal closed

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* ── Sidebar ── */}
      <div className="w-56 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-slate-100">
          <div className="w-9 h-9 rounded-lg bg-indigo-900 text-white flex items-center justify-center font-bold mb-2">
            N
          </div>
          <div className="font-bold text-slate-900 text-sm leading-tight">Nagpur Command</div>
          <div className="text-[11px] text-slate-400">Municipal HQ</div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={`w-full text-left px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                view === n.id
                  ? "bg-indigo-900 text-white"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <button className="w-full bg-indigo-900 text-white rounded-md py-2.5 text-xs font-semibold hover:bg-indigo-800">
            GENERATE REPORT
          </button>
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <div className="flex-1 overflow-y-auto">
          {view === "command"    && <CommandView onOpenAlert={setOpenAlert} />}
          {view === "grievances" && <GrievanceTriage />}
          {view === "hotspots"   && <HotspotForecast />}
          {view === "advisory"   && <Advisory />}
          {view === "field"      && <FieldTeams />}
          {view === "trust"      && <Trust />}
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
    </div>
  );
}
