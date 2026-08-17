import { useState } from 'react'
import { activeProject, actions, useAppState } from '../store'
import { useUi } from '../ui'
import { ConfirmButton, Field, TextField } from './form'
import { Sheet } from './Sheet'
import { phaseStatus } from '../selectors'

/** Add (no phaseId) or edit (phaseId) a phase. Multiple subcons, tracked individually. */
export function PhaseEditSheet({ phaseId, onClose }: { phaseId?: string; onClose: () => void }) {
  const s = useAppState()
  const ui = useUi()
  const p = activeProject(s)
  const existing = phaseId ? p.phases.find((ph) => ph.id === phaseId) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [blocked, setBlocked] = useState(existing?.blocked ?? false)
  // selection order + remembered pct per subcon (kept when toggled off and back on)
  const [selected, setSelected] = useState<string[]>(existing?.work.map((w) => w.subcon) ?? [])
  const [pcts, setPcts] = useState<Record<string, number>>(
    Object.fromEntries((existing?.work ?? []).map((w) => [w.subcon, w.pct])),
  )

  const toggle = (sub: string) => {
    setSelected((sel) => (sel.includes(sub) ? sel.filter((x) => x !== sub) : [...sel, sub]))
  }

  const setPct = (sub: string, pct: number) => {
    setPcts((m) => ({ ...m, [sub]: Math.max(0, Math.min(100, pct)) }))
  }

  const save = (close: () => void) => {
    const work = selected.map((sub) => ({ subcon: sub, pct: pcts[sub] ?? 0 }))
    if (existing) {
      actions.updatePhase(existing.id, { name: name.trim(), work, note: note.trim() || undefined, blocked })
      ui.showToast('Phase updated')
    } else {
      actions.addPhase(name.trim(), selected)
      ui.showToast(`${name.trim()} added`)
    }
    close()
  }

  const showBlocked = existing && phaseStatus(existing) !== 'todo'

  return (
    <Sheet onClosed={onClose}>
      {(close) => (
        <>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{existing ? 'Edit phase' : 'Add phase'}</div>

          <TextField label="Phase name" value={name} onChange={setName} placeholder="e.g. Backdrop 05" />

          {p.subcons.length > 0 ? (
            <Field label="Subcontractors (tap to assign — each is tracked individually)">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {p.subcons.map((g) => (
                  <button
                    key={g.name}
                    type="button"
                    className={`chip ${selected.includes(g.name) ? 'active' : ''}`}
                    style={{ padding: '5px 12px' }}
                    onClick={() => toggle(g.name)}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </Field>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 10 }}>
              No subcontractors yet — add them in project settings first.
            </div>
          )}

          {existing && selected.length > 0 && (
            <Field label="Progress per subcontractor">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selected.map((sub) => {
                  const pct = pcts[sub] ?? 0
                  return (
                    <div key={sub} style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
                        <button className="stepper-btn" aria-label={`Decrease ${sub}`} onClick={() => setPct(sub, pct - 5)}>−</button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <input
                            className="pct-input mono"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={100}
                            value={pct}
                            aria-label={`${sub} percent`}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setPct(sub, e.target.value === '' ? 0 : Math.round(Number(e.target.value)))}
                          />
                          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>%</span>
                        </div>
                        <button className="stepper-btn" aria-label={`Increase ${sub}`} style={{ color: 'var(--teal)' }} onClick={() => setPct(sub, pct + 5)}>+</button>
                      </div>
                      <input
                        className="pct-slider"
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={pct}
                        aria-label={`${sub} progress slider`}
                        style={{ background: `linear-gradient(to right, var(--teal) ${pct}%, var(--fill) ${pct}%)` }}
                        onChange={(e) => setPct(sub, Number(e.target.value))}
                      />
                    </div>
                  )
                })}
              </div>
            </Field>
          )}

          <TextField label="Status note" value={note} onChange={setNote} placeholder="e.g. Due 20 Sep · waiting materials" />

          {showBlocked && (
            <button
              type="button"
              className="chip"
              style={{
                marginTop: 10,
                background: blocked ? 'var(--danger)' : '#fff',
                color: blocked ? '#fff' : 'var(--danger)',
                borderColor: blocked ? 'var(--danger)' : '#EBCFCD',
              }}
              onClick={() => setBlocked(!blocked)}
            >
              {blocked ? 'Blocked ✓' : 'Mark as blocked'}
            </button>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            <button className="primary-btn" disabled={!name.trim() || selected.length === 0} onClick={() => save(close)}>
              {existing ? 'Save changes' : 'Add phase'}
            </button>
            {existing && (
              <ConfirmButton
                label="Delete phase"
                onConfirm={() => {
                  actions.deletePhase(existing.id)
                  ui.showToast(`${existing.name} deleted`)
                  close()
                }}
              />
            )}
          </div>
        </>
      )}
    </Sheet>
  )
}
