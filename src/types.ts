export type PhaseStatus = 'todo' | 'prog' | 'done'

/** One subcontractor's individually-tracked progress within a phase. */
export interface PhaseWork {
  subcon: string
  pct: number
}

export interface Phase {
  id: string
  name: string
  /** One entry per assigned subcontractor; phase progress is their average. */
  work: PhaseWork[]
  note?: string
  blocked?: boolean
}

export interface Movement {
  dateISO: string
  what: string
  delta: number
}

export interface Supplier {
  name: string
  note: string
  phone: string
}

export interface Supply {
  id: string
  name: string
  unit: string
  stock: number
  max: number
  min: number
  loc: string
  supplier: Supplier
  cost: number
  usedBy: string
  spent: number
  status: 'stock' | 'transit'
  ordered: boolean
  etaISO?: string
  reorderQty: number
  runout?: string
  moves: Movement[]
}

export interface ReportMaterial {
  supplyId: string
  name: string
  unit: string
  qty: number
}

export interface Report {
  id: string
  dateISO: string
  photoIds: string[]
  manpower: Record<string, number>
  materials: ReportMaterial[]
  summary: string
  issues: string
  complete: boolean
}

export type DrawingSource =
  | { kind: 'bundled'; url: string }
  | { kind: 'uploaded'; blobId: string; mime: string }

export interface DrawingSet {
  id: string
  name: string
  pages: number
  revISO: string
  tags: string[]
  src: DrawingSource
}

export interface Draft {
  dateISO: string
  photoIds: string[]
  man: Record<string, number>
  mats: { supplyId: string; qty: number }[]
  summary: string
  issues: string
  submitted: boolean
}

export interface Subcon {
  name: string
  trade: string
}

export interface Project {
  id: string
  name: string
  targetDateISO: string
  /** Team chat link for the floating WhatsApp button; empty hides the button. */
  whatsappUrl?: string
  subcons: Subcon[]
  phases: Phase[]
  supplies: Supply[]
  reports: Report[]
  drawings: DrawingSet[]
  draft: Draft
  nextPo: number
}

export interface AppState {
  version: number
  projects: Project[]
  activeProjectId: string
}
