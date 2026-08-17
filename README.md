# Reno Tracker

A Progressive Web App for tracking renovation works phase by phase, separated by subcontractor — built for the site supervisor who logs a mandatory daily SOP report from the field. First seeded project: **Faithview Gallery** (LOT 26662 Sales Gallery).

Built with React + Vite + TypeScript and `vite-plugin-pwa` (Workbox), from the design handoff in [`design-reference/`](design-reference/README.md).

## Features

- **Home** — today's SOP progress card, overall %, per-subcon progress grid, low-stock / delivery / drawings alerts.
- **Phases** — 16 phases across 4 subcons (Classic Home, Fanmuli 定制, Ah Kang, Hock Heng), filter chips, `+5%` bump, Start, auto-move to Done at 100%.
- **Supplies** — live search, Low stock / In transit filters, stock bars; supply detail with reorder (creates a PO, logs a movement, flips status to ORDERED), supplier call / WhatsApp buttons, full movement log.
- **Daily report (SOP)** — 5 steps: site photos (camera capture, min 3, stored in IndexedDB), manpower steppers per subcon, material usage (only in-stock materials, qty capped at stock), work summary, optional issues. Submit deducts stock, logs movements, updates spend, and files the report. One report per day; the draft persists locally until submitted and rolls over at midnight.
- **History** — month calendar (complete / incomplete / today), report cards, full report view, **Share PDF** — a generated A4 daily-report PDF shared via the Web Share API (WhatsApp etc.) with download fallback.
- **Drawings** — two bundled drawing sets (Sales Gallery 10 pp, Lobby 13 pp), in-app viewer, share, link-to-phase tags, and upload (PDF / image).
- **Multiple projects** — project switcher in the header; new projects start blank and are built up in-app.
- **Fully editable** — add/edit/delete phases (pencil icons + "Add phase") and supplies (detail-screen pencil + "Add supply", with direct stock adjustments logged as movements); project settings (via the switcher's gear) manage the project name, target date and subcontractors, delete projects, and reset the device back to the demo data.

## PWA

- Web app manifest: standalone, portrait, theme `#0F766E`, installable on Android/iOS home screens.
- Service worker (Workbox `generateSW`, auto-update): app shell + fonts precached; drawing PDFs runtime-cached on first open.
- **Offline-first**: all data (state, photos, uploaded drawings) lives in IndexedDB on the device — reports can be logged with no connectivity and the app fully reloads offline. IBM Plex fonts are self-hosted so typography works offline too.
- Camera access via `<input capture="environment">`; photos are downscaled to ≤1280px JPEG before storage.

## Develop

```sh
npm install
npm run dev        # dev server
npm run build      # type-check + production build (dist/)
npm run preview    # serve the production build
npm run icons      # regenerate public/icons/ from the inline SVG
node scripts/smoke.mjs   # e2e smoke test against the preview server (needs preview running)
```

Note: the service worker is only generated for production builds — test install/offline behavior via `npm run build && npm run preview`.

## Cross-device sync (Supabase, no login)

The app is local-first: it always works offline from the device's IndexedDB. When built with Supabase credentials, every change is mirrored to one shared Supabase row (last-write-wins by timestamp; photos and uploaded drawings to Storage) and **all devices opening the app share the same live data — no accounts, no sign-in**. Other devices update live via realtime, plus pulls on start/focus/reconnect and a 60s safety interval. Without credentials the app simply runs in local-only mode.

> Trade-off to understand: login-free sync means anyone who has the app's URL can read and write the shared data (the publishable key ships in the public bundle). For a small site team this is usually fine; if you ever need it locked down, an auth layer can be added back.

One-time setup:

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard: **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), **Run**. (Safe to re-run, and safe on a project that had the older auth-based schema.)
3. Copy your **Project URL** and **publishable (anon) key** from **Project Settings → API**.
4. In the GitHub repo: **Settings → Secrets and variables → Actions**, add:
   - `VITE_SUPABASE_URL` — the project URL
   - `VITE_SUPABASE_ANON_KEY` — the publishable/anon key (never the secret key — the deploy guard will refuse it)
5. Re-run the deploy: **Actions → Deploy to GitHub Pages → Run workflow** (or push any commit).

That's it — open the app anywhere and it syncs. The cloud icon on the Home screen shows sync state (teal = synced, pulsing = syncing, gray = offline, red = error). Changes made offline are pushed automatically when connectivity returns; if two devices edit while offline, the most recent edit wins.

## Deploy (GitHub Pages)

Every push to `claude/pwa-development-hzfgvy` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which builds the app with `--base=/tenn-project-progress-app/` and publishes `dist/` to the `gh-pages` branch. One-time setup in the repo:

1. **Settings → Pages → Source: Deploy from a branch → `gh-pages` / `(root)` → Save**

The app is then live at **https://lczx122.github.io/tenn-project-progress-app/** — open it on a phone and use "Add to Home Screen" to install it.

## Structure

```
src/
  main.tsx          entry — registers the SW, loads state from IndexedDB, renders
  App.tsx           shell: tab navigation + pushed views (detail, drawings, viewer)
  store.ts          app state (useSyncExternalStore) + actions, persisted to IndexedDB
  seed.ts           Faithview Gallery seed data (dates relative to today)
  selectors.ts      derived values (overall %, SOP steps, low stock…)
  db.ts             minimal IndexedDB wrapper (state, photos, uploaded files)
  ui.tsx            UI-only state: tabs, pushed stack, filters, toast
  screens/          Home, Phases, Supplies, SupplyDetail, Report, History,
                    ReportView, Drawings, PdfViewer
  utils/            dates, photo capture/downscale, jsPDF report + Web Share
design-reference/   original HTML design prototype + handoff notes (not shipped)
```
