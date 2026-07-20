/* TENN — Ambience Bukit Baru Showroom · Project Progress PWA
   Vanilla JS, offline-first. Data lives in localStorage (BQ, claims, diary)
   and IndexedDB (photos). No backend required. */
'use strict';

const STORE_KEY = 'tenn-bb-state-v1';
const DB_NAME = 'tenn-bb-photos';
const RM = new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' });
const RM0 = new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 });

/* ============================== Seed data ============================== */
/* Section/item structure follows TENN's sales-gallery ID-works claim format
   (as per the Klebang claims). Quantities/rates are placeholders — fill in
   from the actual Lot 26662 BQ via Setup → Edit, or import the BQ as CSV. */
function seedState() {
  const S = (code, title, items) => ({
    id: uid(), code, title,
    items: items.map(([c, desc, unit, qty, rate]) => ({ id: uid(), code: c, desc, unit, qty, rate, pct: 0 }))
  });
  return {
    project: {
      name: 'Ambience Bukit Baru Showroom',
      lot: 'Lot 26662, Bukit Baru Sales Gallery — ID Works',
      contractor: 'TENN FASTENERS (MELAKA) SDN BHD',
      client: '',
      startDate: today(),
      targetDate: '',
    },
    sections: [
      S('A', 'SHOW UNIT TYPE A (2 BEDROOMS)', [
        ['1.a', 'Living hall TV area — feature wall panels c/w built-in TV console cabinet, light cove, etc. as per ID drawings', 'Lot', 1, 0],
        ['1.b', 'Supply and install LED light strip c/w driver and accessories', 'Lot', 1, 0],
        ['2.a', 'Dining area — wall panels / wainscoting c/w paint finish as per ID drawings', 'Lot', 1, 0],
        ['3.a', 'Living hall behind-sofa area — fluted / wainscoting wall panels, painting, etc.', 'Lot', 1, 0],
        ['4.a', 'Master bedroom — bedhead feature wall, wall panels, mirror, light cove as per ID drawings', 'Lot', 1, 0],
        ['4.b', 'Master bedroom — built-in wardrobe / cabinet c/w light cove', 'Lot', 1, 0],
        ['5.a', 'Bedroom 2 — bedhead feature wall, wall panels, light cove as per ID drawings', 'Lot', 1, 0],
        ['5.b', 'Bedroom 2 — built-in cabinet c/w groove line, door groove handle, light cove', 'Lot', 1, 0],
        ['6.a', 'Bathrooms — wall-hung basin cabinet c/w quartz stone counter top', 'Lot', 2, 0],
        ['6.b', 'Bathrooms — glass mirror c/w LED light cove', 'Lot', 2, 0],
        ['7.a', 'Wooden door frames c/w wood grain effect melamine', 'no', 5, 0],
      ]),
      S('B', 'SHOW UNIT TYPE B (3 BEDROOMS)', [
        ['1.a', 'Living hall TV area — feature wall panels c/w built-in TV console cabinet, light cove, etc. as per ID drawings', 'Lot', 1, 0],
        ['1.b', 'Supply and install LED light strip c/w driver and accessories', 'Lot', 1, 0],
        ['2.a', 'Dining hall — wainscoting / fluted wall panels as per ID drawings', 'Lot', 1, 0],
        ['3.a', 'Master bedroom — bedhead feature wall, wall panels, mirror, light cove as per ID drawings', 'Lot', 1, 0],
        ['3.b', 'Master bedroom — built-in wardrobe / cabinet c/w light cove', 'Lot', 1, 0],
        ['4.a', 'Bedroom 2 — feature wall, wall panels, light cove as per ID drawings', 'Lot', 1, 0],
        ['4.b', 'Bedroom 2 — built-in cabinet / study desk as per ID drawings', 'Lot', 1, 0],
        ['5.a', 'Bedroom 3 — feature wall, wall panels, light cove as per ID drawings', 'Lot', 1, 0],
        ['5.b', 'Bedroom 3 — built-in cabinet / bed frame as per ID drawings', 'Lot', 1, 0],
        ['6.a', 'Bathrooms — wall-hung basin cabinet c/w quartz stone counter top', 'Lot', 2, 0],
        ['6.b', 'Bathrooms — glass mirror c/w LED light cove', 'Lot', 2, 0],
        ['7.a', 'Wooden door frames c/w wood grain effect melamine', 'no', 6, 0],
      ]),
      S('C', 'SALES GALLERY COMMON AREA', [
        ['1.a', 'Reception / welcome counter — feature cladding and counter works as per ID drawings', 'Lot', 1, 0],
        ['2.a', 'Feature wall & display panels at gallery hall', 'Lot', 1, 0],
        ['3.a', 'Discussion area — wall panels / built-in cabinetry', 'Lot', 1, 0],
        ['4.a', 'LED light strips c/w drivers and accessories (common area)', 'Lot', 1, 0],
      ]),
    ],
    claims: [],
    diary: [],
  };
}

/* ============================== State ============================== */
let state = load();
let activeTab = 'dashboard';
let openSections = new Set(state.sections.map(s => s.id)); // all open initially

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.error('load failed', e); }
  const s = seedState();
  localStorage.setItem(STORE_KEY, JSON.stringify(s));
  return s;
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }
function today() { return new Date().toISOString().slice(0, 10); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function fmtRM(n) { return RM.format(n || 0); }
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ============================== Derived ============================== */
const itemAmount = it => (Number(it.qty) || 0) * (Number(it.rate) || 0);

function contractSum() {
  return state.sections.reduce((t, s) => t + s.items.reduce((a, it) => a + itemAmount(it), 0), 0);
}
function sectionPct(sec) {
  const amts = sec.items.map(itemAmount);
  const total = amts.reduce((a, b) => a + b, 0);
  if (total > 0) return sec.items.reduce((a, it, i) => a + amts[i] * (it.pct || 0), 0) / total;
  if (!sec.items.length) return 0;
  return sec.items.reduce((a, it) => a + (it.pct || 0), 0) / sec.items.length;
}
function overallPct() {
  const total = contractSum();
  if (total > 0) {
    return state.sections.reduce((t, s) => t + s.items.reduce((a, it) => a + itemAmount(it) * (it.pct || 0), 0), 0) / total;
  }
  const items = state.sections.flatMap(s => s.items);
  if (!items.length) return 0;
  return items.reduce((a, it) => a + (it.pct || 0), 0) / items.length;
}
function workDoneValue() {
  return state.sections.reduce((t, s) => t + s.items.reduce((a, it) => a + itemAmount(it) * (it.pct || 0) / 100, 0), 0);
}
/* pct already certified in claims, per item */
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
function findItem(id) {
  for (const s of state.sections) {
    const it = s.items.find(i => i.id === id);
    if (it) return { sec: s, item: it };
  }
  return null;
}

/* ============================== Router ============================== */
const view = document.getElementById('view');

function render() {
  document.getElementById('projectName').textContent = state.project.name;
  document.getElementById('projectSub').textContent = state.project.lot;
  document.getElementById('headerPct').textContent = Math.round(overallPct()) + '%';
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
  ({ dashboard: renderDashboard, bq: renderBQ, claims: renderClaims, diary: renderDiary, settings: renderSettings }[activeTab])();
}

document.querySelectorAll('.tab').forEach(t =>
  t.addEventListener('click', () => { activeTab = t.dataset.tab; render(); window.scrollTo(0, 0); }));

/* ============================== Dashboard ============================== */
function renderDashboard() {
  const pct = overallPct();
  const total = contractSum();
  const done = workDoneValue();
  const claimed = claimedValue();
  const p = state.project;

  let daysChip = '';
  if (p.targetDate) {
    const days = Math.ceil((new Date(p.targetDate + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 86400000);
    const cls = days < 0 ? 'over' : days <= 14 ? 'tight' : '';
    daysChip = `<span class="days-chip ${cls}">${days < 0 ? Math.abs(days) + ' days overdue' : days + ' days left'}</span>`;
  }

  view.innerHTML = `
    <div class="hero-stats">
      <div class="stat"><div class="num">${RM0.format(total)}</div><div class="lbl">Contract Sum</div></div>
      <div class="stat"><div class="num">${RM0.format(done)}</div><div class="lbl">Work Done</div></div>
      <div class="stat"><div class="num">${RM0.format(claimed)}</div><div class="lbl">Claimed</div></div>
    </div>

    <div class="card">
      <h2>Overall Progress</h2>
      <div class="big-progress"><i style="width:${pct}%"></i></div>
      <div class="progress-meta"><span>${pct.toFixed(1)}% complete</span><span>${(100 - pct).toFixed(1)}% remaining</span></div>
    </div>

    <div class="card">
      <h2>Timeline</h2>
      <div class="timeline-info">
        <span>Start: <b>${fmtDate(p.startDate)}</b></span>
        <span>Target: <b>${fmtDate(p.targetDate)}</b></span>
        ${daysChip}
      </div>
    </div>

    <div class="card">
      <h2>Progress by Section</h2>
      ${state.sections.map(s => {
        const sp = sectionPct(s);
        return `<div class="section-bar">
          <div class="row"><span class="name">${esc(s.code)} — ${esc(s.title)}</span><span class="pct">${Math.round(sp)}%</span></div>
          <div class="mini-progress"><i class="${sp >= 99.95 ? 'done' : ''}" style="width:${sp}%"></i></div>
        </div>`;
      }).join('') || '<p class="empty-note">No BQ sections yet — add them in the BQ tab.</p>'}
    </div>

    ${total === 0 ? `<div class="card"><h2>Getting Started</h2>
      <p style="font-size:13px;line-height:1.5;color:var(--ink-soft)">
        The BQ is pre-loaded with TENN's standard sales-gallery ID-works structure, but rates are not filled in yet.
        Tap items in the <b>BQ</b> tab to enter qty &amp; rates from the Lot 26662 BQ, or import the whole BQ as CSV in <b>Setup</b>.
      </p></div>` : ''}
  `;
}

/* ============================== BQ ============================== */
function renderBQ() {
  view.innerHTML = `
    <div class="bq-toolbar">
      <button class="btn sm accent" id="addSection">+ Section</button>
      <div class="spacer"></div>
      <button class="btn sm ghost" id="expandAll">Expand all</button>
      <button class="btn sm ghost" id="collapseAll">Collapse</button>
    </div>
    ${state.sections.map(sec => {
      const sp = sectionPct(sec);
      const amt = sec.items.reduce((a, it) => a + itemAmount(it), 0);
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
            </div>`).join('') || '<p class="empty-note">No items — tap below to add.</p>'}
          <div style="padding:10px 16px"><button class="btn sm ghost" data-additem="${sec.id}">+ Add item</button>
          <button class="btn sm ghost" data-editsec="${sec.id}">Edit section</button></div>
        </div>
      </div>`;
    }).join('')}
  `;

  view.querySelectorAll('.bq-section-head').forEach(h => h.addEventListener('click', () => {
    const id = h.closest('.bq-section').dataset.sec;
    openSections.has(id) ? openSections.delete(id) : openSections.add(id);
    h.closest('.bq-section').classList.toggle('open');
  }));
  view.querySelectorAll('.bq-item').forEach(el => el.addEventListener('click', () => openItemModal(el.dataset.item)));
  view.querySelectorAll('[data-additem]').forEach(b => b.addEventListener('click', () => openItemForm(b.dataset.additem, null)));
  view.querySelectorAll('[data-editsec]').forEach(b => b.addEventListener('click', () => openSectionForm(b.dataset.editsec)));
  document.getElementById('addSection').addEventListener('click', () => openSectionForm(null));
  document.getElementById('expandAll').addEventListener('click', () => { state.sections.forEach(s => openSections.add(s.id)); renderBQ(); });
  document.getElementById('collapseAll').addEventListener('click', () => { openSections.clear(); renderBQ(); });
}

/* --- item progress modal --- */
function openItemModal(itemId) {
  const found = findItem(itemId);
  if (!found) return;
  const { item } = found;
  const already = claimedPct(itemId);

  modal(`
    <div class="modal-head"><h3>${esc(item.code)} · Update Progress</h3><button class="modal-close">✕</button></div>
    <p style="font-size:13px;color:var(--ink-soft);line-height:1.4;margin-bottom:8px">${esc(item.desc)}</p>
    <p style="font-size:12px;color:var(--ink-faint)">${esc(item.unit)} × ${item.qty} @ ${fmtRM(item.rate)} = <b>${fmtRM(itemAmount(item))}</b></p>
    <div class="pct-display"><span id="pctNum">${Math.round(item.pct || 0)}</span><small>%</small></div>
    <input type="range" class="pct-slider" id="pctSlider" min="0" max="100" step="5" value="${Math.round(item.pct || 0)}">
    <div class="quick-pcts">${[0, 25, 50, 75, 90, 100].map(q => `<button data-q="${q}">${q}</button>`).join('')}</div>
    ${already > 0 ? `<p class="claimed-note">${already}% already certified in previous claims — progress cannot go below that.</p>` : ''}
    <div class="modal-actions">
      <button class="btn ghost" id="editItemBtn">Edit item</button>
      <button class="btn accent" id="savePct">Save</button>
    </div>
  `, root => {
    const slider = root.querySelector('#pctSlider');
    const num = root.querySelector('#pctNum');
    const sync = v => { slider.value = v; num.textContent = v; };
    slider.addEventListener('input', () => num.textContent = slider.value);
    root.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => sync(b.dataset.q)));
    root.querySelector('#savePct').addEventListener('click', () => {
      let v = Number(slider.value);
      if (v < already) { v = already; toast(`Kept at ${already}% — already certified in a claim`); }
      item.pct = v;
      save(); closeModal(); render();
    });
    root.querySelector('#editItemBtn').addEventListener('click', () => { closeModal(); openItemForm(found.sec.id, itemId); });
  });
}

/* --- item add/edit form --- */
function openItemForm(secId, itemId) {
  const sec = state.sections.find(s => s.id === secId);
  if (!sec) return;
  const item = itemId ? sec.items.find(i => i.id === itemId) : null;

  modal(`
    <div class="modal-head"><h3>${item ? 'Edit' : 'Add'} BQ Item</h3><button class="modal-close">✕</button></div>
    <div class="field"><label>Item code</label><input id="fCode" value="${esc(item?.code || '')}" placeholder="e.g. 1.a"></div>
    <div class="field"><label>Description</label><textarea id="fDesc" rows="3" placeholder="Work description as per BQ">${esc(item?.desc || '')}</textarea></div>
    <div class="field-row-3">
      <div class="field"><label>Unit</label><input id="fUnit" value="${esc(item?.unit || 'Lot')}"></div>
      <div class="field"><label>Qty</label><input id="fQty" type="number" inputmode="decimal" value="${item?.qty ?? 1}"></div>
      <div class="field"><label>Rate (RM)</label><input id="fRate" type="number" inputmode="decimal" value="${item?.rate ?? ''}" placeholder="0.00"></div>
    </div>
    <div class="modal-actions">
      ${item ? '<button class="btn danger" id="delItem">Delete</button>' : ''}
      <button class="btn accent" id="saveItem">${item ? 'Save' : 'Add item'}</button>
    </div>
  `, root => {
    root.querySelector('#saveItem').addEventListener('click', () => {
      const data = {
        code: root.querySelector('#fCode').value.trim() || String(sec.items.length + 1),
        desc: root.querySelector('#fDesc').value.trim(),
        unit: root.querySelector('#fUnit').value.trim() || 'Lot',
        qty: Number(root.querySelector('#fQty').value) || 0,
        rate: Number(root.querySelector('#fRate').value) || 0,
      };
      if (!data.desc) { toast('Description is required'); return; }
      if (item) Object.assign(item, data);
      else sec.items.push({ id: uid(), pct: 0, ...data });
      save(); closeModal(); render();
    });
    root.querySelector('#delItem')?.addEventListener('click', () => {
      if (!confirm('Delete this BQ item? Its progress history in claims is kept.')) return;
      sec.items = sec.items.filter(i => i.id !== itemId);
      save(); closeModal(); render();
    });
  });
}

/* --- section add/edit form --- */
function openSectionForm(secId) {
  const sec = secId ? state.sections.find(s => s.id === secId) : null;
  modal(`
    <div class="modal-head"><h3>${sec ? 'Edit' : 'Add'} Section</h3><button class="modal-close">✕</button></div>
    <div class="field-row">
      <div class="field"><label>Code</label><input id="sCode" value="${esc(sec?.code || String.fromCharCode(65 + state.sections.length))}"></div>
      <div class="field"><label>Title</label><input id="sTitle" value="${esc(sec?.title || '')}" placeholder="e.g. SHOW UNIT TYPE C"></div>
    </div>
    <div class="modal-actions">
      ${sec ? '<button class="btn danger" id="delSec">Delete</button>' : ''}
      <button class="btn accent" id="saveSec">${sec ? 'Save' : 'Add section'}</button>
    </div>
  `, root => {
    root.querySelector('#saveSec').addEventListener('click', () => {
      const code = root.querySelector('#sCode').value.trim();
      const title = root.querySelector('#sTitle').value.trim();
      if (!title) { toast('Title is required'); return; }
      if (sec) { sec.code = code; sec.title = title; }
      else { const ns = { id: uid(), code, title, items: [] }; state.sections.push(ns); openSections.add(ns.id); }
      save(); closeModal(); render();
    });
    root.querySelector('#delSec')?.addEventListener('click', () => {
      if (!confirm('Delete this section and ALL its items?')) return;
      state.sections = state.sections.filter(s => s.id !== secId);
      save(); closeModal(); render();
    });
  });
}

/* ============================== Claims ============================== */
function renderClaims() {
  const claimable = newClaimLines();
  const claimableValue = claimable.reduce((a, l) => a + l.amountThis, 0);

  view.innerHTML = `
    <div class="card">
      <h2>New Progress Claim</h2>
      <p style="font-size:13px;color:var(--ink-soft);line-height:1.5;margin-bottom:12px">
        ${claimable.length
          ? `${claimable.length} item(s) have progress not yet claimed — uncertified work value <b>${fmtRM(claimableValue)}</b>.`
          : 'No unclaimed progress right now. Update item progress in the BQ tab first.'}
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
      : '<p class="empty-note">No claims yet. Generate your first claim once site progress starts.</p>'}
    </div>
  `;

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

/* --- printable claim statement, in TENN's Klebang claim layout --- */
function openClaimDoc(claimId) {
  const c = state.claims.find(x => x.id === claimId);
  if (!c) return;
  const p = state.project;

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
  downloadFile(`Claim_${c.no}_${p.name.replace(/\s+/g, '_')}.csv`, toCSV(rows), 'text/csv');
}

/* ============================== Diary ============================== */
function renderDiary() {
  view.innerHTML = `
    <div class="card">
      <h2>New Diary Entry</h2>
      <div class="field"><label>Date</label><input type="date" id="dDate" value="${today()}"></div>
      <div class="field"><label>Notes — work done, manpower, deliveries, issues</label>
        <textarea id="dText" rows="3" placeholder="e.g. 4 workers on site. Completed TV feature wall framing at Type A. Panels delivered."></textarea></div>
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

/* --- IndexedDB photo store --- */
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

/* ============================== Settings ============================== */
function renderSettings() {
  const p = state.project;
  view.innerHTML = `
    <div class="card">
      <h2>Project Details</h2>
      <div class="field"><label>Project name</label><input id="pName" value="${esc(p.name)}"></div>
      <div class="field"><label>Lot / reference</label><input id="pLot" value="${esc(p.lot)}"></div>
      <div class="field"><label>Contractor</label><input id="pContractor" value="${esc(p.contractor)}"></div>
      <div class="field"><label>Client / main contractor</label><input id="pClient" value="${esc(p.client)}" placeholder="as per Letter of Award"></div>
      <div class="field-row">
        <div class="field"><label>Start date</label><input type="date" id="pStart" value="${esc(p.startDate)}"></div>
        <div class="field"><label>Target completion</label><input type="date" id="pTarget" value="${esc(p.targetDate)}"></div>
      </div>
      <button class="btn accent block" id="saveProject">Save Details</button>
    </div>

    <div class="card">
      <h2>Import BQ (CSV)</h2>
      <p style="font-size:12px;color:var(--ink-soft);line-height:1.5;margin-bottom:10px">
        Columns: <b>Section, Code, Description, Unit, Qty, Rate</b> — one row per BQ item.
        Rows with the same Section value are grouped together. Importing <b>replaces</b> the current BQ (claims are kept but will no longer match removed items).
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn ghost sm" id="csvTemplate">Download template</button>
        <label class="btn sm" style="position:relative;overflow:hidden">Import CSV<input type="file" id="csvFile" accept=".csv,text/csv" style="position:absolute;inset:0;opacity:0"></label>
      </div>
    </div>

    <div class="card">
      <h2>Backup & Restore</h2>
      <p style="font-size:12px;color:var(--ink-soft);margin-bottom:10px">All data is stored on this device. Export a backup regularly, especially before clearing browser data.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn ghost sm" id="exportJson">Export backup</button>
        <label class="btn ghost sm" style="position:relative;overflow:hidden">Restore backup<input type="file" id="importJson" accept=".json,application/json" style="position:absolute;inset:0;opacity:0"></label>
        <button class="btn ghost sm" id="exportBqCsv">Export BQ as CSV</button>
      </div>
    </div>

    <div class="card">
      <h2>Danger Zone</h2>
      <button class="btn danger sm" id="resetAll">Reset all data</button>
    </div>
  `;

  document.getElementById('saveProject').addEventListener('click', () => {
    Object.assign(state.project, {
      name: val('pName'), lot: val('pLot'), contractor: val('pContractor'),
      client: val('pClient'), startDate: val('pStart'), targetDate: val('pTarget'),
    });
    save(); render(); toast('Project details saved');
  });

  document.getElementById('csvTemplate').addEventListener('click', () => {
    const rows = [['Section', 'Code', 'Description', 'Unit', 'Qty', 'Rate']];
    for (const s of state.sections) for (const it of s.items)
      rows.push([`${s.code} - ${s.title}`, it.code, it.desc, it.unit, it.qty, it.rate]);
    downloadFile('BQ_template.csv', toCSV(rows), 'text/csv');
  });

  document.getElementById('csvFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const rows = parseCSV(await f.text());
      importBQ(rows);
    } catch (err) { console.error(err); toast('Could not read that CSV'); }
    e.target.value = '';
  });

  document.getElementById('exportBqCsv').addEventListener('click', () => {
    const rows = [['Section', 'Code', 'Description', 'Unit', 'Qty', 'Rate', 'Progress %']];
    for (const s of state.sections) for (const it of s.items)
      rows.push([`${s.code} - ${s.title}`, it.code, it.desc, it.unit, it.qty, it.rate, it.pct || 0]);
    downloadFile(`BQ_${state.project.name.replace(/\s+/g, '_')}.csv`, toCSV(rows), 'text/csv');
  });

  document.getElementById('exportJson').addEventListener('click', () => {
    downloadFile(`tenn_bukit_baru_backup_${today()}.json`, JSON.stringify(state, null, 2), 'application/json');
  });

  document.getElementById('importJson').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data.project || !Array.isArray(data.sections)) throw new Error('bad shape');
      if (!confirm('Restore this backup? Current data will be replaced.')) return;
      state = data; save();
      openSections = new Set(state.sections.map(s => s.id));
      render(); toast('Backup restored');
    } catch (err) { console.error(err); toast('Invalid backup file'); }
    e.target.value = '';
  });

  document.getElementById('resetAll').addEventListener('click', () => {
    if (!confirm('Reset ALL data — BQ, progress, claims and diary? This cannot be undone.')) return;
    if (!confirm('Really sure? Consider exporting a backup first.')) return;
    state = seedState(); save();
    openSections = new Set(state.sections.map(s => s.id));
    render(); toast('App reset');
  });

  function val(id) { return document.getElementById(id).value.trim(); }
}

function importBQ(rows) {
  if (!rows.length) { toast('CSV is empty'); return; }
  let start = 0;
  if (/section/i.test(rows[0][0] || '')) start = 1; // skip header
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
  openSections = new Set(sections.map(s => s.id));
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

/* ============================== Modal & toast ============================== */
const modalRoot = document.getElementById('modalRoot');
function modal(html, wire) {
  modalRoot.innerHTML = `<div class="modal-backdrop"><div class="modal">${html}</div></div>`;
  const backdrop = modalRoot.firstElementChild;
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });
  backdrop.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', closeModal));
  wire(backdrop);
}
function closeModal() { modalRoot.innerHTML = ''; }

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.hidden = true, 2600);
}

/* ============================== Boot ============================== */
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW failed', e)));
}
