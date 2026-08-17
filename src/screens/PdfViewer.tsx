import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { activeProject, useAppState } from '../store'
import { useUi } from '../ui'
import { fileGet } from '../db'
import { assetUrl } from '../utils/base'
import { fetchRemoteBlob } from '../sync/engine'
import { createSpring, prefersReducedMotion, type Spring } from '../utils/motion'

// Mobile browsers can't display PDFs inline (no built-in viewer on Android
// Chrome; unreliable in iOS standalone PWAs), so pages are rendered in-app
// with pdf.js. Pages render lazily near the viewport and free their canvas
// when scrolled far away — the drawing sets are heavy vector CAD files.

function PdfPage({ doc, pageNo, width }: { doc: PDFDocumentProxy; pageNo: number; width: number }) {
  const holderRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<{ rendered: boolean; task: RenderTask | null }>({ rendered: false, task: null })
  const [aspect, setAspect] = useState(1.414)

  useEffect(() => {
    let alive = true
    const holder = holderRef.current
    if (!holder) return
    const st = stateRef.current
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0]
        const canvas = canvasRef.current
        if (!canvas) return
        if (e.isIntersecting && !st.rendered) {
          st.rendered = true
          void (async () => {
            try {
              const page = await doc.getPage(pageNo)
              if (!alive) return
              const vp1 = page.getViewport({ scale: 1 })
              setAspect(vp1.height / vp1.width)
              const scale = (width / vp1.width) * Math.min(window.devicePixelRatio || 1, 2)
              const vp = page.getViewport({ scale })
              canvas.width = vp.width
              canvas.height = vp.height
              const task = page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp })
              st.task = task
              await task.promise.catch((e: unknown) => {
                console.warn('pdf page render failed', pageNo, e)
              })
              st.task = null
            } catch (e) {
              console.warn('pdf page setup failed', pageNo, e)
              st.rendered = false
            }
          })()
        } else if (!e.isIntersecting && st.rendered) {
          st.task?.cancel()
          st.task = null
          canvas.width = 0
          canvas.height = 0
          st.rendered = false
        }
      },
      { rootMargin: '150% 0px' },
    )
    obs.observe(holder)
    return () => {
      alive = false
      obs.disconnect()
      st.task?.cancel()
    }
  }, [doc, pageNo, width])

  return (
    <div ref={holderRef} className="pdf-page" style={{ aspectRatio: `1 / ${aspect}` }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      <div className="pdf-page-no">{pageNo}</div>
    </div>
  )
}

export function PdfViewer({ drawingId }: { drawingId: string }) {
  const s = useAppState()
  const ui = useUi()
  const p = activeProject(s)
  const ds = p.drawings.find((d) => d.id === drawingId)
  const [url, setUrl] = useState<string | null>(null)
  const [isImage, setIsImage] = useState(false)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [failed, setFailed] = useState(false)
  const [pageWidth, setPageWidth] = useState(402)
  const rootRef = useRef<HTMLDivElement>(null)
  const springRef = useRef<Spring | null>(null)

  // enters from the bottom; dismisses back the way it came (spatial consistency)
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    setPageWidth(el.clientWidth)
    if (prefersReducedMotion()) return
    const h = el.offsetHeight || 800
    const spring = createSpring(h, (y) => {
      el.style.transform = `translateY(${y}px)`
    })
    springRef.current = spring
    el.style.transform = `translateY(${h}px)`
    spring.to(0, { damping: 1, response: 0.35 })
  }, [])

  const dismiss = () => {
    const el = rootRef.current
    const spring = springRef.current
    if (!el || !spring || prefersReducedMotion()) {
      ui.pop()
      return
    }
    spring.to(el.offsetHeight || 800, { damping: 1, response: 0.3 }, () => ui.pop())
  }

  useEffect(() => {
    let alive = true
    let objectUrl: string | null = null
    let loadedDoc: PDFDocumentProxy | null = null
    if (!ds) return

    const image = ds.src.kind === 'uploaded' && ds.src.mime.startsWith('image/')
    setIsImage(image)
    setDoc(null)
    setFailed(false)

    void (async () => {
      try {
        if (ds.src.kind === 'bundled') {
          setUrl(assetUrl(ds.src.url))
        } else {
          const src = ds.src
          const blob = (await fileGet(src.blobId)) ?? (await fetchRemoteBlob(src.blobId, 'files'))
          if (!blob || !alive) return
          objectUrl = URL.createObjectURL(blob)
          setUrl(objectUrl)
        }
        if (image) return
        const pdfjs = await import('pdfjs-dist')
        const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
        let task
        if (ds.src.kind === 'bundled') {
          task = pdfjs.getDocument({ url: assetUrl(ds.src.url) })
        } else {
          const src = ds.src
          const blob = (await fileGet(src.blobId)) ?? (await fetchRemoteBlob(src.blobId, 'files'))
          if (!blob) throw new Error('file missing')
          task = pdfjs.getDocument({ data: await blob.arrayBuffer() })
        }
        loadedDoc = await task.promise
        if (alive) setDoc(loadedDoc)
      } catch {
        if (alive) setFailed(true)
      }
    })()

    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      void (loadedDoc as unknown as { destroy?: () => Promise<void> } | null)?.destroy?.()?.catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawingId])

  if (!ds) return null

  return (
    <div className="viewer" ref={rootRef}>
      <div className="viewer-head">
        <button className="back-chevron" onClick={dismiss} aria-label="Back">
          <ChevronLeft size={22} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ds.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
            {doc ? `${doc.numPages} page${doc.numPages === 1 ? '' : 's'}` : `${ds.pages} page${ds.pages === 1 ? '' : 's'}`}
          </div>
        </div>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--teal)', display: 'flex' }} aria-label="Open in new tab">
            <ExternalLink size={18} />
          </a>
        )}
      </div>

      {isImage ? (
        url ? (
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
            <img src={url} alt={ds.name} style={{ maxWidth: '100%', height: 'auto' }} />
          </div>
        ) : (
          <div className="viewer-loading">Loading…</div>
        )
      ) : doc ? (
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 0', WebkitOverflowScrolling: 'touch' }}>
          {Array.from({ length: doc.numPages }, (_, i) => (
            <PdfPage key={i + 1} doc={doc} pageNo={i + 1} width={pageWidth} />
          ))}
        </div>
      ) : failed && url ? (
        // last-resort fallback for environments where pdf.js can't run
        <iframe src={url} title={ds.name} />
      ) : (
        <div className="viewer-loading">Loading drawing…</div>
      )}
    </div>
  )
}
