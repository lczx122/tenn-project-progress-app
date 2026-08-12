// Derived values shared across screens (mirrors the prototype's renderVals()).
import type { Draft, Phase, Project, Supply } from './types'

export function phasePct(p: Phase): number {
  return p.status === 'done' ? 100 : p.status === 'prog' ? p.pct : 0
}

export function overallPct(project: Project): number {
  if (project.phases.length === 0) return 0
  return Math.round(project.phases.reduce((a, p) => a + phasePct(p), 0) / project.phases.length)
}

export function subconPct(project: Project, name: string): number {
  const ps = project.phases.filter((p) => p.subcon === name)
  if (ps.length === 0) return 0
  return Math.round(ps.reduce((a, p) => a + phasePct(p), 0) / ps.length)
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
