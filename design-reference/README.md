# Handoff: Reno Tracker — Renovation Progress Tracking PWA

## Overview
A mobile app for tracking renovation works at "Faithview Gallery" (LOT 26662 Sales Gallery), phase by phase, separated by subcontractor. Core capabilities: supply/material tracking (stock, deliveries, reorder), a mandatory daily SOP report (site photos, manpower, material usage, work summary, issues), report history with PDF sharing, and a drawings library. Primary user: the site supervisor/contractor who logs daily reports. Must support multiple projects.

## Target: build as a PWA
The client explicitly wants this delivered as a **Progressive Web App**:
- Web app manifest (name "Reno Tracker", standalone display, theme color #0F766E, portrait)
- Service worker: offline-first shell caching; queue report submissions & photos while offline, sync when back online (site connectivity is unreliable)
- Camera access via input capture or getUserMedia for the daily site photos
- Installable on Android/iOS home screen; localStorage/IndexedDB for drafts
- Share target / Web Share API for "Share PDF" (WhatsApp is the primary share channel)

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, NOT production code to copy directly. Recreate these designs in the target codebase's environment and patterns; if none exists yet, a React + Vite (or Next.js) PWA with a service worker (e.g. vite-plugin-pwa/Workbox) is a sensible default.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and copy are final. Recreate pixel-perfectly. All interaction logic in `Reno Tracker App.dc.html` reflects intended behavior.

## Files
- `Reno Tracker App.dc.html` — **interactive prototype** (canonical reference). Open in a browser. Contains full state logic in a JS class at the bottom of the file (seed data, handlers, derived values).
- `Reno Tracker.dc.html` — static canvas of all 7 screens side by side in iPhone frames (includes screen 7 Drawings which is also in the interactive prototype).
- `ios-frame.jsx`, `support.js` — prototype scaffolding only; ignore for implementation.
- `uploads/gallery.pdf` (10 pp), `uploads/lobby.pdf` (13 pp) — real construction drawing sets to seed the Drawings library.

## Design Tokens
Colors:
- Primary/teal: #0F766E (dark hover #0B5A54); teal tint bg #E4F0EC; teal tint border #C6DED7
- Ink: #1B1F1E; secondary text: #6B7370; disabled/muted: #9AA09C, #8B897F
- App bg: #F6F5F3; card: #FFFFFF; card border: #E4E2DD; subtle fill: #EDEBE6; tab bar bg: #FCFBF9; hairline: #F0EEE9; empty bar: #D8D5CE
- Warning (low stock / incomplete): fg #B45309, deep #7A4A08, bg #FBF3E4, border #EBD9B4
- Info (in transit / ordered): fg #1E40AF, bg #E7EDF8
- Danger (blocked / stock deduction): #B3261E
- Toast bg: #1B1F1E

Typography: 'IBM Plex Sans' (400/500/600/700) for UI; 'IBM Plex Mono' 500 for all numerals (quantities, %, dates in movement log). Scale: 24px/700 screen titles, 21px/700 project name, 15px/600 card titles, 14px body, 13px secondary, 12px meta, 11px/600-700 badges & tags, 10px tab labels.

Spacing & shape: screen padding 20px; card padding 14–16px; gaps 8/12/14px; radius: 16px hero cards, 12px cards, 10px inputs/buttons, 8px inner tiles, 6px small chips/thumbs, 5px badges, 99px pills & progress bars. Progress bars: 8px (hero) / 5px (cards) tall, 4px segments.
Hit targets ≥44px. Min font 10px (tab labels only).

## Screens

### 1 · Home
- Header: "PROJECT" eyebrow + project name with ▼ (project switcher — multiple projects required), avatar circle (initials, teal bg).
- SOP card (teal #0F766E, white text): "TODAY'S SOP · {date}", "{n} of 5 done" pill, 4 step tiles (Photos/Manpower/Materials/Summary) with ✓ or · and dashed outline when pending; white CTA button → Daily report. Whole card tappable.
- Overall progress card: % (mono, teal), 8px bar, "{n} in progress · {n} of 16 done · target 30 Sep".
- SUBCON grid (2×2): name, trade · phase count, 5px progress bar. Tap → Phases filtered to that subcon.
- Alert rows (tappable): low-stock (warning style) → Supplies filtered Low; delivery (teal dot) → Supplies filtered In transit; Drawings row (PDF chit) → Drawings.

### 2 · Phases
- Filter chips: All {n} + one per subcon (active = teal filled).
- Sections: IN PROGRESS (amber header) / DONE (teal) / NOT STARTED (gray), each with count.
- In-progress card: name, % (mono), 5px bar, subcon tag (teal tint), status note (red #B3261E when blocked), "+5%" bump button (at ≥100% → moves to Done).
- Done row: strikethrough gray + ✓. Not-started row: name, subcon tag, "Start" button (→ in progress at 5%).
- Data: 16 phases — Faithview Meeting pre-condition check, Material Prep, Site Meeting with Sub-con, Backdrop 01–04, Reception Counter 01–02, Model House, Pantry, Toilet Glass (M&F), Sitting Area 01–02, Type Unit Signage A/B, Advertising Board. Subcons: Classic Home (carpentry), Fanmuli 定制 (custom joinery), Ah Kang (electrical), Hock Heng (glass & signage). CJK names must render.

### 3 · Supplies
- Search input (live filter), chips: All / Low stock · {n} (warning-tinted) / In transit · {n}.
- Item card: name, status badge (LOW — REORDER warning / ARRIVES {date} info / ORDERED info / OK teal), location line + qty "{stock} / {max} {unit}" (mono; amber when low), 5px stock bar (amber when ≤ min). Low items get amber border. Tap → detail.

### 4 · Supply Detail
- Back chevron + name. Hero stock card (amber-tinted when below min): STOCK ON SITE, badge (BELOW MINIMUM / IN TRANSIT / HEALTHY), big mono stock "{n} / {max} {unit} · min. {min}", bar, run-out estimate line.
- Reorder button (teal, full-width): "Reorder {qty} {unit} — RM {cost}" → creates PO, flips to "✓ Order placed — ETA {date}" info banner, adds movement row, updates list badge to ORDERED.
- DETAILS 2×2 grid: Location / Unit cost (RM) / Used by (subcon) / Spent to date.
- SUPPLIER card: name, lead time + last order, call ✆ and message ✉ buttons (WhatsApp).
- MOVEMENT list: date (mono) | event | delta (+teal / −red / — gray).

### 5 · Daily Report (SOP)
- Header: date · project · "{n} of 5 steps done" + 5-segment progress.
- Step 1 Site photos (min. 3): thumbnail grid + dashed "+" tile → camera. Status "✓ {n} added" / "{n} of 3".
- Step 2 Manpower: 2×2 stepper rows per subcon (− count +).
- Step 3 Material used: rows {material | − qty unit + | ×}, "+ Add material" (only materials with on-site stock; qty capped at stock; step 5 for meters, 1 for pcs). Note: "Stock levels update automatically when you submit".
- Step 4 Work done summary: textarea, required.
- Step 5 Issues/blockers: textarea, optional (counts toward 5-segment progress when filled).
- Submit: disabled gray "Submit report — {n} steps left" until steps 1–4 valid; then teal "Submit report". On submit: deduct stock (add movement rows, update spend), prepend report to History, mark today complete everywhere, toast "Report submitted · stock updated", navigate to History. One report per day; after submit button shows "✓ Submitted — {date}".

### 6 · History
- Month calendar: teal-tinted = complete day, amber-tinted = incomplete, filled = today (dark until submitted, teal after), gray = weekends/other month. Legend below.
- Report cards: date, badge (COMPLETE / NO MATERIAL LOG), meta "{photos} photos · {workers} workers · {summary}", actions View report / Share PDF ↗ (generate a shareable PDF of the daily report).

### 7 · Drawings
- Back chevron. Set cards: PDF chit, title (e.g. "LOT 26662 — Sales Gallery"), "{n} pages · Rev. {date}", linked-phase tags, page thumbnails, Open / Share ↗ / Link to phase. Dashed "+ Upload drawing" card (PDF, image, or photo of a sketch).
- Open → in-app PDF viewer. Note: the real drawing PDFs are heavy vector CAD files — pre-render page thumbnails server-side or via pdf.js worker.

## Navigation
Bottom tab bar (5): Home ⌂ / Phases ▤ / Supplies ▦ / Report ✎ / History ▭ — active tab teal, inactive #9AA09C. Replace glyphs with a proper icon set (e.g. Lucide) at ~18px. Supply Detail and Drawings are pushed views with back chevrons. Toast: dark pill above tab bar, auto-dismiss ~2.2s.

## State Management
Entities: Project { name, targetDate, phases[], supplies[], reports[], drawings[] }; Phase { name, subcon, status: todo|prog|done, pct, note }; Supply { name, unit, stock, max, min, location, supplier{name, leadTime, phone}, unitCost, usedBy, spentToDate, status: stock|transit, ordered, eta, movements[] }; Report { date, photos[], manpower{subcon:count}, materials[{supplyId, qty}], summary, issues, complete }; DailyDraft persisted locally until submitted.
Derived: overall % = mean of phase progress; subcon % = mean over its phases; low = stock ≤ min && !ordered; SOP done-count from draft. Validation: photos ≥ 3, manpower total > 0, ≥ 1 material row, summary non-empty; issues optional. One report per day.

## Assets
No brand imagery. Photo tiles in the prototype are gray gradient placeholders — real app uses camera captures. Drawing sets seeded from the two bundled PDFs. Fonts from Google Fonts (IBM Plex Sans, IBM Plex Mono).
