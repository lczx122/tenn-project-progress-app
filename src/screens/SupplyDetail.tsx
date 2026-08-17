import { useState } from 'react'
import { ChevronLeft, Pencil, Phone, MessageCircle } from 'lucide-react'
import { activeProject, actions, useAppState } from '../store'
import { useUi } from '../ui'
import { isLow } from '../selectors'
import { fmtShort } from '../utils/dates'
import { SupplyEditSheet } from '../components/SupplyEditSheet'

export function SupplyDetail({ id }: { id: string }) {
  const s = useAppState()
  const ui = useUi()
  const p = activeProject(s)
  const su = p.supplies.find((x) => x.id === id)
  const [editing, setEditing] = useState(false)

  if (!su) return null

  const low = isLow(su)
  const pct = su.max > 0 ? Math.max(Math.round((su.stock / su.max) * 100), 2) : 2
  const stockBadge = su.status === 'transit' ? 'IN TRANSIT' : low ? 'BELOW MINIMUM' : 'HEALTHY'
  const badgeBg = low ? 'var(--warn)' : su.status === 'transit' ? 'var(--info)' : 'var(--teal)'
  const canReorder = low && !su.ordered

  const waPhone = su.supplier.phone.replace(/[^\d]/g, '')

  return (
    <>
      <div style={{ padding: '18px 20px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="back-chevron" onClick={ui.pop} aria-label="Back">
          <ChevronLeft size={22} />
        </button>
        <div style={{ fontSize: 18, fontWeight: 700, flex: 1, minWidth: 0 }}>{su.name}</div>
        <button onClick={() => setEditing(true)} aria-label="Edit supply" style={{ padding: 6, color: 'var(--text-2)' }}>
          <Pencil size={17} />
        </button>
      </div>

      <div style={{ padding: '4px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Hero stock card */}
        <div
          style={{
            background: low ? 'var(--warn-bg)' : '#fff',
            border: `1px solid ${low ? 'var(--warn-bd)' : 'var(--card-bd)'}`,
            borderRadius: 16, padding: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: low ? 'var(--warn-deep)' : 'var(--text-2)' }}>STOCK ON SITE</div>
            <div className="badge" style={{ background: badgeBg, color: '#fff' }}>{stockBadge}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
            <div className="mono" style={{ fontSize: 36 }}>{su.stock}</div>
            <div style={{ fontSize: 14, color: 'var(--text-2)' }}>/ {su.max} {su.unit} · min. {su.min}</div>
          </div>
          <div style={{ height: 8, background: 'rgba(0,0,0,0.07)', borderRadius: 99, marginTop: 10, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: low ? 'var(--warn)' : 'var(--teal)', borderRadius: 99 }} />
          </div>
          {canReorder && su.runout && (
            <div style={{ fontSize: 12, color: 'var(--warn-deep)', marginTop: 8 }}>
              At current usage stock runs out in <b>{su.runout}</b>
            </div>
          )}
        </div>

        {canReorder && (
          <button
            style={{ background: 'var(--teal)', color: '#fff', borderRadius: 12, textAlign: 'center', padding: 14, fontWeight: 600, fontSize: 15, width: '100%' }}
            onClick={() => {
              actions.reorderSupply(su.id)
              ui.showToast(`Order sent to ${su.supplier.name}`)
            }}
          >
            Reorder {su.reorderQty} {su.unit} — RM {(su.reorderQty * su.cost).toLocaleString()}
          </button>
        )}
        {su.ordered && (
          <div style={{ background: 'var(--info-bg)', color: 'var(--info)', border: '1px solid #C7D4EE', borderRadius: 12, textAlign: 'center', padding: 14, fontWeight: 600, fontSize: 14 }}>
            ✓ Order placed — ETA {su.etaISO ? fmtShort(su.etaISO) : 'TBC'}
          </div>
        )}

        {/* Details */}
        <div className="card">
          <div className="section-label">DETAILS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10, fontSize: 13 }}>
            <div>
              <div style={{ color: 'var(--text-2)', fontSize: 12 }}>Location</div>
              <div style={{ fontWeight: 600 }}>{su.loc.split(' · ').pop()}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-2)', fontSize: 12 }}>Unit cost</div>
              <div style={{ fontWeight: 600 }}>RM {su.cost} / {su.unit}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-2)', fontSize: 12 }}>Used by</div>
              <div style={{ fontWeight: 600 }}>{su.usedBy}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-2)', fontSize: 12 }}>Spent to date</div>
              <div style={{ fontWeight: 600 }}>RM {su.spent.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Supplier */}
        <div className="card">
          <div className="section-label">SUPPLIER</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{su.supplier.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{su.supplier.note}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <a
                href={`tel:${su.supplier.phone}`}
                style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--teal-tint)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Call supplier"
              >
                <Phone size={16} />
              </a>
              <a
                href={`https://wa.me/${waPhone}`}
                target="_blank"
                rel="noreferrer"
                style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--teal-tint)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="WhatsApp supplier"
              >
                <MessageCircle size={16} />
              </a>
            </div>
          </div>
        </div>

        {/* Movement */}
        <div className="card">
          <div className="section-label">MOVEMENT</div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
            {su.moves.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--hairline)', fontSize: 13 }}>
                <div className="mono" style={{ color: 'var(--text-2)', width: 52, flexShrink: 0, fontSize: 12 }}>{fmtShort(m.dateISO)}</div>
                <div style={{ flex: 1 }}>{m.what}</div>
                <div style={{ color: m.delta > 0 ? 'var(--teal)' : m.delta === 0 ? 'var(--text-2)' : 'var(--danger)', fontWeight: 600 }}>
                  {m.delta > 0 ? `+${m.delta}` : m.delta === 0 ? '—' : m.delta}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {editing && <SupplyEditSheet supplyId={su.id} onClose={() => setEditing(false)} />}
    </>
  )
}
