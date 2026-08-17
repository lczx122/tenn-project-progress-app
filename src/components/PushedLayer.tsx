// A pushed navigation layer: spring slide-in from the right, edge-swipe back
// with 1:1 tracking, momentum projection on release, and parallax on the layer
// beneath. Enter and exit share the same path (spatial consistency).
import { useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createSpring, prefersReducedMotion, project, rubberband, VelocityTracker, type Spring } from '../utils/motion'

const EDGE = 28 // px from the left edge where the back-swipe can start
const PARALLAX = 0.3

interface Props {
  exiting: boolean
  /** The element visually beneath this layer (for parallax). */
  getBelow: () => HTMLElement | null
  /** Pop the stack (user committed a back-swipe). */
  onPop: () => void
  /** Exit animation finished — remove from the display stack. */
  onExited: () => void
  children: ReactNode
}

export function PushedLayer({ exiting, getBelow, onPop, onExited, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const widthRef = useRef(400)
  const springRef = useRef<Spring | null>(null)
  const poppingRef = useRef(false)
  const cb = useRef({ getBelow, onPop, onExited })
  cb.current = { getBelow, onPop, onExited }

  const apply = (x: number) => {
    const el = ref.current
    if (el) el.style.transform = `translateX(${x}px)`
    const below = cb.current.getBelow()
    if (below) {
      const progress = 1 - Math.min(1, Math.max(0, x / widthRef.current))
      below.style.transform = `translateX(${(-PARALLAX * 100 * progress).toFixed(2)}%)`
    }
  }

  // enter
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    widthRef.current = el.offsetWidth || 400
    if (prefersReducedMotion()) {
      apply(0)
      return
    }
    const spring = createSpring(widthRef.current, apply)
    springRef.current = spring
    apply(widthRef.current)
    spring.to(0, { damping: 1, response: 0.35 })
    return () => {
      const below = cb.current.getBelow()
      if (below) below.style.transform = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // exit
  useLayoutEffect(() => {
    if (!exiting) return
    const spring = springRef.current
    if (prefersReducedMotion() || !spring) {
      apply(widthRef.current)
      cb.current.onExited()
      return
    }
    spring.to(widthRef.current, { damping: 1, response: 0.3 }, () => cb.current.onExited())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exiting])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current
    const spring = springRef.current
    if (!el || !spring || exiting || prefersReducedMotion()) return
    const rect = el.getBoundingClientRect()
    if (e.clientX - rect.left > EDGE + Math.max(0, spring.value)) return

    const startX = e.clientX
    const startY = e.clientY
    const grabOffset = e.clientX - spring.value
    let committed = false
    const tracker = new VelocityTracker()
    tracker.add(spring.value)

    const onMove = (ev: globalThis.PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!committed) {
        if (Math.abs(dx) < 8) return // hysteresis before committing to the gesture
        if (Math.abs(dy) > Math.abs(dx)) {
          cleanup()
          return // it's a scroll, not a back-swipe
        }
        committed = true
        spring.stop()
        el.setPointerCapture(ev.pointerId)
      }
      let x = ev.clientX - grabOffset
      if (x < 0) x = rubberband(x, widthRef.current)
      spring.jump(x)
      tracker.add(x)
    }
    const onUp = () => {
      cleanup()
      if (!committed) return
      const v = tracker.get()
      const projected = spring.value + project(v)
      if (projected > widthRef.current / 2) {
        poppingRef.current = true
        spring.to(widthRef.current, { damping: 1, response: 0.35, velocity: v }, () => {
          cb.current.onPop()
          cb.current.onExited()
        })
      } else {
        spring.to(0, { damping: 0.8, response: 0.3, velocity: v })
      }
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  return (
    <div className={`pushed-layer ${prefersReducedMotion() && exiting ? 'rm-exit' : ''}`} ref={ref} onPointerDown={onPointerDown}>
      {children}
    </div>
  )
}
