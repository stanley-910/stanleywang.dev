// Shared by the raster worker and the main thread: turns a frame's recorded draw commands into
// pixels. Kept free of the DOM so it runs on an OffscreenCanvas in the worker.

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
}

export type RasterResult = {
  gen: number
  color: Uint8ClampedArray
  kind: Uint8ClampedArray
  /** The meta layer inside `box` only; null when nothing touched it. */
  meta: Uint8ClampedArray | null
  box: [number, number, number, number]
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

/** Three small canvases (colour, material, petal meta) that a frame's commands are replayed into. */
export class Rasterizer {
  private color: Ctx
  private kind: Ctx
  private meta: Ctx

  constructor(make: () => Ctx) {
    this.color = make()
    this.kind = make()
    this.meta = make()
  }

  run(job: RasterJob): RasterResult {
    const { width, height, sx, sy, cmds } = job
    const all = [this.color, this.kind, this.meta]
    for (const ctx of all) {
      if (ctx.canvas.width !== width || ctx.canvas.height !== height) {
        ctx.canvas.width = width
        ctx.canvas.height = height
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.setTransform(sx, 0, 0, sy, 0, 0)
    }
    const { color, kind, meta } = this
    kind.lineCap = 'round'
    color.lineCap = 'round'
    let i = 0
    while (i < cmds.length) {
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
    const [x0, y0, x1, y1] = job.box
    return {
      gen: job.gen,
      color: color.getImageData(0, 0, width, height).data,
      kind: kind.getImageData(0, 0, width, height).data,
      meta:
        x1 > x0 && y1 > y0
          ? meta.getImageData(x0, y0, x1 - x0, y1 - y0).data
          : null,
      box: job.box,
    }
  }
}
