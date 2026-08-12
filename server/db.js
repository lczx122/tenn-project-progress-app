/* SQLite layer (built-in node:sqlite — no npm dependencies).
   The database lives in data/tracker.db; `data/` is gitignored. */
'use strict';
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'tracker.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password TEXT NOT NULL,           -- scrypt: salthex:hashhex
  role TEXT NOT NULL DEFAULT 'member',  -- 'admin' | 'member'
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  client TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  target_date TEXT NOT NULL DEFAULT '',
  rev INTEGER NOT NULL DEFAULT 0,   -- bumped on every mutation; clients poll this
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  progress INTEGER NOT NULL DEFAULT 0,  -- 0..100
  sort INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  spec TEXT NOT NULL DEFAULT '',
  qty TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|sample|ordered|delivered|installed|na
  note TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS diary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  diary_id INTEGER NOT NULL REFERENCES diary(id) ON DELETE CASCADE,
  filename TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_group ON items(group_id);
CREATE INDEX IF NOT EXISTS idx_materials_project ON materials(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_project ON activity(project_id, id);
`);

const now = () => new Date().toISOString();

/* ---------- passwords & sessions ---------- */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}
function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 90 * 86400000).toISOString(); // 90 days
  db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(token, userId, now(), expires);
  return token;
}
function sessionUser(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.role, s.expires_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ?`).get(token);
  if (!row) return null;
  if (row.expires_at < now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return { id: row.id, username: row.username, displayName: row.display_name, role: row.role };
}
function deleteSession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

/* ---------- activity + rev ---------- */
function touch(projectId, userName, text) {
  db.prepare('UPDATE projects SET rev = rev + 1 WHERE id = ?').run(projectId);
  if (text) {
    db.prepare('INSERT INTO activity (project_id, user_name, text, created_at) VALUES (?, ?, ?, ?)')
      .run(projectId, userName, text, now());
    // keep the feed bounded
    db.prepare(`DELETE FROM activity WHERE project_id = ? AND id NOT IN
      (SELECT id FROM activity WHERE project_id = ? ORDER BY id DESC LIMIT 500)`)
      .run(projectId, projectId);
  }
}

module.exports = { db, now, UPLOADS_DIR, hashPassword, verifyPassword, createSession, sessionUser, deleteSession, touch };
