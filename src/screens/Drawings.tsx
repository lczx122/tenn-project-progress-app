import { useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { activeProject, actions, useAppState } from '../store'
import { useUi } from '../ui'
import { fmtFull, todayISO } from '../utils/dates'
import { fileGet, filePut } from '../db'
import type { DrawingSet } from '../types'

async function countPdfPages(file: File): Promise<number> {
  try {
    const text = await file.slice(0, 2_000_000).text()
    const n = (text.match(/\/Type\s*\/Page[^s]/g) || []).length
    return Math.max(n, 1)
  } catch {
    return 1
  }
}

export function Drawings() {
  const s = useAppState()
  const ui = useUi()
  const p = activeProject(s)
  const fileRef = useRef<HTMLInputElement>(null)
  const [linking, setLinking] = useState<string | null>(null)
  const [sharing, setSharing] = useState<string | null>(null)

  const upload = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    const blobId = `file-${Date.now()}`
    await filePut(blobId, file)
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const set: DrawingSet = {
      id: `dw-${Date.now()}`,
      name: file.name.replace(/\.[a-z0-9]+$/i, ''),
      pages: isPdf ? await countPdfPages(file) : 1,
      revISO: todayISO(),
      tags: [],
      src: { kind: 'uploaded', blobId, mime: file.type || (isPdf ? 'application/pdf' : 'image/*') },
    }
    actions.addDrawing(set)
    ui.showToast(`"${set.name}" added to drawings`)
    if (fileRef.current) fileRef.current.value = ''
  }

  const share = async (ds: DrawingSet) => {
    if (sharing) return
    setSharing(ds.id)
    try {
      let blob: Blob | undefined
      if (ds.src.kind === 'bundled') {
        blob = await fetch(ds.src.url).then((r) => (r.ok ? r.blob() : undefined))
      } else {
        blob = await fileGet(ds.src.blobId)
      }
      if (!blob) throw new Error('no blob')
      const { sharePdf } = await import('../utils/pdf')
      const result = await sharePdf(blob, `${ds.name}.pdf`)
      ui.showToast(result === 'shared' ? 'Drawing shared' : 'Drawing downloaded')
    } catch {
      ui.showToast('Could not share drawing')
    } finally {
      setSharing(null)
    }
  }

  return (
    <>
      <div style={{ padding: '18px 20px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="back-chevron" onClick={ui.pop} aria-label="Back">
          <ChevronLeft size={22} />
        </button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Drawings</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
            {p.name} · {p.drawings.length} drawing set{p.drawings.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <div style={{ padding: '8px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {p.drawings.map((ds) => (
          <div key={ds.id} className="card-hero">
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 44, height: 56, borderRadius: 6, background: 'var(--teal-tint)', border: '1px solid var(--teal-tint-bd)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal)', fontWeight: 700, fontSize: 11, flexShrink: 0,
                }}
              >
                {ds.src.kind === 'uploaded' && ds.src.mime.startsWith('image/') ? 'IMG' : 'PDF'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{ds.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                  {ds.pages} page{ds.pages === 1 ? '' : 's'} · Rev. {fmtFull(ds.revISO)}
                </div>
                {ds.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {ds.tags.map((t) => <div key={t} className="tag">{t}</div>)}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
              <button className="link-btn" onClick={() => ui.push({ type: 'pdfViewer', drawingId: ds.id })}>Open</button>
              <button className="link-btn" onClick={() => share(ds)} disabled={sharing === ds.id}>
                {sharing === ds.id ? 'Preparing…' : 'Share ↗'}
              </button>
              <button className="link-btn" onClick={() => setLinking(ds.id)}>Link to phase</button>
            </div>
          </div>
        ))}

        <button
          style={{ border: '1.5px dashed #C9C4BA', borderRadius: 16, padding: 18, textAlign: 'center', color: 'var(--text-2)', fontSize: 13, width: '100%' }}
          onClick={() => fileRef.current?.click()}
        >
          <span style={{ color: 'var(--teal)', fontWeight: 600 }}>+ Upload drawing</span> — PDF, image or photo of a sketch
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/*"
          style={{ display: 'none' }}
          onChange={(e) => upload(e.target.files)}
        />
      </div>

      {/* Link-to-phase sheet */}
      {linking && (
        <div className="sheet-backdrop" onClick={() => setLinking(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Link to phase</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>Tap to add or remove a phase tag</div>
            {p.phases.map((ph) => {
              const ds = p.drawings.find((d) => d.id === linking)
              const active = !!ds?.tags.includes(ph.name)
              return (
                <button
                  key={ph.id}
                  className={`sheet-row ${active ? 'active' : ''}`}
                  onClick={() => actions.linkDrawingPhase(linking, ph.name)}
                >
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{ph.name}</div>
                  {active && <div style={{ color: 'var(--teal)', fontWeight: 700 }}>✓</div>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
