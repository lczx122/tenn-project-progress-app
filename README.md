# TENN · Ambience Bukit Baru Showroom — Progress Tracker (PWA)

An offline-first Progressive Web App for tracking site progress on the
**Lot 26662, Bukit Baru Sales Gallery — ID Works** project, from BQ to final claim.

## Features

- **Dashboard** — contract sum, work-done value, claimed-to-date, overall and
  per-section progress, days remaining to target completion.
- **BQ** — bill of quantities grouped by section (Show Unit Type A / Type B /
  Common Area, editable). Tap any item to update its progress % with a slider
  or quick buttons. Add/edit/delete sections and items freely.
- **Claims** — one tap generates the next progress claim from all unclaimed
  progress, in TENN's standard claim format (Item / Description / Unit / Qty /
  Rate / Amount / Previous / This / Total claim %). View as a printable
  statement (print → save as PDF) or export CSV. Certified progress is locked
  so item progress can't be wound back below what was already claimed.
- **Site Diary** — dated log entries with compressed site photos, stored on
  device.
- **Setup** — project details, CSV import of the real BQ
  (`Section, Code, Description, Unit, Qty, Rate`), CSV export, and full
  JSON backup/restore.

## Data

Everything is stored locally on the device (localStorage + IndexedDB) — no
server, works fully offline once installed. Use **Setup → Export backup**
regularly to keep a copy.

The seeded BQ mirrors TENN's usual sales-gallery ID-works structure with
rates left at 0 — fill them in from the received BQ, or import the whole BQ
as CSV (**Setup → Download template** gives the current BQ as a starting file).

## Running it

It's a static site — any web server works, but a **service worker needs
HTTPS or localhost**:

```bash
# local preview
python3 -m http.server 8080
# then open http://localhost:8080
```

For phone use, host it on any static host with HTTPS (GitHub Pages, Netlify,
Cloudflare Pages…). Open the URL in Chrome/Safari on the phone and choose
**Add to Home Screen** — it installs like an app and works offline on site.

## Stack

Plain HTML/CSS/JS, no build step, no dependencies. `sw.js` pre-caches the app
shell (bump `CACHE_VERSION` when files change).
