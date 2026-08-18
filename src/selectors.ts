// Derived values shared across screens (mirrors the prototype's renderVals()).
import type { Draft, Phase, PhaseStatus, Project, SectionStatus, Supply } from './types'

/** How much a section contributes to its phase: 0 → ⅓ → ⅔ → 1. */
export function sectionWeight(status: SectionStatus): number {
  return status === 'done' ? 1 : status === 'ongoing' ? 2 / 3 : status === 'started' ? 1 / 3 : 0
}

export const SECTION_ORDER: SectionStatus[] = ['todo', 'started', 'ongoing', 'done']

export function nextSectionStatus(status: SectionStatus): SectionStatus {
  const i = SECTION_ORDER.indexOf(status)
  return SECTION_ORDER[Math.min(i + 1, SECTION_ORDER.length - 1)]
}

export function phasePct(p: Phase): number {
  if (p.sections.length === 0) return 0
  return Math.round((p.sections.reduce((a, s) => a + sectionWeight(s.status), 0) / p.sections.length) * 100)
}

/** Done only when every section is finished; in progress once any section has started. */
export function phaseStatus(p: Phase): PhaseStatus {
  if (p.sections.length > 0 && p.sections.every((s) => s.status === 'done')) return 'done'
  if (p.sections.some((s) => s.status !== 'todo')) return 'prog'
  return 'todo'
}

export function phaseHasSubcon(p: Phase, name: string): boolean {
  return p.sections.some((s) => s.subcon === name)
}

export function overallPct(project: Project): number {
  if (project.phases.length === 0) return 0
  return Math.round(project.phases.reduce((a, p) => a + phasePct(p), 0) / project.phases.length)
}

/** Average over the subcon's sections across all phases. */
export function subconPct(project: Project, name: string): number {
  const secs = project.phases.flatMap((p) => p.sections.filter((s) => s.subcon === name))
  if (secs.length === 0) return 0
  return Math.round((secs.reduce((a, s) => a + sectionWeight(s.status), 0) / secs.length) * 100)
}

export function isLow(s: Supply): boolean {
  return s.status === 'stock' && s.stock <= s.min
}

export function lowSupplies(project: Project): Supply[] {
  return project.supplies.filter((s) => isLow(s) && !s.ordered)
}

/** Overall material-stock health for the Home summary tile. */
export function supplyHealth(project: Project): 'good' | 'low' | 'reorder' {
  const onSite = project.supplies.filter((s) => s.status === 'stock')
  if (onSite.some((s) => s.stock <= s.min && !s.ordered)) return 'reorder'
  if (onSite.some((s) => s.stock <= s.min * 1.5)) return 'low'
  return 'good'
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
