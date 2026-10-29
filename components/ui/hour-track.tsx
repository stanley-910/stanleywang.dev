'use client'
import { useEffect, useId, useRef, useState } from 'react'

// The time slider's track (design/circadian-meadow/components/ReadingTime/
// track-bump.md): a band in the hour's colours with the hour marked by a small
// bead, which opens into a hump leaning into its motion while the hour moves.
// One shape throughout: the band's top and bottom edges, blended between the
// bead's and the hump's. The native range input sits on top, invisible, and
// keeps the keyboard, the slider role and the value.

type HourTrackProps = {
  hour: number
  /** The band's colour at each hour, 00:00 to 24:00. */
  colours: string[]
  valueText: string
  onHour: (hour: number) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

/** The band's edges in the 30px box. */
const TOP = 18
const BOTTOM = 22
const MID = 20
/** Half the invisible thumb: the hours run from here to the width less this. */
const END = 14
const BEAD = 5
const BEAD_LIT = 5.5
const HUMP_HEIGHT = 6
const HUMP_HALF = 14
/** At full lean the crest moves this far, the leading side narrows and the tail stretches. */
const LEAN_SHIFT = 3
const LEAN_LEAD = 2
const LEAN_TAIL = 8
/** Speed, in px/s, that gives about three quarters of the lean. */
const LEAN_SPEED = 600
/** Faster than this, in px/s, the bead opens; it stays open this long, in ms, after. */
const OPEN_SPEED = 20
const HOLD = 180
/** Time constants, in ms. */
const TAU = {
  open: 50,
  close: 80,
  glide: 45,
  speed: 50,
  leanIn: 60,
  leanOut: 90,
  radius: 40,
}

const ease = (dt: number, tau: number) => 1 - Math.exp(-dt / tau)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const f1 = (n: number) => Math.round(n * 100) / 100

type Motion = {
  w: number
  pos: number
  speed: number
  m: number
  lean: number
  radius: number
  moved: number
  drag: boolean
  hover: boolean
  focus: boolean
  t: number
  raf: number
}

export function HourTrack({
  hour,
  colours,
  valueText,
  onHour,
  onKeyDown,
}: HourTrackProps) {
  const id = useId().replace(/[^\w-]/g, '')
  const [width, setWidth] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const bandRef = useRef<SVGPathElement>(null)
  const rimRef = useRef<SVGPathElement>(null)
  const underRef = useRef<SVGPathElement>(null)
  const rimGradRef = useRef<SVGLinearGradientElement>(null)
  const hourRef = useRef(hour)
  const kickRef = useRef<(nudged?: boolean) => void>(() => {})

  useEffect(() => {
    const box = boxRef.current
    const band = bandRef.current
    const rim = rimRef.current
    const under = underRef.current
    const rimGrad = rimGradRef.current
    if (!box || !band || !rim || !under || !rimGrad) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const s: Motion = {
      w: 0,
      pos: 0,
      speed: 0,
      m: 0,
      lean: 0,
      radius: BEAD,
      moved: -Infinity,
      drag: false,
      hover: false,
      focus: false,
      t: 0,
      raf: 0,
    }
    const target = () => END + (hourRef.current / 24) * (s.w - 2 * END)
    const stops = rimGrad.querySelectorAll('stop')

    const draw = () => {
      const { pos, m, lean, radius: r, w } = s
      const crest = pos + LEAN_SHIFT * lean
      const lead = HUMP_HALF - LEAN_LEAD * Math.abs(lean)
      const tail = HUMP_HALF + LEAN_TAIL * Math.abs(lean)
      const left = lean >= 0 ? tail : lead
      const right = lean >= 0 ? lead : tail
      const hump = (x: number) => {
        const d = x - crest
        const half = d < 0 ? left : right
        return Math.abs(d) >= half
          ? 0
          : 0.5 * (1 + Math.cos((Math.PI * d) / half))
      }
      const bead = (x: number) => {
        const d = x - pos
        return Math.abs(d) < r ? Math.sqrt(r * r - d * d) : 0
      }
      const top = (x: number) =>
        lerp(Math.min(TOP, MID - bead(x)), TOP - HUMP_HEIGHT * hump(x), m)
      const bottom = (x: number) =>
        lerp(Math.max(BOTTOM, MID + bead(x)), BOTTOM, m)

      // Outside the shape both edges are flat, so only its span is sampled.
      const lo = Math.max(0, Math.min(pos - r, m > 0 ? crest - left : pos))
      const hi = Math.min(w, Math.max(pos + r, m > 0 ? crest + right : pos))
      const xs: number[] = []
      for (let x = lo; x < hi; x += 0.25) xs.push(x)
      xs.push(hi)
      let d = `M0 ${TOP}`
      for (const x of xs) d += `L${f1(x)} ${f1(top(x))}`
      d += `L${w} ${TOP}L${w} ${BOTTOM}`
      for (let i = xs.length - 1; i >= 0; i--)
        d += `L${f1(xs[i])} ${f1(bottom(xs[i]))}`
      band.setAttribute('d', `${d}L0 ${BOTTOM}Z`)

      // The rim runs between where the bead meets the band's edges and, as
      // it opens, out to the hump's feet, fading there.
      const seam = Math.sqrt(Math.max(0, r * r - (MID - TOP) ** 2))
      const a = lerp(pos - seam, crest - left, m)
      const b = lerp(pos + seam, crest + right, m)
      let t = ''
      for (let x = a; x < b; x += 0.25)
        t += `${t ? 'L' : 'M'}${f1(x)} ${f1(top(x))}`
      rim.setAttribute('d', `${t}L${f1(b)} ${f1(top(b))}`)
      rimGrad.setAttribute('x1', String(f1(a)))
      rimGrad.setAttribute('x2', String(f1(b)))
      stops[0].setAttribute('stop-opacity', String(f1(1 - m)))
      stops[3].setAttribute('stop-opacity', String(f1(1 - m)))
      let u = ''
      for (let x = pos - seam; x < pos + seam; x += 0.25)
        u += `${u ? 'L' : 'M'}${f1(x)} ${f1(bottom(x))}`
      under.setAttribute(
        'd',
        `${u}L${f1(pos + seam)} ${f1(bottom(pos + seam))}`,
      )
      under.setAttribute('stroke-opacity', String(f1(1 - m)))
    }

    const step = (now: number) => {
      const dt = s.t ? Math.min(64, now - s.t) : 16
      s.t = now
      const still = reduced.matches
      const goal = target()
      const prev = s.pos
      s.pos =
        s.drag || still ? goal : s.pos + (goal - s.pos) * ease(dt, TAU.glide)
      s.speed += (((s.pos - prev) / dt) * 1000 - s.speed) * ease(dt, TAU.speed)
      if (s.drag || Math.abs(s.speed) > OPEN_SPEED) s.moved = now
      const open = !still && now - s.moved < HOLD
      s.m += (+open - s.m) * ease(dt, open ? TAU.open : TAU.close)
      const leanGoal = still ? 0 : Math.tanh(s.speed / LEAN_SPEED)
      s.lean +=
        (leanGoal - s.lean) *
        ease(
          dt,
          Math.abs(leanGoal) > Math.abs(s.lean) ? TAU.leanIn : TAU.leanOut,
        )
      const rGoal = s.hover || s.focus ? BEAD_LIT : BEAD
      s.radius = still
        ? rGoal
        : s.radius + (rGoal - s.radius) * ease(dt, TAU.radius)
      const busy =
        open ||
        Math.abs(goal - s.pos) > 0.05 ||
        s.m > 0.002 ||
        Math.abs(s.lean) > 0.002 ||
        Math.abs(rGoal - s.radius) > 0.01
      if (!busy) {
        // At rest: settle exactly and stop until something moves.
        Object.assign(s, { pos: goal, m: 0, lean: 0, speed: 0, radius: rGoal })
        s.raf = 0
        s.t = 0
      } else s.raf = requestAnimationFrame(step)
      draw()
    }
    const kick = (nudged = false) => {
      // A set step (key, wheel, track click) opens it even when it's too
      // short to cross OPEN_SPEED: a quarter hour is only ~2px here.
      if (nudged && !reduced.matches) s.moved = performance.now()
      if (!s.raf) s.raf = requestAnimationFrame(step)
    }
    kickRef.current = kick

    const ro = new ResizeObserver(([entry]) => {
      s.w = entry.contentRect.width
      setWidth(s.w)
      s.pos = target()
      draw()
    })
    ro.observe(box)

    const input = box.querySelector('input')
    const onDown = () => {
      s.drag = true
      kick()
    }
    const onUp = () => {
      if (!s.drag) return
      s.drag = false
      kick()
    }
    const onEnter = () => {
      s.hover = true
      kick()
    }
    const onLeave = () => {
      s.hover = false
      kick()
    }
    const onFocus = () => {
      s.focus = !!input?.matches(':focus-visible')
      kick()
    }
    const onBlur = () => {
      s.focus = false
      kick()
    }
    input?.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    box.addEventListener('pointerenter', onEnter)
    box.addEventListener('pointerleave', onLeave)
    input?.addEventListener('focus', onFocus)
    input?.addEventListener('keyup', onFocus)
    input?.addEventListener('blur', onBlur)
    return () => {
      cancelAnimationFrame(s.raf)
      ro.disconnect()
      input?.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      box.removeEventListener('pointerenter', onEnter)
      box.removeEventListener('pointerleave', onLeave)
      input?.removeEventListener('focus', onFocus)
      input?.removeEventListener('keyup', onFocus)
      input?.removeEventListener('blur', onBlur)
    }
  }, [])

  useEffect(() => {
    // The clock's own drift (half a minute a tick) doesn't count as a step.
    const stepped = Math.abs(hour - hourRef.current) >= 0.2
    hourRef.current = hour
    kickRef.current(stepped)
  }, [hour])

  return (
    <div ref={boxRef} className="hour-track">
      <svg className="hour-track-art" aria-hidden="true">
        <defs>
          <linearGradient
            id={`${id}-band`}
            gradientUnits="userSpaceOnUse"
            x1={END}
            x2={Math.max(END + 1, width - END)}
          >
            {colours.map((c, i) => (
              <stop key={i} offset={i / (colours.length - 1)} stopColor={c} />
            ))}
          </linearGradient>
          <linearGradient
            ref={rimGradRef}
            id={`${id}-rim`}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset={0} stopColor="currentColor" />
            <stop offset={0.3} stopColor="currentColor" />
            <stop offset={0.7} stopColor="currentColor" />
            <stop offset={1} stopColor="currentColor" />
          </linearGradient>
        </defs>
        <path ref={bandRef} fill={`url(#${id}-band)`} />
        <path
          ref={rimRef}
          fill="none"
          stroke={`url(#${id}-rim)`}
          strokeWidth={1.25}
          strokeLinecap="round"
        />
        <path
          ref={underRef}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.25}
          strokeLinecap="round"
        />
      </svg>
      <input
        className="time-control-range"
        type="range"
        min={0}
        max={24}
        step={0.25}
        value={hour}
        aria-label="Hour"
        aria-valuetext={valueText}
        onChange={(e) => onHour(Number(e.target.value))}
        onKeyDown={onKeyDown}
      />
    </div>
  )
}
