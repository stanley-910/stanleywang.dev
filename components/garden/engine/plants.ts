import {
  basis,
  disc,
  drawPetals,
  flush,
  headAxis,
  project,
  type Vec3,
} from './bloom'
import {
  clamp,
  easeOut,
  hash,
  lerp,
  mulberry32,
  noise1,
  smoothstep,
  TAU,
} from './math'
import { mix, shade, type Palette, type Rgb } from './palette'
import { particle, type Particles } from './particles'
import { FLOWER_FLUFF, Kind, type Raster, Shape } from './raster'
import { Stem } from './stem'

import type { Wind } from './wind'

export type Species = 'poppy' | 'cosmos' | 'lace' | 'dandelion' | 'rose'

export interface Env {
  wind: Wind
  particles: Particles
  palette: Palette
  /** Viewport height: the unit plant sizes are given in. */
  unit: number
  /** Ground line for a depth. */
  floor: (z: number) => number
  /** Screen y no stem tip rises past: just under where the trees on the near ridge start. */
  ceiling: number
  /** True while the garden grows in, so it doesn't shed a season's petals in four seconds. */
  quiet: boolean
}

const hazeOf = (z: number) => 0.68 * (1 - z) ** 1.6

type Leaf = {
  joint: number
  side: number
  angle: number
  length: number
  seed: number
}

/** Flower heads print larger than life so each one spans enough cells to read as a flower. */
const HEAD = 1.6

/** Seconds a sown plant takes to reach full flower. */
export const RUSH = 2
/** Stem damping in the wind (Stem.damping). */
const SWAY = 0.35
/**
 * Stem damping while the opening grows a plant in, or a click's flower comes up: its bud
 * straightens without a bounce.
 */
const SETTLED = 0.9
/** Seconds after the opening for the stems to loosen back to SWAY. */
const LOOSEN = 2

/**
 * One plant and its life: a stalk that grows, a bud, a flower, seed, and a fade back into the
 * grass. The garden replaces it with a seedling of the same kind when its cycle ends.
 */
export abstract class Plant {
  abstract readonly species: Species
  age = 0
  /** Seconds from seed to gone. */
  cycle = 200
  readonly rng: () => number
  readonly scale: number
  stems: Stem[] = []
  leaves: Leaf[] = []
  /** Head radius at full flower, so the garden can keep heads off the text. */
  crown = 0
  /** Which way the bud nods: -1 left, 1 right. */
  readonly side: number
  readonly facing: number
  readonly haze: number
  /** Set each frame after dark: every flower but the nearest steps back a little. */
  dim = 0
  /** 1 while alive; a plant made to leave fades to 0 and is removed. */
  fade = 1
  leaving = false
  /**
   * 1 while the opening grows this plant in, falling to 0 over LOOSEN seconds after: the stems
   * damp toward SETTLED, since a whole life passes in seconds and the buds straighten fast.
   */
  calm = 0
  private rush: { from: number; to: number; t: number } | null = null

  constructor(
    readonly x: number,
    readonly z: number,
    readonly seed: number,
  ) {
    this.rng = mulberry32(seed)
    this.scale = lerp(0.26, 1.18, z ** 1.15)
    this.side = this.rng() < 0.5 ? -1 : 1
    this.facing = lerp(0.15, 0.95, this.rng())
    this.haze = hazeOf(z)
  }

  get done() {
    return this.age >= this.cycle
  }

  /** Age at which the plant is in full flower, to start the garden mostly blooming. */
  abstract bloomAge(): number

  /** Age by which the stalk has grown and the head lifted and opened. */
  abstract openAge(): number

  /**
   * A stem's length held under the ceiling. Short stems keep theirs; past 60% of the room they
   * ease toward it, so tall flowers still differ in height instead of lining up like a hedge.
   * A far flower has little room, so near the horizon it stays low, as it would in perspective.
   */
  protected reach(length: number, env: Env) {
    const room = Math.max(env.unit * 0.02, env.floor(this.z) - env.ceiling)
    const knee = room * 0.6
    if (length <= knee) return length
    return (
      knee + (room - knee) * (1 - Math.exp(-(length - knee) / (room - knee)))
    )
  }

  protected makeStem(n: number, length: number, env: Env) {
    const s = new Stem(n)
    s.length = length
    s.baseX = this.x
    s.baseY = env.floor(this.z)
    s.depth = this.z
    s.baseAngle = (this.rng() - 0.5) * 0.12
    return s
  }

  /** After a resize: roots move to the new ground line; branches follow their parent. */
  reanchor(env: Env) {
    for (const s of this.stems) if (!s.parent) s.baseY = env.floor(this.z)
  }

  /**
   * Sown by a click: grow straight to full flower over RUSH seconds instead of half a minute.
   * Its age runs evenly to just open, so the stalk draws up (its growth eases out) and then the
   * bud swells, lifts and opens, each in its own time; run on into the bloom, a poppy's nod
   * straightened in a blink and the head sprang up and bobbed.
   */
  hurry() {
    this.rush = { from: this.age, to: Math.max(this.age, this.openAge()), t: 0 }
  }

  update(dt: number, env: Env) {
    if (this.rush) {
      const q = this.rush
      q.t = Math.min(1, q.t + dt / RUSH)
      this.age = lerp(q.from, q.to, q.t)
      // Then it loosens to the wind's sway, as the opening's flowers do.
      this.calm = 1
      if (q.t >= 1) this.rush = null
    } else this.age += dt
    const damping = lerp(SWAY, SETTLED, this.calm)
    for (const s of this.stems) s.damping = damping
    this.calm = Math.max(0, this.calm - dt / LOOSEN)
    if (this.leaving) this.fade = Math.max(0, this.fade - dt / 1.5)
    this.live(env, dt)
    const sub = 2
    for (let i = 0; i < sub; i++)
      for (const s of this.stems) s.step(dt / sub, env.wind)
  }

  protected abstract live(env: Env, dt: number): void
  abstract draw(r: Raster, env: Env): void

  protected hazed(c: Rgb, p: Palette): Rgb {
    return mix(c, p.haze, this.haze)
  }

  /** Stems take half the haze, between heads and leaves, so a far bloom never floats free of its stalk. */
  protected stalked(c: Rgb, p: Palette): Rgb {
    return mix(c, p.haze, this.haze * 0.5)
  }

  /** Flower heads take only a little of the distance haze, so far blooms keep their colour. */
  protected bloomed(c: Rgb, p: Palette): Rgb {
    return mix(mix(c, p.haze, this.haze * 0.35), p.ground, this.dim)
  }

  protected withered(c: Rgb, w: number, p: Palette): Rgb {
    return mix(c, mix(p.grassDark, p.haze, 0.5), w)
  }

  protected drawStem(r: Raster, s: Stem, color: Rgb, width: number) {
    if (s.growth < 0.01) return
    // Far stalks are thinner than a cell; widen them to one so far heads don't float.
    r.stroke(s.path(), color, Kind.Stem, Math.max(width, r.minLine))
  }

  /** Lobed basal leaves, arching out and down from the base. */
  protected drawLeaf(
    r: Raster,
    s: Stem,
    leaf: Leaf,
    color: Rgb,
    env: Env,
    style: 'lobed' | 'thread' | 'fern' | 'toothed',
    grow: number,
  ) {
    const j = Math.min(leaf.joint, s.n)
    const bx = s.pts[j * 2]
    const by = s.pts[j * 2 + 1]
    const sway =
      env.wind.at(bx, by, this.z) * 0.07 + env.wind.push(bx, by) * 0.12
    const L = leaf.length * grow
    if (L < 2) return
    const a0 = s.abs[Math.min(j, s.n - 1)] + leaf.side * leaf.angle + sway
    // Midrib as a curve that arches out and droops at the end.
    const N = 6
    const mid: number[] = []
    let x = bx
    let y = by
    let a = a0
    for (let i = 0; i <= N; i++) {
      mid.push(x, y)
      a += leaf.side * 0.09 * (style === 'toothed' ? 0.3 : 1)
      x += (Math.sin(a) * L) / N
      y -= (Math.cos(a) * L) / N
    }
    if (style === 'thread' || style === 'fern') {
      const p = new Shape()
      p.moveTo(mid[0], mid[1])
      for (let i = 1; i <= N; i++) p.lineTo(mid[i * 2], mid[i * 2 + 1])
      // Fine leaflets off the midrib, like cosmos foliage or the fern-cut leaves of wild carrot.
      const count = style === 'fern' ? 9 : 5
      for (let i = 1; i <= count; i++) {
        const t = i / (count + 1)
        const k = Math.floor(t * N)
        const px = mid[k * 2]
        const py = mid[k * 2 + 1]
        const ang = a0 + leaf.side * 0.09 * k
        const ll = L * (style === 'fern' ? 0.32 : 0.45) * (1 - t * 0.6)
        for (const sd of [-1, 1]) {
          const la = ang + sd * (style === 'fern' ? 0.95 : 0.6)
          p.moveTo(px, py)
          p.quadraticCurveTo(
            px + Math.sin(la) * ll * 0.6,
            py - Math.cos(la) * ll * 0.6,
            px + Math.sin(la + sd * 0.3) * ll,
            py - Math.cos(la + sd * 0.3) * ll + ll * 0.15,
          )
        }
      }
      r.stroke(p, color, Kind.Foliage, Math.max(0.7, 1.3 * this.scale))
      return
    }
    // Filled blade with lobes (poppy) or backward teeth (dandelion).
    const left: number[] = []
    const right: number[] = []
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const ang = a0 + leaf.side * 0.09 * i
      const nx = Math.cos(ang)
      const ny = Math.sin(ang)
      const env0 =
        Math.sin(Math.PI * Math.min(1, t * 1.1)) *
        L *
        (style === 'toothed' ? 0.2 : 0.17)
      const lobe =
        style === 'lobed'
          ? 0.55 + 0.45 * Math.abs(Math.sin(t * 9 + leaf.seed))
          : 0.5 + 0.5 * (i % 2 ^ 1)
      const w = env0 * lobe
      left.push(mid[i * 2] - nx * w, mid[i * 2 + 1] - ny * w)
      right.push(mid[i * 2] + nx * w, mid[i * 2 + 1] + ny * w)
    }
    const p = new Shape()
    p.moveTo(left[0], left[1])
    for (let i = 2; i < left.length; i += 2) p.lineTo(left[i], left[i + 1])
    for (let i = right.length - 2; i >= 0; i -= 2)
      p.lineTo(right[i], right[i + 1])
    p.closePath()
    r.fill(p, color, Kind.Foliage)
  }

  /** Short bristles on a bud or stalk, as on a corn poppy. */
  protected hairs(
    r: Raster,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    angle: number,
    color: Rgb,
    n: number,
  ) {
    const p = new Shape()
    const ca = Math.cos(angle)
    const sa = Math.sin(angle)
    for (let i = 0; i < n; i++) {
      const t = (i / n) * TAU + this.seed
      const ex = Math.cos(t) * rx
      const ey = Math.sin(t) * ry
      const x = cx + ex * ca - ey * sa
      const y = cy + ex * sa + ey * ca
      const len = 1 + 0.7 * Math.abs(noise1(i * 2.3, this.seed))
      p.moveTo(x, y)
      p.lineTo(
        cx + (x - cx) * (1 + 0.35 * len),
        cy + (y - cy) * (1 + 0.35 * len),
      )
    }
    r.stroke(p, color, Kind.Fluff, Math.max(0.5, 0.8 * this.scale))
  }
}

// ── Corn poppy ──────────────────────────────────────────────────────────────
// Bristly wiry stalk; the bud hangs on a hooked neck, straightens as it swells, sheds its two
// sepals and unfurls four crumpled petals (two broad outer, two smaller inner) around a ribbed
// stigma disc. After a day or two the petals drop and the pepper-pot capsule shakes out seed.

export class Poppy extends Plant {
  readonly species = 'poppy'
  private G: number
  private B: number
  private P: number
  private stem: Stem
  private shed = 0
  private head = 0
  /**
   * How far the cup turns toward the viewer, in radians: about a third turn away, showing the
   * deeper red outside with the heart hidden; a quarter stand side-on; the rest look toward you.
   * When nearly all faced the viewer, nothing showed the outside to tell the inside by. Drawn
   * from the seed, not the plant's rng, so the meadows picked by hand keep their layout.
   */
  private readonly turn: number

  constructor(x: number, z: number, seed: number, env: Env) {
    super(x, z, seed)
    const h = hash(seed, 11)
    const t = hash(seed, 12)
    this.turn =
      h < 0.35
        ? lerp(-0.65, -0.2, t)
        : h < 0.6
          ? lerp(-0.1, 0.15, t)
          : lerp(0.3, 0.95, t)
    const r = this.rng
    this.G = lerp(8, 12, r())
    // Blooms hold a good while, so shedding stays occasional across the meadow.
    this.B = lerp(140, 280, r())
    this.P = lerp(30, 50, r())
    this.cycle = this.G + 20 + this.B + 6 + this.P + 6
    const length = this.reach(
      env.unit * lerp(0.24, 0.46, r()) * this.scale,
      env,
    )
    this.stem = this.makeStem(10, length, env)
    this.stem.stiffness = lerp(0.8, 1.1, r())
    this.head = length * lerp(0.12, 0.15, r()) * HEAD
    this.crown = this.head
    this.stems.push(this.stem)
    const leaves = 2 + Math.floor(r() * 3)
    for (let i = 0; i < leaves; i++) {
      this.leaves.push({
        joint: 0,
        side: i % 2 ? 1 : -1,
        angle: lerp(0.55, 1.25, r()),
        length: length * lerp(0.16, 0.26, r()),
        seed: r() * 10,
      })
    }
    this.leaves.push({
      joint: 3,
      side: r() < 0.5 ? -1 : 1,
      angle: 0.6,
      length: length * 0.09,
      seed: r() * 10,
    })
  }

  bloomAge() {
    return this.G + 20 + this.rng() * this.B * 0.8
  }

  openAge() {
    return this.G + 20
  }

  private phase() {
    const t = this.age
    const G = this.G
    const bloomEnd = G + 20 + this.B
    return {
      growth: 0.12 + 0.88 * easeOut(t / G),
      nod: 1 - smoothstep(G + 8, G + 14, t),
      bud: lerp(0.35, 1, smoothstep(0, G + 10, t)),
      open: smoothstep(G + 14, G + 20, t),
      shed: clamp((t - bloomEnd) / 6, 0, 1),
      pod: smoothstep(bloomEnd - 2, bloomEnd + 6, t),
      wither: smoothstep(this.cycle - 8, this.cycle, t),
    }
  }

  protected live(env: Env, dt: number) {
    const ph = this.phase()
    const s = this.stem
    s.growth = ph.growth * (1 - 0.25 * ph.wither)
    s.setCurve(
      this.side * (2.75 * ph.nod + 0.3 * ph.wither),
      0.55,
      this.side * 0.04,
    )
    s.headMass = 0.05 + 0.07 * ph.bud * (1 - ph.pod * 0.4)
    s.headDrag = 0.15 + 0.5 * ph.open * (1 - ph.shed)

    const tx = s.tipX()
    const ty = s.tipY()
    const fallen = Math.floor(ph.shed * 4.999)
    while (this.shed < fallen) {
      this.shed++
      // Only one petal in three drifts down; the rest just leave the head.
      if (env.quiet || this.shed % 3) continue
      const a = this.rng() * TAU
      env.particles.add(
        particle({
          type: 'petal',
          x: tx + Math.cos(a) * this.head * 0.5,
          y: ty - this.head * 0.3,
          vx: env.wind.at(tx, ty) * 40,
          size: this.head * 0.55,
          color: this.bloomed(env.palette.poppy, env.palette),
          floor: env.floor(this.z) - this.rng() * 6,
          depth: this.z,
          life: 60,
        }),
      )
    }
    // Censer dispersal: a ripe capsule only lets seed out through its pores when tossed hard.
    if (
      !env.quiet &&
      ph.pod > 0.9 &&
      ph.wither < 0.5 &&
      s.tipSpeed() > 1.6 &&
      this.rng() < dt * 6
    ) {
      env.particles.add(
        particle({
          type: 'seed',
          x: tx,
          y: ty - this.head * 0.3,
          vx: env.wind.at(tx, ty) * 30,
          vy: -20,
          size: Math.max(0.6, this.head * 0.04),
          color: env.palette.disc,
          floor: env.floor(this.z),
          depth: this.z,
          life: 6,
        }),
      )
    }
  }

  draw(r: Raster, env: Env) {
    const p = env.palette
    const ph = this.phase()
    const s = this.stem
    const wither = ph.wither
    const stemColor = this.stalked(this.withered(p.stem, wither, p), p)
    const leafColor = this.hazed(
      // Toward the stalk's colour, so a leaf in front of a flower reads as a leaf, not a hole.
      this.withered(mix(p.grassDark, p.stem, 0.7), wither, p),
      p,
    )
    for (const leaf of this.leaves)
      this.drawLeaf(r, s, leaf, leafColor, env, 'lobed', ph.growth)
    this.drawStem(r, s, stemColor, Math.max(1.6, 2.8 * this.scale))

    const tx = s.tipX()
    const ty = s.tipY()
    const tip = s.tipAngle()
    const H = this.head

    if (ph.pod > 0.5) {
      this.drawCapsule(
        r,
        tx,
        ty,
        tip,
        H * lerp(0.7, 1, ph.pod),
        stemColor,
        p,
        wither,
      )
      if (ph.shed >= 1) return
    }

    // Poppies fold their petals in at night.
    const open = ph.open * (1 - 0.8 * p.night)
    if (ph.open < 0.02) {
      this.drawBud(r, tx, ty, tip, H * ph.bud, stemColor, p, 0)
      return
    }
    const axis = headAxis(tip, this.turn * ph.open)
    const list: { depth: number; draw: () => void }[] = []
    const poppy = this.bloomed(p.poppy, p)
    // Furling as it closes; once mostly furled, the dark heart and blotches are wrapped inside.
    const furl = smoothstep(0.75, 0.25, open)
    const hidden = furl > 0.6
    drawPetals(
      r,
      tx,
      ty,
      axis,
      {
        count: 4,
        // Closing, the petals keep most of their length and wrap round each other.
        length: H * lerp(0.82, 1, open),
        width: (u) =>
          H *
          0.66 *
          (0.22 + 0.78 * Math.sin(Math.min(1, u * 1.08) * Math.PI * 0.5)),
        cup: (u) => lerp(1.42, 0.42, open) + 0.32 * u * open,
        crinkle: lerp(0.55, 0.16, open),
        size: (k) => (k % 2 ? 0.84 : 1),
        // One petal on the cup's near side, below the heart, so a cup turned toward you holds
        // its heart in a bowl instead of showing it on a bare lower edge.
        rotation: this.nearSide(axis) + (hash(this.seed, 13) - 0.5) * 0.4,
        seed: this.seed,
        front: poppy,
        // The outside is a deeper, duller red than the lit inside, so which way a cup faces
        // reads at a glance: bright red with a dark heart is looking in.
        back: mix(
          mix(poppy, this.bloomed(p.poppyDeep, p), 0.5),
          this.bloomed(p.stem, p),
          0.1,
        ),
        // The dark heart and blotches lean to the deep red, so they print as part of the cup
        // rather than as grey glyphs over it.
        blotch: hidden ? undefined : mix(shade(p.disc, 0.9), p.poppyDeep, 0.45),
        throat: hidden ? 0 : 0.28,
        haze: p.haze,
        hazeAmount: 0,
        attached: (k) => k >= this.shed,
        wrap: furl,
      },
      list,
    )
    r.heads.push({
      x: tx,
      y: ty,
      r: H * lerp(0.82, 1, open),
      species: 'poppy',
      petal: poppy,
      disc: this.bloomed(p.disc, p),
      alpha: r.opacity * smoothstep(0.2, 0.5, ph.open),
      owner: this,
      depth: this.z,
    })
    // The heart, sorted in among the petals: a near-black red ring of stamens flecked with gold
    // pollen, around the seed pod's small violet-grey crown and its dark rays. Never under two
    // cells. A flat grey crown with no ring to frame it read as a grey patch, not a centre.
    const centerDepth = axis[2] * H * 0.1
    if (!hidden)
      list.push({
        depth: centerDepth,
        draw: () => {
          const ring = disc(
            tx,
            ty,
            axis,
            Math.max(H * 0.3, 1.6 * r.minLine),
            H * 0.06,
          )
          r.fill(
            ring,
            this.bloomed(mix(shade(p.disc, 1.1), p.poppyDeep, 0.55), p),
            Kind.Disc,
            0.95,
          )
          const [u, v] = basis(axis)
          const pollen = new Shape()
          const fleck = Math.max(H * 0.035, r.minLine * 0.45)
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * TAU + this.seed
            const reach = H * (i % 2 ? 0.21 : 0.26)
            const [x, y] = project(
              tx,
              ty,
              axis,
              [u, v],
              Math.cos(a) * reach,
              Math.sin(a) * reach,
              H * 0.08,
            )
            pollen.moveTo(x + fleck, y)
            pollen.ellipse(x, y, fleck, fleck, 0, 0, TAU)
          }
          r.fill(
            pollen,
            this.bloomed(mix(p.dandelion, p.poppy, 0.25), p),
            Kind.Disc,
          )
          const top = disc(tx, ty, axis, H * 0.1, H * 0.16)
          r.fill(
            top,
            this.bloomed(mix(p.cosmosVein, p.poppyDeep, 0.45), p),
            Kind.Disc,
          )
          const rays = new Shape()
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU
            const [x0, y0] = project(tx, ty, axis, [u, v], 0, 0, H * 0.17)
            const [x1, y1] = project(
              tx,
              ty,
              axis,
              [u, v],
              Math.cos(a) * H * 0.1,
              Math.sin(a) * H * 0.1,
              H * 0.16,
            )
            rays.moveTo(x0, y0)
            rays.lineTo(x1, y1)
          }
          r.stroke(
            rays,
            this.bloomed(mix(p.disc, p.poppyDeep, 0.4), p),
            Kind.Disc,
            Math.max(0.5, H * 0.03),
          )
        },
      })
    // The bud's halves part behind the petals pushing out of it. Drawn over them, they printed
    // as foliage across the middle of the head: sparse glyphs with no tile, so a see-through hole.
    if (ph.open < 0.35)
      this.drawBud(
        r,
        tx,
        ty,
        tip,
        H * ph.bud,
        stemColor,
        p,
        smoothstep(0, 0.35, ph.open),
      )
    flush(list)
  }

  /** A hairy, hanging, egg-shaped bud; `split` 0..1 parts the two sepals as the petals push out. */
  /** Angle, in the petals' plane, of the side of the cup nearest the viewer. */
  private nearSide(axis: Vec3) {
    const [u, v] = basis(axis)
    return Math.atan2(v[2], u[2])
  }

  private drawBud(
    r: Raster,
    tx: number,
    ty: number,
    tip: number,
    size: number,
    color: Rgb,
    p: Palette,
    split: number,
  ) {
    const len = size * 0.72
    const wid = size * 0.42
    const cx = tx + Math.sin(tip) * len * 0.45
    const cy = ty - Math.cos(tip) * len * 0.45
    const rot = tip
    const fade = 1 - split
    // A poppy's colour from the first: the bud prints as flower, not as grass strokes in the
    // stalk's grey, and warms toward the deep red as it swells.
    const bud = mix(
      color,
      this.bloomed(p.poppyDeep, p),
      lerp(0.4, 0.75, smoothstep(0, this.G + 11, this.age)),
    )
    for (const sd of [-1, 1]) {
      const path = new Shape()
      const off = sd * split * wid * 1.2
      path.ellipse(
        cx + Math.cos(rot) * off,
        cy + Math.sin(rot) * off,
        wid * (0.55 + 0.45 * fade) * 0.55,
        len * 0.55,
        rot + sd * split * 0.6,
        0,
        TAU,
      )
      r.fill(path, bud, Kind.Petal, Math.max(0.15, fade))
    }
    if (split === 0) {
      // Red showing through the seam just before it opens.
      if (this.age > this.G + 11) {
        const seam = new Shape()
        seam.ellipse(cx, cy, wid * 0.12, len * 0.42, rot, 0, TAU)
        r.fill(
          seam,
          this.bloomed(p.poppy, p),
          Kind.Petal,
          smoothstep(this.G + 11, this.G + 14, this.age),
        )
      }
      this.hairs(
        r,
        cx,
        cy,
        wid * 0.55,
        len * 0.55,
        rot,
        mix(bud, p.fluff, 0.35),
        14,
      )
    }
  }

  /** Pepper-pot seed capsule with its flat, ribbed crown. */
  private drawCapsule(
    r: Raster,
    tx: number,
    ty: number,
    tip: number,
    H: number,
    stem: Rgb,
    p: Palette,
    wither: number,
  ) {
    const len = H * 0.5
    const wid = H * 0.36
    const cx = tx + Math.sin(tip) * len * 0.45
    const cy = ty - Math.cos(tip) * len * 0.45
    const urn = new Shape()
    urn.ellipse(cx, cy, wid * 0.5, len * 0.55, tip, 0, TAU)
    const c = mix(mix(stem, p.haze, 0.25), [140, 120, 90], wither * 0.5)
    r.fill(urn, c, Kind.Disc)
    const axis = headAxis(tip, 0.35)
    const crownX = tx + Math.sin(tip) * len
    const crownY = ty - Math.cos(tip) * len
    r.fill(
      disc(crownX, crownY, axis, wid * 0.62, 0),
      this.bloomed(shade(p.disc, 1.4), p),
      Kind.Disc,
    )
    const [u, v] = basis(axis)
    const rays = new Shape()
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU
      const [x1, y1] = project(
        crownX,
        crownY,
        axis,
        [u, v],
        Math.cos(a) * wid * 0.6,
        Math.sin(a) * wid * 0.6,
        0,
      )
      rays.moveTo(crownX, crownY)
      rays.lineTo(x1, y1)
    }
    r.stroke(rays, mix(c, p.fluff, 0.35), Kind.Fluff, Math.max(0.5, H * 0.03))
  }
}

// ── Cosmos ──────────────────────────────────────────────────────────────────
// Tall, airy and branched, with thread-fine leaves. Eight broad ray petals, each with three
// notches at the tip and fine veins, around a small yellow disc. Heads open at different times.

type CosmosHead = {
  stem: Stem
  offset: number
  facing: number
  rot: number
  size: number
  shed: number
}

export class Cosmos extends Plant {
  readonly species = 'cosmos'
  private G: number
  private B: number
  private heads: CosmosHead[] = []
  private main: Stem

  constructor(x: number, z: number, seed: number, env: Env) {
    super(x, z, seed)
    const r = this.rng
    this.G = lerp(10, 14, r())
    this.B = lerp(160, 280, r())
    const length = this.reach(env.unit * lerp(0.3, 0.55, r()) * this.scale, env)
    this.main = this.makeStem(10, length, env)
    this.main.stiffness = lerp(0.55, 0.75, r())
    this.main.drag = 1.2
    this.stems.push(this.main)
    const head = length * lerp(0.1, 0.13, r()) * HEAD
    this.crown = head
    this.heads.push({
      stem: this.main,
      offset: 0,
      facing: lerp(0.5, 1.2, r()),
      rot: r() * TAU,
      size: head,
      shed: 0,
    })
    const branches = 1 + Math.floor(r() * 2.4)
    for (let i = 0; i < branches; i++) {
      const b = new Stem(6)
      b.parent = this.main
      b.parentJoint = 4 + Math.floor(r() * 4)
      b.branchAngle = (i % 2 ? 1 : -1) * lerp(0.3, 0.6, r())
      b.length = length * lerp(0.3, 0.5, r())
      b.stiffness = 0.6
      b.depth = z
      b.setCurve(-b.branchAngle * 0.6, 0.3)
      this.stems.push(b)
      this.heads.push({
        stem: b,
        offset: lerp(4, 18, r()),
        facing: lerp(0.4, 1.2, r()),
        rot: r() * TAU,
        size: head * lerp(0.75, 0.95, r()),
        shed: 0,
      })
    }
    this.cycle = this.G + 24 + this.B + 18 + 5 + 30 + 6
    for (const j of [2, 4, 6, 8]) {
      this.leaves.push({
        joint: j,
        side: j % 4 ? 1 : -1,
        angle: lerp(0.7, 1.1, r()),
        length: length * lerp(0.1, 0.16, r()),
        seed: r(),
      })
    }
  }

  bloomAge() {
    return this.G + 24 + this.rng() * this.B * 0.8
  }

  /** Its branches' heads open after the first. */
  openAge() {
    return this.G + 24 + Math.max(...this.heads.map((h) => h.offset))
  }

  private phase(offset: number) {
    const t = this.age - offset
    const G = this.G
    const bloomEnd = G + 24 + this.B
    return {
      bud: smoothstep(G - 2, G + 18, t),
      open: smoothstep(G + 18, G + 24, t),
      shed: clamp((t - bloomEnd) / 5, 0, 1),
      seed: smoothstep(bloomEnd + 2, bloomEnd + 8, t),
    }
  }

  protected live(env: Env) {
    const t = this.age
    const wither = smoothstep(this.cycle - 8, this.cycle, t)
    this.main.growth = (0.1 + 0.9 * easeOut(t / this.G)) * (1 - 0.2 * wither)
    this.main.setCurve(
      this.side * 0.25 * (1 - smoothstep(this.G, this.G + 18, t)) +
        wither * this.side * 0.6,
      0.6,
      0.02 * this.side,
    )
    for (const h of this.heads) {
      const ph = this.phase(h.offset)
      if (h.stem !== this.main)
        h.stem.growth = easeOut((t - h.offset * 0.5) / (this.G * 0.8))
      h.stem.headDrag = 0.1 + 0.45 * ph.open * (1 - ph.shed)
      h.stem.headMass = 0.03 + 0.02 * ph.bud
      const fallen = Math.floor(ph.shed * 8.999)
      while (h.shed < fallen) {
        h.shed++
        // Only one petal in three drifts down; the rest just leave the head.
        if (env.quiet || h.shed % 3) continue
        const tx = h.stem.tipX()
        const ty = h.stem.tipY()
        env.particles.add(
          particle({
            type: 'petal',
            x: tx + (this.rng() - 0.5) * h.size,
            y: ty,
            vx: env.wind.at(tx, ty) * 40,
            size: h.size * 0.5,
            color: this.bloomed(env.palette.cosmos, env.palette),
            floor: env.floor(this.z) - this.rng() * 6,
            depth: this.z,
            life: 60,
          }),
        )
      }
    }
  }

  draw(r: Raster, env: Env) {
    const p = env.palette
    const wither = smoothstep(this.cycle - 8, this.cycle, this.age)
    const stemColor = this.stalked(
      this.withered(mix(p.stem, p.grassDark, 0.2), wither, p),
      p,
    )
    const grow = this.main.growth
    for (const leaf of this.leaves)
      this.drawLeaf(r, this.main, leaf, stemColor, env, 'thread', grow)
    for (const s of this.stems)
      this.drawStem(
        r,
        s,
        stemColor,
        Math.max(1.4, (s === this.main ? 2.4 : 1.8) * this.scale),
      )

    const list: { depth: number; draw: () => void }[] = []
    for (const h of this.heads) {
      const ph = this.phase(h.offset)
      const s = h.stem
      if (s.growth < 0.2) continue
      const tx = s.tipX()
      const ty = s.tipY()
      const H = h.size
      const tip = s.tipAngle()
      if (ph.seed > 0) {
        // Seed head: a loose spray of slender achenes.
        const axis = headAxis(tip, 0.3)
        const [u, v] = basis(axis)
        const needles = new Shape()
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * TAU + h.rot
          const spread = 0.55 * (0.5 + 0.5 * Math.sin(i * 2.1))
          const len = H * 0.55 * ph.seed
          const [x1, y1] = project(
            tx,
            ty,
            axis,
            [u, v],
            Math.cos(a) * Math.sin(spread) * len,
            Math.sin(a) * Math.sin(spread) * len,
            Math.cos(spread) * len,
          )
          needles.moveTo(tx, ty)
          needles.lineTo(x1, y1)
        }
        r.stroke(
          needles,
          mix(stemColor, p.disc, 0.4 + 0.4 * wither),
          Kind.Stem,
          Math.max(0.5, H * 0.04),
        )
        continue
      }
      if (ph.open < 0.02) {
        if (ph.bud > 0.05) {
          const bud = new Shape()
          const rad = H * 0.22 * ph.bud
          bud.ellipse(
            tx + Math.sin(tip) * rad * 0.7,
            ty - Math.cos(tip) * rad * 0.7,
            rad * 0.8,
            rad,
            tip,
            0,
            TAU,
          )
          r.fill(
            bud,
            mix(stemColor, this.hazed(p.cosmosVein, p), 0.25),
            Kind.Foliage,
          )
        }
        continue
      }
      // Cosmos petals droop back after dark.
      const open = ph.open
      const night = p.night
      const axis = headAxis(tip, h.facing * open)
      // Each head a shade of its own, so where one covers another the two still read apart.
      const cosmos = this.bloomed(
        shade(p.cosmos, 0.86 + 0.14 * (h.rot / TAU)),
        p,
      )
      r.heads.push({
        x: tx,
        y: ty,
        r: H * lerp(0.35, 1, open),
        species: 'cosmos',
        petal: cosmos,
        disc: this.bloomed(p.dandelion, p),
        alpha: r.opacity * smoothstep(0.2, 0.5, open),
        owner: this,
        depth: this.z,
      })
      drawPetals(
        r,
        tx,
        ty,
        axis,
        {
          count: 8,
          length: H * lerp(0.35, 1, open),
          width: (u) => H * 0.21 * (0.25 + 0.75 * smoothstep(0, 0.7, u)),
          cup: (u) => lerp(1.3, 0.1, open) - night * 0.55 * u,
          crinkle: 0.06,
          rotation: h.rot,
          seed: this.seed + h.offset,
          front: cosmos,
          back: mix(cosmos, this.bloomed(p.cosmosVein, p), 0.5),
          notch: 0.07,
          veins: mix(p.cosmosVein, cosmos, 0.2),
          haze: p.haze,
          hazeAmount: 0,
          underside: 0.4,
          attached: (k) => k >= h.shed,
        },
        list,
      )
      // The petals start under the disc, but a front petal's average depth sorts it nearer than
      // the disc, and it would cover the centre. Once the head is near flat and faces the
      // viewer, the disc goes on top; a half-open cup still hides it behind its front petals.
      list.push({
        depth: axis[2] > 0 && open > 0.6 ? Infinity : axis[2] * H * 0.08,
        draw: () => {
          r.fill(
            disc(tx, ty, axis, Math.max(H * 0.2, 1.6 * r.minLine), H * 0.05),
            this.bloomed(p.dandelion, p),
            Kind.Disc,
          )
          r.fill(
            disc(tx, ty, axis, H * 0.1, H * 0.09),
            this.bloomed(shade(p.dandelion, 0.75), p),
            Kind.Disc,
          )
        },
      })
      flush(list)
    }
  }
}

// ── Wild carrot (Queen Anne's lace) ────────────────────────────────────────
// A flat-topped compound umbel: rays from one point, each ending in a small cluster of florets,
// often with a single dark floret in the middle. It opens from a nodding bundle and, going to
// seed, curls its rays inward into a "bird's nest".

export class Lace extends Plant {
  readonly species = 'lace'
  private G: number
  private B: number
  private stem: Stem
  private rays: { a: number; tilt: number; len: number; florets: number }[] = []
  private head: number
  private darkFloret: boolean

  constructor(x: number, z: number, seed: number, env: Env) {
    super(x, z, seed)
    const r = this.rng
    this.G = lerp(12, 16, r())
    this.B = lerp(110, 170, r())
    this.cycle = this.G + 30 + this.B + 30 + 6
    const length = this.reach(
      env.unit * lerp(0.32, 0.58, r()) * this.scale,
      env,
    )
    this.stem = this.makeStem(9, length, env)
    this.stem.stiffness = lerp(1, 1.3, r())
    this.stems.push(this.stem)
    this.head = length * lerp(0.13, 0.17, r())
    this.crown = this.head
    const n = 16 + Math.floor(r() * 8)
    for (let i = 0; i < n; i++) {
      this.rays.push({
        a: (i / n) * TAU + (r() - 0.5) * 0.3,
        tilt: lerp(0.55, 1, r()),
        len: lerp(0.75, 1, r()),
        florets: 5 + Math.floor(r() * 4),
      })
    }
    this.darkFloret = r() < 0.6
    for (let i = 0; i < 3; i++) {
      this.leaves.push({
        joint: 0,
        side: i % 2 ? 1 : -1,
        angle: lerp(0.4, 1, r()),
        length: length * lerp(0.2, 0.3, r()),
        seed: r(),
      })
    }
    this.leaves.push({
      joint: 4,
      side: r() < 0.5 ? 1 : -1,
      angle: 0.7,
      length: length * 0.12,
      seed: r(),
    })
  }

  bloomAge() {
    return this.G + 30 + this.rng() * this.B * 0.8
  }

  openAge() {
    return this.G + 30
  }

  private phase() {
    const t = this.age
    const G = this.G
    const bloomEnd = G + 30 + this.B
    return {
      growth: 0.1 + 0.9 * easeOut(t / G),
      umbel: smoothstep(G - 4, G + 22, t),
      // -1 a curled nest, 0 a closed bundle, 1 fully open.
      spread:
        lerp(0.18, 1, smoothstep(G + 22, G + 30, t)) -
        1.3 * smoothstep(bloomEnd, bloomEnd + 14, t),
      nest: smoothstep(bloomEnd, bloomEnd + 14, t),
      wither: smoothstep(this.cycle - 8, this.cycle, t),
    }
  }

  protected live() {
    const ph = this.phase()
    const s = this.stem
    s.growth = ph.growth * (1 - 0.2 * ph.wither)
    const nod = 1 - smoothstep(this.G + 18, this.G + 28, this.age)
    s.setCurve(
      this.side * (0.7 * nod + 0.35 * ph.wither),
      0.65,
      0.03 * this.side,
    )
    s.headDrag = 0.2 + 0.4 * Math.max(0, ph.spread)
    s.headMass = 0.05
  }

  draw(r: Raster, env: Env) {
    const p = env.palette
    const ph = this.phase()
    const s = this.stem
    const stemColor = this.stalked(
      this.withered(mix(p.stem, p.grassDark, 0.15), ph.wither, p),
      p,
    )
    for (const leaf of this.leaves)
      this.drawLeaf(r, s, leaf, stemColor, env, 'fern', ph.growth)
    this.drawStem(r, s, stemColor, Math.max(1.5, 2.6 * this.scale))
    if (ph.umbel < 0.02) return

    const tx = s.tipX()
    const ty = s.tipY()
    const H = this.head * ph.umbel
    const axis: Vec3 = headAxis(s.tipAngle(), lerp(0.2, 0.75, this.facing))
    const [u, v] = basis(axis)
    const lace = this.bloomed(mix(p.lace, [150, 120, 90], ph.nest * 0.55), p)
    const rayColor = mix(stemColor, lace, 0.25)
    const rays = new Shape()
    const florets: [number, number, number, number][] = []
    for (const ray of this.rays) {
      const len = H * ray.len
      const ca = Math.cos(ray.a)
      const sa = Math.sin(ray.a)
      let ex: number
      let ey: number
      let ez: number
      let cx: number
      let cy: number
      if (ph.spread >= 0) {
        const phi = ph.spread * 1.25 * ray.tilt
        ;[ex, ey, ez] = project(
          tx,
          ty,
          axis,
          [u, v],
          ca * Math.sin(phi) * len,
          sa * Math.sin(phi) * len,
          Math.cos(phi) * len,
        )
        ;[cx, cy] = project(
          tx,
          ty,
          axis,
          [u, v],
          ca * Math.sin(phi) * len * 0.5,
          sa * Math.sin(phi) * len * 0.5,
          Math.cos(phi) * len * 0.55,
        )
      } else {
        // Bird's nest: rays bow outward and their tips curl back in over the middle.
        const k = -ph.spread
        const out = len * (0.55 - 0.25 * k) * ray.tilt
        ;[cx, cy] = project(
          tx,
          ty,
          axis,
          [u, v],
          ca * out * 1.1,
          sa * out * 1.1,
          len * 0.4,
        )
        ;[ex, ey, ez] = project(
          tx,
          ty,
          axis,
          [u, v],
          ca * out * (1 - 0.7 * k),
          sa * out * (1 - 0.7 * k),
          len * (0.75 + 0.15 * k),
        )
      }
      rays.moveTo(tx, ty)
      rays.quadraticCurveTo(cx, cy, ex, ey)
      florets.push([ex, ey, ez, ray.florets])
    }
    // Faint: the rays only print where they bunch near the stalk, not as a fan of lines.
    r.stroke(rays, rayColor, Kind.Stem, Math.max(0.5, H * 0.025), 0.4)
    florets.sort((a, b) => a[2] - b[2])
    const fr = Math.max(0.6, H * 0.045)
    for (const [ex, ey, , n] of florets) {
      // A tiny umbellet: a ring of florets around one.
      const cluster = new Shape()
      const rr = H * 0.11
      // The umbellet as a whole: a dome of florets too fine to print one by one, so the head
      // reads as a lace of small clusters rather than loose specks.
      const dome = new Shape()
      const dr = Math.max(rr * 1.35, r.minLine * 1.2)
      dome.ellipse(ex, ey, dr, dr * 0.8, 0, 0, TAU)
      r.fill(dome, lace, Kind.Fluff, 0.85, FLOWER_FLUFF)
      r.touchMeta(ex - dr - rr, ey - dr - rr)
      r.touchMeta(ex + dr + rr, ey + dr + rr)
      cluster.ellipse(ex, ey, fr, fr, 0, 0, TAU)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU
        const [x, y] = project(
          ex,
          ey,
          axis,
          [u, v],
          Math.cos(a) * rr,
          Math.sin(a) * rr,
          0,
        )
        cluster.moveTo(x + fr, y)
        cluster.ellipse(x, y, fr, fr, 0, 0, TAU)
      }
      r.fill(cluster, lace, Kind.Fluff, 1, FLOWER_FLUFF)
    }
    if (this.darkFloret && ph.spread > 0.6 && ph.nest < 0.1) {
      const [cx, cy] = project(tx, ty, axis, [u, v], 0, 0, H * 0.85)
      r.dot(
        cx,
        cy,
        Math.max(0.8, H * 0.06),
        this.bloomed(p.poppyDeep, p),
        Kind.Disc,
      )
    }
  }
}

/** The deep gold at a dandelion's heart, where the florets are youngest and packed tightest. */
const GOLD: Rgb = [214, 140, 34]

// ── Dandelion ──────────────────────────────────────────────────────────────
// Low rosette of backward-toothed leaves. The flower closes at night and for good after a few
// days; then the stalk lengthens, and it reopens as a clock of pappus seeds for the wind.

export class Dandelion extends Plant {
  readonly species = 'dandelion'
  private G: number
  private B: number
  private stem: Stem
  private head: number
  private seeds: Vec3[] = []
  private attached: boolean[] = []
  private remaining = 0
  private clockStart: number
  private bareAt = -1
  /** Seeds a click has shaken loose, to let go on the next step. */
  private puffs = 0

  constructor(x: number, z: number, seed: number, env: Env) {
    super(x, z, seed)
    const r = this.rng
    this.G = lerp(5, 8, r())
    this.B = lerp(40, 70, r())
    this.clockStart = this.G + 14 + this.B + 4 + 15
    this.cycle = this.clockStart + 90 + 10
    const length = env.unit * lerp(0.09, 0.15, r()) * this.scale
    this.stem = this.makeStem(6, length, env)
    this.stem.stiffness = lerp(0.9, 1.2, r())
    this.stems.push(this.stem)
    this.head = length * lerp(0.36, 0.42, r()) * HEAD
    this.crown = this.head
    // Fibonacci sphere of seeds.
    const n = 64
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2
      const rad = Math.sqrt(1 - y * y)
      const th = i * 2.39996
      this.seeds.push([Math.cos(th) * rad, y, Math.sin(th) * rad])
      this.attached.push(true)
    }
    this.remaining = n
    const leaves = 4 + Math.floor(r() * 3)
    for (let i = 0; i < leaves; i++) {
      this.leaves.push({
        joint: 0,
        side: i % 2 ? 1 : -1,
        angle: lerp(1.05, 1.45, r()),
        length: length * lerp(0.55, 0.85, r()),
        seed: r(),
      })
    }
  }

  bloomAge() {
    return this.rng() < 0.55
      ? this.G + 14 + this.rng() * this.B * 0.8
      : this.clockStart + 6 + this.rng() * 30
  }

  openAge() {
    return this.G + 14
  }

  /** Whether a click at x, y lands on the head: the flower, or the seed clock. */
  hit(x: number, y: number) {
    const s = this.stem
    if (s.growth < 0.3 || this.phase().wither > 0.5) return false
    const tip = s.tipAngle()
    const R = this.head * 0.55
    const d = Math.hypot(
      x - (s.tipX() + Math.sin(tip) * R),
      y - (s.tipY() - Math.cos(tip) * R),
    )
    return d < Math.max(this.head * 0.9, 12)
  }

  /**
   * A click shakes the stalk, and a seed clock lets go of a good handful of its seeds at once:
   * about two fifths, at least a dozen, flung out from the head rather than lifted off by the wind.
   */
  poke() {
    const side = this.rng() < 0.5 ? -1 : 1
    const s = this.stem
    for (let i = 0; i < s.n; i++) s.vel[i] += side * 0.9 * ((i + 1) / s.n)
    if (this.phase().clock >= 0.98 && this.remaining > 0)
      this.puffs += Math.max(12, Math.round(this.remaining * 0.4))
  }

  private phase() {
    const t = this.age
    const G = this.G
    const closeAt = G + 14 + this.B
    return {
      growth:
        0.15 +
        0.85 * easeOut(t / G) +
        0.75 * smoothstep(closeAt + 4, this.clockStart, t),
      bud: smoothstep(G * 0.5, G + 10, t),
      open:
        smoothstep(G + 10, G + 14, t) *
        (1 - smoothstep(closeAt, closeAt + 4, t)),
      clock: smoothstep(this.clockStart, this.clockStart + 4, t),
      wither: smoothstep(this.cycle - 6, this.cycle, t),
    }
  }

  protected live(env: Env, dt: number) {
    const ph = this.phase()
    const s = this.stem
    s.growth = ph.growth * (1 - 0.3 * ph.wither)
    s.setCurve(this.side * (0.25 + 0.4 * ph.wither), 0.5, 0.05 * this.side)
    s.headDrag = 0.15 + 0.25 * ph.clock * (this.remaining / this.seeds.length)
    s.headMass = 0.04
    if (ph.clock < 0.98) return

    const tx = s.tipX()
    const ty = s.tipY()
    const w = Math.abs(env.wind.at(tx, ty, this.z))
    const push = Math.abs(env.wind.push(tx, ty - this.head))
    // Gusts and a passing cursor pull seeds off; once ripe long enough it lets them all go.
    let rate = Math.max(0, w - 1.05) * 10 + push * 70
    if (this.age > this.clockStart + 80) rate += 14
    let release = 0
    if (this.remaining > 0 && !env.quiet) {
      const expect = rate * dt
      release = Math.floor(expect) + (this.rng() < expect % 1 ? 1 : 0)
    }
    const puffed = Math.min(this.puffs, this.remaining)
    this.puffs = 0
    release += puffed
    for (let k = 0; k < release && this.remaining > 0; k++) {
      // The first few go out in the click's puff, flung wide; the rest drift off on the wind.
      const fling = k < puffed ? 3 : 1
      let i = Math.floor(this.rng() * this.seeds.length)
      while (!this.attached[i]) i = (i + 1) % this.seeds.length
      this.attached[i] = false
      this.remaining--
      const [sx, sy] = this.seeds[i]
      const R = this.head * 0.55
      env.particles.add(
        particle({
          type: 'pappus',
          x: tx + sx * R,
          y: ty - this.head * 0.5 + sy * R,
          vx: env.wind.at(tx, ty) * 60 + sx * 30 * fling,
          vy: (-15 - this.rng() * 25) * (fling > 1 ? 1.8 : 1) + sy * 10 * fling,
          size: Math.max(1.2, this.head * 0.13),
          color: this.bloomed(env.palette.fluff, env.palette),
          floor: env.floor(this.z + (this.rng() - 0.3) * 0.25),
          depth: this.z,
          life: 40,
        }),
      )
    }
    if (this.remaining === 0 && this.bareAt < 0) this.bareAt = this.age
    // Bare head: skip ahead to the end of the cycle.
    if (this.bareAt > 0 && this.age < this.cycle - 8)
      this.age = Math.max(this.age, this.cycle - 8)
  }

  draw(r: Raster, env: Env) {
    const p = env.palette
    const ph = this.phase()
    const s = this.stem
    const stemColor = this.stalked(
      this.withered(mix(p.stem, p.grassLight, 0.15), ph.wither, p),
      p,
    )
    const leafColor = this.hazed(mix(p.grassDark, p.stem, 0.7), p)
    for (const leaf of this.leaves)
      this.drawLeaf(
        r,
        s,
        leaf,
        leafColor,
        env,
        'toothed',
        Math.min(1, ph.growth),
      )
    this.drawStem(r, s, stemColor, Math.max(1.4, 2.2 * this.scale))
    const tx = s.tipX()
    const ty = s.tipY()
    const tip = s.tipAngle()
    const H = this.head

    if (ph.clock > 0) {
      const R = H * 0.55 * ph.clock
      const cx = tx + Math.sin(tip) * R
      const cy = ty - Math.cos(tip) * R
      const fluff = this.bloomed(p.fluff, p)
      const spokes = new Shape()
      const tufts = new Shape()
      const tr = Math.max(0.55, H * 0.045)
      for (let i = 0; i < this.seeds.length; i++) {
        if (!this.attached[i]) continue
        const [sx, sy, sz] = this.seeds[i]
        const x = cx + sx * R
        const y = cy + sy * R
        spokes.moveTo(cx, cy)
        spokes.lineTo(x, y)
        tufts.moveTo(x + tr * (1 + sz * 0.3), y)
        tufts.ellipse(x, y, tr * (1 + sz * 0.3), tr * (1 + sz * 0.3), 0, 0, TAU)
      }
      r.stroke(spokes, fluff, Kind.Fluff, Math.max(0.4, H * 0.015), 0.45)
      r.fill(tufts, fluff, Kind.Fluff, 0.95, FLOWER_FLUFF)
      r.touchMeta(cx - R - tr * 2, cy - R - tr * 2)
      r.touchMeta(cx + R + tr * 2, cy + R + tr * 2)
      r.dot(
        cx,
        cy,
        Math.max(0.8, H * 0.08),
        mix(stemColor, p.disc, 0.4),
        Kind.Disc,
      )
      return
    }
    if (ph.bud < 0.05) return
    const open = ph.open * (1 - 0.85 * p.night)
    const yellow = this.bloomed(p.dandelion, p)
    if (open < 0.05) {
      const bud = new Shape()
      const len = H * 0.45 * ph.bud
      bud.ellipse(
        tx + Math.sin(tip) * len * 0.5,
        ty - Math.cos(tip) * len * 0.5,
        len * 0.32,
        len * 0.55,
        tip,
        0,
        TAU,
      )
      r.fill(bud, mix(stemColor, p.grassDark, 0.2), Kind.Foliage)
      if (ph.open > 0) {
        const t = new Shape()
        t.ellipse(
          tx + Math.sin(tip) * len * 0.95,
          ty - Math.cos(tip) * len * 0.95,
          len * 0.14,
          len * 0.12,
          tip,
          0,
          TAU,
        )
        r.fill(t, yellow, Kind.Petal)
      }
      return
    }
    // Turned well toward the viewer, so the flower reads as a disc rather than an edge-on sliver.
    const axis = headAxis(tip, lerp(0.5, 0.85, this.facing))
    const list: { depth: number; draw: () => void }[] = []
    for (const layer of [0, 1]) {
      drawPetals(
        r,
        tx,
        ty,
        axis,
        {
          count: layer ? 18 : 26,
          length: H * (layer ? 0.32 : 0.5) * lerp(0.6, 1, open),
          width: () => H * 0.065,
          cup: (u) => lerp(1.35, layer ? 0.75 : 0.2, open) + 0.3 * u,
          crinkle: 0.05,
          rotation: this.seed + layer,
          seed: this.seed + layer * 3,
          front: layer ? shade(yellow, 1.08) : yellow,
          back: shade(yellow, 0.75),
          haze: p.haze,
          hazeAmount: 0,
        },
        list,
      )
    }
    // The heart: a domed tuft of short florets, packed and deepest gold, so the head reads full
    // to the middle instead of as a brim around a hollow crown. On top once it faces us.
    list.push({
      depth: axis[2] > 0 && open > 0.5 ? Infinity : axis[2] * H * 0.1,
      draw: () => {
        r.fill(
          disc(tx, ty, axis, H * 0.24 * open, H * 0.08),
          shade(yellow, 0.94),
          Kind.Petal,
        )
        r.fill(
          disc(tx, ty, axis, Math.max(H * 0.12 * open, r.minLine), H * 0.12),
          this.bloomed(mix(p.dandelion, GOLD, 0.6), p),
          Kind.Petal,
        )
      },
    })
    flush(list)
  }
}

// ── Rose ────────────────────────────────────────────────────────────────────
// The poem's one flower, never sown or seeded, rooted in the meadow and grown by the reader's
// scroll: a single stem with compound, toothed leaves comes up; the bud swells inside its five
// sepals, they part and fold back, and the petals open ring by ring, outer first, each traced
// in deep red so they read apart, around a heart that stays furled. It never grows back down.

/** Ages through the rose's growth, from breaking ground to full flower; the scroll sets the age. */
const ROSE = {
  /** The stem rises. */
  stem: 5,
  /** The leaves unfurl. */
  leaves: [1.5, 6] as const,
  /** The bud swells. */
  bud: [2.5, 7] as const,
  /** The sepals part and fold back. */
  sepals: [6.5, 8.5] as const,
  /** Each ring of petals opens in turn: outer, middle, inner. */
  rings: [
    [7.5, 11],
    [8.5, 12],
    [9.5, 13],
  ] as const,
  full: 13,
}

/** The green the rose's stem and leaves lift toward. */
const ROSE_GREEN: Rgb = [112, 150, 92]

/**
 * The rose's leaves and sepals print as bodies, tile and outline, as petals do: the meadow's
 * foliage ramp is kept quiet so grass stays texture, and would lose them against the night.
 */
const LEAF_BODY = { id: 4, light: 0.5, back: true }

const span = (t: number, [a, b]: readonly [number, number]) =>
  smoothstep(a, b, t)

export class Rose extends Plant {
  readonly species = 'rose'
  private stem: Stem
  private head: number
  /** The age the page has scrolled it to (Garden.rose); the rose eases toward it. */
  goal = 0

  constructor(x: number, z: number, seed: number, env: Env) {
    super(x, z, seed)
    const r = this.rng
    this.cycle = Infinity
    // Rooted in the meadow like the rest; the stem reaches up to hold the head a little below
    // the middle of the screen, where the poem leaves room for it.
    const length = Math.max(env.unit * 0.12, env.floor(z) - env.unit * 0.6)
    this.stem = this.makeStem(12, length, env)
    this.stem.stiffness = 1.7
    this.stem.drag = 0.7
    this.stem.baseAngle = this.side * 0.03
    this.head = env.unit * 0.064
    this.crown = this.head
    this.stems.push(this.stem)
    for (const [joint, side] of [
      [4, -1],
      [6, 1],
      [8, -1],
    ] as const) {
      this.leaves.push({
        joint,
        side: side * this.side,
        angle: lerp(0.75, 0.95, r()),
        length: length * lerp(0.26, 0.3, r()) * (joint === 8 ? 0.8 : 1),
        seed: r() * 10,
      })
    }
  }

  bloomAge() {
    return ROSE.full
  }

  openAge() {
    return ROSE.full
  }

  update(dt: number, env: Env) {
    // The scroll sets its age, eased so a flick still reads as growth; Plant.update adds dt.
    const k = 1 - Math.exp(-3 * dt)
    this.age += (this.goal - this.age) * k - dt
    super.update(dt, env)
  }

  protected live() {
    const t = this.age
    const s = this.stem
    s.growth = 0.04 + 0.96 * easeOut(Math.min(1, t / ROSE.stem))
    // The bud nods a little as it swells and lifts as it opens.
    const nod = span(t, ROSE.bud) * (1 - span(t, ROSE.rings[0]))
    s.setCurve(this.side * (0.08 + 0.35 * nod), 0.6)
    s.headMass = 0.04 + 0.05 * span(t, ROSE.bud)
    s.headDrag = 0.1 + 0.25 * span(t, ROSE.rings[0])
  }

  draw(r: Raster, env: Env) {
    const p = env.palette
    const t = this.age
    const s = this.stem
    // Lifted toward a living green, more so after dark, so the stem and leaves hold against the
    // night ground the way the petals do.
    const leafColor = mix(p.roseLeaf, ROSE_GREEN, 0.35 + 0.35 * p.night)
    const stemColor = mix(leafColor, p.grassLight, 0.2)
    const unfurl = span(t, ROSE.leaves)
    for (const leaf of this.leaves)
      this.drawRoseLeaf(r, leaf, leafColor, stemColor, env, unfurl)
    // A cell wide: thin as stalks go here, but solid, as the night dims stalk lines.
    this.drawCane(r, s.pts, s.n, stemColor, r.minLine)

    const bud = lerp(0.25, 1, span(t, ROSE.bud))
    const H = this.head * bud
    if (s.growth < 0.2) return
    const tx = s.tipX()
    const ty = s.tipY()
    const tip = s.tipAngle()
    const open = ROSE.rings.map((ring) => span(t, ring))
    // Turned a little toward the viewer as it opens, so the furled heart shows.
    // Side-on as a bud, then turned toward the viewer as it opens, so the rings read as rings.
    const axis = headAxis(tip, 0.4 + 0.45 * open[0])
    const rose = this.bloomed(p.rose, p)
    const deep = this.bloomed(p.roseDeep, p)
    const list: { depth: number; draw: () => void }[] = []

    // Sepals: wrapped around the bud, then parting and folding back under the head.
    const part = span(t, ROSE.sepals)
    drawPetals(
      r,
      tx,
      ty,
      axis,
      {
        count: 5,
        length: H * lerp(0.75, 0.62, part),
        width: (u) => H * 0.16 * Math.sin(Math.min(1, u * 1.3) * Math.PI) + 0.4,
        cup: (u) => lerp(1.25, -0.55, part) - 0.25 * u * part,
        crinkle: 0.1,
        rotation: this.seed + 0.3,
        seed: this.seed + 3,
        front: leafColor,
        back: shade(leafColor, 0.8),
        haze: p.haze,
        hazeAmount: 0,
      },
      list,
    )
    // Three rings of petals, each broader and flatter than the one inside it, their rims rolled
    // back once open. Closed, they stand upright and overlap into the bud's point.
    const rings = [
      {
        count: 5,
        length: 1.15,
        width: 0.46,
        closed: 1.5,
        opened: 1.08,
        roll: 0.45,
      },
      {
        count: 5,
        length: 1,
        width: 0.4,
        closed: 1.52,
        opened: 1.25,
        roll: 0.35,
      },
      {
        count: 4,
        length: 0.8,
        width: 0.34,
        closed: 1.55,
        opened: 1.42,
        roll: 0.12,
      },
    ]
    rings.forEach((ring, i) => {
      const o = open[i]
      const L = H * ring.length * lerp(0.62, 1, o)
      drawPetals(
        r,
        tx,
        ty,
        axis,
        {
          count: ring.count,
          length: L,
          width: (u) =>
            H *
            ring.width *
            (0.3 + 0.7 * Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.5)),
          cup: (u) => lerp(ring.closed, ring.opened, o) - ring.roll * o * u * u,
          crinkle: 0.12,
          rotation: this.seed + (i * Math.PI) / 5,
          seed: this.seed + i * 5,
          front: mix(rose, deep, [0, 0.22, 0.42][i]),
          back: mix(rose, deep, 0.75),
          edge: deep,
          haze: p.haze,
          hazeAmount: 0,
        },
        list,
      )
    })
    // The furled heart: a tight cone of the deepest red with a spiral of petal edge on it.
    const heart = axis[2] * H * 0.3
    list.push({
      depth: heart,
      draw: () => {
        if (open[1] < 0.2) return
        const [u, v] = basis(axis)
        r.fill(disc(tx, ty, axis, H * 0.22, H * 0.34), deep, Kind.Petal, 1, {
          id: 1,
          light: 0.2,
          back: true,
        })
        const swirl = new Shape()
        const turns = 1.6
        for (let k = 0; k <= 24; k++) {
          const a = (k / 24) * turns * TAU + this.seed
          const rad = H * 0.2 * (1 - k / 26)
          const [x, y] = project(
            tx,
            ty,
            axis,
            [u, v],
            Math.cos(a) * rad,
            Math.sin(a) * rad,
            H * (0.36 + 0.08 * (k / 24)),
          )
          if (k === 0) swirl.moveTo(x, y)
          else swirl.lineTo(x, y)
        }
        r.stroke(swirl, shade(deep, 0.6), Kind.Disc, Math.max(0.6, H * 0.035))
      },
    })
    flush(list)
    r.heads.push({
      x: tx,
      y: ty,
      r: H * lerp(0.6, 1, open[0]),
      species: 'poppy',
      petal: rose,
      disc: deep,
      alpha: r.opacity * smoothstep(0.2, 0.5, open[0]),
      owner: this,
      depth: this.z,
    })
  }

  /** A stalk as a thin body rather than a line, so it prints as solidly as the leaves it holds. */
  private drawCane(
    r: Raster,
    pts: ArrayLike<number>,
    n: number,
    color: Rgb,
    width: number,
  ) {
    const left: number[] = []
    const right: number[] = []
    for (let i = 0; i <= n; i++) {
      const a = Math.min(i, n - 1)
      const dx = pts[(a + 1) * 2] - pts[a * 2]
      const dy = pts[(a + 1) * 2 + 1] - pts[a * 2 + 1]
      const len = Math.hypot(dx, dy) || 1
      // Tapering a little toward the top.
      const w = (width / 2) * (1 - 0.3 * (i / n))
      left.push(pts[i * 2] - (dy / len) * w, pts[i * 2 + 1] + (dx / len) * w)
      right.push(pts[i * 2] + (dy / len) * w, pts[i * 2 + 1] - (dx / len) * w)
    }
    const sh = new Shape()
    sh.moveTo(left[0], left[1])
    for (let i = 2; i < left.length; i += 2) sh.lineTo(left[i], left[i + 1])
    for (let i = right.length - 2; i >= 0; i -= 2)
      sh.lineTo(right[i], right[i + 1])
    sh.closePath()
    r.fill(sh, color, Kind.Petal, 1, LEAF_BODY)
  }

  /** A compound leaf: a stalk off the stem with a pair or two of toothed oval leaflets and one at the end. */
  private drawRoseLeaf(
    r: Raster,
    leaf: Leaf,
    color: Rgb,
    stalk: Rgb,
    env: Env,
    grow: number,
  ) {
    const s = this.stem
    const j = Math.min(leaf.joint, s.n)
    const bx = s.pts[j * 2]
    const by = s.pts[j * 2 + 1]
    const L = leaf.length * grow
    if (L < 3 || s.growth * s.n < leaf.joint) return
    const sway =
      env.wind.at(bx, by, this.z) * 0.06 + env.wind.push(bx, by) * 0.1
    // Opens out from along the stem as it unfurls.
    const a0 =
      s.abs[Math.min(j, s.n - 1)] +
      leaf.side * leaf.angle * lerp(0.3, 1, grow) +
      sway
    const pts: [number, number, number][] = []
    let x = bx
    let y = by
    let a = a0
    const N = 6
    for (let i = 1; i <= N; i++) {
      a += leaf.side * 0.06
      x += (Math.sin(a) * L) / N
      y -= (Math.cos(a) * L) / N
      pts.push([x, y, a])
    }
    // The leaf's stalk, thinner than the stem it comes off.
    const rib = [bx, by, ...pts.flatMap(([px, py]) => [px, py])]
    this.drawCane(r, rib, N, stalk, r.minLine * 0.7)
    const leaflet = (cx: number, cy: number, ang: number, len: number) => {
      const w = len * 0.42
      const sh = new Shape()
      const M = 10
      const side = (sign: number) => {
        for (let i = 0; i <= M; i++) {
          const k = sign > 0 ? i : M - i
          const u = k / M
          // Toothed: every other point stands a little proud of the outline.
          const tooth = k % 2 && k > 1 && k < M - 1 ? 1.18 : 1
          const half =
            w *
            Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.05)) *
            (1 - 0.25 * u) *
            tooth
          const px = cx + Math.sin(ang) * len * u + Math.cos(ang) * half * sign
          const py = cy - Math.cos(ang) * len * u + Math.sin(ang) * half * sign
          if (i === 0 && sign > 0) sh.moveTo(px, py)
          else sh.lineTo(px, py)
        }
      }
      side(1)
      side(-1)
      sh.closePath()
      r.fill(sh, color, Kind.Petal, 1, LEAF_BODY)
    }
    const size = L * 0.26 * grow
    for (const [k, off] of [
      [2, 0.95],
      [4, 0.8],
    ] as const) {
      const [px, py, pa] = pts[k]
      for (const sd of [-1, 1])
        leaflet(px, py, pa + sd * off, size * (k === 2 ? 0.8 : 0.9))
    }
    const [ex, ey, ea] = pts[N - 1]
    leaflet(ex, ey, ea, size * 1.05)
  }
}

export function createPlant(
  species: Species,
  x: number,
  z: number,
  seed: number,
  env: Env,
): Plant {
  switch (species) {
    case 'poppy':
      return new Poppy(x, z, seed, env)
    case 'cosmos':
      return new Cosmos(x, z, seed, env)
    case 'lace':
      return new Lace(x, z, seed, env)
    case 'dandelion':
      return new Dandelion(x, z, seed, env)
    case 'rose':
      return new Rose(x, z, seed, env)
  }
}
