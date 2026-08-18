import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { activeProject, actions, useAppState } from '../store'
import { useUi } from '../ui'
import { ConfirmButton, Field, TextField } from './form'
import { Sheet } from './Sheet'
import { phaseStatus } from '../selectors'
import type { SectionStatus } from '../types'

const STATUS_LABELS: { key: SectionStatus; label: string }[] = [
  { key: 'todo', label: 'Not started' },
  { key: 'started', label: 'Started' },
  { key: 'ongoing', label: 'Ongoing' },
  { key: 'done', label: 'Finished' },
]

interface DraftSection {
  id: string
  name: string
  subcon: string
  status: SectionStatus
}

/** Add (no phaseId) or edit (phaseId) a phase and its sections. */
export function PhaseEditSheet({ phaseId, onClose }: { phaseId?: string; onClose: () => void }) {
  const s = useAppState()
  const ui = useUi()
  const p = activeProject(s)
  const existing = phaseId ? p.phases.find((ph) => ph.id === phaseId) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [kind, setKind] = useState<'work' | 'task'>(existing?.kind ?? 'work')
  const [taskSubcons, setTaskSubcons] = useState<string[]>(existing?.taskSubcons ?? [])
  const [taskDone, setTaskDone] = useState(existing?.taskDone ?? false)
  const [note, setNote] = useState(existing?.note ?? '')
  const [blocked, setBlocked] = useState(existing?.blocked ?? false)
  const [sections, setSections] = useState<DraftSection[]>(
    existing?.sections.map((sec) => ({ ...sec })) ?? [
      { id: `new-1`, name: '', subcon: p.subcons[0]?.name ?? '', status: 'todo' },
    ],
  )

  const patch = (id: string, part: Partial<DraftSection>) => {
    setSections((list) => list.map((sec) => (sec.id === id ? { ...sec, ...part } : sec)))
  }

  const addSection = () => {
    setSections((list) => [
      ...list,
      { id: `new-${Date.now()}`, name: '', subcon: p.subcons[0]?.name ?? '', status: 'todo' },
    ])
  }

  const removeSection = (id: string) => {
    setSections((list) => list.filter((sec) => sec.id !== id))
  }

  const valid =
    name.trim().length > 0 &&
    (kind === 'task'
      ? taskSubcons.length > 0
      : sections.length > 0 && sections.every((sec) => sec.name.trim() && sec.subcon))

  const toggleTaskSubcon = (sub: string) => {
    setTaskSubcons((list) => (list.includes(sub) ? list.filter((x) => x !== sub) : [...list, sub]))
  }

  const save = (close: () => void) => {
    if (existing) {
      if (kind === 'task') {
        actions.updatePhase(existing.id, {
          name: name.trim(),
          taskSubcons,
          taskDone,
          note: note.trim() || undefined,
        })
      } else {
        const cleaned = sections.map((sec) => ({ ...sec, name: sec.name.trim() }))
        actions.updatePhase(existing.id, {
          name: name.trim(),
          sections: cleaned,
          note: note.trim() || undefined,
          blocked,
        })
      }
      ui.showToast('Item updated')
    } else if (kind === 'task') {
      actions.addTask(name.trim(), taskSubcons)
      ui.showToast(`${name.trim()} added`)
    } else {
      const cleaned = sections.map((sec) => ({ ...sec, name: sec.name.trim() }))
      actions.addPhase(name.trim(), cleaned.map(({ name: n, subcon, status }) => ({ name: n, subcon, status })))
      ui.showToast(`${name.trim()} added`)
    }
    close()
  }

  const showBlocked = existing && phaseStatus(existing) !== 'todo'

  return (
    <Sheet onClosed={onClose}>
      {(close) => (
        <>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{existing ? 'Edit item' : 'Add item'}</div>

          <TextField label="Item name" value={name} onChange={setName} placeholder="e.g. Backdrop 05" />

          {!existing && (
            <Field label="Item type">
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className={`chip ${kind === 'work' ? 'active' : ''}`} onClick={() => setKind('work')}>
                  Work
                </button>
                <button type="button" className={`chip ${kind === 'task' ? 'active' : ''}`} onClick={() => setKind('task')}>
                  Meeting / Task
                </button>
              </div>
            </Field>
          )}

          {kind === 'task' ? (
            p.subcons.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 10 }}>
                No subcontractors yet — add them in project settings first.
              </div>
            ) : (
              <>
                <Field label="Tag subcontractors involved">
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {p.subcons.map((g) => (
                      <button
                        key={g.name}
                        type="button"
                        className={`chip ${taskSubcons.includes(g.name) ? 'active' : ''}`}
                        style={{ padding: '5px 12px' }}
                        onClick={() => toggleTaskSubcon(g.name)}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                </Field>
                {existing && (
                  <Field label="Status">
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className={`chip ${!taskDone ? 'active' : ''}`} onClick={() => setTaskDone(false)}>
                        Pending
                      </button>
                      <button type="button" className={`chip ${taskDone ? 'active' : ''}`} onClick={() => setTaskDone(true)}>
                        Done
                      </button>
                    </div>
                  </Field>
                )}
              </>
            )
          ) : p.subcons.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 10 }}>
              No subcontractors yet — add them in project settings first.
            </div>
          ) : (
            <Field label="Sections (each handled by one subcontractor)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sections.map((sec, i) => (
                  <div key={sec.id} style={{ background: 'var(--bg)', borderRadius: 10, padding: 10 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        className="text-input"
                        style={{ background: '#fff' }}
                        placeholder={`Section ${i + 1} — e.g. Framing`}
                        value={sec.name}
                        aria-label={`Section ${i + 1} name`}
                        onChange={(e) => patch(sec.id, { name: e.target.value })}
                      />
                      {sections.length > 1 && (
                        <button
                          aria-label={`Remove section ${i + 1}`}
                          style={{ color: 'var(--danger)', padding: 4, flexShrink: 0 }}
                          onClick={() => removeSection(sec.id)}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {p.subcons.map((g) => (
                        <button
                          key={g.name}
                          type="button"
                          className={`chip ${sec.subcon === g.name ? 'active' : ''}`}
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => patch(sec.id, { subcon: g.name })}
                        >
                          {g.name}
                        </button>
                      ))}
                    </div>
                    {existing && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {STATUS_LABELS.map(({ key, label }) => (
                          <button
                            key={key}
                            type="button"
                            className={`chip ${sec.status === key ? 'active' : ''}`}
                            style={{ padding: '4px 10px', fontSize: 12 }}
                            aria-label={`${label} for section ${i + 1}`}
                            onClick={() => patch(sec.id, { status: key })}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <button
                  className="sheet-row"
                  style={{ marginTop: 0 }}
                  onClick={addSection}
                >
                  <Plus size={16} color="var(--teal)" />
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)' }}>Add section</div>
                </button>
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
            <button className="primary-btn" disabled={!valid} onClick={() => save(close)}>
              {existing ? 'Save changes' : 'Add item'}
            </button>
            {existing && (
              <ConfirmButton
                label="Delete item"
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
