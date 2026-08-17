// Fluid-motion toolkit (after Apple's "Designing Fluid Interfaces", WWDC 2018).
//
// - Springs parameterized by damping ratio + response (not mass/stiffness),
//   always animating from the current value & velocity → interruptible by design.
// - Velocity tracking for gestures, momentum projection for flicks,
//   rubber-banding for soft boundaries.

export interface SpringOpts {
  /** 1.0 = critically damped (no overshoot); ~0.8 = slight bounce for momentum interactions */
  damping?: number
  /** How quickly the value heads to the target, in seconds. Not a duration. */
  response?: number
  /** Initial velocity handoff from a gesture, in units/s */
  velocity?: number
}

export interface Spring {
  readonly value: number
  readonly velocity: number
  /** Retarget. Starts from the *current* value & velocity — never jumps. */
  to(target: number, opts?: SpringOpts, onSettle?: () => void): void
  /** Jump without animating. */
  jump(value: number): void
  /** Freeze at the current value (used when a gesture grabs the element). */
  stop(): void
}

export function createSpring(initial: number, onUpdate: (v: number) => void): Spring {
  let value = initial
  let velocity = 0
  let target = initial
  let zeta = 1
  let omega = (2 * Math.PI) / 0.35
  let raf = 0
  let last = 0
  let settleCb: (() => void) | null = null

  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 1 / 30)
    last = now
    // semi-implicit Euler on a damped harmonic oscillator (mass = 1)
    const accel = -omega * omega * (value - target) - 2 * zeta * omega * velocity
    velocity += accel * dt
    value += velocity * dt
    if (Math.abs(value - target) < 0.5 && Math.abs(velocity) < 20) {
      value = target
      velocity = 0
      onUpdate(value)
      raf = 0
      const cb = settleCb
      settleCb = null
      cb?.()
      return
    }
    onUpdate(value)
    raf = requestAnimationFrame(frame)
  }

  return {
    get value() {
      return value
    },
    get velocity() {
      return velocity
    },
    to(t, opts, onSettle) {
      target = t
      zeta = opts?.damping ?? 1
      omega = (2 * Math.PI) / (opts?.response ?? 0.35)
      if (opts?.velocity !== undefined) velocity = opts.velocity
      settleCb = onSettle ?? null
      if (!raf) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    },
    jump(v) {
      value = v
      target = v
      velocity = 0
      settleCb = null
      if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      onUpdate(value)
    },
    stop() {
      target = value
      velocity = 0
      settleCb = null
      if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    },
  }
}

/** Velocity from the last ~100ms of pointer samples, in px/s. */
export class VelocityTracker {
  private samples: { p: number; t: number }[] = []

  add(p: number) {
    const t = performance.now()
    this.samples.push({ p, t })
    while (this.samples.length > 2 && t - this.samples[0].t > 100) this.samples.shift()
  }

  get(): number {
    if (this.samples.length < 2) return 0
    const a = this.samples[0]
    const b = this.samples[this.samples.length - 1]
    const dt = (b.t - a.t) / 1000
    return dt > 0 ? (b.p - a.p) / dt : 0
  }

  reset() {
    this.samples = []
  }
}

/** Where a flick would coast to (Apple's exponential-decay projection). */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)
}

/** Progressive resistance past a boundary — real things slow before they stop. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

const rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
export function prefersReducedMotion(): boolean {
  return rmQuery.matches
}

/** Haptic tick for meaningful moments only (submit, snap, complete). */
export function haptic(pattern: number | number[] = 10) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // unsupported — fine
  }
}
