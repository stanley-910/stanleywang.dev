import { clamp, fbm1, noise1 } from './math'

export type Pointer = {
  x: number
  y: number
  vx: number
  vy: number
  active: boolean
  /** Held down: only then does the cursor stir the plants. Hovering leaves them to the wind. */
  pressed: boolean
}

/** Where gusts level off, in the same units as the gust (before strength). */
const GUST_CAP = 0.45

/**
 * Wind over a meadow arrives in gusts that roll across it as visible waves (the "honami" of a
 * rice field). Here a slow base breeze carries travelling fbm gusts, and the cursor stirs a
 * local wake behind it.
 */
export class Wind {
  /** User-set strength multiplier. */
  strength = 1
  /** A small push either way, varying along the meadow and over time: rain's unsteady air. */
  unsteady = 0
  time = 0
  width = 1
  pointer: Pointer = {
    x: -9999,
    y: -9999,
    vx: 0,
    vy: 0,
    active: false,
    pressed: false,
  }
  /** Gust speed across the screen, px/s. */
  readonly travel = 170

  step(dt: number) {
    this.time += dt
    const p = this.pointer
    // The wake decays once the cursor stops.
    p.vx *= Math.exp(-dt * 5)
    p.vy *= Math.exp(-dt * 5)
  }

  /** Steady breeze, swelling and easing over tens of seconds. */
  base() {
    return this.strength * (0.35 + 0.25 * noise1(this.time * 0.045, 3))
  }

  /** Horizontal wind at (x, y) in roughly -2..2. Positive pushes right. */
  at(x: number, y: number, depth = 0.5) {
    const t = this.time
    const s = this.strength
    // Gust fronts travel left to right; nearer rows are hit slightly later.
    const phase = (x - t * this.travel) / 420 + depth * 0.8
    const gust = Math.max(0, fbm1(phase, 11) * 1.7 + 0.15) ** 1.6
    const envelope = 0.55 + 0.45 * noise1(t * 0.07, 5)
    const flutter = 0.12 * noise1(x * 0.02 + t * 2.3, 9)
    // A soft ceiling on each gust, so it still rolls across as a wave but never shoves a stem
    // flat: uncapped, the strongest bent a cosmos 40° and laid its head on the bio.
    const g = gust * envelope * 1.25
    let w = this.base() + s * (GUST_CAP * Math.tanh(g / GUST_CAP) + flutter)
    if (this.unsteady) w += this.unsteady * noise1(x * 0.012 + t * 1.3, 17)

    const p = this.pointer
    if (p.active && p.pressed) {
      const dx = x - p.x
      const dy = y - p.y
      const d2 = dx * dx + dy * dy * 0.6
      const r = 130
      if (d2 < r * r * 4) {
        const k = Math.exp(-d2 / (r * r))
        // A gentle wake: the cursor stirs the meadow, it doesn't blow it flat.
        w += clamp(p.vx / 2200, -0.6, 0.6) * k
      }
    }
    return w
  }

  /** How strongly the cursor shoves a plant point sideways, by distance. */
  push(x: number, y: number) {
    const p = this.pointer
    if (!p.active || !p.pressed) return 0
    const dx = x - p.x
    const dy = y - p.y
    const r = 46
    const d2 = dx * dx + dy * dy
    if (d2 > r * r * 4) return 0
    const k = Math.exp(-d2 / (r * r))
    // Leans away smoothly through zero, so a cursor resting on a stem doesn't flip it side to
    // side, and only as it moves: a still press leaves plants be, a moving one brushes them.
    const speed = Math.min(1, Math.hypot(p.vx, p.vy) / 800)
    return Math.tanh(dx / (r * 0.5)) * k * 0.3 * speed
  }
}
