import { Butterflies } from './butterflies'
import {
  clamp,
  easeInOut,
  fbm1,
  hash,
  lerp,
  mulberry32,
  smoothstep,
  TAU,
} from './math'
import { Meadow, STRIP } from './meadow'
import { mix, type Palette, type Rgb } from './palette'
import { particle, Particles } from './particles'
import { createPlant, RUSH, type Env, type Plant, type Species } from './plants'
import { type Head, Kind, type Raster, Shape } from './raster'

import type { Rect } from './ascii'
import type { Wind } from './wind'

/** How many clicked-in flowers stay at once. */
const SOWN_MAX = 8

const SPECIES: [Species, number][] = [
  ['poppy', 0.5],
  ['cosmos', 0.27],
  // Umbels print as a block at a distance, so they stay rare.
  ['lace', 0.05],
  ['dandelion', 0.18],
]

/** Seconds the opening time-lapse takes to grow the garden in. */
const INTRO = 4.5
/** Spacing of the ridge outline's points. */
const RIDGE_STEP = 6
/** Depth of the farthest planting: a field away, short of the hills, so nothing roots on them. */
const FARTHEST_Z = 0.22

export class Garden {
  width = 1
  height = 1
  horizon = 1
  plants: Plant[] = []
  meadow = new Meadow()
  particles = new Particles()
  butterflies = new Butterflies()
  /** Flower heads as last drawn, for clicks and butterflies to find. */
  heads: Head[] = []
  private rng = mulberry32(1)
  private seed = 1
  private targetAge = new Map<Plant, number>()
  private intro = 0
  private ridges: Float32Array[] = []
  /** Plants sown by clicking, oldest first. */
  private sown: Plant[] = []
  time = 0
  hour = 15
  /** Where the bio sits. Flowers aren't planted under it and the grass thins out there. */
  keepClear: Rect | null = null
  /** Strips planted so far, and the window height they were grown for. */
  private strips = 0
  /** Overrides the moon's phase (0 new, 0.5 full) for testing; null follows the calendar. */
  moonPhase: number | null = null
  private grownFor = 0
  readonly env: Env

  constructor(
    readonly wind: Wind,
    palette: Palette,
  ) {
    this.env = {
      wind,
      particles: this.particles,
      palette,
      unit: 1,
      floor: (z) => this.floor(z),
      quiet: true,
    }
    this.particles.onLand = (p) => {
      // Now and then a pappus that lands takes root.
      if (
        p.type === 'pappus' &&
        this.rng() < 0.12 &&
        this.plants.length < this.maxPlants()
      ) {
        this.add(
          'dandelion',
          p.x,
          clamp(p.depth + (this.rng() - 0.5) * 0.1, FARTHEST_Z, 1),
        )
      }
    }
  }

  floor(z: number) {
    return this.horizon + (this.height * 1.02 - this.horizon) * z ** 1.25
  }

  /** Inverse of floor(), for planting where the user clicks. */
  depthAt(y: number) {
    return (
      clamp((y - this.horizon) / (this.height * 1.02 - this.horizon), 0, 1) **
      (1 / 1.25)
    )
  }

  private maxPlants() {
    return Math.round(this.width / 26)
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.horizon = height * 0.55
    this.env.unit = height
    const first = this.plants.length === 0
    // A much taller or shorter window would leave stems out of scale, so that grows a new garden.
    if (first || Math.abs(height / this.grownFor - 1) > 0.25) {
      this.regrow(this.seed)
      // Only the first load grows in; a resize shows the garden already grown.
      if (!first) this.skipIntro()
      return
    }
    // Otherwise it's the same garden in a new frame: roots move to the new ground line and new
    // strips fill whatever opened up on the right.
    for (const plant of this.plants) plant.reanchor(this.env)
    this.extend()
    this.meadow.build(
      this.width,
      this.height,
      (z) => this.floor(z),
      this.seed * 7 + 3,
      this.keepClear,
    )
    this.buildRidges()
  }

  regrow(seed: number) {
    this.seed = seed
    this.rng = mulberry32(seed)
    this.plants = []
    this.targetAge.clear()
    this.particles.list = []
    this.butterflies.clear()
    this.strips = 0
    this.grownFor = this.height
    this.intro = 0
    this.env.quiet = true
    this.extend()
    // One big flower up front, across from the text, so the foreground has a subject.
    const b = this.keepClear
    if (b && this.width - b.right > 160) {
      const plant = this.add(
        this.rng() < 0.5 ? 'poppy' : 'cosmos',
        lerp(b.right, this.width, 0.5),
        0.97,
      )
      this.targetAge.set(plant, plant.bloomAge())
    }
    this.meadow.build(
      this.width,
      this.height,
      (z) => this.floor(z),
      seed * 7 + 3,
      this.keepClear,
    )
    this.buildRidges()
  }

  /** Plants the strips the window now reaches into, each from its own seed. */
  private extend() {
    for (; this.strips * STRIP < this.width; this.strips++) {
      const rng = mulberry32(this.seed * 7919 + this.strips * 104729 + 17)
      // Large flowers up front carry the scene, a middle band fills in, and small far ones are texture.
      const tiers: [number, number, number][] = [
        [STRIP / 150, 0.55, 0.95],
        [STRIP / 160, 0.38, 0.6],
        [STRIP / 130, FARTHEST_Z, 0.42],
      ]
      for (const [rate, z0, z1] of tiers) {
        const n = Math.floor(rate + rng())
        for (let i = 0; i < n; i++) {
          let z = 0
          let x = 0
          // Like the koi swimming off the text: try spots until one is clear of it.
          for (let t = 0; t < 40; t++) {
            z = lerp(z0, z1, rng())
            x = (this.strips + rng()) * STRIP
            if (!this.underText(x, z)) break
          }
          const plant = this.add(
            this.pickSpecies(rng),
            x,
            z,
            Math.floor(rng() * 1e9),
          )
          // During the opening they grow in with the rest; later strips arrive grown.
          if (this.intro < INTRO) this.targetAge.set(plant, plant.bloomAge())
          else plant.age = plant.bloomAge()
        }
      }
    }
  }

  /** True when a plant rooted here would hold its flower over the bio. Stems may pass behind it. */
  private underText(x: number, z: number) {
    const b = this.keepClear
    if (!b) return false
    const margin = this.width * 0.03
    if (x < b.left - margin || x > b.right + margin) return false
    // Rough flower height: shortest stems, at this depth's scale.
    const head =
      this.floor(z) - this.height * 0.28 * lerp(0.26, 1.18, z ** 1.15)
    return head > b.top - this.height * 0.08
  }

  /** Jump straight to the grown garden, for reduced motion. */
  skipIntro() {
    this.intro = INTRO
    for (const [plant, age] of this.targetAge) plant.age = age
    this.targetAge.clear()
    this.meadow.grow = 1
    this.env.quiet = false
  }

  private pickSpecies(rng = this.rng): Species {
    let r = rng()
    for (const [s, w] of SPECIES) {
      r -= w
      if (r <= 0) return s
    }
    return 'poppy'
  }

  add(
    species: Species,
    x: number,
    z: number,
    seed = Math.floor(this.rng() * 1e9),
  ) {
    const plant = createPlant(species, x, z, seed, this.env)
    // Keep plants sorted far to near, so nearer ones draw over.
    let i = this.plants.length
    while (i > 0 && this.plants[i - 1].z > z) i--
    this.plants.splice(i, 0, plant)
    return plant
  }

  /** The flower head under a click, if any; small far heads get a little slack. */
  headAt(x: number, y: number) {
    let best: Head | undefined
    let bestD = Infinity
    for (const h of this.heads) {
      const d = Math.hypot(h.x - x, h.y - y)
      if (h.alpha > 0.3 && d < Math.max(h.r * 1.3, 12) && d < bestD) {
        best = h
        bestD = d
      }
    }
    return best
  }

  /** Calls a butterfly to the flower under the click. */
  visit(head: Head) {
    if (head.owner)
      this.butterflies.summon(head.owner, this.heads, this.env.palette)
  }

  /** Sow where the user clicked, cycling through the species. */
  sow(x: number, y: number) {
    // A click on the sky sows at the horizon below it.
    const z =
      y < this.horizon ? FARTHEST_Z : Math.max(FARTHEST_Z, this.depthAt(y))
    const plant = this.add(this.pickSpecies(), x, z)
    plant.hurry()
    // Now and then a sown flower draws a visitor once it opens; a click on a flower always does.
    if (this.rng() < 0.2) this.butterflies.later(plant, RUSH + 1)
    // After dark a few fireflies gather where the seed went in.
    const night = this.env.palette?.night ?? 0
    for (let i = 0; i < Math.round(6 * smoothstep(0.4, 0.9, night)); i++) {
      this.particles.add(
        particle({
          type: 'firefly',
          x: x + (this.rng() - 0.5) * 70,
          y: this.floor(z) - this.height * (0.03 + this.rng() * 0.12),
          size: lerp(0.8, 1.9, z),
          color: [233, 240, 170],
          life: 12 + this.rng() * 10,
          depth: z,
        }),
      )
    }
    this.sown.push(plant)
    // Only the last few stay; older ones fade back into the grass.
    let staying = this.sown.filter((q) => !q.leaving).length
    for (const q of this.sown) {
      if (staying <= SOWN_MAX) break
      if (q.leaving) continue
      q.leaving = true
      staying--
    }
    return true
  }

  /**
   * Three ridges with their own characters, all fixed in x so a resize only reveals more of the
   * range: a far range of sharp peaks with a main massif every so often, a rolling middle ridge
   * with a cliff and a shelf, and a low, soft near ridge.
   */
  private buildRidges() {
    const n = Math.ceil(this.width / RIDGE_STEP) + 2
    const H = this.height
    const seed = this.seed * 13
    // Each 1500px stretch of range has one massif and one cliff, placed by its own hash.
    const feature = (x: number, salt: number) => {
      const k = Math.floor(x / 1500)
      let best = 0
      for (const j of [k - 1, k, k + 1]) {
        const at = j * 1500 + lerp(700, 1100, hash(j, salt, this.seed))
        best = Math.abs(x - at) < Math.abs(x - best) ? at : best
      }
      return x - best
    }
    const far = new Float32Array(n)
    const mid = new Float32Array(n)
    const near = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const x = i * RIDGE_STEP
      // Ridged noise folds the fbm into creases and sharp tops.
      const ridged =
        Math.max(0, 1 - Math.abs(fbm1(x / 210, seed + 7, 4) - 0.5) * 2) ** 1.6
      const roll = fbm1(x / 560, seed, 3)
      const dm = feature(x, 1)
      const massif =
        Math.exp(-((dm / 170) ** 2)) * 0.085 +
        Math.exp(-(((dm + 120) / 90) ** 2)) * 0.03
      far[i] =
        this.horizon -
        H * (0.03 + 0.17 * (0.35 + 0.35 * roll + 0.45 * ridged) + massif)
      // The middle ridge rolls, then steps up a cliff onto a shelf that eases back down.
      const dc = feature(x, 2)
      const shelf = smoothstep(-10, 10, dc) * (1 - smoothstep(160, 340, dc))
      const rollM = fbm1(x / 380, seed + 101, 4)
      mid[i] =
        this.horizon - H * (0.01 + 0.1 * (0.5 + rollM * 0.8) + 0.035 * shelf)
      near[i] =
        this.horizon - H * 0.035 * (0.55 + fbm1(x / 680, seed + 202, 3) * 0.9)
    }
    this.ridges = [far, mid, near]
  }

  /** A ridge's outline as a path, closed down to `base`. */
  private ridgePath(ridge: Float32Array, base: number) {
    const path = new Shape()
    path.moveTo(-10, base)
    for (let i = 0; i < ridge.length; i++) path.lineTo(i * RIDGE_STEP, ridge[i])
    path.lineTo(this.width + 10, base)
    path.closePath()
    return path
  }

  /**
   * Strips under a ridge's crest, split into slopes that face the light at x = `toward` and slopes
   * that face away. `reach` scales how far down from the crest they run.
   */
  private slopes(
    ridge: Float32Array,
    layer: number,
    toward: number,
    reach: number,
    clear: number,
  ) {
    const lit = new Shape()
    const shade = new Shape()
    const depth = this.height * [0.05, 0.035, 0.02][layer] * reach
    const n = ridge.length
    // Which way each point faces, read over a wide window so a whole mountainside goes one way
    // instead of flickering with every crease: down toward the light faces it.
    const W = 6
    const face = (i: number) => {
      // Right under the sun or moon the ridge stands in front of it, its near face turned away:
      // lit there, the slope would print as the globe showing through the hill.
      if (Math.abs(i * RIDGE_STEP - toward) < clear) return 0
      const dy = ridge[Math.min(n - 1, i + W)] - ridge[Math.max(0, i - W)]
      return Math.abs(dy) < 2
        ? 0
        : Math.sign(dy) === Math.sign(toward - i * RIDGE_STEP)
          ? 1
          : -1
    }
    let i = 0
    while (i < n) {
      const f = face(i)
      let j = i
      while (j + 1 < n && face(j + 1) === f) j++
      if (f !== 0 && j > i) {
        // One shape per run: along the crest, then back along a line up to `depth` below it.
        const path = f > 0 ? lit : shade
        path.moveTo(i * RIDGE_STEP, ridge[i])
        for (let k = i + 1; k <= j; k++) path.lineTo(k * RIDGE_STEP, ridge[k])
        // Tapered to nothing at both ends, so a run doesn't stop at a hard vertical edge.
        for (let k = j; k >= i; k--)
          path.lineTo(
            k * RIDGE_STEP,
            ridge[k] + depth * smoothstep(0, 10, Math.min(k - i, j - k)),
          )
        path.closePath()
      }
      i = j + 1
    }
    return { lit, shade }
  }

  /** How strongly slopes are lit and in what colour: most with the sun low, a little under the moon. */
  private slopeLight(p: Palette) {
    const { sun, moon } = this.lights(p)
    return sun
      ? {
          light: (0.34 + 0.26 * this.sunLook(p).low) * sun,
          color: this.sunLook(p).color,
        }
      : { light: 0.42 * moon, color: p.globe }
  }

  /**
   * How much the range stands against a low sun, 0 to 1. The square root holds it while the sun
   * climbs clear of the crests.
   */
  private backlight(p: Palette) {
    const { sun } = this.lights(p)
    return sun > 0 ? sun * Math.sqrt(this.sunLook(p).low) : 0
  }

  /** Colour of each ridge: the farther, the more it fades toward the sky. */
  private ridgeColors(p: Palette): Rgb[] {
    // With the sun low the ridges stand against it, their near faces in shadow: they go toward
    // silhouette, the nearest most, while the far range keeps its haze.
    const back = this.backlight(p)
    return [
      mix(mix(p.hillFar, p.skyHorizon, 0.5), p.ground, 0.5 * back),
      mix(
        mix(mix(p.hillFar, p.hillNear, 0.45), p.skyHorizon, 0.25),
        p.ground,
        0.5 * back,
      ),
      mix(mix(p.hillNear, p.ground, 0.2), p.ground, 0.6 * back),
    ]
  }

  step(dt: number, palette: Palette) {
    this.time += dt
    this.env.palette = palette
    if (this.intro < INTRO) {
      this.intro += dt
      const k = easeInOut(Math.min(1, this.intro / INTRO))
      for (const [plant, age] of this.targetAge) plant.age = age * k - dt
      this.meadow.grow = Math.min(1, this.intro / (INTRO * 0.7))
      if (this.intro >= INTRO) {
        this.targetAge.clear()
        this.env.quiet = false
      }
    }
    for (let i = 0; i < this.plants.length; i++) {
      const plant = this.plants[i]
      plant.update(dt, this.env)
      if (plant.leaving && plant.fade <= 0) {
        this.plants.splice(i, 1)
        this.sown.splice(this.sown.indexOf(plant), 1)
        i--
        continue
      }
      if (plant.done) {
        const s = this.sown.indexOf(plant)
        if (s >= 0) {
          // Sown flowers don't reseed, so clicking can't fill the meadow.
          this.sown.splice(s, 1)
          this.plants.splice(i, 1)
          i--
          continue
        }
        // Gone to seed: a seedling of the same kind comes up close by.
        this.plants.splice(i, 1)
        const x = clamp(plant.x + (this.rng() - 0.5) * 120, 0, this.width)
        const z = clamp(plant.z + (this.rng() - 0.5) * 0.15, FARTHEST_Z, 1)
        if (this.plants.length < this.maxPlants()) this.add(plant.species, x, z)
        i--
      }
    }
    this.meadow.step(dt, this.wind)
    this.spawnAmbient(dt, palette)
    this.particles.step(dt, this.wind, this.width, this.height)
    this.butterflies.step(
      dt,
      this.heads,
      this.wind,
      this.width,
      this.height,
      palette,
    )
  }

  private spawnAmbient(dt: number, p: Palette) {
    let fireflies = 0
    let motes = 0
    for (const q of this.particles.list) {
      if (q.type === 'firefly') fireflies++
      else if (q.type === 'mote') motes++
    }
    const wantFire = Math.round(p.night ** 2 * (this.width / 30))
    if (fireflies < wantFire && this.rng() < dt * 4) {
      const z = 0.3 + this.rng() * 0.7
      this.particles.add(
        particle({
          type: 'firefly',
          x: this.rng() * this.width,
          y: this.floor(z) - this.height * (0.04 + this.rng() * 0.22),
          size: lerp(0.8, 1.9, z),
          color: [233, 240, 170],
          life: 25 + this.rng() * 25,
          depth: z,
        }),
      )
    }
    const wantMotes = Math.round((1 - p.night) * (this.width / 80))
    if (motes < wantMotes && this.rng() < dt * 2) {
      this.particles.add(
        particle({
          type: 'mote',
          x: this.rng() * this.width,
          y: this.horizon - this.height * 0.1 + this.rng() * this.height * 0.45,
          size: 0.9,
          color: p.fluff,
          life: 20 + this.rng() * 20,
        }),
      )
    }
  }

  draw(r: Raster, p: Palette) {
    // The sun and moon go down behind the hills, so the land is drawn over them.
    this.drawGlobe(r, p)
    // The land changes only with the hour; marked so the rasteriser can keep it filled.
    r.beginStill()
    this.drawLand(r, p)
    r.endStill()
    const haze = (z: number) => 0.68 * (1 - z) ** 1.6
    // After dark only the nearest flower clear of the text keeps full brightness; the rest step back.
    const dim = 0.28 * smoothstep(0.5, 1, p.night)
    let hero: Plant | null = null
    for (const plant of this.plants) {
      plant.dim = dim
      const clear =
        !this.keepClear ||
        plant.x < this.keepClear.left ||
        plant.x > this.keepClear.right
      if (
        (plant.species === 'poppy' || plant.species === 'cosmos') &&
        clear &&
        plant.x < this.width &&
        (!hero || plant.z > hero.z)
      )
        hero = plant
    }
    if (hero) hero.dim = 0
    let blade = 0
    for (const plant of this.plants) {
      blade = this.meadow.draw(r, p, blade, plant.z, haze)
      r.opacity = plant.fade
      plant.draw(r, this.env)
      r.opacity = 1
    }
    this.meadow.draw(r, p, blade, 2, haze)
    this.particles.draw(r, p.night)
    this.heads = r.heads.slice()
    this.butterflies.draw(r)
  }

  /** The highest painted ridge at x. */
  hillTop(x: number) {
    let top = this.horizon
    const i = clamp(
      Math.round(x / RIDGE_STEP),
      0,
      (this.ridges[0]?.length ?? 1) - 1,
    )
    for (const ridge of this.ridges) top = Math.min(top, ridge[i])
    return top
  }

  /** Hill silhouettes painted smooth under the glyphs, as solid as the poster's mountains. */
  backdrop(ctx: CanvasRenderingContext2D, p: Palette) {
    // A soft glow around the moon, or a warmer, wider one around the sun that grows as it sinks.
    const { sun, moon } = this.lights(p)
    if (sun + moon > 0) {
      const { cx, cy, R } = this.globeAt()
      const look = this.sunLook(p)
      const col = sun ? look.color : p.globe
      const strength = sun ? (0.2 + 0.12 * look.low) * sun : 0.16 * moon
      const reach = sun ? R * (6 + 4 * look.low) : R * 7
      const glow = ctx.createRadialGradient(cx, cy, R, cx, cy, reach)
      const gc = col.map((v) => v | 0).join(',')
      glow.addColorStop(0, `rgba(${gc},${strength})`)
      glow.addColorStop(1, `rgba(${gc},0)`)
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, this.width, this.height)
    }
    const colors = this.ridgeColors(p)
    // Backlit ridges lose most of their haze and mist, so they read as shapes against the glow.
    const thin = 1 - 0.6 * this.backlight(p)
    const hz = p.haze.map((v) => v | 0).join(',')
    const H = this.height
    for (const [layer, ridge] of this.ridges.entries()) {
      ctx.fillStyle = `rgb(${colors[layer].map((v) => v | 0).join(',')})`
      ctx.fill(this.ridgePath(ridge, this.horizon + 2).toPath2D())
      // Haze pooled low on the far and middle ridges, deepest at the foot, so each stands
      // clear of the one behind without an edge.
      if (layer < 2) {
        let top = this.horizon - 1
        for (const y of ridge) top = Math.min(top, y)
        const veil = ctx.createLinearGradient(0, top, 0, this.horizon)
        veil.addColorStop(0, `rgba(${hz},0)`)
        // Thinner by day, so the midday range keeps its body instead of washing into the sky.
        veil.addColorStop(
          1,
          `rgba(${hz},${(layer ? 0.3 : 0.4) * (0.45 + 0.55 * p.night) * thin})`,
        )
        ctx.fillStyle = veil
        ctx.fill(this.ridgePath(ridge, this.horizon).toPath2D())
      }
    }
    // The meadow runs on from the near ridge in its colour and eases down to the dark floor, so
    // hills and field are one surface. Eased stops keep the falloff free of a visible knee.
    const from = colors[2]
    const to = mix(p.ground, p.skyHorizon, 0.08)
    const floor = ctx.createLinearGradient(0, this.horizon, 0, H)
    for (let k = 0; k <= 8; k++) {
      const t = k / 8
      const c = mix(from, to, smoothstep(0, 0.55, t))
      floor.addColorStop(t, `rgb(${c.map((v) => v | 0).join(',')})`)
    }
    ctx.fillStyle = floor
    ctx.fillRect(0, this.horizon, this.width, H - this.horizon)
    // A soft band of mist over the horizon, rising and falling with the same easing.
    const top = this.horizon - H * 0.06
    const mist = ctx.createLinearGradient(0, top, 0, this.horizon + H * 0.12)
    for (let k = 0; k <= 8; k++) {
      const t = k / 8
      const a =
        t < 1 / 3 ? smoothstep(0, 1 / 3, t) : 1 - smoothstep(1 / 3, 1, t)
      mist.addColorStop(t, `rgba(${hz},${(0.32 * a * thin).toFixed(3)})`)
    }
    ctx.fillStyle = mist
    ctx.fillRect(0, top, this.width, H * 0.18)
  }

  /**
   * Snow on the far range's highest tops: everything above a ragged snowline set so high that
   * only the main massif reaches it. Paler and lit, so it prints as a denser halftone.
   */
  private drawSnow(r: Raster, ridge: Float32Array, color: Rgb, p: Palette) {
    const line = (k: number) =>
      this.horizon -
      this.height * (0.215 + 0.012 * (fbm1(k * 0.35, this.seed + 404, 2) - 0.5))
    const snow = new Shape()
    const n = ridge.length
    let top = this.horizon
    let i = 0
    while (i < n) {
      if (ridge[i] >= line(i)) {
        i++
        continue
      }
      let j = i
      while (j + 1 < n && ridge[j + 1] < line(j + 1)) j++
      snow.moveTo(i * RIDGE_STEP, ridge[i])
      for (let k = i + 1; k <= j; k++) snow.lineTo(k * RIDGE_STEP, ridge[k])
      for (let k = j; k >= i; k--) snow.lineTo(k * RIDGE_STEP, line(k))
      snow.closePath()
      for (let k = i; k <= j; k++) top = Math.min(top, ridge[k])
      i = j + 1
    }
    if (top === this.horizon) return
    // Cream by day; under the moon it only greys a little, so night stays dark.
    r.fill(
      snow,
      mix(color, [250, 248, 240], 0.85 * (1 - 0.6 * p.night)),
      Kind.Land,
      1,
      {
        id: 0,
        light: 0.8 - 0.2 * p.night,
        back: false,
      },
    )
    r.touchMeta(0, top)
    r.touchMeta(this.width, this.horizon)
  }

  private drawLand(r: Raster, p: Palette) {
    const W = this.width
    const colors = this.ridgeColors(p)
    // Slopes facing the sun (or moon) catch light under the crest and the far sides fall into
    // shade. Only the glyphs carry it: lit slopes print a denser, brighter halftone.
    const { cx, R } = this.globeAt()
    const { light, color: lightCol } = this.slopeLight(p)
    // A low sun sits behind the range, so the slopes we see face away from it: the light only
    // catches a rim along the crest and the shade side deepens.
    const rim = this.lights(p).sun > 0 ? this.sunLook(p).low : 0
    this.ridges.forEach((ridge, layer) => {
      r.fill(this.ridgePath(ridge, this.height + 10), colors[layer], Kind.Land)
      // Four strips, each shallower and stronger, so the glyphs thicken toward the crest.
      const q = clamp(light / 0.45, 0, 1)
      for (const [k, reach] of (light > 0
        ? [1, 0.7, 0.45, 0.25]
        : []
      ).entries()) {
        const s = q * (0.35 + 0.65 * (k / 3))
        const sl = s * (1 - rim * (1 - k / 3))
        const { lit, shade } = this.slopes(ridge, layer, cx, reach, R * 1.5)
        r.fill(
          lit,
          mix(colors[layer], lightCol, Math.min(1, 1.6 * light * sl)),
          Kind.Land,
          1,
          { id: 0, light: 0.5 + 0.5 * sl, back: false },
        )
        r.fill(
          shade,
          mix(colors[layer], p.ground, light * 0.6 * s * (1 + 0.6 * rim)),
          Kind.Land,
          1,
          { id: 0, light: 0.5 - 0.5 * s, back: false },
        )
      }
      if (layer === 0) this.drawSnow(r, ridge, colors[0], p)
    })
    if (light > 0) {
      let top = this.horizon
      for (const ridge of this.ridges)
        for (const y of ridge) top = Math.min(top, y)
      r.touchMeta(0, top)
      r.touchMeta(W, this.horizon)
    }
    // Meadow floor, darkening toward the viewer.
    const ground = new Shape()
    ground.rect(-10, this.horizon, W + 20, this.height - this.horizon + 10)
    r.fill(ground, p.hillNear, Kind.Land)
    r.gradient(ground, this.horizon, this.height, [
      [0, mix(p.hillNear, p.grassDark, 0.4), 1],
      [1, p.ground, 1],
    ])
    // Low mist on the horizon, colour only, so the land underneath keeps its kind. It thins
    // against a low sun so the backlit ridges keep their shadow.
    const veil = 0.55 * (1 - 0.6 * this.backlight(p))
    const mist = new Shape()
    mist.rect(
      -10,
      this.horizon - this.height * 0.08,
      W + 20,
      this.height * 0.14,
    )
    r.gradient(
      mist,
      this.horizon - this.height * 0.08,
      this.horizon + this.height * 0.06,
      [
        [0, p.haze, 0],
        [0.55, p.haze, veil],
        [1, p.haze, 0],
      ],
    )
  }

  /** Sun by day, moon by night: a turning wireframe globe on a dashed orbit, after the poster. */
  /** Where the sun or moon is: across the sky by day, and again by night. */
  private globeAt() {
    const day = this.hour >= 6 && this.hour < 18.5
    const t = day
      ? (this.hour - 6) / 12.5
      : ((this.hour + 24 - 18.5) % 24) / 11.5
    return {
      cx: lerp(0.12, 0.62, t) * this.width,
      cy:
        this.horizon -
        Math.sin(Math.PI * clamp(t, 0, 1)) * this.height * 0.36 -
        this.height * 0.03,
      R: Math.min(this.width, this.height) * 0.075,
    }
  }

  /** How strongly the ridge crest catches the light: under the moon, or as the sun sets behind it. */
  /** How much of the sun and the moon shows: the sun by day, the moon once the night is deep. */
  private lights(p: Palette) {
    const h = this.hour
    const day = h >= 6 && h < 18.5
    const moon = day ? 0 : smoothstep(0.5, 0.9, p.night) * p.moonlight
    // The sun comes up over three quarters of an hour and goes down the same way, rather than
    // switching on at six like a lamp.
    const sun = day
      ? smoothstep(6, 6.75, h) * (1 - smoothstep(17.75, 18.5, h))
      : 0
    return { sun, moon }
  }

  /** The sun's look by height: pale and round overhead; low, it swells, flattens and reddens. */
  private sunLook(p: Palette) {
    const { cy, R } = this.globeAt()
    const low = 1 - smoothstep(0, this.height * 0.32, this.horizon - cy)
    const warm = mix(
      mix(p.globe, [255, 196, 120], 0.35 + 0.4 * low),
      [236, 96, 52],
      low * low * 0.8,
    )
    return {
      low,
      color: warm,
      rx: R * (1 + 0.22 * low),
      ry: R * (1 + 0.22 * low) * (1 - 0.1 * low),
    }
  }

  /** The glows move with the sun and moon, so the cached backdrop repaints as they do. */
  backdropKey(p: Palette) {
    const { sun, moon } = this.lights(p)
    if (sun + moon <= 0) return ''
    const { cx, cy } = this.globeAt()
    return `${Math.round(cx / 4)},${Math.round(cy / 4)},${sun.toFixed(2)},${moon.toFixed(2)},${(this.moonPhase ?? moonPhaseNow()).toFixed(3)}`
  }

  /** The moon's lit and dark parts for tonight's phase, with which side is lit and how full it is. */
  private moonShape() {
    const { cx, cy, R } = this.globeAt()
    const f = this.moonPhase ?? moonPhaseNow()
    const side = f < 0.5 ? 1 : -1
    const k = Math.cos(TAU * f)
    const lit = new Shape()
    const dark = new Shape()
    const N = 24
    for (let i = 0; i <= N; i++) {
      const a = -Math.PI / 2 + (i / N) * Math.PI
      lit.lineTo(cx + side * R * Math.cos(a), cy + R * Math.sin(a))
      dark.lineTo(cx - side * R * Math.cos(a), cy + R * Math.sin(a))
    }
    for (let i = N; i >= 0; i--) {
      const a = -Math.PI / 2 + (i / N) * Math.PI
      const x = cx + side * k * R * Math.cos(a)
      lit.lineTo(x, cy + R * Math.sin(a))
      dark.lineTo(x, cy + R * Math.sin(a))
    }
    return { lit, dark, side, k }
  }

  /** By day a halftone sun, after dark the moon; both go down behind the hills. */
  private drawGlobe(r: Raster, p: Palette) {
    const { cx, cy, R } = this.globeAt()
    const { sun, moon } = this.lights(p)
    if (sun > 0) {
      // Solid at the core, thinning to a sparse halo of dots at the edge, like a halftone print.
      const { color, rx, ry } = this.sunLook(p)
      const halo = new Shape()
      halo.ellipse(cx, cy, rx * 1.45, ry * 1.45, 0, 0, TAU)
      r.fill(halo, color, Kind.Fluff, 0.14 * sun)
      const rim = new Shape()
      rim.ellipse(cx, cy, rx * 1.15, ry * 1.15, 0, 0, TAU)
      r.fill(rim, color, Kind.Fluff, 0.35 * sun)
      const disc = new Shape()
      disc.ellipse(cx, cy, rx, ry, 0, 0, TAU)
      r.fill(disc, mix(color, [255, 250, 235], 0.25), Kind.Fluff, sun)
    }
    if (moon > 0) {
      // Lit by the phase: the bright limb on the right while waxing, on the left while waning,
      // and the terminator an ellipse that bows toward the light in a crescent, away in a gibbous.
      const { lit, dark, side, k } = this.moonShape()
      r.fill(lit, p.globe, Kind.Fluff, moon)
      // Earthshine on the dark side.
      r.fill(dark, mix(p.globe, p.skyTop, 0.85), Kind.Fluff, 0.22 * moon)
      // The seas, as darker patches wherever they fall on the lit face.
      const seas = new Shape()
      for (const [sx, sy, rx, ry] of SEAS) {
        const dy = clamp(sy, -0.99, 0.99)
        const edge = side * k * Math.sqrt(1 - dy * dy)
        if (side * sx < side * edge + rx) continue
        seas.moveTo(cx + (sx + rx) * R, cy + sy * R)
        seas.ellipse(cx + sx * R, cy + sy * R, rx * R, ry * R, 0, 0, TAU)
      }
      r.fill(seas, mix(p.globe, p.skyTop, 0.6), Kind.Fluff, moon)
    }
  }
}

/** Darker seas on the moon's face, as [x, y, rx, ry] in moon radii from its centre. */
const SEAS: [number, number, number, number][] = [
  [0.3, -0.3, 0.22, 0.17],
  [-0.25, -0.15, 0.2, 0.24],
  [0.15, 0.35, 0.16, 0.13],
  [-0.4, 0.3, 0.12, 0.15],
]

/**
 * Where the moon is in its month, 0..1 from new through full (0.5) and back, from a known new
 * moon and the mean synodic month. Kept off the dark new moon, which would just look missing.
 */
function moonPhaseNow() {
  const days = Date.now() / 86_400_000 - 10_957.76
  const f = (((days / 29.530_59) % 1) + 1) % 1
  return clamp(f, 0.07, 0.93)
}
