# Nagpur Command — Civic Foresight Dashboard

AI-Powered Integrated Urban Intelligence & Proactive Governance prototype,
built for a 5-person hackathon team (17–18 Aug 2026).

Single-page React app with 6 screens (Command, Grievances, Hotspots &
Forecast, Advisory, Field Teams, Trust) and an Alert Detail modal, covering
the full proactive-governance loop: **predict → warn → act → verify.**

All data is seeded/representative — no live PII.

## Run locally

```bash
npm install
npm run dev
```

Then open the printed `localhost` URL in your browser.

## Build for deployment

```bash
npm run build
```

Output goes to `dist/` — deploy that folder to Vercel, Netlify, GitHub Pages,
or any static host.

## Project structure

```
├── index.html          # Vite entry HTML
├── src/
│   ├── main.jsx         # React mount point
│   ├── App.jsx          # All 6 screens + modal (single component tree)
│   └── index.css        # Tailwind directives
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
└── package.json
```

## Tech stack

- React 18 + Vite
- Tailwind CSS
- Charts are hand-built inline SVG — no external chart library, no CDN
  dependency, so it runs reliably offline once installed.

## Ethics note

This prototype deliberately excludes facial recognition, predictive
policing, and citizen profiling. See the **Trust** screen for the full
DPDP Act 2023 compliance position.
