/* TENN — Ambience Bukit Baru Showroom · Site Progress Tracker PWA
   Primary model: work AREAS (from the procurement list) tracked through
   fabrication stages, plus a detailed procurement BUY LIST per area.
   Area progress syncs into the BQ items it maps to, so progress claims
   (in TENN's claim format) stay consistent. Seed data lives in js/data.js.
   Storage: localStorage (state) + IndexedDB (photos). No backend. */
'use strict';

const STORE_KEY = 'tenn-bb-state-v1';
const DB_NAME = 'tenn-bb-photos';
const SEED_VERSION = 4;
const RM = new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' });
const RM0 = new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 });

/* ============================== Seed ============================== */
function seedProject() {
  return {
    name: 'Ambience Bukit Baru Showroom',
    lot: 'Lot 26662, Mukim Bukit Baru — Sales Gallery ID Works',
    contractor: 'TENN FASTENERS (MELAKA) SDN BHD',
    client: 'FAITHVIEW HOLDING SDN BHD',
    startDate: today(),
    targetDate: '',
    retentionPct: 5,
  };
}
function seedSections() {
  return SEED_BQ.map(s => ({
    id: uid(), code: s.code, title: s.title,
    items: s.items.map(it => ({ id: uid(), pct: 0, ...it })),
  }));
}
function seedAreas() {
  const areas = [];
  for (const p of SEED_AREAS) for (const a of p.areas) {
    areas.push({
      id: uid(), part: p.part, partTitle: p.partTitle,
      code: a.code, title: a.title, dwg: a.dwg, bqSec: a.bqSec, bqCodes: a.bqCodes,
      stages: Object.fromEntries(STAGES.map(s => [s.k, 'todo'])),
      items: a.items.map(it => ({ id: uid(), status: 'pending', note: '', ...it })),
      excluded: a.excluded, note: '',
    });
  }
  return areas;
}
function seedState() {
  return { seedVersion: SEED_VERSION, project: seedProject(), sections: seedSections(), areas: seedAreas(), claims: [], diary: [] };
}

/* ============================== State ============================== */
let state = load();
let activeTab = 'home';
let moreView = null;               // null | 'bq' | 'claims'
let areaFilter = 'ALL';            // part code filter on Areas tab
let buyFilter = { status: 'ALL', cat: 'ALL', q: '' };
let openSections = new Set();

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { console.error('load failed', e); }
  const s = seedState();
  localStorage.setItem(STORE_KEY, JSON.stringify(s));
  return s;
}
/* Carry forward BQ progress, claims and diary from earlier versions; add the
   areas/procurement layer if missing. Never discard user-entered data. */
function migrate(s) {
  let changed = false;
  const untouched = !s.claims?.length && !s.diary?.length &&
    (s.sections || []).every(sec => sec.items.every(it => !it.pct && !it.rate));
  if ((s.seedVersion || 1) < 2 && untouched) return seedAndStore();
  if (!Array.isArray(s.sections) || !s.sections.length) { s.sections = seedSections(); changed = true; }
  if (!Array.isArray(s.areas) || !s.areas.length) { s.areas = seedAreas(); changed = true; }
  if (s.project.retentionPct == null) { s.project.retentionPct = 5; changed = true; }
  if (s.seedVersion !== SEED_VERSION) { s.seedVersion = SEED_VERSION; changed = true; }
  if (changed) localStorage.setItem(STORE_KEY, JSON.stringify(s));
  return s;

  function seedAndStore() {
    const ns = seedState();
    localStorage.setItem(STORE_KEY, JSON.stringify(ns));
    return ns;
  }
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }
function today() { return new Date().toISOString().slice(0, 10); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function fmtRM(n) { return RM.format(n || 0); }
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}
function statusOf(k) { return BUY_STATUSES.find(s => s.k === k) || BUY_STATUSES[0]; }

/* ============================== Derived — areas ============================== */
function areaPct(area) {
  let done = 0, total = 0;
  for (const st of STAGES) {
    const v = area.stages[st.k];
    if (v === 'na') continue;
    total += st.w;
    if (v === 'done') done += st.w;
  }
  return total ? done / total * 100 : 0;
}
function partPct(partCode) {
  const list = state.areas.filter(a => a.part === partCode);
  if (!list.length) return 0;
  return list.reduce((t, a) => t + areaPct(a), 0) / list.length;
}
function overallAreaPct() {
  if (!state.areas.length) return 0;
  return state.areas.reduce((t, a) => t + areaPct(a), 0) / state.areas.length;
}
function buyCounts(items) {
  const c = Object.fromEntries(BUY_STATUSES.map(s => [s.k, 0]));
  for (const it of items) c[it.status] = (c[it.status] || 0) + 1;
  return c;
}
function allBuyItems() {
  return state.areas.flatMap(a => a.items.map(it => ({ area: a, item: it })));
}
function findArea(id) { return state.areas.find(a => a.id === id); }
function findBuyItem(id) {
  for (const a of state.areas) {
    const it = a.items.find(i => i.id === id);
    if (it) return { area: a, item: it };
  }
  return null;
}

/* ============================== Derived — BQ / claims ============================== */
const itemAmount = it => (Number(it.qty) || 0) * (Number(it.rate) || 0);
function contractSum() {
  return state.sections.reduce((t, s) => t + s.items.reduce((a, it) => a + itemAmount(it), 0), 0);
}
function workDoneValue() {
  return state.sections.reduce((t, s) => t + s.items.reduce((a, it) => a + itemAmount(it) * (it.pct || 0) / 100, 0), 0);
}
function claimedPct(itemId) {
  let p = 0;
  for (const c of state.claims) {
    const line = c.lines[itemId];
    if (line && line.total > p) p = line.total;
  }
  return p;
}
function claimedValue() {
  let v = 0;
  for (const s of state.sections) for (const it of s.items) v += itemAmount(it) * claimedPct(it.id) / 100;
  return v;
}
function findBQItem(id) {
  for (const s of state.sections) {
    const it = s.items.find(i => i.id === id);
    if (it) return { sec: s, item: it };
  }
  return null;
}
/* Area stage progress drives the mapped BQ items (never below certified %) */
function syncAreaToBQ(area) {
  if (!area.bqSec || !area.bqCodes.length) return;
  const sec = state.sections.find(s => s.code === area.bqSec);
  if (!sec) return;
  const pct = Math.round(areaPct(area));
  for (const code of area.bqCodes) {
    const it = sec.items.find(i => i.code === code);
    if (it) it.pct = Math.max(pct, claimedPct(it.id));
  }
}

/* ============================== Router ============================== */
const view = document.getElementById('view');

function render() {
  document.getElementById('projectName').textContent = state.project.name;
  document.getElementById('projectSub').textContent = state.project.lot;
  document.getElementById('headerPct').textContent = Math.round(overallAreaPct()) + '%';
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
  if (activeTab === 'more' && moreView === 'bq') return renderBQ();
  if (activeTab === 'more' && moreView === 'claims') return renderClaims();
  ({ home: renderHome, areas: renderAreas, buy: renderBuy, diary: renderDiary, more: renderMore }[activeTab])();
}
document.querySelectorAll('.tab').forEach(t =>
  t.addEventListener('click', () => { activeTab = t.dataset.tab; moreView = null; render(); window.scrollTo(0, 0); }));

function backBar(title) {
  return `<div class="backbar"><button class="btn ghost sm" id="backBtn">← Back</button><b>${esc(title)}</b></div>`;
}
function wireBack() {
  document.getElementById('backBtn')?.addEventListener('click', () => { moreView = null; render(); });
}

/* ============================== Home ============================== */
function renderHome() {
  const pct = overallAreaPct();
  const items = allBuyItems();
  const counts = buyCounts(items.map(x => x.item));
  const trackable = items.length - counts.na;
  const areasDone = state.areas.filter(a => areaPct(a) >= 99.95).length;
  const p = state.project;

  let daysChip = '';
  if (p.targetDate) {
    const days = Math.ceil((new Date(p.targetDate + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 86400000);
    const cls = days < 0 ? 'over' : days <= 14 ? 'tight' : '';
    daysChip = `<span class="days-chip ${cls}">${days < 0 ? Math.abs(days) + ' days overdue' : days + ' days left'}</span>`;
  }

  const funnel = BUY_STATUSES.filter(s => s.k !== 'na').map(s =>
    counts[s.k] ? `<i style="flex:${counts[s.k]};background:${s.color}" title="${s.label}: ${counts[s.k]}"></i>` : '').join('');

  /* actionable attention rows — each navigates to the pre-filtered view */
  const attention = [];
  if (counts.sample) attention.push({
    text: `${counts.sample} item(s) awaiting sample approval`,
    go: () => { buyFilter = { status: 'sample', cat: 'ALL', q: '' }; activeTab = 'buy'; },
  });
  if (counts.pending) attention.push({
    text: `${counts.pending} item(s) still to order`,
    go: () => { buyFilter = { status: 'pending', cat: 'ALL', q: '' }; activeTab = 'buy'; },
  });
  const stuck = state.areas.filter(isStalled).length;
  if (stuck) attention.push({
    text: `${stuck} area(s) with materials delivered but installation not started`,
    go: () => { areaFilter = 'STUCK'; activeTab = 'areas'; },
  });
  const unpriced = state.sections.flatMap(s => s.items).filter(i => !i.rate).length;
  if (unpriced) attention.push({
    text: `${unpriced} BQ item(s) have no rate yet — claims need rates`,
    go: () => { activeTab = 'more'; moreView = 'bq'; },
  });
  const backupDays = daysSinceBackup();
  if (hasMeaningfulData() && backupDays > 7) attention.push({
    text: backupDays === Infinity
      ? 'No backup exported yet — data lives only on this device'
      : `Last backup was ${backupDays} days ago`,
    go: () => { activeTab = 'more'; },
  });

  const claimable = newClaimLines().reduce((a, l) => a + l.amountThis, 0);

  view.innerHTML = `
    <div class="card hero">
      <div class="hero-top">
        <div>
          <h2>Overall Site Progress</h2>
          <div class="hero-pct">${pct.toFixed(1)}<small>%</small></div>
          <div class="hero-sub">${areasDone} of ${state.areas.length} work areas complete</div>
        </div>
        <div class="hero-ring" style="--p:${pct}"><span>${Math.round(pct)}%</span></div>
      </div>
      <div class="big-progress"><i style="width:${pct}%"></i></div>
    </div>

    ${claimable > 0 ? `<div class="card">
      <h2>Claim Ready</h2>
      <p style="font-size:13px;color:var(--ink-soft);line-height:1.5;margin-bottom:10px">
        <b>${fmtRM(claimable)}</b> of completed work is not yet certified in a claim.</p>
      <button class="btn accent block" id="goClaimCta">Prepare Claim ${state.claims.length + 1}</button>
    </div>` : ''}

    <div class="card">
      <h2>Procurement Pipeline · ${trackable} items</h2>
      <div class="funnel">${funnel || '<i style="flex:1;background:var(--line)"></i>'}</div>
      <div class="funnel-legend">
        ${BUY_STATUSES.filter(s => s.k !== 'na').map(s =>
          `<span class="leg" data-gost="${s.k}"><i style="background:${s.color}"></i>${s.label} <b>${counts[s.k]}</b></span>`).join('')}
      </div>
    </div>

    ${attention.length ? `<div class="card attention">
      <h2>Needs Attention</h2>
      ${attention.map((a, i) => `<div class="attn-row" data-attn="${i}">⚠️ ${esc(a.text)} <i>›</i></div>`).join('')}
    </div>` : ''}

    <div class="card">
      <h2>Timeline</h2>
      <div class="timeline-info">
        <span>Start: <b>${fmtDate(p.startDate)}</b></span>
        <span>Target: <b>${fmtDate(p.targetDate)}</b></span>
        ${daysChip}
      </div>
    </div>

    <div class="card">
      <h2>Progress by Part</h2>
      ${SEED_AREAS.map(part => {
        const sp = partPct(part.part);
        const n = state.areas.filter(a => a.part === part.part).length;
        return `<div class="section-bar" data-part="${part.part}">
          <div class="row"><span class="name">${esc(part.partTitle)} <small class="dim">(${n} areas)</small></span><span class="pct">${Math.round(sp)}%</span></div>
          <div class="mini-progress"><i class="${sp >= 99.95 ? 'done' : ''}" style="width:${sp}%"></i></div>
        </div>`;
      }).join('')}
    </div>

    ${contractSum() > 0 ? `<div class="hero-stats">
      <div class="stat"><div class="num">${RM0.format(contractSum())}</div><div class="lbl">Contract Sum</div></div>
      <div class="stat"><div class="num">${RM0.format(workDoneValue())}</div><div class="lbl">Work Done</div></div>
      <div class="stat"><div class="num">${RM0.format(claimedValue())}</div><div class="lbl">Claimed</div></div>
    </div>` : ''}
  `;

  view.querySelectorAll('[data-attn]').forEach(el => el.addEventListener('click', () => {
    attention[Number(el.dataset.attn)].go();
    render(); window.scrollTo(0, 0);
  }));
  view.querySelectorAll('[data-gost]').forEach(el => el.addEventListener('click', () => {
    buyFilter = { status: el.dataset.gost, cat: 'ALL', q: '' };
    activeTab = 'buy'; render(); window.scrollTo(0, 0);
  }));
  document.getElementById('goClaimCta')?.addEventListener('click', () => {
    activeTab = 'more'; moreView = 'claims'; render(); window.scrollTo(0, 0);
  });
  view.querySelectorAll('[data-part]').forEach(el => el.addEventListener('click', () => {
    areaFilter = el.dataset.part; activeTab = 'areas'; render(); window.scrollTo(0, 0);
  }));
}

function isStalled(a) { return a.stages.deliver === 'done' && a.stages.install === 'todo'; }
function nextStageLabel(a) {
  const st = STAGES.find(s => a.stages[s.k] === 'todo');
  return st ? st.label : 'Complete';
}
function daysSinceBackup() {
  if (!state.lastBackup) return Infinity;
  return Math.floor((new Date(today() + 'T00:00:00') - new Date(state.lastBackup + 'T00:00:00')) / 86400000);
}
function hasMeaningfulData() {
  return state.claims.length > 0 || state.diary.length > 0 ||
    state.areas.some(a => a.items.some(i => i.status !== 'pending') || STAGES.some(st => a.stages[st.k] !== 'todo')) ||
    state.sections.some(s => s.items.some(i => i.pct > 0 || i.rate > 0));
}

/* ============================== Areas ============================== */
function renderAreas() {
  const parts = [['ALL', 'All'], ...SEED_AREAS.map(p => [p.part, shortPart(p.part)])];
  const list = state.areas.filter(a =>
    areaFilter === 'ALL' ? true :
    areaFilter === 'STUCK' ? isStalled(a) :
    a.part === areaFilter);

  view.innerHTML = `
    <div class="pills">${parts.map(([k, lbl]) =>
      `<button class="pill ${areaFilter === k ? 'on' : ''}" data-pf="${k}">${lbl}</button>`).join('')}
      ${areaFilter === 'STUCK' ? '<button class="pill on" data-pf="ALL">Stalled ✕</button>' : ''}</div>
    ${list.map(a => {
      const pct = areaPct(a);
      const counts = buyCounts(a.items);
      const installed = counts.installed;
      const total = a.items.length - counts.na;
      const next = nextStageLabel(a);
      return `<div class="area-card" data-area="${a.id}">
        <div class="area-head">
          <span class="code">${esc(a.code)}</span>
          <div class="area-title"><b>${esc(a.title)}</b>${a.dwg ? `<small>${esc(a.dwg)}</small>` : ''}</div>
          <span class="area-pct ${pct >= 99.95 ? 'done' : ''}">${Math.round(pct)}%</span>
        </div>
        <div class="mini-progress"><i class="${pct >= 99.95 ? 'done' : ''}" style="width:${pct}%"></i></div>
        <div class="area-foot">
          <span class="next-label ${next === 'Complete' ? 'done' : ''}">${next === 'Complete' ? '✓ Complete' : 'Next: ' + esc(next)}</span>
          <span class="dim">${total ? `${installed}/${total} materials installed` : 'no materials'}</span>
        </div>
        <div class="area-foot2">
          <span class="stage-dots">${STAGES.map(st => `<i class="${a.stages[st.k]}" title="${st.label}"></i>`).join('')}</span>
        </div>
      </div>`;
    }).join('') || '<p class="empty-note">No areas match this filter.</p>'}
  `;

  view.querySelectorAll('[data-pf]').forEach(b => b.addEventListener('click', () => { areaFilter = b.dataset.pf; renderAreas(); }));
  view.querySelectorAll('[data-area]').forEach(el => el.addEventListener('click', () => openAreaModal(el.dataset.area)));
}

function shortPart(code) {
  return { LOBBY: 'Lobby', MODEL: 'Model', GARDEN: 'Garden', TYPEA: 'Type A', TYPEB: 'Type B', GEN: 'General' }[code] || code;
}

/* --- area detail: stage checklist + buy items --- */
function openAreaModal(areaId) {
  const a = findArea(areaId);
  if (!a) return;

  const paint = root => {
    const pct = areaPct(a);
    root.querySelector('.area-modal-pct').textContent = Math.round(pct) + '%';
    root.querySelector('.area-modal-bar i').style.width = pct + '%';
    root.querySelectorAll('.stage-row').forEach(row => {
      const v = a.stages[row.dataset.stage];
      row.classList.toggle('done', v === 'done');
      row.classList.toggle('na', v === 'na');
      row.querySelector('.stage-check').textContent = v === 'done' ? '✓' : '';
      row.querySelector('.stage-na').textContent = v === 'na' ? 'N/A ✓' : 'N/A';
    });
    root.querySelectorAll('.buy-row').forEach(row => {
      const it = a.items.find(i => i.id === row.dataset.buy);
      const st = statusOf(it.status);
      const chip = row.querySelector('.status-chip');
      chip.textContent = st.label;
      chip.style.background = st.color;
    });
  };

  modal(`
    <div class="modal-head"><h3>${esc(a.code)} · ${esc(a.title)}</h3><button class="modal-close">✕</button></div>
    ${a.dwg ? `<p class="dim" style="font-size:12px;margin-bottom:8px">${esc(a.dwg)}</p>` : ''}
    <div class="area-modal-top">
      <span class="area-modal-pct">0%</span>
      <div class="mini-progress area-modal-bar" style="flex:1"><i></i></div>
    </div>

    <h4 class="mod-sub">Work Stages <small class="dim">(tap to mark done · N/A removes from progress)</small></h4>
    <div class="stage-list">
      ${STAGES.map(st => `
        <div class="stage-row" data-stage="${st.k}">
          <button class="stage-check" aria-label="toggle ${st.label}"></button>
          <span class="stage-label">${st.label} <small class="dim">${st.w}%</small></span>
          <button class="stage-na">N/A</button>
        </div>`).join('')}
    </div>

    ${a.items.length ? `<h4 class="mod-sub">Materials / Buy List <small class="dim">(tap for status)</small></h4>
    <div class="buy-list-mini">
      ${a.items.map(it => `
        <div class="buy-row" data-buy="${it.id}">
          <div class="buy-info">
            <b>${esc(it.name)}</b>
            ${it.spec ? `<small>${esc(it.spec)}</small>` : ''}
            <small class="dim">${esc(it.qty)} · ${esc(it.cat)}</small>
          </div>
          <span class="status-chip"></span>
        </div>`).join('')}
    </div>` : ''}

    ${a.excluded.length ? `<h4 class="mod-sub">By Others — Do Not Buy</h4>
      ${a.excluded.map(x => `<p class="excluded-note">✗ ${esc(x)}</p>`).join('')}` : ''}

    ${a.bqCodes.length ? `<p class="dim" style="font-size:11px;margin-top:10px">Linked BQ items: ${esc(a.bqSec)} — ${a.bqCodes.map(esc).join(', ')} (progress syncs automatically for claims)</p>` : ''}

    <div class="field" style="margin-top:10px"><label>Area notes</label>
      <textarea id="areaNote" rows="2" placeholder="Site notes, issues, dimensions confirmed...">${esc(a.note || '')}</textarea></div>
    <div class="modal-actions"><button class="btn accent" id="saveArea">Done</button></div>
  `, root => {
    paint(root);
    root.querySelectorAll('.stage-row').forEach(row => {
      const k = row.dataset.stage;
      row.querySelector('.stage-check').addEventListener('click', () => {
        a.stages[k] = a.stages[k] === 'done' ? 'todo' : 'done';
        syncAreaToBQ(a); save(); paint(root);
      });
      row.querySelector('.stage-na').addEventListener('click', () => {
        a.stages[k] = a.stages[k] === 'na' ? 'todo' : 'na';
        syncAreaToBQ(a); save(); paint(root);
      });
    });
    root.querySelectorAll('.buy-row').forEach(row =>
      row.querySelector('.buy-info').addEventListener('click', () => openBuyStatus(row.dataset.buy, () => paint(root))));
    root.querySelectorAll('.buy-row .status-chip').forEach(chip =>
      chip.addEventListener('click', () => {
        const row = chip.closest('.buy-row');
        const it = a.items.find(i => i.id === row.dataset.buy);
        quickAdvance(it, () => { if (root.isConnected) paint(root); else render(); });
      }));
    root.querySelector('#saveArea').addEventListener('click', () => {
      a.note = root.querySelector('#areaNote').value.trim();
      save(); closeModal(); render();
    });
  });
}

/* Chip tap = advance one status step, with an Undo toast. No wrap-around:
   'installed' stays put, 'na' opens the full sheet instead. */
function quickAdvance(item, repaint) {
  if (item.status === 'na') { openBuyStatus(item.id, repaint); return; }
  if (item.status === 'installed') { toast('Already installed — tap the item to change'); return; }
  const order = ['pending', 'sample', 'ordered', 'delivered', 'installed'];
  const prev = item.status;
  item.status = order[order.indexOf(prev) + 1] || 'installed';
  save(); repaint();
  toast(`→ ${statusOf(item.status).label}: ${item.name.slice(0, 40)}`, {
    label: 'Undo',
    fn: () => { item.status = prev; save(); repaint(); },
  });
}

/* --- buy item status sheet --- */
function openBuyStatus(buyId, onDone) {
  const found = findBuyItem(buyId);
  if (!found) return;
  const { area, item } = found;

  modal(`
    <div class="modal-head"><h3>Material Status</h3><button class="modal-close">✕</button></div>
    <p style="font-size:14px;font-weight:700;margin-bottom:2px">${esc(item.name)}</p>
    ${item.spec ? `<p class="dim" style="font-size:12px;margin-bottom:2px">${esc(item.spec)}</p>` : ''}
    <p class="dim" style="font-size:12px">Qty: <b>${esc(item.qty)}</b> · ${esc(item.cat)} · ${esc(area.code)} ${esc(area.title)}</p>
    <div class="status-grid">
      ${BUY_STATUSES.map(s => `
        <button class="status-btn ${item.status === s.k ? 'on' : ''}" data-st="${s.k}" style="--c:${s.color}">${s.label}</button>`).join('')}
    </div>
    <div class="field"><label>Note (PO no., supplier, ETA...)</label>
      <textarea id="buyNote" rows="2">${esc(item.note || '')}</textarea></div>
    <div class="modal-actions"><button class="btn accent" id="saveBuy">Save</button></div>
  `, root => {
    root.querySelectorAll('.status-btn').forEach(b => b.addEventListener('click', () => {
      item.status = b.dataset.st;
      root.querySelectorAll('.status-btn').forEach(x => x.classList.toggle('on', x.dataset.st === item.status));
    }));
    root.querySelector('#saveBuy').addEventListener('click', () => {
      item.note = root.querySelector('#buyNote').value.trim();
      save(); closeModal();
      if (onDone) onDone(); else render();
    });
  });
}

/* ============================== Buy list ============================== */
/* The toolbar (funnel, search, category) renders once; only the list body
   re-paints on filter/search changes so the search input keeps focus. */
function renderBuy() {
  const all = allBuyItems();
  const counts = buyCounts(all.map(x => x.item));
  const funnel = BUY_STATUSES.filter(s => s.k !== 'na').map(s =>
    counts[s.k] ? `<i style="flex:${counts[s.k]};background:${s.color}"></i>` : '').join('');

  view.innerHTML = `
    <div class="card" style="padding:12px 16px">
      <div class="funnel">${funnel || '<i style="flex:1;background:var(--line)"></i>'}</div>
      <div class="funnel-legend" id="buyLegend">
        ${BUY_STATUSES.map(s => `<span class="leg" data-fst="${s.k}"><i style="background:${s.color}"></i>${s.label} <b>${counts[s.k]}</b></span>`).join('')}
        <span class="leg" data-fst="ALL">All <b>${all.length}</b></span>
      </div>
    </div>
    <div class="buy-toolbar">
      <input type="search" id="buySearch" placeholder="Search materials, codes, areas…" value="${esc(buyFilter.q)}">
      <select id="buyCat">
        <option value="ALL">All categories</option>
        ${BUY_CATEGORIES.map(c => `<option value="${esc(c)}" ${buyFilter.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
    </div>
    <div class="card list-flush" id="buyListWrap"></div>
  `;

  const paintLegend = () => view.querySelectorAll('#buyLegend .leg').forEach(el =>
    el.classList.toggle('on', el.dataset.fst === buyFilter.status));
  paintLegend();

  view.querySelectorAll('[data-fst]').forEach(el => el.addEventListener('click', () => {
    buyFilter.status = buyFilter.status === el.dataset.fst ? 'ALL' : el.dataset.fst;
    paintLegend(); paintBuyList();
  }));
  const search = document.getElementById('buySearch');
  search.addEventListener('input', () => {
    buyFilter.q = search.value;
    clearTimeout(search._t);
    search._t = setTimeout(paintBuyList, 200);
  });
  document.getElementById('buyCat').addEventListener('change', e => { buyFilter.cat = e.target.value; paintBuyList(); });
  paintBuyList();
}

function paintBuyList() {
  const wrap = document.getElementById('buyListWrap');
  if (!wrap) return;
  const match = ({ area, item }) => {
    if (buyFilter.status !== 'ALL' && item.status !== buyFilter.status) return false;
    if (buyFilter.cat !== 'ALL' && item.cat !== buyFilter.cat) return false;
    if (buyFilter.q) {
      const q = buyFilter.q.toLowerCase();
      if (!(item.name + ' ' + item.spec + ' ' + area.title + ' ' + area.code).toLowerCase().includes(q)) return false;
    }
    return true;
  };
  const filtered = allBuyItems().filter(match);

  const byArea = [];
  for (const x of filtered) {
    let g = byArea[byArea.length - 1];
    if (!g || g.area.id !== x.area.id) { g = { area: x.area, items: [] }; byArea.push(g); }
    g.items.push(x.item);
  }

  wrap.innerHTML = byArea.map(g => `
    <div class="buy-group-head">${esc(g.area.code)} · ${esc(g.area.title)}</div>
    ${g.items.map(it => {
      const st = statusOf(it.status);
      return `<div class="buy-row big" data-buy="${it.id}">
        <div class="buy-info">
          <b>${esc(it.name)}</b>
          ${it.spec ? `<small>${esc(it.spec)}</small>` : ''}
          <small class="dim">${esc(it.qty)} · ${esc(it.cat)}${it.note ? ` · 📝 ${esc(it.note)}` : ''}</small>
        </div>
        <span class="status-chip" style="background:${st.color}">${st.label}</span>
      </div>`;
    }).join('')}`).join('') || '<p class="empty-note">No materials match this filter.</p>';

  wrap.querySelectorAll('.buy-row').forEach(row => row.addEventListener('click', () => openBuyStatus(row.dataset.buy)));
  wrap.querySelectorAll('.buy-row .status-chip').forEach(chip => chip.addEventListener('click', e => {
    e.stopPropagation();
    const found = findBuyItem(chip.closest('.buy-row').dataset.buy);
    if (found) quickAdvance(found.item, () => activeTab === 'buy' ? renderBuy() : render());
  }));
}

/* ============================== BQ (More → BQ) ============================== */
function renderBQ() {
  view.innerHTML = `
    ${backBar('Bill of Quantities')}
    <p class="dim" style="font-size:12px;margin:-6px 2px 0">BQ item % is driven by area stage progress. Tap an item to adjust manually or edit qty/rate.</p>
    <div class="bq-toolbar">
      <div class="spacer"></div>
      <button class="btn sm ghost" id="expandAll">Expand all</button>
      <button class="btn sm ghost" id="collapseAll">Collapse</button>
    </div>
    ${state.sections.map(sec => {
      const amts = sec.items.map(itemAmount);
      const amt = amts.reduce((a, b) => a + b, 0);
      const sp = amt > 0
        ? sec.items.reduce((a, it, i) => a + amts[i] * (it.pct || 0), 0) / amt
        : (sec.items.reduce((a, it) => a + (it.pct || 0), 0) / (sec.items.length || 1));
      return `<div class="bq-section ${openSections.has(sec.id) ? 'open' : ''}" data-sec="${sec.id}">
        <button class="bq-section-head">
          <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.6 16.6 13.2 12 8.6 7.4 10 6l6 6-6 6z"/></svg>
          <span class="title"><b>${esc(sec.code)} — ${esc(sec.title)}</b>
          <small>${sec.items.length} items · ${fmtRM(amt)}</small></span>
          <span class="sect-pct">${Math.round(sp)}%</span>
        </button>
        <div class="bq-items">
          ${sec.items.map(it => `
            <div class="bq-item ${it.pct >= 100 ? 'done' : ''}" data-item="${it.id}">
              <div class="info">
                <span class="code">${esc(it.code)}</span>
                <div class="desc">${esc(it.desc)}</div>
                <div class="meta">${esc(it.unit)} × ${it.qty} @ ${fmtRM(it.rate)} = <b>${fmtRM(itemAmount(it))}</b></div>
              </div>
              <div class="item-pct"><b>${Math.round(it.pct || 0)}%</b><div class="ring"><i style="width:${it.pct || 0}%"></i></div></div>
            </div>`).join('')}
        </div>
      </div>`;
    }).join('')}
  `;
  wireBack();
  view.querySelectorAll('.bq-section-head').forEach(h => h.addEventListener('click', () => {
    const id = h.closest('.bq-section').dataset.sec;
    openSections.has(id) ? openSections.delete(id) : openSections.add(id);
    h.closest('.bq-section').classList.toggle('open');
  }));
  view.querySelectorAll('.bq-item').forEach(el => el.addEventListener('click', () => openBQItemModal(el.dataset.item)));
  document.getElementById('expandAll').addEventListener('click', () => { state.sections.forEach(s => openSections.add(s.id)); renderBQ(); });
  document.getElementById('collapseAll').addEventListener('click', () => { openSections.clear(); renderBQ(); });
}

function openBQItemModal(itemId) {
  const found = findBQItem(itemId);
  if (!found) return;
  const { item } = found;
  const already = claimedPct(itemId);

  modal(`
    <div class="modal-head"><h3>${esc(item.code)} · BQ Item</h3><button class="modal-close">✕</button></div>
    <p style="font-size:13px;color:var(--ink-soft);line-height:1.4;margin-bottom:8px">${esc(item.desc)}</p>
    <div class="field-row-3">
      <div class="field"><label>Unit</label><input id="fUnit" value="${esc(item.unit)}"></div>
      <div class="field"><label>Qty</label><input id="fQty" type="number" inputmode="decimal" value="${item.qty}"></div>
      <div class="field"><label>Rate (RM)</label><input id="fRate" type="number" inputmode="decimal" value="${item.rate || ''}" placeholder="0.00"></div>
    </div>
    <div class="pct-display"><span id="pctNum">${Math.round(item.pct || 0)}</span><small>%</small></div>
    <input type="range" class="pct-slider" id="pctSlider" min="0" max="100" step="1" value="${Math.round(item.pct || 0)}">
    ${already > 0 ? `<p class="claimed-note">${already}% already certified in previous claims — cannot go below that.</p>` : ''}
    <p class="claimed-note">Note: this item's % is re-synced whenever its linked work area's stages change.</p>
    <div class="modal-actions"><button class="btn accent" id="saveBQ">Save</button></div>
  `, root => {
    const slider = root.querySelector('#pctSlider');
    slider.addEventListener('input', () => root.querySelector('#pctNum').textContent = slider.value);
    root.querySelector('#saveBQ').addEventListener('click', () => {
      item.unit = root.querySelector('#fUnit').value.trim() || 'Lot';
      item.qty = Number(root.querySelector('#fQty').value) || 0;
      item.rate = Number(root.querySelector('#fRate').value) || 0;
      let v = Number(slider.value);
      if (v < already) { v = already; toast(`Kept at ${already}% — already certified`); }
      item.pct = v;
      save(); closeModal(); render();
    });
  });
}

/* ============================== Claims (More → Claims) ============================== */
function renderClaims() {
  const claimable = newClaimLines();
  const claimableValue = claimable.reduce((a, l) => a + l.amountThis, 0);

  view.innerHTML = `
    ${backBar('Progress Claims')}
    <div class="card">
      <h2>New Progress Claim</h2>
      <p style="font-size:13px;color:var(--ink-soft);line-height:1.5;margin-bottom:12px">
        ${claimable.length
          ? `${claimable.length} BQ item(s) have progress not yet claimed — uncertified work value <b>${fmtRM(claimableValue)}</b>.`
          : 'No unclaimed progress right now. Progress flows from area stages (Areas tab), or adjust BQ items directly.'}
      </p>
      <button class="btn accent block" id="makeClaim" ${claimable.length ? '' : 'disabled'}>Generate Claim ${state.claims.length + 1}</button>
    </div>
    <div class="card list-flush">
      <h2>Claim History</h2>
      ${state.claims.length ? [...state.claims].reverse().map(c => `
        <div class="claim-row" data-claim="${c.id}">
          <div class="claim-no">${c.no}</div>
          <div class="claim-info"><b>Progress Claim ${c.no}</b><small>${fmtDate(c.date)} · ${Object.keys(c.lines).length} items</small></div>
          <div class="claim-amt">${fmtRM(c.totalThis)}</div>
        </div>`).join('')
      : '<p class="empty-note">No claims yet.</p>'}
    </div>
  `;
  wireBack();
  document.getElementById('makeClaim').addEventListener('click', createClaim);
  view.querySelectorAll('.claim-row').forEach(r => r.addEventListener('click', () => openClaimDoc(r.dataset.claim)));
}

function newClaimLines() {
  const lines = [];
  for (const sec of state.sections) for (const it of sec.items) {
    const prev = claimedPct(it.id);
    const cur = it.pct || 0;
    if (cur > prev) lines.push({ sec, it, prev, this: cur - prev, total: cur, amountThis: itemAmount(it) * (cur - prev) / 100 });
  }
  return lines;
}

function createClaim() {
  const lines = newClaimLines();
  if (!lines.length) return;
  const no = state.claims.length + 1;
  if (!confirm(`Generate Progress Claim ${no} for ${fmtRM(lines.reduce((a, l) => a + l.amountThis, 0))}?\nThis certifies current progress on ${lines.length} item(s).`)) return;
  const claim = {
    id: uid(), no, date: today(),
    lines: Object.fromEntries(lines.map(l => [l.it.id, { prev: l.prev, this: l.this, total: l.total }])),
    totalThis: lines.reduce((a, l) => a + l.amountThis, 0),
  };
  state.claims.push(claim);
  save(); render();
  toast(`Claim ${no} generated`);
  openClaimDoc(claim.id);
}

function openClaimDoc(claimId) {
  const c = state.claims.find(x => x.id === claimId);
  if (!c) return;
  const p = state.project;
  const retPct = Number(p.retentionPct) || 0;

  let grandContract = 0, grandClaim = 0;
  const sectionBlocks = state.sections.map(sec => {
    const rows = sec.items.filter(it => c.lines[it.id]).map(it => {
      const l = c.lines[it.id];
      const amt = itemAmount(it);
      const claimAmt = amt * l.this / 100;
      grandContract += amt; grandClaim += claimAmt;
      return `<tr>
        <td>${esc(it.code)}</td><td>${esc(it.desc)}</td><td>${esc(it.unit)}</td>
        <td class="num">${it.qty}</td><td class="num">${fmtRM(it.rate)}</td><td class="num">${fmtRM(amt)}</td>
        <td class="num">${l.prev}%</td><td class="num">${l.this}%</td><td class="num">${l.total}%</td>
        <td class="num">${fmtRM(claimAmt)}</td>
      </tr>`;
    });
    if (!rows.length) return '';
    return `<tr class="sect"><td colspan="10">${esc(sec.code)} — ${esc(sec.title)}</td></tr>${rows.join('')}`;
  }).join('');

  modal(`
    <div class="modal-head no-print"><h3>Progress Claim ${c.no}</h3><button class="modal-close">✕</button></div>
    <div class="claim-doc">
      <div class="doc-head">
        <b>${esc(p.contractor)}</b>
        ${p.client ? `<span>Client / Main Contractor: ${esc(p.client)}</span>` : ''}
        <span>PROJECT: ${esc(p.name)} — ${esc(p.lot)}</span>
        <span>PROGRESS CLAIM: ${c.no} &nbsp;·&nbsp; DATE: ${fmtDate(c.date)}</span>
      </div>
      <div class="claim-table-wrap">
        <table class="claim-table">
          <thead><tr>
            <th>Item</th><th>Description</th><th>Unit</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount (RM)</th>
            <th class="num">Prev.</th><th class="num">This</th><th class="num">Total</th><th class="num">Claim (RM)</th>
          </tr></thead>
          <tbody>
            ${sectionBlocks}
            <tr class="total"><td colspan="5">TOTAL THIS CLAIM</td><td class="num">${fmtRM(grandContract)}</td>
              <td colspan="3"></td><td class="num">${fmtRM(grandClaim)}</td></tr>
            ${retPct > 0 ? `
            <tr><td colspan="9">Less retention ${retPct}% (release upon end of DLP)</td>
              <td class="num">(${fmtRM(grandClaim * retPct / 100)})</td></tr>
            <tr class="total"><td colspan="9">NET AMOUNT THIS CLAIM</td>
              <td class="num">${fmtRM(grandClaim * (1 - retPct / 100))}</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    </div>
    <div class="modal-actions no-print">
      <button class="btn danger" id="delClaim">Delete</button>
      <button class="btn ghost" id="csvClaim">CSV</button>
      <button class="btn" id="printClaim">Print / PDF</button>
    </div>
  `, root => {
    root.querySelector('#printClaim').addEventListener('click', () => window.print());
    root.querySelector('#csvClaim').addEventListener('click', () => exportClaimCSV(c));
    root.querySelector('#delClaim').addEventListener('click', () => {
      if (c.no !== state.claims.length) { toast('Only the latest claim can be deleted'); return; }
      if (!confirm(`Delete Claim ${c.no}? Its certified progress will return to "unclaimed".`)) return;
      state.claims = state.claims.filter(x => x.id !== c.id);
      save(); closeModal(); render();
    });
  });
}

function exportClaimCSV(c) {
  const p = state.project;
  const rows = [
    [p.contractor], [`PROJECT: ${p.name} — ${p.lot}`], [`PROGRESS CLAIM: ${c.no}`, `DATE: ${c.date}`], [],
    ['ITEM', 'DESCRIPTION', 'UNIT', 'QTY', 'RATE', 'AMOUNT (RM)', 'PREVIOUS CLAIM', 'THIS CLAIM', 'TOTAL CLAIM', 'CLAIM AMOUNT (RM)'],
  ];
  let grand = 0;
  for (const sec of state.sections) {
    const items = sec.items.filter(it => c.lines[it.id]);
    if (!items.length) continue;
    rows.push([`${sec.code}`, sec.title]);
    for (const it of items) {
      const l = c.lines[it.id];
      const amt = itemAmount(it);
      const claimAmt = amt * l.this / 100;
      grand += claimAmt;
      rows.push([it.code, it.desc, it.unit, it.qty, it.rate.toFixed(2), amt.toFixed(2), l.prev + '%', l.this + '%', l.total + '%', claimAmt.toFixed(2)]);
    }
  }
  rows.push([], ['', '', '', '', '', '', '', '', 'TOTAL THIS CLAIM', grand.toFixed(2)]);
  const retPct = Number(p.retentionPct) || 0;
  if (retPct > 0) {
    rows.push(['', '', '', '', '', '', '', '', `LESS RETENTION ${retPct}%`, (-grand * retPct / 100).toFixed(2)]);
    rows.push(['', '', '', '', '', '', '', '', 'NET AMOUNT THIS CLAIM', (grand * (1 - retPct / 100)).toFixed(2)]);
  }
  downloadFile(`Claim_${c.no}_${p.name.replace(/\s+/g, '_')}.csv`, toCSV(rows), 'text/csv');
}

/* ============================== Diary ============================== */
function renderDiary() {
  view.innerHTML = `
    <div class="card">
      <h2>New Diary Entry</h2>
      <div class="field"><label>Date</label><input type="date" id="dDate" value="${today()}"></div>
      <div class="field"><label>Notes — work done, manpower, deliveries, issues</label>
        <textarea id="dText" rows="3" placeholder="e.g. 4 workers on site. Reception counter carcass fabrication done, Volakas laminate delivered."></textarea></div>
      <div class="field"><label>Site photos</label><input type="file" id="dPhotos" accept="image/*" multiple></div>
      <button class="btn accent block" id="addEntry">Add Entry</button>
    </div>
    <div class="card list-flush">
      <h2>Site Log</h2>
      <div id="diaryList">${state.diary.length ? '' : '<p class="empty-note">No entries yet. Log daily site progress here — photos included.</p>'}</div>
    </div>
  `;
  document.getElementById('addEntry').addEventListener('click', addDiaryEntry);
  paintDiaryList();
}

async function addDiaryEntry() {
  const date = document.getElementById('dDate').value || today();
  const text = document.getElementById('dText').value.trim();
  const files = [...document.getElementById('dPhotos').files];
  if (!text && !files.length) { toast('Add a note or photo first'); return; }
  const photoIds = [];
  for (const f of files) {
    try {
      const blob = await compressImage(f);
      const pid = uid();
      await photoDB.put(pid, blob);
      photoIds.push(pid);
    } catch (e) { console.error('photo failed', e); toast('One photo could not be saved'); }
  }
  state.diary.push({ id: uid(), date, text, photoIds });
  state.diary.sort((a, b) => a.date < b.date ? -1 : 1);
  save(); render();
  toast('Entry saved');
}

async function paintDiaryList() {
  const el = document.getElementById('diaryList');
  if (!el || !state.diary.length) return;
  const entries = [...state.diary].reverse();
  el.innerHTML = entries.map(e => `
    <div class="diary-entry" data-entry="${e.id}">
      <div class="d-head"><span class="d-date">${fmtDate(e.date)}</span><button class="d-del" data-del="${e.id}">Delete</button></div>
      <div class="d-text">${esc(e.text)}</div>
      ${e.photoIds?.length ? `<div class="diary-photos">${e.photoIds.map(pid => `<img data-photo="${pid}" alt="site photo">`).join('')}</div>` : ''}
    </div>`).join('');

  el.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this diary entry?')) return;
    const entry = state.diary.find(x => x.id === b.dataset.del);
    for (const pid of entry?.photoIds || []) await photoDB.del(pid).catch(() => {});
    state.diary = state.diary.filter(x => x.id !== b.dataset.del);
    save(); render();
  }));

  for (const img of el.querySelectorAll('[data-photo]')) {
    const blob = await photoDB.get(img.dataset.photo).catch(() => null);
    if (blob) {
      img.src = URL.createObjectURL(blob);
      img.addEventListener('click', () => viewPhoto(img.src));
    }
  }
}

function viewPhoto(src) {
  modal(`
    <div class="modal-head"><h3>Site Photo</h3><button class="modal-close">✕</button></div>
    <img src="${src}" style="width:100%;border-radius:10px" alt="site photo">
  `, () => {});
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
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('encode failed')), 'image/jpeg', quality);
    };
    img.onerror = reject;
    img.src = url;
  });
}

const photoDB = {
  _db: null,
  open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('photos');
      req.onsuccess = () => { this._db = req.result; res(this._db); };
      req.onerror = () => rej(req.error);
    });
  },
  async put(id, blob) { const db = await this.open(); return txp(db, 'readwrite', s => s.put(blob, id)); },
  async get(id) { const db = await this.open(); return txp(db, 'readonly', s => s.get(id)); },
  async del(id) { const db = await this.open(); return txp(db, 'readwrite', s => s.delete(id)); },
};
function txp(db, mode, fn) {
  return new Promise((res, rej) => {
    const tx = db.transaction('photos', mode);
    const req = fn(tx.objectStore('photos'));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

/* ============================== More ============================== */
function renderMore() {
  const p = state.project;
  view.innerHTML = `
    <div class="card list-flush">
      <h2>Project</h2>
      <div class="more-row" id="goBQ"><span>📋</span><div><b>Bill of Quantities</b><small>${state.sections.reduce((a, s) => a + s.items.length, 0)} items · ${fmtRM(contractSum())}</small></div><i>›</i></div>
      <div class="more-row" id="goClaims"><span>🧾</span><div><b>Progress Claims</b><small>${state.claims.length} claim(s) · ${fmtRM(claimedValue())} certified</small></div><i>›</i></div>
    </div>

    <div class="card">
      <h2>Project Details</h2>
      <div class="field"><label>Project name</label><input id="pName" value="${esc(p.name)}"></div>
      <div class="field"><label>Lot / reference</label><input id="pLot" value="${esc(p.lot)}"></div>
      <div class="field"><label>Contractor</label><input id="pContractor" value="${esc(p.contractor)}"></div>
      <div class="field"><label>Client / main contractor</label><input id="pClient" value="${esc(p.client)}"></div>
      <div class="field-row">
        <div class="field"><label>Start date</label><input type="date" id="pStart" value="${esc(p.startDate)}"></div>
        <div class="field"><label>Target completion</label><input type="date" id="pTarget" value="${esc(p.targetDate)}"></div>
      </div>
      <div class="field"><label>Retention % (deducted on each claim)</label>
        <input type="number" inputmode="decimal" id="pRetention" value="${p.retentionPct ?? 5}" min="0" max="20" step="0.5"></div>
      <button class="btn accent block" id="saveProject">Save Details</button>
    </div>

    <div class="card">
      <h2>Export & Backup</h2>
      <p style="font-size:12px;color:var(--ink-soft);margin-bottom:10px">All data lives on this device — export a backup regularly.
        Backups include site photos. Last backup: <b>${state.lastBackup ? fmtDate(state.lastBackup) : 'never'}</b></p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn ghost sm" id="exportJson">Backup (incl. photos)</button>
        <label class="btn ghost sm" style="position:relative;overflow:hidden">Restore backup<input type="file" id="importJson" accept=".json,application/json" style="position:absolute;inset:0;opacity:0"></label>
        <button class="btn ghost sm" id="exportBuyCsv">Buy list CSV</button>
        <button class="btn ghost sm" id="exportBqCsv">BQ CSV</button>
      </div>
    </div>

    <div class="card">
      <h2>Import Priced BQ (CSV)</h2>
      <p style="font-size:12px;color:var(--ink-soft);line-height:1.5;margin-bottom:10px">
        Columns: <b>Section, Code, Description, Unit, Qty, Rate</b>. Importing replaces the BQ —
        keep Section &amp; Code values matching the current BQ so area links stay intact.
      </p>
      <label class="btn sm" style="position:relative;overflow:hidden">Import CSV<input type="file" id="csvFile" accept=".csv,text/csv" style="position:absolute;inset:0;opacity:0"></label>
    </div>

    <div class="card">
      <h2>Danger Zone</h2>
      <button class="btn danger sm" id="resetAll">Reset all data</button>
    </div>
  `;

  document.getElementById('goBQ').addEventListener('click', () => { moreView = 'bq'; render(); window.scrollTo(0, 0); });
  document.getElementById('goClaims').addEventListener('click', () => { moreView = 'claims'; render(); window.scrollTo(0, 0); });

  document.getElementById('saveProject').addEventListener('click', () => {
    Object.assign(state.project, {
      name: val('pName'), lot: val('pLot'), contractor: val('pContractor'),
      client: val('pClient'), startDate: val('pStart'), targetDate: val('pTarget'),
      retentionPct: Number(val('pRetention')) || 0,
    });
    save(); render(); toast('Project details saved');
  });

  document.getElementById('exportJson').addEventListener('click', exportBackup);

  document.getElementById('importJson').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const incoming = data.app === 'tenn-bb' && data.state ? data : { state: data, photos: {} };
      if (!incoming.state.project || !Array.isArray(incoming.state.sections)) throw new Error('bad shape');
      if (!confirm('Restore this backup? Current data will be replaced.')) return;
      for (const [pid, dataUrl] of Object.entries(incoming.photos || {})) {
        try { await photoDB.put(pid, await (await fetch(dataUrl)).blob()); }
        catch (perr) { console.error('photo restore failed', pid, perr); }
      }
      state = migrate(incoming.state); save();
      render(); toast('Backup restored');
    } catch (err) { console.error(err); toast('Invalid backup file'); }
    e.target.value = '';
  });

  document.getElementById('exportBuyCsv').addEventListener('click', () => {
    const rows = [['Part', 'Area', 'Item', 'Spec', 'Qty', 'Category', 'Status', 'Note']];
    for (const a of state.areas) for (const it of a.items)
      rows.push([a.partTitle, `${a.code} ${a.title}`, it.name, it.spec, it.qty, it.cat, statusOf(it.status).label, it.note]);
    downloadFile(`BuyList_${today()}.csv`, toCSV(rows), 'text/csv');
  });

  document.getElementById('exportBqCsv').addEventListener('click', () => {
    const rows = [['Section', 'Code', 'Description', 'Unit', 'Qty', 'Rate', 'Progress %']];
    for (const s of state.sections) for (const it of s.items)
      rows.push([`${s.code} - ${s.title}`, it.code, it.desc, it.unit, it.qty, it.rate, it.pct || 0]);
    downloadFile(`BQ_${today()}.csv`, toCSV(rows), 'text/csv');
  });

  document.getElementById('csvFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try { importBQ(parseCSV(await f.text())); }
    catch (err) { console.error(err); toast('Could not read that CSV'); }
    e.target.value = '';
  });

  document.getElementById('resetAll').addEventListener('click', () => {
    if (!confirm('Reset ALL data — areas, buy list, BQ, claims and diary? This cannot be undone.')) return;
    if (!confirm('Really sure? Consider exporting a backup first.')) return;
    state = seedState(); save();
    render(); toast('App reset');
  });

  function val(id) { return document.getElementById(id).value.trim(); }
}

function importBQ(rows) {
  if (!rows.length) { toast('CSV is empty'); return; }
  let start = 0;
  if (/section/i.test(rows[0][0] || '')) start = 1;
  const sections = [];
  const byName = new Map();
  let count = 0;
  for (let i = start; i < rows.length; i++) {
    const [secRaw, code, desc, unit, qty, rate] = rows[i];
    if (!desc || !String(desc).trim()) continue;
    const secName = String(secRaw || 'GENERAL').trim() || 'GENERAL';
    let sec = byName.get(secName);
    if (!sec) {
      const m = secName.match(/^([A-Z0-9]{1,3})\s*[-–—:]\s*(.+)$/i);
      sec = { id: uid(), code: m ? m[1].toUpperCase() : String.fromCharCode(65 + sections.length), title: m ? m[2].trim() : secName, items: [] };
      byName.set(secName, sec);
      sections.push(sec);
    }
    sec.items.push({
      id: uid(), code: String(code || sec.items.length + 1).trim(), desc: String(desc).trim(),
      unit: String(unit || 'Lot').trim(), qty: Number(qty) || 1, rate: Number(String(rate).replace(/[^0-9.\-]/g, '')) || 0, pct: 0,
    });
    count++;
  }
  if (!count) { toast('No valid rows found'); return; }
  if (!confirm(`Import ${count} items across ${sections.length} section(s)? This replaces the current BQ.`)) return;
  state.sections = sections;
  for (const a of state.areas) syncAreaToBQ(a);
  save(); render();
  toast(`Imported ${count} BQ items`);
}

/* ============================== CSV helpers ============================== */
function toCSV(rows) {
  return rows.map(r => r.map(c => {
    const s = String(c ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\r\n');
}
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
function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* Full backup = state + diary photos (base64). Restore handles both this
   shape and older plain-state backups. */
async function exportBackup() {
  const photoIds = new Set(state.diary.flatMap(e => e.photoIds || []));
  const photos = {};
  for (const id of photoIds) {
    const blob = await photoDB.get(id).catch(() => null);
    if (blob) photos[id] = await blobToDataURL(blob);
  }
  state.lastBackup = today();
  save();
  downloadFile(`tenn_bukit_baru_backup_${today()}.json`,
    JSON.stringify({ app: 'tenn-bb', state, photos }), 'application/json');
  toast('Backup exported — keep a copy off this phone');
  render();
}
function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

/* ============================== Modal & toast ============================== */
/* Modals stack: opening a sheet from inside another modal layers on top,
   and closeModal() pops only the topmost layer. */
const modalRoot = document.getElementById('modalRoot');
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

/* ============================== Boot ============================== */
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW failed', e)));
}
