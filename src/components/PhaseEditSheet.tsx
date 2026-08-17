import { useState } from 'react'
import { activeProject, actions, useAppState } from '../store'
import { useUi } from '../ui'
import { ChipSelect, ConfirmButton, TextField } from './form'
import type { PhaseStatus } from '../types'

const STATUS_LABELS: Record<PhaseStatus, string> = { todo: 'Not started', prog: 'In progress', done: 'Done' }

/** Add (no phaseId) or edit (phaseId) a phase. */
export function PhaseEditSheet({ phaseId, onClose }: { phaseId?: string; onClose: () => void }) {
  const s = useAppState()
  const ui = useUi()
  const p = activeProject(s)
  const existing = phaseId ? p.phases.find((ph) => ph.id === phaseId) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [subcon, setSubcon] = useState(existing?.subcon ?? p.subcons[0]?.name ?? '')
  const [status, setStatus] = useState<PhaseStatus>(existing?.status ?? 'todo')
  const [pct, setPct] = useState(existing?.pct ?? 0)
  const [note, setNote] = useState(existing?.note ?? '')
  const [blocked, setBlocked] = useState(existing?.blocked ?? false)

  const save = () => {
    const patch = {
      name: name.trim(),
      subcon,
      status,
      pct: status === 'done' ? 100 : status === 'todo' ? 0 : Math.min(95, Math.max(5, pct)),
      note: note.trim() || undefined,
      blocked,
    }
    if (existing) {
      actions.updatePhase(existing.id, patch)
      ui.showToast('Phase updated')
    } else {
      actions.addPhase(patch.name, subcon)
      ui.showToast(`${patch.name} added`)
    }
    onClose()
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{existing ? 'Edit phase' : 'Add phase'}</div>

        <TextField label="Phase name" value={name} onChange={setName} placeholder="e.g. Backdrop 05" />

        {p.subcons.length > 0 ? (
          <ChipSelect label="Subcontractor" options={p.subcons.map((g) => g.name)} value={subcon} onChange={setSubcon} />
        ) : (
          <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 10 }}>
            No subcontractors yet — add them in project settings first.
          </div>
        )}

        {existing && (
          <>
            <ChipSelect
              label="Status"
              options={Object.values(STATUS_LABELS)}
              value={STATUS_LABELS[status]}
              onChange={(v) => setStatus((Object.keys(STATUS_LABELS) as PhaseStatus[]).find((k) => STATUS_LABELS[k] === v)!)}
            />
            {status === 'prog' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>Progress</div>
                <button className="stepper-btn" onClick={() => setPct(Math.max(5, pct - 5))}>−</button>
                <div className="mono" style={{ fontSize: 14, width: 42, textAlign: 'center' }}>{pct}%</div>
                <button className="stepper-btn" style={{ color: 'var(--teal)' }} onClick={() => setPct(Math.min(95, pct + 5))}>+</button>
              </div>
            )}
            <TextField label="Status note" value={note} onChange={setNote} placeholder="e.g. Due 20 Sep · waiting materials" />
            {status === 'prog' && (
              <button
                type="button"
                className={`chip ${blocked ? '' : ''}`}
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
          </>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          <button className="primary-btn" disabled={!name.trim() || !subcon} onClick={save}>
            {existing ? 'Save changes' : 'Add phase'}
          </button>
          {existing && (
            <ConfirmButton
              label="Delete phase"
              onConfirm={() => {
                actions.deletePhase(existing.id)
                ui.showToast(`${existing.name} deleted`)
                onClose()
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
