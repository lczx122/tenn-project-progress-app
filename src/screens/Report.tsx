import { useRef, useState } from 'react'
import { Camera, Images, X } from 'lucide-react'
import { activeProject, actions, useAppState } from '../store'
import { useUi } from '../ui'
import { manTotal, requiredStepsOk, sopDoneCount, sopSteps } from '../selectors'
import { fmtDay, todayISO } from '../utils/dates'
import { storePhotoFile, usePhotoUrl } from '../utils/photos'
import { haptic } from '../utils/motion'
import { Sheet } from '../components/Sheet'

const MAX_PHOTOS = 6

function PhotoTile({ id, onRemove }: { id: string; onRemove: () => void }) {
  const url = usePhotoUrl(id)
  return (
    <div style={{ position: 'relative', width: 62, height: 62 }}>
      <div
        style={{
          width: 62, height: 62, borderRadius: 8, background: url ? `url(${url}) center/cover` : 'var(--fill)',
        }}
      />
      <button
        onClick={onRemove}
        aria-label="Remove photo"
        style={{
          position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
          background: 'var(--ink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <X size={12} />
      </button>
    </div>
  )
}

export function Report() {
  const s = useAppState()
  const ui = useUi()
  const p = activeProject(s)
  const dr = p.draft
  const cameraRef = useRef<HTMLInputElement>(null)
  const albumRef = useRef<HTMLInputElement>(null)
  const [matPickerOpen, setMatPickerOpen] = useState(false)
  const [busyPhoto, setBusyPhoto] = useState(false)

  const steps = sopSteps(dr)
  const done = sopDoneCount(dr)
  const requiredOk = requiredStepsOk(dr)
  const leftCount = 4 - steps.slice(0, 4).filter((st) => st.done).length
  const total = manTotal(dr)

  const stockSupplies = p.supplies.filter((su) => su.status === 'stock' && su.stock > 0)
  const available = stockSupplies.filter((su) => !dr.mats.some((m) => m.supplyId === su.id))

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusyPhoto(true)
    try {
      let added = 0
      for (const f of Array.from(files)) {
        if (dr.photoIds.length + added >= MAX_PHOTOS) break
        const id = await storePhotoFile(f)
        actions.draftAddPhoto(id)
        added++
      }
      ui.showToast(added === 1 ? 'Photo added' : `${added} photos added`)
    } catch {
      ui.showToast('Could not add photo')
    } finally {
      setBusyPhoto(false)
      if (cameraRef.current) cameraRef.current.value = ''
      if (albumRef.current) albumRef.current.value = ''
    }
  }

  const stat = (ok: boolean, doneTxt: string, todoTxt: string) =>
    ok ? { text: doneTxt, color: 'var(--teal)' } : { text: todoTxt, color: 'var(--warn)' }

  const photoStat = stat(steps[0].done, `✓ ${dr.photoIds.length} added`, `${dr.photoIds.length} of 3`)
  const manStat = stat(steps[1].done, `✓ ${total} on site`, 'Required')
  const matStat = stat(steps[2].done, `✓ ${dr.mats.length} logged`, 'Required')
  const sumStat = stat(steps[3].done, '✓', 'Required')

  const submit = () => {
    if (dr.submitted) {
      ui.showToast('Today’s report already submitted')
      return
    }
    if (!requiredOk) {
      ui.showToast(`${leftCount} required step${leftCount > 1 ? 's' : ''} left`)
      return
    }
    actions.submitReport()
    haptic([12, 60, 12])
    ui.showToast('Report submitted · stock updated')
    ui.goTab('history')
  }

  return (
    <>
      <div style={{ padding: '18px 20px 10px' }}>
        <div className="screen-title">Daily report</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>
          {fmtDay(todayISO())} · {p.name} · {done} of 5 steps done
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
          {steps.map((st, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: dr.submitted || st.done ? 'var(--teal)' : 'var(--empty)' }} />
          ))}
        </div>
      </div>

      <div style={{ padding: '4px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* 1 · Photos */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              1 · Site photos <span style={{ color: 'var(--text-2)', fontWeight: 400 }}>(min. 3)</span>
            </div>
            <div style={{ color: photoStat.color, fontWeight: 700, fontSize: 13 }}>{photoStat.text}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {dr.photoIds.map((id) => (
              <PhotoTile key={id} id={id} onRemove={() => actions.draftRemovePhoto(id)} />
            ))}
            {dr.photoIds.length < MAX_PHOTOS && !dr.submitted && (
              <>
                <button
                  style={{
                    width: 62, height: 62, borderRadius: 8, border: '1.5px dashed #C9C4BA',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, color: 'var(--muted)',
                  }}
                  onClick={() => cameraRef.current?.click()}
                  disabled={busyPhoto}
                  aria-label="Take photo"
                >
                  <Camera size={18} />
                  <span style={{ fontSize: 9, fontWeight: 600 }}>{busyPhoto ? '…' : 'Camera'}</span>
                </button>
                <button
                  style={{
                    width: 62, height: 62, borderRadius: 8, border: '1.5px dashed #C9C4BA',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, color: 'var(--muted)',
                  }}
                  onClick={() => albumRef.current?.click()}
                  disabled={busyPhoto}
                  aria-label="Add from album"
                >
                  <Images size={18} />
                  <span style={{ fontSize: 9, fontWeight: 600 }}>{busyPhoto ? '…' : 'Album'}</span>
                </button>
              </>
            )}
          </div>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => onFiles(e.target.files)}
          />
          <input
            ref={albumRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => onFiles(e.target.files)}
          />
        </div>

        {/* 2 · Manpower */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>2 · Manpower on site</div>
            <div style={{ color: manStat.color, fontWeight: 700, fontSize: 13 }}>{manStat.text}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
            {p.subcons.map(({ name }) => (
              <div key={name} style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <div style={{ fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button className="stepper-btn" style={{ width: 24, height: 24, color: 'var(--text-2)' }} onClick={() => actions.draftSetMan(name, (dr.man[name] ?? 0) - 1)} disabled={dr.submitted}>−</button>
                  <div className="mono" style={{ fontSize: 14, width: 16, textAlign: 'center' }}>{dr.man[name] ?? 0}</div>
                  <button className="stepper-btn" style={{ width: 24, height: 24, color: 'var(--teal)' }} onClick={() => actions.draftSetMan(name, (dr.man[name] ?? 0) + 1)} disabled={dr.submitted}>+</button>
                </div>
              </div>
            ))}
          </div>
          {p.subcons.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 8 }}>
              No subcontractors yet — add them via the project name ▾ → settings.
            </div>
          )}
        </div>

        {/* 3 · Materials */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>3 · Material used today</div>
            <div style={{ color: matStat.color, fontWeight: 700, fontSize: 13 }}>{matStat.text}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {dr.mats.map((m) => {
              const su = p.supplies.find((x) => x.id === m.supplyId)
              if (!su) return null
              const step = su.unit === 'm' ? 5 : 1
              return (
                <div key={m.supplyId} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 8, padding: '9px 12px', fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {su.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button className="stepper-btn" style={{ background: 'var(--bg)', border: 'none', color: 'var(--text-2)' }} onClick={() => actions.draftSetMatQty(m.supplyId, Math.max(step, m.qty - step))} disabled={dr.submitted}>−</button>
                    <div className="mono" style={{ fontSize: 13, width: 52, textAlign: 'center' }}>{m.qty} {su.unit}</div>
                    <button className="stepper-btn" style={{ background: 'var(--bg)', border: 'none', color: 'var(--teal)' }} onClick={() => actions.draftSetMatQty(m.supplyId, Math.min(m.qty + step, su.stock))} disabled={dr.submitted}>+</button>
                  </div>
                  <button style={{ color: 'var(--danger)', fontSize: 16, padding: '0 2px', flexShrink: 0 }} onClick={() => actions.draftRemoveMat(m.supplyId)} disabled={dr.submitted}>×</button>
                </div>
              )
            })}
            {available.length > 0 && !dr.submitted && (
              <button className="link-btn" style={{ padding: 2, textAlign: 'left' }} onClick={() => setMatPickerOpen(true)}>
                + Add material
              </button>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8, background: 'var(--bg)', borderRadius: 8, padding: '8px 10px' }}>
            Stock levels update automatically when you submit
          </div>
        </div>

        {/* 4 · Summary */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>4 · Work done summary</div>
            <div style={{ color: sumStat.color, fontWeight: 700, fontSize: 13 }}>{sumStat.text}</div>
          </div>
          <textarea
            placeholder="What was completed today…"
            value={dr.summary}
            disabled={dr.submitted}
            onChange={(e) => actions.draftSetSummary(e.target.value)}
            style={{ width: '100%', marginTop: 10, background: 'var(--bg)', border: 'none', borderRadius: 8, padding: '10px 12px', fontSize: 13, minHeight: 64, resize: 'vertical', color: 'var(--ink)' }}
          />
        </div>

        {/* 5 · Issues */}
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            5 · Issues / blockers <span style={{ color: 'var(--text-2)', fontWeight: 400 }}>(optional)</span>
          </div>
          <textarea
            placeholder="Any delays, damage, or blockers…"
            value={dr.issues}
            disabled={dr.submitted}
            onChange={(e) => actions.draftSetIssues(e.target.value)}
            style={{ width: '100%', marginTop: 10, background: 'var(--bg)', border: 'none', borderRadius: 8, padding: '10px 12px', fontSize: 13, minHeight: 48, resize: 'vertical', color: 'var(--ink)' }}
          />
        </div>

        {/* Submit */}
        <button
          style={{
            background: dr.submitted ? 'var(--teal-tint)' : requiredOk ? 'var(--teal)' : 'var(--empty)',
            color: dr.submitted ? 'var(--teal)' : requiredOk ? '#fff' : 'var(--muted-2)',
            borderRadius: 12, textAlign: 'center', padding: 14, fontWeight: 600, fontSize: 15, width: '100%',
          }}
          onClick={submit}
        >
          {dr.submitted
            ? `✓ Submitted — ${fmtDay(todayISO())}`
            : requiredOk
              ? 'Submit report'
              : `Submit report — ${leftCount} step${leftCount > 1 ? 's' : ''} left`}
        </button>
      </div>

      {/* Material picker sheet */}
      {matPickerOpen && (
        <Sheet onClosed={() => setMatPickerOpen(false)}>
          {(close) => (
            <>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Add material</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>Only materials with on-site stock</div>
              {available.map((su) => (
                <button
                  key={su.id}
                  className="sheet-row"
                  onClick={() => {
                    actions.draftAddMat(su.id, su.unit === 'm' ? 5 : 1)
                    close()
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{su.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{su.stock} {su.unit} on site</div>
                  </div>
                </button>
              ))}
            </>
          )}
        </Sheet>
      )}
    </>
  )
}
