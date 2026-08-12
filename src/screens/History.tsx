import { useState } from 'react'
import { activeProject, useAppState } from '../store'
import { useUi } from '../ui'
import { fmtDay, fmtMonthYear, fromISO, isWeekend, manTotal, toISO, todayISO } from './historyUtils'
import type { Report } from '../types'

export function History() {
  const s = useAppState()
  const ui = useUi()
  const p = activeProject(s)
  const [sharing, setSharing] = useState<string | null>(null)

  const T = todayISO()
  const byDate = new Map(p.reports.map((r) => [r.dateISO, r]))
  const todaySubmitted = p.draft.submitted

  // Monday-first calendar grid for the current month
  const first = fromISO(T.slice(0, 8) + '01')
  const startOffset = (first.getDay() + 6) % 7
  const gridStart = new Date(first)
  gridStart.setDate(first.getDate() - startOffset)
  const cells: { iso: string; day: number; inMonth: boolean }[] = []
  const cursor = new Date(gridStart)
  while (cells.length < 42) {
    cells.push({ iso: toISO(cursor), day: cursor.getDate(), inMonth: cursor.getMonth() === first.getMonth() })
    cursor.setDate(cursor.getDate() + 1)
    if (cells.length % 7 === 0 && cursor.getMonth() !== first.getMonth() && cells.length >= 28) break
  }

  const share = async (r: Report) => {
    if (sharing) return
    setSharing(r.id)
    try {
      const { buildReportPdf, sharePdf } = await import('../utils/pdf')
      const blob = await buildReportPdf(p, r)
      const result = await sharePdf(blob, `Daily report ${r.dateISO} — ${p.name}.pdf`)
      ui.showToast(result === 'shared' ? 'PDF shared' : 'PDF downloaded')
    } catch (e) {
      console.error(e)
      ui.showToast('Could not generate PDF')
    } finally {
      setSharing(null)
    }
  }

  return (
    <>
      <div style={{ padding: '18px 20px 10px' }}>
        <div className="screen-title">History</div>
      </div>
      <div style={{ padding: '4px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Calendar */}
        <div className="card-hero">
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{fmtMonthYear(T)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, textAlign: 'center', fontSize: 13 }}>
            {cells.map((c) => {
              const rep = c.inMonth ? byDate.get(c.iso) : undefined
              const isToday = c.iso === T
              const ok = !!rep && rep.complete && !isToday
              const warn = !!rep && !rep.complete && !isToday
              const bg = isToday ? (todaySubmitted ? 'var(--teal)' : 'var(--ink)') : ok ? 'var(--teal-tint)' : warn ? 'var(--warn-bg)' : 'transparent'
              const fg = isToday ? '#fff' : ok ? 'var(--teal)' : warn ? 'var(--warn)' : !c.inMonth ? 'var(--empty)' : isWeekend(c.iso) ? 'var(--muted)' : 'var(--ink)'
              return (
                <div key={c.iso} style={{ padding: '7px 0', background: bg, borderRadius: 8, fontWeight: isToday ? 700 : ok || warn ? 600 : 400, color: fg }}>
                  {c.day}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 11, color: 'var(--text-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--teal-tint)', border: '1px solid var(--teal)' }} />Complete
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--warn-bg)', border: '1px solid var(--warn)' }} />Incomplete
            </div>
          </div>
        </div>

        {/* Report cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {p.reports.map((r) => (
            <div key={r.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{fmtDay(r.dateISO)}</div>
                <div className="badge" style={{ background: r.complete ? 'var(--teal-tint)' : 'var(--warn-bg)', color: r.complete ? 'var(--teal)' : 'var(--warn)' }}>
                  {r.complete ? 'COMPLETE' : 'NO MATERIAL LOG'}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {r.photoIds.length} photos · {manTotal(r)} workers · {r.summary}
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
                <button className="link-btn" onClick={() => ui.push({ type: 'reportView', reportId: r.id })}>View report</button>
                <button className="link-btn" onClick={() => share(r)} disabled={sharing === r.id}>
                  {sharing === r.id ? 'Preparing…' : 'Share PDF ↗'}
                </button>
              </div>
            </div>
          ))}
          {p.reports.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '24px 0' }}>
              No reports yet — submit today’s daily report to start the log.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
