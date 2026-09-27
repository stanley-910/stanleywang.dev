// The scrollbar's thumb, as light
// in the dashed rail: a stretch of it (half a thumb's length) brightens
// where the pane is scrolled to (the top of the rail at the start, the
// bottom at the end), while it's scrolled by hand, and a little after,
// so you see where you ended; then it fades back into the rail. Resting on the bar lights it
// half way, holding it all the way, and it drags like a thumb: grab it and
// it stays under the pointer; press elsewhere on the bar and it jumps
// there (Stanley, 2026-09-27: "the brightness … IS the location of the
// scroll").
// Drawn on one canvas over the page, only while lit; the rail in
// animated.css hides under it for that time (`data-curve`), so the dashes
// line up with the straight ones exactly and nothing is left on the page
// once it fades. The native thumb is never shown, and never grabbed: an
// unseen grip over the bar under the pointer takes the pointer and the
// wheel there (the native thumb is as long as the view, so it wouldn't
// keep a short stretch under the pointer).

// The lit stretch: this share of the length a thumb would have, at least
// MIN_LENGTH px and at most half the rail.
const SHARE = 0.5
const MIN_LENGTH = 40
// How far the lit stretch bends off the rail, in px (0: it doesn't).
const LIFT = 0
// Scroll speed (px of content a ms) that lights it all the way.
const FULL_SPEED = 1.6
// Easing in and out (time constants, ms): slow enough in that a short
// flick only lights it partway.
const RISE_MS = 140
const FALL_MS = 260
// How long it stays lit where the scrolling stopped before fading.
const HOLD_MS = 320
// How long the pointer rests on the bar before it lights for it, so
// crossing the bar on the way into the pane doesn't.
const DWELL_MS = 150
// Hand input (wheel, touch, drag, keys) this recent makes a scroll a hand's.
const HAND_MS = 300
// How lit, while the pointer rests on the bar, and while it's held.
const RESTING = 0.55
const HELD = 1
// The rail's dashes: 2px on, 3px off, from the track's start (animated.css).
const DASH = 2
const GAP = 3

type Axis = 'x' | 'y'
type Light = {
  pane: HTMLElement
  axis: Axis
  // 0 (the plain rail) to 1.
  glow: number
  // Where the lit stretch starts, eased after the scroll.
  from: number | null
  last: number
  lastScroll: number
  speed: number
}
type Rail = ReturnType<typeof railOf>

const hex = (s: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(s.trim())
  const n = m ? parseInt(m[1], 16) : 0x808080
  return [n >> 16, (n >> 8) & 255, n & 255]
}

// The rail of a pane on an axis, in viewport px: where it runs, the bar
// across it and where its 1px line sits, and where the lit stretch is on
// it. On whole px, as the scrollbar it stands in for is laid out, so the
// dashes land exactly on its dashes. Same box with scrollbars on or off.
function railOf(p: HTMLElement, axis: Axis, bare: boolean) {
  const box = p.getBoundingClientRect()
  const y = axis === 'y'
  // A pane on the zoomed stage (canvas-zoom.ts) is drawn at this scale;
  // its client sizes aren't.
  const k = (y ? box.height / p.offsetHeight : box.width / p.offsetWidth) || 1
  const start = Math.round(
    y
      ? bare
        ? box.top
        : box.top + p.clientTop * k
      : bare
        ? box.left
        : box.left + p.clientLeft * k,
  )
  const length = y
    ? bare
      ? box.height
      : p.clientHeight * k
    : bare
      ? box.width
      : p.clientWidth * k
  const scroll = y
    ? p.scrollHeight - p.clientHeight
    : p.scrollWidth - p.clientWidth
  const at = y ? p.scrollTop : p.scrollLeft
  // The bar, across: past the pane's client area, to its edge.
  const bar = y
    ? box.left + (p.clientLeft + p.clientWidth) * k
    : box.top + (p.clientTop + p.clientHeight) * k
  const end = y ? box.right : box.bottom
  const view = y
    ? p.clientHeight / p.scrollHeight
    : p.clientWidth / p.scrollWidth
  const size = Math.min(
    length / 2,
    Math.max(MIN_LENGTH * k, length * view * SHARE),
  )
  const from = start + (scroll > 0 ? at / scroll : 0) * (length - size)
  return {
    box,
    start,
    length,
    bar,
    end,
    // (snapped to whole px unscaled, to match the rail row for row)
    across: k === 1 ? Math.round(bar + 4) + 0.5 : bar + 4.5 * k,
    k,
    scroll,
    at,
    size,
    from,
  }
}

// Null where it doesn't run (reduced motion, or no styled scrollbars).
export function startRailCurve(root: HTMLElement): (() => void) | null {
  if (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    !CSS.supports('selector(::-webkit-scrollbar)')
  )
    return null
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '40',
  })
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const grip = document.createElement('div')
  grip.setAttribute('aria-hidden', 'true')
  Object.assign(grip.style, {
    position: 'fixed',
    display: 'none',
    zIndex: '41',
    touchAction: 'none',
  })
  document.body.append(canvas, grip)
  // The native thumb is never shown (animated.css).
  root.setAttribute('data-curving', '')
  const lights = new Map<string, Light>()
  // Each pane's last scroll position on each axis.
  const seen = new WeakMap<HTMLElement, { x: number; y: number }>()
  const ids = new WeakMap<HTMLElement, number>()
  let nextId = 0
  const keyOf = (pane: HTMLElement, axis: Axis) => {
    if (!ids.has(pane)) ids.set(pane, nextId++)
    return `${ids.get(pane)}${axis}`
  }
  const bare = () => root.classList.contains('bare')
  let hand: { at: number; target: EventTarget | null } = {
    at: -1e9,
    target: null,
  }
  // The bar the grip is over, the one the pointer rests on (lit after the
  // dwell), and the one being dragged.
  let gripped: { pane: HTMLElement; axis: Axis; key: string } | null = null
  let resting: string | null = null
  let dwell: ReturnType<typeof setTimeout> | undefined
  let held: {
    key: string
    pointer: number
    from: number
    at: number
    per: number
  } | null = null
  let frame = 0
  let then = 0

  const run = () => {
    if (!frame) {
      then = performance.now()
      frame = requestAnimationFrame(tick)
    }
  }
  const lightOf = (pane: HTMLElement, axis: Axis) => {
    const key = keyOf(pane, axis)
    let l = lights.get(key)
    if (!l) {
      l = {
        pane,
        axis,
        glow: 0,
        from: null,
        last: axis === 'y' ? pane.scrollTop : pane.scrollLeft,
        lastScroll: -1e9,
        speed: 0,
      }
      lights.set(key, l)
      pane.setAttribute(
        'data-curve',
        `${pane.getAttribute('data-curve') ?? ''} ${axis}`.trim(),
      )
    }
    run()
    return l
  }

  // Where the panes under the pointer (or focus) are, before any scroll
  // there: the scroll a wheel makes has landed by the time the wheel event
  // is handled, so a first scroll needs somewhere to have come from.
  const noticed = (e: Event) => {
    for (
      let el = e.target instanceof HTMLElement ? e.target : null;
      el && root.contains(el);
      el = el.parentElement
    )
      if (!seen.has(el)) seen.set(el, { x: el.scrollLeft, y: el.scrollTop })
  }
  const touched = (e: Event) => {
    if (e instanceof PointerEvent && e.type === 'pointermove' && !e.buttons)
      return
    hand = {
      at: performance.now(),
      target: e.type === 'keydown' ? document.activeElement : e.target,
    }
  }

  // The bar under the pointer, if any.
  const barUnder = (e: PointerEvent) => {
    for (
      let el = e.target instanceof HTMLElement ? e.target : null;
      el && root.contains(el);
      el = el.parentElement
    ) {
      const style = getComputedStyle(el)
      for (const axis of ['y', 'x'] as Axis[]) {
        const overflow = axis === 'y' ? style.overflowY : style.overflowX
        const scrolls =
          axis === 'y'
            ? el.scrollHeight > el.clientHeight
            : el.scrollWidth > el.clientWidth
        if (!/auto|scroll/.test(overflow) || !scrolls) continue
        const r = railOf(el, axis, bare())
        const across = axis === 'y' ? e.clientX : e.clientY
        const along = axis === 'y' ? e.clientY : e.clientX
        if (
          across >= r.bar &&
          across <= r.end &&
          along >= r.start &&
          along <= r.start + r.length
        )
          return { pane: el, axis }
      }
    }
    return null
  }

  const place = () => {
    if (!gripped) return
    const r = railOf(gripped.pane, gripped.axis, bare())
    Object.assign(
      grip.style,
      gripped.axis === 'y'
        ? {
            left: `${r.bar}px`,
            top: `${r.start}px`,
            width: `${r.end - r.bar}px`,
            height: `${r.length}px`,
          }
        : {
            left: `${r.start}px`,
            top: `${r.bar}px`,
            width: `${r.length}px`,
            height: `${r.end - r.bar}px`,
          },
    )
  }
  const letGo = () => {
    if (held) return
    clearTimeout(dwell)
    gripped = null
    resting = null
    grip.style.display = 'none'
  }

  // Over a bar: the grip takes it, and after a moment it lights.
  const moved = (e: PointerEvent) => {
    if (e.buttons || held) return
    const on = barUnder(e)
    if (!on) return
    const key = keyOf(on.pane, on.axis)
    if (gripped?.key === key) return
    letGo()
    gripped = { ...on, key }
    place()
    grip.style.display = 'block'
    // Already lit (scrolled just now): stays lit without waiting.
    if ((lights.get(key)?.glow ?? 0) > 0.2) resting = key
    else
      dwell = setTimeout(() => {
        resting = key
        lightOf(on.pane, on.axis)
      }, DWELL_MS)
  }

  const scrollTo = (pane: HTMLElement, axis: Axis, pos: number) => {
    if (axis === 'y') pane.scrollTop = pos
    else pane.scrollLeft = pos
  }
  const pressed = (e: PointerEvent) => {
    if (!gripped || e.button !== 0) return
    e.preventDefault()
    const { pane, axis, key } = gripped
    hand = { at: performance.now(), target: pane }
    const r = railOf(pane, axis, bare())
    const along = axis === 'y' ? e.clientY : e.clientX
    const per = r.length > r.size ? r.scroll / (r.length - r.size) : 0
    let at = r.at
    // Pressed off the lit stretch: it jumps there, centred on the pointer.
    if (along < r.from || along > r.from + r.size) {
      const from = Math.max(
        r.start,
        Math.min(along - r.size / 2, r.start + r.length - r.size),
      )
      at = (from - r.start) * per
      scrollTo(pane, axis, at)
    }
    grip.setPointerCapture(e.pointerId)
    held = { key, pointer: e.pointerId, from: along, at, per }
    resting = key
    clearTimeout(dwell)
    lightOf(pane, axis)
  }
  const dragged = (e: PointerEvent) => {
    if (!held || !gripped || e.pointerId !== held.pointer) return
    hand = { at: performance.now(), target: gripped.pane }
    const along = gripped.axis === 'y' ? e.clientY : e.clientX
    scrollTo(
      gripped.pane,
      gripped.axis,
      held.at + (along - held.from) * held.per,
    )
  }
  const released = (e: PointerEvent) => {
    if (!held || e.pointerId !== held.pointer) return
    held = null
    // Still over the bar, it stays gripped (and lit, resting).
    const r = gripped && railOf(gripped.pane, gripped.axis, bare())
    const across = gripped?.axis === 'y' ? e.clientX : e.clientY
    if (!r || across < r.bar || across > r.end) letGo()
  }
  // The wheel over the grip still scrolls the pane under it.
  const wheeled = (e: WheelEvent) => {
    if (!gripped) return
    e.preventDefault()
    const unit =
      e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? gripped.pane.clientHeight : 1
    hand = { at: performance.now(), target: gripped.pane }
    gripped.pane.scrollBy(e.deltaX * unit, e.deltaY * unit)
  }

  const scrolled = (e: Event) => {
    const pane = e.target
    if (!(pane instanceof HTMLElement) || !root.contains(pane)) return
    const now = performance.now()
    const own =
      now - hand.at < HAND_MS &&
      hand.target instanceof Node &&
      pane.contains(hand.target)
    const was = seen.get(pane)
    seen.set(pane, { x: pane.scrollLeft, y: pane.scrollTop })
    if (!was) return
    for (const axis of ['x', 'y'] as Axis[]) {
      const pos = axis === 'y' ? pane.scrollTop : pane.scrollLeft
      if (was[axis] === pos) continue
      // A step scrolling the pane (the assembly following its row) moves
      // the thumb but doesn't light the rail.
      if (!own && !lights.has(keyOf(pane, axis))) continue
      const l = lightOf(pane, axis)
      // A fresh light comes from where the pane was, a frame ago.
      const fresh = l.lastScroll < 0
      const last = fresh ? was[axis] : l.last
      const dt = fresh ? 16 : Math.max(8, now - l.lastScroll)
      l.speed += (Math.abs(pos - last) / dt - l.speed) * 0.5
      l.last = pos
      l.lastScroll = now
    }
  }

  const size = () => {
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(innerWidth * dpr)
    const h = Math.round(innerHeight * dpr)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
      canvas.style.width = `${innerWidth}px`
      canvas.style.height = `${innerHeight}px`
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const draw = (l: Light, r: Rail, line: number[], ink: number[]) => {
    const from = l.from as number
    // Across the stretch: full in the middle, easing off over its ends.
    const lit = (s: number) => {
      const u = (s - from) / r.size
      if (u <= 0 || u >= 1) return 0
      const k = Math.min(1, Math.min(u, 1 - u) / 0.3)
      return l.glow * k * k * (3 - 2 * k)
    }
    ctx.lineWidth = r.k
    const dash = DASH * r.k
    for (let s = r.start; s < r.start + r.length; s += dash + GAP * r.k) {
      const e = Math.min(s + dash, r.start + r.length)
      const t = lit(s + dash / 2)
      const c = line.map((v, i) => Math.round(v + (ink[i] - v) * t))
      ctx.strokeStyle = `rgb(${c[0]} ${c[1]} ${c[2]})`
      ctx.beginPath()
      if (l.axis === 'y') {
        ctx.moveTo(r.across - LIFT * lit(s), s)
        ctx.lineTo(r.across - LIFT * lit(e), e)
      } else {
        ctx.moveTo(s, r.across - LIFT * lit(s))
        ctx.lineTo(e, r.across - LIFT * lit(e))
      }
      ctx.stroke()
    }
  }

  const tick = (now: number) => {
    const dt = Math.min(64, now - then)
    then = now
    size()
    place()
    ctx.clearRect(0, 0, innerWidth, innerHeight)
    const style = getComputedStyle(root)
    const line = hex(style.getPropertyValue('--line'))
    const ink = hex(style.getPropertyValue('--ink'))
    const note = root.querySelector<HTMLElement>('.ac-window')

    for (const [key, l] of lights) {
      if (!l.pane.isConnected) {
        lights.delete(key)
        continue
      }
      const r = railOf(l.pane, l.axis, bare())
      const floor = held?.key === key ? HELD : resting === key ? RESTING : 0
      const quiet = now - l.lastScroll
      // Rises toward the speed (half lit at any speed: it's where you are)
      // only while the scrolling goes on, so a flick lights it partway; stays for a moment once it stops, then fades
      // (down to where resting on it or holding it keeps it).
      const push = Math.min(1, l.speed / FULL_SPEED) ** 0.8
      const target =
        quiet < 80
          ? Math.max(0.45 + 0.55 * push, floor)
          : quiet < HOLD_MS
            ? Math.max(l.glow, floor)
            : floor
      const tau = target > l.glow ? RISE_MS : FALL_MS
      l.glow += (target - l.glow) * (1 - Math.exp(-dt / tau))

      // Follows the scroll, a little behind; exactly, while dragged.
      l.from =
        l.from === null || held?.key === key
          ? r.from
          : l.from + (r.from - l.from) * (1 - Math.exp(-dt / 50))

      if (l.glow < 0.02 && quiet > HOLD_MS && !floor) {
        lights.delete(key)
        const rest = (l.pane.getAttribute('data-curve') ?? '')
          .split(' ')
          .filter((a) => a && a !== l.axis)
          .join(' ')
        if (rest) l.pane.setAttribute('data-curve', rest)
        else l.pane.removeAttribute('data-curve')
        continue
      }

      ctx.save()
      ctx.beginPath()
      ctx.rect(r.box.left, r.box.top, r.box.width, r.box.height)
      // Under the notes window, unless it's the window's own pane.
      if (note && !note.contains(l.pane)) {
        const n = note.getBoundingClientRect()
        ctx.rect(n.left, n.top, n.width, n.height)
      }
      ctx.clip('evenodd')
      draw(l, r, line, ink)
      ctx.restore()
    }
    frame = lights.size ? requestAnimationFrame(tick) : 0
    if (!frame) ctx.clearRect(0, 0, innerWidth, innerHeight)
  }

  type On = [EventTarget, string, EventListener, AddEventListenerOptions]
  const passive = { capture: true, passive: true }
  const on: On[] = [
    [root, 'scroll', scrolled, passive],
    ...['wheel', 'touchmove', 'pointerdown', 'pointermove'].map(
      (type): On => [root, type, touched, passive],
    ),
    ...['pointerover', 'touchstart', 'focusin'].map(
      (type): On => [root, type, noticed, passive],
    ),
    [root, 'pointermove', moved as EventListener, passive],
    [grip, 'pointerdown', pressed as EventListener, {}],
    [grip, 'pointermove', dragged as EventListener, {}],
    [grip, 'pointerup', released as EventListener, {}],
    [grip, 'pointercancel', released as EventListener, {}],
    [grip, 'pointerleave', letGo, {}],
    [grip, 'wheel', wheeled as EventListener, { passive: false }],
    // The page scrolling moves the bar out from under the grip (a pane's
    // own scroll comes through here too, and doesn't).
    [window, 'scroll', (e) => e.target === document && letGo(), passive],
    [window, 'keydown', touched, { capture: true }],
  ]
  for (const [target, type, fn, options] of on)
    target.addEventListener(type, fn, options)
  return () => {
    cancelAnimationFrame(frame)
    clearTimeout(dwell)
    for (const [target, type, fn, options] of on)
      target.removeEventListener(type, fn, options)
    for (const l of lights.values()) l.pane.removeAttribute('data-curve')
    root.removeAttribute('data-curving')
    canvas.remove()
    grip.remove()
  }
}
