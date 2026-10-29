import { createCompositor, type Compositor } from './gl'
import { bayer, clamp, fbm2, hash, smoothstep } from './math'
import { mix, type Palette, type Rgb } from './palette'
import { CLOUD, code, GLYPHS, MAT, PLANT } from './typeset'

import type { Meteors } from './meteors'
import type { Raster } from './raster'

export type Rect = { left: number; top: number; right: number; bottom: number }

const CLOUD_CODES = [...CLOUD].map(code)
const DOT = code('·')
const PERIOD = code('.')
const PLUS = code('+')
/** How strongly a shooting star lights the tile behind its glyph. */
const GLOW = 0.3

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
  /** Shooting stars, already painted for this frame. */
  meteors?: Meteors
  /** Paints smooth shapes (hill silhouettes) between the sky gradient and the glyphs. */
  backdrop?: (ctx: CanvasRenderingContext2D) => void
  /** Changes whenever the backdrop would paint differently, beyond the palette. */
  backdropKey?: string
}

/**
 * Puts the scene's type on screen. The plants and land arrive already set in type from the raster
 * workers (typeset.ts); each frame this lays the open sky's clouds, stars and halftone between
 * them, fades the garden under the page's text, adds the light around the cursor and hands the
 * cells to the GPU, which draws every glyph over its tile in one pass.
 */
export class AsciiRenderer {
  private canvas: HTMLCanvasElement
  private gl: Compositor
  cw = 9
  ch = 12
  cols = 0
  rows = 0
  private dpr = 1
  /** Cloud noise per cell, refreshed a third of the rows per frame: it drifts a pixel or two a second. */
  private cloudBase = new Float32Array(0)
  private cloudLit = new Float32Array(0)
  private cloudTick = -1
  /** Scene time of the last cloud refresh: a third of the rows at most twenty times a second. */
  private cloudAt = 0
  /** Per sky cell: whether a star can show there, how fast it twinkles, and whether it's a cross. */
  private star = new Float32Array(0)
  private starRate = new Float32Array(0)
  private starCross = new Uint8Array(0)
  private dimKey = ''
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
  /** 1 where the garden shows fully, down to a floor under the hero text. */
  dim = new Float32Array(0)
  /** Its square root, the gentler fade plants take. */
  private dimPlant = new Float32Array(0)
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
    this.cloudBase = new Float32Array(n)
    this.cloudLit = new Float32Array(n)
    this.cloudTick = -1
    this.star = new Float32Array(n)
    this.starRate = new Float32Array(n)
    this.starCross = new Uint8Array(n)
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const i = r * this.cols + c
        this.star[i] = hash(c, r, 77)
        this.starRate[i] = 1 + hash(c, r, 5) * 3
        this.starCross[i] = hash(c, r, 9) < 0.2 ? 1 : 0
      }
    this.dimKey = ''
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
    this.dimPlant = new Float32Array(n).fill(1)
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
    // Measured every half second; the boxes rarely move.
    const key = boxes
      .map((b) => `${b.left | 0},${b.top | 0},${b.right | 0},${b.bottom | 0}`)
      .join(';')
    if (key === this.dimKey) return
    this.dimKey = key
    const { cols, rows, cw, ch, dim } = this
    dim.fill(1)
    // A wide, gentle fade: the garden recedes behind the text rather than stopping at a box. Kept
    // light, now the flowers stop under the tree line and rarely stand behind the bio.
    const pad = cw * 11
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
          dim[i] = Math.min(dim[i], 0.38 + 0.62 * smoothstep(0, pad, d))
        }
      }
    }
    for (let i = 0; i < dim.length; i++) this.dimPlant[i] = Math.sqrt(dim[i])
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
    const {
      raster,
      palette: p,
      time,
      horizon,
      page,
      veil,
      pointer,
      meteors,
    } = input
    if (veil >= 1) {
      // Another page: nothing but the page colour.
      this.gl.clear(page)
      return
    }
    const { cols, rows, cw, ch } = this
    const m = raster.material
    // Until a frame at this size comes back there's nothing to set.
    if (!m || m.glyph.length !== cols * rows) return
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

    // Until every row has been filled once, refresh them all; then a third of the rows at a
    // time, at most twenty times a second (-2: none this frame).
    const cloudDue = this.cloudTick < 0 || Math.abs(time - this.cloudAt) >= 0.05
    const tick = this.cloudTick < 0 ? -1 : cloudDue ? this.cloudTick % 3 : -2
    if (cloudDue) {
      this.cloudTick++
      this.cloudAt = time
    }
    const { inkData, tileData, dim, dimPlant, cloudBase, cloudLit } = this
    const { star, starRate, starCross } = this
    const { glyph, alpha, tile, ink, tileCol, flags } = m
    // The halftone screen keeps roughly the same spacing in pixels, so fine grids don't fill with dots.
    const pitch = this.cw < 8 ? 8 : 4
    const cloudT = time * 0.012
    const stars = p.night
    const k = p.ink
    const [clR, clG, clB] = p.cloud
    // Near the cursor the garden catches a little more light; much more after dark.
    const lightR = 120
    const glow = 0.18 + 0.55 * p.night
    const groundTop = mix(p.hillNear, p.ground, 0.5)
    const groundBottom = mix(p.ground, p.skyHorizon, 0.08)
    const streaks = meteors?.alive ? meteors : null
    // A fireball's light on the ridges near its head.
    const glint = streaks?.glint
    const reach = 0.3 * H
    for (let r = 0; r < rows; r++) {
      const y = r * ch + ch / 2
      const skyRow = y < horizon
      // Background colour at this row, which glyphs are mixed toward as they fade.
      const [b0, b1, b2] = skyRow
        ? mix(p.skyTop, p.skyHorizon, clamp(y / Math.max(1, horizon), 0, 1))
        : mix(
            groundTop,
            groundBottom,
            clamp((y - horizon) / (H - horizon), 0, 1),
          )
      const cloudRow = skyRow ? 1 - smoothstep(0.55, 1, y / horizon) : 0
      const refresh = tick === -1 || r % 3 === tick
      const py = y - pointer.y
      const lit = pointer.active && Math.abs(py) < lightR
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c
        const o = i * 4
        let g = 0
        let cr = 0
        let cg = 0
        let cb = 0
        let a = 0
        let t = 0
        // A shooting star lights its cell's tile, in place of the raster's.
        let glowing = false
        const f = flags[i]
        if (f & MAT) {
          g = glyph[i]
          if (g) {
            // Flowers and stems fade less than grass near the text, so plants don't lose their stalks.
            const fade = f & PLANT ? dimPlant[i] : dim[i]
            a = (alpha[i] / 255) * fade
            t = tile[i] / 255
            // Barely-there glyphs cost a draw each and add nothing.
            if (a < 0.06 && t <= 0) g = 0
            else {
              t *= fade
              cr = ink[i * 3]
              cg = ink[i * 3 + 1]
              cb = ink[i * 3 + 2]
            }
          }
        } else if (skyRow) {
          // Sky: drifting cumulus as dithered halftone, stars at night.
          const x = c * cw + cw / 2
          if (refresh) {
            const nx = x / 280 - cloudT
            const ny = y / 120
            const base = fbm2(nx, ny, 5, 4)
            cloudBase[i] = base
            // Lit from above: brighter where the cloud thins below. Only clouds need it.
            cloudLit[i] =
              base > 0.5
                ? clamp(0.55 + (base - fbm2(nx, ny + 0.25, 5, 4)) * 4, 0.2, 1)
                : 0
          }
          const shape = smoothstep(0.5, 0.74, cloudBase[i]) * cloudRow
          let s = 0
          if (shape > 0.02) {
            const l = cloudLit[i]
            const d = shape * l
            if (d > bayer(c, r) * 0.9) {
              g =
                CLOUD_CODES[
                  Math.min(
                    CLOUD_CODES.length - 1,
                    1 + Math.floor(d * (CLOUD_CODES.length - 1)),
                  )
                ]
              const w = 0.35 + 0.65 * l
              cr = (b0 + (clR - b0) * w) * k
              cg = (b1 + (clG - b1) * w) * k
              cb = (b2 + (clB - b2) * w) * k
              s = clamp(0.3 + shape, 0, 1)
            }
          } else if (stars > 0.1 && star[i] < 0.006 * stars) {
            const tw = 0.5 + 0.5 * Math.sin(time * starRate[i] + c)
            g = starCross[i] ? PLUS : PERIOD
            cr = 230 * k
            cg = 235 * k
            cb = 255 * k
            s = stars * (0.3 + 0.7 * tw)
          } else if ((c + r * 2) % pitch === 0 && r % (pitch / 2) === 0) {
            // The poster's halftone screen over open sky.
            g = DOT
            cr = (b0 + (clR - b0) * 0.22) * k
            cg = (b1 + (clG - b1) * 0.22) * k
            cb = (b2 + (clB - b2) * 0.22) * k
            s = 0.55
          }
          // A shooting star prints over a star or the screen, and dims behind cloud.
          if (streaks) {
            const sa = streaks.alpha[i] * (1 - 0.6 * shape)
            if (sa >= 0.06) {
              g = streaks.glyph[i]
              cr = streaks.rgb[i * 3]
              cg = streaks.rgb[i * 3 + 1]
              cb = streaks.rgb[i * 3 + 2]
              s = sa
              t = GLOW * sa * dim[i]
              glowing = true
            }
          }
          if (g) {
            a = s * dim[i]
            if (a < 0.06) g = 0
            // The night's ink boost would push bright colours past 255.
            cr = Math.min(255, cr)
            cg = Math.min(255, cg)
            cb = Math.min(255, cb)
          }
        }
        inkData[o + 3] = g
        if (!g) {
          tileData[o + 3] = 0
          continue
        }
        if (lit) {
          const dx = c * cw + cw / 2 - pointer.x
          if (Math.abs(dx) < lightR) {
            const dd = Math.hypot(dx, py)
            if (dd < lightR) {
              const kk = (1 - dd / lightR) ** 2 * glow
              cr += (255 - cr) * kk
              cg += (250 - cg) * kk
              cb += (232 - cb) * kk
            }
          }
        }
        if (glint && skyRow && f & MAT && !(f & PLANT)) {
          const dd = Math.hypot(c * cw + cw / 2 - glint.x, y - glint.y)
          if (dd < reach) {
            const kk = glint.k * (1 - dd / reach) ** 2
            cr += (glint.col[0] - cr) * kk
            cg += (glint.col[1] - cg) * kk
            cb += (glint.col[2] - cb) * kk
          }
        }
        inkData[o] = b0 + (cr - b0) * a
        inkData[o + 1] = b1 + (cg - b1) * a
        inkData[o + 2] = b2 + (cb - b2) * a
        if (t > 0) {
          const tc = glowing && streaks ? streaks.rgb : tileCol
          tileData[o] = tc[i * 3]
          tileData[o + 1] = tc[i * 3 + 1]
          tileData[o + 2] = tc[i * 3 + 2]
          tileData[o + 3] = t * 255
        } else tileData[o + 3] = 0
      }
    }

    // Glyph codes registered since the atlas was drawn need their masks.
    if (GLYPHS.length > this.atlas.glyphs) this.resetAtlas()
    if (veil > 0) this.paintVeil(page, veil)
    this.gl.draw(inkData, tileData, veil > 0 ? this.veilData : null)
  }
}

const rgbCss = (c: Rgb) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
