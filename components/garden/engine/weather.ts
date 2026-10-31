// The meadow's weather (design/circadian-meadow/components/Terminal, Meadow effects): rain, snow,
// a storm, a gale and an eclipse, set from lib/weather.ts. Falling rain and snow, blown seed,
// lightning and the eclipse's corona are overlay glyphs, moved and painted here on the main thread
// each page draw like the shooting stars, a few hundred at most and never one per cell. What
// changes the land or the sky (an overcast sky, snow lying, the eclipse's light) is a palette shift
// in steps, so the cached backdrop repaints a few dozen times over a change rather than every
// frame. Nothing here touches the grid.

import { clamp, hash, smoothstep } from './math'
import { mix, paletteAt, type Palette, type Rgb } from './palette'
import { code } from './typeset'

import type { Wind } from './wind'
import type { WeatherKind } from '@/lib/weather'

const RAIN_HEAD = code(',')
const RAIN = code('|')
const RAIN_TAIL = code("'")
const SLANT_HEAD = code('\\')
const SLANT_TAIL = code('`')
const SPLASH = code('.')
/** The droplets a near drop throws up as it lands. */
const SPRAY = code("'")
const FLAKES = [code('.'), code('·'), code('*')]
/** A near flake's clump: its rim and its middle. */
const BLOB = [code('o'), code('@')]
const SEEDS = [code('~'), code(','), code('.')]
const BOLT = {
  left: code('/'),
  right: code('\\'),
  down: code('|'),
  across: code('-'),
}
const CORONA = [code('·'), code(':')]
/** What Earth's shadow prints where the moon has no glyph of its own: a dim dot on a copper tile. */
export const SHADOW = code('·')

/** Most drops, flakes and seeds in the air at once. */
const DROPS = 960
const FLAKE_COUNT = 520
/** How long a flake lies where it landed, before it's gone (s), and the last part it melts over. */
const REST_FOR = [0.8, 1.6]
const MELT_FOR = 0.5
const SEED_COUNT = 70
/** How long a drop's splash shows, in s. */
const SPLASH_FOR = 0.12

/** How fast each effect comes in and goes, in its share a second. */
const RATES = {
  rain: [1 / 1.5, 1 / 1.5],
  snow: [1 / 2, 1 / 2],
  storm: [1 / 2, 1 / 2],
  gale: [1 / 1.5, 1 / 1.5],
  // Snow lies over twenty seconds and melts in eight.
  cover: [1 / 20, 1 / 8],
  // The moon crosses the sun in five seconds and leaves in four.
  eclipse: [1 / 5, 1 / 4],
} as const
type Effect = keyof typeof RATES

/** Wind strength a full gale adds to the meadow's 0.2 breeze: strong, short of laying heads flat. */
const GALE = 0.9
/** Seconds between lightning strikes in a storm, at least and at most. */
const STRIKE_GAP = [4, 11]
/** Seconds between flickers inside the cloud in a storm, at least and at most. */
const BREW_GAP = [1.5, 4.5]
/** How bright a strike lights the sky's glyphs at its peak; kept soft, never a white-out. */
export const FLASH = 0.45

// Every weather colour is taken from the palette's keyframes (palette.ts, the `*-` scene tokens),
// never picked by eye, so it follows the garden when the garden's colours change. paletteAt at a
// keyframe's own hour returns that keyframe unmixed.
const DAY = paletteAt(12)
const GOLDEN = paletteAt(17.75)
const SUNSET = paletteAt(19)
const TWILIGHT = paletteAt(20.15)
const NIGHT = paletteAt(22)

/** The light of totality: halfway from twilight to night, the scene at about 20:45. */
const lateTwilight = (key: keyof Palette) =>
  mix(TWILIGHT[key] as Rgb, NIGHT[key] as Rgb, 0.5)

/**
 * The globe's colour at totality: the shooting star's head (ShootingStar, `mix(fluff, globe, 0.4)`)
 * at noon, a pearl white.
 */
const CORONA_COL = mix(DAY.fluff, DAY.globe, 0.4)
/** The ring on the moon's edge and the glow round it, on their tiles: `sunset-globe`. */
const RIM_COL = SUNSET.globe

/**
 * The scene at a solar eclipse's totality: the land and upper sky at about 20:45, under a band
 * all round the horizon halfway between golden hour's and sunset's (the sunset an eclipse throws
 * on every side), a fifth sunk into that sky. Flowers go a share of the way to its ground.
 */
const TOTALITY: Partial<Record<keyof Palette, Rgb>> = {
  skyTop: lateTwilight('skyTop'),
  skyHorizon: mix(
    mix(GOLDEN.skyHorizon, SUNSET.skyHorizon, 0.5),
    lateTwilight('skyTop'),
    0.2,
  ),
  haze: lateTwilight('haze'),
  cloud: lateTwilight('cloud'),
  hillFar: lateTwilight('hillFar'),
  hillNear: lateTwilight('hillNear'),
  ground: lateTwilight('ground'),
  pine: lateTwilight('pine'),
  grassDark: lateTwilight('grassDark'),
  grassLight: lateTwilight('grassLight'),
  stem: lateTwilight('stem'),
  snow: lateTwilight('snow'),
  snowShade: lateTwilight('snowShade'),
  globe: CORONA_COL,
  panelBg: lateTwilight('panelBg'),
}
/** The moon's face against the sun: `night-disc`, the darkest mark in the scene. */
const MOON_DARK = NIGHT.disc
/** A lightning bolt and its flash: `night-fluff`, the coldest white in the palette. */
export const BOLT_COL = NIGHT.fluff
/** A bolt at its bluest, near and at night: `night-fluff` 30% toward `night-cosmos-vein`, a violet blue. */
const BOLT_BLUE = mix(NIGHT.fluff, NIGHT.cosmosVein, 0.3)
/** A bolt at its yellowest, far off through the rain by day: `night-fluff` 75% toward `golden-globe`. */
const BOLT_WARM = mix(NIGHT.fluff, GOLDEN.globe, 0.75)
/** How far along `lightningAt` the hour alone takes lightning: up to that yellow white. */
export const AUTO_TOP = 0.75
/**
 * Lightning's colours in a line, 0 to 1, as the site menu's slider shows them: the violet blue,
 * up to the yellow white at `AUTO_TOP`, then on to `golden-globe` itself, the warmest gold.
 */
export function lightningAt(t: number): Rgb {
  return t < AUTO_TOP
    ? mix(BOLT_BLUE, BOLT_WARM, t / AUTO_TOP)
    : mix(BOLT_WARM, GOLDEN.globe, (t - AUTO_TOP) / (1 - AUTO_TOP))
}
/**
 * The moon in Earth's shadow, lit only by the sunsets round the Earth's rim: `sunset-sky-horizon`
 * a third of the way into `night-sky-top`.
 */
const BLOOD = mix(SUNSET.skyHorizon, NIGHT.skyTop, 0.35)

/** The palette moves in steps of this share, so the backdrop repaints only on a step. */
const steps = (v: number, n: number) => Math.round(v * n) / n

type Drop = {
  x: number
  y: number
  v: number
  /** Depth: 0 far, at the meadow's back edge, to 1 near, falling past the bottom of the screen. */
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
  /** Seconds left lying where it landed, before it melts; 0 while it falls. */
  rest: number
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
  /** A drop landing at a point knocks the flower head there, by `k`; whether there was one. */
  /** How much cloud is at a cell, 0 to 1, as the sky last drew it (ascii.ts). */
  cloud: (c: number, r: number) => number
  /** Where the sun or moon is, and how much of each shows (garden.ts). */
  globe: {
    cx: number
    cy: number
    R: number
    sun: number
    moon: number
    /** The top of the land at x, ridges and trees. */
    skyline: (x: number) => number
  }
}

/** Lightning's light in the cloud this frame: lighting the sky's glyphs round a point. */
export type Glow = { x: number; y: number; R: number; k: number; col: Rgb }

/** A lightning event: its channels and the return strokes that light them. */
type Flash = {
  /** Its channels' cells, as column, row, glyph and strength in turn. */
  path: number[]
  /** Return strokes, as seconds after it starts and peak brightness in turn. */
  strokes: number[]
  /** When it started. */
  at: number
  /** Where its light sits in the cloud, and how far it reaches, in scene px. */
  x: number
  y: number
  R: number
  /** Near (1) or far (0): how wide and bright the channel prints, and how far its flash reaches. */
  near: number
  /** Its colour, bluer near and at night, yellower far off and by day. */
  col: Rgb
}

/**
 * How bright a lightning event is `t` seconds in, 0 to 1: each return stroke at its peak for a
 * frame or two, then dying away fast.
 */
function strokeAt(strokes: number[], t: number) {
  let b = 0
  for (let j = 0; j < strokes.length; j += 2) {
    const since = t - strokes[j]
    if (since < 0) continue
    const k = since < 0.06 ? 1 : Math.exp(-(since - 0.06) * 9)
    b = Math.max(b, strokes[j + 1] * k)
  }
  return b < 0.01 ? 0 : b
}

/** A disc laid over the sun or moon this frame: the moon's, or Earth's shadow on the moon. */
export type Disc = {
  x: number
  y: number
  R: number
  col: Rgb
  k: number
  /** The moon's body in front of the sun; otherwise Earth's shadow on the moon. */
  body: boolean
  /** The top of the land at x: the disc and corona set behind it. */
  skyline: (x: number) => number
}

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
  /** Per cell: rain, which flowers keep out (ascii.ts draws the flower over it). */
  wet = new Uint8Array(0)
  /** While the rain plots: its cells are wet. */
  private wetting = false
  /** The sun or moon this frame, which rain still falls in front of. */
  private globeAt = { cx: 0, cy: 0, R: 0 }
  private cw = 1
  private ch = 1
  /** The colour those tiles take: the corona's, or a bolt's while one strikes. */
  tileCol: Rgb = RIM_COL
  /** Per cell column, this frame: how much a gust band lights the grass. Empty without a gale. */
  band = new Float32Array(0)
  /** How much a lightning strike lights the whole sky this frame, 0 to 1. */
  flash = 0
  /** Lightning's colour set from the site menu, 0 to 1 along `lightningAt`; null follows the hour. */
  tone: number | null = null
  /** The strike's colour, for its flash. */
  flashCol: Rgb = BOLT_COL
  /** Lightning's light in the cloud this frame, a strike's or a flicker's. */
  glow: Glow | null = null
  disc: Disc | null = null
  private touched: number[] = []
  private cols = 0
  private rows = 0
  private drops: Drop[] = []
  private flakes: Flake[] = []
  private seeds: Seed[] = []
  /** The last strike to the ground (or into the air), and the last flicker inside the cloud. */
  private bolt: Flash | null = null
  private brew: Flash | null = null
  private nextStrike = 0
  private nextBrew = 0
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
        return w === 'storm' ? 0.55 : 0
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

  /**
   * Whether lightning is striking, the one thing that draws every display frame: at the plant
   * rate a flash under a second long would stutter. Rain, snow and seed move with the plants.
   */
  get striking() {
    return this.flash > 0
  }

  /** Whether any cell holds a drop, flake, seed, bolt or the corona this frame. */
  get painted() {
    return this.touched.length > 0
  }

  /** Wind strength the weather adds: a gale, and a little with rain. */
  get gale() {
    return GALE * this.amount.gale + 0.25 * this.amount.rain
  }

  /** Rain's unsteady air: a push either way of 2% of the wind's range, in place of drops knocking the flowers. */
  get unsteady() {
    return 0.04 * this.amount.rain
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
    const grey = steps(Math.max(a.rain, 0.7 * a.snow), 24)
    const storm = steps(a.storm, 24)
    const cover = this.cover
    const ecl = steps(a.eclipse, 64)
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
    this.wet = new Uint8Array(n)
    this.band = new Float32Array(cols)
    this.touched = []
    this.drops = []
    this.flakes = []
    this.seeds = []
  }

  /** Lights a cell's tile, if this frame's overlay holds the cell. */
  private lightTile(c: number, r: number, t: number) {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return
    const i = r * this.cols + c
    if (this.alpha[i] > 0) this.tile[i] = Math.max(this.tile[i], t)
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
    const gl = this.globeAt
    this.wet[i] =
      this.wetting &&
      Math.hypot((c + 0.5) * this.cw - gl.cx, (r + 0.5) * this.ch - gl.cy) >
        1.3 * gl.R
        ? 1
        : 0
    this.glyph[i] = g
    this.rgb[i * 3] = Math.min(255, col[0] * k)
    this.rgb[i * 3 + 1] = Math.min(255, col[1] * k)
    this.rgb[i * 3 + 2] = Math.min(255, col[2] * k)
  }

  /** Where a drop or flake comes down: mostly on the meadow, some on the near ridges. */
  /**
   * Where something falling at depth `z` comes down: the far ones at the meadow's back edge, on
   * the treeline, the nearer ones lower, as the ground comes toward us; the nearest past the
   * bottom of the screen.
   */
  private landing(v: WeatherView, z: number) {
    const top = v.horizon - 0.03 * v.H
    return (
      top + (1.08 * v.H - top) * z ** 1.3 + (Math.random() - 0.5) * 0.04 * v.H
    )
  }

  /** Moves everything in the air to `now` (s) and lays it into the cells. */
  paint(now: number, p: Palette, wind: Wind, v: WeatherView) {
    for (const i of this.touched) this.alpha[i] = this.tile[i] = this.wet[i] = 0
    this.touched = []
    const dt = this.lastPaint < 0 ? 0 : clamp(now - this.lastPaint, 0, 0.1)
    this.lastPaint = now
    const a = this.amount
    const { W, cw, ch } = v
    this.cw = cw
    this.ch = ch
    this.globeAt = v.globe
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
    this.tileCol = RIM_COL
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
        body: true,
        skyline: globe.skyline,
        k: 0.96 * smoothstep(0, 0.15, e) * globe.sun,
      }
      // At totality, a black disc in a ring of light: a ring one cell wide on the moon's edge,
      // and a glow fading smoothly out from it, a little longer along a few streamers. The glow is
      // light on tiles, under a glyph of the same colour, so it reads as a haze, not as dots.
      const ring = smoothstep(0.92, 1, e) * globe.sun
      if (ring > 0) {
        const rim = 1 + Math.max(cw, ch) / R
        const reach = 1.55 * R
        const c0 = Math.max(0, Math.floor((globe.cx - reach) / cw))
        const c1 = Math.min(this.cols - 1, Math.ceil((globe.cx + reach) / cw))
        const r0 = Math.max(0, Math.floor((globe.cy - reach) / ch))
        const r1 = Math.min(this.rows - 1, Math.ceil((globe.cy + reach) / ch))
        for (let r = r0; r <= r1; r++)
          for (let c = c0; c <= c1; c++) {
            const dx = (c + 0.5) * cw - globe.cx
            const dy = (r + 0.5) * ch - globe.cy
            const d = Math.hypot(dx, dy) / R
            if (d < 1 || d > 1.55) continue
            const i = r * this.cols + c
            let s: number
            let t: number
            if (d < rim) {
              s = ring
              t = 0.9 * ring
              this.plot(c, r, CORONA[1], s, RIM_COL, 1)
            } else {
              const fall = (1 - smoothstep(rim, 1.55, d)) ** 2
              const streak = 0.8 + 0.2 * Math.cos(4 * Math.atan2(dy, dx) + 0.7)
              t = 0.6 * ring * fall * streak
              if (t < 0.02) continue
              s = 0.1
              this.plot(c, r, CORONA[0], s, RIM_COL, 1)
            }
            if (this.alpha[i] === Math.fround(s)) this.tile[i] = t
          }
      }
    } else if (e > 0 && W > 0 && globe.moon > 0) {
      this.disc = {
        x: globe.cx,
        y: globe.cy,
        R: globe.R,
        col: BLOOD,
        body: false,
        skyline: globe.skyline,
        k: 0.7 * e * globe.moon,
      }
    }

    this.flash = 0
    this.glow = null
    if (this.still || W === 0) return

    // A storm's lightning: now and then a branching bolt out of a cloud, near and bright or far
    // and thin, down to the land or into the air, with the sky flashing as it strikes; and, more
    // often, flickers inside the clouds, lighting them from within.
    if (a.storm > 0.8 && now >= this.nextStrike) {
      this.bolt = this.strike(v, now)
      this.nextStrike =
        now + STRIKE_GAP[0] + Math.random() * (STRIKE_GAP[1] - STRIKE_GAP[0])
      // A flicker doesn't land on top of a strike.
      this.nextBrew = Math.max(this.nextBrew, now + 1)
    }
    if (a.storm > 0.5 && now >= this.nextBrew) {
      this.brew = this.flicker(v, now)
      this.nextBrew =
        now + BREW_GAP[0] + Math.random() * (BREW_GAP[1] - BREW_GAP[0])
    }
    for (const f of [this.brew, this.bolt]) {
      if (!f) continue
      const b = strokeAt(f.strokes, now - f.at)
      if (b <= 0) continue
      if (f === this.bolt) {
        this.flash = b * (0.35 + 0.65 * f.near)
        this.flashCol = f.col
      }
      const k = b * (f === this.bolt ? 0.9 : 1)
      if (!this.glow || k > this.glow.k)
        this.glow = { x: f.x, y: f.y, R: f.R, k, col: f.col }
      // The channel shows while its stroke is bright, a little brighter than the stroke itself.
      const seen = Math.min(1, 1.4 * b)
      if (seen < 0.08) continue
      this.tileCol = f.col
      const wide = f === this.bolt ? f.near : 0
      // A flicker's channel is a short bright crawl inside the cloud; a bolt's core is lit by depth.
      const lit = f === this.bolt ? 0.3 + 0.4 * wide : 0.15
      const p = f.path
      for (let j = 0; j < p.length; j += 4) {
        const [c, r, g] = [p[j], p[j + 1], p[j + 2]]
        const s = p[j + 3] * seen
        // Near, three cells wide; middling, two; far, a single thin line. The core lights its
        // tile, so it reads on the fine grid.
        if (wide > 0.35) this.plot(c + 1, r, g, 0.5 * s, f.col, 1)
        if (wide > 0.7) this.plot(c - 1, r, g, 0.5 * s, f.col, 1)
        this.plot(c, r, g, s, f.col, 1)
        if (c >= 0 && c < this.cols && r >= 0 && r < this.rows)
          this.tile[r * this.cols + c] = Math.max(
            this.tile[r * this.cols + c],
            lit * s,
          )
      }
    }

    // Rain: streaks a few cells long, leaning with the wind, and a dot where each lands.
    // A storm's rain is heavier.
    const rainN = Math.round(DROPS * a.rain * (0.8 + 0.2 * a.storm))
    if (rainN > 0 || this.drops.length) {
      const slant = clamp(0.1 + 0.3 * breeze, 0.08, 0.8)
      while (this.drops.length < DROPS) {
        const d: Drop = {
          x: 0,
          y: 0,
          v: 0,
          z: 0,
          land: 0,
          splash: 0,
        }
        this.dropFrom(d, v, slant)
        d.y = Math.random() * d.land
        this.drops.push(d)
      }
      // Rain shows by its contrast with the sky behind it: pale streaks on a dark sky, and on a
      // pale overcast, by day, dark ones toward `ground`. (Not `hill-near`: the overcast is
      // mixed from it, so drops in it vanished.)
      const [hr, hg, hb] = p.haze
      const pale = smoothstep(
        0.42,
        0.62,
        (0.2126 * hr + 0.7152 * hg + 0.0722 * hb) / 255,
      )
      const light = mix(p.fluff, p.snow, 0.5)
      const col = mix(light, p.ground, 0.65 * pale)
      // Far drops sink into the sky's haze, less by day so the curtain still reads.
      const farCol = mix(col, p.haze, 0.55 - 0.25 * pale)
      // Over the land, dark at any hour, drops and their splashes stay pale.
      const landFar = mix(light, p.haze, 0.45)
      const landRow = Math.floor(v.horizon / ch)
      // A splash lights its cell for a moment, so it reads in the grass's own glyphs; unless
      // lightning holds the tiles' colour this frame.
      const splashTile = this.flash === 0 && !this.glow
      if (splashTile) this.tileCol = light
      const [head, body, tail] =
        slant < 0.3
          ? [RAIN_HEAD, RAIN, RAIN_TAIL]
          : [SLANT_HEAD, SLANT_HEAD, SLANT_TAIL]
      this.wetting = true
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
            d.splash = SPLASH_FOR * (1 + d.z)
          }
        }
        if (n >= rainN) continue
        const c = Math.floor(d.x / cw)
        const r = Math.floor(d.y / ch)
        // Depth: far drops are dim, short, slow and hazed; near ones bright and long.
        const base = 0.22 + 0.68 * d.z
        const s = Math.min(1, base * (1 + 0.7 * pale))
        const dc = d.z < 0.4 ? farCol : col
        const lc = d.z < 0.4 ? landFar : light
        if (d.splash > 0) {
          // A dot where it lands; most drops throw two droplets up and out, which fall back.
          const t = 1 - d.splash / (SPLASH_FOR * (1 + d.z))
          const sc = r >= landRow ? lc : dc
          const ss = r >= landRow ? Math.min(1, base * 1.3) : s
          this.plot(c, r, SPLASH, ss * (1 - 0.6 * t), sc, k)
          if (splashTile && d.z > 0.3)
            this.lightTile(c, r, (0.1 + 0.2 * d.z) * (1 - t))
          if (d.z > 0.4) {
            const up = t < 0.5 ? 1 : 0
            this.plot(c - 1, r - up, SPRAY, ss * 0.7 * (1 - t), sc, k)
            this.plot(c + 1, r - up, SPRAY, ss * 0.7 * (1 - t), sc, k)
          }
          continue
        }
        // Nearer drops fall longer streaks; the tail fades back up the path.
        // By day a little longer too, so a streak reads against the pale sky as a line.
        const len = 2 + Math.round((7 + 3 * pale) * d.z)
        for (let j = 0; j < len; j++) {
          const g = j === 0 ? head : j === len - 1 ? tail : body
          const land = r - j >= landRow
          this.plot(
            Math.floor((d.x - slant * ch * j) / cw),
            r - j,
            g,
            (land ? Math.min(1, base * 1.3) : s) * (1 - (0.5 * j) / len),
            land ? lc : dc,
            k,
          )
        }
      }
      this.wetting = false
      if (rainN === 0) this.drops = []
    }

    // Snow: flakes drift down and sway, the nearer ones bigger and quicker.
    const snowN = Math.round(FLAKE_COUNT * a.snow)
    if (snowN > 0 || this.flakes.length) {
      const snowFar = mix(p.snow, p.haze, 0.45)
      // A near flake's crest: `snow` lightened 15%, as SnowCap's is.
      const snowLit = mix(p.snow, [255, 255, 255], 0.15)
      while (this.flakes.length < FLAKE_COUNT) {
        const f: Flake = {
          x: 0,
          y: 0,
          v: 0,
          z: 0,
          land: 0,
          phase: 0,
          rest: 0,
        }
        this.flakeFrom(f, v)
        f.y = Math.random() * f.land
        this.flakes.push(f)
      }
      for (let n = 0; n < this.flakes.length; n++) {
        const f = this.flakes[n]
        // A flake lies where it lands for a second, then melts away and falls again from the top.
        if (f.rest > 0) {
          f.rest -= dt
          if (f.rest <= 0) this.flakeFrom(f, v)
        } else {
          f.y += f.v * dt
          f.x +=
            (30 * breeze + 14 * Math.cos(now * 0.9 + f.phase)) *
            (0.3 + 1.4 * f.z * f.z) *
            dt
          if (f.y >= f.land) {
            f.y = f.land
            f.rest =
              f.land < v.H
                ? REST_FOR[0] + (REST_FOR[1] - REST_FOR[0]) * Math.random()
                : 0.01
          }
        }
        if (n >= snowN) continue
        const c = Math.floor((((f.x % W) + W) % W) / cw)
        const r = Math.floor(f.y / ch)
        if (f.rest > 0) {
          // Lying: still, no trail, flattened to one row, fading as it melts.
          const m = Math.min(1, f.rest / MELT_FOR)
          if (f.z < 0.45) {
            this.plot(c, r, FLAKES[0], (0.25 + 0.5 * f.z) * m, snowFar, k)
            continue
          }
          this.tileCol = snowLit
          this.plot(
            c,
            r,
            f.z < 0.65 ? FLAKES[1] : BLOB[0],
            (0.5 + 0.4 * f.z) * m,
            p.snow,
            k,
          )
          if (f.z >= 0.8) {
            const side = f.phase < Math.PI ? 1 : -1
            this.lightTile(c, r, 0.35 * m)
            this.plot(c + side, r, FLAKES[1], 0.6 * m, snowLit, k)
          }
          continue
        }
        // Far flakes are faint dots in the haze, slow and small; near ones are soft clumps, lit
        // on their tiles so they read as solid and close, not as points of light like the stars.
        if (f.z < 0.45) {
          this.plot(c, r, FLAKES[0], 0.25 + 0.5 * f.z, snowFar, k)
          continue
        }
        if (f.z < 0.8) {
          this.plot(
            c,
            r,
            f.z > 0.65 ? BLOB[0] : FLAKES[1],
            0.5 + 0.4 * f.z,
            p.snow,
            k,
          )
          if (f.z > 0.65) {
            this.tileCol = snowLit
            this.lightTile(c, r, 0.2)
          }
          continue
        }
        const near = (f.z - 0.8) / 0.2
        // Snow and the corona or a bolt never share a frame for long; snow takes the tiles.
        // A near flake is a small clump: a lit core with a faint `·` beside it, and on the
        // nearest a fainter cell below, with a faint trail above where it fell: a star is a point
        // and never moves. (Two cells by two read too thick; Stanley, 2026-10-31.)
        this.tileCol = snowLit
        const side = f.phase < Math.PI ? 1 : -1
        this.plot(c, r, BLOB[1], 1, snowLit, k)
        this.lightTile(c, r, 0.4 + 0.25 * near)
        this.plot(c + side, r, FLAKES[1], 0.6, snowLit, k)
        if (near > 0.5) {
          this.plot(c, r + 1, BLOB[0], 0.6, snowLit, k)
          this.lightTile(c, r + 1, 0.1 + 0.15 * near)
        }
        this.plot(c, r - 1, FLAKES[0], 0.3 + 0.2 * near, snowLit, k)
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

  /**
   * A strike: a channel out of the base of a cloud, wandering down a row at a time with
   * branches forking off it, near or far. A near one comes down in front of the ridges to the
   * meadow's edge; a far one goes behind them; one in five never reaches the ground.
   */
  private strike(v: WeatherView, now: number): Flash {
    // Its depth sets which cloud it comes from: a near one out of cloud high overhead, a far one
    // out of cloud low over the ridges, so the bolt and its cloud sit at the same distance.
    const near = Math.random()
    const { c, r } = this.cloudSpot(v, near)
    const ground = Math.random() < 0.8
    const bottom = Math.floor(v.horizon / v.ch) - 1
    const rows = ground
      ? bottom - r
      : Math.round((0.3 + 0.4 * Math.random()) * (bottom - r))
    const path: number[] = []
    this.channel(
      path,
      v,
      c,
      r,
      Math.random() < 0.5 ? -1 : 1,
      rows,
      0.6 + 0.4 * near,
      0,
      near < 0.6,
    )
    // One stroke, then up to two more down the same channel, at least a tenth of a second apart,
    // so it never flashes more than three times a second.
    const strokes = [0, 1]
    let t = 0
    for (let n = Math.floor(Math.random() * 3); n > 0; n--) {
      t += 0.1 + 0.15 * Math.random()
      strokes.push(t, 0.5 + 0.4 * Math.random())
    }
    return {
      path,
      strokes,
      at: now,
      x: (c + 0.5) * v.cw,
      y: (r + 0.5) * v.ch,
      R: (0.08 + 0.1 * near) * v.W,
      near,
      col: this.boltCol(v, near),
    }
  }

  /**
   * A flicker inside a cloud: its light swells in the cloud a few times, and now and then a short
   * channel shows faintly through it, crawling sideways as cloud-to-cloud lightning does.
   */
  private flicker(v: WeatherView, now: number): Flash {
    const near = Math.random()
    const { c, r } = this.cloudSpot(v, near)
    const path: number[] = []
    if (Math.random() < 0.6)
      for (let arm = 1 + Math.floor(Math.random() * 3); arm > 0; arm--)
        this.crawl(path, v, c, r, 3 + Math.floor(Math.random() * 7))
    // It flutters: two to four pulses, quick and uneven, as light jumps about inside the cloud.
    const strokes: number[] = []
    let t = 0
    for (let n = 2 + Math.floor(Math.random() * 3); n > 0; n--) {
      strokes.push(t, 0.5 + 0.5 * Math.random())
      t += 0.1 + 0.2 * Math.random()
    }
    return {
      path,
      strokes,
      at: now,
      x: (c + 0.5) * v.cw,
      y: (r + 0.5) * v.ch,
      R: (0.06 + 0.08 * near) * v.W,
      near: 0,
      col: this.boltCol(v, near),
    }
  }

  /**
   * A strike's colour: bluer near and by night, yellower far off, through more rain, and by day,
   * with a little chance either way. Set from the menu's slider, it stays near that colour.
   */
  private boltCol(v: WeatherView, near: number): Rgb {
    if (this.tone !== null)
      return lightningAt(
        clamp(
          this.tone + 0.08 * (1 - near) + 0.1 * (Math.random() - 0.5),
          0,
          1,
        ),
      )
    const warm = clamp(
      0.1 + 0.5 * v.globe.sun + 0.35 * (1 - near) + 0.3 * (Math.random() - 0.5),
      0,
      1,
    )
    return lightningAt(AUTO_TOP * warm)
  }

  /**
   * The cloudiest of a few dozen sky cells, away from the sun and moon, where lightning starts;
   * with no cloud about, a cell on the top edge, so it comes from above the frame.
   */
  private cloudSpot(v: WeatherView, near: number) {
    const { cx, cy, R } = v.globe
    const shown = v.globe.sun + v.globe.moon > 0
    // Cloud overhead is near and cloud low in the sky far: look in a band at the depth's height.
    const mid = 0.04 + 0.5 * (1 - near)
    let best = { c: 0, r: 0, k: -1 }
    for (let n = 0; n < 48; n++) {
      const x = (0.06 + 0.88 * Math.random()) * v.W
      const y = clamp(mid + 0.2 * (Math.random() - 0.5), 0.02, 0.6) * v.horizon
      if (shown && Math.hypot(x - cx, (y - cy) * 0.8) < 2 * R) continue
      const c = Math.floor(x / v.cw)
      const r = Math.floor(y / v.ch)
      const k = v.cloud(c, r)
      if (k > best.k) best = { c, r, k }
    }
    if (best.k < 0.15) {
      let x = (0.1 + 0.8 * Math.random()) * v.W
      if (shown && Math.abs(x - cx) < 2 * R)
        x = cx + Math.sign(x - cx || 1) * 2 * R
      // Out of overcast at its depth's height: from above the frame if near.
      const y = near > 0.8 ? 0 : mid * v.horizon
      best = { c: Math.floor(x / v.cw), r: Math.floor(y / v.ch), k: 0 }
    }
    return best
  }

  /**
   * One channel, a row at a time: leaning one way, now and then the other, now and then jogging
   * along a row; with branches forking off that wander further sideways and fade. Inside a cloud
   * it shows dimly through it; a far one goes behind the land.
   */
  private channel(
    path: number[],
    v: WeatherView,
    c: number,
    r: number,
    lean: number,
    rows: number,
    s: number,
    depth: number,
    behind: boolean,
  ) {
    for (let k = 0; k < rows; k++) {
      const x = (c + 0.5) * v.cw
      const y = (r + 0.5) * v.ch
      if (behind && y > v.globe.skyline(x)) return
      const roll = Math.random()
      if (roll < 0.1) lean = -lean
      const through = s * (1 - 0.6 * v.cloud(c, r))
      if (roll > 0.96 && depth === 0) {
        for (let n = 1 + Math.floor(Math.random() * 3); n > 0; n--) {
          path.push(c, r, BOLT.across, through)
          c += lean
        }
        continue
      }
      // A branch leans harder, so it spreads away from the channel it left.
      const side = depth ? 0.6 : 0.45
      const dc = roll < side ? lean : roll < side + 0.15 ? -lean : 0
      path.push(
        c,
        r,
        dc < 0 ? BOLT.left : dc > 0 ? BOLT.right : BOLT.down,
        through,
      )
      c += dc
      r++
      if (depth < 2 && Math.random() < (depth ? 0.04 : 0.08) * (1 - k / rows))
        this.channel(
          path,
          v,
          c,
          r,
          // Away from the channel it left, so it never runs alongside and rejoins it.
          -lean,
          Math.round((4 + Math.random() * 0.5 * (rows - k)) / (depth + 1)),
          s * 0.6,
          depth + 1,
          behind,
        )
    }
  }

  /** One arm of a flicker: crawling through the cloud, mostly sideways, shown only within it. */
  private crawl(
    path: number[],
    v: WeatherView,
    c: number,
    r: number,
    n: number,
  ) {
    let dc = Math.random() < 0.5 ? -1 : 1
    for (; n > 0; n--) {
      const roll = Math.random()
      if (roll < 0.12) dc = -dc
      const dr = roll < 0.25 ? 1 : roll < 0.42 ? -1 : 0
      const glyph =
        dr === 0 ? BOLT.across : dc * dr > 0 ? BOLT.right : BOLT.left
      const k = v.cloud(c, r)
      if (k > 0.1) path.push(c, r, glyph, 0.75 + 0.25 * k)
      c += dc
      r = Math.max(0, r + dr)
    }
  }

  private dropFrom(d: Drop, v: WeatherView, slant: number) {
    // Most rain is in the middle distance, a curtain over the meadow; fewer far off or close.
    d.z = Math.random() ** 1.1
    d.v = (0.45 + 0.85 * d.z) * v.H * 1.1
    d.land = this.landing(v, d.z)
    d.y = -Math.random() * 0.25 * v.H
    // Leaning drops start further left, so they cover the left edge too.
    d.x = Math.random() * (v.W + slant * v.H) - slant * v.H
    d.splash = 0
  }

  private flakeFrom(f: Flake, v: WeatherView) {
    f.z = Math.random() ** 1.6
    f.v = (0.03 + 0.1 * f.z * f.z) * v.H
    f.land = this.landing(v, f.z)
    f.y = -Math.random() * 0.1 * v.H
    f.x = Math.random() * v.W
    f.phase = hash(f.x, f.z) * 6.28
    f.rest = 0
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
    for (const i of this.touched) this.alpha[i] = this.tile[i] = this.wet[i] = 0
    this.touched = []
    this.lastPaint = -1
    this.glow = null
  }
}
