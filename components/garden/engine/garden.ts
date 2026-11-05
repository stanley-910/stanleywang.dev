import { Butterflies } from './butterflies'
import { Friends } from './friends'
import {
  clamp,
  easeInOut,
  fbm1,
  hash,
  lerp,
  mulberry32,
  noise1,
  smoothstep,
  TAU,
} from './math'
import { Meadow, STRIP } from './meadow'
import { css, mix, type Palette, type Rgb } from './palette'
import { particle, Particles } from './particles'
import {
  createPlant,
  Dandelion,
  Rose,
  RUSH,
  type Env,
  type Plant,
  type Species,
} from './plants'
import {
  GLOBE,
  type Head,
  Kind,
  LandMat,
  type Raster,
  RIVER_SPAN,
  Shape,
} from './raster'

import type { Rect } from './ascii'
import type { Visitors } from './visitors'
import type { Wind } from './wind'

/** How many clicked-in flowers stay at once. */
const SOWN_MAX = 8

const SPECIES: [Species, number][] = [
  ['poppy', 0.56],
  ['cosmos', 0.31],
  // Umbels print as a block at a distance, so they stay rare.
  ['lace', 0.05],
  ['dandelion', 0.08],
]

/** Where the poem's rose roots: the near meadow, well up from the screen's foot. */
const ROSE_Z = 0.72

/** Seconds the opening time-lapse takes to grow the garden in. */
const INTRO = 4.5
/** Spacing of the ridge outline's points. */
const RIDGE_STEP = 6
/** Peaks lower than this, as a share of the screen height above the horizon, carry no snow. */
const SNOW_MIN = 0.08
/** Spacing of the relief field on the far range, in px; finer than a glyph cell. */
const FACE_STEP = 5
/**
 * Meadows picked by hand: laid out headlessly for 1,200 seeds at 1440×900, 1280×800 and
 * 1000×620, scored for feature flowers framing the bio on both sides, both species among them,
 * no head on the text, no clumps and no bare stretch, then chosen from sketches of the best.
 */
const GOOD_SEEDS = [
  1715089390, 1332910544, 1873212057, 171079793, 2115706067, 1349393922,
]
/** The land's seed, fixed: its roughness and tree heights stay as composed on every visit. */
const LAND_SEED = 1
/**
 * The far range, composed by hand: each point is [share of the range's width, height as a share
 * of the screen height above the horizon]. Peaks join in straight runs, so they stay pointed; a
 * little ridged noise roughens the crest. Two snowy massifs, the main one left of centre.
 */
const FAR_RANGE: [number, number][] = [
  [0, 0.15],
  [0.04, 0.17],
  [0.08, 0.12],
  [0.12, 0.16],
  [0.155, 0.13],
  [0.19, 0.19],
  [0.225, 0.15],
  [0.26, 0.21],
  [0.31, 0.27],
  [0.345, 0.215],
  [0.37, 0.225],
  [0.41, 0.15],
  [0.47, 0.11],
  [0.53, 0.085],
  [0.58, 0.07],
  [0.63, 0.095],
  [0.665, 0.125],
  [0.705, 0.105],
  [0.75, 0.14],
  [0.8, 0.17],
  [0.85, 0.215],
  [0.885, 0.17],
  [0.92, 0.185],
  [0.96, 0.13],
  [1, 0.15],
]
/** The massifs that carry snow, by share of the range's width. */
const SNOW_PEAKS = [0.31, 0.85]
/** The sun's and moon's glows at their strongest, as alpha over the sky. */
const SUN_GLOW = 0.22
const MOON_GLOW = 0.1
/**
 * A tile of noise, 0 to 1, that scatters each pixel of a glow a couple of alpha steps up or down.
 * One step isn't enough: on a dark sky two neighbouring alphas often land on the same 8-bit colour,
 * which holds flat for a stretch and shows as a ring.
 */
const DITHER = 64
const dither = (() => {
  const rng = mulberry32(7)
  return Float32Array.from({ length: DITHER * DITHER }, () => rng())
})()

/** The low saddle between them, where the sun and moon go down. */
const SADDLE = 0.58
/** The notch left of the main massif, where the sun and moon come up on a narrow screen. */
const DAWN = 0.225
/**
 * Hidden ridgelines that set the far range's faces, placed by hand: the peak they run down from,
 * which way, how far (a share of the peak's height) and how much across per px down.
 */
const RIDGELINES: { at: number; dir: -1 | 1; len: number; lean: number }[] = [
  { at: 0.31, dir: -1, len: 0.8, lean: 0.75 },
  { at: 0.31, dir: 1, len: 0.85, lean: 0.65 },
  { at: 0.19, dir: -1, len: 0.6, lean: 0.7 },
  { at: 0.26, dir: -1, len: 0.5, lean: 0.9 },
  { at: 0.37, dir: 1, len: 0.6, lean: 0.7 },
  { at: 0.665, dir: -1, len: 0.5, lean: 0.8 },
  { at: 0.75, dir: 1, len: 0.5, lean: 0.7 },
  { at: 0.85, dir: -1, len: 0.75, lean: 0.7 },
  { at: 0.85, dir: 1, len: 0.7, lean: 0.75 },
  { at: 0.92, dir: 1, len: 0.5, lean: 0.8 },
]
/**
 * The range is never narrower than this many screen heights, so its peaks keep their shape: a
 * screen narrower than that shows a stretch of it, from the main summit to the saddle.
 */
const RANGE_ASPECT = 0.9
/** How far the lit face of a hidden ridgeline reaches, and its narrower shadow, in px. */
const FACE_LIT = 80
const FACE_SHADE = 36
/**
 * The middle ridge's forest, three rows back to front: how far down the slope each starts, how
 * tall its spires stand, and where across the screen it grows, placed by hand.
 */
const FOREST_ROWS = [
  { drop: 0, hMin: 0.8, hVar: 1.2, at: [[0, 1]] },
  {
    drop: 0.12,
    hMin: 0.9,
    hVar: 1.4,
    at: [
      [0, 0.18],
      [0.27, 0.6],
      [0.74, 1],
    ],
  },
  {
    drop: 0.3,
    hMin: 1,
    hVar: 1.6,
    at: [
      [0.1, 0.2],
      [0.42, 0.56],
      [0.82, 0.95],
    ],
  },
]
/** Spruce stands on the near ridge, placed by hand: where across the screen, and how many trees. */
const SPRUCE_STANDS = [
  [0.05, 4],
  [0.31, 3],
  [0.55, 5],
  [0.66, 3],
  [0.9, 5],
]
const FOREST_STEP = 2
/** Stones in the water, placed by hand: how far along the course, and where across it (-1..1). */
const RIVER_STONES: [number, number, number][] = [
  [0.6, -0.75, 0.7],
  [0.7, 0.8, 0.9],
  [0.79, -0.95, 1.2],
  [0.84, 0.6, 0.6],
  [0.9, -0.55, 0.8],
  [0.95, 0.9, 1.4],
]
/** Depth of the farthest planting: a field away, short of the hills, so nothing roots on them. */
const FARTHEST_Z = 0.22

export class Garden {
  width = 1
  height = 1
  horizon = 1
  plants: Plant[] = []
  meadow = new Meadow()
  particles = new Particles()
  /** Who answers a click on a flower: butterflies, or on the poem the ladybug and bumblebee. */
  visitors: Visitors = new Butterflies()
  /** Flower heads as last drawn, for clicks and butterflies to find. */
  heads: Head[] = []
  private rng = mulberry32(1)
  /**
   * The meadow's seed: one of the picked meadows (GOOD_SEEDS) each load, so a visit never gets a
   * poor one. The land (range, snow, faces, trees) is placed by hand and keeps LAND_SEED.
   */
  private seed = GOOD_SEEDS[Math.floor(Math.random() * GOOD_SEEDS.length)]

  /** Grows this meadow instead, from the next layout on: `?seed=` pins one, for measuring. */
  useSeed(seed: number) {
    this.seed = seed
  }
  private targetAge = new Map<Plant, number>()
  private intro = 0
  private ridges: Float32Array[] = []
  /** Where snow starts on the far range at each ridge point, as a screen y; NaN where there's none. */
  private snowline = new Float32Array(0)
  /** Each snowy massif's true summit, on screen. */
  private summits: { x: number; y: number }[] = []
  /** The glyph grid's cell, in scene px, so the backdrop can paint to the cells' rows. */
  cell = { cw: 5, ch: 7 }
  /**
   * The far range's faces: for each point of a coarse grid, the distance to the nearest hidden
   * ridgeline, which side of it the point lies on, and where the ridgeline is.
   */
  private faces: {
    cols: number
    rows: number
    top: number
    d: Float32Array
    side: Int8Array
    qx: Float32Array
  } | null = null
  /** The middle ridge's forest rows, back to front, and the spruce stands on the near ridge. */
  private forest: Shape[] = []
  /** A low treeline along the near ridge's crest, and the highest point of it. */
  private scrub = new Shape()
  private scrubTop = 0
  private spruce: Shape[] = []
  private treeTop = 0
  /**
   * The top of the land, ridges and trees, every FOREST_STEP px from -FOREST_STEP: the painted
   * backdrop has no cells to say where it stands, so what covers the globe asks this instead.
   */
  private skyline = new Float32Array(0)
  /**
   * The river that comes out of the trees toward us: its water and its banks, the stones and islet
   * in it, the spruce on its banks, and how far down the screen it reaches.
   */
  private riverShape = new Shape()
  private shoreShape = new Shape()
  private stones: Shape[] = []
  private islet = new Shape()
  private bankTrees: Shape[] = []
  private riverEnd = 0
  /** The course's middle points and breadths, which riverField reads. */
  private course: {
    mid: number[][]
    tx: Float32Array
    ty: Float32Array
    wl: number[]
    wr: number[]
    sw: number[]
  } | null = null
  /** Counts each rebuild of the river, so a field worked out for the last one can be kept. */
  riverVersion = 0
  /** The course's points filed by the 4px rows their cross-sections cover. */
  private riverBins = new Map<number, number[]>()
  /** Per 8px of width, the nearest row a plant may root behind the river, -Infinity where none. */
  private shoreline = new Float32Array(0)
  /** Plants sown by clicking, oldest first. */
  private sown: Plant[] = []
  time = 0
  hour = 15
  /** Where the bio sits. Flowers aren't planted under it and the grass thins out there. */
  keepClear: Rect | null = null
  /**
   * The text over `keepClear` runs the screen's full height (the poem), so the grass grows under
   * it and only a few dandelions flower there.
   */
  keepClearColumn = false
  /** Strips planted so far, and the window height they were grown for. */
  private strips = 0
  /** Overrides the moon's phase (0 new, 0.5 full) for testing; null follows the calendar. */
  moonPhase: number | null = null
  private grownFor = 0
  /**
   * The glows' dithered alpha, cached by size, and the same tinted, with the tint's colour: one for
   * the sun (by its pixel step, 2) and one for the moon (1), so a scrub across dusk re-makes neither.
   */
  private glows = new Map<
    number,
    {
      key: string
      mask: HTMLCanvasElement
      tint: HTMLCanvasElement
      tinted: string
    }
  >()
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
      ceiling: 0,
      quiet: true,
    }
    this.particles.onLand = (p) => {
      // Now and then a pappus that lands takes root, on home; the poem keeps the flowers it sets.
      if (
        p.type === 'pappus' &&
        !this.keepClearColumn &&
        this.rng() < 0.04 &&
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
    // The near ridge's tree stands start about 2–5% of the height above the horizon.
    this.env.ceiling = this.horizon - height * 0.02
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
    // The river first, so the grass knows where not to grow.
    this.buildRidges()
    this.meadow.build(
      this.width,
      this.height,
      (z) => this.floor(z),
      this.seed * 7 + 3,
      this.keepClearColumn ? null : this.keepClear,
      (x, y) => this.dry(x, y),
    )
  }

  regrow(seed: number) {
    this.seed = seed
    this.rng = mulberry32(seed)
    this.plants = []
    this.targetAge.clear()
    this.particles.list = []
    this.visitors.clear()
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
    // The river first, so the grass knows where not to grow.
    this.buildRidges()
    this.meadow.build(
      this.width,
      this.height,
      (z) => this.floor(z),
      seed * 7 + 3,
      this.keepClearColumn ? null : this.keepClear,
      (x, y) => this.dry(x, y),
    )
  }

  /** Plants the strips the window now reaches into, each from its own seed. */
  private extend() {
    for (; this.strips * STRIP < this.width; this.strips++) {
      const rng = mulberry32(this.seed * 7919 + this.strips * 104729 + 17)
      // Large flowers up front carry the scene, a middle band fills in, and small far ones are texture.
      const tiers: [number, number, number][] = [
        [STRIP / 260, 0.55, 0.95],
        [STRIP / 250, 0.38, 0.6],
        [STRIP / 190, FARTHEST_Z, 0.42],
      ]
      for (const [rate, z0, z1] of tiers) {
        const n = Math.floor(rate + rng())
        for (let i = 0; i < n; i++) {
          let z = 0
          let x = 0
          let species = this.pickSpecies(rng)
          if (this.keepClearColumn) {
            // Under a column of text only a few dandelions, small enough to read over.
            z = lerp(z0, z1, rng())
            x = (this.strips + rng()) * STRIP
            if (this.underText(x, z)) {
              if (rng() > 0.12) continue
              species = 'dandelion'
            }
          }
          const seed = Math.floor(rng() * 1e9)
          let plant: Plant | null = null
          if (this.keepClearColumn)
            plant = createPlant(species, x, z, seed, this.env)
          else {
            // Like the koi swimming off the text: try spots until one whose head is clear of it.
            // None after 40 tries, and the strip goes without rather than cover the bio.
            for (let t = 0; t < 40 && !plant; t++) {
              z = lerp(z0, z1, rng())
              x = (this.strips + rng()) * STRIP
              const p = createPlant(species, x, z, seed, this.env)
              if (!this.covers(p)) plant = p
            }
            if (!plant) continue
          }
          this.place(plant)
          // During the opening they grow in with the rest; later strips arrive grown.
          if (this.intro < INTRO) this.targetAge.set(plant, plant.bloomAge())
          else plant.age = plant.bloomAge()
        }
      }
    }
  }

  /**
   * True when this plant's head, full grown, would land on the bio. Stems may pass behind it.
   * It reads the plant's own stem, so it holds now stems stop under the tree line: a guess from
   * an uncapped stem put most gardens' heads on the text.
   */
  private covers(plant: Plant) {
    const b = this.keepClear
    if (!b) return false
    const y = this.floor(plant.z) - plant.stems[0].length
    const r = plant.crown
    // A head nods in from a root beside the text, so it needs a little room sideways.
    const m = this.width * 0.03 + r
    return (
      plant.x > b.left - m &&
      plant.x < b.right + m &&
      y + r > b.top - this.height * 0.02 &&
      y - r < b.bottom
    )
  }

  /** True when a plant rooted here would hold its flower over the bio. Stems may pass behind it. */
  private underText(x: number, z: number) {
    const b = this.keepClear
    if (!b) return false
    // A column's text crosses every height, so a near flower's wide head, nodding in from a
    // root beside it, needs more room than the bio's.
    const margin =
      this.width * 0.03 + (this.keepClearColumn ? this.height * 0.2 * z : 0)
    if (x < b.left - margin || x > b.right + margin) return false
    // Rough flower height: shortest stems, at this depth's scale.
    const head =
      this.floor(z) - this.height * 0.28 * lerp(0.26, 1.18, z ** 1.15)
    return head > b.top - this.height * 0.08
  }

  /** Whether the first load's grow-in is still to finish. */
  get growing() {
    return this.intro < INTRO
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
    return this.place(createPlant(species, x, z, seed, this.env))
  }

  /** Whether (x, y) is in the river or on its banks, where nothing grows. */
  wet(x: number, y: number) {
    return this.acrossAt(x, y) !== null
  }

  /** The nearest row a plant at x may root, below the horizon where the river lies behind. */
  private shoreAt(x: number) {
    const s = this.shoreline
    return s.length
      ? s[Math.min(s.length - 1, Math.max(0, Math.floor(x / 8)))]
      : -Infinity
  }

  /** Whether a plant rooted at (x, y) would stand in, beside or past the river. */
  private dry(x: number, y: number) {
    return y < this.shoreAt(x) || this.wet(x, y)
  }

  /** Keeps plants sorted far to near, so nearer ones draw over. */
  private place(plant: Plant) {
    let i = this.plants.length
    while (i > 0 && this.plants[i - 1].z > plant.z) i--
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

  /** Has the ladybug and bumblebee answer clicks instead of butterflies. */
  useFriends() {
    this.visitors = new Friends()
  }

  /** Under reduced motion the visitors that can, keep still. */
  holdStill(still: boolean) {
    this.visitors.still?.(still)
  }

  /** Ends what a tap on a visitor set off. */
  calmVisitors() {
    this.visitors.calm?.()
  }

  /** A click on a visitor, before it can reach a flower; true when one took it. */
  tapVisitor(x: number, y: number, reach: number) {
    return this.visitors.tap?.(x, y, reach) ?? false
  }

  /**
   * Grows the poem's one rose, rooted in the meadow at x, to `grown` (0 seed to 1 in full
   * flower), and returns it. It never grows back down.
   */
  rose(x: number, grown: number) {
    const have = this.plants.find((p): p is Rose => p instanceof Rose)
    if (have) {
      have.goal = Math.max(have.goal, grown * have.bloomAge())
      return have
    }
    const rose = this.add('rose', x, ROSE_Z) as Rose
    rose.goal = grown * rose.bloomAge()
    // Whatever flowers near it fades back into the grass, to leave it alone.
    const room = this.width * 0.22
    for (const p of this.plants)
      if (p !== rose && Math.abs(p.x - x) < room) p.leaving = true
    return rose
  }

  /** Calls a visitor to the flower under the click. */
  /** A click on a dandelion shakes it, and puffs a seed clock out. Whether one was there. */
  poke(x: number, y: number) {
    // The nearest in front first, as they're drawn back to front.
    for (let k = this.plants.length - 1; k >= 0; k--) {
      const p = this.plants[k]
      if (p instanceof Dandelion && p.hit(x, y)) {
        p.poke()
        return true
      }
    }
    return false
  }

  visit(head: Head) {
    if (head.owner)
      this.visitors.summon(head.owner, this.heads, this.env.palette)
  }

  /** Sow where the user clicked, cycling through the species. */
  sow(x: number, y: number) {
    // A click on the sky sows at the horizon below it, and one beside or past the river at the
    // nearest row clear of it.
    const z = Math.max(
      FARTHEST_Z,
      this.depthAt(Math.max(y, this.shoreAt(x) + 1)),
    )
    // Nothing takes root in the river.
    if (this.dry(x, this.floor(z))) return false
    const plant = this.add(this.pickSpecies(), x, z)
    plant.hurry()
    // Now and then a sown flower draws a visitor once it opens; a click on a flower always does.
    if (this.rng() < 0.2) this.visitors.later(plant, RUSH + 1)
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

  /** How wide the whole range is drawn, in px: the screen's width, or more on a narrow screen. */
  private get rangeWidth() {
    return Math.max(this.width, this.height * RANGE_ASPECT)
  }

  /**
   * Where a point of the composed range (a share of its width) falls on screen. The whole range
   * spans a wide screen; a narrow one shows the stretch from the dawn notch, a tenth of the way
   * in, past the saddle, so the peaks keep their shape and the sun rises and sets in a valley.
   * Both are shares of the screen, so the home page and the poem, at different zooms, match.
   */
  private rangeX(u: number) {
    const span = this.width / this.rangeWidth
    const u0 = clamp(DAWN - span * 0.1, 0, 1 - span)
    return ((u - u0) / span) * this.width
  }

  /**
   * Three ridges with their own characters: a far range composed by hand (FAR_RANGE), a low,
   * gently rolling middle ridge, and a low, soft near ridge.
   */
  private buildRidges() {
    const n = Math.ceil(this.width / RIDGE_STEP) + 2
    const H = this.height
    const seed = LAND_SEED * 13
    const span = this.width / this.rangeWidth
    const x0 = this.rangeX(0)
    const xs = FAR_RANGE.map(([u]) => this.rangeX(u))
    const farAt = (x: number) => {
      let k = 0
      while (k < xs.length - 2 && x > xs[k + 1]) k++
      const t = clamp((x - xs[k]) / (xs[k + 1] - xs[k]), 0, 1)
      const h = lerp(FAR_RANGE[k][1], FAR_RANGE[k + 1][1], t)
      // Rough the crest at the range's own scale, so the texture is part of the composition.
      const u = ((x - x0) / this.width) * span * 1250
      const crag =
        Math.max(0, 1 - Math.abs(fbm1(u / 45, seed + 7, 3) - 0.5) * 2) ** 1.6
      return (
        this.horizon -
        H * (h + 0.012 * crag + 0.004 * (fbm1(u / 14, seed + 9, 2) - 0.5))
      )
    }
    // The middle ridge is a low, gently rolling band, forested along its crest. With knolls, the
    // tree rows piled up on each one into a dark spiked pyramid.
    // A single broad swell read as one smooth arc under the trees, so the swell is shallow and a
    // shorter roll breaks it up.
    const midAt = (x: number) =>
      this.horizon -
      H *
        (0.042 +
          0.02 * (fbm1(x / 420, seed + 101, 3) - 0.5) +
          0.012 * (fbm1(x / 130, seed + 103, 2) - 0.5))
    // The near ridge stays a low, gentle rise under the middle ridge's crest. Taller, its swell
    // hid the forest but for pale humps poking over it, and read as one smooth arc.
    const nearAt = (x: number) =>
      this.horizon - H * (0.016 + 0.012 * (fbm1(x / 680, seed + 202, 3) - 0.5))
    const far = new Float32Array(n)
    const mid = new Float32Array(n)
    const near = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const x = i * RIDGE_STEP
      far[i] = farAt(x)
      mid[i] = midAt(x)
      near[i] = nearAt(x)
    }
    this.ridges = [far, mid, near]
    this.buildSnowline(SNOW_PEAKS.map((u) => this.rangeX(u)))
    this.buildFaces()
    this.buildForest(midAt, nearAt)
    this.buildRiver()
  }

  /**
   * The river comes out from the trees' foot and winds toward us to the left edge, widening as it
   * nears, never behind the bio's text. It's built as strips across the flow, the water's from
   * bank to bank and the banks' out into the meadow, each carrying where across it lies, so the
   * type can draw the current's lines along it and the banks' bands beside it.
   */
  private buildRiver() {
    const H = this.height
    const hz = this.horizon
    const seed = LAND_SEED * 17
    const CH = Math.min(H, 0.62 * this.rangeWidth) * 0.0125
    // Laid out like the range, on its own proportions and never the text's, so every screen and
    // zoom shows the same river, a phone a crop of it as it is of the hills.
    const U = Math.min(H, 0.62 * this.rangeWidth)
    // Half its breadth: the far landscape's perspective, not the flowers', which are inches tall
    // and close. In proportion to how far below the horizon it lies, so it opens up as it nears.
    const width = (y: number, breadth: number) =>
      (0.0015 * U + 0.24 * (y - hz)) * breadth
    // It comes in from off the left edge and crosses in two broad bends into the middle of the
    // forest. Placed by hand: shares of the range across, and of U down from the horizon.
    const pts: [number, number][] = (
      [
        [0.52, 0],
        [0.43, 0.01],
        [0.35, 0.026],
        [0.3, 0.052],
        [0.21, 0.078],
        [0.1, 0.092],
        [0, 0.12],
        [-0.1, 0.17],
      ] as const
    ).map(([u, f]) => [this.rangeX(u), f * U])
    const raw: [number, number][] = []
    for (let j = 0; j < pts.length - 1; j++)
      for (let q = 0; q < 40; q++) {
        const t = q / 40
        const [p0, p1, p2, p3] = [j - 1, j, j + 1, j + 2].map(
          (i) => pts[clamp(i, 0, pts.length - 1)],
        )
        const at = (a: number, b: number, c: number, d: number) =>
          0.5 *
          (2 * b +
            (c - a) * t +
            (2 * a - 5 * b + 4 * c - d) * t * t +
            (3 * b - a - 3 * c + d) * t * t * t)
        raw.push([
          at(p0[0], p1[0], p2[0], p3[0]),
          hz + 3 + at(p0[1], p1[1], p2[1], p3[1]),
        ])
      }
    raw.push([pts[pts.length - 1][0], hz + 3 + pts[pts.length - 1][1]])
    // Resampled every 1.5px along its length, so a sideways run is as finely drawn as one
    // toward us.
    const line: [number, number, number][] = []
    {
      let carry = 0
      for (let j = 1; j < raw.length; j++) {
        const [ax, ay] = raw[j - 1]
        const [bx, by] = raw[j]
        const l = Math.hypot(bx - ax, by - ay)
        while (carry <= l) {
          const f = carry / l
          line.push([lerp(ax, bx, f), lerp(ay, by, f), 0])
          carry += 1.5
        }
        carry -= l
      }
      const L = line.length
      for (let k = 0; k < L; k++)
        // Its breadth swells and narrows along the way, pools in the bends and runs at the necks.
        line[k][2] = 0.85 + 0.35 * fbm1((k / L) * 6, seed + 3, 2)
    }
    // Smoothed, so the bends run without kinks where the points meet.
    for (let pass = 0; pass < 24; pass++)
      for (let k = 1; k < line.length - 1; k++)
        for (const d of [0, 1])
          line[k][d] = (line[k - 1][d] + 2 * line[k][d] + line[k + 1][d]) / 4
    const n = line.length
    const mid = line.map(([x, y, b]) => [x, y, width(y, b)])
    // Each bank its own ragged edge, as rock and gravel make it, broad wobbles and small bites.
    const edge = (k: number, salt: number) =>
      1 +
      0.3 * (fbm1(k / 9, seed + salt, 2) - 0.5) +
      0.16 * (fbm1(k / 2.5, seed + salt + 1, 2) - 0.5)
    const wl = mid.map((m, k) => m[2] * edge(k, 11))
    const wr = mid.map((m, k) => m[2] * edge(k, 23))
    // The banks reach out a little more than half the water's breadth, at least a cell's worth.
    const sw = mid.map((m) => 0.6 * m[2] + 0.5 * CH)
    let end = hz
    for (const [, y] of mid) end = Math.max(end, y)
    // Across the flow, -1..1 bank to bank, out to ±RIVER_SPAN at the banks' far edge.
    const side = (k: number, s: number) => {
      const [x, y] = mid[k]
      const a = mid[Math.max(0, k - 1)]
      const b = mid[Math.min(n - 1, k + 1)]
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const l = Math.hypot(dx, dy) || 1
      const half = s < 0 ? wl[k] : wr[k]
      const m = Math.abs(s)
      const off =
        (m <= 1 ? m * half : half + ((m - 1) / (RIVER_SPAN - 1)) * sw[k]) *
        Math.sign(s)
      return [x - (dy / l) * off, y + (dx / l) * off * 0.5] as const
    }
    const strip = (s0: number, s1: number, from = 0, to = n - 1) => {
      const shape = new Shape()
      for (let k = from; k <= to; k++) {
        const [x, y] = side(k, s0)
        if (k > from) shape.lineTo(x, y)
        else shape.moveTo(x, y)
        end = Math.max(end, y)
      }
      for (let k = to; k >= from; k--) {
        const [x, y] = side(k, s1)
        shape.lineTo(x, y)
        end = Math.max(end, y)
      }
      shape.closePath()
      return shape
    }
    this.riverShape = strip(-1, 1)
    this.shoreShape = strip(-RIVER_SPAN, RIVER_SPAN)
    // A few stones, and a gravel islet where the last bend runs widest.
    const at = (t: number) => clamp(Math.round(t * (n - 1)), 0, n - 1)
    this.stones = RIVER_STONES.map(([t, s, size]) => {
      const k = at(t)
      const [x, y] = side(k, s)
      const r = (0.12 * mid[k][2] + 0.3 * CH) * size
      const shape = new Shape()
      shape.ellipse(x, y, r, r * 0.6, 0, 0, TAU)
      return shape
    })
    {
      const k = at(0.88)
      const [x, y] = side(k, 0.15)
      const islet = new Shape()
      islet.ellipse(x, y, 0.3 * mid[k][2], 0.11 * mid[k][2], -0.5, 0, TAU)
      this.islet = islet
    }
    // Where it leaves the woods, a few spruce stand out from the treeline on either side, built
    // as the forest's own stands are, so it reads as coming from under the trees.
    this.bankTrees = []
    {
      const CW = CH / 1.32
      const [x0, y0, w0] = mid[0]
      for (const [j, sign, count] of [
        [0, -1, 2],
        [1, 1, 3],
      ] as const)
        for (let k = 0; k < count; k++) {
          const x =
            x0 +
            sign *
              (1.4 * w0 +
                0.5 * CH +
                k * 2.9 * CW * (0.75 + 0.5 * hash(k, j + 40, seed)))
          const tall =
            (4.5 + 5.5 * hash(k, j + 41, seed)) * CH * (1 - (0.25 * k) / count)
          this.bankTrees.push(this.spruceShape(x, y0 + CH * 0.8, tall, CH))
        }
    }
    this.riverEnd = end
    // Each point's reach to the banks' edge, filed by the 4px rows it covers.
    this.riverBins = new Map()
    mid.forEach(([, y], k) => {
      const reach = Math.max(wl[k], wr[k]) + sw[k]
      for (
        let row = Math.floor((y - 0.5 * reach) / 4);
        row <= Math.floor((y + 0.5 * reach) / 4);
        row++
      ) {
        const list = this.riverBins.get(row) ?? []
        list.push(k)
        this.riverBins.set(row, list)
      }
    })
    // The meadow's flowers are inches tall and close, so one beside the river shrinks it to a
    // ditch. Within a flower's breadth of the river they stand clearly nearer than its near bank,
    // and it lies on a plane past them.
    {
      const cols = Math.ceil(this.width / 8) + 1
      const near = new Float32Array(cols).fill(-Infinity)
      mid.forEach(([x, y], k) => {
        if (x >= this.width) return
        const c = Math.max(0, Math.floor(x / 8))
        near[c] = Math.max(near[c], y + Math.max(wl[k], wr[k]) + sw[k])
      })
      const reach = Math.ceil((0.06 * H) / 8)
      this.shoreline = new Float32Array(cols)
      for (let c = 0; c < cols; c++) {
        let m = -Infinity
        for (let d = -reach; d <= reach; d++)
          m = Math.max(m, near[Math.min(cols - 1, Math.max(0, c + d))])
        this.shoreline[c] = m + 0.05 * H
      }
    }
    const tx = new Float32Array(n)
    const ty = new Float32Array(n)
    for (let k = 0; k < n; k++) {
      const a = mid[Math.max(0, k - 1)]
      const b = mid[Math.min(n - 1, k + 1)]
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      tx[k] = (b[0] - a[0]) / l
      ty[k] = (b[1] - a[1]) / l
    }
    this.course = { mid, tx, ty, wl, wr, sw }
    this.riverVersion++
    // Nothing roots in the water or on its banks, or beside or past it.
    this.plants = this.plants.filter(
      (plant) => !this.dry(plant.x, this.floor(plant.z)),
    )
  }

  /**
   * Where across the river (x, y) lies: -1..1 bank to bank, out to ±RIVER_SPAN at the banks'
   * outer edge, or null off it.
   */
  private acrossAt(x: number, y: number) {
    const C = this.course
    const ks = this.riverBins.get(Math.floor(y / 4))
    if (!C || !ks) return null
    const { mid, tx, ty, wl, wr, sw } = C
    // The point on the course whose cross-section passes nearest: side() puts the offset `off`
    // at (x - ty·off, y + tx·off/2), so solve for it and take the closest fit.
    let best = Infinity
    let off = 0
    let at = -1
    for (const k of ks) {
      const dx = x - mid[k][0]
      const dy = y - mid[k][1]
      const a = -ty[k]
      const b = 0.5 * tx[k]
      const o = (a * dx + b * dy) / (a * a + b * b)
      const e = (dx - a * o) ** 2 + (dy - b * o) ** 2
      if (e < best) {
        best = e
        off = o
        at = k
      }
    }
    if (at < 0 || best > 4) return null
    const half = off < 0 ? wl[at] : wr[at]
    const m = Math.abs(off)
    const v =
      m <= half ? m / half : 1 + ((m - half) / sw[at]) * (RIVER_SPAN - 1)
    return v > RIVER_SPAN ? null : Math.sign(off) * v
  }

  /**
   * Where across the river each cell's middle lies, for the type to draw the current's lines along
   * the flow and the banks' bands beside it, stored as ±127 at ±RIVER_SPAN, and -128 off the
   * river. It changes only when the river is rebuilt (riverVersion).
   */
  riverField(
    out: Int8Array,
    cols: number,
    rows: number,
    cw: number,
    ch: number,
  ) {
    out.fill(-128)
    for (let r = 0; r < rows; r++) {
      const y = (r + 0.5) * ch
      if (!this.riverBins.has(Math.floor(y / 4))) continue
      for (let c = 0; c < cols; c++) {
        const s = this.acrossAt((c + 0.5) * cw, y)
        if (s !== null) out[r * cols + c] = Math.round((s * 127) / RIVER_SPAN)
      }
    }
  }

  /** A tiered spruce, `tall` px from its tip to its base at (x, base), `pad` px fuller all round. */
  private spruceShape(
    x: number,
    base: number,
    tall: number,
    CH: number,
    pad = 0,
  ) {
    const hw = tall * 0.26
    const tiers = 3 + Math.floor(tall / CH / 2.2)
    // Tiered: each branch tier flares out, then steps in under the next.
    const half = (y: number) => {
      const t = (y - (base - tall)) / tall
      const q = t * tiers
      return pad + hw * (0.06 + 0.94 * t) * (0.62 + 0.38 * (q - Math.floor(q)))
    }
    // Down the left flank from the tip, then back up the right.
    const shape = new Shape()
    const ys: number[] = []
    for (let y = base - tall - pad; y <= base + 0.01; y += CH / 4)
      ys.push(Math.min(base - 0.01, y))
    ys.forEach((y, q) =>
      q ? shape.lineTo(x - half(y), y) : shape.moveTo(x, y),
    )
    for (let q = ys.length - 1; q > 0; q--) shape.lineTo(x + half(ys[q]), ys[q])
    shape.closePath()
    return shape
  }

  /** A ridge's height at any x, between its points. */
  private ridgeAt(ridge: Float32Array, x: number) {
    const f = clamp(x / RIDGE_STEP, 0, ridge.length - 1)
    const i = Math.min(ridge.length - 2, Math.floor(f))
    return lerp(ridge[i], ridge[i + 1], f - i)
  }

  /**
   * Snow on each massif covers the top quarter of its height, measured from its true summit, with
   * a gentle wobble. Measured from a sliding local top instead, the line crept down whole flanks.
   */
  private buildSnowline(massifs: number[]) {
    const far = this.ridges[0]
    const n = far.length
    const line = new Float32Array(n).fill(NaN)
    this.summits = []
    const lineAt = (i: number, pk: number) => {
      const x = i * RIDGE_STEP
      return (
        this.horizon -
        (pk * 0.76 +
          20 * (fbm1(x / 45, LAND_SEED + 404, 3) - 0.5) +
          12 * (fbm1(x / 9, LAND_SEED + 405, 2) - 0.5))
      )
    }
    for (const at of massifs) {
      // The summit: the highest point within 40px of where it's placed that's on screen.
      let si = -1
      for (let x = at - 40; x <= at + 40; x += RIDGE_STEP) {
        const i = Math.round(x / RIDGE_STEP)
        if (i >= 0 && i < n && (si < 0 || far[i] < far[si])) si = i
      }
      if (si < 0) continue
      const pk = this.horizon - far[si]
      if (pk < this.height * SNOW_MIN) continue
      this.summits.push({ x: si * RIDGE_STEP, y: far[si] })
      // The cap runs out from the summit each way until the ridge has dropped clear of the line,
      // so it ends where the mountain does, never at a cut.
      for (const dir of [-1, 1]) {
        let below = 0
        for (let i = si; i >= 0 && i < n && below < 4; i += dir) {
          const y = lineAt(i, pk)
          line[i] = Number.isNaN(line[i]) ? y : Math.min(line[i], y)
          below = far[i] > y ? below + 1 : 0
        }
      }
    }
    this.snowline = line
  }

  /**
   * Hidden ridgelines that split the far range into faces, placed by hand (RIDGELINES). Each runs
   * down in 5px steps with a small wobble and branches once, steeper. They're never drawn: only
   * the faces either side are.
   */
  private buildFaces() {
    const far = this.ridges[0]
    const hz = this.horizon
    const W = this.width
    const at = (x: number) => this.ridgeAt(far, x)
    const segs: number[] = []
    const grow = (
      x: number,
      y: number,
      dir: number,
      len: number,
      sd: number,
      lean: number,
      branch: boolean,
    ) => {
      const steps = Math.ceil(len / 5)
      for (let k = 0; k < steps; k++) {
        const nx = x + dir * lean * 5 + (noise1(k * 0.45, sd) - 0.5) * 4
        const ny = Math.max(y + 5, at(nx) + 3)
        if (ny > hz - 8) break
        segs.push(x, y, nx, ny)
        // One branch, steeper, peeling off a little under halfway down.
        if (branch && k === Math.floor(steps * 0.45))
          grow(nx, ny, dir, len * 0.5, sd * 7 + 1, lean * 0.45, false)
        x = nx
        y = ny
      }
    }
    RIDGELINES.forEach((R, k) => {
      const px = this.rangeX(R.at)
      const top = at(px)
      grow(
        px + R.dir * 2,
        top + 3,
        R.dir,
        (hz - top) * R.len,
        k * 13 + 2,
        R.lean,
        true,
      )
    })
    let top = hz
    for (const y of far) top = Math.min(top, y)
    const cols = Math.ceil(W / FACE_STEP) + 1
    const rows = Math.max(1, Math.ceil((hz - top) / FACE_STEP) + 1)
    const d = new Float32Array(cols * rows).fill(1e9)
    const side = new Int8Array(cols * rows)
    const qx = new Float32Array(cols * rows)
    for (let s = 0; s < segs.length; s += 4) {
      const [x1, y1, x2, y2] = segs.slice(s, s + 4)
      const dx = x2 - x1
      const dy = y2 - y1
      const L2 = dx * dx + dy * dy
      const c0 = Math.max(
        0,
        Math.floor((Math.min(x1, x2) - FACE_LIT) / FACE_STEP),
      )
      const c1 = Math.min(
        cols - 1,
        Math.ceil((Math.max(x1, x2) + FACE_LIT) / FACE_STEP),
      )
      const r0 = Math.max(0, Math.floor((y1 - FACE_LIT - top) / FACE_STEP))
      const r1 = Math.min(
        rows - 1,
        Math.ceil((y2 + FACE_LIT - top) / FACE_STEP),
      )
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++) {
          const X = c * FACE_STEP
          const Y = top + r * FACE_STEP
          const t = clamp(((X - x1) * dx + (Y - y1) * dy) / L2, 0, 1)
          const qX = x1 + dx * t
          const dd = Math.hypot(X - qX, Y - (y1 + dy * t))
          const i = r * cols + c
          if (dd < d[i]) {
            d[i] = dd
            side[i] = X < qX ? -1 : 1
            qx[i] = qX
          }
        }
    }
    this.faces = { cols, rows, top, d, side, qx }
  }

  /**
   * Forest, placed by hand as shares of the screen width rather than by noise. The middle ridge is
   * forested along its crest, with two staggered rows lower on the slope in front; the near ridge
   * carries a few stands of tall, tiered spruce. Each row is a low canopy with one narrow spire per
   * slot; toward the end of a stretch the spires drop out and the canopy sinks, so a stand thins
   * to single trees instead of rounding off into a mound.
   */
  private buildForest(
    midAt: (x: number) => number,
    nearAt: (x: number) => number,
  ) {
    const hz = this.horizon
    const W = this.width
    const seed = LAND_SEED
    // About one glyph cell, so the trees keep their size against the type; on a tall phone, held
    // to the range's width so a stand doesn't tower over the magnified peaks.
    const CH = Math.min(this.height, 0.62 * this.rangeWidth) * 0.0125
    const CW = CH / 1.32
    const tw = 2.6 * CW
    const on = (k: number, x: number) =>
      FOREST_ROWS[k].at.some(([a, b]) => x >= a * W && x <= b * W)
    const taper = (k: number, x: number) => {
      let n = 0
      for (let j = 1; j <= 6; j++) n += +on(k, x - j * 12) + +on(k, x + j * 12)
      return n / 12
    }
    const spire = (
      x: number,
      salt: number,
      t: number,
      hMin: number,
      hVar: number,
      tw: number,
    ) => {
      const i = Math.floor(x / tw + hash(salt, 3, seed) * 0.5)
      if (hash(i, salt * 11 + 5, seed) > 0.15 + 0.85 * t) return 0
      const hw = 0.28 + 0.12 * hash(i, salt * 11 + 6, seed)
      const off = Math.abs(x / tw - i - 0.5)
      if (off > hw) return 0
      return (hMin + hVar * hash(i, salt * 11 + 7, seed)) * CH * (1 - off / hw)
    }
    let treeTop = hz
    const sky = new Float32Array(Math.ceil(W / FOREST_STEP) + 3).fill(hz)
    const lower = (x: number, y: number) => {
      const i = Math.round(x / FOREST_STEP) + 1
      if (i >= 0 && i < sky.length && y < sky[i]) sky[i] = y
    }
    for (let i = 0; i < sky.length; i++)
      for (const ridge of this.ridges)
        lower((i - 1) * FOREST_STEP, this.ridgeAt(ridge, (i - 1) * FOREST_STEP))
    this.forest = FOREST_ROWS.map((R, k) => {
      const shape = new Shape()
      let last = -1
      for (let x = -FOREST_STEP; x <= W + FOREST_STEP; x += FOREST_STEP) {
        if (!on(k, x)) {
          if (last >= 0) {
            shape.lineTo(last, hz + 2)
            shape.closePath()
            last = -1
          }
          continue
        }
        const m = midAt(x)
        const f =
          k === 0
            ? 0.03
            : 0.12 + 0.2 * (fbm1(x / 45, seed + 505 + k * 9, 3) - 0.5)
        // Groves: the canopy rises a cell or so here and there, every few trees, so the treetops
        // don't trace the ridge's curve as one smooth line. Only up: sunk below the crest, it
        // bared the ridge behind as smooth domes.
        const grove =
          Math.max(0, fbm1(x / 70, seed + 707 + k * 9, 2) - 0.4) * 3 * CH
        const top = m + Math.min(0.92, f + R.drop) * (hz - m) - grove
        const t = taper(k, x)
        const canopy = top + (1 - smoothstep(0.5, 1, t)) * (hz - top)
        // Two ranks of spires, the second shorter and set between the first, so crowns overlap
        // and the row reads as a mass of trees rather than a fence of single ones.
        const rise = Math.max(
          spire(x, 1 + k * 10, t, R.hMin, R.hVar, tw),
          0.7 * spire(x + 0.5 * tw, 2 + k * 10, t, R.hMin, R.hVar, 0.8 * tw),
        )
        const y = Math.max(m - 2.4 * CH, Math.min(canopy, hz - 2) - rise)
        if (last < 0) shape.moveTo(x, hz + 2)
        shape.lineTo(x, y)
        treeTop = Math.min(treeTop, y)
        lower(x, y)
        last = x
      }
      if (last >= 0) {
        shape.lineTo(last, hz + 2)
        shape.closePath()
      }
      return shape
    })
    // The near ridge's crest, bare, ran under the forest as one smooth pale arc. A low treeline
    // along it, small spires on a canopy that rises in groves, breaks it into tree tops; it fills
    // down to the horizon, where drawLand eases it into the meadow's colour.
    const scrub = new Shape()
    let scrubTop = hz
    scrub.moveTo(-FOREST_STEP, hz + 2)
    for (let x = -FOREST_STEP; x <= W + FOREST_STEP; x += FOREST_STEP) {
      const grove = Math.max(0, fbm1(x / 60, seed + 909, 2) - 0.35) * 2.2 * CH
      const rise = Math.max(
        spire(x, 41, 1, 0.3, 0.7, 0.8 * tw),
        0.7 * spire(x + 0.4 * tw, 42, 1, 0.3, 0.7, 0.6 * tw),
      )
      const y = Math.min(hz - 1, nearAt(x) - 0.25 * CH - grove - rise)
      scrub.lineTo(x, y)
      scrubTop = Math.min(scrubTop, y)
      lower(x, y)
    }
    scrub.lineTo(W + FOREST_STEP, hz + 2)
    scrub.closePath()
    this.scrub = scrub
    this.scrubTop = scrubTop
    treeTop = Math.min(treeTop, scrubTop)
    // A few stands, placed by hand along the range, so the flowers keep open sky behind most of
    // them. A stand is left out only where it would stand over the home page's bio; the poem's text
    // crosses the whole scene, peaks and all, so it keeps them all.
    this.spruce = []
    const clear = this.keepClear
    for (const [j, [at, n]] of SPRUCE_STANDS.entries()) {
      const gx = this.rangeX(at)
      const span = n * 2.9 * CW * 0.6 + 30
      const tall = 10 * CH
      if (
        clear &&
        !this.keepClearColumn &&
        gx + span > clear.left &&
        gx - span < clear.right &&
        nearAt(gx) - tall < clear.bottom &&
        nearAt(gx) > clear.top
      )
        continue
      for (let k = 0; k < n; k++) {
        const mid = 1 - (0.55 * Math.abs(k - (n - 1) / 2)) / n
        const x =
          gx +
          (k - (n - 1) / 2) *
            2.9 *
            CW *
            (0.75 + 0.5 * hash(k, j * 13 + 1, seed))
        const H = (4.5 + 5.5 * hash(k, j * 13 + 2, seed)) * CH * mid
        const hw = H * 0.26
        const base = nearAt(x) + CH * 0.8
        const shape = this.spruceShape(x, base, H, CH)
        this.spruce.push(shape)
        treeTop = Math.min(treeTop, base - H)
        for (let dx = -hw; dx <= hw; dx += FOREST_STEP)
          lower(x + dx, base - H + (Math.abs(dx) / hw) * H)
      }
    }
    this.treeTop = treeTop
    this.skyline = sky
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
   * How each point of a ridge faces the light at (`toward`, `above`), -1 to 1 in sixteenths: 1 lit,
   * -1 in shade, 0 flat or in front of the sun or moon (within `clear` of it).
   */
  private facing(
    ridge: Float32Array,
    toward: number,
    above: number,
    clear: number,
  ) {
    const n = ridge.length
    // Which way each point faces, read over a wide window so a whole mountainside goes one way
    // instead of flickering with every crease: down toward the light faces it.
    const W = 6
    const dx = 2 * W * RIDGE_STEP
    const face = (i: number) => {
      const x = i * RIDGE_STEP
      const dy = ridge[Math.min(n - 1, i + W)] - ridge[Math.max(0, i - W)]
      if (Math.abs(dy) < 2) return 0
      // The cosine between the flank's normal (up, and out the way it falls) and the way to the
      // light, as light on a surface goes: a flank turned toward a low light is lit, the flank
      // behind it in shadow, and a high light lifts the far flank only so far as it stands above
      // the flank's pitch. The shade side is steeper than the lit, since a face the light can't
      // reach is wholly dark, where a lit one brightens by the angle.
      const lx = toward - x
      // A low light is far off, at the horizon's height for every point, so a flank turned toward
      // it is lit though the disc stands under the crest on screen; a high one is read from the
      // point itself, which parts the two flanks of a peak under it.
      const ly =
        above -
        lerp(
          this.horizon,
          ridge[i],
          smoothstep(0.08, 0.3, (this.horizon - above) / this.height),
        )
      const cos =
        (dy * lx - dx * ly) / (Math.hypot(dy, dx) * (Math.hypot(lx, ly) || 1))
      const w = cos >= 0 ? Math.min(1, 1.5 * cos) : Math.max(-1, 4 * cos)
      // Where the sun or moon sits behind the ridge, the ridge stands in front of it, its near
      // face turned away: lit there, the slope would print as the globe showing through the hill.
      const open = Math.max(
        smoothstep(clear, clear * 1.4, Math.abs(x - toward)),
        smoothstep(0, clear * 0.4, ridge[i] - above - clear),
      )
      return Math.round(w * open * 16) / 16
    }
    const fs = new Float32Array(n)
    for (let i = 0; i < n; i++) fs[i] = face(i)
    return fs
  }

  /**
   * Strips under a ridge's crest, one per run of slope that faces the light at (`toward`, `above`)
   * the same way: `w` is 1 for a slope fully lit, -1 fully in shade, and eases between as the light
   * moves, in sixteenths, so a mountainside turns into shadow over a stretch of the hour rather than
   * at once. `reach` scales how far down from the crest they run, and `shadeReach` the shaded
   * runs further still, for the long shadows a low light throws; `fs` is each point's facing,
   * from `facing`, worked out once for all four reaches.
   */
  private slopes(
    ridge: Float32Array,
    layer: number,
    reach: number,
    fs: Float32Array,
    shadeReach = 1,
  ) {
    const runs: { path: Shape; w: number }[] = []
    const depth0 = this.height * [0.05, 0.035, 0.02][layer] * reach
    const n = ridge.length
    // How deep the strip runs under each point: the facing, averaged over the five points each
    // way, so a strip thins to nothing where the slope turns or flattens and the lit and shaded
    // strips meet in a soft V. The envelope belongs to the point, not the run, so neighbouring
    // runs share their edge and a point stepping from one run to the next moves it by at most a
    // sixteenth of a sixteenth. Tapering each run at its own ends instead, by whether the next
    // run had the same sign, made a whole run's end taper come and go the minute a single point
    // eased across zero: a block of a mountainside lit or shaded at once.
    const ENV = 5
    const env = new Float32Array(n)
    for (let k = 0; k < n; k++) {
      let sum = 0
      let wt = 0
      for (let m = -ENV; m <= ENV; m++) {
        const q = k + m
        if (q < 0 || q >= n) continue
        const t = 1 - Math.abs(m) / (ENV + 1)
        sum += fs[q] * t
        wt += t
      }
      env[k] = Math.abs(sum / wt)
    }
    let i = 0
    while (i < n) {
      const f = fs[i]
      let j = i
      while (j + 1 < n && fs[j + 1] === f) j++
      // Each run reaches on to the next point, so a run of a single point still shows and none
      // leave a gap between them; the shared segment prints with whichever run comes later.
      const e = Math.min(n - 1, j + 1)
      if (f !== 0 && e > i) {
        // One shape per run: along the crest, then back along the envelope below it.
        const depth = f < 0 ? depth0 * shadeReach : depth0
        const path = new Shape()
        path.moveTo(i * RIDGE_STEP, ridge[i])
        for (let k = i + 1; k <= e; k++) path.lineTo(k * RIDGE_STEP, ridge[k])
        for (let k = e; k >= i; k--)
          path.lineTo(k * RIDGE_STEP, ridge[k] + depth * env[k])
        path.closePath()
        runs.push({ path, w: f })
      }
      i = j + 1
    }
    return runs
  }

  /**
   * How strongly slopes are lit and in what colour: most with the sun low, when its light rakes
   * across the range, flattest with it high; a little under the moon, and less again while the
   * moon is low, so a moon just up over the hills lifts no shadow.
   */
  private slopeLight(p: Palette) {
    const { sun, moon } = this.lights(p)
    return sun
      ? {
          light: (0.26 + 0.34 * this.sunLook(p).low) * sun,
          color: this.sunLook(p).color,
        }
      : {
          light: 0.18 * moon * (1 - 0.7 * this.moonLook(p).low),
          color: p.globe,
        }
  }

  /**
   * How much the range stands against the sun, 0 to 1: wholly once the disc has gone behind the
   * crest, and part way with the sun low but clear, when the air between thins the far ridges to
   * shapes.
   */
  private backlight(p: Palette) {
    const { sun } = this.lights(p)
    return sun > 0
      ? sun * Math.max(0.45 * Math.sqrt(this.sunLook(p).low), this.sunk())
      : 0
  }

  /**
   * The slope light's inputs at this hour, for the page's `?probe` dump (the crest-flicker kit in
   * docs/handoffs/assets/2026-11-01-crest-flicker): where the light stands and how strong it is,
   * and each far-ridge point's facing, so a scrub's frames can be checked against what the land
   * was asked to do.
   */
  probe(p: Palette) {
    const { cx, cy, R } = this.globeAt()
    const { light, color } = this.slopeLight(p)
    const { sun, moon } = this.lights(p)
    const far = this.ridges[0] ?? new Float32Array(0)
    return {
      hour: this.hour,
      globe: { cx, cy, R },
      sun,
      moon,
      low: sun > 0 ? this.sunLook(p).low : 0,
      sunk: this.sunk(),
      light,
      color,
      against: this.against(p, light),
      step: RIDGE_STEP,
      far: Array.from(far),
      facing: light > 0 ? Array.from(this.facing(far, cx, cy, R * 1.5)) : [],
      snowline: Array.from(this.snowline),
      summits: this.summits,
    }
  }

  /**
   * How far the range's faces turn away from the light, 0 to 1: fully with the sun sunk behind
   * the crest, and as the light itself fades, so the faces and snow ease into shade at dusk
   * instead of snapping between the sun's rim light and the moon's.
   */
  private against(p: Palette, light = this.slopeLight(p).light) {
    const rim = this.lights(p).sun > 0 ? this.sunk() : 0
    return Math.max(rim, 1 - smoothstep(0, 0.15, light))
  }

  /**
   * How far the ridges are unlit after the sun: 0 while it's up, 1 from dusk on. Once it has
   * gone they take no light at all, moon or none, and stay dark shapes against the sky.
   */
  private unlit(p: Palette) {
    return (1 - this.lights(p).sun) * smoothstep(0.05, 0.3, p.night)
  }

  /** Colour of each ridge: the farther, the more it fades toward the sky. */
  private ridgeColors(p: Palette): Rgb[] {
    // With the sun low the ridges stand against it, their near faces in shadow: they go toward
    // silhouette, the nearest most, while the far range keeps its haze.
    const back = this.backlight(p)
    // By day the far rock takes less of the pale sky, a step darker, so snow and lit faces stand
    // out and the three ridges part from each other at midday.
    const day = (1 - smoothstep(0, 0.1, p.night)) * (1 - back)
    // After the sun the ridges are a darker step of the sky at the horizon, in its own hue, so they
    // sink into dusk and twilight instead of standing off them in the hill colours' violet.
    const unlit = this.unlit(p)
    const dark = mix(p.skyHorizon, p.ground, 0.6)
    return [
      mix(
        mix(
          mix(p.hillFar, p.skyHorizon, 0.5 - 0.2 * day),
          p.ground,
          0.5 * back + 0.08 * day,
        ),
        dark,
        unlit,
      ),
      mix(
        mix(
          mix(
            mix(p.hillFar, p.hillNear, 0.45),
            p.skyHorizon,
            0.25 - 0.06 * day,
          ),
          p.ground,
          0.5 * back,
        ),
        mix(dark, p.ground, 0.3),
        unlit,
      ),
      mix(mix(p.hillNear, p.ground, 0.2), p.ground, 0.6 * back + 0.25 * unlit),
    ]
  }

  /**
   * The forest's colours: the middle ridge's three rows, paler and hazed at the back, darkest at
   * the front, and the near spruce, the darkest mark on the land.
   */
  private forestColors(p: Palette, colors: Rgb[]) {
    const pine = mix(p.pine, colors[1], 0.12)
    return {
      rows: [
        mix(mix(pine, colors[1], 0.38), p.haze, 0.12),
        mix(pine, colors[1], 0.16),
        mix(pine, p.ground, 0.14),
      ],
      spruce: mix(p.pine, p.ground, 0.35),
    }
  }

  /**
   * The river's colours. Water mirrors the sky: as far below the horizon as it lies, the sky as far
   * above, so the far reach carries the horizon's glow and the near water the higher sky, a little
   * of the ground showing through nearer. After dark it takes the moonlit haze, so it stays a pale
   * thread across the dark meadow. The banks are the meadow a shade toward its dark grass.
   */
  private riverColors(p: Palette) {
    const hz = this.horizon
    const H = this.height
    const end = Math.max(hz + 1, this.riverEnd)
    const moon = (0.3 + 0.3 * p.moonlight) * p.night
    const T = [0, 0.15, 0.35, 0.6, 1]
    // The body: the higher, deeper sky the water mirrors, with the ground showing through it more
    // toward us. The type lays the bright reflections over it as the current's lines.
    const water = T.map((t): [number, Rgb, number] => {
      const d = t * (end - hz)
      const sky = mix(
        p.skyHorizon,
        p.skyTop,
        clamp(0.15 + (1.6 * d) / hz, 0, 1),
      )
      const body = mix(sky, p.ground, 0.12 + 0.18 * t)
      return [t, mix(body, mix(p.haze, p.globe, 0.3), moon), 1]
    })
    const shore = T.map((t): [number, Rgb, number] => {
      const y = lerp(hz, end, t)
      const floor = mix(
        mix(p.hillNear, p.grassDark, 0.4),
        p.ground,
        clamp((y - hz) / (H - hz), 0, 1),
      )
      return [t, mix(floor, p.grassDark, 0.3), 1]
    })
    return {
      water,
      shore,
      bar: mix(shore[3][1], p.haze, 0.25),
      stone: mix(mix(p.hillNear, p.ground, 0.5), p.haze, 0.1),
    }
  }

  step(dt: number, palette: Palette) {
    this.time += dt
    this.env.palette = palette
    if (this.intro < INTRO) {
      this.intro += dt
      const k = easeInOut(Math.min(1, this.intro / INTRO))
      for (const [plant, age] of this.targetAge) {
        plant.age = age * k - dt
        plant.calm = 1
      }
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
        const s = this.sown.indexOf(plant)
        if (s >= 0) this.sown.splice(s, 1)
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
    this.visitors.step(
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
    // After dark every flower steps back toward the ground alike, but the poem's rose.
    const dim = 0.28 * smoothstep(0.5, 1, p.night)
    for (const plant of this.plants)
      plant.dim = plant.species === 'rose' ? 0 : dim
    let blade = 0
    for (const plant of this.plants) {
      blade = this.meadow.draw(r, p, blade, plant.z, haze)
      // The rose goes over the grass in front of it, so no blade cuts across its head; the
      // flowers around it have made room.
      if (plant.species === 'rose') continue
      r.opacity = plant.fade
      plant.draw(r, this.env)
      r.opacity = 1
    }
    this.meadow.draw(r, p, blade, 2, haze)
    for (const plant of this.plants)
      if (plant.species === 'rose') plant.draw(r, this.env)
    this.particles.draw(r, p.night)
    this.heads = r.heads.slice()
    this.visitors.draw(r, p)
  }

  /**
   * The cap's apex, on the silhouette. The cells can't make a point: the summit's cell is a crest
   * cell, a line glyph with no tile, so the rock's painted tip stood a cell above the top row of
   * snow at every size, dark by day and oddly lit at dusk. The top row and a half under each
   * summit takes the cap's own tile on the backdrop, the lit flank's while the sun or moon lights
   * it and the shaded flank's as that goes, so the apex reads as the cells under it do and the
   * stepped cells carry on below. Only the apex, three cells each way, which is all the rock's
   * tip ever spans: painting the cap, or a strip along the whole crest, read as a shape drawn
   * round it (SnowCap, open questions).
   */
  private paintSummits(
    ctx: CanvasRenderingContext2D,
    ridge: Float32Array,
    p: Palette,
  ) {
    if (!this.summits.length) return
    const { cw, ch } = this.cell
    const { fade, litCol } = this.snowColors(p)
    const col = litCol.map((v) => v * p.ink) as Rgb
    const path = this.ridgePath(ridge, this.horizon + 2).toPath2D()
    ctx.save()
    ctx.fillStyle = css(col)
    ctx.globalAlpha = lerp(0.3, 0.35, fade)
    for (const sm of this.summits) {
      ctx.save()
      ctx.beginPath()
      // Column by column, down to the bottom of the crest cell: the first cell the ridge covers
      // more than a sliver of (the typesetter's 7%), which prints a line glyph and no tile. The
      // cells under it carry their own tile, so the paint stops where they start, or the two
      // would stack and the row read brighter than the cap.
      const c0 = Math.floor(sm.x / cw) - 3
      for (let c = c0; c <= c0 + 6; c++) {
        // The share of a cell row under the ridge, read across the column, as the rasteriser
        // sees it; on a steep flank the ridge drops a whole row across one cell.
        const ys = [0.1, 0.3, 0.5, 0.7, 0.9].map((t) =>
          this.ridgeAt(ridge, (c + t) * cw),
        )
        const top = Math.min(...ys)
        let row = Math.floor(top / ch)
        const cover = (r: number) =>
          ys.reduce((s, y) => s + clamp(((r + 1) * ch - y) / ch, 0, 1), 0) /
          ys.length
        if (cover(row) <= 0.07) row++
        ctx.rect(c * cw, top - 1, cw, (row + 1) * ch - top + 1)
      }
      ctx.clip()
      ctx.fill(path)
      ctx.restore()
    }
    ctx.restore()
  }

  /**
   * The far range's faces per glyph cell, for the typesetter: within 80px of a hidden ridgeline,
   * up to 1 on the face toward the light and down to -1 in its narrower shadow, easing to 0 at each
   * face's edge and in the 30px under the snowline, so they never touch the cap. With the sun low
   * behind the range every face takes the shaded side. Returns the lit faces' tint and strength:
   * the light at 8% by day, 2.5% at night, where more showed every cell's edge as a stair step.
   */
  relief(
    out: Float32Array,
    cols: number,
    rows: number,
    cw: number,
    ch: number,
    p: Palette,
  ) {
    out.fill(0)
    const { light, color } = this.slopeLight(p)
    const lit = light > 0 ? lerp(0.08, 0.025, smoothstep(0.3, 0.7, p.night)) : 0
    const F = this.faces
    if (!F) return { color, lit }
    const { sun, moon } = this.lights(p)
    // With nothing lighting the range, or the sun behind it, the faces go flat: a shape, not a
    // set of grooves. The moon shows them at half the sun's depth.
    const show = (1 - this.against(p, light)) * (sun > 0 ? 1 : 0.5 * moon)
    if (show <= 0) return { color, lit }
    const { cx, cy, R } = this.globeAt()
    const [far, mid] = this.ridges
    // The crest's own facing over each column: a face on the flank turned from the light can't
    // come out lit, however its hidden ridgeline sits to the light.
    const fs = this.facing(far, cx, cy, R * 1.5)
    for (let r = 0; r < rows; r++) {
      const y = (r + 0.5) * ch
      if (y < F.top || y >= this.horizon) continue
      const gr = Math.min(F.rows - 1, Math.round((y - F.top) / FACE_STEP))
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * cw
        // Only the far range's own rock: not the sky above it or the ridges in front.
        if (y < this.ridgeAt(far, x) || y >= this.ridgeAt(mid, x)) continue
        const g = gr * F.cols + Math.min(F.cols - 1, Math.round(x / FACE_STEP))
        const d = F.d[g]
        if (d >= FACE_LIT) continue
        const line =
          this.snowline[
            Math.min(this.snowline.length - 1, Math.round(x / RIDGE_STEP))
          ]
        const under = Number.isNaN(line) ? 1 : smoothstep(0, 30, y - line)
        if (under <= 0) continue
        // How far this face turns toward the light: eased across the light's crossing, not flipped.
        const toward = 1 - smoothstep(-150, 150, F.side[g] * (F.qx[g] - cx))
        const flank = smoothstep(
          -0.3,
          0.4,
          fs[Math.min(fs.length - 1, Math.round(x / RIDGE_STEP))],
        )
        const shadeV =
          d < FACE_SHADE ? -smoothstep(0, 1, 1 - d / FACE_SHADE) : 0
        const v = lerp(
          shadeV,
          smoothstep(0, 1, 1 - d / FACE_LIT) * flank,
          toward,
        )
        out[r * cols + c] = v * under * show
      }
    }
    return { color, lit }
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

  /**
   * On this screen, the hour the rising sun first stands wholly clear of the ridges, the hour
   * the setting sun is wholly behind them, and the hour the setting moon is. The ridges are
   * fixed in x while the sun's path scales with the screen, so these move with its shape.
   */
  sunTimes() {
    const hour = this.hour
    /** How far the sun's disc stands above the ridges: > 0 wholly clear, < 0 wholly hidden. */
    const above = (h: number) => {
      this.hour = h
      const { cx, cy, R } = this.globeAt()
      let lo = Infinity
      let hi = -Infinity
      for (let dx = -R; dx <= R; dx += RIDGE_STEP) {
        const half = Math.sqrt(Math.max(0, R * R - dx * dx))
        const ridge = this.hillTop(cx + dx)
        lo = Math.min(lo, ridge - (cy + half))
        hi = Math.max(hi, ridge - (cy - half))
      }
      return lo > 0 ? 1 : hi < 0 ? -1 : 0
    }
    const STEP = 1 / 60
    let sunrise = 12
    for (let h = 6; h < 12; h += STEP)
      if (above(h) > 0) {
        sunrise = h
        break
      }
    // The sun leaves the sky at 18:30 whether or not a ridge has hidden it.
    let sunset = 18.5
    for (let h = 12; h < 18.5; h += STEP)
      if (above(h) < 0) {
        sunset = h
        break
      }
    // Likewise the moon at 06:00.
    let moonset = 6
    for (let h = 2; h < 6; h += STEP)
      if (above(h) < 0) {
        moonset = h
        break
      }
    this.hour = hour
    return { sunrise, sunset, moonset }
  }

  /** Hill silhouettes painted smooth under the glyphs, as solid as the poster's mountains. */
  backdrop(ctx: CanvasRenderingContext2D, p: Palette) {
    // A soft glow around the moon, or a warmer, wider one around the sun that grows as it sinks.
    const { sun, moon } = this.lights(p)
    if (sun + moon > 0) {
      const { cx, cy, R } = this.globeAt()
      const look = this.sunLook(p)
      const col = this.glowColor(p)
      // Sized by the screen as well as the disc, so a phone's small moon still lights a patch of
      // sky. It falls fastest at the disc and ever more gently out to nothing, like light
      // scattered in air: a fade that holds and then drops reads as a soft disc. Painted before the
      // ridges, so it lights only open sky and the range stands in front of it as the moon sets.
      // The moon's is kept close and faint, so the disc reads as a mark in the sky, not a lamp.
      const span = Math.hypot(this.width, this.height)
      const reachAt = (low: number) =>
        sun
          ? Math.max(R * (10 + 4 * low), span * (0.5 + 0.15 * low))
          : Math.max(R * 8, span * 0.35)
      const reach = reachAt(look.low)
      const peak = sun ? SUN_GLOW : MOON_GLOW
      const strength = sun ? (0.13 + 0.09 * look.low) * sun : MOON_GLOW * moon
      // The sun's wide glow lies on a bright sky, so a sprite of half the pixels does.
      const step = sun ? 2 : 1
      // Made once at the glow's widest and drawn down to its reach, so a sinking sun's swelling
      // glow never re-makes it mid-scrub (a 3M-pixel loop, 25 ms on an M4). The disc's flat core
      // shrinks with it, but the core is a few hundredths of the reach: the fade moves by under
      // one alpha step.
      const sprite = this.glowSprite(reachAt(1), R, peak, col, step)
      ctx.save()
      ctx.globalAlpha = strength / peak
      // Nearest, so each pixel keeps its dither instead of blurring it back into bands.
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(sprite, cx - reach, cy - reach, 2 * reach, 2 * reach)
      ctx.restore()
    }
    const colors = this.ridgeColors(p)
    const trees = this.forestColors(p, colors)
    // Backlit ridges lose most of their haze and mist, so they read as shapes against the glow;
    // so do unlit ones after the sun, which the haze's dusk colours would lift off the sky.
    const thin = 1 - 0.6 * Math.max(this.backlight(p), 0.7 * this.unlit(p))
    const hz = p.haze.map((v) => v | 0).join(',')
    const H = this.height
    for (const [layer, ridge] of this.ridges.entries()) {
      ctx.fillStyle = `rgb(${colors[layer].map((v) => v | 0).join(',')})`
      ctx.fill(this.ridgePath(ridge, this.horizon + 2).toPath2D())
      if (layer === 0) this.paintSummits(ctx, ridge, p)
      if (layer === 1)
        this.forest.forEach((shape, k) => {
          ctx.fillStyle = css(trees.rows[k])
          ctx.fill(shape.toPath2D())
        })
      if (layer === 2) {
        const fade = ctx.createLinearGradient(0, this.scrubTop, 0, this.horizon)
        fade.addColorStop(0, css(trees.rows[2]))
        fade.addColorStop(0.55, css(trees.rows[2]))
        fade.addColorStop(1, css(colors[2]))
        ctx.fillStyle = fade
        ctx.fill(this.scrub.toPath2D())
        ctx.fillStyle = css(trees.spruce)
        for (const shape of this.spruce) ctx.fill(shape.toPath2D())
      }
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
          `rgba(${hz},${(layer ? 0.3 : 0.4) * (0.45 + 0.3 * p.night) * thin})`,
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
    // The river, soft here, its banks a shade under the meadow and the water the sky it mirrors;
    // the type draws its edges, current and stones over this.
    const rc = this.riverColors(p)
    const wash = (stops: [number, Rgb, number][]) => {
      const g = ctx.createLinearGradient(0, this.horizon, 0, this.riverEnd)
      for (const [t, c] of stops) g.addColorStop(t, css(c))
      return g
    }
    ctx.globalAlpha = 0.5
    ctx.fillStyle = wash(rc.shore)
    ctx.fill(this.shoreShape.toPath2D())
    ctx.globalAlpha = 0.65
    ctx.fillStyle = wash(rc.water)
    ctx.fill(this.riverShape.toPath2D())
    ctx.globalAlpha = 1
    ctx.fillStyle = css(trees.spruce)
    for (const shape of this.bankTrees) ctx.fill(shape.toPath2D())
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
   * The cap's two flanks' colours: the lit flank dims toward the shaded one's as the light goes,
   * and unlit the cap is a paler patch of the rock, not a colour of its own.
   */
  private snowColors(p: Palette) {
    const fade = smoothstep(0, 0.15, this.slopeLight(p).light)
    const sunk = this.lights(p).sun > 0 ? this.sunk() : 0
    const shadeCol = mix(
      p.snowShade,
      this.ridgeColors(p)[0],
      0.5 * Math.max(1 - fade, sunk),
    )
    return { fade, shadeCol, litCol: mix(shadeCol, p.snow, fade) }
  }

  /**
   * Snow on the massifs' tops, its own material, in two flanks. The lit flank faces the sun or
   * moon; the split between the flanks runs down from the summit on a diagonal, leaning away from
   * the light, the way a ridge parts a peak's two faces. Split column by column, the edge fell
   * straight down from the summit. Slopes steeper than about 60° hold no snow, so cliffs show
   * dark ribs. With the sun low behind the range only a rim along the crest is lit.
   */
  private drawSnow(r: Raster, ridge: Float32Array, p: Palette, toward: number) {
    const line = this.snowline
    // Rim light once the sun has sunk behind the crest, and how much light there is at all: the
    // first narrows the lit flank to the crest as the disc goes down behind the range, the way the
    // last light leaves a peak from the foot up, and the rock's lit strips thin with it; the
    // second dims the lit flank's colour toward the shaded one's, so the flank's reach never moves
    // with the light's strength, which read as a shadow climbing the cap on its own.
    const rimT = this.lights(p).sun > 0 ? this.sunk() : 0
    const { shadeCol, litCol } = this.snowColors(p)
    const n = ridge.length
    const CH = this.height * 0.0125
    // Slope in the range's own units (height share per width share), so a phone, which shows a
    // stretch of the range magnified, keeps the same cap rather than a steeper, barer one.
    const unit = this.rangeWidth / this.height
    const inCap = (i: number) => {
      if (!(ridge[i] < line[i])) return false
      const steep =
        (ridge[Math.min(n - 1, i + 1)] - ridge[Math.max(0, i - 1)]) /
        (2 * RIDGE_STEP)
      return Math.abs(steep) * unit <= 2.7
    }
    const summitAt = (x: number) => {
      let sm = this.summits[0]
      for (const q of this.summits)
        if (Math.abs(x - q.x) < Math.abs(x - sm.x)) sm = q
      return sm
    }
    // Where the lit flank starts at x: the diagonal from the nearest summit, 0.8px across per px down.
    const litFrom = (x: number) => {
      const sm = summitAt(x)
      // Which way the split leans, eased as the light passes over the summit.
      const away = clamp((sm.x - toward) / 300, -1, 1)
      return sm.y + Math.max(0, away * (x - sm.x)) / 0.8
    }
    const shade = new Shape()
    const lit = new Shape()
    // One polygon per stretch of cap: along its top edge, then back along its bottom.
    const band = (
      shape: Shape,
      i: number,
      j: number,
      upper: (q: number) => number,
      lower: (q: number) => number,
    ) => {
      shape.moveTo(i * RIDGE_STEP, upper(i))
      for (let q = i + 1; q <= j; q++) shape.lineTo(q * RIDGE_STEP, upper(q))
      for (let q = j; q >= i; q--) shape.lineTo(q * RIDGE_STEP, lower(q))
      shape.closePath()
    }
    let top = this.horizon
    let i = 0
    while (i < n) {
      if (!inCap(i)) {
        i++
        continue
      }
      let j = i
      while (j + 1 < n && inCap(j + 1)) j++
      band(
        shade,
        i,
        j,
        (q) => ridge[q],
        (q) => line[q],
      )
      // The lit flank's foot rises from the snowline to just under its summit as the sun sinks
      // behind the crest, the way the last light leaves a peak from the foot up and the first
      // comes down it; its top edge, the split, never moves with the sun's height.
      const upper = (q: number) =>
        Math.min(line[q], Math.max(ridge[q], litFrom(q * RIDGE_STEP)))
      band(lit, i, j, upper, (q) => {
        const u = upper(q)
        const tip = summitAt(q * RIDGE_STEP).y + 2.2 * CH
        return Math.max(u, Math.min(line[q], lerp(line[q], tip, rimT)))
      })
      for (let q = i; q <= j; q++) top = Math.min(top, ridge[q])
      i = j + 1
    }
    if (top === this.horizon) return
    const meta = (id: number) => ({ id, light: 0.5, back: false })
    r.fill(shade, shadeCol, Kind.Land, 1, meta(LandMat.SnowShade))
    r.fill(lit, litCol, Kind.Land, 1, meta(LandMat.SnowLit))
  }

  private drawLand(r: Raster, p: Palette) {
    const W = this.width
    const colors = this.ridgeColors(p)
    // Slopes facing the sun (or moon) catch light under the crest and the far sides fall into
    // shade. Only the glyphs carry it: lit slopes print a denser, brighter halftone.
    const { cx, cy, R } = this.globeAt()
    const { light, color: lightCol } = this.slopeLight(p)
    // Sunk behind the range, the sun lights only a rim along the crest; low but clear of it, its
    // light rakes across, and the shaded flanks go deeper and run further down.
    const { sun } = this.lights(p)
    const rim = sun > 0 ? this.sunk() : 0
    const low = sun > 0 ? this.sunLook(p).low * (1 - rim) : 0
    const trees = this.forestColors(p, colors)
    const rock = { id: LandMat.Rock, light: 0.5, back: false }
    this.ridges.forEach((ridge, layer) => {
      // Each ridge resets the material under it, so snow or forest behind, or the sun and moon's
      // mark (GLOBE), doesn't show through.
      r.fill(
        this.ridgePath(ridge, this.height + 10),
        colors[layer],
        Kind.Land,
        1,
        rock,
      )
      // Four strips, each shallower and stronger, so the glyphs thicken toward the crest.
      const q = clamp(light / 0.45, 0, 1)
      const fs = light > 0 ? this.facing(ridge, cx, cy, R * 1.5) : null
      for (const [k, reach] of (light > 0
        ? [1, 0.7, 0.45, 0.25]
        : []
      ).entries()) {
        const s = q * (0.35 + 0.65 * (k / 3))
        const sl = s * (1 - rim * (1 - k / 3))
        for (const { path, w } of fs
          ? this.slopes(ridge, layer, reach, fs, 1 + 0.6 * low)
          : []) {
          if (w > 0)
            r.fill(
              path,
              mix(colors[layer], lightCol, Math.min(1, 1.6 * light * sl * w)),
              Kind.Land,
              1,
              { id: 0, light: 0.5 + 0.5 * sl * w, back: false },
            )
          else
            r.fill(
              path,
              mix(
                colors[layer],
                p.ground,
                light * 0.6 * s * -w * (1 + 0.6 * Math.max(low, rim)),
              ),
              Kind.Land,
              1,
              { id: 0, light: 0.5 + 0.5 * s * w, back: false },
            )
        }
      }
      if (layer === 0) this.drawSnow(r, ridge, p, cx)
      if (layer === 1)
        this.forest.forEach((shape, k) =>
          r.fill(shape, trees.rows[k], Kind.Land, 1, {
            id: LandMat.Canopy,
            light: 0.5,
            back: false,
          }),
        )
      if (layer === 2) {
        r.fill(this.scrub, trees.rows[2], Kind.Land, 1, {
          id: LandMat.Canopy,
          light: 0.5,
          back: false,
        })
        r.gradient(this.scrub, this.scrubTop, this.horizon, [
          [0, trees.rows[2], 1],
          [0.55, trees.rows[2], 1],
          [1, colors[2], 1],
        ])
        for (const shape of this.spruce)
          r.fill(shape, trees.spruce, Kind.Land, 1, {
            id: LandMat.Spruce,
            light: 0.5,
            back: false,
          })
      }
    })
    // The land's materials and slope light live in the meta layer, over the whole range.
    let top = this.treeTop
    for (const ridge of this.ridges)
      for (const y of ridge) top = Math.min(top, y)
    r.touchMeta(0, top)
    r.touchMeta(W, this.horizon)
    // Meadow floor, darkening toward the viewer.
    const ground = new Shape()
    ground.rect(-10, this.horizon, W + 20, this.height - this.horizon + 10)
    r.fill(ground, p.hillNear, Kind.Land)
    r.gradient(ground, this.horizon, this.height, [
      [0, mix(p.hillNear, p.grassDark, 0.4), 1],
      [1, p.ground, 1],
    ])
    // The river: its banks, then its water, then the islet and stones in it and the spruce on its
    // banks. Where across the flow each cell lies goes to the type apart (riverField), worked out
    // once: as strips across the flow here it was most of the land's shapes, sent every frame.
    const rc = this.riverColors(p)
    r.fill(this.shoreShape, rc.shore[2][1], Kind.Land, 1, {
      id: LandMat.Shore,
      light: 0.5,
      back: false,
    })
    r.gradient(this.shoreShape, this.horizon, this.riverEnd, rc.shore)
    r.fill(this.riverShape, rc.water[2][1], Kind.Land, 1, {
      id: LandMat.Water,
      light: 0.5,
      back: false,
    })
    r.gradient(this.riverShape, this.horizon, this.riverEnd, rc.water)
    r.fill(this.islet, rc.bar, Kind.Land, 1, {
      id: LandMat.Shore,
      light: 0.5,
      back: false,
    })
    for (const shape of this.stones)
      r.fill(shape, rc.stone, Kind.Land, 1, {
        id: LandMat.Stone,
        light: 0.5,
        back: false,
      })
    for (const shape of this.bankTrees)
      r.fill(shape, trees.spruce, Kind.Land, 1, {
        id: LandMat.Spruce,
        light: 0.5,
        back: false,
      })
    r.touchMeta(W, this.riverEnd + 4)
    // Low mist on the horizon, colour only, so the land underneath keeps its kind. It thins
    // against a low sun so the backlit ridges keep their shadow, and after it.
    const veil =
      0.55 * (1 - 0.6 * Math.max(this.backlight(p), 0.7 * this.unlit(p)))
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
    // A wide screen's sun sets into the saddle between the two snowy massifs. A phone's runs
    // nearly edge to edge, up past the dawn notch and down the far side of the saddle, so a swipe
    // carries it a longer way for the same hours; a tablet falls between.
    const wide = clamp((this.width / this.rangeWidth - 0.5) / 0.5, 0, 1)
    return {
      cx: lerp(
        lerp(0.06, 0.12, wide) * this.width,
        lerp(0.88 * this.width, this.rangeX(SADDLE), wide),
        t,
      ),
      cy:
        this.horizon -
        Math.sin(Math.PI * clamp(t, 0, 1)) * this.height * 0.36 -
        this.height * 0.03,
      R: Math.min(this.width, this.height) * 0.075,
    }
  }

  /** Where the sun or moon is and how much of each shows, for the weather's eclipse. */
  globe(p: Palette) {
    return { ...this.globeAt(), ...this.lights(p), skyline: this.skylineAt }
  }

  /** The top of the land at x, ridges and trees: what stands in front of the sun and moon. */
  skylineAt = (x: number) => {
    const sky = this.skyline
    const i = Math.round(x / FOREST_STEP) + 1
    return sky.length
      ? sky[Math.min(sky.length - 1, Math.max(0, i))]
      : this.horizon
  }

  /** How strongly the ridge crest catches the light: under the moon, or as the sun sets behind it. */
  /** How much of the sun and the moon shows: the sun by day, the moon once the night is deep. */
  private lights(p: Palette) {
    const h = this.hour
    const day = h >= 6 && h < 18.5
    // The moon comes out once the sky has gone over to night's blue (the palette's NIGHT key,
    // night 1), not while twilight's violet still hangs over the ridges.
    const moon = day ? 0 : moonUp(p.night, h) * p.moonlight
    return { sun: sunAt(h), moon }
  }

  /**
   * How far the sun or moon has sunk behind the crest under it, 0 wholly clear to 1 wholly hidden,
   * eased across the disc's own height. The land is lit from the side only while the disc stands
   * clear of the ridges; behind them it backlights the range, which goes to silhouette with a rim
   * along its crest. Read off the highest crest across the disc's width, so a jag in the ridge
   * doesn't flick it; cached by the hour, since every pass over the land asks.
   */
  private sunk() {
    const key = `${this.hour},${this.width},${this.height}`
    if (this.sunkFor === key) return this.sunkValue
    const { cx, cy, R } = this.globeAt()
    let top = this.horizon
    for (let dx = -R; dx <= R; dx += RIDGE_STEP)
      top = Math.min(top, this.hillTop(cx + dx))
    this.sunkFor = key
    this.sunkValue = 1 - smoothstep(-R, R, top - cy)
    return this.sunkValue
  }

  private sunkFor = ''
  private sunkValue = 0

  /**
   * The glow in `col`, `peak` strong at the disc and falling as (1 - s)² out to `reach`, drawn
   * `step` px to a pixel. Each pixel's alpha is scattered a little at random, so the faint fade
   * across a dark sky has no steps to read as rings. The alpha is worked out only
   * when the size changes; the colour is laid on each time.
   */
  private glowSprite(
    reach: number,
    R: number,
    peak: number,
    col: Rgb,
    step: number,
  ) {
    // Rounded up to 16 px, so a window being resized re-makes it only now and then; it's drawn
    // down to the reach it's asked for either way.
    const n = Math.ceil(reach / step / 16) * 16
    const r0 = R / step
    const key = `${n},${r0.toFixed(1)},${peak},${step}`
    let glow = this.glows.get(step)
    if (glow?.key !== key) {
      const size = 2 * n
      const mask = glow?.mask ?? document.createElement('canvas')
      const tint = glow?.tint ?? document.createElement('canvas')
      mask.width = tint.width = size
      mask.height = tint.height = size
      const mctx = mask.getContext('2d')
      if (mctx) {
        const img = mctx.createImageData(size, size)
        const d = img.data
        const out = n - r0
        for (let y = 0; y < size; y++) {
          const dy = y + 0.5 - n
          const row = (y % DITHER) * DITHER
          for (let x = 0; x < size; x++) {
            const dx = x + 0.5 - n
            const s = (Math.sqrt(dx * dx + dy * dy) - r0) / out
            if (s >= 1) continue
            const v = (s <= 0 ? 1 : (1 - s) * (1 - s)) * peak * 255
            // Triangular noise, two steps wide, tapering off in the faint tail so the edge isn't lifted.
            const j = row + (x % DITHER)
            const tri = dither[j] + dither[(j * 7 + 13) % dither.length] - 1
            const i = (y * size + x) * 4
            d[i] = d[i + 1] = d[i + 2] = 255
            d[i + 3] = Math.max(
              0,
              Math.floor(v + 0.5 + 2 * tri * Math.min(1, v / 3)),
            )
          }
        }
        mctx.putImageData(img, 0, 0)
      }
      glow = { key, mask, tint, tinted: '' }
      this.glows.set(step, glow)
    }
    const { mask, tint } = glow
    // A repaint that only moves the glow keeps its tint.
    const fill = css(col)
    const tctx = glow.tinted === fill ? null : tint.getContext('2d')
    if (tctx) {
      glow.tinted = fill
      tctx.globalCompositeOperation = 'copy'
      tctx.fillStyle = fill
      tctx.fillRect(0, 0, tint.width, tint.height)
      tctx.globalCompositeOperation = 'destination-in'
      tctx.drawImage(mask, 0, 0)
    }
    return tint
  }

  /**
   * The moon's look by height: its own colour high up, a little warmer near the hills as the air
   * it shines through thickens, as the sun's is; and the disc a touch brighter than its light.
   */
  private moonLook(p: Palette) {
    const { cy } = this.globeAt()
    const low = 1 - smoothstep(0, this.height * 0.32, this.horizon - cy)
    const color = mix(p.globe, [255, 196, 120], 0.3 * low * low)
    // Lifted toward full brightness in its own hue, so a gold moon stays gold.
    const lift = Math.min(1.15, 255 / Math.max(...color))
    return { low, color, disc: color.map((v) => v * lift) as Rgb }
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

  /**
   * The glow's colour in steps of 4, the same for the backdrop's key and the glow's tint, so the
   * colour drifting with the clock or a scrub re-tints the glow only when it steps, not on every
   * repaint something else asks for. A step is under one screen level at the glow's peak alpha.
   */
  private glowColor(p: Palette): Rgb {
    const { sun } = this.lights(p)
    const col = sun ? this.sunLook(p).color : this.moonLook(p).color
    return col.map((v) => Math.min(255, (((v | 0) >> 2) << 2) + 2)) as Rgb
  }

  /** The glows move and colour with the sun and moon, so the cached backdrop repaints as they do. */
  backdropKey(p: Palette) {
    const { sun, moon } = this.lights(p)
    if (sun + moon <= 0) return ''
    const { cx, cy } = this.globeAt()
    const col = this.glowColor(p)
    return `${Math.round(cx / 4)},${Math.round(cy / 4)},${sun.toFixed(2)},${moon.toFixed(2)},${(this.moonPhase ?? moonPhaseNow()).toFixed(3)},${col}`
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
    // Their GLOBE mark is read only inside the meta bounds, which otherwise start at the land:
    // above it the moon would lose its tile, a hard line across the disc.
    r.touchMeta(cx - R * 1.6, cy - R * 1.6)
    r.touchMeta(cx + R * 1.6, cy + R * 1.6)
    if (sun > 0) {
      // Solid at the core, thinning to a sparse halo of dots at the edge, like a halftone print.
      const { color, rx, ry } = this.sunLook(p)
      const halo = new Shape()
      halo.ellipse(cx, cy, rx * 1.45, ry * 1.45, 0, 0, TAU)
      r.fill(halo, color, Kind.Fluff, 0.14 * sun, GLOBE)
      const rim = new Shape()
      rim.ellipse(cx, cy, rx * 1.15, ry * 1.15, 0, 0, TAU)
      r.fill(rim, color, Kind.Fluff, 0.35 * sun, GLOBE)
      const disc = new Shape()
      disc.ellipse(cx, cy, rx, ry, 0, 0, TAU)
      r.fill(disc, mix(color, [255, 250, 235], 0.25), Kind.Fluff, sun, GLOBE)
    }
    if (moon > 0) {
      // Lit by the phase: the bright limb on the right while waxing, on the left while waning,
      // and the terminator an ellipse that bows toward the light in a crescent, away in a gibbous.
      const { lit, dark, side, k } = this.moonShape()
      const { color, disc } = this.moonLook(p)
      r.fill(lit, disc, Kind.Fluff, moon, GLOBE)
      // Earthshine on the dark side.
      r.fill(dark, mix(color, p.skyTop, 0.85), Kind.Fluff, 0.22 * moon, GLOBE)
      // The seas, as darker patches wherever they fall on the lit face.
      const seas = new Shape()
      for (const [sx, sy, rx, ry] of SEAS) {
        const dy = clamp(sy, -0.99, 0.99)
        const edge = side * k * Math.sqrt(1 - dy * dy)
        if (side * sx < side * edge + rx) continue
        seas.moveTo(cx + (sx + rx) * R, cy + sy * R)
        seas.ellipse(cx + sx * R, cy + sy * R, rx * R, ry * R, 0, 0, TAU)
      }
      r.fill(seas, mix(disc, p.skyTop, 0.6), Kind.Fluff, moon, GLOBE)
    }
  }
}

/**
 * How much of the sun shows at `hour`: it comes up over three quarters of an hour and goes down
 * the same way, rather than switching on at six like a lamp.
 */
export function sunAt(hour: number) {
  return hour >= 6 && hour < 18.5
    ? smoothstep(6, 6.75, hour) * (1 - smoothstep(17.75, 18.5, hour))
    : 0
}

/**
 * How much of the moon is out for the palette's `night` at `hour`: in the evening none until the
 * sky has all but reached night's blue, full with it, about 21:10 to 21:40; before dawn it holds
 * while the night lifts, going by 5:35, so it sets behind the ridges as the slider's moonset
 * says. palette.ts's withMoon follows the same curve for the slider's moon colour.
 */
export function moonUp(night: number, hour: number) {
  return hour >= 12 ? smoothstep(0.9, 1, night) : smoothstep(0.5, 0.9, night)
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
