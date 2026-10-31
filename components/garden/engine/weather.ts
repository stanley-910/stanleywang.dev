// The meadow's weather (design/circadian-meadow/components/Terminal, Meadow effects): rain, snow,
// fog and a gale, set from lib/weather.ts. Falling rain and snow and blown seed are overlay
// glyphs, moved and painted here on the main thread each page draw like the shooting stars, a
// few hundred at most and never one per cell. What changes the land or the sky (an overcast sky,
// fog over the ridges, snow lying) is a palette shift in steps, so the cached backdrop repaints a
// few dozen times over a change rather than every frame. Nothing here touches the grid.

import { clamp, hash, smoothstep } from './math'
import { mix, type Palette, type Rgb } from './palette'
import { code } from './typeset'

import type { Wind } from './wind'
import type { WeatherKind } from '@/lib/weather'

const RAIN_HEAD = code(',')
const RAIN = code('|')
const RAIN_TAIL = code("'")
const SLANT_HEAD = code('\\')
const SLANT_TAIL = code('`')
const SPLASH = code('.')
const FLAKES = [code('.'), code('·'), code('*')]
const SEEDS = [code('~'), code(','), code('.')]

/** Most drops, flakes and seeds in the air at once. */
const DROPS = 560
const FLAKE_COUNT = 520
const SEED_COUNT = 70
/** How long a drop's splash shows, in s. */
const SPLASH_FOR = 0.12

/** How fast each effect comes in and goes, in its share a second. */
const RATES = {
  rain: [1 / 3, 1 / 3],
  snow: [1 / 4, 1 / 4],
  // Fog rolls in over twenty seconds and lifts in eight.
  fog: [1 / 20, 1 / 8],
  gale: [1 / 3, 1 / 3],
  // Snow lies over a minute and melts in twenty seconds.
  cover: [1 / 60, 1 / 20],
} as const
type Effect = keyof typeof RATES

/** Wind strength a full gale adds to the meadow's 0.2 breeze: strong, short of laying heads flat. */
const GALE = 0.9

/** The palette moves in steps of this share, so the backdrop repaints only on a step. */
const steps = (v: number, n: number) => Math.round(v * n) / n

type Drop = {
  x: number
  y: number
  v: number
  z: number
  land: number
  splash: number
}
type Flake = {
  x: number
  y: number
  v: number
  z: number
  land: number
  phase: number
}
type Seed = {
  x: number
  y: number
  v: number
  z: number
  phase: number
  kind: number
}

/** The scene, in scene px, as the page last laid it out. */
export type WeatherView = {
  W: number
  H: number
  cw: number
  ch: number
  horizon: number
}

export class Weather {
  kind: WeatherKind = 'clear'
  /** Each effect's strength now, 0 to 1. */
  private amount: Record<Effect, number> = {
    rain: 0,
    snow: 0,
    fog: 0,
    gale: 0,
    cover: 0,
  }
  /** Per cell, this frame: strength, glyph code and colour. Strength 0 is no particle. */
  alpha = new Float32Array(0)
  glyph = new Uint8Array(0)
  rgb = new Float32Array(0)
  /** Per cell column, this frame: how much a gust band lights the grass. Empty without a gale. */
  band = new Float32Array(0)
  private touched: number[] = []
  private cols = 0
  private rows = 0
  private drops: Drop[] = []
  private flakes: Flake[] = []
  private seeds: Seed[] = []
  private lastPaint = -1
  /** Under reduced motion the weather is a still state: nothing falls or blows. */
  private still = false

  /** Sets the weather; `instant` skips the change, for reduced motion or a meadow coming back. */
  set(kind: WeatherKind, instant = false, still = false) {
    this.kind = kind
    this.still = still
    if (!instant) return
    for (const k of Object.keys(RATES) as Effect[])
      this.amount[k] = this.target(k)
  }

  private target(k: Effect) {
    switch (k) {
      case 'rain':
        return this.kind === 'rain' ? 1 : 0
      case 'snow':
      case 'cover':
        return this.kind === 'snow' ? 1 : 0
      case 'fog':
        return this.kind === 'fog' ? 1 : 0
      case 'gale':
        return this.kind === 'wind' ? 1 : 0
    }
  }

  /** Eases each effect toward the weather's. */
  step(dt: number) {
    for (const k of Object.keys(RATES) as Effect[]) {
      const to = this.target(k)
      const v = this.amount[k]
      if (v === to) continue
      const [up, down] = RATES[k]
      this.amount[k] =
        to > v ? Math.min(to, v + up * dt) : Math.max(to, v - down * dt)
    }
  }

  /** Whether anything is falling or blowing, so the page should draw every display frame. */
  get moving() {
    const a = this.amount
    return !this.still && a.rain + a.snow + a.gale > 0
  }

  /** Whether the weather differs from clear at all, or is still clearing. */
  get any() {
    const a = this.amount
    return a.rain + a.snow + a.fog + a.gale + a.cover > 0
  }

  /** Wind strength the weather adds: a gale, and a little with rain. */
  get gale() {
    return GALE * this.amount.gale + 0.25 * this.amount.rain
  }

  /** Snow lying, in steps about a second apart while it settles. */
  get cover() {
    return steps(this.amount.cover, 60)
  }

  /** The hour's palette under this weather: an overcast sky, fog over the ridges, snow lying. */
  tint(p: Palette): Palette {
    const a = this.amount
    const grey = steps(Math.max(a.rain, 0.7 * a.snow), 12)
    const fog = steps(a.fog, 16)
    const cover = this.cover
    if (grey + fog + cover === 0) return p
    const out = { ...p }
    const mist = mix(p.haze, p.skyHorizon, 0.35)
    // Rain and snow clouds: the haze in the ridges' shadow, so falling light marks read on them.
    const overcast = mix(p.haze, p.hillNear, 0.45)
    out.skyTop = mix(mix(p.skyTop, overcast, 0.55 * grey), p.haze, 0.3 * fog)
    out.skyHorizon = mix(
      mix(p.skyHorizon, overcast, 0.35 * grey),
      mist,
      0.6 * fog,
    )
    out.cloud = mix(p.cloud, overcast, 0.3 * grey)
    out.haze = mix(p.haze, mist, fog)
    // Far ridges first, then the near one.
    out.hillFar = mix(p.hillFar, out.skyHorizon, 0.2 * grey + 0.75 * fog)
    out.hillNear = mix(p.hillNear, out.skyHorizon, 0.08 * grey + 0.4 * fog)
    out.pine = mix(p.pine, out.skyHorizon, 0.6 * fog)
    if (cover > 0) {
      // A pale cover on the ground and the near ridge; the grass's tips take it most.
      out.hillNear = mix(out.hillNear, p.snowShade, 0.45 * cover)
      out.ground = mix(p.ground, p.snowShade, 0.28 * cover)
      out.grassDark = mix(p.grassDark, p.snowShade, 0.35 * cover)
      out.grassLight = mix(p.grassLight, p.snow, 0.5 * cover)
      out.stem = mix(p.stem, p.snowShade, 0.2 * cover)
    }
    return out
  }

  /** How thick the fog is at height `y`: pooled at the horizon, reaching back to front as it rolls in. */
  fogAt(y: number, horizon: number, H: number) {
    const f = this.amount.fog
    if (f <= 0) return 0
    if (y < horizon) {
      const up = (horizon - y) / Math.max(1, horizon)
      // It climbs the ridges as it thickens, so the far range goes before the near one.
      return 0.85 * f * (1 - smoothstep(0.1 * f, 0.8 * f, up))
    }
    // The front of the meadow stays clear.
    const into = (y - horizon) / Math.max(1, H - horizon)
    return 0.8 * smoothstep(0, 0.3, 0.75 * f - into)
  }

  resize(cols: number, rows: number) {
    this.cols = cols
    this.rows = rows
    const n = cols * rows
    this.alpha = new Float32Array(n)
    this.glyph = new Uint8Array(n)
    this.rgb = new Float32Array(n * 3)
    this.band = new Float32Array(cols)
    this.touched = []
    this.drops = []
    this.flakes = []
    this.seeds = []
  }

  private plot(
    c: number,
    r: number,
    g: number,
    a: number,
    col: Rgb,
    k: number,
  ) {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return
    const i = r * this.cols + c
    if (a <= this.alpha[i]) return
    if (this.alpha[i] === 0) this.touched.push(i)
    this.alpha[i] = a
    this.glyph[i] = g
    this.rgb[i * 3] = Math.min(255, col[0] * k)
    this.rgb[i * 3 + 1] = Math.min(255, col[1] * k)
    this.rgb[i * 3 + 2] = Math.min(255, col[2] * k)
  }

  /** Where a drop or flake comes down: mostly on the meadow, some on the near ridges. */
  private landing(v: WeatherView) {
    const top = 0.9 * v.horizon
    return top + (v.H - top) * Math.sqrt(Math.random())
  }

  /** Moves everything in the air to `now` (s) and lays it into the cells. */
  paint(now: number, p: Palette, wind: Wind, v: WeatherView) {
    for (const i of this.touched) this.alpha[i] = 0
    this.touched = []
    const dt = this.lastPaint < 0 ? 0 : clamp(now - this.lastPaint, 0, 0.1)
    this.lastPaint = now
    const a = this.amount
    const { W, cw, ch } = v
    const k = p.ink
    const breeze = wind.base()

    // Gust bands roll through the grass with the wind's own gusts.
    if (a.gale > 0 && !this.still) {
      const s = Math.max(0.01, wind.strength)
      for (let c = 0; c < this.cols; c++) {
        const g =
          (wind.at((c + 0.5) * cw, v.horizon) - wind.base()) / (0.45 * s)
        this.band[c] = a.gale * smoothstep(0.35, 0.95, g)
      }
    } else if (this.band[0] !== 0 || this.band[this.cols - 1] !== 0)
      this.band.fill(0)

    if (this.still || W === 0) return

    // Rain: streaks a few cells long, leaning with the wind, and a dot where each lands.
    const rainN = Math.round(DROPS * a.rain)
    if (rainN > 0 || this.drops.length) {
      const slant = clamp(0.1 + 0.3 * breeze, 0.08, 0.8)
      while (this.drops.length < DROPS) {
        const d: Drop = { x: 0, y: 0, v: 0, z: 0, land: 0, splash: 0 }
        this.dropFrom(d, v, slant)
        d.y = Math.random() * d.land
        this.drops.push(d)
      }
      const col = mix(p.fluff, p.snow, 0.5)
      const [head, body, tail] =
        slant < 0.3
          ? [RAIN_HEAD, RAIN, RAIN_TAIL]
          : [SLANT_HEAD, SLANT_HEAD, SLANT_TAIL]
      for (let n = 0; n < this.drops.length; n++) {
        const d = this.drops[n]
        if (d.splash > 0) {
          d.splash -= dt
          if (d.splash <= 0) this.dropFrom(d, v, slant)
        } else {
          d.y += d.v * dt
          d.x += d.v * slant * dt
          if (d.y >= d.land) {
            d.y = d.land
            d.splash = SPLASH_FOR
          }
        }
        if (n >= rainN) continue
        const c = Math.floor(d.x / cw)
        const r = Math.floor(d.y / ch)
        const s = 0.7 + 0.3 * d.z
        if (d.splash > 0) {
          this.plot(c, r, SPLASH, s * 0.8, col, k)
          continue
        }
        // Nearer drops fall longer streaks; the tail fades back up the path.
        const len = 4 + Math.round(4 * d.z)
        for (let j = 0; j < len; j++) {
          const g = j === 0 ? head : j === len - 1 ? tail : body
          this.plot(
            Math.floor((d.x - slant * ch * j) / cw),
            r - j,
            g,
            s * (1 - (0.5 * j) / len),
            col,
            k,
          )
        }
      }
      if (rainN === 0) this.drops = []
    }

    // Snow: flakes drift down and sway, the nearer ones bigger and quicker.
    const snowN = Math.round(FLAKE_COUNT * a.snow)
    if (snowN > 0 || this.flakes.length) {
      while (this.flakes.length < FLAKE_COUNT) {
        const f: Flake = { x: 0, y: 0, v: 0, z: 0, land: 0, phase: 0 }
        this.flakeFrom(f, v)
        f.y = Math.random() * f.land
        this.flakes.push(f)
      }
      for (let n = 0; n < this.flakes.length; n++) {
        const f = this.flakes[n]
        f.y += f.v * dt
        f.x +=
          (30 * breeze + 14 * Math.cos(now * 0.9 + f.phase)) * (0.5 + f.z) * dt
        if (f.y >= f.land) this.flakeFrom(f, v)
        if (n >= snowN) continue
        const c = Math.floor((((f.x % W) + W) % W) / cw)
        const r = Math.floor(f.y / ch)
        const fa = 0.6 + 0.4 * f.z
        this.plot(c, r, FLAKES[f.z > 0.5 ? 2 : 1], fa, p.snow, k)
        // The nearest flakes are bigger: a dot on each side.
        if (f.z > 0.7)
          for (const [dc, dr] of [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ])
            this.plot(c + dc, r + dr, FLAKES[1], fa * 0.6, p.snow, k)
      }
      if (snowN === 0) this.flakes = []
    }

    // A gale blows petals and seed across, low over the meadow.
    const seedN = Math.round(SEED_COUNT * a.gale)
    if (seedN > 0 || this.seeds.length) {
      while (this.seeds.length < SEED_COUNT) {
        const s: Seed = { x: 0, y: 0, v: 0, z: 0, phase: 0, kind: 0 }
        this.seedFrom(s, v)
        s.x = Math.random() * W
        this.seeds.push(s)
      }
      const cols = [p.fluff, p.poppy, p.dandelion, p.lace]
      for (let n = 0; n < this.seeds.length; n++) {
        const s = this.seeds[n]
        s.x += s.v * (0.6 + 0.5 * breeze) * dt
        s.y += (6 + 24 * Math.sin(now * 2.6 + s.phase)) * dt
        if (s.x > W + cw) this.seedFrom(s, v)
        if (n >= seedN) continue
        this.plot(
          Math.floor(s.x / cw),
          Math.floor(s.y / ch),
          SEEDS[s.kind % SEEDS.length],
          0.5 + 0.4 * s.z,
          cols[s.kind % cols.length],
          k,
        )
      }
      if (seedN === 0) this.seeds = []
    }
  }

  private dropFrom(d: Drop, v: WeatherView, slant: number) {
    d.z = Math.random()
    d.v = (0.7 + 0.5 * d.z) * v.H * 1.1
    d.land = this.landing(v)
    d.y = -Math.random() * 0.25 * v.H
    // Leaning drops start further left, so they cover the left edge too.
    d.x = Math.random() * (v.W + slant * v.H) - slant * v.H
    d.splash = 0
  }

  private flakeFrom(f: Flake, v: WeatherView) {
    f.z = Math.random()
    f.v = (0.04 + 0.05 * f.z) * v.H
    f.land = this.landing(v)
    f.y = -Math.random() * 0.1 * v.H
    f.x = Math.random() * v.W
    f.phase = hash(f.x, f.z) * 6.28
  }

  private seedFrom(s: Seed, v: WeatherView) {
    s.z = Math.random()
    s.v = (0.25 + 0.3 * s.z) * v.W
    s.x = -Math.random() * 0.3 * v.W
    s.y = v.horizon - 0.08 * v.H + Math.random() * (v.H * 0.95 - v.horizon)
    s.phase = Math.random() * 6.28
    s.kind = Math.floor(Math.random() * 12)
  }

  clear() {
    for (const i of this.touched) this.alpha[i] = 0
    this.touched = []
    this.lastPaint = -1
  }
}
