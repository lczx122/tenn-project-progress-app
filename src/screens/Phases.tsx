import { activeProject, actions, useAppState } from '../store'
import { useUi } from '../ui'
import type { Phase } from '../types'

export function Phases() {
  const s = useAppState()
  const ui = useUi()
  const p = activeProject(s)
  const pf = ui.phaseFilter

  const fBy = (list: Phase[]) => (pf === 'All' ? list : list.filter((ph) => ph.subcon === pf))
  const inProg = fBy(p.phases.filter((ph) => ph.status === 'prog'))
  const done = fBy(p.phases.filter((ph) => ph.status === 'done'))
  const todo = fBy(p.phases.filter((ph) => ph.status === 'todo'))

  const chips = ['All', ...p.subcons.map((g) => g.name)]

  const bump = (ph: Phase) => {
    const completed = actions.bumpPhase(ph.id)
    if (completed) ui.showToast(`${ph.name} marked done 🎉`)
  }

  return (
    <>
      <div style={{ padding: '18px 20px 10px' }}>
        <div className="screen-title">Phases</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', paddingBottom: 2 }}>
          {chips.map((n) => (
            <button
              key={n}
              className={`chip ${pf === n ? 'active' : ''}`}
              onClick={() => ui.setPhaseFilter(n)}
            >
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{ph.name}</div>
                    <div className="mono" style={{ fontSize: 13, color: 'var(--teal)' }}>{ph.pct}%</div>
                  </div>
                  <div className="bar" style={{ height: 5, margin: '9px 0' }}>
                    <div style={{ width: `${ph.pct}%` }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <div className="tag">{ph.subcon}</div>
                    <div style={{ flex: 1, fontSize: 12, color: ph.blocked ? 'var(--danger)' : 'var(--text-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ph.note}
                    </div>
                    <button
                      style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal)', border: '1px solid var(--teal-tint-bd)', borderRadius: 6, padding: '3px 9px', flexShrink: 0 }}
                      onClick={() => bump(ph)}
                    >
                      +5%
                    </button>
                  </div>
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
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-2)', textDecoration: 'line-through' }}>{ph.name}</div>
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
              {todo.map((ph) => (
                <div key={ph.id} className="card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{ph.name}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <div className="tag">{ph.subcon}</div>
                    <button
                      style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal)', border: '1px solid var(--teal-tint-bd)', borderRadius: 6, padding: '3px 9px' }}
                      onClick={() => {
                        actions.startPhase(ph.id)
                        ui.showToast(`${ph.name} started`)
                      }}
                    >
                      Start
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
