// Shared by the raster workers and the page: turns a frame's cells into type. Per cell it picks
// a glyph from its material's ramp by brightness, or a line glyph along the local stroke for
// thin things, with an ink, an alpha and a tile under it. Far heads and insects print as fixed
// motifs. Kept free of the DOM so it runs where the frame was rasterised.

import { bayer, clamp } from './math'
import { mix, shade, type Palette, type Rgb } from './palette'
import { Kind, LandMat, type Cells } from './rasterize'

import type { Head, Sprite, SpriteKind } from './raster'

// Glyph ramps, sparse to dense, per material.
const PETAL = " .':-=+*x#%@"
const DISC = ' .o0O@#'
const FLUFF = " .'*+x*#"
const FOLIAGE = " .,':;!|"
const LAND = ' .·:'
const SLOPE_LIT = '.·:;'
// Snow's lit flank, densest just under the crest.
const SNOW = '·:;='
export const CLOUD = ' ·.:-=+*o'

// Line glyphs by direction, for stems, blades and the globe's wires.
const LINES = ['-', '\\', '|', '/']
// One glyph per petal flap, by its light: lit, half-lit, turned away, seen from behind.
const FOLD = ['.', ':', '=', '#']

export const GLYPHS: string[] = []
const codeOf = new Map<string, number>()
export function code(ch: string) {
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
  SNOW,
  // Snow's crest outline and shaded flank, and the forest's tips.
  "^_'",
  // The shooting star's tail (meteors.ts), here so main thread and workers agree on its code.
  '@#Oo+:·`',
])
  for (const ch of ramp) code(ch)

export const lum = (r: number, g: number, b: number) =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

// Far heads print as a fixed motif. 'p' petal, 'l' outline, 'd' centre; rows top to bottom.
type Motif = { rows: string[]; mask: string[]; cy: number }

/**
 * Butterflies and moths by wing pose (open from above, half raised, folded over the back),
 * in 7-, 5- and 1-cell widths. The last row sits on the insect's position. Each mask cell is a
 * colour role from the sprite's look: w wing ground with dark veins, s a spot of pattern colour
 * on the ground, p a band of pattern colour, e the dark margin with pale dots, b the body.
 */
type Insect = { rows: string[]; mask: string[] }
type Figures = { big: Insect[]; mid: Insect[]; small: Insect[] }
const INSECTS: Record<SpriteKind, Figures> = {
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
  // The poem's pair and their heart, side views facing right (MeadowVisitors). Two wing-beat
  // frames, then perched.
  ladybug: {
    big: [
      {
        rows: ["\\/o'. ", ' (o.o:', "  ' ' "],
        mask: ['grswr ', ' ssssp', '  b b '],
      },
      {
        rows: [" /o'. ", '~(o.o:', "/ ' ' "],
        mask: [' rswr ', 'gssssp', 'g b b '],
      },
      {
        rows: [" ,o'. ", ' (o.o:', "  ''' "],
        mask: [' rswr ', ' ssssp', '  bbb '],
      },
    ],
    mid: [
      { rows: ['\\o. ', '(o.:'], mask: ['gsr ', 'sssp'] },
      { rows: ['/o. ', '~o.:'], mask: ['rsr ', 'gssp'] },
      { rows: [',o. ', '(o.:'], mask: ['rsr ', 'sssp'] },
    ],
    small: [
      { rows: ['o'], mask: ['s'] },
      { rows: [':'], mask: ['s'] },
      { rows: ['o'], mask: ['s'] },
    ],
  },
  bee: {
    big: [
      {
        rows: ['   \\|/ ', " ,%''%/", '(.%..%o'],
        mask: ['   ggg ', ' rwppwb', 'epwppwp'],
      },
      {
        rows: ['   -=- ', " ,%''%/", '(.%..%o'],
        mask: ['   ggg ', ' rwppwb', 'epwppwp'],
      },
      {
        rows: [' .__,  ', " ,%''%/", '(.%..%o'],
        mask: [' gggg  ', ' rwppwb', 'epwppwp'],
      },
    ],
    mid: [
      { rows: [' \\|/ ', '(.%.o'], mask: [' ggg ', 'epwpp'] },
      { rows: [' -=- ', '(.%.o'], mask: [' ggg ', 'epwpp'] },
      { rows: [' .__ ', '(.%.o'], mask: [' ggg ', 'epwpp'] },
    ],
    small: [
      { rows: ['='], mask: ['s'] },
      { rows: ['#'], mask: ['s'] },
      { rows: ['='], mask: ['s'] },
    ],
  },
  heart: {
    big: [
      {
        rows: [' ,. ,. ', "('...:)", '  \\./  ', '   v   '],
        mask: [' ww ww ', 'wswwwww', '  www  ', '   w   '],
      },
    ],
    mid: [
      {
        rows: ["('v')", ' \\:/ ', '  v  '],
        mask: ['wsrww', ' www ', '  w  '],
      },
    ],
    small: [{ rows: ['<3'], mask: ['ww'] }],
  },
}

/** Glyphs that turn into each other when a side-view figure is flipped to face left. */
const MIRROR: Record<string, string> = Object.fromEntries(
  ['()', '[]', '{}', '<>', '/\\', 'bd', 'pq'].flatMap(([a, b]) => [
    [a, b],
    [b, a],
  ]),
)
const mirrorRow = (row: string) =>
  [...row]
    .reverse()
    .map((ch) => MIRROR[ch] ?? ch)
    .join('')

/** Each figure turned to face left, made once. */
const MIRRORED = new Map<Insect, Insect>(
  Object.values(INSECTS).flatMap((set) =>
    Object.values(set).flatMap((figs: Insect[]) =>
      figs.map((f): [Insect, Insect] => [
        f,
        {
          rows: f.rows.map(mirrorRow),
          mask: f.mask.map((m) => [...m].reverse().join('')),
        },
      ]),
    ),
  ),
)

export type FigureSize = 'big' | 'mid' | 'small'

/** Seconds a figure takes to change size. */
const SWAP = 0.4
const RANK: Record<FigureSize, number> = { small: 0, mid: 1, big: 2 }

/** A figure's size as shown: while it changes, the size it came from and how far along, 0 to 1. */
export type Shown = { size: FigureSize; from: FigureSize | null; k: number }

/** Moves a shown size toward `size`; a change starts a swap from the size it was. */
export function showSize(s: Shown, size: FigureSize, dt: number) {
  if (size !== s.size) {
    // Turned back mid-swap: run back from where it got to.
    if (size === s.from) {
      s.from = s.size
      s.k = 1 - s.k
    } else {
      s.from = s.size
      s.k = 0
    }
    s.size = size
  }
  if (!s.from) return
  s.k += dt / SWAP
  if (s.k >= 1) {
    s.from = null
    s.k = 1
  }
}

/**
 * Pushes a sprite at its shown size. Mid-swap the smaller figure prints whole and the larger
 * rings it, its outer cells fading in as it grows or out as it shrinks, so the step between
 * sizes eases over instead of jumping.
 */
export function pushShown(out: Sprite[], sprite: Sprite, s: Shown) {
  if (!s.from) {
    out.push({ ...sprite, size: s.size })
    return
  }
  const [small, large] =
    RANK[s.size] < RANK[s.from] ? [s.size, s.from] : [s.from, s.size]
  const k = s.k * s.k * (3 - 2 * s.k)
  out.push({ ...sprite, size: small })
  out.push({
    ...sprite,
    size: large,
    fade: large === s.size ? k : 1 - k,
    under: true,
  })
}

/** Cells across and down each kind's figures print at each size. */
const EXTENT = Object.fromEntries(
  Object.entries(INSECTS).map(([kind, set]) => [
    kind,
    Object.fromEntries(
      Object.entries(set).map(([size, figs]) => [
        size,
        {
          cols: Math.max(...figs[0].rows.map((r) => r.length)),
          rows: figs[0].rows.length,
        },
      ]),
    ),
  ]),
) as Record<SpriteKind, Record<FigureSize, { cols: number; rows: number }>>

/** The size of a kind's figures that fits `cells` across: one is used once there's room for most of it. */
export function sizeFor(kind: SpriteKind, cells: number): FigureSize {
  const e = EXTENT[kind]
  return cells >= e.big.cols - 1.5
    ? 'big'
    : cells >= e.mid.cols - 1.5
      ? 'mid'
      : 'small'
}

/** How many cells across and down a kind's figure prints at a size. */
export const figureSize = (kind: SpriteKind, size: FigureSize) =>
  EXTENT[kind][size]
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

// Every glyph a motif or insect can print, registered up front so the workers and the page
// number glyphs the same way.
for (const set of [
  ...Object.values(MOTIFS).flatMap((m) => [m.tiny, m.small]),
  ...Object.values(INSECTS).flatMap((s) => [...s.big, ...s.mid, ...s.small]),
])
  for (const row of set.rows) for (const ch of row + mirrorRow(row)) code(ch)
for (const ch of FOLD) code(ch)
for (const ch of '@#Oo.+:·') code(ch)

/** A head as the typesetter needs it: no owner, which can't cross to a worker. */
export type HeadMark = Omit<Head, 'owner'>

/** What a frame needs, beyond its cells, to be set in type. */
export type Style = {
  palette: Palette
  horizon: number
  /** Cell size in scene px. */
  cw: number
  ch: number
  /** Top of the painted hills per column, so ink contrasts with a ridge rather than the sky behind it. */
  hill: Float32Array
  /**
   * The far range's faces per cell (Garden.relief): > 0 toward the light, < 0 in shadow. Rock there
   * takes a faint tile, the light's colour at `reliefLit` or the ground's at 8%, and its slope
   * glyphs thicken or thin a little.
   */
  relief: Float32Array
  reliefLight: Rgb
  reliefLit: number
  heads: HeadMark[]
  sprites: Sprite[]
}

/**
 * A frame's plant and land cells, set in type. Alpha and tile come before the fade under the
 * page's text, which the page applies; colours are final, 0..255.
 */
export type Material = {
  glyph: Uint16Array<ArrayBuffer>
  ink: Uint8ClampedArray<ArrayBuffer>
  alpha: Uint8ClampedArray<ArrayBuffer>
  tile: Uint8ClampedArray<ArrayBuffer>
  tileCol: Uint8ClampedArray<ArrayBuffer>
  /** 1 for a material cell (the sky shows through the rest); 2 too for a plant, which fades less under text. */
  flags: Uint8Array<ArrayBuffer>
}

export const MAT = 1
export const PLANT = 2

export class Typesetter {
  private cols = 0
  private rows = 0
  private cw = 5
  private ch = 7
  private cov = new Float32Array(0)
  private kinds = new Uint8Array(0)
  private pid = new Uint8Array(0)
  private lit = new Float32Array(0)
  private back = new Uint8Array(0)
  /** Motif glyphs stamped over far heads and insects this frame: glyph code, ink, tile and its colour. */
  private stamp = new Uint16Array(0)
  /** Cells under a nearer, fully drawn head, which a far head's motif must not print over. */
  private nearHead = new Uint8Array(0)
  private stampCol = new Float32Array(0)
  private stampTile = new Float32Array(0)
  /** How much each stamped cell shows, for a figure fading between sizes. */
  private stampAlpha = new Float32Array(0)
  private stampTileCol = new Float32Array(0)
  /** Working tile alpha and colour, before they're packed. */
  private tile = new Float32Array(0)
  private tileCol = new Float32Array(0)

  run(cells: Cells, style: Style, cols: number, rows: number): Material {
    const n = cols * rows
    this.cols = cols
    this.rows = rows
    this.cw = style.cw
    this.ch = style.ch
    if (this.stamp.length !== n) {
      this.stamp = new Uint16Array(n)
      this.nearHead = new Uint8Array(n)
      this.stampCol = new Float32Array(n * 3)
      this.stampTile = new Float32Array(n)
      this.stampAlpha = new Float32Array(n)
      this.stampTileCol = new Float32Array(n * 3)
      this.tile = new Float32Array(n)
      this.tileCol = new Float32Array(n * 3)
    }
    const { cov, kinds, rgb } = cells
    this.cov = cov
    this.kinds = kinds
    this.pid = cells.pid
    this.lit = cells.lit
    this.back = cells.back
    const out: Material = {
      glyph: new Uint16Array(n),
      ink: new Uint8ClampedArray(n * 3),
      alpha: new Uint8ClampedArray(n),
      tile: new Uint8ClampedArray(n),
      tileCol: new Uint8ClampedArray(n * 3),
      flags: new Uint8Array(n),
    }
    const { palette: p, horizon, hill, relief, reliefLight, reliefLit } = style
    const { cw, ch } = this
    const H = rows * ch

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
      const col = clamp(Math.floor(x / cw), 0, hill.length - 1)
      const b =
        y < horizon && hill.length && y >= hill[col] ? hillCol : rowBg(y)
      const dark = lum(b[0], b[1], b[2]) > 0.42 && p.night < 0.5
      return { ink: dark ? p.ground : cream, dark }
    }
    this.stampHeads(style.heads, p, inkAt)
    this.stampSprites(style.sprites, inkAt)
    const { stamp, stampCol, stampTile, stampTileCol, tile, tileCol } = this

    for (let r = 0; r < rows; r++) {
      const y = r * ch + ch / 2
      const skyRow = y < horizon
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c
        const k = kinds[i]
        const v = cov[i]
        if (!stamp[i] && !(v > 0.07 && k !== Kind.Empty)) continue
        const x = c * cw + cw / 2
        let g = 0
        let cr = 0
        let cg = 0
        let cb = 0
        let alpha = 0
        tile[i] = 0
        if (stamp[i]) {
          g = stamp[i]
          cr = stampCol[i * 3]
          cg = stampCol[i * 3 + 1]
          cb = stampCol[i * 3 + 2]
          alpha = this.stampAlpha[i]
          tile[i] = stampTile[i] * alpha
          tileCol[i * 3] = stampTileCol[i * 3]
          tileCol[i * 3 + 1] = stampTileCol[i * 3 + 1]
          tileCol[i * 3 + 2] = stampTileCol[i * 3 + 2]
        } else {
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
              // The tile is the petal's body, in its own colour, under every petal cell so lines
              // don't punch holes in the head; outline cells take a little less so the edge stays soft.
              const lit = this.lit[i]
              // After dark cream ink glows against the dim petals; pull it back toward the petal's own colour.
              const reach = darkInk ? 1 : 1 - 0.5 * p.night
              // Mostly opaque, so what's behind (a hill's edge, the sky) doesn't show through
              // the head as a line across it. By day it keeps the light the raster gave the petal
              // (bloom.ts shades each flap by 0.62..1.17). After dark that shading is undone, so
              // the flowers stay full colour and the glyphs alone carry the light.
              const body = darkInk ? 0.75 + 0.1 * lit : 0.7 + 0.15 * lit
              const flat = 1 + p.night * (1 / (0.62 + 0.55 * lit) - 1)
              tileCol[i * 3] = Math.min(255, tileCol[i * 3] * flat)
              tileCol[i * 3 + 1] = Math.min(255, tileCol[i * 3 + 1] * flat)
              tileCol[i * 3 + 2] = Math.min(255, tileCol[i * 3 + 2] * flat)
              // Lines carry the drawing: the head's outline, in ink that contrasts with what's
              // behind, and the folds between its petals, in the petal's own dark ink.
              // On a head only a few cells across nearly every cell touches the edge; keep lines for
              // the cells the petal only partly covers, the true rim, and fill the rest.
              const rim = this.petalEdge(c, r)
              const edge =
                rim >= 0 && v >= 0.7 && this.headCells(c, r) < 22 ? -1 : rim
              alpha = 1
              if (edge >= 0) {
                g = code(LINES[edge])
                // A rim inside the head, where one petal's edge lies over another, keeps the
                // body under it; only the head's outer rim thins, so the field never shows inside.
                tile[i] =
                  this.petalsAround(c, r) >= 3
                    ? body
                    : body * 0.7 * Math.min(1, v * 1.4)
                ;[cr, cg, cb] = mix([cr, cg, cb], ink, 0.7 * reach)
                break
              }
              tile[i] = body
              const seam = this.petalSeam(c, r)
              if (seam >= 0) {
                g = code(LINES[seam])
                ;[cr, cg, cb] = mix([cr, cg, cb], p.ground, 0.85)
                break
              }
              // One glyph per flap, in ink darker than its tile: more ink where the petal turns
              // from the light, most on one seen from behind. After dark, one step lighter.
              const step = this.back[i]
                ? 3
                : lit >= 0.6
                  ? 0
                  : lit >= 0.3
                    ? 1
                    : 2
              g = code(FOLD[Math.max(0, step - (p.night > 0.5 ? 1 : 0))])
              ;[cr, cg, cb] = mix([cr, cg, cb], p.ground, 0.7)
              break
            }
            case Kind.Disc: {
              // The centre is the heaviest ink in the head: a dark eye, or a bright disc on its own tile.
              // The eye is only what is truly dark (a poppy's stamens and blotch, at L .03): a
              // yellow cosmos centre dimmed by haze and night (L .3-.45) is still a pale disc.
              if (L < 0.25) {
                g = code(v > 0.6 ? '@' : '#')
                alpha = 1
                // A thin dark line drawn over a head (a rose's furled heart) sits among petals:
                // it keeps a full tile of its own colour, or the field shows through as a hole.
                const among = this.petalsAround(c, r) >= 3
                // Otherwise on a tile of its own colour, lifted toward the haze by day so a dark
                // centre reads solid rather than as a hole; after dark the haze is black, so no lift.
                const lift = among
                  ? [cr, cg, cb]
                  : mix([cr, cg, cb], p.haze, 0.4 * (1 - p.night))
                tileCol[i * 3] = lift[0] * p.ink
                tileCol[i * 3 + 1] = lift[1] * p.ink
                tileCol[i * 3 + 2] = lift[2] * p.ink
                tile[i] = among ? 0.85 : 0.75 * Math.min(1, v * 1.4)
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
              if (this.back[i]) {
                // A loose petal (LOOSE_PETAL in the air, LANDED_PETAL on the ground), printed like
                // the petals it fell from: a line outline over a tile in its colour, sparse dark
                // glyphs inside. Nearly solid, in the air as on the ground: thinner, a cream
                // petal over the dark meadow mixed to a grey blob.
                tile[i] = 0.85 * Math.min(1, v * 1.4)
                const rim = this.edgeOf(c, r, this.looseCov)
                alpha = 1
                if (rim >= 0) {
                  g = code(LINES[rim])
                  ;[cr, cg, cb] = mix(
                    [cr, cg, cb],
                    inkAt(x, y).ink,
                    0.7 * (1 - 0.5 * p.night),
                  )
                } else {
                  g = code('.')
                  ;[cr, cg, cb] = mix([cr, cg, cb], p.ground, 0.5)
                }
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
              if (k === Kind.Stem) {
                // A faint band in the stalk's own colour behind its line, so it reads apart from
                // the ground rather than as a hairline; lighter than the rose's solid cane.
                tile[i] = 0.3 * Math.min(1, v * 2)
                ;[cr, cg, cb] = mix([cr, cg, cb], p.grassLight, 0.15)
              }
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
              const mat = this.pid[i]
              const b = bayer(c, r)
              // Snow, the palest mark on the land: glyphs over a flat tile in its own colour. Where
              // the cap only partly covers a cell, at its lower edge, it dithers into the rock.
              if (
                (mat === LandMat.SnowLit || mat === LandMat.SnowShade) &&
                (v > 0.85 || v > b)
              ) {
                if (this.matAt(c, r - 1) < 0) {
                  // The crest outline: the line glyph nearest the slope, `^` at a summit, `_` on a ledge.
                  const L = this.snowAt(c - 1, r)
                  const R = this.snowAt(c + 1, r)
                  const LU = this.snowAt(c - 1, r - 1)
                  const RU = this.snowAt(c + 1, r - 1)
                  g = code(
                    LU && !RU
                      ? '\\'
                      : RU && !LU
                        ? '/'
                        : L && R
                          ? '_'
                          : !L && !R
                            ? '^'
                            : L
                              ? '\\'
                              : '/',
                  )
                  const lc = mix([cr, cg, cb], [255, 255, 255], 0.15)
                  cr = lc[0]
                  cg = lc[1]
                  cb = lc[2]
                  alpha = 1
                } else if (mat === LandMat.SnowLit) {
                  let n = 0
                  while (n < 8 && this.snowAt(c, r - 1 - n)) n++
                  const dl =
                    0.15 + 0.85 * (1 - Math.min(1, ((n + 0.5) * ch) / 70))
                  g = code(
                    SNOW[
                      Math.min(SNOW.length - 1, Math.floor(dl * SNOW.length))
                    ],
                  )
                  tile[i] = 0.35
                  alpha = 0.9
                } else {
                  g = code(b < 0.3 ? "'" : '.')
                  tile[i] = 0.3
                  alpha = 0.8
                }
                break
              }
              // Forest: the painted silhouette carries it; sparse tips inside, none on the top edge,
              // which the silhouette already serrates.
              if (mat === LandMat.Canopy) {
                if (this.matAt(c, r - 1) === LandMat.Canopy && b < 0.3)
                  g = code(b < 0.12 ? '|' : '^')
                const lc = mix([cr, cg, cb], p.cloud, 0.22)
                cr = lc[0]
                cg = lc[1]
                cb = lc[2]
                alpha = 0.6
                break
              }
              // A near spruce: line glyphs down its flanks, a sparse `:` inside.
              if (mat === LandMat.Spruce) {
                const top = this.matAt(c, r - 1) !== LandMat.Spruce
                if (!top && this.matAt(c - 1, r) !== LandMat.Spruce)
                  g = code('/')
                else if (!top && this.matAt(c + 1, r) !== LandMat.Spruce)
                  g = code('\\')
                else if (b < 0.22) g = code(':')
                const lc = mix([cr, cg, cb], p.cloud, 0.3)
                cr = lc[0]
                cg = lc[1]
                cb = lc[2]
                alpha = 0.7
                break
              }
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
              // The far range's faces: a faint tile, lit or shaded, and a nudge to the slope glyphs.
              const face = relief.length === kinds.length ? relief[i] : 0
              if (face) {
                const fc = face > 0 ? reliefLight : p.ground
                tile[i] = face > 0 ? reliefLit * face : -0.08 * face
                tileCol[i * 3] = fc[0]
                tileCol[i * 3 + 1] = fc[1]
                tileCol[i * 3 + 2] = fc[2]
              }
              // Slope light, in glyphs alone: the sunward side thickens toward the crest and the far
              // side goes bare, so the contrast is all in the lit flank.
              const sl = (this.lit[i] - 0.5) * 2 + 0.3 * face
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
        }
        // Flowers and stems fade less than grass near the text, so plants don't lose their stalks.
        const plant =
          k === Kind.Petal ||
          k === Kind.Disc ||
          k === Kind.Stem ||
          k === Kind.Fluff
        out.flags[i] = MAT | (plant ? PLANT : 0)
        // A bare rock cell still shows its face's tile.
        if (g === 0 && !(k === Kind.Land && tile[i] > 0)) continue
        out.glyph[i] = g
        // The night's ink boost would push bright colours past 255; the arrays clamp them.
        out.ink[i * 3] = cr * p.ink
        out.ink[i * 3 + 1] = cg * p.ink
        out.ink[i * 3 + 2] = cb * p.ink
        out.alpha[i] = alpha * 255
        out.tile[i] = tile[i] * 255
        out.tileCol[i * 3] = tileCol[i * 3]
        out.tileCol[i * 3 + 1] = tileCol[i * 3 + 1]
        out.tileCol[i * 3 + 2] = tileCol[i * 3 + 2]
      }
    }
    return out
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

  /** A land cell's material (LandMat), or -1 where the cell isn't land. */
  private matAt(c: number, r: number) {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1
    const i = r * this.cols + c
    return this.kinds[i] === Kind.Land && this.cov[i] > 0.07 ? this.pid[i] : -1
  }

  private snowAt(c: number, r: number) {
    const m = this.matAt(c, r)
    return m === LandMat.SnowLit || m === LandMat.SnowShade
  }

  /** Petal id at a cell, 0 off petals. */
  private pidAt(c: number, r: number) {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return 0
    const i = r * this.cols + c
    return this.kinds[i] === Kind.Petal ? this.pid[i] : 0
  }

  /** How many of a cell's four neighbours are petal. */
  private petalsAround(c: number, r: number) {
    return (
      Number(this.pidAt(c - 1, r) > 0) +
      Number(this.pidAt(c + 1, r) > 0) +
      Number(this.pidAt(c, r - 1) > 0) +
      Number(this.pidAt(c, r + 1) > 0)
    )
  }

  /**
   * Line glyph for the fold between two petals of a head, or -1. The fold prints on its lit
   * side only, so it stays one cell wide and sits where dark ink shows; its direction follows
   * the run of the boundary, so the folds of a head facing the viewer print as diagonals.
   */
  private petalSeam(c: number, r: number) {
    const i = r * this.cols + c
    const me = this.pid[i]
    if (!me) return -1
    // Only big heads have room for folds; on smaller ones they turn the head into a tangle.
    if (this.cov[i] < 0.5 || this.headCells(c, r) < 26) return -1
    const mine = this.lit[i]
    let gx = 0
    let gy = 0
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue
        const other = this.pidAt(c + dx, r + dy)
        if (!other || other === me) continue
        const j = (r + dy) * this.cols + c + dx
        if (this.cov[j] < 0.5) continue
        const theirs = this.lit[j]
        // The darker petal is the one behind the fold; the line goes on the lighter one.
        if (theirs > mine || (theirs === mine && other > me)) continue
        gx += dx * this.cw
        gy += dy * this.ch
      }
    if (gx === 0 && gy === 0) return -1
    // The fold runs at right angles to the way the petal behind it lies.
    let a = Math.atan2(gy, gx) + Math.PI / 2
    a = ((a % Math.PI) + Math.PI) % Math.PI
    return Math.round(a / (Math.PI / 4)) % 4
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
          this.stampAlpha[i] = 1
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
    const {
      cols,
      rows,
      cw,
      ch,
      stamp,
      stampCol,
      stampTile,
      stampAlpha,
      stampTileCol,
    } = this
    for (const s of sprites) {
      const fade = s.fade ?? 1
      if (fade <= 0.02) continue
      // As big as its flower's depth allows: a visitor on the horizon prints as one glyph.
      const set = INSECTS[s.kind][s.size ?? sizeFor(s.kind, s.span / cw)]
      const fig = set[Math.min(set.length - 1, s.pose)]
      const f = (s.facing === -1 && MIRRORED.get(fig)) || fig
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
        // Glassy wings: no tile, a pale ink that holds on the day sky and the night ground.
        g: [null, mix(edge, ink, 0.7)],
        // Rim: the body's colour with no tile, to round off a figure's corners.
        r: [null, mix(base, ink, 0.2)],
      }
      f.rows.forEach((row, j) => {
        const r = rr - (f.rows.length - 1) + j
        if (r < 0 || r >= rows) return
        for (let t = 0; t < row.length; t++) {
          const role = roles[f.mask[j][t]]
          const c = cc - (row.length >> 1) + t
          if (!role || c < 0 || c >= cols) continue
          const i = r * cols + c
          if (s.under && stamp[i]) continue
          const [tile, col] = role
          stamp[i] = code(row[t])
          stampAlpha[i] = fade
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

  private readonly petalCov = (c: number, r: number) => this.petal(c, r)

  /** Cover of a loose petal (fluff carrying the back flag) at a cell, 0 elsewhere. */
  private readonly looseCov = (c: number, r: number) => {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return 0
    const i = r * this.cols + c
    return this.kinds[i] === Kind.Fluff && this.back[i] ? this.cov[i] : 0
  }

  /**
   * Line glyph tracing the petal's outline through this cell, or -1 inside the flower. Edges
   * print as strokes so each head reads by its silhouette, not as a blot of colour.
   */
  private petalEdge(c: number, r: number) {
    return this.edgeOf(c, r, this.petalCov)
  }

  /** The outline of whatever `at` measures the cover of, as a line glyph, or -1 inside it. */
  private edgeOf(c: number, r: number, at: (c: number, r: number) => number) {
    const l = at(c - 1, r)
    const rt = at(c + 1, r)
    const u = at(c, r - 1)
    const d = at(c, r + 1)
    if (Math.min(l, rt, u, d) > 0.2) return -1
    const gx = (rt - l) / this.cw
    const gy = (d - u) / this.ch
    if (gx === 0 && gy === 0) return -1
    // The outline runs at right angles to the cover gradient.
    let a = Math.atan2(gy, gx) + Math.PI / 2
    a = ((a % Math.PI) + Math.PI) % Math.PI
    return Math.round(a / (Math.PI / 4)) % 4
  }
}
