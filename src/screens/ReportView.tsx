import { useState } from 'react'
import { ChevronLeft, Share2 } from 'lucide-react'
import { activeProject, useAppState } from '../store'
import { useUi } from '../ui'
import { fmtDay } from '../utils/dates'
import { usePhotoUrl } from '../utils/photos'
import { manTotal } from './historyUtils'

function Photo({ id }: { id: string }) {
  const url = usePhotoUrl(id)
  return (
    <div style={{ width: '31%', aspectRatio: '1', borderRadius: 8, background: url ? `url(${url}) center/cover` : 'var(--fill)' }} />
  )
}

export function ReportView({ reportId }: { reportId: string }) {
  const s = useAppState()
  const ui = useUi()
  const p = activeProject(s)
  const r = p.reports.find((x) => x.id === reportId)
  const [sharing, setSharing] = useState(false)

  if (!r) return null

  const share = async () => {
    if (sharing) return
    setSharing(true)
    try {
      const { buildReportPdf, sharePdf } = await import('../utils/pdf')
      const blob = await buildReportPdf(p, r)
      const result = await sharePdf(blob, `Daily report ${r.dateISO} — ${p.name}.pdf`)
      ui.showToast(result === 'shared' ? 'PDF shared' : 'PDF downloaded')
    } catch {
      ui.showToast('Could not generate PDF')
    } finally {
      setSharing(false)
    }
  }

  return (
    <>
      <div style={{ padding: '18px 20px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="back-chevron" onClick={ui.pop} aria-label="Back">
          <ChevronLeft size={22} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtDay(r.dateISO)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{p.name}</div>
        </div>
        <div className="badge" style={{ background: r.complete ? 'var(--teal-tint)' : 'var(--warn-bg)', color: r.complete ? 'var(--teal)' : 'var(--warn)' }}>
          {r.complete ? 'COMPLETE' : 'NO MATERIAL LOG'}
        </div>
      </div>

      <div style={{ padding: '4px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {r.photoIds.length > 0 && (
          <div className="card">
            <div className="section-label">SITE PHOTOS · {r.photoIds.length}</div>
            <div style={{ display: 'flex', gap: '3.5%', flexWrap: 'wrap', rowGap: 8, marginTop: 10 }}>
              {r.photoIds.map((id) => <Photo key={id} id={id} />)}
            </div>
          </div>
        )}

        <div className="card">
          <div className="section-label">MANPOWER · {manTotal(r)} ON SITE</div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
            {Object.entries(r.manpower).filter(([, n]) => n > 0).map(([name, n]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--hairline)', fontSize: 13 }}>
                <div>{name}</div>
                <div className="mono">{n}</div>
              </div>
            ))}
            {manTotal(r) === 0 && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>None recorded</div>}
          </div>
        </div>

        <div className="card">
          <div className="section-label">MATERIAL USED</div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
            {r.materials.map((m) => (
              <div key={m.supplyId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--hairline)', fontSize: 13 }}>
                <div>{m.name}</div>
                <div className="mono">{m.qty} {m.unit}</div>
              </div>
            ))}
            {r.materials.length === 0 && <div style={{ fontSize: 13, color: 'var(--warn)', marginTop: 6 }}>No material log</div>}
          </div>
        </div>

        <div className="card">
          <div className="section-label">WORK DONE SUMMARY</div>
          <div style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>{r.summary || '—'}</div>
        </div>

        <div className="card">
          <div className="section-label">ISSUES / BLOCKERS</div>
          <div style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5, color: r.issues ? 'var(--ink)' : 'var(--muted)' }}>
            {r.issues || 'None reported'}
          </div>
        </div>

        <button className="primary-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, fontSize: 15 }} onClick={share} disabled={sharing}>
          <Share2 size={16} /> {sharing ? 'Preparing PDF…' : 'Share PDF'}
        </button>
      </div>
    </>
  )
}
