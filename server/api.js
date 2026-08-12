/* JSON API. All routes are same-origin; auth via httpOnly session cookie.
   Mutations bump the project rev and write an activity entry, so other
   devices pick changes up on their next poll. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { db, now, UPLOADS_DIR, hashPassword, verifyPassword, createSession, sessionUser, deleteSession, touch } = require('./db');

const MATERIAL_STATUSES = ['pending', 'sample', 'ordered', 'delivered', 'installed', 'na'];
const err = (status, message) => ({ _status: status, error: message });

/* naive in-memory login throttle: 10 failures / 10 min per username */
const loginFails = new Map();
function throttled(username) {
  const rec = loginFails.get(username);
  return rec && rec.count >= 10 && Date.now() - rec.first < 600000;
}
function recordFail(username) {
  const rec = loginFails.get(username);
  if (!rec || Date.now() - rec.first > 600000) loginFails.set(username, { count: 1, first: Date.now() });
  else rec.count++;
}

function userCount() { return db.prepare('SELECT COUNT(*) AS n FROM users').get().n; }

function projectSummary(p) {
  const items = db.prepare(`SELECT i.progress FROM items i JOIN groups g ON g.id = i.group_id WHERE g.project_id = ?`).all(p.id);
  const progress = items.length ? items.reduce((a, r) => a + r.progress, 0) / items.length : 0;
  const mats = db.prepare(`SELECT status, COUNT(*) AS n FROM materials WHERE project_id = ? GROUP BY status`).all(p.id);
  const matCounts = Object.fromEntries(mats.map(m => [m.status, m.n]));
  return {
    id: p.id, name: p.name, client: p.client, startDate: p.start_date, targetDate: p.target_date,
    rev: p.rev, progress: Math.round(progress * 10) / 10, itemCount: items.length, matCounts,
  };
}

function fullProject(id) {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!p) return null;
  const groups = db.prepare('SELECT * FROM groups WHERE project_id = ? ORDER BY sort, id').all(id).map(g => ({
    id: g.id, name: g.name,
    items: db.prepare('SELECT * FROM items WHERE group_id = ? ORDER BY sort, id').all(g.id).map(i => ({
      id: i.id, title: i.title, detail: i.detail, progress: i.progress,
      updatedAt: i.updated_at, updatedBy: i.updated_by,
    })),
  }));
  const materials = db.prepare('SELECT * FROM materials WHERE project_id = ? ORDER BY sort, id').all(id).map(m => ({
    id: m.id, name: m.name, spec: m.spec, qty: m.qty, category: m.category,
    status: m.status, note: m.note, updatedAt: m.updated_at, updatedBy: m.updated_by,
  }));
  const diary = db.prepare('SELECT * FROM diary WHERE project_id = ? ORDER BY date DESC, id DESC').all(id).map(d => ({
    id: d.id, date: d.date, text: d.text, createdBy: d.created_by,
    photos: db.prepare('SELECT id, filename FROM photos WHERE diary_id = ?').all(d.id),
  }));
  const activity = db.prepare('SELECT user_name, text, created_at FROM activity WHERE project_id = ? ORDER BY id DESC LIMIT 80').all(id)
    .map(a => ({ user: a.user_name, text: a.text, at: a.created_at }));
  return { ...projectSummary(p), groups, materials, diary, activity };
}

/* route table: 'METHOD /path/:param' -> handler(req, user, params, body) */
const routes = {

  /* ---------- auth & users ---------- */
  'GET /api/bootstrap': (req, user) => ({
    setupNeeded: userCount() === 0,
    me: user ? { id: user.id, username: user.username, displayName: user.displayName, role: user.role } : null,
  }),

  'POST /api/setup': (req, user, params, body) => {
    if (userCount() > 0) return err(403, 'Already set up');
    const { displayName, username, password } = body || {};
    if (!displayName?.trim() || !username?.trim() || !password || password.length < 6)
      return err(400, 'Name, username and a password of 6+ characters are required');
    db.prepare('INSERT INTO users (username, display_name, password, role, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(username.trim().toLowerCase(), displayName.trim(), hashPassword(password), 'admin', now());
    const u = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim().toLowerCase());
    return { _setCookie: createSession(u.id), ok: true };
  },

  'POST /api/login': (req, user, params, body) => {
    const { username, password } = body || {};
    const uname = String(username || '').trim().toLowerCase();
    if (throttled(uname)) return err(429, 'Too many attempts — try again later');
    const u = db.prepare('SELECT * FROM users WHERE username = ?').get(uname);
    if (!u || !verifyPassword(String(password || ''), u.password)) {
      recordFail(uname);
      return err(401, 'Wrong username or password');
    }
    loginFails.delete(uname);
    return { _setCookie: createSession(u.id), ok: true };
  },

  'POST /api/logout': (req, user) => {
    if (req.sessionToken) deleteSession(req.sessionToken);
    return { _clearCookie: true, ok: true };
  },

  'GET /api/users': (req, user) => {
    if (!user) return err(401, 'Login required');
    return db.prepare('SELECT id, username, display_name AS displayName, role FROM users ORDER BY id').all();
  },

  'POST /api/users': (req, user, params, body) => {
    if (!user) return err(401, 'Login required');
    if (user.role !== 'admin') return err(403, 'Admin only');
    const { displayName, username, password, role } = body || {};
    if (!displayName?.trim() || !username?.trim() || !password || password.length < 6)
      return err(400, 'Name, username and a password of 6+ characters are required');
    try {
      db.prepare('INSERT INTO users (username, display_name, password, role, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(username.trim().toLowerCase(), displayName.trim(), hashPassword(password),
             role === 'admin' ? 'admin' : 'member', now());
    } catch { return err(409, 'Username already taken'); }
    return { ok: true };
  },

  'PATCH /api/users/:id': (req, user, params, body) => {
    if (!user) return err(401, 'Login required');
    const targetId = Number(params.id);
    const isSelf = targetId === user.id;
    if (user.role !== 'admin' && !isSelf) return err(403, 'Admin only');
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
    if (!target) return err(404, 'No such user');
    if (body.password) {
      if (body.password.length < 6) return err(400, 'Password too short');
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(body.password), targetId);
    }
    if (body.displayName?.trim()) db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(body.displayName.trim(), targetId);
    if (body.role && user.role === 'admin' && !isSelf)
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(body.role === 'admin' ? 'admin' : 'member', targetId);
    return { ok: true };
  },

  'DELETE /api/users/:id': (req, user, params) => {
    if (!user || user.role !== 'admin') return err(403, 'Admin only');
    const targetId = Number(params.id);
    if (targetId === user.id) return err(400, 'Cannot delete yourself');
    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    return { ok: true };
  },

  /* ---------- projects ---------- */
  'GET /api/projects': (req, user) => {
    if (!user) return err(401, 'Login required');
    return db.prepare('SELECT * FROM projects ORDER BY id DESC').all().map(projectSummary);
  },

  'POST /api/projects': (req, user, params, body) => {
    if (!user) return err(401, 'Login required');
    if (!body.name?.trim()) return err(400, 'Project name required');
    db.prepare('INSERT INTO projects (name, client, start_date, target_date, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(body.name.trim(), body.client?.trim() || '', body.startDate || '', body.targetDate || '', now());
    const p = db.prepare('SELECT * FROM projects ORDER BY id DESC LIMIT 1').get();
    touch(p.id, user.displayName, `created the project`);
    return fullProject(p.id);
  },

  'GET /api/projects/:id': (req, user, params) => {
    if (!user) return err(401, 'Login required');
    return fullProject(Number(params.id)) || err(404, 'No such project');
  },

  'GET /api/projects/:id/rev': (req, user, params) => {
    if (!user) return err(401, 'Login required');
    const p = db.prepare('SELECT rev FROM projects WHERE id = ?').get(Number(params.id));
    return p ? { rev: p.rev } : err(404, 'No such project');
  },

  'PATCH /api/projects/:id': (req, user, params, body) => {
    if (!user) return err(401, 'Login required');
    const id = Number(params.id);
    const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!p) return err(404, 'No such project');
    db.prepare('UPDATE projects SET name = ?, client = ?, start_date = ?, target_date = ? WHERE id = ?')
      .run(body.name?.trim() || p.name, body.client ?? p.client, body.startDate ?? p.start_date, body.targetDate ?? p.target_date, id);
    touch(id, user.displayName, 'updated project details');
    return fullProject(id);
  },

  'DELETE /api/projects/:id': (req, user, params) => {
    if (!user || user.role !== 'admin') return err(403, 'Admin only');
    db.prepare('DELETE FROM projects WHERE id = ?').run(Number(params.id));
    return { ok: true };
  },

  /* ---------- groups & items ---------- */
  'POST /api/groups': (req, user, params, body) => {
    if (!user) return err(401, 'Login required');
    const pid = Number(body.projectId);
    if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(pid)) return err(404, 'No such project');
    if (!body.name?.trim()) return err(400, 'Group name required');
    const sort = db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM groups WHERE project_id = ?').get(pid).s;
    db.prepare('INSERT INTO groups (project_id, name, sort) VALUES (?, ?, ?)').run(pid, body.name.trim(), sort);
    touch(pid, user.displayName, `added group “${body.name.trim()}”`);
    return fullProject(pid);
  },

  'PATCH /api/groups/:id': (req, user, params, body) => {
    if (!user) return err(401, 'Login required');
    const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(Number(params.id));
    if (!g) return err(404, 'No such group');
    db.prepare('UPDATE groups SET name = ? WHERE id = ?').run(body.name?.trim() || g.name, g.id);
    touch(g.project_id, user.displayName, `renamed group to “${body.name?.trim()}”`);
    return fullProject(g.project_id);
  },

  'DELETE /api/groups/:id': (req, user, params) => {
    if (!user) return err(401, 'Login required');
    const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(Number(params.id));
    if (!g) return err(404, 'No such group');
    db.prepare('DELETE FROM groups WHERE id = ?').run(g.id);
    touch(g.project_id, user.displayName, `deleted group “${g.name}”`);
    return fullProject(g.project_id);
  },

  'POST /api/items': (req, user, params, body) => {
    if (!user) return err(401, 'Login required');
    const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(Number(body.groupId));
    if (!g) return err(404, 'No such group');
    if (!body.title?.trim()) return err(400, 'Title required');
    const sort = db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM items WHERE group_id = ?').get(g.id).s;
    db.prepare('INSERT INTO items (group_id, title, detail, progress, sort, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(g.id, body.title.trim(), body.detail?.trim() || '', 0, sort, now(), user.displayName);
    touch(g.project_id, user.displayName, `added “${body.title.trim()}” to ${g.name}`);
    return fullProject(g.project_id);
  },

  'PATCH /api/items/:id': (req, user, params, body) => {
    if (!user) return err(401, 'Login required');
    const i = db.prepare('SELECT i.*, g.project_id, g.name AS gname FROM items i JOIN groups g ON g.id = i.group_id WHERE i.id = ?')
      .get(Number(params.id));
    if (!i) return err(404, 'No such item');
    const fields = {
      title: body.title?.trim() ?? i.title,
      detail: body.detail ?? i.detail,
      progress: body.progress != null ? Math.max(0, Math.min(100, Math.round(Number(body.progress) || 0))) : i.progress,
    };
    db.prepare('UPDATE items SET title = ?, detail = ?, progress = ?, updated_at = ?, updated_by = ? WHERE id = ?')
      .run(fields.title, fields.detail, fields.progress, now(), user.displayName, i.id);
    const note = body.progress != null && fields.progress !== i.progress
      ? `set “${fields.title}” to ${fields.progress}%` : `edited “${fields.title}”`;
    touch(i.project_id, user.displayName, note);
    return fullProject(i.project_id);
  },

  'DELETE /api/items/:id': (req, user, params) => {
    if (!user) return err(401, 'Login required');
    const i = db.prepare('SELECT i.*, g.project_id FROM items i JOIN groups g ON g.id = i.group_id WHERE i.id = ?')
      .get(Number(params.id));
    if (!i) return err(404, 'No such item');
    db.prepare('DELETE FROM items WHERE id = ?').run(i.id);
    touch(i.project_id, user.displayName, `deleted “${i.title}”`);
    return fullProject(i.project_id);
  },

  /* ---------- materials ---------- */
  'POST /api/materials': (req, user, params, body) => {
    if (!user) return err(401, 'Login required');
    const pid = Number(body.projectId);
    if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(pid)) return err(404, 'No such project');
    if (!body.name?.trim()) return err(400, 'Material name required');
    const sort = db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM materials WHERE project_id = ?').get(pid).s;
    db.prepare(`INSERT INTO materials (project_id, name, spec, qty, category, status, note, sort, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(pid, body.name.trim(), body.spec?.trim() || '', body.qty?.trim() || '', body.category?.trim() || '',
           MATERIAL_STATUSES.includes(body.status) ? body.status : 'pending', body.note?.trim() || '',
           sort, now(), user.displayName);
    touch(pid, user.displayName, `added material “${body.name.trim()}”`);
    return fullProject(pid);
  },

  'PATCH /api/materials/:id': (req, user, params, body) => {
    if (!user) return err(401, 'Login required');
    const m = db.prepare('SELECT * FROM materials WHERE id = ?').get(Number(params.id));
    if (!m) return err(404, 'No such material');
    const status = MATERIAL_STATUSES.includes(body.status) ? body.status : m.status;
    db.prepare(`UPDATE materials SET name = ?, spec = ?, qty = ?, category = ?, status = ?, note = ?, updated_at = ?, updated_by = ?
      WHERE id = ?`)
      .run(body.name?.trim() || m.name, body.spec ?? m.spec, body.qty ?? m.qty, body.category ?? m.category,
           status, body.note ?? m.note, now(), user.displayName, m.id);
    touch(m.project_id, user.displayName,
      status !== m.status ? `“${body.name?.trim() || m.name}” → ${status}` : `edited material “${body.name?.trim() || m.name}”`);
    return fullProject(m.project_id);
  },

  'POST /api/materials/bulk': (req, user, params, body) => {
    if (!user) return err(401, 'Login required');
    const ids = Array.isArray(body.ids) ? body.ids.map(Number) : [];
    if (!ids.length || !MATERIAL_STATUSES.includes(body.status)) return err(400, 'ids and a valid status required');
    let pid = null;
    const stmt = db.prepare('UPDATE materials SET status = ?, updated_at = ?, updated_by = ? WHERE id = ?');
    for (const id of ids) {
      const m = db.prepare('SELECT project_id FROM materials WHERE id = ?').get(id);
      if (!m) continue;
      pid = m.project_id;
      stmt.run(body.status, now(), user.displayName, id);
    }
    if (pid == null) return err(404, 'No matching materials');
    touch(pid, user.displayName, `${ids.length} materials → ${body.status}`);
    return fullProject(pid);
  },

  'DELETE /api/materials/:id': (req, user, params) => {
    if (!user) return err(401, 'Login required');
    const m = db.prepare('SELECT * FROM materials WHERE id = ?').get(Number(params.id));
    if (!m) return err(404, 'No such material');
    db.prepare('DELETE FROM materials WHERE id = ?').run(m.id);
    touch(m.project_id, user.displayName, `deleted material “${m.name}”`);
    return fullProject(m.project_id);
  },

  /* ---------- diary (photos arrive as data URLs, stored as files) ---------- */
  'POST /api/diary': (req, user, params, body) => {
    if (!user) return err(401, 'Login required');
    const pid = Number(body.projectId);
    if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(pid)) return err(404, 'No such project');
    const text = body.text?.trim() || '';
    const photos = Array.isArray(body.photos) ? body.photos.slice(0, 10) : [];
    if (!text && !photos.length) return err(400, 'Add a note or a photo');
    db.prepare('INSERT INTO diary (project_id, date, text, created_by, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(pid, body.date || now().slice(0, 10), text, user.displayName, now());
    const entry = db.prepare('SELECT id FROM diary ORDER BY id DESC LIMIT 1').get();
    for (const dataUrl of photos) {
      const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(String(dataUrl));
      if (!m) continue;
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > 8 * 1024 * 1024) continue; // 8MB cap per photo
      const filename = `${crypto.randomBytes(12).toString('hex')}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), buf);
      db.prepare('INSERT INTO photos (diary_id, filename) VALUES (?, ?)').run(entry.id, filename);
    }
    touch(pid, user.displayName, `added a diary entry${photos.length ? ` (${photos.length} photo${photos.length > 1 ? 's' : ''})` : ''}`);
    return fullProject(pid);
  },

  'DELETE /api/diary/:id': (req, user, params) => {
    if (!user) return err(401, 'Login required');
    const d = db.prepare('SELECT * FROM diary WHERE id = ?').get(Number(params.id));
    if (!d) return err(404, 'No such entry');
    if (user.role !== 'admin' && d.created_by !== user.displayName) return err(403, 'Only the author or an admin can delete this');
    for (const ph of db.prepare('SELECT filename FROM photos WHERE diary_id = ?').all(d.id)) {
      try { fs.unlinkSync(path.join(UPLOADS_DIR, ph.filename)); } catch {}
    }
    db.prepare('DELETE FROM diary WHERE id = ?').run(d.id);
    touch(d.project_id, user.displayName, 'deleted a diary entry');
    return fullProject(d.project_id);
  },
};

/* match 'METHOD /a/b/:x' patterns */
function handle(req, method, pathname, body) {
  for (const [key, fn] of Object.entries(routes)) {
    const [m, pattern] = key.split(' ');
    if (m !== method) continue;
    const patParts = pattern.split('/');
    const parts = pathname.split('/');
    if (patParts.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < patParts.length; i++) {
      if (patParts[i].startsWith(':')) params[patParts[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (patParts[i] !== parts[i]) { ok = false; break; }
    }
    if (!ok) continue;
    const user = sessionUser(req.sessionToken);
    return fn(req, user, params, body);
  }
  return err(404, 'Not found');
}

module.exports = { handle, MATERIAL_STATUSES };
