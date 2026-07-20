# TENN · Ambience Bukit Baru Showroom — Site Progress Tracker (PWA)

An offline-first Progressive Web App for detailed progress tracking of the
**Lot 26662, Bukit Baru Sales Gallery — ID Works** project: 37 work areas,
a 170-item procurement buy list, stage-by-stage tracking, progress claims
and a site diary.

## How it's organised

The primary tracking unit is the **work area** (Reception Counter, Front
Backdrop, Master Bedroom Feature Wall, …) taken from the project's
procurement list — read against the ID Details Drawings (260710-Amended)
and Tender Clarifications (04 Mar 2025).

- **Home** — overall site progress, procurement pipeline funnel,
  needs-attention flags, per-part progress, timeline countdown.
- **Areas** — every work area tracked through 8 weighted stages:
  site measurement (5%) → samples approved (10%) → materials ordered (10%)
  → fabrication (30%) → delivered to site (5%) → installation (30%) →
  lighting & electrical (5%) → touch-up & QC (5%). Stages can be marked
  N/A (weight redistributes). Each area lists its materials with status
  chips and its "by others — do not buy" exclusions.
- **Buy List** — all procurement items with spec, estimated qty and
  supplier category (Laminate, Fluted, Glass & Mirror, Stone, LED,
  Metalwork, Timber & Board, Fabric, Hardware, Paint). Status per item:
  To order → Sample pending → Ordered → Delivered → Installed (or N/A),
  plus a note field for PO numbers / suppliers / ETAs. Filter by status,
  category or search. Key clarifications are baked into the specs
  (gold strips = SS gold finish, colour-glass counter tops, granite
  toilet basin tops, hidden utility door, extra TV backing).
- **Diary** — dated site log entries with compressed photos.
- **More** — Bill of Quantities (68 tender items), progress claims in
  TENN's claim format with retention deduction, project details,
  CSV exports (buy list & BQ), JSON backup/restore.

**Area progress drives claims:** each area is linked to its BQ items, so
ticking stages updates BQ percentages automatically (never below what's
already certified in a claim). Generate a claim any time from More →
Progress Claims.

## Data

Everything is stored on-device (localStorage + IndexedDB) — no server,
fully offline once installed. Export a backup regularly from
**More → Export & Backup**. The BQ is the unpriced tender copy; enter
rates per item or import a priced CSV.

## Running it

Static site — any web server works, but a **service worker needs HTTPS or
localhost**:

```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

For phones, host on any HTTPS static host (GitHub Pages, Netlify, …),
open in Chrome/Safari and **Add to Home Screen**.

## Stack

Plain HTML/CSS/JS, no build step, no dependencies. Seed data in
`js/data.js`; app logic in `js/app.js`. Bump `CACHE_VERSION` in `sw.js`
when files change.
