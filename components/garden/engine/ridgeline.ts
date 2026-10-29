// The mountains' light, snow and woods (design/circadian-meadow/components/Ridgeline). Pure
// geometry over the ridge outlines garden.ts builds: which way each mountainside faces the sun
// or moon, the snowline on the far range, and the conifers along the middle ridge. garden.ts
// colours them and paints them twice, smooth in the backdrop and as land in the glyphs.

import { clamp, fbm1, hash, smoothstep } from './math'
import { Shape } from './raster'

/** Spacing of the ridge outline's points. */
export const RIDGE_STEP = 6

/** How far each side of a point the ridge is averaged before reading which way it faces. */
const SMOOTH = 12
/** The fewest points a face may span; a shorter one joins the face to its left. */
const SHORTEST = 10
/** How far a face's sides lean away from the light, px across per px down. */
const LEAN = 0.2

/** One mountainside: points `i` to `j` (shared with the next), lit 1, shaded -1, or flat 0. */
export type Face = { i: number; j: number; face: -1 | 0 | 1; pitch: number }

/** The ridge's height at x, between its points. */
export function ridgeAt(ridge: Float32Array, x: number) {
  const f = clamp(x / RIDGE_STEP, 0, ridge.length - 1)
  const i = Math.floor(f)
  const j = Math.min(ridge.length - 1, i + 1)
  return ridge[i] + (ridge[j] - ridge[i]) * (f - i)
}

/**
 * The ridge split into mountainsides by which way each faces the light at (`toward`, `above`),
 * read on the ridge averaged wide so a whole side goes one way. `clear` is the reach around the
 * globe where a ridge stands in front of it and is left unlit.
 */
export function faces(
  ridge: Float32Array,
  toward: number,
  above: number,
  clear: number,
): Face[] {
  const n = ridge.length
  const sm = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let sum = 0
    let count = 0
    for (
      let k = Math.max(0, i - SMOOTH);
      k <= Math.min(n - 1, i + SMOOTH);
      k++
    ) {
      sum += ridge[k]
      count++
    }
    sm[i] = sum / count
  }
  // As slopes() in garden.ts reads the crest strips, on the averaged ridge.
  const W = 6
  const faceAt = (i: number): -1 | 0 | 1 => {
    const x = i * RIDGE_STEP
    if (Math.abs(x - toward) < clear && above + clear > sm[i]) return 0
    const dy = sm[Math.min(n - 1, i + W)] - sm[Math.max(0, i - W)]
    if (Math.abs(dy) < 2) return 0
    if (Math.sign(dy) === Math.sign(toward - x)) return 1
    const pitch = Math.abs(dy) / (2 * W * RIDGE_STEP)
    return sm[i] - above > 2 * pitch * Math.abs(toward - x) ? 1 : -1
  }
  const runs: { i: number; j: number; face: -1 | 0 | 1 }[] = []
  for (let i = 0; i < n; ) {
    const face = faceAt(i)
    let j = i
    while (j + 1 < n && faceAt(j + 1) === face) j++
    // Creases too short to read as a side go with the side to their left.
    const prev = runs.at(-1)
    if (prev && (j - i + 1 < SHORTEST || prev.face === face)) prev.j = j
    else runs.push({ i, j, face })
    i = j + 1
  }
  // A short first run joins the one after it.
  if (runs.length > 1 && runs[0].j - runs[0].i + 1 < SHORTEST) {
    runs[1].i = runs[0].i
    runs.shift()
  }
  // Each run ends on the point the next starts on, so their planes tile with no gap.
  return runs.map((r, k) => {
    const j = k + 1 < runs.length ? runs[k + 1].i : r.j
    return {
      i: r.i,
      j,
      face: r.face,
      pitch: Math.abs(sm[j] - sm[r.i]) / (Math.max(1, j - r.i) * RIDGE_STEP),
    }
  })
}

/** Points down a face's side from the crest at point `k` to `base`, leaning from the light, kept inside the ridge. */
function side(
  ridge: Float32Array,
  k: number,
  toward: number,
  base: number,
  from = ridge[k],
) {
  const x0 = k * RIDGE_STEP
  const sign = Math.sign(x0 - toward) || 1
  const pts: [number, number][] = []
  const steps = 8
  for (let s = 0; s <= steps; s++) {
    const y = from + ((base - from) * s) / steps
    const x = x0 + LEAN * (y - ridge[k]) * sign
    pts.push([x, Math.max(y, ridgeAt(ridge, x))])
  }
  return pts
}

/** A mountainside as one plane: along the crest, then down its two leaning sides to `base`. */
export function plane(
  ridge: Float32Array,
  f: Face,
  toward: number,
  base: number,
) {
  const path = new Shape()
  path.moveTo(f.i * RIDGE_STEP, ridge[f.i])
  for (let k = f.i + 1; k <= f.j; k++) path.lineTo(k * RIDGE_STEP, ridge[k])
  for (const [x, y] of side(ridge, f.j, toward, base).slice(1))
    path.lineTo(x, y)
  for (const [x, y] of side(ridge, f.i, toward, base).reverse().slice(0, -1))
    path.lineTo(x, y)
  path.closePath()
  return path
}

/**
 * The far range's snowline, y per point: each peak whitened down from its summit by a cap as
 * deep as the summit is high, its lower edge ragged and running down the gullies in tongues.
 * -Infinity where no peak around stands high enough for snow.
 */
export function snowline(
  far: Float32Array,
  horizon: number,
  H: number,
  seed: number,
) {
  const n = far.length
  const peak = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let top = 0
    for (let k = Math.max(0, i - 20); k <= Math.min(n - 1, i + 20); k++)
      top = Math.max(top, horizon - far[k])
    peak[i] = top
  }
  const line = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let sum = 0
    let count = 0
    for (let k = Math.max(0, i - 10); k <= Math.min(n - 1, i + 10); k++) {
      sum += peak[k]
      count++
    }
    const top = sum / count
    const cap = Math.min(0.06 * H, 0.7 * (top - 0.15 * H))
    if (cap < 0.008 * H) {
      line[i] = -Infinity
      continue
    }
    const x = i * RIDGE_STEP
    const rag = 0.2 * cap * fbm1(x / 9, seed + 404, 2)
    const tongue =
      0.9 * cap * Math.max(0, (fbm1(x / 20, seed + 505, 2) - 0.3) / 0.7) ** 1.5
    line[i] = horizon - top + cap + rag + tongue
  }
  return line
}

/**
 * Snow on one face: each stretch above the snowline, along the crest and back along the line.
 * Where a stretch runs to the face's end, its side leans as the rock's plane does.
 */
export function snowOn(
  far: Float32Array,
  line: Float32Array,
  f: Face,
  toward: number,
  path: Shape,
) {
  let top = Infinity
  for (let a = f.i; a <= f.j; ) {
    if (!(far[a] < line[a])) {
      a++
      continue
    }
    let b = a
    while (b + 1 <= f.j && far[b + 1] < line[b + 1]) b++
    if (b > a) {
      path.moveTo(a * RIDGE_STEP, far[a])
      for (let k = a + 1; k <= b; k++) {
        path.lineTo(k * RIDGE_STEP, far[k])
        top = Math.min(top, far[k])
      }
      const edge = (k: number) => {
        const sign = Math.sign(k * RIDGE_STEP - toward) || 1
        return k * RIDGE_STEP + LEAN * (line[k] - far[k]) * sign
      }
      path.lineTo(b === f.j ? edge(b) : b * RIDGE_STEP, line[b])
      for (let k = b - 1; k > a; k--) path.lineTo(k * RIDGE_STEP, line[k])
      path.lineTo(a === f.i ? edge(a) : a * RIDGE_STEP, line[a])
      path.closePath()
      top = Math.min(top, far[a])
    }
    a = b + 1
  }
  return top
}

/** The conifers on the middle ridge: the wood's body under the crest, the spires on it, and the treetops' line. */
export type Woods = {
  body: Shape
  spires: Shape
  canopy: Float32Array
  top: number
}

/** Spruce and fir along the middle ridge, in clumps with clearings, none on the cliff. Fixed in x. */
export function woods(
  mid: Float32Array,
  width: number,
  H: number,
  seed: number,
): Woods {
  const n = mid.length
  const salt = seed * 13
  const wooded = (x: number) => fbm1(x / 140, salt + 606, 3)
  const cliff = (i: number) =>
    Math.abs(mid[Math.min(n - 1, i + 2)] - mid[Math.max(0, i - 2)]) / 24 > 0.9
  const canopy = Float32Array.from(mid)
  const spires = new Shape()
  for (let slot = 0; slot * 5 < width + 10; slot++) {
    const x = slot * 5 + (hash(slot, 1, seed) - 0.5) * 3
    const w0 = wooded(x)
    const i = clamp(Math.round(x / RIDGE_STEP), 0, n - 1)
    if (w0 < -0.25 || cliff(i)) continue
    const dens = smoothstep(-0.1, 0.15, w0)
    if (hash(slot, 2, seed) > 0.12 + 0.83 * dens) continue
    const clump = 0.6 + 0.4 * clamp((fbm1(x / 45, salt + 707, 2) + 1) / 2, 0, 1)
    const h = H * (0.007 + 0.011 * hash(slot, 3, seed) ** 1.5) * clump
    const w = 0.36 * h
    const root = ridgeAt(mid, x) + 0.2 * h
    spires.moveTo(x - w / 2, root)
    spires.lineTo(x, root - h)
    spires.lineTo(x + w / 2, root)
    spires.closePath()
    canopy[i] = Math.min(canopy[i], root - h)
  }
  // The wood's body, a ragged band under the crest along each wooded stretch, tapering out.
  const body = new Shape()
  let top = Infinity
  for (let a = 0; a < n; ) {
    const on = (k: number) => wooded(k * RIDGE_STEP) > -0.1 && !cliff(k)
    if (!on(a)) {
      a++
      continue
    }
    let b = a
    while (b + 1 < n && on(b + 1)) b++
    if (b > a) {
      body.moveTo(a * RIDGE_STEP, mid[a])
      for (let k = a + 1; k <= b; k++) body.lineTo(k * RIDGE_STEP, mid[k])
      for (let k = b; k >= a; k--) {
        const x = k * RIDGE_STEP
        const d =
          (0.025 * H + 0.01 * H * fbm1(x / 60, salt + 808, 2)) *
          smoothstep(0, 10, Math.min(k - a, b - k))
        body.lineTo(x, mid[k] + d)
      }
      body.closePath()
    }
    a = b + 1
  }
  for (const y of canopy) top = Math.min(top, y)
  return { body, spires, canopy, top }
}
