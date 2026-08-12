/* TENN Site Tracker — SPA client.
   All data lives on the server (shared by the whole team). The client
   keeps a rev number per project and polls it, refetching when another
   user changed something. */
'use strict';

const POLL_MS = Number(new URLSearchParams(location.search).get('poll')) || 8000;

const MATERIAL_STATUSES = [
  { k: 'pending',   label: 'To order',       color: '#64748b' },
  { k: 'sample',    label: 'Sample pending', color: '#d97706' },
  { k: 'ordered',   label: 'Ordered',        color: '#2563eb' },
  { k: 'delivered', label: 'Delivered',      color: '#7c3aed' },
  { k: 'installed', label: 'Installed',      color: '#0e9f6e' },
  { k: 'na',        label: 'N/A',            color: '#98a2b3' },
];
const statusOf = k => MATERIAL_STATUSES.find(s => s.k === k) || MATERIAL_STATUSES[0];

let me = null;
let projects = [];
let project = null;          // full project currently open
let tab = 'progress';
let matFilter = { status: 'ALL', q: '' };
let selectMode = false;
let selected = new Set();
let pollTimer = null;

const app = document.getElementById('app');
const modalRoot = document.getElementById('modalRoot');

/* ============================== API ============================== */
async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body != null ? { 'Content-Type': 'application/json' } : {},
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (res.status === 401 && !path.startsWith('/api/login') && !path.startsWith('/api/bootstrap')) {
    me = null; stopPoll(); renderAuth(false);
    throw new Error('Login required');
  }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function today() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}
function ago(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return fmtDate(iso);
}
function initials(name) { return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase(); }

/* ============================== Boot & auth ============================== */
async function boot() {
  try {
    const b = await api('GET', '/api/bootstrap');
    if (b.setupNeeded) return renderAuth(true);
    if (!b.me) return renderAuth(false);
    me = b.me;
    await showProjects();
  } catch (e) {
    app.innerHTML = `<div class="auth-wrap"><div class="auth-card"><h1>Cannot reach server</h1>
      <p class="sub">${esc(e.message)}</p><button class="btn block" onclick="location.reload()">Retry</button></div></div>`;
  }
}

function renderAuth(setup) {
  document.body.classList.remove('has-tabbar');
  stopPoll();
  app.innerHTML = `
    <div class="auth-wrap"><div class="auth-card">
      <div class="brand-row"><span class="brand-mark">TENN</span><h1>Site Tracker</h1></div>
      <p class="sub">${setup
        ? 'First run — create the admin account for your team.'
        : 'Sign in with your team account.'}</p>
      <div id="authErr"></div>
      ${setup ? `<div class="field"><label>Your name</label><input id="aName" placeholder="e.g. Ah Chong" autocomplete="name"></div>` : ''}
      <div class="field"><label>Username</label><input id="aUser" autocomplete="username" autocapitalize="none"></div>
      <div class="field"><label>Password ${setup ? '(6+ characters)' : ''}</label><input id="aPass" type="password" autocomplete="${setup ? 'new-password' : 'current-password'}"></div>
      <button class="btn accent block" id="aGo">${setup ? 'Create admin account' : 'Sign in'}</button>
    </div></div>`;

  const go = async () => {
    const body = {
      username: document.getElementById('aUser').value.trim(),
      password: document.getElementById('aPass').value,
    };
    if (setup) body.displayName = document.getElementById('aName').value.trim();
    try {
      await api('POST', setup ? '/api/setup' : '/api/login', body);
      const b = await api('GET', '/api/bootstrap');
      me = b.me;
      await showProjects();
    } catch (e) {
      document.getElementById('authErr').innerHTML = `<div class="auth-err">${esc(e.message)}</div>`;
    }
  };
  document.getElementById('aGo').addEventListener('click', go);
  app.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }));
}

/* ============================== Projects home ============================== */
async function showProjects() {
  stopPoll();
  project = null;
  projects = await api('GET', '/api/projects');
  document.body.classList.remove('has-tabbar');
  app.innerHTML = `
    <header class="app-header"><div class="header-inner">
      <span class="brand-mark">TENN</span>
      <div class="header-title"><h1>Site Tracker</h1><p>Signed in as ${esc(me.displayName)}</p></div>
      <button class="header-btn" id="teamBtn">Team</button>
      <button class="header-btn" id="logoutBtn">Log out</button>
    </div></header>
    <main class="view">
      ${projects.map(p => `
        <div class="proj-card" data-proj="${p.id}">
          <div class="proj-head"><b>${esc(p.name)}</b><span class="pct">${Math.round(p.progress)}%</span></div>
          <div class="proj-sub">${esc(p.client || 'No client set')} · ${p.itemCount} work items${p.targetDate ? ` · target ${fmtDate(p.targetDate)}` : ''}</div>
          <div class="bar"><i style="width:${p.progress}%"></i></div>
        </div>`).join('') || '<p class="empty-note">No projects yet — create the first one.</p>'}
      <button class="btn accent block" id="newProj">+ New Project</button>
    </main>`;

  document.getElementById('logoutBtn').addEventListener('click', async () => { await api('POST', '/api/logout'); renderAuth(false); });
  document.getElementById('teamBtn').addEventListener('click', openTeamModal);
  document.getElementById('newProj').addEventListener('click', () => openProjectForm(null));
  app.querySelectorAll('[data-proj]').forEach(el => el.addEventListener('click', () => openProject(Number(el.dataset.proj))));
}

function openProjectForm(existing) {
  modal(`
    <div class="modal-head"><h3>${existing ? 'Edit Project' : 'New Project'}</h3><button class="modal-close">✕</button></div>
    <div class="field"><label>Project name</label><input id="pName" value="${esc(existing?.name || '')}" placeholder="e.g. Bukit Baru Sales Gallery — ID Works"></div>
    <div class="field"><label>Client</label><input id="pClient" value="${esc(existing?.client || '')}"></div>
    <div class="field-row">
      <div class="field"><label>Start date</label><input type="date" id="pStart" value="${esc(existing?.startDate || today())}"></div>
      <div class="field"><label>Target completion</label><input type="date" id="pTarget" value="${esc(existing?.targetDate || '')}"></div>
    </div>
    <div class="modal-actions">
      ${existing && me.role === 'admin' ? '<button class="btn danger" id="delProj">Delete</button>' : ''}
      <button class="btn accent" id="saveProj">${existing ? 'Save' : 'Create'}</button>
    </div>
  `, root => {
    root.querySelector('#saveProj').addEventListener('click', async () => {
      const body = {
        name: root.querySelector('#pName').value.trim(),
        client: root.querySelector('#pClient').value.trim(),
        startDate: root.querySelector('#pStart').value,
        targetDate: root.querySelector('#pTarget').value,
      };
      if (!body.name) return toast('Project name is required');
      try {
        const p = existing ? await api('PATCH', `/api/projects/${existing.id}`, body)
                           : await api('POST', '/api/projects', body);
        closeModal();
        setProject(p);
        renderProject();
      } catch (e) { toast(e.message); }
    });
    root.querySelector('#delProj')?.addEventListener('click', async () => {
      if (!confirm(`Delete project “${existing.name}” and ALL its data for everyone? This cannot be undone.`)) return;
      if (!confirm('Really sure?')) return;
      try { await api('DELETE', `/api/projects/${existing.id}`); closeModal(); await showProjects(); toast('Project deleted'); }
      catch (e) { toast(e.message); }
    });
  });
}

/* ============================== Team ============================== */
async function openTeamModal() {
  let users;
  try { users = await api('GET', '/api/users'); } catch (e) { return toast(e.message); }
  const admin = me.role === 'admin';
  modal(`
    <div class="modal-head"><h3>Team</h3><button class="modal-close">✕</button></div>
    <div class="card list-flush" style="box-shadow:none;border:1px solid var(--line)">
      ${users.map(u => `
        <div class="user-row">
          <span class="avatar">${esc(initials(u.displayName))}</span>
          <div class="user-info"><b>${esc(u.displayName)}</b><small>@${esc(u.username)}</small></div>
          <span class="role-tag ${u.role}">${u.role}</span>
          ${admin && u.id !== me.id ? `<button class="btn ghost sm" data-deluser="${u.id}">Remove</button>` : ''}
          ${u.id === me.id ? `<button class="btn ghost sm" id="chgPass">Password</button>` : ''}
        </div>`).join('')}
    </div>
    ${admin ? `
    <h3 style="font-size:14px;margin:16px 0 10px">Add team member</h3>
    <div class="field-row">
      <div class="field"><label>Name</label><input id="nuName"></div>
      <div class="field"><label>Username</label><input id="nuUser" autocapitalize="none"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Password (6+)</label><input id="nuPass" type="password" autocomplete="new-password"></div>
      <div class="field"><label>Role</label><select id="nuRole"><option value="member">Member</option><option value="admin">Admin</option></select></div>
    </div>
    <div class="modal-actions"><button class="btn accent" id="addUser">Add member</button></div>` : '<div class="modal-pad-end"></div>'}
  `, root => {
    root.querySelector('#addUser')?.addEventListener('click', async () => {
      try {
        await api('POST', '/api/users', {
          displayName: root.querySelector('#nuName').value.trim(),
          username: root.querySelector('#nuUser').value.trim(),
          password: root.querySelector('#nuPass').value,
          role: root.querySelector('#nuRole').value,
        });
        closeModal(); toast('Member added'); openTeamModal();
      } catch (e) { toast(e.message); }
    });
    root.querySelectorAll('[data-deluser]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Remove this member? They will be logged out everywhere.')) return;
      try { await api('DELETE', `/api/users/${b.dataset.deluser}`); closeModal(); openTeamModal(); } catch (e) { toast(e.message); }
    }));
    root.querySelector('#chgPass')?.addEventListener('click', () => {
      closeModal();
      modal(`
        <div class="modal-head"><h3>Change Password</h3><button class="modal-close">✕</button></div>
        <div class="field"><label>New password (6+)</label><input id="npw" type="password" autocomplete="new-password"></div>
        <div class="modal-actions"><button class="btn accent" id="npwGo">Change</button></div>
      `, r2 => r2.querySelector('#npwGo').addEventListener('click', async () => {
        try { await api('PATCH', `/api/users/${me.id}`, { password: r2.querySelector('#npw').value }); closeModal(); toast('Password changed'); }
        catch (e) { toast(e.message); }
      }));
    });
  });
}

/* ============================== Project view ============================== */
function setProject(p) { project = p; }

async function openProject(id) {
  try { setProject(await api('GET', `/api/projects/${id}`)); }
  catch (e) { return toast(e.message); }
  tab = 'progress';
  matFilter = { status: 'ALL', q: '' };
  selectMode = false; selected.clear();
  renderProject();
  startPoll();
}

function projectPct() {
  const items = project.groups.flatMap(g => g.items);
  return items.length ? items.reduce((a, i) => a + i.progress, 0) / items.length : 0;
}
function groupPct(g) {
  return g.items.length ? g.items.reduce((a, i) => a + i.progress, 0) / g.items.length : 0;
}

function renderProject() {
  document.body.classList.add('has-tabbar');
  const pct = projectPct();
  app.innerHTML = `
    <header class="app-header"><div class="header-inner">
      <button class="header-btn" id="backBtn">←</button>
      <div class="header-title"><h1>${esc(project.name)}</h1><p>${esc(project.client || '')}</p></div>
      <span class="sync-dot" id="syncDot" title="live"></span>
      <span class="header-pct">${Math.round(pct)}%</span>
    </div></header>
    <main class="view" id="tabView"></main>
    <nav class="tabbar">
      ${[['progress', 'Progress', 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z'],
         ['materials', 'Materials', 'M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7.2 14h9.9c.75 0 1.41-.42 1.75-1.03L22 6H6.2l-.94-2H2v2h2l3.6 7.59-1.35 2.44C5.52 17.37 6.48 19 8 19h12v-2H8l1.1-2H7.2z'],
         ['diary', 'Diary', 'M19 3h-1V1h-2v2H8V1H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H5V9h14v10zM5 7V5h14v2H5z'],
         ['activity', 'Activity', 'M13 3a9 9 0 0 0-9 9H1l3.9 3.9L9 12H6a7 7 0 1 1 2.1 5L6.7 18.4A9 9 0 1 0 13 3zm-1 5v5l4.3 2.5.7-1.2-3.5-2.1V8H12z'],
         ['settings', 'Setup', 'M19.14 12.94a7 7 0 0 0 0-1.88l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7 7 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.56-1.63.94l-2.39-.96a.5.5 0 0 0-.61.22L2.63 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7 7 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.61.22l2.39-.96c.5.38 1.04.7 1.63.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54a7 7 0 0 0 1.63-.94l2.39.96c.21.1.48.01.61-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z']]
        .map(([k, label, d]) => `
        <button class="tab ${tab === k ? 'active' : ''}" data-tab="${k}">
          <svg viewBox="0 0 24 24"><path d="${d}"/></svg><span>${label}</span>
        </button>`).join('')}
    </nav>`;

  document.getElementById('backBtn').addEventListener('click', showProjects);
  app.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => { tab = t.dataset.tab; renderTab(); }));
  renderTab();
  startPoll(); // idempotent — every path into the project view keeps sync alive
}

function renderTab() {
  app.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  const headerPct = app.querySelector('.header-pct');
  if (headerPct) headerPct.textContent = Math.round(projectPct()) + '%';
  ({ progress: renderProgress, materials: renderMaterials, diary: renderDiary, activity: renderActivity, settings: renderSettings }[tab])();
}
const tabView = () => document.getElementById('tabView');

/* ---------- Progress tab ---------- */
function renderProgress() {
  tabView().innerHTML = `
    ${project.groups.map(g => {
      const gp = groupPct(g);
      return `<div class="group-card">
        <div class="group-head">
          <b>${esc(g.name)}</b>
          <div class="bar mini" style="width:70px"><i style="width:${gp}%"></i></div>
          <span class="pct">${Math.round(gp)}%</span>
        </div>
        ${g.items.map(i => `
          <div class="item-row" data-item="${i.id}">
            <div class="item-info"><b>${esc(i.title)}</b>
              <small>${i.updatedBy ? `${esc(i.updatedBy)} · ${ago(i.updatedAt)}` : 'not started'}</small></div>
            <div class="bar item-bar"><i style="width:${i.progress}%"></i></div>
            <span class="item-pct ${i.progress >= 100 ? 'done' : ''}">${i.progress}%</span>
          </div>`).join('')}
        <div class="group-foot">
          <button class="btn ghost sm" data-additem="${g.id}">+ Item</button>
          <button class="btn ghost sm" data-editgroup="${g.id}">Rename</button>
          <div class="spacer" style="flex:1"></div>
          <button class="btn ghost sm" data-delgroup="${g.id}">Delete</button>
        </div>
      </div>`;
    }).join('') || '<p class="empty-note">No work groups yet. Add one — e.g. “Main Lobby”, “Show Unit Type A”.</p>'}
    <button class="btn block" id="addGroup">+ Add Group</button>
  `;
  document.getElementById('addGroup').addEventListener('click', () => promptText('New group name', '', async name => {
    setProject(await api('POST', '/api/groups', { projectId: project.id, name })); renderTab();
  }));
  tabView().querySelectorAll('[data-additem]').forEach(b => b.addEventListener('click', () => openItemForm(Number(b.dataset.additem), null)));
  tabView().querySelectorAll('[data-editgroup]').forEach(b => b.addEventListener('click', () => {
    const g = project.groups.find(x => x.id === Number(b.dataset.editgroup));
    promptText('Rename group', g.name, async name => {
      setProject(await api('PATCH', `/api/groups/${g.id}`, { name })); renderTab();
    });
  }));
  tabView().querySelectorAll('[data-delgroup]').forEach(b => b.addEventListener('click', async () => {
    const g = project.groups.find(x => x.id === Number(b.dataset.delgroup));
    if (!confirm(`Delete group “${g.name}” and its ${g.items.length} item(s)?`)) return;
    try { setProject(await api('DELETE', `/api/groups/${g.id}`)); renderTab(); } catch (e) { toast(e.message); }
  }));
  tabView().querySelectorAll('[data-item]').forEach(el => el.addEventListener('click', () => openItemModal(Number(el.dataset.item))));
}

function findItem(id) {
  for (const g of project.groups) {
    const it = g.items.find(i => i.id === id);
    if (it) return { group: g, item: it };
  }
  return null;
}

function openItemModal(id) {
  const found = findItem(id);
  if (!found) return;
  const { item } = found;
  modal(`
    <div class="modal-head"><h3>Update Progress</h3><button class="modal-close">✕</button></div>
    <p style="font-size:14px;font-weight:700">${esc(item.title)}</p>
    ${item.detail ? `<p class="dim" style="font-size:12.5px;margin-top:3px">${esc(item.detail)}</p>` : ''}
    ${item.updatedBy ? `<p class="dim" style="font-size:11.5px;margin-top:4px">Last update: ${esc(item.updatedBy)} · ${ago(item.updatedAt)}</p>` : ''}
    <div class="pct-display"><span id="pctNum">${item.progress}</span><small>%</small></div>
    <input type="range" class="pct-slider" id="pctSlider" min="0" max="100" step="1" value="${item.progress}">
    <div class="quick-pcts">${[0, 25, 50, 75, 90, 100].map(q => `<button data-q="${q}">${q}</button>`).join('')}</div>
    <div class="modal-actions">
      <button class="btn ghost" id="editItem">Edit</button>
      <button class="btn accent" id="savePct">Save</button>
    </div>
  `, root => {
    const slider = root.querySelector('#pctSlider');
    const num = root.querySelector('#pctNum');
    slider.addEventListener('input', () => num.textContent = slider.value);
    root.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { slider.value = b.dataset.q; num.textContent = b.dataset.q; }));
    root.querySelector('#savePct').addEventListener('click', async () => {
      try { setProject(await api('PATCH', `/api/items/${item.id}`, { progress: Number(slider.value) })); closeModal(); renderTab(); }
      catch (e) { toast(e.message); }
    });
    root.querySelector('#editItem').addEventListener('click', () => { closeModal(); openItemForm(found.group.id, item.id); });
  });
}

function openItemForm(groupId, itemId) {
  const item = itemId ? findItem(itemId)?.item : null;
  modal(`
    <div class="modal-head"><h3>${item ? 'Edit Item' : 'Add Work Item'}</h3><button class="modal-close">✕</button></div>
    <div class="field"><label>Title</label><input id="iTitle" value="${esc(item?.title || '')}" placeholder="e.g. Reception counter fabrication"></div>
    <div class="field"><label>Detail (optional)</label><textarea id="iDetail" rows="3">${esc(item?.detail || '')}</textarea></div>
    <div class="modal-actions">
      ${item ? '<button class="btn danger" id="delItem">Delete</button>' : ''}
      <button class="btn accent" id="saveItem">${item ? 'Save' : 'Add'}</button>
    </div>
  `, root => {
    root.querySelector('#saveItem').addEventListener('click', async () => {
      const title = root.querySelector('#iTitle').value.trim();
      const detail = root.querySelector('#iDetail').value.trim();
      if (!title) return toast('Title is required');
      try {
        setProject(item ? await api('PATCH', `/api/items/${item.id}`, { title, detail })
                        : await api('POST', '/api/items', { groupId, title, detail }));
        closeModal(); renderTab();
      } catch (e) { toast(e.message); }
    });
    root.querySelector('#delItem')?.addEventListener('click', async () => {
      if (!confirm('Delete this item?')) return;
      try { setProject(await api('DELETE', `/api/items/${item.id}`)); closeModal(); renderTab(); } catch (e) { toast(e.message); }
    });
  });
}

/* ---------- Materials tab ---------- */
function renderMaterials() {
  const counts = Object.fromEntries(MATERIAL_STATUSES.map(s => [s.k, 0]));
  for (const m of project.materials) counts[m.status]++;
  tabView().innerHTML = `
    <div class="pills">
      <button class="pill ${matFilter.status === 'ALL' ? 'on' : ''}" data-mf="ALL">All ${project.materials.length}</button>
      ${MATERIAL_STATUSES.map(s => `<button class="pill ${matFilter.status === s.k ? 'on' : ''}" data-mf="${s.k}">${s.label} ${counts[s.k]}</button>`).join('')}
    </div>
    <div class="toolbar">
      <input type="search" id="matSearch" placeholder="Search materials…" value="${esc(matFilter.q)}">
      <button class="btn ghost sm" id="selBtn">${selectMode ? 'Cancel' : 'Select'}</button>
      <button class="btn sm" id="addMat">+ Add</button>
    </div>
    <div class="card list-flush" id="matList"></div>
    ${selectMode ? `<div class="bulk-bar">
      <span><b id="selCount">${selected.size}</b> selected</span>
      <button class="btn ghost sm" id="selAll">All shown</button>
      <select id="bulkStatus">${MATERIAL_STATUSES.map(s => `<option value="${s.k}">${s.label}</option>`).join('')}</select>
      <button class="btn accent sm" id="bulkApply">Apply</button>
    </div>` : ''}
  `;
  tabView().querySelectorAll('[data-mf]').forEach(b => b.addEventListener('click', () => {
    matFilter.status = b.dataset.mf; renderMaterials();
  }));
  const search = document.getElementById('matSearch');
  search.addEventListener('input', () => {
    matFilter.q = search.value;
    clearTimeout(search._t);
    search._t = setTimeout(paintMatList, 200);
  });
  document.getElementById('selBtn').addEventListener('click', () => { selectMode = !selectMode; selected.clear(); renderMaterials(); });
  document.getElementById('addMat').addEventListener('click', () => openMaterialForm(null));
  if (selectMode) {
    document.getElementById('selAll').addEventListener('click', () => { filteredMats().forEach(m => selected.add(m.id)); paintMatList(); });
    document.getElementById('bulkApply').addEventListener('click', async () => {
      if (!selected.size) return toast('Nothing selected');
      const status = document.getElementById('bulkStatus').value;
      try {
        setProject(await api('POST', '/api/materials/bulk', { ids: [...selected], status }));
        selectMode = false; selected.clear(); renderTab();
        toast(`Updated ${statusOf(status).label}`);
      } catch (e) { toast(e.message); }
    });
  }
  paintMatList();
}

function filteredMats() {
  return project.materials.filter(m => {
    if (matFilter.status !== 'ALL' && m.status !== matFilter.status) return false;
    if (matFilter.q && !(m.name + ' ' + m.spec + ' ' + m.category).toLowerCase().includes(matFilter.q.toLowerCase())) return false;
    return true;
  });
}

function paintMatList() {
  const wrap = document.getElementById('matList');
  if (!wrap) return;
  const mats = filteredMats();
  wrap.innerHTML = mats.map(m => {
    const st = statusOf(m.status);
    return `<div class="mat-row ${selected.has(m.id) ? 'selected' : ''}" data-mat="${m.id}">
      ${selectMode ? `<span class="sel-box">${selected.has(m.id) ? '☑' : '☐'}</span>` : ''}
      <div class="mat-info"><b>${esc(m.name)}</b>
        <small>${[m.spec, m.qty, m.category].filter(Boolean).map(esc).join(' · ')}${m.note ? ` · 📝 ${esc(m.note)}` : ''}</small>
        <small class="dim">${m.updatedBy ? `${esc(m.updatedBy)} · ${ago(m.updatedAt)}` : ''}</small></div>
      <span class="status-chip" style="background:${st.color}">${st.label}</span>
    </div>`;
  }).join('') || '<p class="empty-note">No materials yet — add them or import a CSV in Setup.</p>';

  wrap.querySelectorAll('.mat-row').forEach(row => row.addEventListener('click', () => {
    const id = Number(row.dataset.mat);
    if (selectMode) {
      selected.has(id) ? selected.delete(id) : selected.add(id);
      row.classList.toggle('selected');
      const box = row.querySelector('.sel-box');
      if (box) box.textContent = selected.has(id) ? '☑' : '☐';
      const c = document.getElementById('selCount');
      if (c) c.textContent = selected.size;
      return;
    }
    openMaterialForm(project.materials.find(m => m.id === id));
  }));
}

function openMaterialForm(m) {
  let sel = m?.status || 'pending';
  modal(`
    <div class="modal-head"><h3>${m ? 'Material' : 'Add Material'}</h3><button class="modal-close">✕</button></div>
    <div class="field"><label>Name</label><input id="mName" value="${esc(m?.name || '')}" placeholder="e.g. Volakas marble laminate TP7-53011G"></div>
    <div class="field"><label>Spec / size (optional)</label><input id="mSpec" value="${esc(m?.spec || '')}"></div>
    <div class="field-row">
      <div class="field"><label>Qty</label><input id="mQty" value="${esc(m?.qty || '')}" placeholder="e.g. ±10 sheets"></div>
      <div class="field"><label>Category</label><input id="mCat" value="${esc(m?.category || '')}" list="catList" placeholder="e.g. Laminate">
        <datalist id="catList">${[...new Set(project.materials.map(x => x.category).filter(Boolean))].map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
    </div>
    <div class="status-grid">
      ${MATERIAL_STATUSES.map(s => `<button class="status-btn ${sel === s.k ? 'on' : ''}" data-st="${s.k}" style="--c:${s.color}">${s.label}</button>`).join('')}
    </div>
    <div class="field"><label>Note (PO no., supplier, ETA…)</label><textarea id="mNote" rows="2">${esc(m?.note || '')}</textarea></div>
    <div class="modal-actions">
      ${m ? '<button class="btn danger" id="delMat">Delete</button>' : ''}
      <button class="btn accent" id="saveMat">${m ? 'Save' : 'Add'}</button>
    </div>
  `, root => {
    root.querySelectorAll('.status-btn').forEach(b => b.addEventListener('click', () => {
      sel = b.dataset.st;
      root.querySelectorAll('.status-btn').forEach(x => x.classList.toggle('on', x.dataset.st === sel));
    }));
    root.querySelector('#saveMat').addEventListener('click', async () => {
      const body = {
        name: root.querySelector('#mName').value.trim(),
        spec: root.querySelector('#mSpec').value.trim(),
        qty: root.querySelector('#mQty').value.trim(),
        category: root.querySelector('#mCat').value.trim(),
        note: root.querySelector('#mNote').value.trim(),
        status: sel,
      };
      if (!body.name) return toast('Name is required');
      try {
        setProject(m ? await api('PATCH', `/api/materials/${m.id}`, body)
                     : await api('POST', '/api/materials', { projectId: project.id, ...body }));
        closeModal(); renderTab();
      } catch (e) { toast(e.message); }
    });
    root.querySelector('#delMat')?.addEventListener('click', async () => {
      if (!confirm('Delete this material?')) return;
      try { setProject(await api('DELETE', `/api/materials/${m.id}`)); closeModal(); renderTab(); } catch (e) { toast(e.message); }
    });
  });
}

/* ---------- Diary tab ---------- */
function renderDiary() {
  tabView().innerHTML = `
    <div class="card">
      <h2>New Entry</h2>
      <div class="field"><label>Date</label><input type="date" id="dDate" value="${today()}"></div>
      <div class="field"><label>Notes — work done, manpower, deliveries, issues</label>
        <textarea id="dText" rows="3"></textarea></div>
      <div class="field"><label>Site photos</label><input type="file" id="dPhotos" accept="image/*" multiple></div>
      <button class="btn accent block" id="addEntry">Add Entry</button>
    </div>
    <div class="card list-flush">
      <h2>Site Log</h2>
      ${project.diary.map(d => `
        <div class="diary-entry">
          <div class="d-head">
            <span><span class="d-date">${fmtDate(d.date)}</span> <span class="d-by">· ${esc(d.createdBy)}</span></span>
            ${me.role === 'admin' || d.createdBy === me.displayName ? `<button class="d-del" data-deldiary="${d.id}">Delete</button>` : ''}
          </div>
          <div class="d-text">${esc(d.text)}</div>
          ${d.photos.length ? `<div class="diary-photos">${d.photos.map(p => `<img src="/uploads/${esc(p.filename)}" loading="lazy" data-photo="/uploads/${esc(p.filename)}" alt="site photo">`).join('')}</div>` : ''}
        </div>`).join('') || '<p class="empty-note">No entries yet. The whole team sees this log.</p>'}
    </div>`;

  document.getElementById('addEntry').addEventListener('click', async () => {
    const text = document.getElementById('dText').value.trim();
    const files = [...document.getElementById('dPhotos').files];
    if (!text && !files.length) return toast('Add a note or photo first');
    const photos = [];
    for (const f of files.slice(0, 10)) {
      try { photos.push(await compressImage(f)); } catch { toast('One photo could not be read'); }
    }
    try {
      setProject(await api('POST', '/api/diary', { projectId: project.id, date: document.getElementById('dDate').value || today(), text, photos }));
      renderTab(); toast('Entry saved');
    } catch (e) { toast(e.message); }
  });
  tabView().querySelectorAll('[data-deldiary]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this diary entry?')) return;
    try { setProject(await api('DELETE', `/api/diary/${b.dataset.deldiary}`)); renderTab(); } catch (e) { toast(e.message); }
  }));
  tabView().querySelectorAll('[data-photo]').forEach(img => img.addEventListener('click', () =>
    modal(`<div class="modal-head"><h3>Site Photo</h3><button class="modal-close">✕</button></div>
      <img src="${img.dataset.photo}" style="width:100%;border-radius:10px" alt="site photo"><div class="modal-pad-end"></div>`, () => {})));
}

function compressImage(file, maxDim = 1400, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

/* ---------- Activity tab ---------- */
function renderActivity() {
  tabView().innerHTML = `
    <div class="card list-flush">
      <h2>Team Activity</h2>
      ${project.activity.map(a => `
        <div class="act-row">
          <span class="act-when">${ago(a.at)}</span>
          <span class="act-text"><b>${esc(a.user)}</b> ${esc(a.text)}</span>
        </div>`).join('') || '<p class="empty-note">Every change by every team member shows up here.</p>'}
    </div>`;
}

/* ---------- Settings tab ---------- */
function renderSettings() {
  tabView().innerHTML = `
    <div class="card">
      <h2>Project</h2>
      <p style="font-size:13px;margin-bottom:4px"><b>${esc(project.name)}</b></p>
      <p class="dim" style="font-size:12px;margin-bottom:12px">${esc(project.client || 'No client')} · ${fmtDate(project.startDate)} → ${fmtDate(project.targetDate)}</p>
      <button class="btn ghost sm" id="editProj">Edit details</button>
    </div>
    <div class="card">
      <h2>Import / Export</h2>
      <p class="dim" style="font-size:12px;margin-bottom:10px">
        Materials CSV columns: <b>Name, Spec, Qty, Category, Status, Note</b>.
        Work items CSV columns: <b>Group, Title, Detail, Progress</b>.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <label class="btn sm" style="position:relative;overflow:hidden">Import materials CSV<input type="file" id="csvMat" accept=".csv" style="position:absolute;inset:0;opacity:0"></label>
        <label class="btn sm" style="position:relative;overflow:hidden">Import items CSV<input type="file" id="csvItems" accept=".csv" style="position:absolute;inset:0;opacity:0"></label>
        <button class="btn ghost sm" id="expMat">Export materials</button>
        <button class="btn ghost sm" id="expItems">Export items</button>
      </div>
    </div>
    <div class="card">
      <h2>Team & Account</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn ghost sm" id="teamBtn2">Manage team</button>
        <button class="btn ghost sm" id="logout2">Log out</button>
      </div>
    </div>`;

  document.getElementById('editProj').addEventListener('click', () => openProjectForm(project));
  document.getElementById('teamBtn2').addEventListener('click', openTeamModal);
  document.getElementById('logout2').addEventListener('click', async () => { await api('POST', '/api/logout'); renderAuth(false); });

  document.getElementById('expMat').addEventListener('click', () => {
    const rows = [['Name', 'Spec', 'Qty', 'Category', 'Status', 'Note']];
    for (const m of project.materials) rows.push([m.name, m.spec, m.qty, m.category, statusOf(m.status).label, m.note]);
    downloadCSV(`materials_${project.name.replace(/\s+/g, '_')}.csv`, rows);
  });
  document.getElementById('expItems').addEventListener('click', () => {
    const rows = [['Group', 'Title', 'Detail', 'Progress']];
    for (const g of project.groups) for (const i of g.items) rows.push([g.name, i.title, i.detail, i.progress]);
    downloadCSV(`items_${project.name.replace(/\s+/g, '_')}.csv`, rows);
  });

  document.getElementById('csvMat').addEventListener('change', e => importCSV(e, async rows => {
    const labelToKey = Object.fromEntries(MATERIAL_STATUSES.map(s => [s.label.toLowerCase(), s.k]));
    let n = 0;
    for (const r of rows) {
      const [name, spec, qty, category, status, note] = r;
      if (!name?.trim()) continue;
      await api('POST', '/api/materials', {
        projectId: project.id, name: name.trim(), spec: spec || '', qty: qty || '', category: category || '',
        status: labelToKey[(status || '').trim().toLowerCase()] || 'pending', note: note || '',
      });
      n++;
    }
    return n;
  }));
  document.getElementById('csvItems').addEventListener('change', e => importCSV(e, async rows => {
    let n = 0;
    for (const r of rows) {
      const [groupName, title, detail, progress] = r;
      if (!title?.trim()) continue;
      let g = project.groups.find(x => x.name.toLowerCase() === (groupName || 'General').trim().toLowerCase());
      if (!g) {
        setProject(await api('POST', '/api/groups', { projectId: project.id, name: (groupName || 'General').trim() }));
        g = project.groups.find(x => x.name.toLowerCase() === (groupName || 'General').trim().toLowerCase());
      }
      setProject(await api('POST', '/api/items', { groupId: g.id, title: title.trim(), detail: detail || '' }));
      const created = project.groups.find(x => x.id === g.id).items.at(-1);
      const pct = Math.max(0, Math.min(100, Number(progress) || 0));
      if (pct > 0) setProject(await api('PATCH', `/api/items/${created.id}`, { progress: pct }));
      n++;
    }
    return n;
  }));
}

async function importCSV(e, apply) {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const rows = parseCSV(await f.text());
    if (rows.length && /name|group/i.test(rows[0][0] || '')) rows.shift(); // header
    if (!rows.length) return toast('CSV is empty');
    if (!confirm(`Import ${rows.length} row(s) into this project?`)) return;
    const n = await apply(rows);
    setProject(await api('GET', `/api/projects/${project.id}`));
    renderTab();
    toast(`Imported ${n} row(s)`);
  } catch (err) { console.error(err); toast('Import failed: ' + err.message); }
  e.target.value = '';
}

/* ============================== CSV helpers ============================== */
function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim() !== '')) rows.push(row);
  return rows;
}
function downloadCSV(name, rows) {
  const csv = rows.map(r => r.map(c => {
    const s = String(c ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ============================== Live sync ============================== */
function startPoll() {
  stopPoll();
  pollTimer = setInterval(checkRev, POLL_MS);
  document.addEventListener('visibilitychange', onVisible);
}
function stopPoll() {
  clearInterval(pollTimer);
  pollTimer = null;
  document.removeEventListener('visibilitychange', onVisible);
}
function onVisible() { if (!document.hidden) checkRev(); }

async function checkRev() {
  if (!project || document.hidden) return;
  if (modalRoot.children.length) return;              // don't repaint under an open sheet
  const el = document.activeElement;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return; // don't interrupt typing
  try {
    const { rev } = await api('GET', `/api/projects/${project.id}/rev`);
    if (rev !== project.rev) {
      setProject(await api('GET', `/api/projects/${project.id}`));
      renderTab();
      flashSync();
    }
  } catch { /* offline blip — ignore, next poll retries */ }
}
function flashSync() {
  const dot = document.getElementById('syncDot');
  if (!dot) return;
  dot.classList.remove('stale');
  dot.animate([{ transform: 'scale(1.8)' }, { transform: 'scale(1)' }], { duration: 400 });
}

/* ============================== Modal & toast ============================== */
function modal(html, wire) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal">${html}</div>`;
  modalRoot.appendChild(backdrop);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });
  backdrop.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', closeModal));
  wire(backdrop);
}
function closeModal() { modalRoot.lastElementChild?.remove(); }

function promptText(title, value, onSave) {
  modal(`
    <div class="modal-head"><h3>${esc(title)}</h3><button class="modal-close">✕</button></div>
    <div class="field"><input id="ptVal" value="${esc(value)}"></div>
    <div class="modal-actions"><button class="btn accent" id="ptGo">Save</button></div>
  `, root => {
    const input = root.querySelector('#ptVal');
    input.focus();
    const go = async () => {
      const v = input.value.trim();
      if (!v) return toast('Value required');
      try { await onSave(v); closeModal(); } catch (e) { toast(e.message); }
    };
    root.querySelector('#ptGo').addEventListener('click', go);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  });
}

let toastTimer;
function toast(msg, action) {
  const t = document.getElementById('toast');
  t.innerHTML = '';
  t.append(document.createTextNode(msg));
  if (action) {
    const b = document.createElement('button');
    b.textContent = action.label;
    b.addEventListener('click', () => { t.hidden = true; action.fn(); });
    t.append(b);
  }
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.hidden = true, action ? 5000 : 2600);
}

boot();
