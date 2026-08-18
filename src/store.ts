// App state store: plain external store + useSyncExternalStore hook.
// State persists to IndexedDB on every change; photos/files are stored as blobs.
import { useSyncExternalStore } from 'react'
import type { AppState, DrawingSet, Phase, Project, Report, Supply } from './types'
import { deleteDatabase, kvGet, kvSet, photoDelete, photoPut } from './db'
import { DEFAULT_WHATSAPP_URL, emptyDraft, newProject, seedState } from './seed'
import { nextSectionStatus } from './selectors'
import { addDays, todayISO } from './utils/dates'

const STATE_KEY = 'app-state'

let state: AppState | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

let persistTimer: ReturnType<typeof setTimeout> | undefined
function persist() {
  clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    if (state) kvSet(STATE_KEY, state).catch((e) => console.error('persist failed', e))
  }, 120)
}

// Called after every local mutation so the sync engine can schedule a push.
let onLocalChange: (() => void) | null = null
export function setOnLocalChange(cb: (() => void) | null) {
  onLocalChange = cb
}

function set(updater: (s: AppState) => AppState) {
  if (!state) return
  state = updater(state)
  emit()
  persist()
  onLocalChange?.()
}

/** Adopt state from the sync backend (does NOT count as a local change).
 *  Migrated too — another device may still push the old shape. */
export function replaceState(next: AppState) {
  state = rolloverDrafts(migrateState(next))
  emit()
  persist()
}

/** Update the active project immutably. */
function setProject(updater: (p: Project) => Project) {
  set((s) => ({
    ...s,
    projects: s.projects.map((p) => (p.id === s.activeProjectId ? updater(p) : p)),
  }))
}

// ---- placeholder photos for seeded demo reports (gradient tiles, like the design) ----
const GRADS: [string, string][] = [
  ['#C9C4BA', '#A8A296'], ['#B9B4A8', '#98928A'], ['#CFCABF', '#ABA79C'],
  ['#C2BDB2', '#9E988E'], ['#BDB8AC', '#9A948A'], ['#D2CDC2', '#AEA89E'],
]

function makePlaceholderPhoto(i: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    const c = document.createElement('canvas')
    c.width = c.height = 640
    const ctx = c.getContext('2d')
    if (!ctx) return resolve(null)
    const [a, b] = GRADS[i % GRADS.length]
    const g = ctx.createLinearGradient(0, 0, 640, 640)
    g.addColorStop(0, a)
    g.addColorStop(1, b)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 640, 640)
    c.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8)
  })
}

async function seedReportPhotos(s: AppState): Promise<AppState> {
  const project = s.projects[0]
  const counts = [3, 5, 4] // photos per seeded report, matching the design copy
  const reports: Report[] = []
  for (let r = 0; r < project.reports.length; r++) {
    const n = counts[r] ?? 3
    const ids: string[] = []
    for (let i = 0; i < n; i++) {
      const blob = await makePlaceholderPhoto(r * 2 + i)
      if (blob) {
        const id = `seed-${r}-${i}`
        await photoPut(id, blob)
        ids.push(id)
      }
    }
    reports.push({ ...project.reports[r], photoIds: ids })
  }
  return { ...s, projects: [{ ...project, reports }] }
}

/** Schema migrations — idempotent, applied to local state and states adopted from sync. */
function migrateState(s: AppState): AppState {
  let out = s
  // v1 → v2: phases move from single {subcon,status,pct} to per-subcon work[]
  if (out.version < 2) {
    interface LegacyPhase {
      id: string; name: string; note?: string; blocked?: boolean
      subcon?: string; status?: 'todo' | 'prog' | 'done'; pct?: number
      work?: { subcon: string; pct: number }[]
    }
    out = {
      ...out,
      version: 2,
      projects: out.projects.map((p) => ({
        ...p,
        // intermediate v2 shape (work[]); converted to sections by the v4 step below
        phases: (p.phases as unknown as LegacyPhase[]).map((ph) => {
          if (ph.work) return ph
          const pct = ph.status === 'done' ? 100 : ph.status === 'prog' ? Math.max(ph.pct ?? 5, 1) : 0
          return { id: ph.id, name: ph.name, note: ph.note, blocked: ph.blocked, work: [{ subcon: ph.subcon ?? '', pct }] }
        }) as unknown as Phase[],
      })),
    }
  }
  // v2 → v3: per-project WhatsApp group link (existing projects keep the original group)
  if (out.version < 3) {
    out = {
      ...out,
      version: 3,
      projects: out.projects.map((p) => ({ ...p, whatsappUrl: p.whatsappUrl ?? DEFAULT_WHATSAPP_URL })),
    }
  }
  // v3 → v4: per-subcon work[] percentages become named sections with statuses
  if (out.version < 4) {
    interface LegacyWorkPhase {
      id: string; name: string; note?: string; blocked?: boolean
      work?: { subcon: string; pct: number }[]
      sections?: Phase['sections']
    }
    const toStatus = (pct: number): Phase['sections'][number]['status'] =>
      pct >= 100 ? 'done' : pct >= 50 ? 'ongoing' : pct > 0 ? 'started' : 'todo'
    out = {
      ...out,
      version: 4,
      projects: out.projects.map((p) => ({
        ...p,
        phases: (p.phases as unknown as LegacyWorkPhase[]).map((ph) => {
          if (ph.sections) return ph as Phase
          return {
            id: ph.id, name: ph.name, note: ph.note, blocked: ph.blocked,
            sections: (ph.work ?? []).map((w, i) => ({
              id: `${ph.id}-s${i + 1}`,
              name: 'Main works',
              subcon: w.subcon,
              status: toStatus(w.pct),
            })),
          }
        }),
      })),
    }
  }
  return out
}

/** Roll unsubmitted drafts over to today; clean up photos of stale unsubmitted drafts. */
function rolloverDrafts(s: AppState): AppState {
  const T = todayISO()
  return {
    ...s,
    projects: s.projects.map((p) => {
      if (p.draft.dateISO === T) return p
      if (!p.draft.submitted) p.draft.photoIds.forEach((id) => photoDelete(id).catch(() => {}))
      return { ...p, draft: emptyDraft(p.subcons) }
    }),
  }
}

export async function initStore(): Promise<void> {
  const saved = await kvGet<AppState>(STATE_KEY)
  if (saved) {
    state = rolloverDrafts(migrateState(saved))
  } else {
    state = rolloverDrafts(await seedReportPhotos(seedState()))
    await kvSet(STATE_KEY, state)
  }
  emit()
}

export function getState(): AppState {
  if (!state) throw new Error('store not initialized')
  return state
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getState,
    getState,
  )
}

export function activeProject(s: AppState): Project {
  return s.projects.find((p) => p.id === s.activeProjectId) ?? s.projects[0]
}

// ------------------------------- actions -------------------------------

export const actions = {
  switchProject(id: string) {
    set((s) => ({ ...s, activeProjectId: id }))
  },

  createProject(name: string, targetDateISO: string): string {
    const id = `p${Date.now()}`
    set((s) => ({
      ...s,
      projects: [...s.projects, newProject(id, name, targetDateISO)],
      activeProjectId: id,
    }))
    return id
  },

  /** Mark every not-started section as Started. */
  startPhase(phaseId: string) {
    setProject((p) => ({
      ...p,
      phases: p.phases.map((ph) =>
        ph.id === phaseId
          ? {
              ...ph,
              sections: ph.sections.map((s) => (s.status === 'todo' ? { ...s, status: 'started' } : s)),
              note: 'Started today',
              blocked: false,
            }
          : ph,
      ),
    }))
  },

  /** Advance one section to the next status. Returns true when the whole phase completed. */
  advanceSection(phaseId: string, sectionId: string): boolean {
    let completed = false
    setProject((p) => ({
      ...p,
      phases: p.phases.map((ph) => {
        if (ph.id !== phaseId) return ph
        const sections = ph.sections.map((s) =>
          s.id === sectionId ? { ...s, status: nextSectionStatus(s.status) } : s,
        )
        completed = sections.length > 0 && sections.every((s) => s.status === 'done')
        return { ...ph, sections }
      }),
    }))
    return completed
  },

  reorderSupply(supplyId: string) {
    const T = todayISO()
    setProject((p) => ({
      ...p,
      nextPo: p.nextPo + 1,
      supplies: p.supplies.map((su) =>
        su.id === supplyId
          ? {
              ...su,
              ordered: true,
              etaISO: addDays(T, 3),
              moves: [
                { dateISO: T, what: `Ordered — PO #${p.nextPo} (${su.reorderQty} ${su.unit})`, delta: 0 },
                ...su.moves,
              ],
            }
          : su,
      ),
    }))
  },

  // ---- daily draft ----
  draftAddPhoto(photoId: string) {
    setProject((p) => ({ ...p, draft: { ...p.draft, photoIds: [...p.draft.photoIds, photoId] } }))
  },

  draftRemovePhoto(photoId: string) {
    photoDelete(photoId).catch(() => {})
    setProject((p) => ({ ...p, draft: { ...p.draft, photoIds: p.draft.photoIds.filter((id) => id !== photoId) } }))
  },

  draftSetMan(name: string, count: number) {
    setProject((p) => ({ ...p, draft: { ...p.draft, man: { ...p.draft.man, [name]: Math.max(0, count) } } }))
  },

  draftAddMat(supplyId: string, qty: number) {
    setProject((p) => ({ ...p, draft: { ...p.draft, mats: [...p.draft.mats, { supplyId, qty }] } }))
  },

  draftSetMatQty(supplyId: string, qty: number) {
    setProject((p) => ({
      ...p,
      draft: { ...p.draft, mats: p.draft.mats.map((m) => (m.supplyId === supplyId ? { ...m, qty } : m)) },
    }))
  },

  draftRemoveMat(supplyId: string) {
    setProject((p) => ({ ...p, draft: { ...p.draft, mats: p.draft.mats.filter((m) => m.supplyId !== supplyId) } }))
  },

  draftSetSummary(summary: string) {
    setProject((p) => ({ ...p, draft: { ...p.draft, summary } }))
  },

  draftSetIssues(issues: string) {
    setProject((p) => ({ ...p, draft: { ...p.draft, issues } }))
  },

  /** Deduct stock, log movements, create the report, mark today submitted. */
  submitReport() {
    const T = todayISO()
    setProject((p) => {
      const dr = p.draft
      const supplies = p.supplies.map((su) => {
        const used = dr.mats.find((m) => m.supplyId === su.id)
        if (!used) return su
        return {
          ...su,
          stock: Math.max(0, su.stock - used.qty),
          spent: su.spent + used.qty * su.cost,
          moves: [{ dateISO: T, what: 'Used — daily report', delta: -used.qty }, ...su.moves],
        }
      })
      const report: Report = {
        id: `r${Date.now()}`,
        dateISO: T,
        photoIds: dr.photoIds,
        manpower: { ...dr.man },
        materials: dr.mats.map((m) => {
          const su = p.supplies.find((s) => s.id === m.supplyId)!
          return { supplyId: m.supplyId, name: su.name, unit: su.unit, qty: m.qty }
        }),
        summary: dr.summary.trim(),
        issues: dr.issues.trim(),
        complete: true,
      }
      return { ...p, supplies, reports: [report, ...p.reports], draft: { ...dr, submitted: true } }
    })
  },

  // ---- master-data editing ----
  addPhase(name: string, sections: { name: string; subcon: string; status: Phase['sections'][number]['status'] }[]) {
    const base = Date.now()
    setProject((p) => ({
      ...p,
      phases: [
        ...p.phases,
        { id: `ph${base}`, name, sections: sections.map((s, i) => ({ id: `ph${base}-s${i + 1}`, ...s })) },
      ],
    }))
  },

  updatePhase(phaseId: string, patch: Partial<Phase>) {
    setProject((p) => ({
      ...p,
      phases: p.phases.map((ph) => (ph.id === phaseId ? { ...ph, ...patch } : ph)),
    }))
  },

  deletePhase(phaseId: string) {
    setProject((p) => ({ ...p, phases: p.phases.filter((ph) => ph.id !== phaseId) }))
  },

  addSupply(data: Omit<Supply, 'id' | 'status' | 'ordered' | 'spent' | 'moves'>) {
    setProject((p) => ({
      ...p,
      supplies: [
        ...p.supplies,
        {
          ...data,
          id: `s${Date.now()}`,
          status: 'stock',
          ordered: false,
          spent: 0,
          moves: data.stock > 0 ? [{ dateISO: todayISO(), what: 'Added to inventory', delta: data.stock }] : [],
        },
      ],
    }))
  },

  /** Edit supply fields; a direct stock change is logged as a manual-adjustment movement. */
  updateSupply(supplyId: string, patch: Partial<Supply>) {
    setProject((p) => ({
      ...p,
      supplies: p.supplies.map((su) => {
        if (su.id !== supplyId) return su
        const next = { ...su, ...patch }
        if (patch.stock !== undefined && patch.stock !== su.stock) {
          next.moves = [
            { dateISO: todayISO(), what: 'Manual adjustment', delta: patch.stock - su.stock },
            ...su.moves,
          ]
        }
        return next
      }),
    }))
  },

  deleteSupply(supplyId: string) {
    setProject((p) => ({
      ...p,
      supplies: p.supplies.filter((su) => su.id !== supplyId),
      draft: { ...p.draft, mats: p.draft.mats.filter((m) => m.supplyId !== supplyId) },
    }))
  },

  updateProjectMeta(name: string, targetDateISO: string, whatsappUrl: string) {
    setProject((p) => ({ ...p, name, targetDateISO, whatsappUrl }))
  },

  addSubcon(name: string, trade: string) {
    setProject((p) => {
      if (p.subcons.some((s) => s.name === name)) return p
      return {
        ...p,
        subcons: [...p.subcons, { name, trade }],
        draft: { ...p.draft, man: { ...p.draft.man, [name]: p.draft.man[name] ?? 0 } },
      }
    })
  },

  updateSubcon(oldName: string, name: string, trade: string) {
    setProject((p) => {
      const man = { ...p.draft.man }
      if (oldName !== name) {
        man[name] = man[oldName] ?? 0
        delete man[oldName]
      }
      return {
        ...p,
        subcons: p.subcons.map((s) => (s.name === oldName ? { name, trade } : s)),
        phases: p.phases.map((ph) => ({
          ...ph,
          sections: ph.sections.map((s) => (s.subcon === oldName ? { ...s, subcon: name } : s)),
        })),
        supplies: p.supplies.map((su) => (su.usedBy === oldName ? { ...su, usedBy: name } : su)),
        draft: { ...p.draft, man },
      }
    })
  },

  /** Returns false when the subcontractor is still referenced by phases or supplies. */
  deleteSubcon(name: string): boolean {
    const p = activeProject(getState())
    if (p.phases.some((ph) => ph.sections.some((s) => s.subcon === name)) || p.supplies.some((su) => su.usedBy === name)) {
      return false
    }
    setProject((pr) => {
      const man = { ...pr.draft.man }
      delete man[name]
      return { ...pr, subcons: pr.subcons.filter((s) => s.name !== name), draft: { ...pr.draft, man } }
    })
    return true
  },

  /** Returns false when it is the only project. */
  deleteProject(id: string): boolean {
    if (getState().projects.length <= 1) return false
    set((s) => {
      const projects = s.projects.filter((p) => p.id !== id)
      return {
        ...s,
        projects,
        activeProjectId: s.activeProjectId === id ? projects[0].id : s.activeProjectId,
      }
    })
    return true
  },

  /** Wipe everything (state, photos, uploads) and reload back to the demo seed. */
  async resetApp(): Promise<void> {
    clearTimeout(persistTimer)
    await deleteDatabase()
    location.reload()
  },

  /** Remove a report and its photos; deleting today's report re-opens the daily draft. */
  deleteReport(reportId: string) {
    setProject((p) => {
      const r = p.reports.find((x) => x.id === reportId)
      if (!r) return p
      r.photoIds.forEach((id) => photoDelete(id).catch(() => {}))
      return {
        ...p,
        reports: p.reports.filter((x) => x.id !== reportId),
        draft: r.dateISO === todayISO() ? emptyDraft(p.subcons) : p.draft,
      }
    })
  },

  addDrawing(set_: DrawingSet) {
    setProject((p) => ({ ...p, drawings: [...p.drawings, set_] }))
  },

  linkDrawingPhase(drawingId: string, tag: string) {
    setProject((p) => ({
      ...p,
      drawings: p.drawings.map((d) =>
        d.id === drawingId
          ? { ...d, tags: d.tags.includes(tag) ? d.tags.filter((t) => t !== tag) : [...d.tags, tag] }
          : d,
      ),
    }))
  },
}
