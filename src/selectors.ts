// Derived values shared across screens (mirrors the prototype's renderVals()).
import type { Draft, Phase, PhaseStatus, Project, Supply } from './types'

export function phasePct(p: Phase): number {
  if (p.work.length === 0) return 0
  return Math.round(p.work.reduce((a, w) => a + w.pct, 0) / p.work.length)
}

/** Done only when every assigned subcon is at 100%; in progress once any has started. */
export function phaseStatus(p: Phase): PhaseStatus {
  if (p.work.length > 0 && p.work.every((w) => w.pct >= 100)) return 'done'
  if (p.work.some((w) => w.pct > 0)) return 'prog'
  return 'todo'
}

export function phaseHasSubcon(p: Phase, name: string): boolean {
  return p.work.some((w) => w.subcon === name)
}

export function overallPct(project: Project): number {
  if (project.phases.length === 0) return 0
  return Math.round(project.phases.reduce((a, p) => a + phasePct(p), 0) / project.phases.length)
}

/** Average over the subcon's individual assignments across all phases. */
export function subconPct(project: Project, name: string): number {
  const works = project.phases.flatMap((p) => p.work.filter((w) => w.subcon === name))
  if (works.length === 0) return 0
  return Math.round(works.reduce((a, w) => a + w.pct, 0) / works.length)
}

export function isLow(s: Supply): boolean {
  return s.status === 'stock' && s.stock <= s.min
}

export function lowSupplies(project: Project): Supply[] {
  return project.supplies.filter((s) => isLow(s) && !s.ordered)
}

export function transitSupplies(project: Project): Supply[] {
  return project.supplies.filter((s) => s.status === 'transit')
}

export interface SopStep {
  label: string
  done: boolean
}

export function sopSteps(draft: Draft): SopStep[] {
  const manTotal = Object.values(draft.man).reduce((a, b) => a + b, 0)
  return [
    { label: 'Photos', done: draft.photoIds.length >= 3 },
    { label: 'Manpower', done: manTotal > 0 },
    { label: 'Materials', done: draft.mats.length > 0 },
    { label: 'Summary', done: draft.summary.trim().length > 0 },
    { label: 'Issues', done: draft.issues.trim().length > 0 },
  ]
}

export function sopDoneCount(draft: Draft): number {
  if (draft.submitted) return 5
  return sopSteps(draft).filter((s) => s.done).length
}

export function requiredStepsOk(draft: Draft): boolean {
  return sopSteps(draft).slice(0, 4).every((s) => s.done)
}

export function manTotal(draft: Draft): number {
  return Object.values(draft.man).reduce((a, b) => a + b, 0)
}
