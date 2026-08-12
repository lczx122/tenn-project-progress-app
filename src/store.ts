// App state store: plain external store + useSyncExternalStore hook.
// State persists to IndexedDB on every change; photos/files are stored as blobs.
import { useSyncExternalStore } from 'react'
import type { AppState, DrawingSet, Project, Report } from './types'
import { kvGet, kvSet, photoDelete, photoPut } from './db'
import { emptyDraft, newProject, seedState } from './seed'
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

function set(updater: (s: AppState) => AppState) {
  if (!state) return
  state = updater(state)
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
    state = rolloverDrafts(saved)
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

  startPhase(phaseId: string) {
    setProject((p) => ({
      ...p,
      phases: p.phases.map((ph) =>
        ph.id === phaseId ? { ...ph, status: 'prog', pct: 5, note: 'Started today', blocked: false } : ph,
      ),
    }))
  },

  /** +5%; at ≥100% the phase moves to Done. Returns true if it completed. */
  bumpPhase(phaseId: string): boolean {
    let completed = false
    setProject((p) => ({
      ...p,
      phases: p.phases.map((ph) => {
        if (ph.id !== phaseId) return ph
        if (ph.pct >= 95) {
          completed = true
          return { ...ph, status: 'done', pct: 100 }
        }
        return { ...ph, pct: ph.pct + 5 }
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
