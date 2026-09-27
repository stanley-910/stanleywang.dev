// PROTOTYPE (wayfinder: stage canvas). The stage as a canvas: two fingers
// on a trackpad (or a wheel) pan it, a pinch (or ctrl + wheel) zooms it
// about the pointer, and two fingers on a touch screen do both. It starts
// fitted (the layout the stage computes) and never lets the content leave:
// zoomed out, it stays inside the stage; zoomed in, its edges stay at the
// stage's edges. Past a bound it gives a little, with resistance, and
// springs back once the gesture stops. No scrollbars.
// A pane on the stage that scrolls (the assembly listing) takes the wheel
// while it can still scroll that way.
// The transform goes straight onto the layer, not through React; the
// stage's ruled rows follow it through CSS variables on the scene.

const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
// How far past a bound a gesture can pull, in px (and in zoom, as a share
// of the limit), before it stops giving.
const GIVE = 72
const ZOOM_GIVE = 0.15
// A gesture has stopped once no wheel event has come for this long.
const SETTLE_MS = 140
const SPRING_MS = 240

export type CanvasView = { x: number; y: number; k: number }

export type Canvas = {
  // The content's size in canvas px (it can be wider than the stage).
  size(width: number, height: number): void
  view(): CanvasView
  panBy(dx: number, dy: number, animated: boolean): void
  home(animated: boolean): void
  stop(): void
}

const ease = (t: number) => 1 - (1 - t) ** 3

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
  let tween = 0
  let wasHome = true

  const vw = () => scene.clientWidth
  const vh = () => scene.clientHeight

  // Where the content's corner may go along one axis at zoom k.
  const range = (content: number, view: number): [number, number] =>
    content <= view ? [0, view - content] : [view - content, 0]
  const limits = () => ({
    x: range(width * k, vw()),
    y: range(height * k, vh()),
  })
  // How far a position is past its range (signed; 0 inside).
  const past = (v: number, [lo, hi]: [number, number]) =>
    v < lo ? v - lo : v > hi ? v - hi : 0

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

  const cancelTween = () => {
    cancelAnimationFrame(tween)
    tween = 0
  }
  const tweenTo = (to: CanvasView, ms: number) => {
    cancelTween()
    const from = { x, y, k }
    const start = performance.now()
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const e = ease(t)
      x = from.x + (to.x - from.x) * e
      y = from.y + (to.y - from.y) * e
      k = from.k + (to.k - from.k) * e
      apply()
      tween = t < 1 ? requestAnimationFrame(frame) : 0
    }
    tween = requestAnimationFrame(frame)
  }

  // The nearest view inside every bound, zooming about (px, py).
  const clamped = (px = vw() / 2, py = vh() / 2): CanvasView => {
    const nk = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k))
    let nx = px - ((px - x) * nk) / k,
      ny = py - ((py - y) * nk) / k
    const saved = k
    k = nk
    const l = limits()
    k = saved
    nx -= past(nx, l.x)
    ny -= past(ny, l.y)
    return { x: nx, y: ny, k: nk }
  }
  let lastPoint = { x: 0, y: 0 }
  const settle = () => {
    settleTimer = 0
    const to = clamped(lastPoint.x, lastPoint.y)
    if (to.x !== x || to.y !== y || to.k !== k) tweenTo(to, SPRING_MS)
  }
  const settleSoon = () => {
    clearTimeout(settleTimer)
    settleTimer = window.setTimeout(settle, SETTLE_MS)
  }

  // A move along one axis, with resistance past the range (`room` is how
  // far past it a move can pull).
  const give = (v: number, d: number, r: [number, number], room = GIVE) => {
    const beyond = past(v, r)
    if (beyond === 0 || Math.sign(d) !== Math.sign(beyond)) {
      const next = v + d
      const out = past(next, r)
      // Crossing the bound on this move: the part beyond it resists.
      return out === 0 ? next : next - out + out * 0.35
    }
    const f = Math.max(0, 1 - Math.abs(beyond) / room) ** 2
    return v + d * f
  }
  const pan = (dx: number, dy: number) => {
    const l = limits()
    x = give(x, dx, l.x)
    y = give(y, dy, l.y)
  }
  // Zoom resists the same way, in steps of its logarithm.
  const zoomAt = (px: number, py: number, factor: number) => {
    const next = Math.exp(
      give(
        Math.log(k),
        Math.log(factor),
        [Math.log(MIN_ZOOM), Math.log(MAX_ZOOM)],
        Math.log(1 + ZOOM_GIVE),
      ),
    )
    x = px - ((px - x) * next) / k
    y = py - ((py - y) * next) / k
    k = next
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
    cancelTween()
    lastPoint = local(e.clientX, e.clientY)
    // (a mouse wheel's notch is 100px; a pinch sends a few px at a time)
    if (e.ctrlKey)
      zoomAt(
        lastPoint.x,
        lastPoint.y,
        Math.exp(-Math.max(-25, Math.min(25, dy)) * 0.01),
      )
    else pan(-dx, -dy)
    apply()
    settleSoon()
  }

  // Safari's trackpad pinch (it sends gesture events, not ctrl + wheel).
  let gestureScale = 1
  const gestureStarted = (e: Event) => {
    e.preventDefault()
    cancelTween()
    gestureScale = 1
  }
  const gestureChanged = (e: Event) => {
    const g = e as Event & { scale: number; clientX: number; clientY: number }
    e.preventDefault()
    lastPoint = local(g.clientX, g.clientY)
    zoomAt(lastPoint.x, lastPoint.y, g.scale / gestureScale)
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
    cancelTween()
    clearTimeout(settleTimer)
    pair = measure(e.touches)
  }
  const touchMoved = (e: TouchEvent) => {
    if (!pair || e.touches.length !== 2) return
    e.preventDefault()
    const now = measure(e.touches)
    pan(now.x - pair.x, now.y - pair.y)
    if (pair.d > 0) zoomAt(now.x, now.y, now.d / pair.d)
    lastPoint = { x: now.x, y: now.y }
    pair = now
    apply()
  }
  const touchEnded = (e: TouchEvent) => {
    if (!pair || e.touches.length === 2) return
    pair = null
    settle()
  }

  scene.addEventListener('wheel', wheeled, { passive: false })
  scene.addEventListener('gesturestart', gestureStarted)
  scene.addEventListener('gesturechange', gestureChanged)
  scene.addEventListener('touchstart', touched, { passive: false })
  scene.addEventListener('touchmove', touchMoved, { passive: false })
  scene.addEventListener('touchend', touchEnded)
  scene.addEventListener('touchcancel', touchEnded)
  // The stage resizing moves the bounds with it.
  const observer = new ResizeObserver(() => {
    const to = clamped()
    x = to.x
    y = to.y
    k = to.k
    apply()
  })
  observer.observe(scene)
  apply()

  return {
    size(w, h) {
      width = w
      height = h
      if (!tween && !settleTimer && !pair) {
        const to = clamped()
        if (to.x !== x || to.y !== y || to.k !== k) tweenTo(to, SPRING_MS)
      }
    },
    view: () => ({ x, y, k }),
    panBy(dx, dy, animated) {
      const saved = { x, y }
      x += dx
      y += dy
      const to = clamped()
      if (animated) {
        x = saved.x
        y = saved.y
        tweenTo(to, 420)
      } else {
        ;({ x, y, k } = to)
        apply()
      }
    },
    home(animated) {
      clearTimeout(settleTimer)
      settleTimer = 0
      if (animated) return tweenTo({ x: 0, y: 0, k: 1 }, SPRING_MS + 80)
      cancelTween()
      x = y = 0
      k = 1
      apply()
    },
    stop() {
      cancelTween()
      clearTimeout(settleTimer)
      observer.disconnect()
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
