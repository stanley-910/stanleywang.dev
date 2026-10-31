// Birds in the day sky (design/circadian-meadow/components/Bird), the day's counterpart to the
// night's shooting stars. Now and then by day a small bird crosses the sky at about one height,
// flapping and gliding, and leaves by the far side; a click on the sky sends one through the
// clicked point. Drawn on the main thread in the sky pass (ascii.ts); never rasterised.

import { clamp } from './math'
import { mix, type Palette, type Rgb } from './palette'
import { code } from './typeset'

const BODY_UP = code('v')
const BODY_DOWN = code('^')
const HIGH_R = code('`')
const HIGH_L = code("'")
const MID = code('-')
const STEEP_R = code('\\')
const STEEP_L = code('/')
const LOW = code('.')

/** Birds come while the palette's `night` is under this: about 06:45 to 19:00. */
export const BY_DAY = 0.3
/** The visit's first bird, then the gap between them, in s. */
const FIRST = [6, 16]
const GAP = [25, 60]
const MAX_ALIVE = 2
/** Clicks may have up to `MAX_CALLED` flying, `CALL_GAP` s apart. */
const MAX_CALLED = 3
const CALL_GAP = 0.5
/** A clicked bird fades in this far behind the click, as a share of the width, over `FADE_IN` s. */
const LEAD = 0.1
const FADE_IN = 0.4
/** One bird in this many brings a second. */
const PAIR_ODDS = 4
/** Wingbeats a second while flapping. */
const BEAT = 3
/** How far the height drifts over a crossing, in rows. */
const DRIFT = 0.6
const STRENGTH = 1
/**
 * How strongly the body and the wings shade their tiles, so the bird keeps its weight at the
 * scene's small cells instead of thinning to a stroke.
 */
const TILE = 0.45
const WING_TILE = 0.22

/** Where birds may fly this frame, in scene px: the scene's size, its cells and the height band. */
export type Sky = {
  W: number
  H: number
  cw: number
  ch: number
  top: number
  bottom: number
}

type Bird = {
  x0: number
  y: number
  /** Signed, px/s. */
  v: number
  born: number
  /** Time until it's a wingspan past the far edge. */
  cross: number
  /** Seconds it takes to fade in: 0 for one that flies in from the edge. */
  fade: number
  span: number
  flap: number
  glide: number
  phase: number
  drift: number
}

const between = ([lo, hi]: number[]) => lo + (hi - lo) * Math.random()
const spanFor = (sky: Sky) => clamp(0.009 * sky.W, 12, 20)

/** Wing angle above horizontal, in radians: a few beats, then a glide with the wings held in a shallow v. */
const wingAt = (b: Bird, t: number) => {
  const u = (t + b.phase) % (b.flap + b.glide)
  return u < b.flap ? 0.15 + 0.65 * Math.sin(2 * Math.PI * BEAT * u) : 0.45
}

export class Birds {
  /** Per cell, this frame: strength, glyph code and tile shade. Strength 0 is no bird. */
  alpha = new Float32Array(0)
  glyph = new Uint8Array(0)
  tile = new Float32Array(0)
  /** This frame's ink, the same for every bird. */
  col: Rgb = [0, 0, 0]
  private touched: number[] = []
  private list: Bird[] = []
  private cols = 0
  private rows = 0
  private cw = 5
  private ch = 7
  /** When the next bird comes on its own; -1 until the day starts. */
  private nextAt = -1
  private lastCall = -Infinity

  get alive() {
    return this.list.length > 0
  }

  resize(cols: number, rows: number) {
    this.cols = cols
    this.rows = rows
    const n = cols * rows
    this.alpha = new Float32Array(n)
    this.glyph = new Uint8Array(n)
    this.tile = new Float32Array(n)
    this.touched = []
    this.list = []
  }

  clear() {
    this.list = []
    this.nextAt = -1
    for (const i of this.touched) this.alpha[i] = 0
    this.touched = []
  }

  /** Sends a bird on its own now and then, at `now` s. `sky` null (night, or reduced motion) sends none; any already flying finish. */
  fly(now: number, sky: Sky | null) {
    if (!sky) {
      this.nextAt = -1
      return
    }
    this.cw = sky.cw
    this.ch = sky.ch
    if (this.nextAt < 0) this.nextAt = now + between(FIRST)
    if (now < this.nextAt) return
    this.nextAt = now + between(GAP)
    if (this.alive) return
    const dir = Math.random() < 0.5 ? 1 : -1
    const span = spanFor(sky)
    this.spawn(
      sky,
      now,
      between([sky.top, sky.bottom]),
      dir,
      dir > 0 ? -span : sky.W + span,
      0,
    )
  }

  /**
   * A click on open sky at (x, y): a bird fades in a little behind it, flies through it at about
   * its height and on off the wider side. False when the limits drop it.
   */
  call(x: number, y: number, sky: Sky, now: number) {
    if (this.list.length >= MAX_CALLED || now - this.lastCall < CALL_GAP)
      return false
    this.cw = sky.cw
    this.ch = sky.ch
    this.lastCall = now
    this.nextAt = now + between(GAP)
    const dir = x < sky.W / 2 ? 1 : -1
    this.spawn(
      sky,
      now,
      clamp(y, sky.top, sky.bottom),
      dir,
      x - dir * LEAD * sky.W,
      FADE_IN,
    )
    return true
  }

  private spawn(
    sky: Sky,
    now: number,
    y: number,
    dir: number,
    x0: number,
    fade: number,
  ) {
    const speed = clamp(sky.W / 8, 110, 280) * (0.88 + 0.24 * Math.random())
    const span = spanFor(sky)
    const exit = dir > 0 ? sky.W + span : -span
    // Whole beats, so the last ends level and the glide starts without a jump.
    const flap = (2 + Math.floor(3 * Math.random())) / BEAT
    const glide = 0.6 + 0.6 * Math.random()
    const lead: Bird = {
      x0,
      y,
      v: dir * speed,
      born: now,
      cross: Math.abs(exit - x0) / speed,
      fade,
      span,
      flap,
      glide,
      phase: (flap + glide) * Math.random(),
      drift: 2 * Math.PI * Math.random(),
    }
    this.list.push(lead)
    if (this.list.length < MAX_ALIVE && Math.random() < 1 / PAIR_ODDS)
      this.list.push({
        ...lead,
        x0: lead.x0 - dir * 2.5 * span,
        y: Math.min(y + sky.ch, sky.bottom + sky.ch),
        cross: lead.cross + (2.5 * span) / speed,
        phase: lead.phase + 1 / (3 * BEAT),
      })
  }

  /** Fills this frame's cells at `now` s; drops birds that have left the screen. */
  paint(now: number, p: Palette) {
    for (const i of this.touched) this.alpha[i] = 0
    this.touched = []
    if (!this.list.length) return
    this.col = mix(p.pine, [0, 0, 0], 0.4)
    const { cw, ch } = this
    let a = STRENGTH
    const put = (c: number, r: number, g: number, tile: number) => {
      if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return
      const i = r * this.cols + c
      if (a <= this.alpha[i]) return
      if (this.alpha[i] === 0) this.touched.push(i)
      this.alpha[i] = a
      this.glyph[i] = g
      this.tile[i] = tile * a
    }
    this.list = this.list.filter((b) => {
      const t = now - b.born
      if (t > b.cross) return false
      const x = b.x0 + b.v * t
      const y =
        b.y + DRIFT * ch * Math.sin((2 * Math.PI * t) / b.cross + b.drift)
      a = STRENGTH * (b.fade > 0 ? Math.min(1, t / b.fade) : 1)
      const theta = wingAt(b, t)
      const c0 = Math.floor(x / cw)
      const r0 = Math.floor(y / ch)
      put(c0, r0, theta < -0.2 ? BODY_DOWN : BODY_UP, TILE)
      // Each wing a straight line from the body's centre to its tip, a glyph per column by where
      // the line crosses the column's centre: high, middle or low in the cell.
      const yc = r0 * ch + ch / 2
      const rise = Math.tan(theta)
      const steep = (cw * Math.abs(rise)) / ch > 0.6
      const n = Math.max(1, Math.round((0.5 * b.span * Math.cos(theta)) / cw))
      for (const d of [-1, 1]) {
        // A wing that rises outward on the right, or falls outward on the left, leans like `/`.
        const slash = d > 0 === theta > 0
        for (let j = 1; j <= n; j++) {
          const wy = yc - j * cw * rise
          const r = Math.floor(wy / ch)
          const f = wy / ch - r
          const g =
            f < 0.33
              ? slash
                ? HIGH_L
                : HIGH_R
              : f > 0.66
                ? LOW
                : steep
                  ? slash
                    ? STEEP_L
                    : STEEP_R
                  : MID
          put(c0 + d * j, r, g, WING_TILE)
        }
      }
      return true
    })
  }
}
