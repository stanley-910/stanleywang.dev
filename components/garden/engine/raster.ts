import {
  buildPath,
  Op,
  PathOp,
  Rasterizer,
  type RasterJob,
  type RasterResult,
} from './rasterize'

import type { Rgb } from './palette'

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
/** How long a worker may hold a frame before the raster gives up on workers. */
const WORKER_TIMEOUT = 1000

/** A flower head drawn this frame, so far ones can print as a stamped motif instead. */
export type Head = {
  x: number
  y: number
  r: number
  species: 'poppy' | 'cosmos'
  petal: Rgb
  disc: Rgb
  alpha: number
  /** The plant it belongs to, so a butterfly can stay on the same flower from frame to frame. */
  owner?: object
  /** The plant's depth, 0 at the horizon to 1 at the viewer. */
  depth?: number
}

/**
 * An insect's colours, one per cell role of its figure: the wing's ground, the pattern laid
 * over it (bands, eyespots), the dark margin and veins, and the body.
 */
export type Look = { base: Rgb; pattern: Rgb; edge: Rgb; body: Rgb }

/** A butterfly or moth, printed as a few fixed glyphs. Pose 0 is wings open, 1 half, 2 folded. */
/** `span` is the wingspan in px, which picks the figure's size. */
export type Sprite = {
  x: number
  y: number
  pose: number
  look: Look
  moth: boolean
  span: number
}

/** Petal identity for the meta layer: which petal (1..10), how lit it is, and whether its back shows. */
export type PetalMeta = { id: number; light: number; back: boolean }

/** Marks flower fluff (lace florets, dandelion seeds) apart from the sun and moon, which share its kind. */
export const FLOWER_FLUFF: PetalMeta = { id: 0, light: 1, back: false }

/**
 * A path recorded as numbers instead of drawn, so a frame's shapes can be shipped to the raster
 * worker. Plants build these exactly as they would a Path2D.
 */
export class Shape {
  ops: number[] = []
  moveTo(x: number, y: number) {
    this.ops.push(PathOp.Move, x, y)
  }
  lineTo(x: number, y: number) {
    this.ops.push(PathOp.Line, x, y)
  }
  closePath() {
    this.ops.push(PathOp.Close)
  }
  ellipse(
    x: number,
    y: number,
    rx: number,
    ry: number,
    rotation: number,
    start: number,
    end: number,
    ccw = false,
  ) {
    this.ops.push(
      PathOp.Ellipse,
      x,
      y,
      rx,
      ry,
      rotation,
      start,
      end,
      ccw ? 1 : 0,
    )
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
    this.ops.push(PathOp.Quad, cx, cy, x, y)
  }
  rect(x: number, y: number, w: number, h: number) {
    this.ops.push(PathOp.Rect, x, y, w, h)
  }
  /** A real path, for drawing on the main thread (the backdrop). */
  toPath2D() {
    return buildPath(this.ops, 0, this.ops.length)
  }
}

type Box = [number, number, number, number]

/**
 * The scene is drawn as vector shapes in page pixels into three small canvases: colour, material
 * and petal meta. The ASCII pass reads them back per cell.
 *
 * Filling those shapes is the slowest part of a frame, so it happens in a worker. The main thread
 * records each frame's draws as numbers and posts them; the worker replays them onto its own
 * canvases and posts the pixels back. The ASCII pass draws from the latest frame to come back,
 * one frame behind the simulation. When a frame must be exact now (the first one, after a
 * resize, with reduced motion) or workers aren't available, the same replay runs right here.
 */
export class Raster {
  /** Heads and sprites recorded this frame, for the simulation (butterflies, clicks). */
  heads: Head[] = []
  sprites: Sprite[] = []
  /** Heads and sprites of the frame the pixels below came from, for the ASCII pass. */
  drawnHeads: Head[] = []
  drawnSprites: Sprite[] = []
  width = 0
  height = 0
  /** Narrowest stroke that still wins its cell: a little over one subsample across. */
  minLine = 1
  /** Multiplies every draw's alpha, so a whole plant can fade out. */
  opacity = 1
  colorData: Uint8ClampedArray = new Uint8ClampedArray(0)
  kindData: Uint8ClampedArray = new Uint8ClampedArray(0)
  metaData: Uint8ClampedArray = new Uint8ClampedArray(0)
  /** True once pixels for the current size have arrived. */
  ready = false
  private sx = 1
  private sy = 1
  /** Bounds of this frame's meta draws in scene pixels, and of the last adopted frame's in raster pixels. */
  private touch: Box = [Infinity, Infinity, -Infinity, -Infinity]
  private metaBox: Box = [0, 0, -1, -1]
  private cmds = new Float32Array(1 << 16)
  private n = 0
  /** Bumped on resize, so a frame drawn at the old size is dropped when it comes back. */
  private gen = 0
  /** Two workers take alternate frames, so the plants move at close to the display's rate. */
  private workers: Worker[] = []
  private idle: Worker[] = []
  /** Frames out at the workers, by sequence number, with the heads and sprites drawn in them. */
  private inFlight = new Map<
    number,
    { gen: number; heads: Head[]; sprites: Sprite[]; sent: number }
  >()
  private seq = 0
  private shownSeq = -1
  private local: Rasterizer | null = null
  /** Bumped each time a frame's pixels are adopted, so readers can skip re-reading the same frame. */
  version = 0

  constructor() {
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined')
      return
    try {
      for (let k = 0; k < 2; k++) {
        const w = new Worker(new URL('./raster.worker.ts', import.meta.url), {
          type: 'module',
        })
        w.onmessage = (e: MessageEvent<RasterResult & { seq: number }>) => {
          this.idle.push(w)
          const job = this.inFlight.get(e.data.seq)
          this.inFlight.delete(e.data.seq)
          // A later frame may already be on screen; an older one arriving after it is dropped.
          if (
            job &&
            job.gen === this.gen &&
            e.data.gen === this.gen &&
            e.data.seq > this.shownSeq
          ) {
            this.shownSeq = e.data.seq
            this.adopt(e.data, job.heads, job.sprites)
          }
        }
        w.onerror = (e) =>
          this.dropWorkers(
            'Raster worker failed; drawing on the main thread',
            e,
          )
        w.onmessageerror = (e) =>
          this.dropWorkers(
            'Raster worker reply unreadable; drawing on the main thread',
            e,
          )
        this.workers.push(w)
        this.idle.push(w)
      }
    } catch (err) {
      console.error(
        'Raster worker unavailable; drawing on the main thread',
        err,
      )
      this.workers = []
      this.idle = []
    }
  }

  /** Every worker has a frame; recording another now would only queue behind them. */
  get busy() {
    if (this.workers.length === 0 || this.idle.length > 0) return false
    // A reply that never comes would freeze the plants for good: give up on the workers instead.
    const now = performance.now()
    for (const job of this.inFlight.values()) {
      if (now - job.sent > WORKER_TIMEOUT) {
        this.dropWorkers(
          `Raster worker silent for ${WORKER_TIMEOUT}ms; drawing on the main thread`,
        )
        return false
      }
    }
    return true
  }

  /** Stops the workers, for when the scene leaves the page. */
  dispose() {
    for (const x of this.workers) x.terminate()
    this.workers = []
    this.idle = []
    this.inFlight.clear()
  }

  private dropWorkers(why: string, err?: unknown) {
    console.error(why, err ?? '')
    for (const x of this.workers) x.terminate()
    this.workers = []
    this.idle = []
    this.inFlight.clear()
  }

  resize(cols: number, rows: number, cw: number, ch: number) {
    this.width = cols * SS
    this.height = rows * SS
    this.minLine = (cw / SS) * 1.2
    this.sx = SS / cw
    this.sy = SS / ch
    this.metaData = new Uint8ClampedArray(this.width * this.height * 4)
    this.metaBox = [0, 0, -1, -1]
    this.gen++
    this.ready = false
  }

  clear() {
    this.heads = []
    this.sprites = []
    this.n = 0
    this.touch = [Infinity, Infinity, -Infinity, -Infinity]
  }

  private room(k: number) {
    if (this.n + k <= this.cmds.length) return
    let size = this.cmds.length * 2
    while (size < this.n + k) size *= 2
    const next = new Float32Array(size)
    next.set(this.cmds.subarray(0, this.n))
    this.cmds = next
  }

  private path(shape: Shape) {
    const ops = shape.ops
    this.room(ops.length + 1)
    const c = this.cmds
    c[this.n++] = ops.length
    c.set(ops, this.n)
    this.n += ops.length
  }

  fill(shape: Shape, rgb: Rgb, kind: Kind, alpha = 1, meta?: PetalMeta) {
    this.room(11)
    const c = this.cmds
    let n = this.n
    c[n++] = Op.Fill
    c[n++] = rgb[0]
    c[n++] = rgb[1]
    c[n++] = rgb[2]
    c[n++] = kind
    c[n++] = alpha * this.opacity
    c[n++] = meta ? 1 : 0
    c[n++] = meta ? meta.id * 24 : 0
    c[n++] = meta ? Math.round(meta.light * 255) : 0
    c[n++] = meta?.back ? 255 : 0
    this.n = n
    this.path(shape)
  }

  stroke(shape: Shape, rgb: Rgb, kind: Kind, width: number, alpha = 1) {
    this.room(8)
    const c = this.cmds
    let n = this.n
    c[n++] = Op.Stroke
    c[n++] = rgb[0]
    c[n++] = rgb[1]
    c[n++] = rgb[2]
    c[n++] = kind
    c[n++] = alpha * this.opacity
    c[n++] = width
    this.n = n
    this.path(shape)
  }

  /** A vertical gradient laid over a shape in colour only, so the material underneath keeps its kind. */
  gradient(
    shape: Shape,
    y0: number,
    y1: number,
    stops: [t: number, rgb: Rgb, alpha: number][],
  ) {
    this.room(4 + stops.length * 5)
    const c = this.cmds
    c[this.n++] = Op.Gradient
    c[this.n++] = y0
    c[this.n++] = y1
    c[this.n++] = stops.length
    for (const [t, rgb, a] of stops) {
      c[this.n++] = t
      c[this.n++] = rgb[0]
      c[this.n++] = rgb[1]
      c[this.n++] = rgb[2]
      c[this.n++] = a
    }
    this.path(shape)
  }

  dot(x: number, y: number, r: number, rgb: Rgb, kind: Kind, alpha = 1) {
    const p = new Shape()
    p.ellipse(x, y, r, r, 0, 0, Math.PI * 2)
    this.fill(p, rgb, kind, alpha)
  }

  /** Grows this frame's meta bounds to include a point in scene pixels. */
  touchMeta(x: number, y: number) {
    const b = this.touch
    if (x < b[0]) b[0] = x
    if (y < b[1]) b[1] = y
    if (x > b[2]) b[2] = x
    if (y > b[3]) b[3] = y
  }

  /** Sends this frame's draws off to be rasterised; `now` rasterises them here, before returning. */
  submit(now: boolean) {
    const t = this.touch
    const box: Box = [
      Math.max(0, Math.floor(t[0] * this.sx) - 2),
      Math.max(0, Math.floor(t[1] * this.sy) - 2),
      Math.min(this.width, Math.ceil(t[2] * this.sx) + 2),
      Math.min(this.height, Math.ceil(t[3] * this.sy) + 2),
    ]
    const job: RasterJob = {
      gen: this.gen,
      width: this.width,
      height: this.height,
      sx: this.sx,
      sy: this.sy,
      box,
      cmds: this.cmds.slice(0, this.n),
    }
    const worker = !now && this.ready ? this.idle.pop() : undefined
    if (worker) {
      const seq = ++this.seq
      this.inFlight.set(seq, {
        gen: this.gen,
        heads: this.heads,
        sprites: this.sprites,
        sent: performance.now(),
      })
      worker.postMessage({ ...job, seq }, [job.cmds.buffer])
      return
    }
    this.local ??= new Rasterizer(() => {
      const ctx = document
        .createElement('canvas')
        .getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('2D canvas unavailable')
      return ctx
    })
    this.shownSeq = ++this.seq
    this.adopt(this.local.run(job), this.heads, this.sprites)
  }

  private adopt(out: RasterResult, heads: Head[], sprites: Sprite[]) {
    this.version++
    this.colorData = out.color
    this.kindData = out.kind
    // Last frame's meta pixels sit in the kept buffer; zero just those, then copy in the new box.
    const [px0, py0, px1, py1] = this.metaBox
    for (let y = py0; y < py1; y++)
      this.metaData.fill(
        0,
        (y * this.width + px0) * 4,
        (y * this.width + px1) * 4,
      )
    const [x0, y0, x1, y1] = out.box
    if (out.meta) {
      const rowLen = (x1 - x0) * 4
      for (let y = y0; y < y1; y++)
        this.metaData.set(
          out.meta.subarray((y - y0) * rowLen, (y - y0 + 1) * rowLen),
          (y * this.width + x0) * 4,
        )
      this.metaBox = out.box
    } else this.metaBox = [0, 0, -1, -1]
    this.drawnHeads = heads
    this.drawnSprites = sprites
    this.ready = true
  }
}
