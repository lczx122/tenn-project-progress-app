# TENN Site Tracker

Multi-user project progress tracker for TENN Fasteners — a self-hosted web
app the whole team shares: everyone signs in with their own account and sees
the same live data from any phone or computer.

Built with **zero npm dependencies**: Node.js built-ins only (`node:http`,
`node:sqlite`, `node:crypto`). One process, one SQLite file.

## Features

- **Team accounts** — first run creates the admin; admins add members and
  manage roles. Sessions are httpOnly cookies; passwords are scrypt-hashed.
- **Projects** — as many as you need, each with client and start/target dates.
- **Progress** — work groups → items with 0–100% progress; group and project
  percentages roll up automatically. Every update records who and when.
- **Materials** — procurement pipeline per project (To order → Sample pending
  → Ordered → Delivered → Installed / N/A) with spec, qty, category, notes,
  status filters, search, and bulk updates.
- **Site diary** — dated entries with photos (compressed client-side, stored
  on the server, only visible to logged-in users).
- **Activity feed** — every change by every member, newest first.
- **Live sync** — clients poll a per-project revision number and refresh when
  someone else changes something (a green dot pulses in the header).
- **CSV import/export** for both materials and work items.

## Running it

Requires Node.js 22.5+ (for the built-in SQLite).

```bash
npm start            # serves on http://localhost:3000
PORT=8080 npm start  # custom port
```

Data lives in `data/tracker.db` and `data/uploads/` (both gitignored) —
back that folder up. To run it for the team, deploy on any small VPS or
always-on machine and put it behind HTTPS (e.g. Caddy or nginx with
Let's Encrypt), then open the URL on each phone and Add to Home Screen.

First visit shows the **setup screen** — create the admin account, then add
your team members from the Team button.

## Layout

```
server/index.js   HTTP server: static files, /api router, /uploads
server/db.js      SQLite schema + sessions + activity/rev helpers
server/api.js     JSON API route handlers
public/           SPA (vanilla JS, no build step)
data/             SQLite DB + uploaded photos (gitignored)
```
