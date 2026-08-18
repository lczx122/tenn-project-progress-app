// Seed data for the Faithview Gallery project, taken from the design handoff.
// Dates are generated relative to "today" so the demo data always looks current.
import type { AppState, Draft, Project, Subcon } from './types'
import { addDays, todayISO } from './utils/dates'

export const DEFAULT_WHATSAPP_URL = 'https://chat.whatsapp.com/G6L2erZVMP12ivZerciRFs'

export const SUBCONS: Subcon[] = [
  { name: 'Classic Home', trade: 'Carpentry' },
  { name: 'Fanmuli 定制', trade: 'Custom joinery' },
  { name: 'Ah Kang', trade: 'Electrical' },
  { name: 'Hock Heng', trade: 'Glass & signage' },
]

export function emptyDraft(subcons: Subcon[]): Draft {
  return {
    dateISO: todayISO(),
    photoIds: [],
    man: Object.fromEntries(subcons.map((s) => [s.name, 0])),
    mats: [],
    summary: '',
    issues: '',
    submitted: false,
  }
}

/** New projects start blank — subcons, phases and supplies are added in-app. */
export function newProject(id: string, name: string, targetDateISO: string): Project {
  return {
    id,
    name,
    targetDateISO,
    whatsappUrl: '',
    subcons: [],
    phases: [],
    dividers: [],
    supplies: [],
    reports: [],
    drawings: [],
    draft: emptyDraft([]),
    nextPo: 1001,
  }
}

export function seedState(): AppState {
  const T = todayISO()
  const d = (n: number) => addDays(T, n)

  const project: Project = {
    id: 'p1',
    name: 'Faithview Gallery',
    targetDateISO: d(49),
    whatsappUrl: DEFAULT_WHATSAPP_URL,
    subcons: SUBCONS,
    nextPo: 1052,
    phases: [
      // meetings are task items — tagged with every subcon involved
      { id: 'ph1', name: 'Faithview Meeting — Pre-condition check', kind: 'task', sections: [],
        taskSubcons: ['Classic Home'], taskDone: true },
      { id: 'ph2', name: 'Material Prep', kind: 'work', sections: [
        { id: 'ph2-s1', name: 'Materials ordered & received', subcon: 'Classic Home', status: 'done' },
      ] },
      { id: 'ph3', name: 'Site Meeting with Sub-con', kind: 'task', sections: [],
        taskSubcons: ['Classic Home', 'Fanmuli 定制', 'Ah Kang', 'Hock Heng'], taskDone: true },
      { id: 'ph4', name: 'Backdrop 01', kind: 'work', note: 'Due 18 Aug · photo logged today', sections: [
        { id: 'ph4-s1', name: 'Framing', subcon: 'Classic Home', status: 'done' },
        { id: 'ph4-s2', name: 'Cladding', subcon: 'Classic Home', status: 'ongoing' },
        { id: 'ph4-s3', name: 'Paint & finish', subcon: 'Classic Home', status: 'todo' },
      ] },
      { id: 'ph5', name: 'Reception Counter 01', kind: 'work', note: 'Blocked · waiting laminate', blocked: true, sections: [
        { id: 'ph5-s1', name: 'Carcass', subcon: 'Fanmuli 定制', status: 'done' },
        { id: 'ph5-s2', name: 'Laminate finish', subcon: 'Fanmuli 定制', status: 'todo' },
      ] },
      // multi-trade phase: each section handled by one subcon
      { id: 'ph6', name: 'Pantry', kind: 'work', note: 'Wiring first fix · due 22 Aug', sections: [
        { id: 'ph6-s1', name: 'Wiring first fix', subcon: 'Ah Kang', status: 'ongoing' },
        { id: 'ph6-s2', name: 'Pantry cabinets', subcon: 'Classic Home', status: 'started' },
      ] },
      { id: 'ph7', name: 'Toilet Glass (M & F)', kind: 'work', note: 'Measurement done · fabricating', sections: [
        { id: 'ph7-s1', name: 'Measurement', subcon: 'Hock Heng', status: 'done' },
        { id: 'ph7-s2', name: 'Fabrication', subcon: 'Hock Heng', status: 'started' },
        { id: 'ph7-s3', name: 'Installation', subcon: 'Hock Heng', status: 'todo' },
      ] },
      { id: 'ph8', name: 'Backdrop 02', kind: 'work', sections: [{ id: 'ph8-s1', name: 'Main works', subcon: 'Classic Home', status: 'todo' }] },
      { id: 'ph9', name: 'Backdrop 03', kind: 'work', sections: [{ id: 'ph9-s1', name: 'Main works', subcon: 'Classic Home', status: 'todo' }] },
      { id: 'ph10', name: 'Backdrop 04', kind: 'work', sections: [{ id: 'ph10-s1', name: 'Main works', subcon: 'Classic Home', status: 'todo' }] },
      { id: 'ph11', name: 'Reception Counter 02', kind: 'work', sections: [{ id: 'ph11-s1', name: 'Main works', subcon: 'Fanmuli 定制', status: 'todo' }] },
      { id: 'ph12', name: 'Model House', kind: 'work', sections: [{ id: 'ph12-s1', name: 'Main works', subcon: 'Fanmuli 定制', status: 'todo' }] },
      { id: 'ph13', name: 'Sitting Area 01', kind: 'work', sections: [{ id: 'ph13-s1', name: 'Main works', subcon: 'Fanmuli 定制', status: 'todo' }] },
      { id: 'ph14', name: 'Sitting Area 02', kind: 'work', sections: [{ id: 'ph14-s1', name: 'Main works', subcon: 'Ah Kang', status: 'todo' }] },
      { id: 'ph15', name: 'Type Unit Signage A/B', kind: 'work', sections: [{ id: 'ph15-s1', name: 'Main works', subcon: 'Hock Heng', status: 'todo' }] },
      { id: 'ph16', name: 'Advertising Board', kind: 'work', sections: [{ id: 'ph16-s1', name: 'Main works', subcon: 'Hock Heng', status: 'todo' }] },
    ],
    dividers: [
      { id: 'dv1', name: 'Phase 1 — Preparation', beforeItemId: 'ph1' },
      { id: 'dv2', name: 'Phase 2 — Main works', beforeItemId: 'ph4' },
      { id: 'dv3', name: 'Phase 3 — Finishing & signage', beforeItemId: 'ph12' },
    ],
    supplies: [
      {
        id: 's1', name: 'Plywood 18mm', unit: 'pcs', stock: 6, max: 40, min: 10,
        loc: 'On site · Store room B',
        supplier: { name: 'Seng Huat Trading Sdn Bhd', note: 'Lead time 2–3 days · last order 28 Jul', phone: '+60123456701' },
        cost: 78, usedBy: 'Classic Home', spent: 2652, status: 'stock', ordered: false, reorderQty: 30, runout: '~1.5 days',
        moves: [
          { dateISO: T, what: 'Used — Backdrop 01 cladding', delta: -4 },
          { dateISO: d(-1), what: 'Used — Backdrop 01 framing', delta: -5 },
          { dateISO: d(-15), what: 'Delivered — PO #1042', delta: 40 },
        ],
      },
      {
        id: 's2', name: 'LED strip 4000K', unit: 'm', stock: 8, max: 60, min: 12,
        loc: 'On site · with Ah Kang',
        supplier: { name: 'LiteWorks Electrical', note: 'Lead time 3–4 days · last order 20 Jul', phone: '+60123456702' },
        cost: 12, usedBy: 'Ah Kang', spent: 624, status: 'stock', ordered: false, reorderQty: 50, runout: '~2 days',
        moves: [
          { dateISO: d(-1), what: 'Used — Backdrop 01 cove light', delta: -10 },
          { dateISO: d(-23), what: 'Delivered — PO #1038', delta: 60 },
        ],
      },
      {
        id: 's3', name: 'Laminate sheets — Walnut', unit: 'pcs', stock: 0, max: 25, min: 5,
        loc: 'In transit · Seng Huat Trading',
        supplier: { name: 'Seng Huat Trading Sdn Bhd', note: 'Lead time 2–3 days · ordered 10 Aug', phone: '+60123456701' },
        cost: 145, usedBy: 'Fanmuli 定制', spent: 0, status: 'transit', etaISO: d(1), ordered: true, reorderQty: 0,
        moves: [{ dateISO: d(-2), what: 'Ordered — PO #1051 (25 pcs)', delta: 0 }],
      },
      {
        id: 's4', name: 'Tempered glass panels', unit: 'panels', stock: 0, max: 4, min: 1,
        loc: 'Fabricating · Hock Heng workshop',
        supplier: { name: 'Hock Heng Glass', note: 'Fabrication 5–7 days · measured 8 Aug', phone: '+60123456704' },
        cost: 680, usedBy: 'Hock Heng', spent: 0, status: 'transit', etaISO: d(3), ordered: true, reorderQty: 0,
        moves: [{ dateISO: d(-4), what: 'Measurement confirmed on site', delta: 0 }],
      },
      {
        id: 's5', name: 'Wiring — 2.5mm² cable', unit: 'm', stock: 180, max: 300, min: 50,
        loc: 'On site · Store room A',
        supplier: { name: 'LiteWorks Electrical', note: 'Lead time 3–4 days · last order 15 Jul', phone: '+60123456702' },
        cost: 3, usedBy: 'Ah Kang', spent: 360, status: 'stock', ordered: false, reorderQty: 200,
        moves: [
          { dateISO: d(-1), what: 'Used — Pantry first fix', delta: -35 },
          { dateISO: d(-28), what: 'Delivered — PO #1030', delta: 300 },
        ],
      },
      {
        id: 's6', name: 'Paint — Nippon Matt White', unit: 'L', stock: 14, max: 20, min: 5,
        loc: 'On site · Store room A',
        supplier: { name: 'Colour Trade Hardware', note: 'Lead time 1–2 days · last order 30 Jul', phone: '+60123456706' },
        cost: 32, usedBy: 'Classic Home', spent: 192, status: 'stock', ordered: false, reorderQty: 10,
        moves: [
          { dateISO: d(-2), what: 'Used — Backdrop base coat', delta: -6 },
          { dateISO: d(-13), what: 'Delivered — PO #1045', delta: 20 },
        ],
      },
    ],
    reports: [
      {
        id: 'r1', dateISO: d(-1), photoIds: [], complete: false,
        manpower: { 'Classic Home': 4, 'Fanmuli 定制': 0, 'Ah Kang': 3, 'Hock Heng': 1 },
        materials: [],
        summary: 'Backdrop 01 framing, wiring first fix at Pantry',
        issues: '',
      },
      {
        id: 'r2', dateISO: d(-2), photoIds: [], complete: true,
        manpower: { 'Classic Home': 3, 'Fanmuli 定制': 4, 'Ah Kang': 2, 'Hock Heng': 0 },
        materials: [{ supplyId: 's6', name: 'Paint — Nippon Matt White', unit: 'L', qty: 6 }],
        summary: 'Reception Counter 01 carcass done, laminate pending',
        issues: '',
      },
      {
        id: 'r3', dateISO: d(-5), photoIds: [], complete: true,
        manpower: { 'Classic Home': 5, 'Fanmuli 定制': 0, 'Ah Kang': 2, 'Hock Heng': 0 },
        materials: [{ supplyId: 's1', name: 'Plywood 18mm', unit: 'pcs', qty: 5 }],
        summary: 'Backdrop 01 cladding started',
        issues: '',
      },
    ],
    drawings: [
      {
        id: 'dw1', name: 'LOT 26662 — Sales Gallery', pages: 10, revISO: d(-12),
        tags: ['Backdrop 01–04', 'Model House', 'Pantry'],
        src: { kind: 'bundled', url: 'drawings/sales-gallery.pdf' },
      },
      {
        id: 'dw2', name: 'LOT 26662 — Sales Gallery (Lobby)', pages: 13, revISO: d(-12),
        tags: ['Reception Counter 01–02', 'Sitting Area 01–02'],
        src: { kind: 'bundled', url: 'drawings/sales-gallery-lobby.pdf' },
      },
    ],
    draft: emptyDraft(SUBCONS),
  }

  return { version: 6, projects: [project], activeProjectId: 'p1' }
}
