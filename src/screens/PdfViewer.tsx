import { useEffect, useState } from 'react'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import { activeProject, useAppState } from '../store'
import { useUi } from '../ui'
import { fileGet } from '../db'
import { assetUrl } from '../utils/base'
import { fetchRemoteBlob } from '../sync/engine'

export function PdfViewer({ drawingId }: { drawingId: string }) {
  const s = useAppState()
  const ui = useUi()
  const p = activeProject(s)
  const ds = p.drawings.find((d) => d.id === drawingId)
  const [url, setUrl] = useState<string | null>(null)
  const [isImage, setIsImage] = useState(false)

  useEffect(() => {
    let objectUrl: string | null = null
    if (!ds) return
    if (ds.src.kind === 'bundled') {
      setUrl(assetUrl(ds.src.url))
      setIsImage(false)
    } else {
      const src = ds.src
      setIsImage(src.mime.startsWith('image/'))
      fileGet(src.blobId)
        .then((blob) => blob ?? fetchRemoteBlob(src.blobId, 'files'))
        .then((blob) => {
          if (blob) {
            objectUrl = URL.createObjectURL(blob)
            setUrl(objectUrl)
          }
        })
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [drawingId])

  if (!ds) return null

  return (
    <div className="viewer">
      <div className="viewer-head">
        <button className="back-chevron" onClick={ui.pop} aria-label="Back">
          <ChevronLeft size={22} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ds.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{ds.pages} page{ds.pages === 1 ? '' : 's'}</div>
        </div>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--teal)', display: 'flex' }} aria-label="Open in new tab">
            <ExternalLink size={18} />
          </a>
        )}
      </div>
      {url ? (
        isImage ? (
          <div style={{ flex: 1, overflow: 'auto', background: '#3a3d3b', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
            <img src={url} alt={ds.name} style={{ maxWidth: '100%', height: 'auto' }} />
          </div>
        ) : (
          <iframe src={url} title={ds.name} />
        )
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13 }}>
          Loading…
        </div>
      )}
    </div>
  )
}
