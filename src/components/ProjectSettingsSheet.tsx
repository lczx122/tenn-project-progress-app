import { useState } from 'react'
import { Pencil, Plus, RotateCw, Trash2 } from 'lucide-react'
import { activeProject, actions, useAppState } from '../store'
import { useUi } from '../ui'
import { ConfirmButton, Field, TextField } from './form'
import { Sheet } from './Sheet'
import { SyncSection } from './SyncSection'
import { BUILD_VERSION, refreshApp } from '../utils/appUpdate'

export function ProjectSettingsSheet({ onClose }: { onClose: () => void }) {
  const s = useAppState()
  const ui = useUi()
  const p = activeProject(s)

  const [name, setName] = useState(p.name)
  const [target, setTarget] = useState(p.targetDateISO)
  // subcon being edited: '' = none, '+' = adding new, otherwise the original name
  const [editingSub, setEditingSub] = useState('')
  const [subName, setSubName] = useState('')
  const [subTrade, setSubTrade] = useState('')

  const saveMeta = (close: () => void) => {
    actions.updateProjectMeta(name.trim() || p.name, target)
    ui.showToast('Project updated')
    close()
  }

  const startEditSub = (orig: string, trade: string) => {
    setEditingSub(orig || '+')
    setSubName(orig)
    setSubTrade(trade)
  }

  const saveSub = () => {
    const n = subName.trim()
    if (!n) return
    if (editingSub === '+') {
      actions.addSubcon(n, subTrade.trim())
      ui.showToast(`${n} added`)
    } else {
      actions.updateSubcon(editingSub, n, subTrade.trim())
      ui.showToast(`${n} updated`)
    }
    setEditingSub('')
  }

  const removeSub = (nm: string) => {
    if (actions.deleteSubcon(nm)) {
      ui.showToast(`${nm} removed`)
    } else {
      ui.showToast(`${nm} still has phases or supplies assigned`)
    }
  }

  return (
    <Sheet onClosed={onClose}>
      {(close) => (
        <>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Project settings</div>

        <TextField label="Project name" value={name} onChange={setName} />
        <Field label="Target completion date">
          <input className="text-input" type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
        </Field>

        <div className="section-label" style={{ marginTop: 18 }}>SUBCONTRACTORS</div>
        {p.subcons.map((g) =>
          editingSub === g.name ? (
            <div key={g.name} style={{ marginTop: 8, padding: 12, border: '1px solid var(--teal-tint-bd)', borderRadius: 12, background: 'var(--teal-tint)' }}>
              <input className="text-input" value={subName} placeholder="Name" onChange={(e) => setSubName(e.target.value)} />
              <input className="text-input" value={subTrade} placeholder="Trade (e.g. Carpentry)" onChange={(e) => setSubTrade(e.target.value)} style={{ marginTop: 6 }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="primary-btn" style={{ padding: 9 }} disabled={!subName.trim()} onClick={saveSub}>Save</button>
                <button className="chip" onClick={() => setEditingSub('')}>Cancel</button>
              </div>
            </div>
          ) : (
            <div key={g.name} className="sheet-row" style={{ cursor: 'default' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{g.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{g.trade || '—'}</div>
              </div>
              <button onClick={() => startEditSub(g.name, g.trade)} aria-label={`Edit ${g.name}`} style={{ padding: 6, color: 'var(--text-2)' }}>
                <Pencil size={15} />
              </button>
              <button onClick={() => removeSub(g.name)} aria-label={`Remove ${g.name}`} style={{ padding: 6, color: 'var(--danger)' }}>
                <Trash2 size={15} />
              </button>
            </div>
          ),
        )}
        {editingSub === '+' ? (
          <div style={{ marginTop: 8, padding: 12, border: '1px solid var(--teal-tint-bd)', borderRadius: 12, background: 'var(--teal-tint)' }}>
            <input className="text-input" value={subName} placeholder="Name" autoFocus onChange={(e) => setSubName(e.target.value)} />
            <input className="text-input" value={subTrade} placeholder="Trade (e.g. Carpentry)" onChange={(e) => setSubTrade(e.target.value)} style={{ marginTop: 6 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="primary-btn" style={{ padding: 9 }} disabled={!subName.trim()} onClick={saveSub}>Add</button>
              <button className="chip" onClick={() => setEditingSub('')}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="sheet-row" onClick={() => startEditSub('', '')}>
            <Plus size={16} color="var(--teal)" />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--teal)' }}>Add subcontractor</div>
          </button>
        )}

        <SyncSection />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
          <button className="primary-btn" onClick={() => saveMeta(close)}>Save project</button>
          {s.projects.length > 1 && (
            <ConfirmButton
              label="Delete this project"
              onConfirm={() => {
                actions.deleteProject(p.id)
                ui.showToast(`${p.name} deleted`)
                close()
                ui.goTab('home')
              }}
            />
          )}
          <button
            type="button"
            style={{
              width: '100%', borderRadius: 10, padding: 12, fontWeight: 600, fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: '#fff', color: 'var(--teal)', border: '1px solid var(--teal-tint-bd)',
            }}
            onClick={() => {
              ui.showToast('Checking for updates…')
              void refreshApp()
            }}
          >
            <RotateCw size={15} /> Refresh app
          </button>
          <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
            Version {BUILD_VERSION} · pulls the latest version and reloads
          </div>
          <ConfirmButton
            label="Reset app data (restore demo)"
            onConfirm={() => {
              void actions.resetApp()
            }}
          />
          <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
            Reset wipes all projects, reports and photos on this device and restores the demo data.
          </div>
        </div>
        </>
      )}
    </Sheet>
  )
}
