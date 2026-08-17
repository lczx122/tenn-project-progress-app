// Bottom sheet with fluid, gesture-driven dismissal.
//
// Feel checklist (see design notes): springs animate from the live value so the
// sheet can be grabbed mid-flight; the grabber tracks the finger 1:1 with the
// grab offset respected; dragging above rest rubber-bands; release projects
// momentum to decide settle-vs-dismiss and hands the finger's velocity to the
// spring; the scrim opacity follows the sheet position frame-by-frame.
import { useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { createSpring, prefersReducedMotion, project, rubberband, VelocityTracker, type Spring } from '../utils/motion'

interface SheetProps {
  /** Called after the exit animation finishes — unmount the sheet here. */
  onClosed: () => void
  /** Children receive close(): call it instead of unmounting directly. */
  children: (close: () => void) => ReactNode
}

export function Sheet({ onClosed, children }: SheetProps) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const heightRef = useRef(400)
  const springRef = useRef<Spring | null>(null)
  const closingRef = useRef(false)
  const onClosedRef = useRef(onClosed)
  onClosedRef.current = onClosed

  const apply = (y: number) => {
    const h = heightRef.current
    if (panelRef.current) panelRef.current.style.transform = `translateY(${y}px)`
    if (backdropRef.current) backdropRef.current.style.opacity = String(Math.max(0, Math.min(1, 1 - y / h)))
  }

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    heightRef.current = panel.offsetHeight + 24
    if (prefersReducedMotion()) {
      apply(0)
      panel.style.transition = 'opacity 180ms ease'
      return
    }
    const spring = createSpring(heightRef.current, apply)
    springRef.current = spring
    apply(heightRef.current)
    spring.to(0, { damping: 1, response: 0.35 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = () => {
    if (closingRef.current) return
    closingRef.current = true
    const panel = panelRef.current
    if (prefersReducedMotion() || !springRef.current) {
      if (panel) panel.style.opacity = '0'
      if (backdropRef.current) backdropRef.current.style.opacity = '0'
      setTimeout(() => onClosedRef.current(), 180)
      return
    }
    springRef.current.to(heightRef.current, { damping: 1, response: 0.3 }, () => onClosedRef.current())
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onGrabberDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const spring = springRef.current
    if (!spring || prefersReducedMotion()) return
    e.currentTarget.setPointerCapture(e.pointerId)
    // grab the sheet where it is right now — even mid-animation
    spring.stop()
    closingRef.current = false
    const grabY = e.clientY - spring.value // respect the grab offset
    const tracker = new VelocityTracker()
    tracker.add(spring.value)

    const onMove = (ev: globalThis.PointerEvent) => {
      let y = ev.clientY - grabY
      if (y < 0) y = rubberband(y, heightRef.current) // soft boundary above rest
      spring.jump(y)
      tracker.add(y)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      const v = tracker.get()
      const projected = spring.value + project(v) // decide from where it's *going*
      if (v > 600 || projected > heightRef.current * 0.5) {
        closingRef.current = true
        spring.to(heightRef.current, { damping: 1, response: 0.35, velocity: v }, () => onClosedRef.current())
      } else {
        // momentum was present → a little bounce is honest
        spring.to(0, { damping: 0.8, response: 0.3, velocity: v })
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  // Portal to the app-frame overlay root: screens live inside transformed
  // layers (stacking contexts), so an in-place sheet could never stack above
  // the tab bar.
  return createPortal(
    <div className="sheet-backdrop" ref={backdropRef} onClick={close}>
      <div className="sheet" ref={panelRef} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" onPointerDown={onGrabberDown}>
          <div className="sheet-grabber" />
        </div>
        {children(close)}
      </div>
    </div>,
    document.getElementById('overlay-root') ?? document.body,
  )
}
