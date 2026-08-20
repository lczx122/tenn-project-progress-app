import { useState } from 'react'
import { activeProject, useAppState } from '../store'
import { useUi } from '../ui'
import { isLow } from '../selectors'
import { fmtShort } from '../utils/dates'
import { SupplyEditSheet } from '../components/SupplyEditSheet'

export function Supplies() {
  const s = useAppState()
  const ui = useUi()
  const [adding, setAdding] = useState(false)
  const p = activeProject(s)
  const sf = ui.supplyFilter
  const q = ui.query.toLowerCase()

  let rows = p.supplies.filter((su) => su.name.toLowerCase().includes(q))
  if (sf === 'low') rows = rows.filter((su) => su.status === 'stock' && su.stock <= su.min)
  if (sf === 'transit') rows = rows.filter((su) => su.status === 'transit')

  const nLow = p.supplies.filter((su) => su.status === 'stock' && su.stock <= su.min).length
  const nTransit = p.supplies.filter((su) => su.status === 'transit').length

  const chips = [
    { key: 'all' as const, label: 'All', warn: false },
    { key: 'low' as const, label: `Low stock · ${nLow}`, warn: true },
    { key: 'transit' as const, label: `In transit · ${nTransit}`, warn: false },
  ]

  return (
    <>
      <div style={{ padding: '18px 20px 10px' }}>
        <div className="screen-title">Supplies</div>
        <input
          className="text-input"
          style={{ background: '#fff', marginTop: 12 }}
          placeholder="Search materials…"
          value={ui.query}
          onChange={(e) => ui.setQuery(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {chips.map((c) => (
            <button
              key={c.key}
              className={`chip ${c.warn ? 'warn' : ''} ${sf === c.key ? 'active' : ''}`}
              style={{ padding: '5px 13px' }}
              onClick={() => ui.setSupplyFilter(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="supply-list" style={{ padding: '6px 20px 16px' }}>
        {rows.map((su) => {
          const low = isLow(su)
          const pct = su.max > 0 ? Math.round((su.stock / su.max) * 100) : 0
          const badge =
            su.status === 'transit'
              ? `ARRIVES ${su.etaISO ? fmtShort(su.etaISO).toUpperCase() : 'SOON'}`
              : su.ordered
                ? 'ORDERED'
                : low
                  ? 'LOW — REORDER'
                  : 'OK'
          const badgeBg = su.status === 'transit' || su.ordered ? 'var(--info-bg)' : low ? 'var(--warn-bg)' : 'var(--teal-tint)'
          const badgeFg = su.status === 'transit' || su.ordered ? 'var(--info)' : low ? 'var(--warn)' : 'var(--teal)'
          return (
            <button
              key={su.id}
              className="pressable"
              style={{
                background: '#fff', border: `1.5px solid ${low && !su.ordered ? 'var(--warn-bd)' : 'var(--card-bd)'}`,
                borderRadius: 12, padding: 14, width: '100%',
              }}
              onClick={() => ui.push({ type: 'supplyDetail', id: su.id })}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{su.name}</div>
                <div className="badge" style={{ background: badgeBg, color: badgeFg }}>{badge}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--text-2)', gap: 8 }}>
                <span>{su.loc}</span>
                <span className="mono" style={{ color: low ? 'var(--warn)' : 'var(--teal)' }}>
                  {su.status === 'transit' ? `${su.max} ${su.unit} ordered` : `${su.stock} / ${su.max} ${su.unit}`}
                </span>
              </div>
              {su.status === 'stock' && (
                <div className="bar" style={{ height: 5, marginTop: 7 }}>
                  <div style={{ width: `${pct}%`, background: low ? 'var(--warn)' : 'var(--teal)' }} />
                </div>
              )}
            </button>
          )
        })}
        {rows.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '32px 0' }}>
            No materials match
          </div>
        )}

        <button
          className="pressable"
          style={{ border: '1.5px dashed #C9C4BA', borderRadius: 12, padding: 14, textAlign: 'center', color: 'var(--teal)', fontSize: 13, fontWeight: 600, width: '100%' }}
          onClick={() => setAdding(true)}
        >
          + Add supply
        </button>
      </div>

      {adding && <SupplyEditSheet onClose={() => setAdding(false)} />}
    </>
  )
}
