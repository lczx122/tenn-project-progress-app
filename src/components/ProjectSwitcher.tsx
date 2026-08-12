import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { actions, useAppState } from '../store'
import { useUi } from '../ui'
import { addDays, todayISO } from '../utils/dates'

export function ProjectSwitcher() {
  const s = useAppState()
  const ui = useUi()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [target, setTarget] = useState(addDays(todayISO(), 60))

  if (!ui.switcherOpen) return null

  const close = () => {
    ui.setSwitcherOpen(false)
    setCreating(false)
    setName('')
  }

  return (
    <div className="sheet-backdrop" onClick={close}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Projects</div>
        {s.projects.map((p) => (
          <button
            key={p.id}
            className={`sheet-row ${p.id === s.activeProjectId ? 'active' : ''}`}
            onClick={() => {
              actions.switchProject(p.id)
              close()
              ui.goTab('home')
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                {p.phases.length} phases · {p.reports.length} reports
              </div>
            </div>
            {p.id === s.activeProjectId && <Check size={18} color="var(--teal)" />}
          </button>
        ))}
        {!creating ? (
          <button className="sheet-row" onClick={() => setCreating(true)}>
            <Plus size={18} color="var(--teal)" />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--teal)' }}>New project</div>
          </button>
        ) : (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              className="text-input"
              placeholder="Project name"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
            <label style={{ fontSize: 12, color: 'var(--text-2)' }}>
              Target date
              <input
                className="text-input"
                type="date"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                style={{ marginTop: 4 }}
              />
            </label>
            <button
              className="primary-btn"
              disabled={!name.trim()}
              onClick={() => {
                actions.createProject(name.trim(), target)
                ui.showToast(`Project "${name.trim()}" created`)
                close()
                ui.goTab('home')
              }}
            >
              Create project
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
