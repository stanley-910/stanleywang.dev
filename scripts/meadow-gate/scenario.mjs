// The gate's fixed sequence: the scene as mount.ts drives it, frame by frame, with every stage's
// bytes hashed. A change that claims the same picture must give the same hashes as the build
// before it (golden.json), stage for stage.
import { AsciiRenderer } from './eng/ascii.mjs'
import { Birds } from './eng/birds.mjs'
import { Garden, sunAt } from './eng/garden.mjs'
import { Meteors } from './eng/meteors.mjs'
import { paletteAt, withMoon } from './eng/palette.mjs'
import { Raster } from './eng/raster.mjs'
import { Weather } from './eng/weather.mjs'
import { Wind } from './eng/wind.mjs'

// mount.ts's constants.
const STEP = 1 / 120
const SCENE_ZOOM = 0.64
const CELL = 5
const BY_DAY = 0.5

const hex = (buf) =>
  Array.from(new Uint8Array(buf, 0, 8), (b) => b.toString(16).padStart(2, '0')).join('')

/** A short hash of the exact bytes of some typed arrays and plain values. */
async function digest(parts) {
  const chunks = []
  let size = 0
  for (const p of parts) {
    let bytes
    if (p == null) bytes = new Uint8Array([0])
    else if (ArrayBuffer.isView(p))
      bytes = new Uint8Array(p.buffer, p.byteOffset, p.byteLength)
    else bytes = new TextEncoder().encode(JSON.stringify(p))
    // Each part's length goes in too, so two splits of the same bytes differ.
    chunks.push(new Uint8Array(new Uint32Array([bytes.byteLength]).buffer), bytes)
    size += 4 + bytes.byteLength
  }
  const all = new Uint8Array(size)
  let o = 0
  for (const c of chunks) {
    all.set(c, o)
    o += c.byteLength
  }
  return hex(await crypto.subtle.digest('SHA-256', all))
}

/**
 * Runs the sequence and returns one row of hashes per frame. `only` keeps the frames whose
 * segment name matches, for a quick look at one part.
 */
export async function run({ only = null, log = () => {} } = {}) {
  const canvas = document.getElementById('scene')
  const wind = new Wind()
  wind.strength = 0.2
  const weather = new Weather()
  weather.set('clear', true, false)
  let moonTone = null
  let hour = 22.2
  const sceneAt = (h) => weather.tint(withMoon(paletteAt(h), moonTone, h), sunAt(h))
  const raster = new Raster()
  raster.probe = true
  const ascii = new AsciiRenderer(canvas, 'Menlo, monospace')
  const meteors = new Meteors()
  const birds = new Birds()
  const garden = new Garden(wind, paletteAt(hour))
  garden.useSeed(1715089390)

  let width = 0
  let height = 0
  let clock = 1000
  let hill = new Float32Array(0)
  let peak = Infinity
  let relief = new Float32Array(0)
  let river = new Int8Array(0)
  let riverFor = ''
  const gl = canvas.getContext('webgl2')

  const resize = (cssW, cssH) => {
    const dpr = 2
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`
    const w = cssW / SCENE_ZOOM
    const h = cssH / SCENE_ZOOM
    ascii.resize(w, h, dpr * SCENE_ZOOM, CELL)
    raster.resize(ascii.cols, ascii.rows, ascii.cw, ascii.ch)
    garden.cell = { cw: ascii.cw, ch: ascii.ch }
    meteors.resize(ascii.cols, ascii.rows)
    birds.resize(ascii.cols, ascii.rows)
    weather.resize(ascii.cols, ascii.rows)
    width = w
    height = h
    // The bio's box, as home lays it out at this size, roughly.
    garden.keepClear = { left: 0.12 * w, top: 0.42 * h, right: 0.52 * w, bottom: 0.7 * h }
    garden.resize(w, h)
    garden.skipIntro()
    ascii.setDimBoxes([{ ...garden.keepClear, light: false }])
  }

  const step = (n) => {
    const palette = sceneAt(hour)
    weather.step(n * STEP)
    for (let i = 0; i < n; i++) {
      wind.unsteady = weather.unsteady
      wind.strength = 0.2 + weather.gale
      wind.step(STEP)
      garden.step(STEP, palette)
    }
    clock += n * STEP * 1000
  }

  /** mount.ts's draw(true): record, rasterise here, compose, and hash each stage. */
  const frame = async (withPixels) => {
    const palette = sceneAt(hour)
    garden.hour = hour
    raster.clear()
    garden.draw(raster, palette)
    if (hill.length !== ascii.cols) hill = new Float32Array(ascii.cols)
    peak = Infinity
    for (let c = 0; c < hill.length; c++) {
      hill[c] = garden.hillTop((c + 0.5) * ascii.cw)
      peak = Math.min(peak, hill[c])
    }
    if (relief.length !== ascii.cols * ascii.rows)
      relief = new Float32Array(ascii.cols * ascii.rows)
    const riverKey = `${ascii.cols}/${ascii.rows}/${garden.riverVersion}`
    if (riverKey !== riverFor) {
      riverFor = riverKey
      river = new Int8Array(ascii.cols * ascii.rows)
      garden.riverField(river, ascii.cols, ascii.rows, ascii.cw, ascii.ch)
    }
    const face = garden.relief(relief, ascii.cols, ascii.rows, ascii.cw, ascii.ch, palette)
    // What was recorded, before it is handed over.
    const record = await digest([
      raster.cmds.subarray(0, raster.n),
      raster.still,
      raster.touch,
      raster.heads.map((h) => [h.x, h.y, h.r, h.species, h.petal, h.disc, h.alpha]),
      raster.sprites,
      hill,
      relief,
      river,
      face.color,
      face.lit,
      garden.horizon,
      palette,
    ])
    raster.submit(
      true,
      {
        palette,
        horizon: garden.horizon,
        hill,
        relief,
        reliefLight: face.color,
        reliefLit: face.lit,
        river,
      },
      hour,
    )
    const m = raster.material
    const type = await digest([m.glyph, m.alpha, m.tile, m.ink, m.tileCol, m.flags])
    const c = raster.cells
    const cells = await digest([c.kinds, c.pid, c.lit, c.cov])

    const scene = raster.palette ?? palette
    const secs = clock / 1000
    meteors.paint(secs, scene, scene.ink)
    birds.fly(
      secs,
      scene.night < BY_DAY
        ? {
            W: width,
            H: height,
            cw: ascii.cw,
            ch: ascii.ch,
            top: 0.14 * height,
            bottom: Math.max(0.14 * height, Math.min(0.3 * height, peak - 3 * ascii.ch)),
          }
        : null,
    )
    birds.paint(secs, scene)
    weather.paint(secs, scene, wind, {
      W: width,
      H: height,
      cw: ascii.cw,
      ch: ascii.ch,
      horizon: garden.horizon,
      cloud: ascii.cloudShape,
      globe: garden.globe(scene),
    })
    ascii.render({
      raster,
      palette: scene,
      time: garden.time,
      horizon: garden.horizon,
      page: [20, 20, 20],
      veil: 0,
      pointer: wind.pointer,
      meteors,
      birds,
      weather,
      backdrop: (ctx) => garden.backdrop(ctx, scene),
      backdropKey: garden.backdropKey(scene),
    })
    const page = await digest([ascii.inkData, ascii.tileData])
    let pixels = ''
    if (withPixels) {
      const px = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4)
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, px)
      pixels = await digest([px])
    }
    return { record, type, cells, page, pixels }
  }

  const rows = []
  /** A run of frames: `each(i)` sets the frame up, then `steps` simulation steps, then a frame. */
  const segment = async (name, count, each = () => {}, steps = 3) => {
    if (only && !name.includes(only)) return
    log(name)
    for (let i = 0; i < count; i++) {
      each(i)
      step(steps)
      // The framebuffer on the first, a middle and the last frame of each run.
      const row = await frame(i === 0 || i === count - 1 || i === count >> 1)
      rows.push({ name, i, ...row })
    }
  }
  const pointerAt = (x, y, active = true) => {
    const p = wind.pointer
    p.vx = (x - p.x) / STEP / 3
    p.vy = (y - p.y) / STEP / 3
    p.x = x
    p.y = y
    p.active = active
  }
  const setWeather = (kind) => () => weather.set(kind, false, false)

  resize(1512, 860)
  // Let the meadow settle into its sway before anything is compared.
  step(240)

  await segment('night-still', 24)
  await segment('night-pointer', 24, (i) =>
    pointerAt(width * (0.3 + 0.02 * i), height * (0.78 + 0.1 * Math.sin(i / 3))),
  )
  await segment('pointer-leaves', 6, (i) => {
    if (i === 0) pointerAt(-9999, -9999, false)
  })
  hour = 13
  await segment('noon', 16)
  await segment('sunset-scrub', 36, (i) => (hour = 16.6 + (i * 2.9) / 35))
  await segment('dawn-scrub', 24, (i) => (hour = 4.6 + (i * 2.6) / 23))
  await segment('midnight', 8, (i) => (hour = i < 4 ? 23.98 : 0.02))
  hour = 21
  await segment('moon-tone', 12, (i) => (moonTone = i < 4 ? null : i < 8 ? 0.2 : 0.9))
  moonTone = null
  for (const [kind, at] of [
    ['rain', 15],
    ['snow', 9.5],
    ['storm', 22],
    ['eclipse', 12.5],
  ]) {
    hour = at
    // In, held, and out again, with enough simulation between frames to cross each fade.
    await segment(`${kind}-in`, 20, (i) => i === 0 && setWeather(kind)(), 24)
    await segment(`${kind}-held`, 10, () => {}, 6)
    await segment(`${kind}-out`, 20, (i) => i === 0 && setWeather('clear')(), 24)
  }
  hour = 18.4
  await segment('long-run', 40, () => {}, 12)
  await segment('regrow', 10, (i) => i === 0 && garden.regrow(1715089391))
  resize(1100, 720)
  step(60)
  await segment('resized', 16, (i) =>
    pointerAt(width * (0.5 + 0.01 * i), height * 0.8),
  )
  resize(1512, 860)
  step(60)
  hour = 22.2
  await segment('back', 12)
  return { cols: ascii.cols, rows: ascii.rows, frames: rows }
}
