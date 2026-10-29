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
      // sun and moon) goes in behind it: the same pixels as drawing them in order, without
      // blending the whole layer in.
      for (const k of ['color', 'kind', 'meta'] as const) {
        const ctx = frame[k]
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'copy'
        ctx.drawImage(this.still[k].canvas, 0, 0)
        ctx.globalCompositeOperation = 'destination-over'
        ctx.setTransform(sx, 0, 0, sy, 0, 0)
      }
      this.replay(frame, cmds, 0, from)
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
    const cells = sampleCells(
      color.getImageData(0, 0, width, height).data,
      kind.getImageData(0, 0, width, height).data,
      md,
      job.box,
      width,
      cols,
      rows,
    )
    return {
      gen: job.gen,
      material: this.type.run(cells, job.style, cols, rows),
    }
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

  /** Replays the commands in `cmds[from..to)` onto a layer. */
  private replay(layer: Layer, cmds: Float32Array, from: number, to: number) {
    const { color, kind, meta } = layer
    let i = from
    while (i < to) {
      const op = cmds[i]
      if (op === Op.Fill) {
        const [r, g, b, k, a, hasMeta, mr, mg, mb, len] = cmds.subarray(
          i + 1,
          i + 11,
        )
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
        const [r, g, b, k, a, w, len] = cmds.subarray(i + 1, i + 8)
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
  const kr = new Float32Array(8)
  const kg = new Float32Array(8)
  const kb = new Float32Array(8)
  const ids = new Int32Array(n)
  for (let r = 0; r < rows; r++) {
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
      for (let sy = 0; sy < SS; sy++) {
        const py = r * SS + sy
        let o = (py * W + c * SS) * 4
        for (let sx = 0; sx < SS; sx++, o += 4) {
          const al = cd[o + 3]
          a += al
          const kal = kd[o + 3]
          if (kal === 0) continue
          const k =
            (kd[o] > 127 ? 4 : 0) |
            (kd[o + 1] > 127 ? 2 : 0) |
            (kd[o + 2] > 127 ? 1 : 0)
          if (!((seen >> k) & 1)) {
            seen |= 1 << k
            weight[k] = 0
            kr[k] = 0
            kg[k] = 0
            kb[k] = 0
          }
          weight[k] += kal
          // The meta pixel, if this subsample is inside the box that was read back.
          if (md && (k === Kind.Petal || k === Kind.Land || k === Kind.Fluff)) {
            const px = c * SS + sx
            if (px >= bx0 && px < bx1 && py >= by0 && py < by1) {
              const m = ((py - by0) * bw + (px - bx0)) * 4
              if (md[m + 3] > 0) {
                if (k === Kind.Petal) {
                  // Petal identity by vote, since antialiased seams blend two ids; light and facing averaged.
                  if (kal > 200) ids[nIds++] = Math.round(md[m] / 24)
                  li += md[m + 1]
                  bk += md[m + 2]
                  pn++
                } else {
                  ll += md[m + 1]
                  lb += md[m + 2]
                  ln++
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
      lit[i] = pn ? li / (pn * 255) : ln ? ll / (ln * 255) : 0.5
      back[i] = pn ? +(bk / pn > 127) : ln ? +(lb / ln > 127) : 0
      const plant = (PLANT_MASK >> best) & 1
      cov[i] = (plant ? bw0 : a) / (255 * n)
      let cr = 0
      let cg = 0
      let cb = 0
      for (let k = 0; k < 8; k++) {
        if (!((seen >> k) & 1) || (plant && k !== best)) continue
        cr += kr[k]
        cg += kg[k]
        cb += kb[k]
      }
      // Colour sums are weighted by alpha, so divide by the alpha they were drawn with.
      const norm = plant ? bw0 : a
      if (norm > 0) {
        rgb[i * 3] = cr / norm
        rgb[i * 3 + 1] = cg / norm
        rgb[i * 3 + 2] = cb / norm
      }
    }
  }
  return { cov, kinds, rgb, pid, lit, back }
}
