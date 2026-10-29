// Runs the meadow on the home page: the engine in ./engine, ported from the
// ascii-garden prototype (its main.ts, minus the dev control panel).

import { currentHour, HOUR_EVENT, setHour } from '@/lib/circadian'

import { AsciiRenderer, type Rect } from './engine/ascii'
import { Birds, BY_DAY } from './engine/birds'
import { Garden } from './engine/garden'
import { smoothstep } from './engine/math'
import { Meteors, STILL_FOR } from './engine/meteors'
import { mix, paletteAt, type Palette, type Rgb } from './engine/palette'
import { Raster } from './engine/raster'
import { Wind } from './engine/wind'
import { playIntro } from './intro'
import { Quality } from './quality'

// Stepped at 120 Hz so a 120 Hz display gets a new pose every frame; the stems' springs scale
// with the step, so their motion is the same at any rate.
const STEP = 1 / 120
const MAX_STEPS = 6
const MEASURE_EVERY = 30
/** How long after the cursor or a scrub last moved, in ms, the page keeps drawing every frame. */
const LIVELY_FOR = 1000

// The site's page colours (tokens.css); the scene fades into them.
const PAGE: Record<'dark' | 'light', Rgb> = {
  dark: [27, 27, 25],
  light: [235, 234, 230],
}

// The scene is laid out as if the page were zoomed out to 64%: a finer grid,
// smaller marks and a wider meadow at full device resolution, so flowers read
// as flowers rather than filling the screen. Text keeps its size. Phones use
// the same zoom, so their meadow is the desktop's at the same scale.
const SCENE_ZOOM = 0.64
/** Cell width in scene px: the prototype's finest grid. */
const CELL = 5
/**
 * Most cells the grid lays out, about a 27-inch 1440p window's worth at SCENE_ZOOM. A bigger
 * window zooms the scene in instead, so its cost stops growing with its area.
 */
const CELL_BUDGET = 270_000
/** How much further a machine too slow for the full grid zooms in (quality.ts). */
const COARSE_ZOOM = 1.25

/** Hours of scene time per pixel of sideways scroll: a day is about three screen-widths. */
const HOURS_PER_PX = 1 / 120
/** A pause in the wheel this long, in ms, ends a scroll gesture. */
const WHEEL_REST = 200
/** How fast a released scrub's glide dies away, per second. */
const GLIDE_DECAY = 8
/** Fastest glide, px/s, so a hard flick only drifts on a little after release. */
const GLIDE_MAX = 1200
/** Wheel px per px of finger travel: a phone-height swipe runs about nine hours. */
const TOUCH_GAIN = 1.5
/** Finger travel, in px, before a touch picks its axis; less is a tap. */
const TOUCH_SLOP = 6

/**
 * Set once the garden has run in this page session. Client-side navigation keeps this module, so
 * coming back to home shows the meadow grown; a reload starts it over and it grows in again.
 */
let grownBefore = false

type GardenOptions = {
  canvas: HTMLCanvasElement
  /** Holds the bio (`.bio`) or a column of text (`[data-clear-column]`), which no flower is
   * planted under (a column keeps only a few dandelions), and takes the clicks that sow. */
  root: HTMLElement
  /** The glyph face's CSS family list. */
  font: string
  /** Called with the scene's hour, as HH:MM, whenever it changes minute, and whether it follows the clock. */
  onHour?: (label: string, live: boolean) => void
  /** Called once the scene has a size, and on each resize, with when the sun clears and meets the
   * ridges and when the moon sets behind them. */
  onSky?: (sky: { sunrise: number; sunset: number; moonset: number }) => void
  /** Whether the wheel scrubs the hour; off where the page sets it (the poem's scroll). */
  scrub?: boolean
  /** Who answers a click on a flower: butterflies, or the poem's ladybug and bumblebee. */
  visitors?: 'butterflies' | 'friends'
  /** Called once the scene is up, with a way to grow the poem's rose, rooted `x` (a share of
   * the screen's width) across, to `grown` (0 to 1, full flower). */
  onReady?: (scene: { rose: (x: number, grown: number) => void }) => void
  /** The scene's zoom in place of SCENE_ZOOM: lower is a finer grid. */
  zoom?: number
  /** How hard the wind blows, 1 a full breeze. */
  wind?: number
}

function localHour() {
  const d = new Date()
  return d.getHours() + d.getMinutes() / 60
}

/** Starts the scene; the returned function stops it and removes its listeners. */
export function mountGarden({
  canvas,
  root,
  font,
  onHour,
  onSky,
  scrub = true,
  visitors = 'butterflies',
  onReady,
  zoom: sceneZoom = SCENE_ZOOM,
  wind: windStrength = 0.35,
}: GardenOptions) {
  const html = document.documentElement
  const quality = new Quality()
  let zoom = sceneZoom
  const toScene = (v: number) => v / zoom
  /** The scene's zoom for a canvas this size in CSS px: sceneZoom, or closer within the budget. */
  const zoomFor = (w: number, h: number) => {
    const cellArea = CELL * Math.round(CELL * 1.32)
    const fit = Math.sqrt((w * h) / (cellArea * CELL_BUDGET))
    return Math.max(sceneZoom, fit) * (quality.coarse ? COARSE_ZOOM : 1)
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const coarse = window.matchMedia('(pointer: coarse)')
  let heartTimer = 0
  let starTimer = 0
  const wind = new Wind()
  wind.strength = windStrength
  const raster = new Raster()
  const ascii = new AsciiRenderer(canvas, font)
  const meteors = new Meteors()
  const birds = new Birds()
  // The page's hour (lib/circadian.ts): the clock's, or one set on the time
  // slider or by scrubbing here.
  const start0 = currentHour()
  let hour = start0.hour
  let live = !start0.set
  const garden = new Garden(wind, paletteAt(hour))
  if (visitors === 'friends') garden.useFriends()
  // `?seed=` pins the meadow, so a measurement or a screenshot can be repeated.
  const pinned = Number(new URLSearchParams(location.search).get('seed'))
  if (Number.isInteger(pinned) && pinned > 0) garden.useSeed(pinned)

  let width = 0
  let height = 0
  let frames = 0
  let raf = 0
  let last = performance.now()
  let acc = 0
  let visible = true
  let hourLabel = ''
  let edgeCss = ''
  let topCss = ''
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

  /**
   * The page behind the canvas matches its edge, so a sub-pixel gap never
   * shows. Its top and bottom colours also go to garden.css, which paints the
   * page and the strips Safari tints its bars from (garden-home.tsx).
   */
  const matchEdge = (p: Palette) => {
    const [r, g, b] = mix(p.ground, p.skyHorizon, 0.08)
    const css = `rgb(${r | 0} ${g | 0} ${b | 0})`
    if (css !== edgeCss) {
      canvas.style.backgroundColor = edgeCss = css
      html.style.setProperty('--garden-edge', css)
    }
    const [tr, tg, tb] = p.skyTop
    const top = `rgb(${tr | 0} ${tg | 0} ${tb | 0})`
    if (top !== topCss) html.style.setProperty('--garden-top', (topCss = top))
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
      // Text that carries its own halo instead (garden.css, on phones).
      if (getComputedStyle(el).getPropertyValue('--avoid').trim() === 'none')
        continue
      const b = el.getBoundingClientRect()
      if (b.width > 0 && b.height > 0) boxes.push(sceneRect(b, origin))
    }
    ascii.setDimBoxes(boxes)
  }

  // Top of the painted hills per cell column, sent with each frame for the ink to contrast with.
  let hill = new Float32Array(0)
  // The highest ridge on screen, which birds fly above.
  let peak = Infinity
  // The far range's faces per cell, for the rock's tiles.
  let relief = new Float32Array(0)

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
    if (now || (!raster.busy && quality.mayRecord(performance.now()))) {
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
      const face = garden.relief(
        relief,
        ascii.cols,
        ascii.rows,
        ascii.cw,
        ascii.ch,
        palette,
      )
      raster.submit(now, {
        palette,
        horizon: garden.horizon,
        hill,
        relief,
        reliefLight: face.color,
        reliefLit: face.lit,
      })
    }
    if (!raster.ready) return
    const secs = performance.now() / 1000
    meteors.paint(secs, palette, palette.ink)
    birds.fly(
      secs,
      palette.night < BY_DAY && !reduced.matches ? skyFor() : null,
    )
    birds.paint(secs, palette)
    ascii.render({
      raster,
      palette,
      time: garden.time,
      horizon: garden.horizon,
      page,
      veil: 0,
      pointer: wind.pointer,
      meteors,
      birds,
      backdrop: (ctx) => garden.backdrop(ctx, palette),
      backdropKey: garden.backdropKey(palette),
    })
    // The opening shows the meadow once the workers are past their slow first frames.
    if (raster.warm) playIntro()
  }

  /** Where birds may fly: from under the header down to three rows over the highest ridge. */
  const skyFor = () => {
    const top = 0.14 * height
    return {
      W: width,
      H: height,
      cw: ascii.cw,
      ch: ascii.ch,
      top,
      bottom: Math.max(top, Math.min(0.3 * height, peak - 3 * ascii.ch)),
    }
  }

  /** The canvas size and density last laid out, so a callback at the same size does nothing. */
  let laidOut = ''

  const resize = () => {
    const box = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const size = `${box.width}/${box.height}/${dpr}`
    if (box.width === 0 || box.height === 0 || size === laidOut) return
    laidOut = size
    busy()
    zoom = zoomFor(box.width, box.height)
    const w = toScene(box.width)
    const h = toScene(box.height)
    ascii.resize(w, h, dpr * zoom, CELL)
    raster.resize(ascii.cols, ascii.rows, ascii.cw, ascii.ch)
    meteors.resize(ascii.cols, ascii.rows)
    birds.resize(ascii.cols, ascii.rows)
    if (w !== width || h !== height) {
      width = w
      height = h
      const bio = root.querySelector<HTMLElement>('.bio, [data-clear-column]')
      const clear = bio ? sceneRect(bio.getBoundingClientRect(), box) : null
      // Text that scrolls over the scene (the poem) crosses all of it, top to bottom.
      garden.keepClearColumn = !!bio?.hasAttribute('data-clear-column')
      garden.keepClear =
        clear && garden.keepClearColumn
          ? { ...clear, top: 0, bottom: h }
          : clear
      garden.resize(w, h)
      if (reduced.matches || grownBefore) garden.skipIntro()
      onSky?.(garden.sunTimes())
    }
    measure()
    // Rasterise this size's first frame here: a worker's first reply can be
    // a while coming, and the canvas would show black until then.
    draw(true)
  }

  // ── scrubbing the hour ────────────────────────────────────────────

  let scrubVel = 0
  /**
   * Until when the page is busy with work of its own (restyling for a new hour, laying out a new
   * size), so quality.ts doesn't take the slow frames for a slow machine.
   */
  let busyUntil = 0
  const busy = () => (busyUntil = Math.max(busyUntil, performance.now() + 500))
  let lastWheel = 0
  /** When the wheel or a finger last moved the hour, on the event clock. */
  let lastScrub = 0
  // The axis a scroll gesture started on, kept until the wheel rests.
  let wheelAxis: 'x' | 'y' | null = null
  // The hour scrubbed here but not yet handed to the rest of the page.
  let unsent = false

  /** Hands a scrubbed hour to the rest of the page (its colours, the time slider). */
  const sendHour = () => {
    if (!unsent) return
    unsent = false
    setHour(hour)
  }

  const setScrubHour = (h: number) => {
    live = false
    hour = ((h % 24) + 24) % 24
    showHour()
    // Restyling the page costs far more than a frame of the scene, and a
    // finger moves at up to 120 Hz, so the loop sends the hour once a frame.
    unsent = true
    if (reduced.matches || !raf) sendHour()
  }

  /** Moves the hour by `px` of wheel travel, and keeps its speed for the glide. */
  const scrubBy = (px: number, at: number) => {
    const dt = Math.max(8, Math.min(100, at - lastScrub)) / 1000
    lastScrub = at
    busy()
    scrubVel +=
      (Math.max(-GLIDE_MAX, Math.min(GLIDE_MAX, px / dt)) - scrubVel) * 0.4
    setScrubHour(hour + px * HOURS_PER_PX)
    if (reduced.matches) draw(true)
  }

  /** Whether the page scrolls up and down, so a vertical gesture should scroll it instead. */
  const pageScrolls = () => html.scrollHeight > html.clientHeight + 1

  // The hour set elsewhere: the time slider, or its `now`.
  const onHourChange = () => {
    busy()
    const now = currentHour()
    hour = now.hour
    live = !now.set
    showHour()
    if (reduced.matches) draw(true)
  }

  const onWheel = (e: WheelEvent) => {
    // The time slider handles its own scroll.
    if (!scrub || !visible || e.defaultPrevented) return
    // Sideways always scrubs; up and down scrub too while the page has
    // nowhere to scroll, as home's single screen doesn't. Down and right run
    // later, like the slider.
    // A slow sideways swipe drifts up and down too, sometimes more than it
    // moves sideways; read per event, that drift would push the hour the
    // wrong way. So a gesture keeps the axis it started on.
    if (e.timeStamp - lastWheel > WHEEL_REST) wheelAxis = null
    wheelAxis ??= Math.abs(e.deltaX) > Math.abs(e.deltaY) ? 'x' : 'y'
    const sideways = wheelAxis === 'x'
    if (!sideways && pageScrolls()) return
    e.preventDefault()
    lastWheel = e.timeStamp
    const d = sideways ? e.deltaX : e.deltaY
    scrubBy(e.deltaMode === 1 ? d * 16 : d, e.timeStamp)
  }

  // A finger on a phone scrubs up and down only: a swipe up runs later. A
  // sideways swipe leaves the hour alone, as it reads more like a pan than a
  // dial. A gesture keeps the axis it started on.
  let touch: { x: number; y: number; axis: 'x' | 'y' | null } | null = null
  // A finger that lands on a flower is holding it, to push it about: it
  // neither scrubs nor scrolls the page (whose scroll sets the poem's hour).
  let holding = false

  const onTouchStart = (e: TouchEvent) => {
    touch = null
    holding = false
    if (!visible || e.touches.length !== 1) return
    const t = e.target
    // The time slider takes its own drags.
    if (t instanceof Element && t.closest('.time-control-pop, input')) return
    const { clientX: x, clientY: y } = e.touches[0]
    if (
      t instanceof Element &&
      root.contains(t) &&
      // The poem's text doesn't sow, but a flower under it can still be held.
      !t.closest('a, button, label, form')
    ) {
      const origin = canvas.getBoundingClientRect()
      if (garden.headAt(toScene(x - origin.left), toScene(y - origin.top))) {
        holding = true
        scrubVel = 0
        return
      }
    }
    if (!scrub) return
    touch = { x, y, axis: null }
    // Putting a finger down catches a glide, as it would a page's momentum.
    scrubVel = 0
  }

  const onTouchMove = (e: TouchEvent) => {
    if (holding) {
      if (e.touches.length !== 1) holding = false
      else if (e.cancelable) e.preventDefault()
      return
    }
    if (!touch) return
    if (e.touches.length !== 1) {
      touch = null
      return
    }
    const { clientX: x, clientY: y } = e.touches[0]
    const dx = x - touch.x
    const dy = y - touch.y
    const scrolls = pageScrolls()
    if (!touch.axis) {
      // Hold the page still from the first move, or Safari starts a scroll
      // it won't give back; a page that scrolls keeps its vertical swipes.
      if (!scrolls && e.cancelable) e.preventDefault()
      if (Math.hypot(dx, dy) < TOUCH_SLOP) return
      touch.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (touch.axis === 'x' || scrolls) {
        touch = null
        return
      }
    }
    if (e.cancelable) e.preventDefault()
    touch.x = x
    touch.y = y
    scrubBy(-dy * TOUCH_GAIN, e.timeStamp)
  }

  const onTouchEnd = () => {
    touch = null
    holding = false
  }

  /** After the wheel goes quiet or the finger lifts, the scrub keeps a little speed and eases to a stop. */
  const glide = (dt: number, now: number) => {
    if (scrubVel === 0 || touch?.axis || now - lastScrub < 60) return
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
    const began = performance.now()
    // Set here rather than on mount: React's dev double-mount tears the first one down before
    // any frame runs.
    grownBefore = true
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    // The grow-in waits for the workers to warm, so the flowers come up smoothly from the start
    // rather than in jumps; meanwhile the workers rasterise the bare meadow, hidden (intro.ts).
    acc += garden.growing && !raster.warm ? 0 : dt
    glide(dt, now)
    sendHour()
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
    // The cursor's light and a shooting star move every display frame; the rest on the plants' beat.
    quality.calm =
      now - Math.max(lastMove, lastScrub) > LIVELY_FOR &&
      scrubVel === 0 &&
      !meteors.alive
    if (!quality.skip(frames)) draw()
    quality.frame(
      now,
      performance.now() - began,
      raster.version,
      now > busyUntil,
    )
    raf = requestAnimationFrame(frame)
  }

  const stop = () => {
    cancelAnimationFrame(raf)
    raf = 0
    // None hangs half drawn when the scene comes back.
    meteors.clear()
    birds.clear()
    sendHour()
  }

  const start = () => {
    stop()
    garden.holdStill(reduced.matches)
    if (!visible || document.hidden) return
    if (reduced.matches) {
      garden.skipIntro()
      // Let the stems settle into the breeze, then hold still.
      for (let i = 0; i < 2 / STEP; i++) {
        wind.step(STEP)
        garden.step(STEP, paletteAt(hour))
      }
      draw(true)
      return
    }
    last = performance.now()
    quality.reset()
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
    wind.pointer.pressed = false
    wind.pointer.vx = 0
    wind.pointer.vy = 0
  }
  const onPointerUp = (e: PointerEvent) => {
    wind.pointer.pressed = false
    if (e.pointerType === 'touch') leave()
  }

  // Pressing on the garden lets the cursor stir it while held. The press alone moves nothing:
  // only a moving cursor brushes the plants.
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    onMove(e)
    wind.pointer.pressed = true
  }

  const onClick = (e: MouseEvent) => {
    const interactive = e
      .composedPath()
      .some(
        (n) =>
          n instanceof Element &&
          n.matches('a, button, input, label, form, [data-no-sow]'),
      )
    if (interactive) return
    const origin = canvas.getBoundingClientRect()
    const x = toScene(e.clientX - origin.left)
    const y = toScene(e.clientY - origin.top)
    if (y < 0 || y > height) return
    // Bugs are small; a fingertip gets a bigger target than a pointer.
    if (garden.tapVisitor(x, y, toScene(coarse.matches ? 22 : 18))) {
      if (reduced.matches) {
        // The heart shows for a while, still, then goes: one frame for each.
        draw(true)
        clearTimeout(heartTimer)
        heartTimer = window.setTimeout(() => {
          garden.calmVisitors()
          draw(true)
        }, 1200)
      }
      return
    }
    const head = garden.headAt(x, y)
    if (head) {
      garden.visit(head)
      if (reduced.matches) draw(true)
      return
    }
    const night = paletteAt(hour).night
    const openSky = y < garden.hillTop(x) - 7
    // By day the open sky above the ridges sends a bird instead of a flower; reduced motion sows.
    if (night < BY_DAY && openSky && !reduced.matches) {
      birds.call(x, y, skyFor(), performance.now() / 1000)
      return
    }
    // After dark it takes a shooting star.
    if (night >= 0.5 && openSky) {
      const made = meteors.spawn(
        x,
        y,
        width,
        height,
        ascii.cw,
        ascii.ch,
        performance.now() / 1000,
        reduced.matches,
      )
      if (made && reduced.matches) {
        // Still: the whole streak for a moment, then gone, one frame for each.
        draw(true)
        clearTimeout(starTimer)
        starTimer = window.setTimeout(() => {
          meteors.clear()
          draw(true)
        }, STILL_FOR * 1000)
      }
      return
    }
    if (garden.sow(x, y) && reduced.matches) {
      garden.skipIntro()
      draw(true)
    }
  }

  const onVisibility = () => (document.hidden ? stop() : start())

  // A window on screen but out of use keeps its meadow moving, slowly (quality.ts).
  const onFocus = () => {
    const away = !document.hasFocus()
    if (away === quality.away) return
    quality.away = away
    quality.reset()
  }

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
  window.addEventListener('touchstart', onTouchStart, { passive: true })
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('touchend', onTouchEnd)
  window.addEventListener('touchcancel', onTouchEnd)
  window.addEventListener('pointermove', onMove, { passive: true })
  html.addEventListener('pointerleave', leave)
  window.addEventListener('blur', leave)
  window.addEventListener('blur', onFocus)
  window.addEventListener('focus', onFocus)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
  root.addEventListener('pointerdown', onPointerDown)
  root.addEventListener('click', onClick)
  reduced.addEventListener('change', start)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener(HOUR_EVENT, onHourChange)

  showHour()
  onFocus()
  resize()
  start()
  onReady?.({
    rose: (x, grown) => {
      const rose = garden.rose(width * x, grown)
      // With reduced motion it stands at the stage scrolled to rather than easing there.
      if (!reduced.matches) return
      rose.age = rose.goal
      for (let i = 0; i < 30; i++) garden.step(STEP, paletteAt(hour))
      draw(true)
    },
  })
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
    window.removeEventListener('touchstart', onTouchStart)
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('touchend', onTouchEnd)
    window.removeEventListener('touchcancel', onTouchEnd)
    window.removeEventListener('pointermove', onMove)
    html.removeEventListener('pointerleave', leave)
    window.removeEventListener('blur', leave)
    window.removeEventListener('blur', onFocus)
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    root.removeEventListener('pointerdown', onPointerDown)
    root.removeEventListener('click', onClick)
    clearTimeout(heartTimer)
    clearTimeout(starTimer)
    reduced.removeEventListener('change', start)
    document.removeEventListener('visibilitychange', onVisibility)
    raster.dispose()
    window.removeEventListener(HOUR_EVENT, onHourChange)
    delete html.dataset.sky
    html.style.removeProperty('--garden-ink')
    html.style.removeProperty('--garden-ink-muted')
    html.style.removeProperty('--garden-edge')
    html.style.removeProperty('--garden-top')
  }
}
