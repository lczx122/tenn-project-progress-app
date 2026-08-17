import { ChevronDown, Cloud, CloudOff } from 'lucide-react'
import { supabase } from '../sync/client'
import { useSyncStatus } from '../sync/engine'
import { activeProject, useAppState } from '../store'
import { useUi } from '../ui'
import { lowSupplies, overallPct, sopDoneCount, sopSteps, subconPct, transitSupplies } from '../selectors'
import { fmtDayUpper, fmtShort } from '../utils/dates'
import { todayISO } from '../utils/dates'

export function Home() {
  const s = useAppState()
  const ui = useUi()
  const sync = useSyncStatus()
  const p = activeProject(s)
  const dr = p.draft

  const steps = sopSteps(dr).slice(0, 4)
  const done = sopDoneCount(dr)
  const cta = dr.submitted ? 'View today’s report' : done > 0 ? 'Continue daily report' : 'Start daily report'

  const low = lowSupplies(p)
  const transit = transitSupplies(p)
  const nextDelivery = transit
    .filter((t) => t.etaISO)
    .sort((a, b) => (a.etaISO! < b.etaISO! ? -1 : 1))[0]

  const inProg = p.phases.filter((ph) => ph.status === 'prog').length
  const doneCount = p.phases.filter((ph) => ph.status === 'done').length

  const initials = p.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <>
      <div style={{ padding: '18px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>PROJECT</div>
          <button
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 21, fontWeight: 700, color: 'var(--ink)' }}
            onClick={() => ui.setSwitcherOpen(true)}
          >
            {p.name} <ChevronDown size={16} color="var(--teal)" />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {supabase && (
            <button
              onClick={() => ui.setSwitcherOpen(true)}
              aria-label="Sync status"
              style={{ display: 'flex', padding: 4 }}
              title={sync.status}
            >
              {sync.status === 'synced' || sync.status === 'syncing' ? (
                <Cloud size={18} color="var(--teal)" className={sync.status === 'syncing' ? 'pulse' : ''} />
              ) : (
                <CloudOff size={18} color={sync.status === 'error' ? 'var(--danger)' : 'var(--muted)'} />
              )}
            </button>
          )}
          <div
            style={{
              width: 40, height: 40, borderRadius: '50%', background: 'var(--teal)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 15,
            }}
          >
            {initials || 'SV'}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* SOP card */}
        <button
          className="pressable"
          style={{ background: 'var(--teal)', borderRadius: 16, padding: 16, color: '#fff', width: '100%' }}
          onClick={() => ui.goTab('report')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85 }}>TODAY’S SOP · {fmtDayUpper(todayISO())}</div>
            <div style={{ fontSize: 12, background: 'rgba(255,255,255,0.18)', borderRadius: 99, padding: '3px 10px', fontWeight: 600 }}>
              {done} of 5 done
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {steps.map((st) => {
              const ok = dr.submitted || st.done
              return (
                <div
                  key={st.label}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.14)', borderRadius: 10, padding: '10px 6px', textAlign: 'center',
                    outline: ok ? 'none' : '1.5px dashed rgba(255,255,255,0.5)', outlineOffset: -1.5,
                  }}
                >
                  <div style={{ fontSize: 17, opacity: ok ? 1 : 0.6 }}>{ok ? '✓' : '·'}</div>
                  <div style={{ fontSize: 10, marginTop: 2, opacity: 0.9 }}>{st.label === 'Photos' ? 'Site photos' : st.label}</div>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 12, background: '#fff', color: 'var(--teal)', borderRadius: 10, textAlign: 'center', padding: 11, fontWeight: 600, fontSize: 14 }}>
            {cta} →
          </div>
        </button>

        {/* Overall progress */}
        <div className="card-hero">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Overall progress</div>
            <div className="mono" style={{ fontSize: 14, color: 'var(--teal)' }}>{overallPct(p)}%</div>
          </div>
          <div className="bar" style={{ height: 8, marginTop: 10 }}>
            <div style={{ width: `${overallPct(p)}%` }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8 }}>
            {inProg} in progress · {doneCount} of {p.phases.length} done · target {fmtShort(p.targetDateISO)}
          </div>
        </div>

        {/* Subcon grid */}
        {p.subcons.length > 0 && (
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>SUBCON</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {p.subcons.map((g) => {
                const count = p.phases.filter((ph) => ph.subcon === g.name).length
                const pct = subconPct(p, g.name)
                return (
                  <button key={g.name} className="card" style={{ padding: 12 }} onClick={() => ui.goPhases(g.name)}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{g.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{g.trade} · {count} phases</div>
                    <div className="bar" style={{ height: 5, marginTop: 8 }}>
                      <div style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Low stock alert */}
        {low.length > 0 && (
          <button
            className="pressable"
            style={{
              background: 'var(--warn-bg)', border: '1px solid var(--warn-bd)', borderRadius: 12, padding: '12px 14px',
              display: 'flex', gap: 10, alignItems: 'center', width: '100%',
            }}
            onClick={() => ui.goSupplies('low')}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warn)', flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 13, color: 'var(--warn-deep)' }}>
              <b>{low.length} supplies low</b> — {low.map((x) => x.name.split(' —')[0]).join(', ')}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warn)' }}>View</div>
          </button>
        )}

        {/* Delivery alert */}
        {nextDelivery && (
          <button
            className="card"
            style={{ padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center', width: '100%' }}
            onClick={() => ui.goSupplies('transit')}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal)', flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 13 }}>
              <b>{nextDelivery.etaISO === todayISO() ? 'Delivery today' : `Delivery ${fmtShort(nextDelivery.etaISO!)}`}</b>
              {' — '}{nextDelivery.name.split(' —')[0]} · {nextDelivery.supplier.name.split(' Sdn')[0]}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)' }}>Track</div>
          </button>
        )}

        {/* Drawings row */}
        <button
          className="card"
          style={{ padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center', width: '100%' }}
          onClick={() => ui.push({ type: 'drawings' })}
        >
          <div
            style={{
              width: 28, height: 36, borderRadius: 4, background: 'var(--teal-tint)', border: '1px solid var(--teal-tint-bd)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal)', fontWeight: 700, fontSize: 9, flexShrink: 0,
            }}
          >
            PDF
          </div>
          <div style={{ flex: 1, fontSize: 13 }}>
            <b>Drawings</b> — {p.drawings.length} set{p.drawings.length === 1 ? '' : 's'}
            {p.drawings.length > 0 && ' · ' + p.drawings.map((D) => D.name.replace(/^LOT \d+ — /, '').replace('Sales Gallery (Lobby)', 'Lobby')).slice(0, 2).join(' & ')}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)' }}>Open</div>
        </button>
      </div>
    </>
  )
}
