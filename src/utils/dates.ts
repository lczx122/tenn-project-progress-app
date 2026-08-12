const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO(): string {
  return toISO(new Date())
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** "12 Aug" */
export function fmtShort(iso: string): string {
  const d = fromISO(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** "Tue 12 Aug" */
export function fmtDay(iso: string): string {
  const d = fromISO(iso)
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** "TUE 12 AUG" */
export function fmtDayUpper(iso: string): string {
  return fmtDay(iso).toUpperCase()
}

/** "31 Jul 2026" */
export function fmtFull(iso: string): string {
  const d = fromISO(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** "August 2026" */
export function fmtMonthYear(iso: string): string {
  const d = fromISO(iso)
  return `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`
}

export function isWeekend(iso: string): boolean {
  const day = fromISO(iso).getDay()
  return day === 0 || day === 6
}
