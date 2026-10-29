import { createCompositor, type Compositor } from './gl'
import { bayer, clamp, fbm2, hash, smoothstep } from './math'
import { mix, shade, type Palette, type Rgb } from './palette'
import { Kind, SS, type Head, type Raster, type Sprite } from './raster'

export type Rect = { left: number; top: number; right: number; bottom: number }

// Glyph ramps, sparse to dense, per material.
const PETAL = " .':-=+*x#%@"
const DISC = ' .o0O@#'
const FLUFF = " .'*+x*#"
const FOLIAGE = " .,':;!|"
const LAND = ' .·:'
const SLOPE_LIT = '.·:;'
const CLOUD = ' ·.:-=+*o'

/** Materials that belong to plants, which win a cell over the land behind them. */
const PLANT_KINDS: number[] = [
  Kind.Petal,
  Kind.Disc,
  Kind.Stem,
  Kind.Fluff,
  Kind.Foliage,
]
const PLANT_MASK = PLANT_KINDS.reduce((m, k) => m | (1 << k), 0)

// Line glyphs by direction, for stems, blades and the globe's wires.
const LINES = ['-', '\\', '|', '/']

const GLYPHS: string[] = []
const codeOf = new Map<string, number>()
function code(ch: string) {
  let c = codeOf.get(ch)
  if (c === undefined) {
    c = GLYPHS.length
    GLYPHS.push(ch)
    codeOf.set(ch, c)
  }
  return c
}
code(' ')
for (const ramp of [
  PETAL,
  DISC,
  FLUFF,
  FOLIAGE,
  LAND,
  SLOPE_LIT,
  CLOUD,
  LINES.join(''),
  '@#Oo+:·',
])
  for (const ch of ramp) code(ch)

const lum = (r: number, g: number, b: number) =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

export type FrameInput = {
  raster: Raster
  palette: Palette
  time: number
  horizon: number
  /** The site's page colour, which other pages sit on. */
  page: Rgb
  /**
   * 0 on the home page, where the scene runs full bleed; 1 on any other page, which is plain page
   * colour. In between the scene dissolves into the page from the edges in.
   */
  veil: number
  pointer: { x: number; y: number; active: boolean }
  /** Paints smooth shapes (hill silhouettes) between the sky gradient and the glyphs. */
  backdrop?: (ctx: CanvasRenderingContext2D) => void
  /** Changes whenever the backdrop would paint differently, beyond the palette. */
  backdropKey?: string
  /** Top of the painted hills at x, so ink contrasts with a ridge rather than the sky behind it. */
  hillTop?: (x: number) => number
}

// Far heads print as a fixed motif. 'p' petal, 'l' outline, 'd' centre; rows top to bottom.
type Motif = { rows: string[]; mask: string[]; cy: number }

/**
 * Butterflies and moths by wing pose (open from above, half raised, folded over the back),
 * in 7-, 5- and 1-cell widths. The last row sits on the insect's position. Each mask cell is a
 * colour role from the sprite's look: w wing ground with dark veins, s a spot of pattern colour
 * on the ground, p a band of pattern colour, e the dark margin with pale dots, b the body.
 */
type Insect = { rows: string[]; mask: string[] }
const INSECTS: Record<
  'butterfly' | 'moth',
  { big: Insect[]; mid: Insect[]; small: Insect[] }
> = {
  butterfly: {
    big: [
      // Forewings with an eyespot at the tip, hindwings with a spot, a coloured band along the hem.
      {
        rows: ['(@\\|/@)', '\\=o|o=/', " '-|-' "],
        mask: ['eswbwse', 'ewsbswe', ' wpbpw '],
      },
      // Wings rising: the shape narrows to a V and the pattern compresses toward the tips.
      {
        rows: ['\\@|@/', ' \\|/ ', '  |  '],
        mask: ['esbse', ' pbp ', '  b  '],
      },
      // Folded: one wing's underside stands up over the body.
      { rows: ['/@\\', '|=|', "`|'"], mask: ['ese', 'wpw', 'ebe'] },
    ],
    mid: [
      { rows: ['(@|@)', '\\=|=/'], mask: ['esbse', 'wpbpw'] },
      { rows: ['\\@|@/', ' \\|/ '], mask: ['esbse', ' pbp '] },
      { rows: ['/@\\', "`|'"], mask: ['ese', 'wbw'] },
    ],
    small: [
      { rows: ['w'], mask: ['s'] },
      { rows: ['v'], mask: ['w'] },
      { rows: ['A'], mask: ['w'] },
    ],
  },
  moth: {
    big: [
      // Delta wings swept back, broad at the hem; feathery ticks for the antennae.
      {
        rows: ["  `|'  ", '(=o|o=)', "`-'|`-'"],
        mask: ['  bbb  ', 'eswbswe', 'wpebepw'],
      },
      { rows: [' \\|/ ', '(=|=)', " `|' "], mask: [' sbs ', 'ewbwe', ' pbp '] },
      // Tented over the body like a roof.
      { rows: ['/^\\', '(o)', "`|'"], mask: ['wbw', 'wsw', 'ebe'] },
    ],
    mid: [
      { rows: ['(o|o)', "`-|-'"], mask: ['wsbsw', 'pebep'] },
      { rows: ['\\o|o/', " `|' "], mask: ['wsbsw', ' pbp '] },
      { rows: ['/^\\', '(|)'], mask: ['wbw', 'ese'] },
    ],
    small: [
      { rows: ['m'], mask: ['s'] },
      { rows: ['n'], mask: ['w'] },
      { rows: ['^'], mask: ['w'] },
    ],
  },
}
const MOTIFS: Record<Head['species'], { tiny: Motif; small: Motif }> = {
  poppy: {
    tiny: { rows: ['(@)'], mask: ['ldl'], cy: 0 },
    small: { rows: [' .-. ', '(*@*)'], mask: [' lll ', 'lpdpl'], cy: 1 },
  },
  cosmos: {
    tiny: { rows: ['*o*'], mask: ['pdp'], cy: 0 },
    small: {
      rows: ['\\|/', '-o-', '/|\\'],
      mask: ['ppp', 'pdp', 'ppp'],
      cy: 1,
    },
  },
}

/**
 * Turns the raster into type. Per cell it reads coverage, mean colour and material; picks a
 * glyph from that material's ramp by brightness, or a line glyph along the local stroke
 * direction for thin things; and draws everything sorted by colour so fillStyle changes stay
 * few. Petals print as outline and seams in contrasting ink over a tile of their own colour.
 */
export class AsciiRenderer {
  private canvas: HTMLCanvasElement
  private gl: Compositor
  cw = 9
  ch = 12
  cols = 0
  rows = 0
  private dpr = 1
  private cov = new Float32Array(0)
  private kinds = new Uint8Array(0)
  /** The raster version last sampled into the cell arrays. */
  private sampled = -1
  private rgb = new Float32Array(0)
  private glyph = new Uint16Array(0)
  private out = new Float32Array(0)
  private tile = new Float32Array(0)
  /** Colour of each cell's tile, kept apart from its glyph's ink. */
  private tileCol = new Float32Array(0)
  /** Per petal cell, from the raster's meta layer: petal id, light 0..1, back-facing. */
  private pid = new Uint8Array(0)
  private lit = new Float32Array(0)
  private back = new Uint8Array(0)
  /** Motif glyphs stamped over far heads this frame: glyph code, ink, tile alpha. */
  private stamp = new Uint16Array(0)
  /** Cells under a nearer, fully drawn head, which a far head's motif must not print over. */
  private nearHead = new Uint8Array(0)
  private stampCol = new Float32Array(0)
  private stampTile = new Float32Array(0)
  private stampTileCol = new Float32Array(0)
  /** Cloud noise per cell, refreshed a third of the rows per frame: it drifts a pixel or two a second. */
  private cloudBase = new Float32Array(0)
  private cloudLit = new Float32Array(0)
  private cloudTick = -1
  /** Sky, ridges and mist, painted once per palette and handed to the GPU as the layer under the glyphs. */
  private bg = document.createElement('canvas')
  private bgKey = ''
  /** Per cell for the GPU: ink colour and glyph code; tile colour and alpha. */
  private inkData = new Uint8ClampedArray(0)
  private tileData = new Uint8ClampedArray(0)
  /** Glyph masks at device resolution, white on clear, one slot per glyph. */
  private atlas = {
    canvas: document.createElement('canvas'),
    slotW: 1,
    slotH: 1,
    glyphs: 0,
  }
  /** 1 where the garden shows fully, down to a floor under the hero text. shows fully, down to a floor under the hero text. */
  dim = new Float32Array(0)
  /** Distance into the scene, 1 in the middle and 0 at the edges: the order the veil covers it in. */
  private frame = new Float32Array(0)
  private veilData = new Uint8ClampedArray(0)
  private veilKey = ''
  private font: string

  /** `font` is the glyph face's CSS family list. */
  constructor(
    canvas: HTMLCanvasElement,
    font = 'ui-monospace, Menlo, monospace',
  ) {
    this.canvas = canvas
    this.font = font
    this.gl = createCompositor(canvas)
  }

  /** `cell` is the cell width in px; 0 sizes it to the window. */
  resize(width: number, height: number, dpr: number, cell: number) {
    this.dpr = dpr
    this.cw = clamp(Math.round(cell || width / 170), 5, 16)
    this.ch = Math.round(this.cw * 1.32)
    this.cols = Math.ceil(width / this.cw)
    this.rows = Math.ceil(height / this.ch)
    this.canvas.width = Math.round(width * dpr)
    this.canvas.height = Math.round(height * dpr)
    const n = this.cols * this.rows
    this.cov = new Float32Array(n)
    this.kinds = new Uint8Array(n)
    this.sampled = -1
    this.rgb = new Float32Array(n * 3)
    this.glyph = new Uint16Array(n)
    this.out = new Float32Array(n * 3)
    this.tile = new Float32Array(n)
    this.tileCol = new Float32Array(n * 3)
    this.pid = new Uint8Array(n)
    this.lit = new Float32Array(n)
    this.back = new Uint8Array(n)
    this.stamp = new Uint16Array(n)
    this.nearHead = new Uint8Array(n)
    this.stampCol = new Float32Array(n * 3)
    this.stampTile = new Float32Array(n)
    this.stampTileCol = new Float32Array(n * 3)
    this.cloudBase = new Float32Array(n)
    this.cloudLit = new Float32Array(n)
    this.cloudTick = -1
    this.bg.width = this.canvas.width
    this.bg.height = this.canvas.height
    this.bgKey = ''
    this.inkData = new Uint8ClampedArray(n * 4)
    this.tileData = new Uint8ClampedArray(n * 4)
    this.gl.resize(this.cols, this.rows, this.cw * dpr, this.ch * dpr)
    if (
      this.atlas.slotW !== Math.ceil(this.cw * dpr) ||
      this.atlas.slotH !== Math.ceil(this.ch * dpr) ||
      !this.atlas.glyphs
    )
      this.resetAtlas()
    this.dim = new Float32Array(n).fill(1)
    this.frame = new Float32Array(n)
    // Long soft bands in from each edge, deepest at the bottom; a product of the edges rounds the corners.
    const fw = 0.26 * width
    const ft = 0.24 * height
    for (let r = 0; r < this.rows; r++) {
      const y = r * this.ch + this.ch / 2
      const fy =
        smoothstep(0, ft, y) *
        smoothstep(0.14 * height, 0.5 * height, height - y)
      for (let c = 0; c < this.cols; c++) {
        const x = c * this.cw + this.cw / 2
        this.frame[r * this.cols + c] =
          fy * smoothstep(0, fw, x) * smoothstep(0, fw, width - x)
      }
    }
    this.veilData = new Uint8ClampedArray(n * 4)
    this.veilKey = ''
  }

  /** The page colour laid over the scene as the veil comes down, edges first; one pixel per cell. */
  private paintVeil(page: Rgb, veil: number) {
    const key = page.map((v) => v | 0).join(',') + '/' + veil.toFixed(3)
    if (key === this.veilKey) return
    this.veilKey = key
    const d = this.veilData
    for (let i = 0; i < this.frame.length; i++) {
      d[i * 4] = page[0]
      d[i * 4 + 1] = page[1]
      d[i * 4 + 2] = page[2]
      d[i * 4 + 3] = clamp(2 * veil - this.frame[i], 0, 1) * 255
    }
  }

  setDimBoxes(boxes: Rect[]) {
    const { cols, rows, cw, ch, dim } = this
    dim.fill(1)
    // A wide, gentle fade: the garden recedes behind the text rather than stopping at a box.
    const pad = cw * 14
    for (const b of boxes) {
      const c0 = Math.max(0, Math.floor((b.left - pad) / cw))
      const c1 = Math.min(cols - 1, Math.floor((b.right + pad) / cw))
      const r0 = Math.max(0, Math.floor((b.top - pad) / ch))
      const r1 = Math.min(rows - 1, Math.floor((b.bottom + pad) / ch))
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const x = c * cw + cw / 2
          const y = r * ch + ch / 2
          const d = Math.hypot(
            Math.max(b.left - x, 0, x - b.right),
            Math.max(b.top - y, 0, y - b.bottom),
          )
          const i = r * cols + c
          dim[i] = Math.min(dim[i], 0.22 + 0.78 * smoothstep(0, pad, d))
        }
      }
    }
  }

  /**
   * Reduce the raster to per-cell coverage, colour and material. A plant material that covers
   * a quarter of the cell wins it over the land behind, so thin stems and blades survive, and
   * the cell then takes its colour and coverage from that material alone.
   */
  private sample(raster: Raster) {
    const { cols, rows, cov, kinds, rgb } = this
    const W = raster.width
    const cd = raster.colorData
    const kd = raster.kindData
    const md = raster.metaData
    const { pid, lit, back } = this
    const n = SS * SS
    const weight = new Float32Array(8)
    const kr = new Float32Array(8)
    const kg = new Float32Array(8)
    const kb = new Float32Array(8)
    const ids = new Int32Array(SS * SS)
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
          kinds[i] = Kind.Empty
          cov[i] = 0
          pid[i] = 0
          continue
        }
        for (let k = 0; k < 8; k++) {
          weight[k] = 0
          kr[k] = 0
          kg[k] = 0
          kb[k] = 0
        }
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
          let o = ((r * SS + sy) * W + c * SS) * 4
          for (let sx = 0; sx < SS; sx++, o += 4) {
            const al = cd[o + 3]
            a += al
            const kal = kd[o + 3]
            if (kal === 0) continue
            const k =
              (kd[o] > 127 ? 4 : 0) |
              (kd[o + 1] > 127 ? 2 : 0) |
              (kd[o + 2] > 127 ? 1 : 0)
            weight[k] += kal
            if (k === Kind.Petal && md[o + 3] > 0) {
              // Petal identity by vote, since antialiased seams blend two ids; light and facing averaged.
              if (kal > 200) ids[nIds++] = Math.round(md[o] / 24)
              li += md[o + 1]
              bk += md[o + 2]
              pn++
            } else if ((k === Kind.Land || k === Kind.Fluff) && md[o + 3] > 0) {
              ll += md[o + 1]
              lb += md[o + 2]
              ln++
            }
            kr[k] += cd[o] * al
            kg[k] += cd[o + 1] * al
            kb[k] += cd[o + 2] * al
          }
        }
        let best = Kind.Empty as number
        for (const k of PLANT_KINDS) if (weight[k] > weight[best]) best = k
        if (weight[best] < 0.25 * 255 * n) {
          best = Kind.Empty
          for (let k = 1; k < 8; k++) if (weight[k] > weight[best]) best = k
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
        // A cell split between petals has no clear owner and gets no seam.
        pid[i] = votes * 2 > nIds ? id : 0
        lit[i] = pn ? li / (pn * 255) : ln ? ll / (ln * 255) : 0.5
        back[i] = pn ? +(bk / pn > 127) : ln ? +(lb / ln > 127) : 0
        const plant = (PLANT_MASK >> best) & 1
        cov[i] = (plant ? weight[best] : a) / (255 * n)
        let cr = 0
        let cg = 0
        let cb = 0
        for (let k = 0; k < 8; k++) {
          if (plant && k !== best) continue
          cr += kr[k]
          cg += kg[k]
          cb += kb[k]
        }
        // Colour sums are weighted by alpha, so divide by the alpha they were drawn with.
        const norm = plant ? weight[best] : a
        if (norm > 0) {
          rgb[i * 3] = cr / norm
          rgb[i * 3 + 1] = cg / norm
          rgb[i * 3 + 2] = cb / norm
        }
      }
    }
  }

  /** Direction of the stroke through a cell, from second moments of coverage around it. */
  private lineAt(c: number, r: number, kind: number) {
    const { cols, rows, cov, kinds, cw, ch } = this
    let mxx = 0
    let myy = 0
    let mxy = 0
    let m = 0
    for (let dy = -1; dy <= 1; dy++) {
      const rr = r + dy
      if (rr < 0 || rr >= rows) continue
      for (let dx = -1; dx <= 1; dx++) {
        const cc = c + dx
        if (cc < 0 || cc >= cols) continue
        const j = rr * cols + cc
        if (kinds[j] !== kind) continue
        const w = cov[j]
        const x = dx * cw
        const y = dy * ch
        mxx += w * x * x
        myy += w * y * y
        mxy += w * x * y
        m += w
      }
    }
    if (m <= 0) return -1
    const diff = mxx - myy
    const aniso = Math.sqrt(diff * diff + 4 * mxy * mxy) / (mxx + myy + 1e-6)
    if (aniso < 0.38) return -1
    // Principal axis angle in screen space (y down), folded to 0..π.
    let a = 0.5 * Math.atan2(2 * mxy, diff)
    if (a < 0) a += Math.PI
    return Math.round(a / (Math.PI / 4)) % 4
  }

  /** Petal cover around a cell; discs count as petal so the centre isn't read as an edge. */
  private petal(c: number, r: number) {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return 0
    const i = r * this.cols + c
    const k = this.kinds[i]
    return k === Kind.Petal || k === Kind.Disc ? this.cov[i] : 0
  }

  private stemCov(c: number, r: number) {
    if (c < 0 || c >= this.cols) return 0
    const i = r * this.cols + c
    return this.kinds[i] === Kind.Stem ? this.cov[i] : 0
  }

  /** Petal id at a cell, 0 off petals. */
  private pidAt(c: number, r: number) {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return 0
    const i = r * this.cols + c
    return this.kinds[i] === Kind.Petal ? this.pid[i] : 0
  }

  /**
   * Line glyph for a seam between two petals of a head, or -1. A seam prints on its darker side
   * only, so it stays one cell wide.
   */
  private petalSeam(c: number, r: number) {
    const i = r * this.cols + c
    const me = this.pid[i]
    if (!me) return -1
    const mine = this.lit[i]
    // Only big heads have room for seams; on smaller ones they turn the head into a tangle.
    if (this.cov[i] < 0.7 || this.headCells(c, r) < 26) return -1
    const checks: [number, number, number][] = [
      [-1, 0, 2],
      [1, 0, 2],
      [0, -1, 0],
      [0, 1, 0],
    ]
    for (const [dx, dy, line] of checks) {
      const other = this.pidAt(c + dx, r + dy)
      if (other && this.cov[(r + dy) * this.cols + c + dx] < 0.7) continue
      if (!other || other === me) continue
      const theirs = this.lit[(r + dy) * this.cols + c + dx]
      if (theirs > mine || (theirs === mine && other > me)) return line
    }
    return -1
  }

  /** Clears far heads' sampled cells and lays their motif in, ink chosen against what's behind. */
  private stampHeads(
    heads: Head[],
    p: Palette,
    inkAt: (x: number, y: number) => { ink: Rgb; dark: boolean },
  ) {
    const { cols, rows, cw, ch, kinds, stamp, stampCol, stampTile, nearHead } =
      this
    stamp.fill(0)
    // Heads big enough to draw in full are nearer than any motif, so mark what they cover first.
    nearHead.fill(0)
    for (const h of heads) {
      if ((2 * h.r) / cw < 5.5) continue
      const cc = h.x / cw
      const rr = h.y / ch
      const rx = h.r / cw
      const ry = h.r / ch
      for (
        let r = Math.max(0, Math.floor(rr - ry));
        r <= Math.min(rows - 1, Math.ceil(rr + ry));
        r++
      )
        for (
          let c = Math.max(0, Math.floor(cc - rx));
          c <= Math.min(cols - 1, Math.ceil(cc + rx));
          c++
        )
          if (((c + 0.5 - cc) / rx) ** 2 + ((r + 0.5 - rr) / ry) ** 2 <= 1)
            nearHead[r * cols + c] = 1
    }
    for (const h of heads) {
      const across = (2 * h.r) / cw
      if (across >= 5.5 || h.alpha < 0.3) continue
      const motif = MOTIFS[h.species][across < 3 ? 'tiny' : 'small']
      const cc = Math.floor(h.x / cw)
      const rr = Math.floor(h.y / ch)
      const rx = Math.ceil(h.r / cw) + 1
      const ry = Math.ceil(h.r / ch) + 1
      for (let r = Math.max(0, rr - ry); r <= Math.min(rows - 1, rr + ry); r++)
        for (
          let c = Math.max(0, cc - rx);
          c <= Math.min(cols - 1, cc + rx);
          c++
        ) {
          const i = r * cols + c
          if (
            !nearHead[i] &&
            (kinds[i] === Kind.Petal || kinds[i] === Kind.Disc)
          )
            kinds[i] = Kind.Empty
        }
      const { ink } = inkAt(h.x, h.y)
      motif.rows.forEach((row, j) => {
        const r = rr - motif.cy + j
        if (r < 0 || r >= rows) return
        for (let t = 0; t < row.length; t++) {
          const c = cc - (row.length >> 1) + t
          const m = motif.mask[j][t]
          if (c < 0 || c >= cols || m === ' ') continue
          const i = r * cols + c
          if (nearHead[i]) continue
          stamp[i] = code(row[t])
          const col =
            m === 'd'
              ? lum(h.disc[0], h.disc[1], h.disc[2]) < 0.35
                ? mix(h.disc, p.ground, 0.5)
                : h.disc
              : m === 'l'
                ? mix(h.petal, ink, 0.5 * (1 - 0.5 * p.night))
                : mix(h.petal, ink, 0.15)
          stampCol[i * 3] = col[0]
          stampCol[i * 3 + 1] = col[1]
          stampCol[i * 3 + 2] = col[2]
          // Glyphs only: a tile in the petal colour swallowed them into a pale box.
          stampTile[i] = 0
        }
      })
    }
  }

  /**
   * Butterflies and moths, over whatever they're sitting on. Each cell takes a tile and an ink
   * from its role in the figure, so the wing's ground, pattern and margin each print in their
   * own colour; the body alone sits straight on the scene in ink that holds against it.
   */
  private stampSprites(
    sprites: Sprite[],
    inkAt: (x: number, y: number) => { ink: Rgb; dark: boolean },
  ) {
    const { cols, rows, cw, ch, stamp, stampCol, stampTile, stampTileCol } =
      this
    for (const s of sprites) {
      // As big as its flower's depth allows: a visitor on the horizon prints as one glyph.
      const cells = s.span / cw
      const set =
        INSECTS[s.moth ? 'moth' : 'butterfly'][
          cells >= 5.5 ? 'big' : cells >= 3.5 ? 'mid' : 'small'
        ]
      const f = set[Math.min(2, s.pose)]
      const cc = Math.floor(s.x / cw)
      const rr = Math.floor(s.y / ch)
      const { ink } = inkAt(s.x, s.y)
      const { base, pattern, edge } = s.look
      const body = mix(s.look.body, ink, 0.2)
      // Tile and ink per role. Veins are the margin colour thinned toward the ground so they
      // texture the wing rather than cut it up.
      const vein = mix(edge, base, 0.35)
      const roles: Record<string, [Rgb | null, Rgb]> = {
        w: [base, vein],
        s: [base, pattern],
        p: [pattern, edge],
        e: [edge, pattern],
        b: [null, body],
      }
      f.rows.forEach((row, j) => {
        const r = rr - (f.rows.length - 1) + j
        if (r < 0 || r >= rows) return
        for (let t = 0; t < row.length; t++) {
          const role = roles[f.mask[j][t]]
          const c = cc - (row.length >> 1) + t
          if (!role || c < 0 || c >= cols) continue
          const i = r * cols + c
          const [tile, col] = role
          stamp[i] = code(row[t])
          stampCol.set(col, i * 3)
          if (tile) {
            // The tile key packs 5 bits a channel straight from these values, so keep them in range.
            stampTileCol[i * 3] = Math.min(255, tile[0])
            stampTileCol[i * 3 + 1] = Math.min(255, tile[1])
            stampTileCol[i * 3 + 2] = Math.min(255, tile[2])
          }
          stampTile[i] = tile ? 0.85 : 0
        }
      })
    }
  }

  /** How many petal or disc cells sit around this one: small for far, few-cell heads. */
  private headCells(c: number, r: number) {
    let n = 0
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -3; dx <= 3; dx++) if (this.petal(c + dx, r + dy) > 0) n++
    return n
  }

  /**
   * Line glyph tracing the petal's outline through this cell, or -1 inside the flower. Edges
   * print as strokes so each head reads by its silhouette, not as a blot of colour.
   */
  private petalEdge(c: number, r: number) {
    const l = this.petal(c - 1, r)
    const rt = this.petal(c + 1, r)
    const u = this.petal(c, r - 1)
    const d = this.petal(c, r + 1)
    if (Math.min(l, rt, u, d) > 0.2) return -1
    const gx = (rt - l) / this.cw
    const gy = (d - u) / this.ch
    if (gx === 0 && gy === 0) return -1
    // The outline runs at right angles to the cover gradient.
    let a = Math.atan2(gy, gx) + Math.PI / 2
    a = ((a % Math.PI) + Math.PI) % Math.PI
    return Math.round(a / (Math.PI / 4)) % 4
  }

  /** Draws every glyph once, white on clear, at the cell's device size, and hands the sheet to the GPU. */
  private resetAtlas() {
    const a = this.atlas
    a.slotW = Math.ceil(this.cw * this.dpr)
    a.slotH = Math.ceil(this.ch * this.dpr)
    a.glyphs = GLYPHS.length
    const across = Math.floor(2048 / a.slotW)
    a.canvas.width = across * a.slotW
    a.canvas.height = Math.ceil(a.glyphs / across) * a.slotH
    const actx = a.canvas.getContext('2d')
    if (!actx) return
    actx.font = `500 ${Math.round(this.ch * 0.78) * this.dpr}px ${this.font}`
    actx.textAlign = 'center'
    actx.textBaseline = 'middle'
    actx.fillStyle = '#fff'
    for (let g = 1; g < a.glyphs; g++) {
      const x = (g % across) * a.slotW
      const y = Math.floor(g / across) * a.slotH
      actx.save()
      actx.beginPath()
      actx.rect(x, y, a.slotW, a.slotH)
      actx.clip()
      actx.fillText(
        GLYPHS[g],
        x + a.slotW / 2,
        y + a.slotH / 2 + 0.5 * this.dpr,
      )
      actx.restore()
    }
    this.gl.setAtlas({
      canvas: a.canvas,
      slotW: a.slotW,
      slotH: a.slotH,
      across,
      glyphs: GLYPHS,
      font: actx.font,
    })
  }

  /** Redraws every sprite once the glyph font has loaded, so none keep the fallback face. */
  fontsReady() {
    this.resetAtlas()
    this.bgKey = ''
  }

  render(input: FrameInput) {
    const { raster, palette: p, time, horizon, page, veil, pointer } = input
    if (veil >= 1) {
      // Another page: nothing but the page colour.
      this.gl.clear(page)
      return
    }
    // Between worker replies the raster holds the same frame; sampling it again changes nothing.
    if (raster.version !== this.sampled) {
      this.sample(raster)
      this.sampled = raster.version
    }
    const { cols, rows, cw, ch, cov, kinds, rgb, glyph, out, tile, dim } = this
    const W = cols * cw
    const H = rows * ch

    // The backdrop is repainted and re-uploaded only when its colours or shapes change.
    const bgKey =
      [p.skyTop, p.skyHorizon, p.hillNear, p.hillFar, p.ground, p.haze]
        .map(rgbCss)
        .join() +
      horizon +
      (input.backdropKey ?? '')
    if (bgKey !== this.bgKey) {
      this.bgKey = bgKey
      const bctx = this.bg.getContext('2d')
      if (bctx) {
        bctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
        // Slate sky to mist at the horizon, then the dark meadow floor.
        const sky = bctx.createLinearGradient(0, 0, 0, H)
        const hz = horizon / H
        sky.addColorStop(0, rgbCss(p.skyTop))
        sky.addColorStop(Math.max(0.01, hz - 0.02), rgbCss(p.skyHorizon))
        sky.addColorStop(
          Math.min(0.99, hz + 0.08),
          rgbCss(mix(p.hillNear, p.ground, 0.5)),
        )
        // The floor lifts a touch toward the sky's colour, so the foreground isn't a void.
        sky.addColorStop(1, rgbCss(mix(p.ground, p.skyHorizon, 0.08)))
        bctx.fillStyle = sky
        bctx.fillRect(0, 0, W, H)
        input.backdrop?.(bctx)
        this.gl.setBackground(this.bg)
      }
    }

    // What a glyph sits on, for picking ink that contrasts: the row's sky or ground, or the
    // painted ridge where one rises behind it. Dark ink on bright skies by day, cream otherwise.
    const rowBg = (y: number): Rgb =>
      y < horizon
        ? mix(p.skyTop, p.skyHorizon, clamp(y / Math.max(1, horizon), 0, 1))
        : mix(
            mix(p.hillNear, p.ground, 0.5),
            mix(p.ground, p.skyHorizon, 0.08),
            clamp((y - horizon) / (H - horizon), 0, 1),
          )
    const hillCol = mix(p.hillFar, p.skyHorizon, 0.35)
    const cream: Rgb = [255, 250, 240]
    const inkAt = (x: number, y: number) => {
      const b =
        y < horizon && input.hillTop && y >= input.hillTop(x)
          ? hillCol
          : rowBg(y)
      const dark = lum(b[0], b[1], b[2]) > 0.42 && p.night < 0.5
      return { ink: dark ? p.ground : cream, dark }
    }
    this.stampHeads(raster.drawnHeads, p, inkAt)
    this.stampSprites(raster.drawnSprites, inkAt)
    const { stamp, stampCol, stampTile, tileCol } = this

    // The halftone screen keeps roughly the same spacing in pixels, so fine grids don't fill with dots.
    const pitch = this.cw < 8 ? 8 : 4
    const cloudT = time * 0.012
    // Until every row has been filled once, refresh them all.
    const tick = this.cloudTick < 0 ? -1 : this.cloudTick % 3
    this.cloudTick++
    const stars = p.night
    const lightR = 120
    for (let r = 0; r < rows; r++) {
      const y = r * ch + ch / 2
      const skyRow = y < horizon
      // Background colour at this row, for mixing glyphs toward.
      const bg = rowBg(y)
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c
        const x = c * cw + cw / 2
        let g = 0
        let cr = 0
        let cg = 0
        let cb = 0
        let alpha = 0
        tile[i] = 0
        const k = kinds[i]
        const v = cov[i]
        if (stamp[i]) {
          g = stamp[i]
          cr = stampCol[i * 3]
          cg = stampCol[i * 3 + 1]
          cb = stampCol[i * 3 + 2]
          alpha = 1
          tile[i] = stampTile[i]
          tileCol[i * 3] = this.stampTileCol[i * 3]
          tileCol[i * 3 + 1] = this.stampTileCol[i * 3 + 1]
          tileCol[i * 3 + 2] = this.stampTileCol[i * 3 + 2]
        } else if (v > 0.07 && k !== Kind.Empty) {
          cr = rgb[i * 3]
          cg = rgb[i * 3 + 1]
          cb = rgb[i * 3 + 2]
          // The tile keeps the material's own colour; the cases below may move the glyph's ink.
          tileCol[i * 3] = cr * p.ink
          tileCol[i * 3 + 1] = cg * p.ink
          tileCol[i * 3 + 2] = cb * p.ink
          const { ink, dark: darkInk } =
            k === Kind.Petal ? inkAt(x, y) : { ink: cream, dark: false }
          const L = lum(cr, cg, cb)
          alpha = clamp(v * 1.6, 0.25, 1)
          switch (k) {
            case Kind.Petal: {
              // The tile carries the body in the petal's own colour, under every petal cell so lines
              // don't punch holes in the head; outline cells take a little less so the edge stays soft.
              const lit = this.lit[i]
              // After dark cream ink glows against the dim petals; pull it back toward the petal's own colour.
              const reach = darkInk ? 1 : 1 - 0.5 * p.night
              // Mostly opaque, so what's behind (a hill's edge, the sky) doesn't show through
              // the head as a line across it. The light is in the tile's colour instead: lit
              // folds brighter, shaded and back-facing ones darker, so the petals read apart.
              const body = darkInk ? 0.75 + 0.1 * lit : 0.7 + 0.15 * lit
              // Shallower after dark, where the flowers are the brightest thing in the scene.
              const shadeBy =
                0.62 +
                0.25 * p.night +
                (0.55 - 0.2 * p.night) * lit -
                0.12 * this.back[i]
              tileCol[i * 3] = Math.min(255, tileCol[i * 3] * shadeBy)
              tileCol[i * 3 + 1] = Math.min(255, tileCol[i * 3 + 1] * shadeBy)
              tileCol[i * 3 + 2] = Math.min(255, tileCol[i * 3 + 2] * shadeBy)
              // Lines carry the drawing: the head's outline and the seams between its petals, in ink
              // that contrasts with what's behind.
              // On a head only a few cells across nearly every cell touches the edge; keep lines for
              // the cells the petal only partly covers, the true rim, and fill the rest.
              const rim = this.petalEdge(c, r)
              const edge =
                rim >= 0 && v >= 0.7 && this.headCells(c, r) < 22 ? -1 : rim
              const line = edge >= 0 ? edge : this.petalSeam(c, r)
              if (line >= 0) {
                g = code(LINES[line])
                alpha = 1
                tile[i] = body * (edge >= 0 ? 0.7 : 1) * Math.min(1, v * 1.4)
                ;[cr, cg, cb] = mix([cr, cg, cb], ink, 0.7 * reach)
                break
              }
              // Glyph density carries light: dense where the ink should read (shadow on a bright
              // sky, light on a dark ground).
              const amp = clamp((this.headCells(c, r) - 10) / 30, 0, 0.35)
              const dens = clamp(
                (darkInk ? 1 - lit : lit) +
                  0.3 * this.back[i] +
                  amp * (bayer(c, r) - 0.5),
                0,
                0.999,
              )
              g = code(PETAL[1 + Math.floor(dens * (PETAL.length - 1))])
              alpha = 1
              tile[i] = body
              ;[cr, cg, cb] = mix([cr, cg, cb], ink, 0.4 * reach)
              break
            }
            case Kind.Disc: {
              // The centre is the heaviest ink in the head: a dark eye, or a bright disc on its own tile.
              if (L < 0.35) {
                g = code(v > 0.6 ? '@' : '#')
                alpha = 1
                // On a tile of its own colour lifted toward the haze, so a dark centre (a poppy's
                // green stigma) reads solid rather than as a hole, without going near-black.
                const lift = mix([cr, cg, cb], p.haze, 0.4)
                tileCol[i * 3] = lift[0] * p.ink
                tileCol[i * 3 + 1] = lift[1] * p.ink
                tileCol[i * 3 + 2] = lift[2] * p.ink
                tile[i] = 0.75 * Math.min(1, v * 1.4)
                ;[cr, cg, cb] = mix([cr, cg, cb], p.ground, 0.5)
              } else if (
                this.petal(c - 1, r) +
                  this.petal(c + 1, r) +
                  this.petal(c, r - 1) +
                  this.petal(c, r + 1) >
                0
              ) {
                g = code(v > 0.6 ? 'O' : 'o')
                alpha = 1
                tile[i] = 0.75
                ;[cr, cg, cb] = shade([cr, cg, cb], 0.7)
              } else {
                const d = clamp(0.35 + v * 0.6 - L * 0.3, 0, 1)
                g = code(
                  DISC[
                    Math.min(
                      DISC.length - 1,
                      1 + Math.floor(d * (DISC.length - 1)),
                    )
                  ],
                )
                tile[i] = v * 0.18
              }
              break
            }
            case Kind.Fluff:
              if (this.back[i] && v > 0.8) {
                // A loose petal's inside: sparse light glyphs in its own colour.
                g = code(bayer(c, r) < 0.5 ? '.' : "'")
                alpha = 1
                break
              }
              g = code(
                FLUFF[
                  Math.min(
                    FLUFF.length - 1,
                    1 + Math.floor(clamp(v * 1.2, 0, 1) * (FLUFF.length - 2)),
                  )
                ],
              )
              alpha = clamp(v * 2.2, 0.35, 1)
              if (this.lit[i] > 0.75) {
                // Lace and seed heads get a soft body in their own colour, with the glyphs inked
                // against it, so a pale head holds against a pale hill. The sun and moon stay bare.
                tile[i] = 0.25 + 0.35 * Math.min(1, v)
                ;[cr, cg, cb] = mix([cr, cg, cb], inkAt(x, y).ink, 0.45)
                alpha = 1
              }
              break
            case Kind.Stem:
            case Kind.Sky: {
              const dir = this.lineAt(c, r, k)
              // A stalk straddling two cells prints once, in the stronger one.
              if (
                k === Kind.Stem &&
                dir !== 0 &&
                (this.stemCov(c - 1, r) > v || this.stemCov(c + 1, r) >= v)
              )
                break
              if (v < 0.1) g = code(k === Kind.Sky ? '·' : '.')
              else if (dir >= 0) g = code(LINES[dir])
              else g = code(v > 0.5 ? '+' : ':')
              // Stalks hold a firm floor so a flower reads down to its root; grass is a separate kind.
              alpha = clamp(v * 3.5, 0.55, 1)
              if (k === Kind.Stem && p.night > 0) {
                // Night stem colours sit almost on the ground; lift them toward the moonlit haze.
                const sc = mix(
                  [cr, cg, cb],
                  mix(p.haze, cream, 0.3),
                  0.45 * p.night,
                )
                cr = sc[0]
                cg = sc[1]
                cb = sc[2]
              }
              break
            }
            case Kind.Foliage: {
              // Blades print as strokes along their run; only broad leaf cells fall back to the fill ramp.
              const dir = this.lineAt(c, r, k)
              if (dir > 0) g = code(LINES[dir])
              else {
                const d = clamp(v * 0.55 + L * 0.7, 0, 1)
                g = code(
                  FOLIAGE[
                    Math.min(
                      FOLIAGE.length - 1,
                      1 + Math.floor(d * (FOLIAGE.length - 1)),
                    )
                  ],
                )
              }
              // Grass is texture, not subject: a little quieter than the flowers, and holding its
              // strength toward the viewer so near tufts read as grass rather than static.
              // Thin blades only partly cover a cell, so give their strokes a floor like stalks have.
              if (dir > 0) alpha = Math.max(alpha, clamp(v * 3, 0.95, 1))
              alpha *= 1 - 0.08 * clamp((y - horizon) / (H - horizon), 0, 1)
              break
            }
            case Kind.Land: {
              // Halftone: ordered dither on brightness, like the cloud and grass studies.
              // The silhouette itself is painted in the backdrop; these are its halftone dots.
              const d = L * 1.3 + (skyRow ? 0.1 : -0.15)
              if (d > bayer(c, r) * 1.1)
                g = code(LAND[1 + Math.min(2, Math.floor(d * 2.2))])
              const lc = mix([cr, cg, cb], p.cloud, skyRow ? 0.28 : 0.12)
              cr = lc[0]
              cg = lc[1]
              cb = lc[2]
              alpha = skyRow ? 0.6 : 0.45
              // Slope light, in glyphs alone: the sunward side thickens toward the crest and the far
              // side goes bare, so the contrast is all in the lit flank.
              const sl = (this.lit[i] - 0.5) * 2
              if (sl > 0.05) {
                if (sl > bayer(c, r) * 0.9)
                  g = code(
                    SLOPE_LIT[
                      Math.min(
                        SLOPE_LIT.length - 1,
                        Math.floor(sl * SLOPE_LIT.length),
                      )
                    ],
                  )
                alpha = 0.45 + 0.25 * sl
              } else if (sl < -0.05 && -sl > bayer(c, r)) g = 0
              break
            }
          }
        } else if (skyRow) {
          // Sky: drifting cumulus as dithered halftone, stars at night.
          if (tick < 0 || r % 3 === tick) {
            const nx = x / 280 - cloudT
            const ny = y / 120
            const base = fbm2(nx, ny, 5, 4)
            this.cloudBase[i] = base
            // Lit from above: brighter where the cloud thins below. Only clouds need it.
            this.cloudLit[i] =
              base > 0.5
                ? clamp(0.55 + (base - fbm2(nx, ny + 0.25, 5, 4)) * 4, 0.2, 1)
                : 0
          }
          const base = this.cloudBase[i]
          const shape =
            smoothstep(0.5, 0.74, base) * (1 - smoothstep(0.55, 1, y / horizon))
          if (shape > 0.02) {
            const lit = this.cloudLit[i]
            const d = shape * lit
            if (d > bayer(c, r) * 0.9) {
              g = code(
                CLOUD[
                  Math.min(
                    CLOUD.length - 1,
                    1 + Math.floor(d * (CLOUD.length - 1)),
                  )
                ],
              )
              const cc = mix(bg, p.cloud, 0.35 + 0.65 * lit)
              cr = cc[0]
              cg = cc[1]
              cb = cc[2]
              alpha = clamp(0.3 + shape, 0, 1)
            }
          } else if (stars > 0.1 && hash(c, r, 77) < 0.006 * stars) {
            const tw = 0.5 + 0.5 * Math.sin(time * (1 + hash(c, r, 5) * 3) + c)
            g = code(hash(c, r, 9) < 0.2 ? '+' : '.')
            cr = 230
            cg = 235
            cb = 255
            alpha = stars * (0.3 + 0.7 * tw)
          } else if ((c + r * 2) % pitch === 0 && r % (pitch / 2) === 0) {
            // The poster's halftone screen over open sky.
            g = code('·')
            const cc = mix(bg, p.cloud, 0.22)
            cr = cc[0]
            cg = cc[1]
            cb = cc[2]
            alpha = 0.55
          }
        }
        glyph[i] = g
        if (g === 0) continue

        // Clamped: the night's ink boost would push bright colours past 255 and corrupt the sprite key.
        let gc: Rgb = [
          Math.min(255, cr * p.ink),
          Math.min(255, cg * p.ink),
          Math.min(255, cb * p.ink),
        ]
        // Near the cursor the garden catches a little more light; much more after dark.
        if (pointer.active) {
          const dd = Math.hypot(x - pointer.x, y - pointer.y)
          if (dd < lightR) {
            const kk = (1 - dd / lightR) ** 2 * (0.18 + 0.55 * p.night)
            gc = mix(gc, [255, 250, 232], kk)
          }
        }
        // Flowers and stems fade less than grass near the text, so plants don't lose their stalks.
        const plant =
          k === Kind.Petal ||
          k === Kind.Disc ||
          k === Kind.Stem ||
          k === Kind.Fluff
        const fade = plant ? Math.sqrt(dim[i]) : dim[i]
        const a = alpha * fade
        // Barely-there glyphs cost a draw each and add nothing.
        if (a < 0.06 && tile[i] <= 0) {
          glyph[i] = 0
          continue
        }
        gc = mix(bg, gc, a)
        out[i * 3] = gc[0]
        out[i * 3 + 1] = gc[1]
        out[i * 3 + 2] = gc[2]
        if (tile[i] > 0) tile[i] *= fade
      }
    }

    // Glyph codes registered since the atlas was drawn (a new motif) need their masks.
    if (GLYPHS.length > this.atlas.glyphs) this.resetAtlas()
    const { inkData, tileData } = this
    for (let i = 0; i < cols * rows; i++) {
      const g = glyph[i]
      const o = i * 4
      inkData[o + 3] = g
      if (!g) {
        tileData[o + 3] = 0
        continue
      }
      inkData[o] = out[i * 3]
      inkData[o + 1] = out[i * 3 + 1]
      inkData[o + 2] = out[i * 3 + 2]
      const t = tile[i]
      tileData[o + 3] = t > 0 ? t * 255 : 0
      if (t > 0) {
        tileData[o] = tileCol[i * 3]
        tileData[o + 1] = tileCol[i * 3 + 1]
        tileData[o + 2] = tileCol[i * 3 + 2]
      }
    }
    if (veil > 0) this.paintVeil(page, veil)
    this.gl.draw(inkData, tileData, veil > 0 ? this.veilData : null)
  }
}

const rgbCss = (c: Rgb) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
