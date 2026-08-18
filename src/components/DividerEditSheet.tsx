import { useState } from 'react'
import { activeProject, actions, useAppState } from '../store'
import { useUi } from '../ui'
import { ConfirmButton, Field, TextField } from './form'
import { Sheet } from './Sheet'

/** Add (no dividerId) or edit (dividerId) a phase divider. */
export function DividerEditSheet({ dividerId, onClose }: { dividerId?: string; onClose: () => void }) {
  const s = useAppState()
  const ui = useUi()
  const p = activeProject(s)
  const existing = dividerId ? p.dividers.find((d) => d.id === dividerId) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [before, setBefore] = useState<string>(existing?.beforeItemId ?? p.phases[0]?.id ?? 'end')

  const save = (close: () => void) => {
    const beforeItemId = before === 'end' ? null : before
    if (existing) {
      actions.updateDivider(existing.id, { name: name.trim(), beforeItemId })
      ui.showToast('Phase divider updated')
    } else {
      actions.addDivider(name.trim(), beforeItemId)
      ui.showToast(`${name.trim()} added`)
    }
    close()
  }

  return (
    <Sheet onClosed={onClose}>
      {(close) => (
        <>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{existing ? 'Edit phase divider' : 'Add phase divider'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
            A divider starts a phase — the items after it belong to that phase.
          </div>

          <TextField label="Phase name" value={name} onChange={setName} placeholder="e.g. Phase 2 — Main works" />

          <Field label="Starts before item">
            <select className="text-input" value={before} onChange={(e) => setBefore(e.target.value)} aria-label="Divider position">
              {p.phases.map((ph) => (
                <option key={ph.id} value={ph.id}>{ph.name}</option>
              ))}
              <option value="end">— at the end of the list —</option>
            </select>
          </Field>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            <button className="primary-btn" disabled={!name.trim()} onClick={() => save(close)}>
              {existing ? 'Save changes' : 'Add divider'}
            </button>
            {existing && (
              <ConfirmButton
                label="Delete divider"
                onConfirm={() => {
                  actions.deleteDivider(existing.id)
                  ui.showToast(`${existing.name} removed — items merge into the previous phase`)
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
