import { clamp, noise1, TAU } from './math'
import { mix, shade, type Rgb } from './palette'
import { Kind, type Raster, Shape } from './raster'

export type Vec3 = [number, number, number]

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Light from the upper left, a little in front. */
const LIGHT = norm([-0.45, -0.75, 0.5])

/**
 * The direction a flower faces, from the screen angle of its stem tip and how far it turns
 * toward the viewer (0 side-on, π/2 face-on). Screen y points down, z toward the viewer.
 */
export function headAxis(tipAngle: number, facing: number): Vec3 {
  const c = Math.cos(facing)
  return norm([
    Math.sin(tipAngle) * c,
    -Math.cos(tipAngle) * c,
    Math.sin(facing),
  ])
}

/** Two unit vectors spanning the plane perpendicular to the axis. */
export function basis(a: Vec3): [Vec3, Vec3] {
  const helper: Vec3 = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]
  const u = norm(cross(a, helper))
  const v = cross(a, u)
  return [u, v]
}

export type PetalSpec = {
  count: number
  /** Petal length in px. */
  length: number
  /** Half-width at s along the petal, in px. */
  width: (s: number) => number
  /** Angle of the petal surface up out of the flower's plane, at s. Large = closed cup. */
  cup: (s: number) => number
  /** Edge ruffle as a fraction of width. */
  crinkle: number
  /** Per-petal length multiplier, e.g. a poppy's two smaller inner petals. */
  size?: (k: number) => number
  rotation: number
  seed: number
  front: Rgb
  back: Rgb
  /** Depth of the notches cut into the tip, as a fraction of length. Cosmos have three. */
  notch?: number
  veins?: Rgb
  /** Dark spot at the petal base, as in corn poppies. */
  blotch?: Rgb
  /**
   * How much darker the inner face runs toward its base (0..1), so a cup looked into reads as
   * a hollow deepening to its heart rather than a flat shape. The outer face stays even.
   */
  throat?: number
  /**
   * How much darker (0..1) a petal prints where you see its underside, or where it tips down
   * away from the sky: a white head otherwise reads flat, every flap the same lit cream.
   */
  underside?: number
  /** A line traced round each petal, so overlapping petals of one colour stay apart (the rose). */
  edge?: Rgb
  haze: Rgb
  hazeAmount: number
  /** Which petals are still attached. */
  attached?: (k: number) => boolean
  /**
   * 0 flat, 1 furled: each petal curves round the axis instead of standing out as a flat flap,
   * a little outside the one before, so a closing head wraps like a rolled umbrella (a California
   * poppy at night) rather than its flaps cutting through each other.
   */
  wrap?: number
  kind?: Kind
}

type PetalDraw = { depth: number; draw: () => void }

/**
 * Petals built in 3D around the head axis and projected flat, back to front, so a poppy reads
 * as a cup from the side and a cosmos as a disc from the front.
 */
export function drawPetals(
  r: Raster,
  cx: number,
  cy: number,
  axis: Vec3,
  spec: PetalSpec,
  out: PetalDraw[] = [],
) {
  const [u, v] = basis(axis)
  const N = spec.count
  const S = 7
  const wrap = spec.wrap ?? 0
  for (let k = 0; k < N; k++) {
    if (spec.attached && !spec.attached(k)) continue
    const alpha =
      spec.rotation +
      (k / N) * TAU +
      (noise1(k * 3.1, spec.seed) * 0.35 * TAU) / N
    const ca = Math.cos(alpha)
    const sa = Math.sin(alpha)
    const rd: Vec3 = [
      u[0] * ca + v[0] * sa,
      u[1] * ca + v[1] * sa,
      u[2] * ca + v[2] * sa,
    ]
    const td = cross(axis, rd)
    const L = spec.length * (spec.size ? spec.size(k) : 1)
    const left: number[] = []
    const right: number[] = []
    let depthSum = 0
    const point = (s: number, w: number, out: number[]) => {
      const cupA = spec.cup(s)
      const ruffle =
        1 + spec.crinkle * noise1(s * 5 + k * 13.7 + w * 0.01, spec.seed + 7)
      const rr = s * L * Math.cos(cupA)
      const hh =
        s * L * Math.sin(cupA) +
        spec.crinkle * L * 0.06 * noise1(s * 7 + k * 5.3, spec.seed)
      const ww = w * ruffle
      // Flat: out along the petal's ray, across it along the tangent.
      let ox = rd[0] * rr + td[0] * ww
      let oy = rd[1] * rr + td[1] * ww
      let oz = rd[2] * rr + td[2] * ww
      if (wrap > 0 && rr > 1e-3) {
        // Furled: the width bends round the axis on a circle through the ray, each petal on a
        // slightly wider one than the last, and no wider than its share and a little more.
        const share = (TAU / N) * 0.65
        const phi = clamp(ww / rr, -share, share)
        const ring = rr * (1 + (0.1 * k) / N)
        const c = Math.cos(phi) * ring
        const sn = Math.sin(phi) * ring
        ox += (rd[0] * c + td[0] * sn - ox) * wrap
        oy += (rd[1] * c + td[1] * sn - oy) * wrap
        oz += (rd[2] * c + td[2] * sn - oz) * wrap
      }
      const x = cx + ox + axis[0] * hh
      const y = cy + oy + axis[1] * hh
      depthSum += oz + axis[2] * hh
      out.push(x, y)
    }
    for (let i = 0; i <= S; i++) {
      const s = i / S
      const w = spec.width(s)
      point(s, -w, left)
      point(s, w, right)
    }
    // Rounded or notched tip, swept from one edge to the other.
    const tip: number[] = []
    const tipW = spec.width(1) || spec.width(0.92)
    for (let i = 1; i < 6; i++) {
      const t = i / 6
      const w = (-1 + 2 * t) * tipW
      const notch = spec.notch
        ? spec.notch * Math.abs(Math.sin(t * Math.PI * 3))
        : 0
      const s = 1 + 0.08 * Math.sin(t * Math.PI) - notch
      point(s, w, tip)
    }

    const along = norm([
      rd[0] * Math.cos(spec.cup(0.6)) + axis[0] * Math.sin(spec.cup(0.6)),
      rd[1] * Math.cos(spec.cup(0.6)) + axis[1] * Math.sin(spec.cup(0.6)),
      rd[2] * Math.cos(spec.cup(0.6)) + axis[2] * Math.sin(spec.cup(0.6)),
    ])
    let n = norm(cross(along, td))
    const backside = n[2] < 0
    if (backside) n = [-n[0], -n[1], -n[2]]
    const light = clamp(dot(n, LIGHT), 0, 1)
    const base = backside ? spec.back : spec.front
    // n faces the viewer here; screen y points down, so n[1] > 0 is a face tipped downward.
    // A near-white petal lit past 1 clips to white, so turning from the light has to darken
    // it here too, or every flap prints the same cream. A face-on head is flat, every petal on
    // one normal, so the petals reaching down the screen, curving away from the sun overhead,
    // take a share too: the head then shades from top to bottom like a dish.
    const under = spec.underside
      ? spec.underside *
        ((backside ? 0.5 : 0) +
          0.3 * clamp(n[1], 0, 1) +
          0.25 * (1 - light) +
          0.5 * clamp(rd[1], 0, 1))
      : 0
    const color = mix(
      shade(base, (0.62 + 0.55 * light) * (1 - under)),
      spec.haze,
      spec.hazeAmount,
    )

    const depth = depthSum / ((S + 1) * 2 + 5)
    const meta = {
      id: ((Math.abs(Math.floor(spec.seed)) * 7 + k) % 10) + 1,
      light,
      back: backside,
    }
    out.push({
      depth,
      draw: () => {
        const p = new Shape()
        p.moveTo(left[0], left[1])
        for (let i = 2; i < left.length; i += 2) p.lineTo(left[i], left[i + 1])
        for (let i = 0; i < tip.length; i += 2) p.lineTo(tip[i], tip[i + 1])
        for (let i = right.length - 2; i >= 0; i -= 2)
          p.lineTo(right[i], right[i + 1])
        p.closePath()
        for (const pts of [left, right, tip])
          for (let i = 0; i < pts.length; i += 2)
            r.touchMeta(pts[i], pts[i + 1])
        r.fill(p, color, spec.kind ?? Kind.Petal, 1, meta)
        // The outline prints as petal, on a body of its colour: as a stalk it would be bare
        // glyphs, and the field would show through between the petals.
        if (spec.edge)
          r.stroke(
            p,
            mix(spec.edge, spec.haze, spec.hazeAmount),
            Kind.Petal,
            r.minLine,
          )
        if (spec.throat && !backside) {
          // The base half of the inner face, a step darker; the blotch sits inside it.
          const t = new Shape()
          const m = 4
          t.moveTo(left[0], left[1])
          for (let i = 2; i <= m * 2; i += 2) t.lineTo(left[i], left[i + 1])
          for (let i = m * 2; i >= 0; i -= 2) t.lineTo(right[i], right[i + 1])
          t.closePath()
          r.fill(
            t,
            shade(color, 1 - spec.throat),
            spec.kind ?? Kind.Petal,
            1,
            meta,
          )
        }
        // The blotch marks the inside of the cup only: printed on a petal's outer face too, a
        // poppy turned away read as one opening toward you.
        if (spec.blotch && !backside) {
          const b = new Shape()
          const j = 2 * 2
          b.moveTo(left[0], left[1])
          b.lineTo(left[j], left[j + 1])
          b.lineTo(
            (left[j] + right[j]) / 2 + (left[j + 2] - left[j]) * 0.4,
            (left[j + 1] + right[j + 1]) / 2 +
              (left[j + 3] - left[j + 1]) * 0.4,
          )
          b.lineTo(right[j], right[j + 1])
          b.closePath()
          r.fill(
            b,
            mix(spec.blotch, spec.haze, spec.hazeAmount),
            Kind.Disc,
            0.9,
          )
        }
        if (spec.veins && L > 14) {
          const vein = mix(spec.veins, spec.haze, spec.hazeAmount)
          for (const f of [-0.45, 0, 0.45]) {
            const p2 = new Shape()
            for (let i = 1; i <= S - 1; i++) {
              const lx = left[i * 2]
              const ly = left[i * 2 + 1]
              const rx = right[i * 2]
              const ry = right[i * 2 + 1]
              const t = (f + 1) / 2
              const x = lx + (rx - lx) * t
              const y = ly + (ry - ly) * t
              if (i === 1) p2.moveTo(x, y)
              else p2.lineTo(x, y)
            }
            r.stroke(p2, vein, Kind.Petal, Math.max(0.5, L * 0.025), 0.85)
          }
        }
      },
    })
  }
  return out
}

/** Flush a list of petal draws back to front. */
export function flush(list: PetalDraw[]) {
  list.sort((a, b) => a.depth - b.depth)
  for (const d of list) d.draw()
  list.length = 0
}

/** A flat ring in the plane perpendicular to the axis, raised `lift` px along it. */
export function disc(
  cx: number,
  cy: number,
  axis: Vec3,
  radius: number,
  lift = 0,
  steps = 16,
) {
  const [u, v] = basis(axis)
  const p = new Shape()
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * TAU
    const x =
      cx + axis[0] * lift + (u[0] * Math.cos(t) + v[0] * Math.sin(t)) * radius
    const y =
      cy + axis[1] * lift + (u[1] * Math.cos(t) + v[1] * Math.sin(t)) * radius
    if (i === 0) p.moveTo(x, y)
    else p.lineTo(x, y)
  }
  p.closePath()
  return p
}

/** Project an offset given in head space (along u, v, axis) to screen. */
export function project(
  cx: number,
  cy: number,
  axis: Vec3,
  uv: [Vec3, Vec3],
  a: number,
  b: number,
  h: number,
) {
  const [u, v] = uv
  return [
    cx + u[0] * a + v[0] * b + axis[0] * h,
    cy + u[1] * a + v[1] * b + axis[1] * h,
    u[2] * a + v[2] * b + axis[2] * h,
  ]
}
