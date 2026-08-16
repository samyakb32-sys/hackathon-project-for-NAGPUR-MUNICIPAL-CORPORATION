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

`index.html` is the standard **Vite entry point** (`<script type="module"
src="/src/main.jsx">`) — it is never served raw. `.github/workflows/deploy.yml`
runs on every push to `main`: it does `npm ci && npm run build` and publishes
the resulting `dist/` folder to GitHub Pages via `actions/deploy-pages`.

This replaced an earlier standalone, no-build `index.html` (React + Babel
standalone + Tailwind loaded from CDN `<script>` tags) that was fragile
during a live demo — it depended on `unpkg.com` serving `babel.min.js`,
`react`, and `react-dom` correctly and transforming JSX in the browser at
page-load time, and any CDN hiccup produced
`Uncaught SyntaxError: Cannot use import statement outside a module`.
The Vite build compiles JSX ahead of time, so the deployed page has no
runtime CDN or Babel dependency at all.

**One-time repo setting required:** in GitHub, go to Settings → Pages →
Build and deployment → Source, and select **"GitHub Actions"** (not
"Deploy from a branch"). Once set, every push to `main` redeploys
automatically.

`vite.config.js` sets `base: '/hackathon-project-for-NAGPUR-MUNICIPAL-CORPORATION/'`
so built asset paths resolve correctly under the repo's Pages subpath —
this must match the repo name exactly if the repo is ever renamed.

## Build for local Vite dev

```bash
npm run build
```

Output goes to `dist/` (git-ignored) — CI produces this automatically on
push to `main`. You generally don't need to run this locally except to
sanity-check a build before pushing.

## Project structure

```
├── index.html               # Vite entry HTML — never served raw, only via the build
├── .github/workflows/deploy.yml  # Builds and deploys dist/ to GitHub Pages
├── src/
│   ├── main.jsx              # React mount point
│   ├── App.jsx                # All 6 screens + modal (single component tree)
│   └── index.css              # Tailwind directives
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
└── package.json
```

## Tech stack

- React 18 + Vite
- Tailwind CSS
- Charts are hand-built inline SVG — no external chart library, so nothing
  extra to fetch beyond the built bundle.

## Ethics note

This prototype deliberately excludes facial recognition, predictive
policing, and citizen profiling. See the **Trust** screen for the full
DPDP Act 2023 compliance position.
