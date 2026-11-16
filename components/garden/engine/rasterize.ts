// Shared by the raster worker and the main thread: turns a frame's recorded draw commands into
// pixels, reduces those to cells and sets the cells in type. Kept free of the DOM so it runs on an
// OffscreenCanvas in the worker.

import { Typesetter, type Material, type Style } from './typeset'

/**
 * What a cell is made of. Each kind is stored as a pure RGB corner in a second canvas, so
 * antialiased edges between two kinds still threshold back to one of them.
 */
export const enum Kind {
  Empty = 0,
  Foliage = 1,
  Stem = 2,
  Petal = 3,
  Disc = 4,
  Fluff = 5,
  Land = 6,
  Sky = 7,
}

/**
 * What a land cell is made of, carried as the meta id under `Kind.Land`: the kinds already fill
 * the material canvas's eight corners.
 */
export const enum LandMat {
  Rock = 0,
  SnowLit = 1,
  SnowShade = 2,
  Canopy = 3,
  Spruce = 4,
  Water = 5,
  Shore = 6,
  Stone = 7,
}

/**
 * How far across the river a cell lies, for the type (Garden.riverField): -1..1 bank to bank, on
 * out to ±RIVER_SPAN at the banks' outer edge.
 */
export const RIVER_SPAN = 1.7

/** Samples per cell along each axis. */
export const SS = 2

/** Materials that belong to plants, which win a cell over the land behind them. */
const PLANT_KINDS: number[] = [
  Kind.Petal,
  Kind.Disc,
  Kind.Stem,
  Kind.Fluff,
  Kind.Foliage,
]
const PLANT_MASK = PLANT_KINDS.reduce((m, k) => m | (1 << k), 0)

export const enum Op {
  Fill = 1,
  Stroke = 2,
  Gradient = 3,
}

export const enum PathOp {
  Move = 1,
  Line = 2,
  Close = 3,
  Ellipse = 4,
  Quad = 5,
  Rect = 6,
}

/** One frame to rasterise: canvas size in raster pixels, scene-to-raster scale, and the meta box to read. */
export type RasterJob = {
  gen: number
  width: number
  height: number
  sx: number
  sy: number
  box: [number, number, number, number]
  cmds: Float32Array
  /** The commands, `[from, to)`, that draw the still layer: the land, the same frame to frame. */
  still: [number, number]
  style: Style
  /** Send the cells' kind, material and light back with the type, for the page's `?probe` dump. */
  probe?: boolean
}

/** A frame reduced to cells: coverage, material and mean colour, and per petal cell its id, light and facing. */
export type Cells = {
  cov: Float32Array<ArrayBuffer>
  kinds: Uint8Array<ArrayBuffer>
  rgb: Float32Array<ArrayBuffer>
  pid: Uint8Array<ArrayBuffer>
  lit: Float32Array<ArrayBuffer>
  back: Uint8Array<ArrayBuffer>
}

export type RasterResult = {
  gen: number
  material: Material
  /** The cells the type was set from, only when the job asked to probe them. */
  cells?: Cells
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

const KIND_CSS = [
  '',
  '#0000ff',
  '#00ff00',
  '#00ffff',
  '#ff0000',
  '#ff00ff',
  '#ffff00',
  '#ffffff',
]
const rgba = (r: number, g: number, b: number, a = 1) =>
  `rgba(${r | 0},${g | 0},${b | 0},${a})`

/** Builds a Path2D from recorded path ops in `ops[i..end)`. */
export function buildPath(ops: ArrayLike<number>, i: number, end: number) {
  const p = new Path2D()
  while (i < end) {
    switch (ops[i++]) {
      case PathOp.Move:
        p.moveTo(ops[i], ops[i + 1])
        i += 2
        break
      case PathOp.Line:
        p.lineTo(ops[i], ops[i + 1])
        i += 2
        break
      case PathOp.Close:
        p.closePath()
        break
      case PathOp.Ellipse:
        p.ellipse(
          ops[i],
          ops[i + 1],
          Math.max(0, ops[i + 2]),
          Math.max(0, ops[i + 3]),
          ops[i + 4],
          ops[i + 5],
          ops[i + 6],
          ops[i + 7] > 0,
        )
        i += 8
        break
      case PathOp.Quad:
        p.quadraticCurveTo(ops[i], ops[i + 1], ops[i + 2], ops[i + 3])
        i += 4
        break
      case PathOp.Rect:
        p.rect(ops[i], ops[i + 1], ops[i + 2], ops[i + 3])
        i += 4
        break
      default:
        return p
    }
  }
  return p
}

/** Colour, material and petal meta: the three canvases a frame's commands are replayed into. */
type Layer = { color: Ctx; kind: Ctx; meta: Ctx }

/**
 * Three small canvases (colour, material, petal meta) that a frame's commands are replayed into.
 * The land is big and changes only with the hour, so it is kept as a layer of its own and laid in
 * whole while its commands stay the same; filling it again would cost a third of the frame.
 */
export class Rasterizer {
  private color: Ctx
  private kind: Ctx
  private meta: Ctx
  private still: Layer
  /** The commands the still layer was last drawn from, and at what scale. */
  private stillCmds = new Float32Array(0)
  private stillScale = ''
  private type = new Typesetter()
  /** The last frame's pixels and the cells sampled from them, for sampleCells to sample only what changed. */
  private sampled: Sampled | null = null
  /** Of the last frame's cells with anything in them, how many were sampled again, for `?probe`. */
  resampled = { cells: 0, of: 0 }

  constructor(make: () => Ctx) {
    this.color = make()
    this.kind = make()
    this.meta = make()
    this.still = { color: make(), kind: make(), meta: make() }
  }

  run(job: RasterJob): RasterResult {
    const { width, height, sx, sy, cmds } = job
    const { color, kind, meta } = this
    const frame = { color, kind, meta }
    this.prepare(frame, width, height, sx, sy)
    const [from, to] = job.still
    if (to > from) {
      const own = cmds.subarray(from, to)
      const scale = `${width}/${height}/${sx}/${sy}`
      if (scale !== this.stillScale || !same(own, this.stillCmds)) {
        this.prepare(this.still, width, height, sx, sy)
        this.replay(this.still, cmds, from, to)
        this.stillCmds = own.slice()
        this.stillScale = scale
      }
      // The still layer goes down first as a plain copy, and what the frame drew before it (the
      // sun and moon) goes in behind it, last command first, since each goes under the ones
      // already there: the same picture as drawing them in order, without blending the whole
      // layer in.
      for (const k of ['color', 'kind', 'meta'] as const) {
        const ctx = frame[k]
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'copy'
        ctx.drawImage(this.still[k].canvas, 0, 0)
        ctx.globalCompositeOperation = 'destination-over'
        ctx.setTransform(sx, 0, 0, sy, 0, 0)
      }
      const starts: number[] = []
      for (let i = 0; i < from; i = commandEnd(cmds, i)) starts.push(i)
      for (let s = starts.length - 1; s >= 0; s--)
        this.replay(frame, cmds, starts[s], starts[s + 1] ?? from)
      for (const k of ['color', 'kind', 'meta'] as const)
        frame[k].globalCompositeOperation = 'source-over'
    } else this.replay(frame, cmds, 0, from)
    this.replay(frame, cmds, Math.max(from, to), cmds.length)
    const [x0, y0, x1, y1] = job.box
    const md =
      x1 > x0 && y1 > y0
        ? meta.getImageData(x0, y0, x1 - x0, y1 - y0).data
        : null
    const cols = width / SS
    const rows = height / SS
    const cd = color.getImageData(0, 0, width, height).data
    const kd = kind.getImageData(0, 0, width, height).data
    const cells = sampleCells(
      cd,
      kd,
      md,
      job.box,
      width,
      cols,
      rows,
      this.sampled,
      this.resampled,
    )
    // Kept as sampled: the type clears the kinds of the heads it stamps, and nothing else here.
    this.sampled = {
      cd,
      kd,
      md,
      box: job.box,
      W: width,
      cols,
      rows,
      cells: { ...cells, kinds: cells.kinds.slice() },
    }
    const material = this.type.run(cells, job.style, cols, rows)
    if (!job.probe) return { gen: job.gen, material }
    return { gen: job.gen, material, cells }
  }

  /** Sizes and clears a layer's canvases for a frame, scaled from scene to raster pixels. */
  private prepare(
    layer: Layer,
    width: number,
    height: number,
    sx: number,
    sy: number,
  ) {
    for (const ctx of [layer.color, layer.kind, layer.meta]) {
      if (ctx.canvas.width !== width || ctx.canvas.height !== height) {
        ctx.canvas.width = width
        ctx.canvas.height = height
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.setTransform(sx, 0, 0, sy, 0, 0)
    }
    layer.kind.lineCap = 'round'
    layer.color.lineCap = 'round'
  }

  /** Replays the commands in `cmds[from..to)` onto a layer. `commandEnd` knows their lengths too. */
  private replay(layer: Layer, cmds: Float32Array, from: number, to: number) {
    const { color, kind, meta } = layer
    let i = from
    while (i < to) {
      const op = cmds[i]
      if (op === Op.Fill) {
        const r = cmds[i + 1]
        const g = cmds[i + 2]
        const b = cmds[i + 3]
        const k = cmds[i + 4]
        const a = cmds[i + 5]
        const hasMeta = cmds[i + 6]
        const mr = cmds[i + 7]
        const mg = cmds[i + 8]
        const mb = cmds[i + 9]
        const len = cmds[i + 10]
        const start = i + 11
        const path = buildPath(cmds, start, start + len)
        color.globalAlpha = a
        color.fillStyle = rgba(r, g, b)
        color.fill(path)
        kind.globalAlpha = a
        kind.fillStyle = KIND_CSS[k]
        kind.fill(path)
        if (hasMeta) {
          meta.fillStyle = rgba(mr, mg, mb)
          meta.fill(path)
        }
        i = start + len
      } else if (op === Op.Stroke) {
        const r = cmds[i + 1]
        const g = cmds[i + 2]
        const b = cmds[i + 3]
        const k = cmds[i + 4]
        const a = cmds[i + 5]
        const w = cmds[i + 6]
        const len = cmds[i + 7]
        const start = i + 8
        const path = buildPath(cmds, start, start + len)
        color.globalAlpha = a
        color.strokeStyle = rgba(r, g, b)
        color.lineWidth = w
        color.stroke(path)
        kind.globalAlpha = a
        kind.strokeStyle = KIND_CSS[k]
        kind.lineWidth = w
        kind.stroke(path)
        i = start + len
      } else if (op === Op.Gradient) {
        // Colour only, so the material underneath keeps its kind.
        const y0 = cmds[i + 1]
        const y1 = cmds[i + 2]
        const stops = cmds[i + 3]
        const grad = color.createLinearGradient(0, y0, 0, y1)
        let j = i + 4
        for (let s = 0; s < stops; s++, j += 5)
          grad.addColorStop(
            cmds[j],
            rgba(cmds[j + 1], cmds[j + 2], cmds[j + 3], cmds[j + 4]),
          )
        const len = cmds[j]
        const path = buildPath(cmds, j + 1, j + 1 + len)
        color.globalAlpha = 1
        color.fillStyle = grad
        color.fill(path)
        i = j + 1 + len
      } else break
    }
  }
}

/** Whether two command runs are the same, number for number. */
function same(a: Float32Array, b: Float32Array) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/**
 * Reduce the raster to per-cell coverage, colour and material. A plant material that covers
 * a quarter of the cell wins it over the land behind, so thin stems and blades survive, and
 * the cell then takes its colour and coverage from that material alone. Done where the pixels
 * are, so only the cells cross to the page. `md` holds the meta layer inside `box` only.
 */
function sampleCells(
  cd: Uint8ClampedArray,
  kd: Uint8ClampedArray,
  md: Uint8ClampedArray | null,
  box: [number, number, number, number],
  W: number,
  cols: number,
  rows: number,
  last: Sampled | null,
  count: { cells: number; of: number },
): Cells {
  const total = cols * rows
  const cov = new Float32Array(total)
  const kinds = new Uint8Array(total)
  const rgb = new Float32Array(total * 3)
  const pid = new Uint8Array(total)
  const lit = new Float32Array(total)
  const back = new Uint8Array(total)
  const [bx0, by0, bx1, by1] = box
  const bw = bx1 - bx0
  const n = SS * SS
  // A plant needs a quarter of the cell to win it.
  const floor = 0.25 * 255 * n
  const weight = new Float32Array(8)
  // Votes for the land material (LandMat) under a land cell, by its meta id.
  const mats = new Uint8Array(8)
  const kr = new Float32Array(8)
  const kg = new Float32Array(8)
  const kb = new Float32Array(8)
  const ids = new Int32Array(n)
  const cells = { cov, kinds, rgb, pid, lit, back }
  // The last frame stands in for any cell whose pixels it shares, if it was read the same way:
  // the same grid, and the meta layer from the same box, since a cell reads meta only inside it.
  const was =
    last &&
    last.W === W &&
    last.cols === cols &&
    last.rows === rows &&
    last.cd.length === cd.length &&
    last.box[0] === bx0 &&
    last.box[1] === by0 &&
    last.box[2] === bx1 &&
    last.box[3] === by1 &&
    (last.md === null) === (md === null) &&
    (md === null || last.md?.length === md.length)
      ? last
      : null
  count.cells = 0
  count.of = 0
  const at: Sampling = {
    c32: words(cd),
    k32: words(kd),
    m32: md && words(md),
    pc32: was && words(was.cd),
    pk32: was && words(was.kd),
    pm32: was && was.md && words(was.md),
    was: was && was.cells,
    count,
    cd,
    kd,
    md,
    bx0,
    by0,
    bx1,
    by1,
    bw,
    W,
    cols,
    n,
    floor,
    weight,
    mats,
    kr,
    kg,
    kb,
    ids,
    ...cells,
  }
  for (let r = 0; r < rows; r++) sampleRow(at, r)
  return cells
}

/** A frame's pixels as sampleCells read them, and the cells it made of them. */
type Sampled = {
  cd: Uint8ClampedArray
  kd: Uint8ClampedArray
  md: Uint8ClampedArray | null
  box: [number, number, number, number]
  W: number
  cols: number
  rows: number
  cells: Cells
}

/** A canvas's pixels a whole pixel to a word, for telling two apart at a glance. */
const words = (d: Uint8ClampedArray) =>
  new Uint32Array(d.buffer, d.byteOffset, d.byteLength >> 2)

/** What sampleRow reads and writes: sampleCells's inputs, scratch and output. */
type Sampling = {
  /** This frame's colour, kind and meta pixels a word each, and the last frame's, if it can stand in. */
  c32: Uint32Array
  k32: Uint32Array
  m32: Uint32Array | null
  pc32: Uint32Array | null
  pk32: Uint32Array | null
  pm32: Uint32Array | null
  was: Cells | null
  count: { cells: number; of: number }
  cd: Uint8ClampedArray
  kd: Uint8ClampedArray
  md: Uint8ClampedArray | null
  bx0: number
  by0: number
  bx1: number
  by1: number
  bw: number
  W: number
  cols: number
  n: number
  floor: number
  weight: Float32Array
  mats: Uint8Array
  kr: Float32Array
  kg: Float32Array
  kb: Float32Array
  ids: Int32Array
} & Cells

/**
 * One row of sampleCells. A function of its own, called once a row, so V8 compiles it whole
 * within the first frame: as one long loop nest, run a few times a second, it was compiled again
 * partway through each run and dropped when the inner loop ended, many times a frame.
 */
function sampleRow(at: Sampling, r: number) {
  const { cd, kd, md, bx0, by0, bx1, by1, bw, W, cols, n, floor } = at
  const { weight, mats, kr, kg, kb, ids } = at
  const { cov, kinds, rgb, pid, lit, back } = at
  const { c32, k32, m32, pc32, pk32, pm32, was, count } = at
  for (let c = 0; c < cols; c++) {
    const i = r * cols + c
    // Most of the sky is bare: nothing drawn in any subsample.
    let any = 0
    for (let sy = 0; sy < SS; sy++) {
      let o = ((r * SS + sy) * W + c * SS) * 4 + 3
      for (let sx = 0; sx < SS; sx++, o += 4) any |= cd[o] | kd[o]
    }
    if (!any) {
      lit[i] = 0.5
      continue
    }
    count.of++
    // Most of what's left is land that hasn't changed since the last frame. A cell is worked out
    // from its own subsamples alone, in the colour and kind layers and the meta inside the box, so
    // one whose every such pixel is as it was takes the cell worked out then, to the bit.
    if (was && pc32 && pk32) {
      let same = true
      for (let sy = 0; same && sy < SS; sy++) {
        const py = r * SS + sy
        let o = py * W + c * SS
        for (let sx = 0; sx < SS; sx++, o++) {
          if (c32[o] !== pc32[o] || k32[o] !== pk32[o]) {
            same = false
            break
          }
          if (m32 && pm32) {
            const px = c * SS + sx
            if (px >= bx0 && px < bx1 && py >= by0 && py < by1) {
              const m = (py - by0) * bw + (px - bx0)
              if (m32[m] !== pm32[m]) {
                same = false
                break
              }
            }
          }
        }
      }
      if (same) {
        cov[i] = was.cov[i]
        kinds[i] = was.kinds[i]
        rgb[i * 3] = was.rgb[i * 3]
        rgb[i * 3 + 1] = was.rgb[i * 3 + 1]
        rgb[i * 3 + 2] = was.rgb[i * 3 + 2]
        pid[i] = was.pid[i]
        lit[i] = was.lit[i]
        back[i] = was.back[i]
        continue
      }
    }
    count.cells++
    // Kinds present in this cell, one bit each; a kind's sums are cleared when it first shows.
    let seen = 0
    let a = 0
    let nIds = 0
    let li = 0
    let bk = 0
    let pn = 0
    // Hills carry slope light in the same layer: 0.5 neutral, up toward the light, down in shade.
    let ll = 0
    let ln = 0
    // Fluff marked as a loose petal (LOOSE_PETAL) carries the back flag.
    let lb = 0
    // Subsamples of the sun or moon (GLOBE), which stand behind the land.
    let globe = 0
    // The kinds that show plainly in this cell, one bit each; worked out only if a pixel asks.
    let plain = -1
    for (let sy = 0; sy < SS; sy++) {
      const py = r * SS + sy
      let o = (py * W + c * SS) * 4
      for (let sx = 0; sx < SS; sx++, o += 4) {
        const al = cd[o + 3]
        a += al
        const kal = kd[o + 3]
        if (kal === 0) continue
        const k0 = kd[o]
        const k1 = kd[o + 1]
        const k2 = kd[o + 2]
        let k = (k0 > 127 ? 4 : 0) | (k1 > 127 ? 2 : 0) | (k2 > 127 ? 1 : 0)
        // An even blend of two kinds that differ in two channels or more (a blade's edge over the
        // land) sits at the middle in each, and off by a step there one channel can fall each
        // side: a kind that's neither, a petal in the grass. Such a pixel is held to the kinds
        // that show plainly in its cell and what each would blend with to sit there.
        const mid =
          (k0 > MID_LO && k0 < MID_HI ? 4 : 0) |
          (k1 > MID_LO && k1 < MID_HI ? 2 : 0) |
          (k2 > MID_LO && k2 < MID_HI ? 1 : 0)
        if (mid & (mid - 1)) {
          if (plain < 0) plain = plainKinds(kd, (r * SS * W + c * SS) * 4, W)
          if (plain && !((plain >> k) & 1)) k = settle(k, plain, k0, k1, k2)
        }
        if (!((seen >> k) & 1)) {
          seen |= 1 << k
          weight[k] = 0
          kr[k] = 0
          kg[k] = 0
          kb[k] = 0
          // The land votes are read only for a land cell, and a cell can only be land once land
          // shows in it, so they're cleared here rather than for every cell drawn on.
          if (k === Kind.Land) for (let x = 0; x < 8; x++) mats[x] = 0
        }
        weight[k] += kal
        // The meta pixel, if this subsample is inside the box that was read back.
        if (md && (k === Kind.Petal || k === Kind.Land || k === Kind.Fluff)) {
          const px = c * SS + sx
          if (px >= bx0 && px < bx1 && py >= by0 && py < by1) {
            const m = ((py - by0) * bw + (px - bx0)) * 4
            // A faint fringe pixel of a fluff mark comes back too coarse, once un-premultiplied,
            // to tell the sun from a loose petal by, so it's left to the subsamples around it.
            if (md[m + 3] > (k === Kind.Fluff ? 63 : 0)) {
              if (k === Kind.Petal) {
                // Petal identity by vote, since antialiased seams blend two ids; light and facing averaged.
                if (kal > 200) ids[nIds++] = Math.round(md[m] / 24)
                li += md[m + 1]
                bk += md[m + 2]
                pn++
              } else if (k === Kind.Land || md[m] < FAINT) {
                // The sun and moon (GLOBE: neutral light, back flag) carry no light of their
                // own: averaged in, they'd shade a crest cell by how much disc is behind it,
                // flickering as it moves.
                const isGlobe =
                  k !== Kind.Land &&
                  md[m + 2] > 191 &&
                  // A loose petal's light is 0 or 255; blended half over the land's 128, its
                  // back flag falls under 192 before its light comes within 40 of the land's.
                  Math.abs(md[m + 1] - 128) <= 40
                if (k === Kind.Land) mats[Math.min(7, Math.round(md[m] / 24))]++
                else if (isGlobe) globe++
                // Fluff reads only fluff's own marks (id 0): a seed head, firefly or the moon
                // in front of a petal or leaf would otherwise take its back flag and print as
                // a loose petal.
                if (
                  k === Kind.Land ||
                  (!isGlobe && (md[m + 1] >= FAINT || md[m + 2] >= FAINT))
                ) {
                  ll += md[m + 1]
                  lb += md[m + 2]
                  ln++
                }
              }
            }
          }
        }
        kr[k] += cd[o] * al
        kg[k] += cd[o + 1] * al
        kb[k] += cd[o + 2] * al
      }
    }
    let best = Kind.Empty as number
    let bw0 = (seen & 1) === 1 ? weight[0] : 0
    for (const k of PLANT_KINDS) {
      if ((seen >> k) & 1 && weight[k] > bw0) {
        best = k
        bw0 = weight[k]
      }
    }
    if (bw0 < floor) {
      best = Kind.Empty
      bw0 = (seen & 1) === 1 ? weight[0] : 0
      for (let k = 1; k < 8; k++) {
        if ((seen >> k) & 1 && weight[k] > bw0) {
          best = k
          bw0 = weight[k]
        }
      }
    }
    // The sun and moon are behind the land, but as fluff they'd outvote a ridge in the cells
    // along its crest; a cell the land covers a quarter of is the land's, or a disc behind a peak
    // eats the top of its snow. Their light is left out of the cell's colour too.
    const behind =
      best === Kind.Fluff &&
      globe > 0 &&
      (seen >> Kind.Land) & 1 &&
      weight[Kind.Land] >= floor
    if (behind) best = Kind.Land
    kinds[i] = best
    let id = 0
    let votes = 0
    for (let x = 0; x < nIds; x++) {
      let m = 0
      for (let y = 0; y < nIds; y++) if (ids[x] === ids[y]) m++
      if (m > votes) {
        votes = m
        id = ids[x]
      }
    }
    // A cell split between petals goes to the one with more of it, so folds stay unbroken.
    pid[i] = id
    // A land cell's pid is its material instead: rock, snow or forest.
    if (best === Kind.Land) {
      let mv = 0
      for (let x = 1; x < 8; x++) if (mats[x] > mats[mv]) mv = x
      pid[i] = mv
    }
    lit[i] = pn ? li / (pn * 255) : ln ? ll / (ln * 255) : 0.5
    // A cell of nothing but sun or moon reads 0, so the typesetter knows the disc.
    if (best === Kind.Fluff && globe > 0 && !ln) lit[i] = 0
    back[i] = pn ? +(bk / pn > 127) : ln ? +(lb / ln > 127) : 0
    const plant = (PLANT_MASK >> best) & 1
    const shown = behind ? Math.max(1, a - weight[Kind.Fluff]) : a
    cov[i] = (plant ? bw0 : shown) / (255 * n)
    let cr = 0
    let cg = 0
    let cb = 0
    for (let k = 0; k < 8; k++) {
      if (!((seen >> k) & 1) || (plant && k !== best)) continue
      if (behind && k === Kind.Fluff) continue
      cr += kr[k]
      cg += kg[k]
      cb += kb[k]
    }
    // Colour sums are weighted by alpha, so divide by the alpha they were drawn with.
    const norm = plant ? bw0 : shown
    if (norm > 0) {
      rgb[i * 3] = cr / norm
      rgb[i * 3 + 1] = cg / norm
      rgb[i * 3 + 2] = cb / norm
    }
  }
}

/**
 * A meta byte under this is nothing: no petal's id, no light, no back flag. Not a bare zero, since
 * a browser that guards against canvas fingerprinting (Helium, Brave) hands pixels back a step off,
 * and a fluff cell with nothing behind it then read as lit from below: seed heads and fireflies
 * flashed as solid blocks, a different few each frame. At a fringe, un-premultiplied, the step
 * is a few; marks sit at 128 or 255 and ids 24 apart.
 */
const FAINT = 12

/**
 * The band about the middle in which a kind's channel can't be told on from off, for the same
 * browsers: their step grows to four or so on a blended pixel, and this is twice that each way.
 */
const MID_LO = 119
const MID_HI = 136

/** The kinds of a cell's subsamples that sit clear of the middle in every channel, one bit each. */
function plainKinds(kd: Uint8ClampedArray, at: number, W: number) {
  let plain = 0
  for (let sy = 0; sy < SS; sy++) {
    let o = at + sy * W * 4
    for (let sx = 0; sx < SS; sx++, o += 4) {
      if (kd[o + 3] === 0) continue
      const k0 = kd[o]
      const k1 = kd[o + 1]
      const k2 = kd[o + 2]
      if (
        (k0 > MID_LO && k0 < MID_HI) ||
        (k1 > MID_LO && k1 < MID_HI) ||
        (k2 > MID_LO && k2 < MID_HI)
      )
        continue
      plain |=
        1 << ((k0 > 127 ? 4 : 0) | (k1 > 127 ? 2 : 0) | (k2 > 127 ? 1 : 0))
    }
  }
  return plain
}

/**
 * The kind of a pixel near the middle in two channels or more, which reads as `k`. Against each
 * kind that shows plainly in its cell, the pixel is that kind blended with the one that differs
 * from it in every channel the pixel has left it in. `k` stands if it is one of those; otherwise
 * it is a step's doing, and the nearest of them stands in.
 */
function settle(k: number, plain: number, k0: number, k1: number, k2: number) {
  let best = k
  let near = Infinity
  for (let a = 0; a < 8; a++) {
    if (!((plain >> a) & 1)) continue
    const d0 = k0 - (a & 4 ? 255 : 0)
    const d1 = k1 - (a & 2 ? 255 : 0)
    const d2 = k2 - (a & 1 ? 255 : 0)
    const b =
      a ^
      ((d0 > LEFT || d0 < -LEFT ? 4 : 0) |
        (d1 > LEFT || d1 < -LEFT ? 2 : 0) |
        (d2 > LEFT || d2 < -LEFT ? 1 : 0))
    if (k === a || k === b) return k
    const da = d0 * d0 + d1 * d1 + d2 * d2
    if (da < near) {
      near = da
      best = a
    }
    const e0 = k0 - (b & 4 ? 255 : 0)
    const e1 = k1 - (b & 2 ? 255 : 0)
    const e2 = k2 - (b & 1 ? 255 : 0)
    const db = e0 * e0 + e1 * e1 + e2 * e2
    if (db < near) {
      near = db
      best = b
    }
  }
  return best
}

/** How far a channel must stand from a kind's own value to have left it. */
const LEFT = 32

/** Where the command at `cmds[i]` ends, as `replay` reads it. */
function commandEnd(cmds: Float32Array, i: number) {
  const op = cmds[i]
  if (op === Op.Fill) return i + 11 + cmds[i + 10]
  if (op === Op.Stroke) return i + 8 + cmds[i + 7]
  if (op === Op.Gradient) {
    const j = i + 4 + cmds[i + 3] * 5
    return j + 1 + cmds[j]
  }
  return Infinity
}
