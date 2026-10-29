import type { Rgb } from './palette'

const VERTEX = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`

// One pass over the screen: the backdrop, then per cell its tile and its glyph's mask in the
// cell's ink, then the veil of page colour.
const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uBg;
uniform sampler2D uInk;
uniform sampler2D uTile;
uniform sampler2D uAtlas;
uniform sampler2D uVeil;
uniform vec2 uCell;
uniform float uHeight;
uniform ivec2 uGrid;
uniform ivec2 uSlot;
uniform int uAcross;
uniform bool uVeiled;
out vec4 o;
void main() {
  vec2 px = vec2(gl_FragCoord.x, uHeight - gl_FragCoord.y);
  vec3 col = texelFetch(uBg, ivec2(px), 0).rgb;
  ivec2 cell = min(ivec2(px / uCell), uGrid - 1);
  vec4 ink = texelFetch(uInk, cell, 0);
  int g = int(ink.a * 255.0 + 0.5);
  if (g > 0) {
    vec4 tile = texelFetch(uTile, cell, 0);
    col = mix(col, tile.rgb, tile.a);
    ivec2 local = min(ivec2(px - vec2(cell) * uCell), uSlot - 1);
    float m = texelFetch(uAtlas, ivec2(g % uAcross, g / uAcross) * uSlot + local, 0).a;
    col = mix(col, ink.rgb, m);
  }
  if (uVeiled) {
    vec4 v = texture(uVeil, px / (uCell * vec2(uGrid)));
    col = mix(col, v.rgb, v.a);
  }
  o = vec4(col, 1.0);
}`

type Uniforms = Record<
  | 'uBg'
  | 'uInk'
  | 'uTile'
  | 'uAtlas'
  | 'uVeil'
  | 'uCell'
  | 'uHeight'
  | 'uGrid'
  | 'uSlot'
  | 'uAcross'
  | 'uVeiled',
  WebGLUniformLocation | null
>

/** Glyph masks, white on clear, one slot per glyph code; plus what drew them, for the 2D fallback. */
export type Atlas = {
  canvas: HTMLCanvasElement
  slotW: number
  slotH: number
  across: number
  glyphs: string[]
  font: string
}

/** Draws the glyph grid from per-cell data: ink colour and glyph code, tile colour and alpha. */
export interface Compositor {
  /** Grid size in cells, and one cell's size in device pixels. */
  resize(cols: number, rows: number, cellW: number, cellH: number): void
  setAtlas(atlas: Atlas): void
  setBackground(canvas: HTMLCanvasElement): void
  /** Per cell, RGBA: ink colour and glyph code; tile colour and alpha. Veil is page colour and cover, or null. */
  draw(
    ink: Uint8ClampedArray,
    tile: Uint8ClampedArray,
    veil: Uint8ClampedArray | null,
  ): void
  clear(c: Rgb): void
}

/** The GPU compositor where WebGL2 works, else a slower Canvas 2D one, so the scene always draws. */
export function createCompositor(canvas: HTMLCanvasElement): Compositor {
  try {
    return new GlyphCompositor(canvas)
  } catch (err) {
    console.error(
      'WebGL2 compositor unavailable; drawing glyphs with Canvas 2D',
      err,
    )
    return new CanvasCompositor(canvas)
  }
}

type Gpu = {
  u: Uniforms
  bg: WebGLTexture
  ink: WebGLTexture
  tile: WebGLTexture
  atlas: WebGLTexture
  veil: WebGLTexture
}

/**
 * Draws the glyph grid on the GPU. The CPU hands over each cell's glyph and colours as two small
 * textures, so a frame costs the same whether one cell changed or all of them, as when scrubbing
 * the hour recolours everything at once. If the GPU drops the context, it rebuilds everything
 * from the last size, atlas and backdrop once the context comes back.
 */
export class GlyphCompositor implements Compositor {
  private gl: WebGL2RenderingContext
  private g: Gpu | null
  private cols = 0
  private rows = 0
  private cell: [number, number] = [1, 1]
  private atlas: Atlas | null = null
  private bgCanvas: HTMLCanvasElement | null = null
  private bgSize = ''

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      // Keeps a laptop with two GPUs on its integrated one, which is plenty for this.
      powerPreference: 'low-power',
    })
    if (!gl) throw new Error('WebGL2 unavailable')
    this.gl = gl
    this.g = this.build()
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      this.g = null
    })
    canvas.addEventListener('webglcontextrestored', () => {
      this.g = this.build()
      this.bgSize = ''
      if (this.cols)
        this.resize(this.cols, this.rows, this.cell[0], this.cell[1])
      if (this.atlas) this.setAtlas(this.atlas)
      if (this.bgCanvas) this.setBackground(this.bgCanvas)
    })
  }

  private build(): Gpu {
    const gl = this.gl
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)
      if (!s) throw new Error('shader')
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
      return s
    }
    const prog = gl.createProgram()
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(prog) ?? 'program')
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    )
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const names = [
      'uBg',
      'uInk',
      'uTile',
      'uAtlas',
      'uVeil',
      'uCell',
      'uHeight',
      'uGrid',
      'uSlot',
      'uAcross',
      'uVeiled',
    ] as const
    const u = Object.fromEntries(
      names.map((n) => [n, gl.getUniformLocation(prog, n)]),
    ) as Uniforms
    const texture = (
      unit: number,
      uniform: WebGLUniformLocation | null,
      filter: number,
    ) => {
      const t = gl.createTexture()
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.uniform1i(uniform, unit)
      return t
    }
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    return {
      u,
      bg: texture(0, u.uBg, gl.NEAREST),
      ink: texture(1, u.uInk, gl.NEAREST),
      tile: texture(2, u.uTile, gl.NEAREST),
      atlas: texture(3, u.uAtlas, gl.NEAREST),
      veil: texture(4, u.uVeil, gl.LINEAR),
    }
  }

  resize(cols: number, rows: number, cellW: number, cellH: number) {
    this.cols = cols
    this.rows = rows
    this.cell = [cellW, cellH]
    const { gl, g } = this
    if (!g) return
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
    gl.uniform2f(g.u.uCell, cellW, cellH)
    gl.uniform1f(g.u.uHeight, gl.drawingBufferHeight)
    gl.uniform2i(g.u.uGrid, cols, rows)
    for (const [unit, t] of [
      [1, g.ink],
      [2, g.tile],
      [4, g.veil],
    ] as const) {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        cols,
        rows,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      )
    }
  }

  setAtlas(atlas: Atlas) {
    this.atlas = atlas
    const { gl, g } = this
    if (!g) return
    gl.activeTexture(gl.TEXTURE3)
    gl.bindTexture(gl.TEXTURE_2D, g.atlas)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      atlas.canvas,
    )
    gl.uniform2i(g.u.uSlot, atlas.slotW, atlas.slotH)
    gl.uniform1i(g.u.uAcross, atlas.across)
  }

  setBackground(canvas: HTMLCanvasElement) {
    this.bgCanvas = canvas
    const { gl, g } = this
    if (!g) return
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, g.bg)
    // Scrubbing the hour repaints the backdrop every frame: reuse the texture's storage while
    // its size holds instead of reallocating it.
    const size = `${canvas.width}x${canvas.height}`
    if (size === this.bgSize)
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        canvas,
      )
    else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        canvas,
      )
      this.bgSize = size
    }
  }

  draw(
    ink: Uint8ClampedArray,
    tile: Uint8ClampedArray,
    veil: Uint8ClampedArray | null,
  ) {
    const { gl, g } = this
    if (!g) return
    const upload = (unit: number, t: WebGLTexture, data: Uint8ClampedArray) => {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        this.cols,
        this.rows,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        data,
      )
    }
    upload(1, g.ink, ink)
    upload(2, g.tile, tile)
    if (veil) upload(4, g.veil, veil)
    gl.uniform1i(g.u.uVeiled, veil ? 1 : 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  clear(c: Rgb) {
    const gl = this.gl
    gl.clearColor(c[0] / 255, c[1] / 255, c[2] / 255, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }
}

/**
 * The fallback where WebGL2 is blocked or missing: the backdrop, then each cell's tile and glyph
 * drawn one by one. Much slower than the GPU path, but the scene still shows.
 */
export class CanvasCompositor implements Compositor {
  private ctx: CanvasRenderingContext2D
  private cols = 0
  private rows = 0
  private cell: [number, number] = [1, 1]
  private atlas: Atlas | null = null
  private bg: HTMLCanvasElement | null = null
  private veilCanvas = document.createElement('canvas')

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('No canvas context available')
    this.ctx = ctx
  }

  resize(cols: number, rows: number, cellW: number, cellH: number) {
    this.cols = cols
    this.rows = rows
    this.cell = [cellW, cellH]
    this.veilCanvas.width = cols
    this.veilCanvas.height = rows
  }

  setAtlas(atlas: Atlas) {
    this.atlas = atlas
  }

  setBackground(canvas: HTMLCanvasElement) {
    this.bg = canvas
  }

  draw(
    ink: Uint8ClampedArray,
    tile: Uint8ClampedArray,
    veil: Uint8ClampedArray | null,
  ) {
    const { ctx, cols, rows, atlas } = this
    const [cw, ch] = this.cell
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 1
    if (this.bg) ctx.drawImage(this.bg, 0, 0)
    if (atlas) {
      ctx.font = atlas.font
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
    }
    for (let i = 0; i < cols * rows; i++) {
      const o = i * 4
      const g = ink[o + 3]
      if (!g) continue
      const x = (i % cols) * cw
      const y = Math.floor(i / cols) * ch
      if (tile[o + 3]) {
        ctx.fillStyle = `rgba(${tile[o]},${tile[o + 1]},${tile[o + 2]},${tile[o + 3] / 255})`
        ctx.fillRect(x, y, cw, ch)
      }
      if (atlas) {
        ctx.fillStyle = `rgb(${ink[o]},${ink[o + 1]},${ink[o + 2]})`
        ctx.fillText(atlas.glyphs[g], x + cw / 2, y + ch / 2)
      }
    }
    if (veil) {
      const v = this.veilCanvas.getContext('2d')
      if (v) {
        v.putImageData(
          new ImageData(new Uint8ClampedArray(veil), cols, rows),
          0,
          0,
        )
        ctx.imageSmoothingEnabled = true
        ctx.drawImage(this.veilCanvas, 0, 0, cols * cw, rows * ch)
      }
    }
  }

  clear(c: Rgb) {
    this.ctx.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
    this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)
  }
}
