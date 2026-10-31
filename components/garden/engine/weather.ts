// The meadow's weather (design/circadian-meadow/components/Terminal, Meadow effects): rain, snow,
// a storm, a gale and an eclipse, set from lib/weather.ts. Falling rain and snow, blown seed,
// lightning and the eclipse's corona are overlay glyphs, moved and painted here on the main thread
// each page draw like the shooting stars, a few hundred at most and never one per cell. What
// changes the land or the sky (an overcast sky, snow lying, the eclipse's light) is a palette shift
// in steps, so the cached backdrop repaints a few dozen times over a change rather than every
// frame. Nothing here touches the grid.

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
const BOLT = { left: code('/'), right: code('\\'), down: code('|') }
const CORONA = [code('·'), code(':')]
/** What the moon's disc prints over the sun: a dim dot on a solid dark tile. */
export const DISC = code('·')

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
  storm: [1 / 4, 1 / 4],
  gale: [1 / 3, 1 / 3],
  // Snow lies over a minute and melts in twenty seconds.
  cover: [1 / 60, 1 / 20],
  // The moon crosses the sun in twelve seconds and leaves in eight.
  eclipse: [1 / 12, 1 / 8],
} as const
type Effect = keyof typeof RATES

/** Wind strength a full gale adds to the meadow's 0.2 breeze: strong, short of laying heads flat. */
const GALE = 0.9
/** Seconds between lightning strikes in a storm, at least and at most. */
const STRIKE_GAP = [4, 11]
/** How bright a strike lights the sky's glyphs at its peak; kept soft, never a white-out. */
export const FLASH = 0.45

/**
 * The scene at a solar eclipse's totality: a deep indigo sky over a copper band all round the
 * horizon (the sunset an eclipse throws on every side), the land gone to dusk, the corona pale.
 */
const hex = (h: string): Rgb => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]
const TOTALITY: Partial<Record<keyof Palette, Rgb>> = {
  skyTop: hex('#151a33'),
  skyHorizon: hex('#b8683e'),
  haze: hex('#5b4a63'),
  cloud: hex('#6c6386'),
  hillFar: hex('#33324a'),
  hillNear: hex('#22222b'),
  ground: hex('#141416'),
  pine: hex('#17181e'),
  grassDark: hex('#25261f'),
  grassLight: hex('#625d72'),
  stem: hex('#4f5263'),
  snow: hex('#a3a6c8'),
  snowShade: hex('#4b4f70'),
  globe: hex('#f4ead2'),
  panelBg: hex('#141416'),
}
/** The moon's disc against the corona, and the copper of the moon in Earth's shadow. */
const MOON_DARK = hex('#0c0d16')
const BOLT_COL: Rgb = [238, 236, 255]
const BLOOD = hex('#9a3f24')

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
  /** Where the sun or moon is, and how much of each shows (garden.ts). */
  globe: { cx: number; cy: number; R: number; sun: number; moon: number }
}

/** A disc laid over the sun or moon this frame: the moon's, or Earth's shadow on the moon. */
export type Disc = { x: number; y: number; R: number; col: Rgb; k: number }

export class Weather {
  kind: WeatherKind = 'clear'
  /** Each effect's strength now, 0 to 1. */
  private amount: Record<Effect, number> = {
    rain: 0,
    snow: 0,
    storm: 0,
    gale: 0,
    cover: 0,
    eclipse: 0,
  }
  /** Per cell, this frame: strength, glyph code and colour. Strength 0 is no particle. */
  alpha = new Float32Array(0)
  glyph = new Uint8Array(0)
  rgb = new Float32Array(0)
  /** Per cell, this frame: how strongly the corona or a bolt lights the tile behind its glyph. */
  tile = new Float32Array(0)
  /** The colour those tiles take: the corona's, near enough a bolt's. */
  readonly tileCol = TOTALITY.globe as Rgb
  /** Per cell column, this frame: how much a gust band lights the grass. Empty without a gale. */
  band = new Float32Array(0)
  /** How much a lightning strike lights the sky this frame, 0 to 1. */
  flash = 0
  disc: Disc | null = null
  private touched: number[] = []
  private cols = 0
  private rows = 0
  private drops: Drop[] = []
  private flakes: Flake[] = []
  private seeds: Seed[] = []
  /** The last strike's path, as cell column, row and glyph in turn, and when it struck. */
  private bolt: number[] = []
  private struck = -Infinity
  private nextStrike = 0
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
    const w = this.kind
    switch (k) {
      case 'rain':
        return w === 'rain' || w === 'storm' ? 1 : 0
      case 'snow':
      case 'cover':
        return w === 'snow' ? 1 : 0
      case 'storm':
        return w === 'storm' ? 1 : 0
      case 'gale':
        return w === 'wind' ? 1 : w === 'storm' ? 0.55 : 0
      case 'eclipse':
        return w === 'eclipse' ? 1 : 0
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

  /** Whether anything is falling, blowing or crossing, so the page should draw every display frame. */
  get moving() {
    const a = this.amount
    if (this.still) return false
    // The eclipse moves only while the moon is on its way; at totality it holds.
    const crossing = a.eclipse > 0 && a.eclipse < 1
    return a.rain + a.snow + a.gale > 0 || crossing
  }

  /** Whether any cell holds a drop, flake, seed, bolt or the corona this frame. */
  get painted() {
    return this.touched.length > 0
  }

  /** Wind strength the weather adds: a gale, and a little with rain. */
  get gale() {
    return GALE * this.amount.gale + 0.25 * this.amount.rain
  }

  /** Snow lying, in steps about a second apart while it settles. */
  get cover() {
    return steps(this.amount.cover, 60)
  }

  /**
   * The hour's palette under this weather: an overcast sky, snow lying, an eclipse's light. `sun`
   * is how much of the sun is up (garden.ts's sunAt): an eclipse by day is the sun's, by night
   * the moon's.
   */
  tint(p: Palette, sun: number): Palette {
    const a = this.amount
    const grey = steps(Math.max(a.rain, 0.7 * a.snow), 12)
    const storm = steps(a.storm, 12)
    const cover = this.cover
    const ecl = steps(a.eclipse, 24)
    if (grey + cover + ecl === 0) return p
    const out = { ...p }
    if (grey > 0) {
      // Rain and snow clouds: the haze in the ridges' shadow, so falling light marks read on
      // them; a storm's darker still.
      const overcast = mix(
        mix(p.haze, p.hillNear, 0.45),
        p.ground,
        0.45 * storm,
      )
      out.skyTop = mix(p.skyTop, overcast, (0.55 + 0.3 * storm) * grey)
      out.skyHorizon = mix(p.skyHorizon, overcast, (0.35 + 0.3 * storm) * grey)
      out.cloud = mix(p.cloud, overcast, (0.3 + 0.2 * storm) * grey)
      out.hillFar = mix(p.hillFar, out.skyHorizon, 0.2 * grey)
      out.hillNear = mix(p.hillNear, out.skyHorizon, 0.08 * grey)
    }
    if (cover > 0) {
      // A pale cover on the ground and the near ridge; the grass's tips take it most.
      out.hillNear = mix(out.hillNear, p.snowShade, 0.45 * cover)
      out.ground = mix(p.ground, p.snowShade, 0.28 * cover)
      out.grassDark = mix(p.grassDark, p.snowShade, 0.35 * cover)
      out.grassLight = mix(p.grassLight, p.snow, 0.5 * cover)
      out.stem = mix(p.stem, p.snowShade, 0.2 * cover)
    }
    if (ecl > 0) {
      if (sun <= 0) {
        // At night the sky only warms a little toward the moon's copper.
        out.skyTop = mix(out.skyTop, mix(out.skyTop, BLOOD, 0.25), ecl)
        out.haze = mix(out.haze, BLOOD, 0.2 * ecl)
      } else {
        // The light goes most of the way to totality's only near the end of the crossing.
        const k = smoothstep(0.35, 1, ecl) * sun
        for (const key of Object.keys(TOTALITY) as (keyof Palette)[])
          (out as Record<string, unknown>)[key] = mix(
            out[key] as Rgb,
            TOTALITY[key] as Rgb,
            k,
          )
        // Flowers lose their colour toward the dusk ground; the stars come out.
        for (const key of [
          'poppy',
          'poppyDeep',
          'rose',
          'roseDeep',
          'roseLeaf',
          'cosmos',
          'cosmosVein',
          'lace',
          'dandelion',
          'disc',
          'fluff',
        ] as const)
          out[key] = mix(out[key], TOTALITY.ground as Rgb, 0.45 * k)
        out.night = Math.max(p.night, 0.85 * k)
        out.ink = p.ink + (Math.max(p.ink, 1.15) - p.ink) * k
      }
    }
    return out
  }

  resize(cols: number, rows: number) {
    this.cols = cols
    this.rows = rows
    const n = cols * rows
    this.alpha = new Float32Array(n)
    this.glyph = new Uint8Array(n)
    this.rgb = new Float32Array(n * 3)
    this.tile = new Float32Array(n)
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
    for (const i of this.touched) this.alpha[i] = this.tile[i] = 0
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

    // The eclipse: by day the moon's disc crosses the sun and a corona holds round it at
    // totality; by night Earth's shadow reddens the moon. A still state under reduced motion.
    this.disc = null
    const e = a.eclipse
    const globe = v.globe
    if (e > 0 && W > 0 && globe.sun > 0) {
      // A touch over the sun's radius, which swells a little as it sinks.
      const R = globe.R * 1.12
      // In from up and to the right.
      const off = 1 - smoothstep(0, 1, e)
      this.disc = {
        x: globe.cx + off * 2.4 * R,
        y: globe.cy - off * 0.7 * R,
        R,
        col: MOON_DARK,
        k: 0.96 * smoothstep(0, 0.15, e) * globe.sun,
      }
      const ring = smoothstep(0.92, 1, e) * globe.sun
      if (ring > 0) {
        const reach = 1.75 * R
        const c0 = Math.max(0, Math.floor((globe.cx - reach) / cw))
        const c1 = Math.min(this.cols - 1, Math.ceil((globe.cx + reach) / cw))
        const r0 = Math.max(0, Math.floor((globe.cy - reach) / ch))
        const r1 = Math.min(this.rows - 1, Math.ceil((globe.cy + reach) / ch))
        for (let r = r0; r <= r1; r++)
          for (let c = c0; c <= c1; c++) {
            const dx = (c + 0.5) * cw - globe.cx
            const dy = (r + 0.5) * ch - globe.cy
            const d = Math.hypot(dx, dy) / R
            if (d < 1.02 || d > 1.75) continue
            const fall = 1 - smoothstep(1.02, 1.75, d)
            // Streamers: longer along a few directions, as a corona's are.
            const streak = 0.55 + 0.45 * Math.cos(4 * Math.atan2(dy, dx) + 0.7)
            if (hash(c, r, 31) > 0.2 + 0.7 * fall * streak) continue
            const s = ring * (0.45 + 0.55 * fall)
            this.plot(c, r, CORONA[d < 1.25 ? 1 : 0], s, this.tileCol, 1)
            const i = r * this.cols + c
            if (this.alpha[i] === Math.fround(s)) this.tile[i] = 0.5 * s * fall
          }
      }
    } else if (e > 0 && W > 0 && globe.moon > 0) {
      this.disc = {
        x: globe.cx,
        y: globe.cy,
        R: globe.R,
        col: BLOOD,
        k: 0.7 * e * globe.moon,
      }
    }

    this.flash = 0
    if (this.still || W === 0) return

    // A storm's lightning: now and then a jagged bolt from the cloud down to the ridges, and the
    // sky's glyphs flashing with it, twice and fading.
    if (a.storm > 0.8 && now >= this.nextStrike) {
      this.strike(v, now)
      this.nextStrike =
        now + STRIKE_GAP[0] + Math.random() * (STRIKE_GAP[1] - STRIKE_GAP[0])
    }
    const since = now - this.struck
    if (since >= 0 && since < 1) {
      this.flash =
        since < 0.07
          ? 1
          : since < 0.14
            ? 0.25
            : since < 0.22
              ? 0.8
              : 0.8 * Math.exp(-(since - 0.22) * 7)
      if (since < 0.3) {
        const fade = since < 0.22 ? 1 : 1 - (since - 0.22) / 0.08
        const b = this.bolt
        // Three cells wide, its core lighting its tiles, so it reads on the fine grid.
        for (let j = 0; j < b.length; j += 3) {
          const [c, r, g] = [b[j], b[j + 1], b[j + 2]]
          this.plot(c - 1, r, g, 0.55 * fade, BOLT_COL, 1)
          this.plot(c + 1, r, g, 0.55 * fade, BOLT_COL, 1)
          this.plot(c, r, g, fade, BOLT_COL, 1)
          if (c >= 0 && c < this.cols && r >= 0 && r < this.rows)
            this.tile[r * this.cols + c] = 0.7 * fade
        }
      }
    }

    // Rain: streaks a few cells long, leaning with the wind, and a dot where each lands.
    // A storm's rain is heavier.
    const rainN = Math.round(DROPS * a.rain * (0.8 + 0.2 * a.storm))
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

  /** A bolt from under the cloud to the ridges, one cell down a row, wandering as it goes. */
  private strike(v: WeatherView, now: number) {
    this.struck = now
    let c = Math.floor(((0.15 + 0.7 * Math.random()) * v.W) / v.cw)
    let r = Math.floor((0.12 * v.H) / v.ch)
    const end = Math.floor((v.horizon - 0.05 * v.H * Math.random()) / v.ch)
    const path: number[] = []
    let lean = Math.random() < 0.5 ? -1 : 1
    while (r < end) {
      const roll = Math.random()
      if (roll < 0.08) lean = -lean
      const dc = roll < 0.45 ? lean : roll < 0.6 ? -lean : 0
      path.push(c, r, dc < 0 ? BOLT.left : dc > 0 ? BOLT.right : BOLT.down)
      c += dc
      r++
    }
    this.bolt = path
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
    for (const i of this.touched) this.alpha[i] = this.tile[i] = 0
    this.touched = []
    this.lastPaint = -1
  }
}
