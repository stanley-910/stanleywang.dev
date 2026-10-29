// Shooting stars on the night sky (design/circadian-meadow/components/ShootingStar). A click on
// open sky after dark makes a short streak that cuts through the clicked point and cuts out, its
// tail fading back along the path. Now and then one is a fireball, which glints on the ridges
// near its head. Drawn on the main thread in the sky pass (ascii.ts); never rasterised.

import { clamp, smoothstep } from './math'
import { mix, type Palette, type Rgb } from './palette'
import { code } from './typeset'

const HEAD = code('*')
const SPARK = code('·')
const HIGH_R = code('`')
const HIGH_L = code("'")
const MID = code('-')
const STEEP_R = code('\\')
const STEEP_L = code('/')
const LOW = code('.')

/** Below horizontal, the shallowest and steepest a streak falls. */
const MIN_ANGLE = (18 * Math.PI) / 180
const MAX_ANGLE = (50 * Math.PI) / 180
/** How far along its path a streak passes the clicked point. */
const AT_CLICK = 0.4
const FADED = 0.06
const MAX_ALIVE = 3
const SPACING = 0.12
/** A fireball comes one click in this many, and never sooner than `FIRE_GAP` s after the last. */
const FIRE_ODDS = 6
const FIRE_GAP = 6
const FLARE = 0.08
/** The glint fades out over this long after a fireball cuts. */
const GLINT_OUT = 0.15
/** A still streak, for reduced motion, holds this long. */
export const STILL_FOR = 0.8

type Cell = { c: number; r: number; u: number; g: number }

type Streak = {
  cells: Cell[]
  born: number
  run: number
  tau: number
  fire: boolean
  still: boolean
  x0: number
  y0: number
  dx: number
  dy: number
  len: number
}

/** Light a fireball throws on the ridges this frame: where its head is, how strong, what colour. */
export type Glint = { x: number; y: number; k: number; col: Rgb }

/** Strength along the path: it flares into being and brightens as it falls. */
const along = (u: number) => smoothstep(0, 0.15, u) * (0.75 + 0.25 * u)

export class Meteors {
  /** Per cell, this frame: strength, glyph code and colour. Strength 0 is no streak. */
  alpha = new Float32Array(0)
  glyph = new Uint8Array(0)
  rgb = new Float32Array(0)
  glint: Glint | null = null
  private touched: number[] = []
  private list: Streak[] = []
  private cols = 0
  private rows = 0
  /** Where the visit's shower falls from, as a fraction of the width. */
  private radiant = 0.2 + 0.6 * Math.random()
  private lastSpawn = -Infinity
  private lastFire = -Infinity

  get alive() {
    return this.list.length > 0
  }

  resize(cols: number, rows: number) {
    this.cols = cols
    this.rows = rows
    const n = cols * rows
    this.alpha = new Float32Array(n)
    this.glyph = new Uint8Array(n)
    this.rgb = new Float32Array(n * 3)
    this.touched = []
    this.list = []
  }

  clear() {
    this.list = []
    this.glint = null
    for (const i of this.touched) this.alpha[i] = 0
    this.touched = []
  }

  /**
   * A streak through (x, y) in a W×H scene with cw×ch cells, at `now` s. False when the limits
   * drop it. `still` (reduced motion) makes one whole, unmoving streak in place of any others.
   */
  spawn(
    x: number,
    y: number,
    W: number,
    H: number,
    cw: number,
    ch: number,
    now: number,
    still: boolean,
  ) {
    if (still) this.list = []
    else if (this.list.length >= MAX_ALIVE || now - this.lastSpawn < SPACING)
      return false
    this.lastSpawn = now
    const fire =
      !still && now - this.lastFire >= FIRE_GAP && Math.random() < 1 / FIRE_ODDS
    if (fire) this.lastFire = now
    // Away from the radiant, above the top of the scene, so a run of clicks reads as one shower.
    const rx = W * this.radiant
    const ry = -0.45 * H
    const side = Math.sign(x - rx) || 1
    const angle = clamp(
      Math.atan2(y - ry, Math.abs(x - rx)),
      MIN_ANGLE,
      MAX_ANGLE,
    )
    const dx = side * Math.cos(angle)
    const dy = Math.sin(angle)
    const len = clamp(0.17 * W, 170, 380) * (fire ? 1.35 : 1)
    const x0 = x - AT_CLICK * len * dx
    const y0 = y - AT_CLICK * len * dy
    this.list.push({
      cells: this.trace(x0, y0, dx, dy, len, cw, ch),
      born: now,
      run: fire ? 0.5 + 0.1 * Math.random() : 0.28 + 0.12 * Math.random(),
      tau: fire ? 0.14 : 0.1,
      fire,
      still,
      x0,
      y0,
      dx,
      dy,
      len,
    })
    return true
  }

  /** The cells along a path, half a cell at a time so none is skipped or doubled, each with its glyph. */
  private trace(
    x0: number,
    y0: number,
    dx: number,
    dy: number,
    len: number,
    cw: number,
    ch: number,
  ) {
    const cells: Cell[] = []
    const step = Math.min(cw / Math.abs(dx), ch / Math.abs(dy)) / 2
    const right = dx > 0
    // Rows per column: over 0.6 the line runs as slashes, under it as a staircase.
    const steep = Math.abs(dy) / ch / (Math.abs(dx) / cw) > 0.6
    let last = -1
    for (let s = 0; s <= len; s += step) {
      const c = Math.floor((x0 + dx * s) / cw)
      const r = Math.floor((y0 + dy * s) / ch)
      const key = r * 1e5 + c
      if (key === last) continue
      last = key
      if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue
      // Where the line crosses the cell's centre column: high, middle or low in the cell.
      const yc = y0 + ((c * cw + cw / 2 - x0) / dx) * dy
      const f = (yc - r * ch) / ch
      const g =
        f < 0.33
          ? right
            ? HIGH_R
            : HIGH_L
          : f > 0.66
            ? LOW
            : steep
              ? right
                ? STEEP_R
                : STEEP_L
              : MID
      cells.push({ c, r, u: s / len, g })
    }
    return cells
  }

  /** Fills this frame's cells and glint at `now` s; drops streaks that have faded. */
  paint(now: number, p: Palette, k: number) {
    for (const i of this.touched) this.alpha[i] = 0
    this.touched = []
    this.glint = null
    if (!this.list.length) return
    const B = 0.65 + 0.35 * smoothstep(0.5, 0.9, p.night)
    const head = mix(p.fluff, p.globe, 0.4)
    const ink = (c: Rgb): Rgb => [
      Math.min(255, c[0] * k),
      Math.min(255, c[1] * k),
      Math.min(255, c[2] * k),
    ]
    const put = (c: number, r: number, a: number, g: number, col: Rgb) => {
      if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return
      const i = r * this.cols + c
      if (a <= this.alpha[i]) return
      if (this.alpha[i] === 0) this.touched.push(i)
      this.alpha[i] = a
      this.glyph[i] = g
      this.rgb[i * 3] = col[0]
      this.rgb[i * 3 + 1] = col[1]
      this.rgb[i * 3 + 2] = col[2]
    }
    const headInk = ink(head)
    this.list = this.list.filter((s) => {
      const t = now - s.born
      if (s.still) {
        if (t > STILL_FOR) return false
        const end = s.cells.length - 1
        s.cells.forEach((cell, n) =>
          put(
            cell.c,
            cell.r,
            along(cell.u) * B * (0.35 + 0.65 * cell.u),
            n === end ? HEAD : cell.g,
            headInk,
          ),
        )
        return true
      }
      if (t > s.run + 6 * s.tau) return false
      const uNow = t / s.run
      const burning = uNow < 1
      const flaring = s.fire && burning && t > s.run - FLARE
      let lead: Cell | null = null
      for (const cell of s.cells) {
        if (cell.u > uNow) break
        lead = cell
        const fade = Math.exp(-(t - cell.u * s.run) / s.tau)
        const a = along(cell.u) * B * fade
        if (a >= FADED)
          put(cell.c, cell.r, a, cell.g, ink(mix(head, p.cloud, 1 - fade)))
      }
      if (burning && lead) {
        const a = along(uNow) * B
        put(lead.c, lead.r, a, HEAD, headInk)
        if (flaring)
          for (const [dc, dr] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ])
            put(lead.c + dc, lead.r + dr, 0.5 * a, SPARK, headInk)
      }
      if (s.fire) {
        const after = t - s.run
        const glow = flaring
          ? 0.45
          : burning
            ? 0.3 * along(uNow) * B
            : after < GLINT_OUT
              ? 0.45 * (1 - after / GLINT_OUT)
              : 0
        const d = s.len * Math.min(1, uNow)
        if (glow > 0 && (!this.glint || glow > this.glint.k))
          this.glint = {
            x: s.x0 + s.dx * d,
            y: s.y0 + s.dy * d,
            k: glow,
            col: headInk,
          }
      }
      return true
    })
  }
}
