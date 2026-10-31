import { Shape } from './raster'

import type { Wind } from './wind'

/**
 * A plant stalk as a chain of hinged segments. Each hinge is an angular spring toward its rest
 * curve, loaded by wind drag on everything above it, the weight of the head, and the cursor.
 * Angles are relative to the parent segment; 0 is straight up and positive bends clockwise.
 */
export class Stem {
  readonly n: number
  readonly rest: Float32Array
  readonly ang: Float32Array
  readonly vel: Float32Array
  /** Joint positions, base first: [x0, y0, ... xn, yn]. */
  readonly pts: Float32Array
  /** Absolute angle of each segment. */
  readonly abs: Float32Array
  private force: Float32Array

  /** Full-grown length in px. */
  length = 100
  /** 0..1 (or a little past 1 for a dandelion stalk lengthening to seed). */
  growth = 1
  baseX = 0
  baseY = 0
  baseAngle = 0
  /** Set when this stem branches off another; the base follows the parent each step. */
  parent: Stem | null = null
  parentJoint = 0
  branchAngle = 0
  stiffness = 1
  /**
   * Each hinge's damping ratio: at 0.35 it sways and rings on in the wind, and near 1 (critical)
   * a bend settles without swinging past.
   */
  damping = 0.35
  drag = 1
  headDrag = 0
  headMass = 0.1
  depth = 0.5

  constructor(n: number) {
    this.n = n
    this.rest = new Float32Array(n)
    this.ang = new Float32Array(n)
    this.vel = new Float32Array(n)
    this.pts = new Float32Array((n + 1) * 2)
    this.abs = new Float32Array(n)
    this.force = new Float32Array(n + 1)
  }

  /** Spread a total bend over the top part of the stem, so the curve sits where a hook or nod does. */
  setCurve(total: number, from: number, lean = 0) {
    const n = this.n
    const start = Math.floor(from * n)
    const span = n - start
    for (let i = 0; i < n; i++) {
      const t = i < start ? 0 : (i - start + 1) / span
      this.rest[i] =
        (i < start ? 0 : (total * 2 * t) / (span + 1)) + (i === 0 ? lean : 0)
    }
  }

  layout() {
    const { n, pts, abs, ang } = this
    if (this.parent) {
      const p = this.parent
      const j = Math.min(this.parentJoint, p.n)
      this.baseX = p.pts[j * 2]
      this.baseY = p.pts[j * 2 + 1]
      this.baseAngle = p.abs[Math.min(j, p.n - 1)] + this.branchAngle
    }
    const seg = (this.length * Math.max(0.001, this.growth)) / n
    let a = this.baseAngle
    let x = this.baseX
    let y = this.baseY
    pts[0] = x
    pts[1] = y
    for (let i = 0; i < n; i++) {
      a += ang[i]
      abs[i] = a
      x += Math.sin(a) * seg
      y -= Math.cos(a) * seg
      pts[(i + 1) * 2] = x
      pts[(i + 1) * 2 + 1] = y
    }
  }

  step(dt: number, wind: Wind, push = 1) {
    const { n, pts, force, rest, ang, vel } = this
    this.layout()
    const L = Math.max(8, this.length * this.growth)
    for (let j = 1; j <= n; j++) {
      const x = pts[j * 2]
      const y = pts[j * 2 + 1]
      force[j] =
        (this.drag / n) * wind.at(x, y, this.depth) +
        (0.7 * push * wind.push(x, y)) / n
    }
    const hx = pts[n * 2]
    const hy = pts[n * 2 + 1]
    force[n] +=
      this.headDrag * wind.at(hx, hy, this.depth) +
      0.35 * push * wind.push(hx, hy)

    for (let i = 0; i < n; i++) {
      const xi = pts[i * 2]
      const yi = pts[i * 2 + 1]
      let torque = 0
      for (let j = i + 1; j <= n; j++)
        torque += (force[j] * (yi - pts[j * 2 + 1])) / L
      torque += (this.headMass * (hx - xi)) / L
      const rem = (n - i) / n
      const inertia = 0.012 + rem * rem * (0.22 * rem + this.headMass)
      const k = this.stiffness * 6 * (1 - 0.5 * (i / n))
      const c = 2 * this.damping * Math.sqrt(k * inertia)
      const acc = (k * (rest[i] - ang[i]) + torque - c * vel[i]) / inertia
      vel[i] += acc * dt
      ang[i] += vel[i] * dt
    }
    this.layout()
  }

  /**
   * Pulls each hinge a share `k` of the way to its rest angle and drains as much of its swing.
   * At 1 the stem is its rest curve exactly: nothing to lag behind or overshoot.
   */
  hold(k: number) {
    const { n, rest, ang, vel } = this
    for (let i = 0; i < n; i++) {
      ang[i] += (rest[i] - ang[i]) * k
      vel[i] *= 1 - k
    }
    this.layout()
  }

  tipX() {
    return this.pts[this.n * 2]
  }
  tipY() {
    return this.pts[this.n * 2 + 1]
  }
  tipAngle() {
    return this.abs[this.n - 1]
  }
  /** Angular speed at the tip, for seed heads that shake out when tossed. */
  tipSpeed() {
    let s = 0
    for (let i = 0; i < this.n; i++) s += this.vel[i]
    return Math.abs(s)
  }

  path() {
    const p = new Shape()
    const { pts, n } = this
    p.moveTo(pts[0], pts[1])
    for (let i = 1; i < n; i++) {
      const mx = (pts[i * 2] + pts[(i + 1) * 2]) / 2
      const my = (pts[i * 2 + 1] + pts[(i + 1) * 2 + 1]) / 2
      p.quadraticCurveTo(pts[i * 2], pts[i * 2 + 1], mx, my)
    }
    p.lineTo(pts[n * 2], pts[n * 2 + 1])
    return p
  }
}
