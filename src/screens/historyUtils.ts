import type { Report } from '../types'

export { fmtDay, fmtMonthYear, fromISO, isWeekend, toISO, todayISO } from '../utils/dates'

export function manTotal(r: Report): number {
  return Object.values(r.manpower).reduce((a, b) => a + b, 0)
}
