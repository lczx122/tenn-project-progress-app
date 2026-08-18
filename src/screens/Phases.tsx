import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { activeProject, actions, useAppState } from '../store'
import { useUi } from '../ui'
import { PhaseEditSheet } from '../components/PhaseEditSheet'
import { phaseHasSubcon, phasePct, phaseStatus } from '../selectors'
import { haptic } from '../utils/motion'
import type { Phase, SectionStatus } from '../types'

const STATUS_META: Record<SectionStatus, { label: string; bg: string; fg: string; bd: string }> = {
  todo: { label: 'Not started', bg: '#fff', fg: 'var(--text-2)', bd: 'var(--card-bd)' },
  started: { label: 'Started', bg: 'var(--warn-bg)', fg: 'var(--warn)', bd: 'var(--warn-bd)' },
  ongoing: { label: 'Ongoing', bg: 'var(--info-bg)', fg: 'var(--info)', bd: '#C7D4EE' },
  done: { label: 'Finished ✓', bg: 'var(--teal-tint)', fg: 'var(--teal)', bd: 'var(--teal-tint-bd)' },
}

export function Phases() {
  const s = useAppState()
  const ui = useUi()
  const p = activeProject(s)
  const pf = ui.phaseFilter
  // null = closed, '' = adding, otherwise the phase id being edited
  const [editing, setEditing] = useState<string | null>(null)

  const fBy = (list: Phase[]) => (pf === 'All' ? list : list.filter((ph) => phaseHasSubcon(ph, pf)))
  const inProg = fBy(p.phases.filter((ph) => phaseStatus(ph) === 'prog'))
  const done = fBy(p.phases.filter((ph) => phaseStatus(ph) === 'done'))
  const todo = fBy(p.phases.filter((ph) => phaseStatus(ph) === 'todo'))

  const chips = ['All', ...p.subcons.map((g) => g.name)]

  const advance = (ph: Phase, sectionId: string) => {
    const completed = actions.advanceSection(ph.id, sectionId)
    if (completed) {
      haptic([12, 60, 12])
      ui.showToast(`${ph.name} marked done 🎉`)
    }
  }

  const editBtn = (ph: Phase) => (
    <button onClick={() => setEditing(ph.id)} aria-label={`Edit ${ph.name}`} style={{ padding: 4, color: 'var(--muted)' }}>
      <Pencil size={14} />
    </button>
  )

  const sectionRow = (ph: Phase, sec: Phase['sections'][number]) => {
    const meta = STATUS_META[sec.status]
    return (
      <div key={sec.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec.name}</div>
          <div className="tag" style={{ display: 'inline-block', marginTop: 3 }}>{sec.subcon}</div>
        </div>
        {sec.status === 'done' ? (
          <div className="badge" style={{ background: meta.bg, color: meta.fg, border: `1px solid ${meta.bd}`, padding: '5px 10px' }}>
            {meta.label}
          </div>
        ) : (
          <button
            aria-label={`Advance ${sec.name}`}
            className="badge pressable"
            style={{ background: meta.bg, color: meta.fg, border: `1px solid ${meta.bd}`, padding: '5px 10px', minWidth: 92, textAlign: 'center' }}
            onClick={() => advance(ph, sec.id)}
          >
            {meta.label} ›
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      <div style={{ padding: '18px 20px 10px' }}>
        <div className="screen-title">Phases</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', paddingBottom: 2 }}>
          {chips.map((n) => (
            <button key={n} className={`chip ${pf === n ? 'active' : ''}`} onClick={() => ui.setPhaseFilter(n)}>
              {n === 'All' ? `All ${p.phases.length}` : n}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '4px 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {inProg.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warn)', letterSpacing: '0.05em', marginBottom: 8 }}>
              IN PROGRESS · {inProg.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {inProg.map((ph) => (
                <div key={ph.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, flex: 1, minWidth: 0 }}>{ph.name}</div>
                    {editBtn(ph)}
                    <div className="mono" style={{ fontSize: 13, color: 'var(--teal)' }}>{phasePct(ph)}%</div>
                  </div>
                  <div className="bar" style={{ height: 5, margin: '9px 0' }}>
                    <div style={{ width: `${phasePct(ph)}%` }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ph.sections.map((sec) => sectionRow(ph, sec))}
                  </div>
                  {ph.note && (
                    <div style={{ fontSize: 12, color: ph.blocked ? 'var(--danger)' : 'var(--text-2)', marginTop: 8 }}>
                      {ph.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {done.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--teal)', letterSpacing: '0.05em', marginBottom: 8 }}>
              DONE · {done.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {done.map((ph) => (
                <div key={ph.id} className="card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-2)', textDecoration: 'line-through', flex: 1, minWidth: 0 }}>{ph.name}</div>
                  {editBtn(ph)}
                  <div style={{ color: 'var(--teal)', fontSize: 15 }}>✓</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {todo.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '0.05em', marginBottom: 8 }}>
              NOT STARTED · {todo.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todo.map((ph) => {
                const subcons = [...new Set(ph.sections.map((sec) => sec.subcon))]
                const multi = subcons.length > 1
                return (
                  <div key={ph.id} className="card" style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, flex: 1, minWidth: 0 }}>{ph.name}</div>
                      {editBtn(ph)}
                      {!multi && subcons[0] && <div className="tag" style={{ flexShrink: 0 }}>{subcons[0]}</div>}
                      <button
                        style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal)', border: '1px solid var(--teal-tint-bd)', borderRadius: 6, padding: '3px 9px', flexShrink: 0 }}
                        onClick={() => {
                          actions.startPhase(ph.id)
                          ui.showToast(`${ph.name} started`)
                        }}
                      >
                        Start
                      </button>
                    </div>
                    {multi && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {subcons.map((sc) => (
                          <div key={sc} className="tag">{sc}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <button
          className="pressable"
          style={{ border: '1.5px dashed #C9C4BA', borderRadius: 12, padding: 14, textAlign: 'center', color: 'var(--teal)', fontSize: 13, fontWeight: 600, width: '100%' }}
          onClick={() => setEditing('')}
        >
          + Add phase
        </button>
      </div>

      {editing !== null && (
        <PhaseEditSheet phaseId={editing || undefined} onClose={() => setEditing(null)} />
      )}
    </>
  )
}
