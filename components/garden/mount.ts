// Runs the meadow on the home page: the engine in ./engine, ported from the
// ascii-garden prototype (its main.ts, minus the dev control panel).

import { currentHour, HOUR_EVENT, setHour } from '@/lib/circadian'

import { AsciiRenderer, type Rect } from './engine/ascii'
import { Garden } from './engine/garden'
import { smoothstep } from './engine/math'
import { mix, paletteAt, type Palette, type Rgb } from './engine/palette'
import { Raster } from './engine/raster'
import { Wind } from './engine/wind'

const STEP = 1 / 60
const MAX_STEPS = 3
const MEASURE_EVERY = 30
/** The loop runs at most this often, ms: the meadow's motion gains nothing above 60 fps, and a
 * 120 Hz display would otherwise do twice the work. A little under 1000/60 so 60 Hz never skips. */
const MIN_FRAME = 12

// The site's page colours (tokens.css); the scene fades into them.
const PAGE: Record<'dark' | 'light', Rgb> = {
  dark: [27, 27, 25],
  light: [235, 234, 230],
}

// The scene is laid out as if the page were zoomed out to 80%: a finer grid
// and smaller marks at full device resolution. Text keeps its size.
const SCENE_ZOOM = 0.8
/** Cell width in scene px: the prototype's finest grid. */
const CELL = 5
const toScene = (v: number) => v / SCENE_ZOOM

/** Hours of scene time per pixel of sideways scroll: a day is about three screen-widths. */
const HOURS_PER_PX = 1 / 120
/** A pause in the wheel this long, in ms, ends a scroll gesture. */
const WHEEL_REST = 200
/** How fast a released scrub's glide dies away, per second. */
const GLIDE_DECAY = 8
/** Fastest glide, px/s, so a hard flick only drifts on a little after release. */
const GLIDE_MAX = 1200

type GardenOptions = {
  canvas: HTMLCanvasElement
  /** Holds the bio (`.bio`), which no flower is planted under, and takes the clicks that sow. */
  root: HTMLElement
  /** The glyph face's CSS family list. */
  font: string
  /** Called with the scene's hour, as HH:MM, whenever it changes minute, and whether it follows the clock. */
  onHour?: (label: string, live: boolean) => void
}

function localHour() {
  const d = new Date()
  return d.getHours() + d.getMinutes() / 60
}

/** Starts the scene; the returned function stops it and removes its listeners. */
export function mountGarden({ canvas, root, font, onHour }: GardenOptions) {
  const html = document.documentElement
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const wind = new Wind()
  wind.strength = 0.6
  const raster = new Raster()
  const ascii = new AsciiRenderer(canvas, font)
  // The page's hour (lib/circadian.ts): the clock's, or one set on the time
  // slider or by scrubbing here.
  const start0 = currentHour()
  let hour = start0.hour
  let live = !start0.set
  const garden = new Garden(wind, paletteAt(hour))

  let width = 0
  let height = 0
  let frames = 0
  let raf = 0
  let last = performance.now()
  let acc = 0
  let visible = true
  let hourLabel = ''
  let edgeCss = ''
  let panelCss = ''
  let inkCss = ''

  const showHour = () => {
    const h = Math.floor(hour) % 24
    const m = Math.floor((hour % 1) * 60)
    const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    if (label !== hourLabel) onHour?.((hourLabel = label), live)
  }

  /** The page colour the scene's edges fade toward: dark with the sky. */
  const pageFor = (p: Palette): Rgb => {
    const [r, g, b] = p.skyTop
    const sky = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    return mix(PAGE.dark, PAGE.light, smoothstep(0.21, 0.26, sky))
  }

  /**
   * The top bar sits on the sky, which at midday is neither light nor dark
   * enough for either theme's ink. Pick whichever ink contrasts more with
   * the sky's top, for garden.css to apply.
   */
  const matchSky = (p: Palette) => {
    const lin = (v: number) => {
      const c = v / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    const [r, g, b] = p.skyTop
    const l = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    // Against the light ink (#e4e2da, ~0.76) and the dark one (#1b1b19, ~0.011).
    const light = (0.76 + 0.05) / (l + 0.05)
    const dark = (l + 0.05) / (0.011 + 0.05)
    const sky = light > dark ? 'dark' : 'light'
    if (html.dataset.sky !== sky) html.dataset.sky = sky
  }

  /** The page behind the canvas matches its edge, so a sub-pixel gap never shows. */
  const matchEdge = (p: Palette) => {
    const [r, g, b] = mix(p.ground, p.skyHorizon, 0.08)
    const css = `rgb(${r | 0} ${g | 0} ${b | 0})`
    if (css !== edgeCss) canvas.style.backgroundColor = edgeCss = css
  }

  /**
   * The hover cards over the hero take the hour's panel colour, lifted a
   * touch toward its cream so they stand off the ground (garden.css).
   */
  const matchPanel = (p: Palette) => {
    const [r, g, b] = mix(p.panelBg, p.panelInk, 0.04)
    const css = `rgb(${r | 0} ${g | 0} ${b | 0})`
    if (css !== panelCss)
      root.style.setProperty('--garden-panel', (panelCss = css))
  }

  /**
   * The text over the scene (the bio, and the top bar on a dark sky) takes
   * the hour's cream, muted toward the ground, more so the deeper the night,
   * so it sits in the scene rather than glaring white (garden.css).
   */
  const matchInk = (p: Palette) => {
    const ink = mix(p.panelInk, p.ground, 0.1 + 0.2 * p.night)
    const muted = mix(ink, p.ground, 0.22)
    const rgb = (c: Rgb) => `rgb(${c[0] | 0} ${c[1] | 0} ${c[2] | 0})`
    const css = rgb(ink)
    if (css === inkCss) return
    html.style.setProperty('--garden-ink', (inkCss = css))
    html.style.setProperty('--garden-ink-muted', rgb(muted))
  }

  /** Window px → scene px, from the canvas's own top-left. */
  const sceneRect = (b: DOMRect, origin: DOMRect): Rect => ({
    left: toScene(b.left - origin.left),
    top: toScene(b.top - origin.top),
    right: toScene(b.right - origin.left),
    bottom: toScene(b.bottom - origin.top),
  })

  const measure = () => {
    const origin = canvas.getBoundingClientRect()
    const boxes: Rect[] = []
    // The top bar too, which sits outside `root`.
    for (const el of document.querySelectorAll<HTMLElement>('[data-avoid]')) {
      const b = el.getBoundingClientRect()
      if (b.width > 0 && b.height > 0) boxes.push(sceneRect(b, origin))
    }
    ascii.setDimBoxes(boxes)
  }

  /**
   * Records the scene and draws the latest rasterised frame. In the loop the
   * raster workers fill this frame's shapes while the page shows the one
   * before; `now` draws this frame itself, for one-off redraws.
   */
  const draw = (now = false) => {
    // Nothing to draw into until the canvas has a size.
    if (width === 0) return
    const palette = paletteAt(hour)
    const page = pageFor(palette)
    matchEdge(palette)
    matchSky(palette)
    matchPanel(palette)
    matchInk(palette)
    garden.hour = hour
    if (now || !raster.busy) {
      raster.clear()
      garden.draw(raster, palette)
      raster.submit(now)
    }
    if (!raster.ready) return
    ascii.render({
      raster,
      palette,
      time: garden.time,
      horizon: garden.horizon,
      page,
      veil: 0,
      pointer: wind.pointer,
      backdrop: (ctx) => garden.backdrop(ctx, palette),
      backdropKey: garden.backdropKey(palette),
      hillTop: (x) => garden.hillTop(x),
    })
  }

  const resize = () => {
    const box = canvas.getBoundingClientRect()
    const w = toScene(box.width)
    const h = toScene(box.height)
    if (w === 0 || h === 0) return
    ascii.resize(
      w,
      h,
      Math.min(window.devicePixelRatio || 1, 2) * SCENE_ZOOM,
      CELL,
    )
    raster.resize(ascii.cols, ascii.rows, ascii.cw, ascii.ch)
    if (w !== width || h !== height) {
      width = w
      height = h
      const bio = root.querySelector<HTMLElement>('.bio')
      garden.keepClear = bio
        ? sceneRect(bio.getBoundingClientRect(), box)
        : null
      garden.resize(w, h)
      if (reduced.matches) garden.skipIntro()
    }
    measure()
    // Rasterise this size's first frame here: a worker's first reply can be
    // a while coming, and the canvas would show black until then.
    draw(true)
  }

  // ── scrubbing the hour ────────────────────────────────────────────

  let scrubVel = 0
  let lastWheel = 0
  // The axis a scroll gesture started on, kept until the wheel rests.
  let wheelAxis: 'x' | 'y' | null = null

  const setScrubHour = (h: number) => {
    live = false
    hour = ((h % 24) + 24) % 24
    // The rest of the page (its colours, the time slider) follows.
    setHour(hour)
    showHour()
  }

  // The hour set elsewhere: the time slider, or its `now`.
  const onHourChange = () => {
    const now = currentHour()
    hour = now.hour
    live = !now.set
    showHour()
    if (reduced.matches) draw(true)
  }

  const onWheel = (e: WheelEvent) => {
    // The time slider handles its own scroll.
    if (!visible || e.defaultPrevented) return
    // Sideways always scrubs; up and down scrub too while the page has
    // nowhere to scroll, as home's single screen doesn't. Down and right run
    // later, like the slider.
    // A slow sideways swipe drifts up and down too, sometimes more than it
    // moves sideways; read per event, that drift would push the hour the
    // wrong way. So a gesture keeps the axis it started on.
    if (e.timeStamp - lastWheel > WHEEL_REST) wheelAxis = null
    wheelAxis ??= Math.abs(e.deltaX) > Math.abs(e.deltaY) ? 'x' : 'y'
    const sideways = wheelAxis === 'x'
    const scrolls =
      document.documentElement.scrollHeight > window.innerHeight + 1
    if (!sideways && scrolls) return
    e.preventDefault()
    const d = sideways ? e.deltaX : e.deltaY
    const px = e.deltaMode === 1 ? d * 16 : d
    const dt = Math.max(8, Math.min(100, e.timeStamp - lastWheel)) / 1000
    lastWheel = e.timeStamp
    scrubVel +=
      (Math.max(-GLIDE_MAX, Math.min(GLIDE_MAX, px / dt)) - scrubVel) * 0.4
    setScrubHour(hour + px * HOURS_PER_PX)
    if (reduced.matches) draw(true)
  }

  /** After the wheel goes quiet, the scrub keeps a little speed and eases to a stop. */
  const glide = (dt: number, now: number) => {
    if (scrubVel === 0 || now - lastWheel < 60) return
    if (reduced.matches) {
      scrubVel = 0
      return
    }
    setScrubHour(hour + scrubVel * dt * HOURS_PER_PX)
    scrubVel *= Math.exp(-GLIDE_DECAY * dt)
    if (Math.abs(scrubVel) < 5) scrubVel = 0
  }

  // ── loop ──────────────────────────────────────────────────────────

  const frame = (now: number) => {
    if (now - last < MIN_FRAME) {
      raf = requestAnimationFrame(frame)
      return
    }
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    acc += dt
    glide(dt, now)
    if (live && frames % 60 === 0) {
      hour = localHour()
      showHour()
    }
    const palette = paletteAt(hour)
    let steps = 0
    while (acc >= STEP && steps < MAX_STEPS) {
      wind.step(STEP)
      garden.step(STEP, palette)
      acc -= STEP
      steps++
    }
    if (steps === MAX_STEPS) acc = 0
    if (++frames % MEASURE_EVERY === 0) measure()
    draw()
    raf = requestAnimationFrame(frame)
  }

  const stop = () => {
    cancelAnimationFrame(raf)
    raf = 0
  }

  const start = () => {
    stop()
    if (!visible || document.hidden) return
    if (reduced.matches) {
      garden.skipIntro()
      // Let the stems settle into the breeze, then hold still.
      for (let i = 0; i < 120; i++) {
        wind.step(STEP)
        garden.step(STEP, paletteAt(hour))
      }
      draw(true)
      return
    }
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }

  // ── input ─────────────────────────────────────────────────────────

  let lastMove = 0
  const onMove = (e: PointerEvent) => {
    const origin = canvas.getBoundingClientRect()
    const x = toScene(e.clientX - origin.left)
    const y = toScene(e.clientY - origin.top)
    const p = wind.pointer
    const dt = Math.max(1, e.timeStamp - lastMove) / 1000
    lastMove = e.timeStamp
    if (p.active) {
      p.vx += ((x - p.x) / dt - p.vx) * 0.5
      p.vy += ((y - p.y) / dt - p.vy) * 0.5
    }
    p.x = x
    p.y = y
    p.active = true
  }
  const leave = () => {
    wind.pointer.active = false
    wind.pointer.vx = 0
    wind.pointer.vy = 0
  }
  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === 'touch') leave()
  }

  const onClick = (e: MouseEvent) => {
    const interactive = e
      .composedPath()
      .some(
        (n) =>
          n instanceof Element && n.matches('a, button, input, label, form'),
      )
    if (interactive) return
    const origin = canvas.getBoundingClientRect()
    const x = toScene(e.clientX - origin.left)
    const y = toScene(e.clientY - origin.top)
    if (y < 0 || y > height) return
    const head = garden.headAt(x, y)
    if (head) {
      garden.visit(head)
      return
    }
    if (garden.sow(x, y) && reduced.matches) {
      garden.skipIntro()
      draw(true)
    }
  }

  const onVisibility = () => (document.hidden ? stop() : start())

  // Off screen (scrolled past), the scene stops drawing.
  const seen = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    if (visible) start()
    else stop()
  })
  seen.observe(canvas)
  const sized = new ResizeObserver(() => resize())
  sized.observe(canvas)

  window.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('pointermove', onMove, { passive: true })
  html.addEventListener('pointerleave', leave)
  window.addEventListener('blur', leave)
  window.addEventListener('pointerup', onPointerUp)
  root.addEventListener('click', onClick)
  reduced.addEventListener('change', start)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener(HOUR_EVENT, onHourChange)

  showHour()
  resize()
  start()
  // Redraw once the glyph font arrives, since canvas text doesn't reflow.
  let disposed = false
  document.fonts.load(`500 12px ${font}`).then(() => {
    if (disposed) return
    ascii.fontsReady()
    draw()
  })

  if (process.env.NODE_ENV === 'development') {
    Object.assign(window, { garden, ascii, wind })
  }

  return () => {
    disposed = true
    stop()
    seen.disconnect()
    sized.disconnect()
    window.removeEventListener('wheel', onWheel)
    window.removeEventListener('pointermove', onMove)
    html.removeEventListener('pointerleave', leave)
    window.removeEventListener('blur', leave)
    window.removeEventListener('pointerup', onPointerUp)
    root.removeEventListener('click', onClick)
    reduced.removeEventListener('change', start)
    document.removeEventListener('visibilitychange', onVisibility)
    raster.dispose()
    window.removeEventListener(HOUR_EVENT, onHourChange)
    delete html.dataset.sky
    html.style.removeProperty('--garden-ink')
    html.style.removeProperty('--garden-ink-muted')
  }
}
