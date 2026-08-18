export type PhaseStatus = 'todo' | 'prog' | 'done'

/** Section lifecycle; drives the phase percentage (0 → ⅓ → ⅔ → 1). */
export type SectionStatus = 'todo' | 'started' | 'ongoing' | 'done'

/** A piece of work within a phase, handled by exactly one subcontractor. */
export interface PhaseSection {
  id: string
  name: string
  subcon: string
  status: SectionStatus
}

/** An item card on the Phases screen.
 *  - kind 'work': progress is the average of its section statuses; done when
 *    every section is finished.
 *  - kind 'task' (meetings etc.): tags multiple subcons; simply pending or
 *    done, counting 0% or 100% toward its phase. */
export interface Phase {
  id: string
  name: string
  kind: 'work' | 'task'
  sections: PhaseSection[]
  /** task items: the subcontractors involved */
  taskSubcons?: string[]
  /** task items: completed? */
  taskDone?: boolean
  note?: string
  blocked?: boolean
}

/** Divider that starts a phase group in the item list. */
export interface PhaseDivider {
  id: string
  name: string
  /** The item this divider sits before; null → after the last item. */
  beforeItemId: string | null
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
  /** Work items, in display order. */
  phases: Phase[]
  /** Dividers grouping the items into phases. */
  dividers: PhaseDivider[]
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
