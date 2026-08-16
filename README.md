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

## GitHub Pages deployment

The root `index.html` served by GitHub Pages is a **standalone, no-build
version** (React + Babel standalone + Tailwind, all loaded via CDN
`<script>` tags). It is not the Vite entry point — it doesn't reference
`/src/main.jsx` or use `<script type="module">`, so the browser can parse
it directly with no build step. This is what fixed the earlier blank-page
bug (`Uncaught SyntaxError: Cannot use import statement outside a module`),
which happened because the previous root `index.html` was the Vite entry
HTML pushed without running `npm run build` first.

Keep it that way: **do not overwrite root `index.html` with the Vite entry
HTML** unless you also set up a build step (see below).

If you'd rather deploy the real Vite build instead of the standalone file,
add a GitHub Actions workflow that runs `npm run build` and publishes
`dist/`, and set `base: '/hackathon-project-for-NAGPUR-MUNICIPAL-CORPORATION/'`
in `vite.config.js` so built asset paths resolve under the repo's Pages
subpath.

## Build for local Vite dev

```bash
npm run build
```

Output goes to `dist/` — deploy that folder to Vercel, Netlify, or any
static host if you're not using the standalone `index.html` above.

## Project structure

```
├── index.html          # Standalone CDN build — this is what GitHub Pages serves
├── src/                 # Vite dev project (for local development only)
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
