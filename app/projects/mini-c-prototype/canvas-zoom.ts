// The stage as a canvas: two fingers
// on a trackpad (or a wheel) pan it, a pinch (or ctrl + wheel) zooms it
// about the pointer, and two fingers on a touch screen do both. It starts
// fitted (the layout the stage computes) and never lets the content leave:
// zoomed out, it stays inside the stage; zoomed in, its edges stay at the
// stage's edges. Past a bound it stretches like a rubber band (the harder
// the pull, the less it gives); pulled back, it follows the hand straight
// away; and once the gesture (and its momentum) stops, it springs back.
// Nothing springs while a gesture is still coming in, so it never pulls
// against the hand. No scrollbars.
// While the pointer is over the stage the page doesn't scroll: a trackpad
// gesture over it otherwise shows the page's scrollbar (macOS does, before
// any event reaches the page), though every wheel event here is taken.
// A pane on the stage that scrolls (the assembly listing) takes the wheel
// while it can still scroll that way.
// The transform goes straight onto the layer, not through React; the
// stage's ruled rows follow it through CSS variables on the scene. At rest
// it sits on whole pixels, so text on the stage stays sharp.

const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
// The most a pull past a bound can show, approached but never reached: in
// px, and for zoom as a share of the limit.
const GIVE = 80
const ZOOM_GIVE = 0.2
// How stiff the rubber band is (0.55 is the iOS scroll view's).
const STRETCH = 0.55
// A gesture has stopped once no wheel event has come for this long.
const SETTLE_MS = 150
// The spring back, critically damped: how fast it closes, per ms.
const SPRING = 0.02
const GLIDE = 0.012

export type CanvasView = { x: number; y: number; k: number }

export type Canvas = {
  // The content's size in canvas px (it can be wider than the stage).
  size(width: number, height: number): void
  view(): CanvasView
  panBy(dx: number, dy: number, animated: boolean): void
  home(animated: boolean): void
  stop(): void
}

type Range = [number, number]

// Past a bound, a raw pull r shows as this much (and back).
const stretch = (r: number, give: number) =>
  give * (1 - 1 / ((r * STRETCH) / give + 1))
const unstretch = (s: number, give: number) =>
  (give / STRETCH) * (1 / (1 - Math.min(s, give * 0.999) / give) - 1)
// A position moved by d as the hand sees it. Outward past a bound: back
// to the raw pull, moved, and stretched again, so the give is one smooth
// curve however the moves are cut up. Back in: one for one, so it answers
// at once however far the pull had gone.
const moved = (v: number, d: number, [lo, hi]: Range, give: number): number => {
  if ((v < lo && d > 0) || (v > hi && d < 0)) {
    const n = v + d
    // (past the other bound, the rest of the move stretches again)
    if (n < lo && v > hi) return moved(lo, n - lo, [lo, hi], give)
    if (n > hi && v < lo) return moved(hi, n - hi, [lo, hi], give)
    return n
  }
  const raw =
    v < lo
      ? lo - unstretch(lo - v, give)
      : v > hi
        ? hi + unstretch(v - hi, give)
        : v
  const n = raw + d
  return n < lo
    ? lo - stretch(lo - n, give)
    : n > hi
      ? hi + stretch(n - hi, give)
      : n
}
// How far a position is past its range (signed; 0 inside).
const past = (v: number, [lo, hi]: Range) =>
  v < lo ? v - lo : v > hi ? v - hi : 0

export function startCanvas(
  scene: HTMLElement,
  layer: HTMLElement,
  onHome: (home: boolean) => void,
): Canvas {
  let x = 0,
    y = 0,
    k = 1
  let width = scene.clientWidth,
    height = scene.clientHeight
  let settleTimer = 0
  let spring = 0
  let wasHome = true
  // The hand's speed (px per ms, as shown), for the bounce a flick makes.
  let speed = { x: 0, y: 0 }
  let lastInput = 0

  const vw = () => scene.clientWidth
  const vh = () => scene.clientHeight

  // Where the content's corner may go along one axis at zoom z.
  const range = (content: number, view: number): Range =>
    content <= view ? [0, view - content] : [view - content, 0]
  const limits = (z = k) => ({
    x: range(width * z, vw()),
    y: range(height * z, vh()),
  })

  const apply = () => {
    layer.style.transform =
      x || y || k !== 1 ? `translate(${x}px, ${y}px) scale(${k})` : ''
    scene.style.setProperty('--zoom', String(k))
    scene.style.setProperty('--pan-y', `${y}px`)
    // Emit's assembly keeps its place sideways while the tree pans under
    // it, as it did when the stage scrolled (animated.css, .ac-pin).
    const pin = Math.min(Math.max(-x / k, 0), Math.max(0, width - vw()))
    scene.style.setProperty('--pin', `${pin}px`)
    const home =
      Math.abs(x) < 0.5 && Math.abs(y) < 0.5 && Math.abs(k - 1) < 0.001
    if (home !== wasHome) onHome((wasHome = home))
  }

  const stopSpring = () => {
    cancelAnimationFrame(spring)
    spring = 0
  }
  // A critically damped spring to `to`, starting at the hand's speed.
  const springTo = (to: CanvasView, rate = SPRING, v = { x: 0, y: 0 }) => {
    stopSpring()
    const from = { x: x - to.x, y: y - to.y, k: Math.log(k / to.k) }
    const start = performance.now()
    const at = (x0: number, v0: number, t: number) =>
      (x0 + (v0 + rate * x0) * t) * Math.exp(-rate * t)
    const frame = (now: number) => {
      const t = now - start
      const dx = at(from.x, v.x, t),
        dy = at(from.y, v.y, t),
        dk = at(from.k, 0, t)
      const done =
        t > 60 &&
        Math.abs(dx) < 0.25 &&
        Math.abs(dy) < 0.25 &&
        Math.abs(dk) < 1e-4
      x = done ? to.x : to.x + dx
      y = done ? to.y : to.y + dy
      k = done ? to.k : to.k * Math.exp(dk)
      apply()
      spring = done ? 0 : requestAnimationFrame(frame)
    }
    spring = requestAnimationFrame(frame)
  }

  // The nearest view inside every bound, on whole pixels, zooming about
  // (px, py).
  const clamped = (px = vw() / 2, py = vh() / 2): CanvasView => {
    const nk = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k))
    let nx = px - ((px - x) * nk) / k,
      ny = py - ((py - y) * nk) / k
    const l = limits(nk)
    nx -= past(nx, l.x)
    ny -= past(ny, l.y)
    return { x: Math.round(nx), y: Math.round(ny), k: nk }
  }
  let anchor = { x: 0, y: 0 }
  const settle = (v = { x: 0, y: 0 }) => {
    clearTimeout(settleTimer)
    settleTimer = 0
    const to = clamped(anchor.x, anchor.y)
    if (to.x !== x || to.y !== y || to.k !== k) springTo(to, SPRING, v)
  }
  const settleSoon = () => {
    clearTimeout(settleTimer)
    settleTimer = window.setTimeout(() => {
      settleTimer = 0
      settle()
    }, SETTLE_MS)
  }

  const pan = (dx: number, dy: number) => {
    const now = performance.now()
    const dt = Math.max(8, now - lastInput)
    const was = { x, y }
    const l = limits()
    x = moved(x, dx, l.x, GIVE)
    y = moved(y, dy, l.y, GIVE)
    const fresh = now - lastInput > 100
    speed = {
      x: (fresh ? 0 : speed.x * 0.5) + ((x - was.x) / dt) * (fresh ? 1 : 0.5),
      y: (fresh ? 0 : speed.y * 0.5) + ((y - was.y) / dt) * (fresh ? 1 : 0.5),
    }
    lastInput = now
  }
  // Zoom stretches the same way, in steps of its logarithm.
  const zoomAt = (px: number, py: number, factor: number) => {
    const next = Math.exp(
      moved(
        Math.log(k),
        Math.log(factor),
        [Math.log(MIN_ZOOM), Math.log(MAX_ZOOM)],
        Math.log(1 + ZOOM_GIVE),
      ),
    )
    x = px - ((px - x) * next) / k
    y = py - ((py - y) * next) / k
    k = next
    lastInput = performance.now()
  }

  const local = (cx: number, cy: number) => {
    const box = scene.getBoundingClientRect()
    return { x: cx - box.left, y: cy - box.top }
  }

  // A pane between the pointer and the stage that can still scroll the
  // wheel's way takes it.
  const scrollsFor = (target: EventTarget | null, dx: number, dy: number) => {
    for (
      let el = target instanceof Element ? target : null;
      el && el !== scene;
      el = el.parentElement
    ) {
      const style = getComputedStyle(el)
      const canY =
        /auto|scroll/.test(style.overflowY) && el.scrollHeight > el.clientHeight
      const canX =
        /auto|scroll/.test(style.overflowX) && el.scrollWidth > el.clientWidth
      if (
        canY &&
        Math.abs(dy) >= Math.abs(dx) &&
        (dy < 0
          ? el.scrollTop > 0
          : el.scrollTop < el.scrollHeight - el.clientHeight - 1)
      )
        return true
      if (
        canX &&
        Math.abs(dx) > Math.abs(dy) &&
        (dx < 0
          ? el.scrollLeft > 0
          : el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
      )
        return true
    }
    return false
  }

  const wheeled = (e: WheelEvent) => {
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vh() : 1
    const dx = e.deltaX * unit,
      dy = e.deltaY * unit
    if (!e.ctrlKey && scrollsFor(e.target, dx, dy)) return
    e.preventDefault()
    anchor = local(e.clientX, e.clientY)
    stopSpring()
    if (e.ctrlKey) {
      // (a mouse wheel's notch is 100px; a pinch sends a few px at a time)
      zoomAt(
        anchor.x,
        anchor.y,
        Math.exp(-Math.max(-25, Math.min(25, dy)) * 0.01),
      )
      apply()
      return settleSoon()
    }
    pan(-dx, -dy)
    apply()
    settleSoon()
  }

  // Safari's trackpad pinch (it sends gesture events, not ctrl + wheel).
  let gestureScale = 1
  const gestureStarted = (e: Event) => {
    e.preventDefault()
    stopSpring()
    gestureScale = 1
  }
  const gestureChanged = (e: Event) => {
    const g = e as Event & { scale: number; clientX: number; clientY: number }
    e.preventDefault()
    anchor = local(g.clientX, g.clientY)
    zoomAt(anchor.x, anchor.y, g.scale / gestureScale)
    gestureScale = g.scale
    apply()
    settleSoon()
  }

  // Two fingers on a touch screen: pan with their midpoint, zoom with
  // their spread. One finger is left to the page.
  let pair: { x: number; y: number; d: number } | null = null
  const measure = (t: TouchList) => {
    const a = local(t[0].clientX, t[0].clientY),
      b = local(t[1].clientX, t[1].clientY)
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      d: Math.hypot(a.x - b.x, a.y - b.y),
    }
  }
  const touched = (e: TouchEvent) => {
    if (e.touches.length !== 2) return
    e.preventDefault()
    stopSpring()
    clearTimeout(settleTimer)
    pair = measure(e.touches)
    lastInput = 0
  }
  const touchMoved = (e: TouchEvent) => {
    if (!pair || e.touches.length !== 2) return
    e.preventDefault()
    const now = measure(e.touches)
    if (pair.d > 0) zoomAt(pair.x, pair.y, now.d / pair.d)
    pan(now.x - pair.x, now.y - pair.y)
    anchor = { x: now.x, y: now.y }
    pair = now
    apply()
  }
  const touchEnded = (e: TouchEvent) => {
    if (!pair || e.touches.length === 2) return
    pair = null
    settle(performance.now() - lastInput < 60 ? speed : undefined)
  }

  // The page holds still under the stage (the gutter stays, so nothing
  // shifts).
  const root = document.documentElement
  const entered = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') root.style.overflowY = 'hidden'
  }
  const left = () => root.style.removeProperty('overflow-y')
  scene.addEventListener('pointerenter', entered)
  scene.addEventListener('pointerleave', left)
  scene.addEventListener('wheel', wheeled, { passive: false })
  scene.addEventListener('gesturestart', gestureStarted)
  scene.addEventListener('gesturechange', gestureChanged)
  scene.addEventListener('touchstart', touched, { passive: false })
  scene.addEventListener('touchmove', touchMoved, { passive: false })
  scene.addEventListener('touchend', touchEnded)
  scene.addEventListener('touchcancel', touchEnded)
  // The stage resizing moves the bounds with it.
  const observer = new ResizeObserver(() => {
    ;({ x, y, k } = clamped())
    apply()
  })
  observer.observe(scene)
  apply()

  return {
    size(w, h) {
      width = w
      height = h
      if (!spring && !settleTimer && !pair) settle()
    },
    view: () => ({ x, y, k }),
    panBy(dx, dy, animated) {
      const saved = { x, y }
      x += dx
      y += dy
      const to = clamped()
      ;({ x, y } = saved)
      if (animated) return springTo(to, GLIDE)
      ;({ x, y, k } = to)
      apply()
    },
    home(animated) {
      clearTimeout(settleTimer)
      settleTimer = 0
      if (animated) return springTo({ x: 0, y: 0, k: 1 }, GLIDE)
      stopSpring()
      x = y = 0
      k = 1
      apply()
    },
    stop() {
      stopSpring()
      clearTimeout(settleTimer)
      observer.disconnect()
      scene.removeEventListener('pointerenter', entered)
      scene.removeEventListener('pointerleave', left)
      left()
      scene.removeEventListener('wheel', wheeled)
      scene.removeEventListener('gesturestart', gestureStarted)
      scene.removeEventListener('gesturechange', gestureChanged)
      scene.removeEventListener('touchstart', touched)
      scene.removeEventListener('touchmove', touchMoved)
      scene.removeEventListener('touchend', touchEnded)
      scene.removeEventListener('touchcancel', touchEnded)
      layer.style.transform = ''
    },
  }
}
