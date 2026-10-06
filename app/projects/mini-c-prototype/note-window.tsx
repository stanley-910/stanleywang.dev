import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { EASE } from './ease'

import type { HTMLAttributes, ReactNode, RefObject } from 'react'

// The step's explanation, in a small window of its own over the simulation,
// so the pane under the source can hold what the phase keeps track of (the
// stack, the scopes). A quiet window: a file's name on the bar to drag it
// by, and a − that rolls it up into its top-left corner, to the name and
// a + that grows it back out (Stanley, 2026-09-26). A grip at its bottom
// right sizes it: the width within bounds, the height only as a cap, so it
// never grows past what the note needs (2026-09-27); until then it fits
// the note (2026-10-01). Its other edges and corners size it too, as any
// window's (2026-09-30): a left or top edge moves that side and keeps the
// opposite one where it is. Where it sits, its
// size and whether it's rolled up are remembered in this browser. On a
// phone it docks over the controls instead (animated.css .ac-dock): no bar
// to drag or grip to size, only the − that rolls it up.
const KEY = 'mini-c-note-window'
const MARGIN = 8
const OPEN_W = 264
const MIN_W = 220
const MAX_W = 480
// The body's least height cap, once dragged (until then it fits the note).
const MIN_H = 72
// One arrow key's nudge of the grip.
const NUDGE = 16
// Advance of one character of the 11px title.
const TITLE_CH = 6.6
// The page's easing for cards that open and close (animated.tsx).

// The edges and corners that size it besides the grip's (bottom right):
// which sides each one moves.
type Sides = { l?: boolean; r?: boolean; t?: boolean; b?: boolean }
const EDGES: [string, Sides][] = [
  ['n', { t: true }],
  ['s', { b: true }],
  ['w', { l: true }],
  ['e', { r: true }],
  ['nw', { t: true, l: true }],
  ['ne', { t: true, r: true }],
  ['sw', { b: true, l: true }],
]

type Place = {
  x: number
  y: number
  shut: boolean
  /** The open width and the body's height cap, once resized. */
  w?: number
  h?: number
}

const load = (key: string): Place | null => {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null')
    return saved && typeof saved.x === 'number' && typeof saved.y === 'number'
      ? {
          x: saved.x,
          y: saved.y,
          shut: !!saved.shut,
          w: typeof saved.w === 'number' ? saved.w : undefined,
          h: typeof saved.h === 'number' ? saved.h : undefined,
        }
      : null
  } catch {
    return null
  }
}
const saveTo = (key: string, place: Place) => {
  try {
    localStorage.setItem(key, JSON.stringify(place))
  } catch {}
}

export function NoteWindow({
  title,
  error,
  live,
  bounds,
  area,
  start,
  children,
  foot,
  docked = false,
  height = null,
  cap = Infinity,
  onDock,
  storeKey = KEY,
  label = 'Current step',
  noun = 'notes',
  openWidth = OPEN_W,
  lead,
  trail,
  away = false,
  onHandle,
  className = '',
  rootProps,
}: {
  title: string
  error?: boolean
  /** Announce changes (off while playing). */
  live: boolean
  /** What it is positioned against (its offset parent). */
  bounds: RefObject<HTMLElement | null>
  /** What it may be dragged within, inside bounds (the editor and stage,
   *  not the controls under them); bounds itself if not given. */
  area?: RefObject<HTMLElement | null>
  /** Where it opens the first time, in bounds' coordinates. */
  start: () => { x: number; y: number }
  children: ReactNode
  foot?: ReactNode
  /** Docked over the controls (a phone): not dragged or sized. */
  docked?: boolean
  /** Docked: its height as dragged; null fits the note. */
  height?: number | null
  /** Docked: the most a note that fits its text may take. */
  cap?: number
  /** Puts the note back in the pane under the source (↙ on the bar). */
  onDock?: () => void
  /** Another window of the same kind (the syntax guide): where its place is
   *  remembered, its name, what its buttons call it, its opening width. */
  storeKey?: string
  label?: string
  noun?: string
  openWidth?: number
  /** A button on the bar before its name (the guide's pin). */
  lead?: ReactNode
  /** A button at the bar's end, after the − (the guide's ×). */
  trail?: ReactNode
  /** Out of sight for now (kept mounted, so it keeps its place). */
  away?: boolean
  /** Dragged, sized or rolled up by hand. */
  onHandle?: () => void
  className?: string
  /** Focus and clipboard handlers for the window (the guide's). */
  rootProps?: Pick<
    HTMLAttributes<HTMLElement>,
    'tabIndex' | 'onPointerDown' | 'onFocus' | 'onBlur' | 'onCopy'
  >
}) {
  const save = (place: Place) => saveTo(storeKey, place)
  const ref = useRef<HTMLElement>(null)
  const still = useReducedMotion()
  const [place, setPlace] = useState<Place | null>(null)
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const sizing = useRef<{ x: number; y: number; w: number; h: number } | null>(
    null,
  )
  const [resizing, setResizing] = useState(false)

  const areaRef = area ?? bounds
  // Keep it inside the bounds, whatever size they or it become.
  const clamp = (p: Place): Place => {
    const outer = bounds.current
    const inner = area?.current ?? outer
    const box = ref.current
    if (!outer || !inner || !box) return p
    const o = outer.getBoundingClientRect()
    const i = inner.getBoundingClientRect()
    const left = i.left - o.left + MARGIN
    const top = i.top - o.top + MARGIN
    const maxX = i.right - o.left - box.offsetWidth - MARGIN
    const maxY = i.bottom - o.top - box.offsetHeight - MARGIN
    return {
      ...p,
      x: Math.round(Math.max(left, Math.min(p.x, maxX))),
      y: Math.round(Math.max(top, Math.min(p.y, maxY))),
    }
  }
  // After mount, once every ref (the bounds' included) is attached.
  useEffect(() => {
    setPlace(clamp(load(storeKey) ?? { ...start(), shut: false }))
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // The width it can have here: a size saved on a wider screen gives way
  // (and comes back when there's room), rather than clipping the note.
  const [room, setRoom] = useState(Infinity)
  // The area's bottom, in bounds' coordinates: how far a note that fits
  // its text may reach down before it scrolls.
  const [floor, setFloor] = useState(Infinity)
  useEffect(() => {
    const area = bounds.current
    if (!area) return
    const observer = new ResizeObserver(() => {
      const inner = (areaRef.current ?? area).getBoundingClientRect()
      setRoom(Math.max(0, Math.floor(inner.width - 2 * MARGIN)))
      setFloor(inner.bottom - area.getBoundingClientRect().top)
      setPlace((p) => (p ? clamp(p) : p))
    })
    observer.observe(area)
    // It grows too: unrolled, or a longer note near the bottom edge.
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds])

  const roll = () => {
    onHandle?.()
    setPlace((p) => {
      if (!p) return p
      const next = { ...p, shut: !p.shut }
      save(next)
      return next
    })
  }

  // A size within bounds: the width between its limits and inside the
  // area, the height cap from its floor to the area's bottom.
  const fit = (w: number, h: number) => {
    const outer = bounds.current
    const inner = area?.current ?? outer
    const body = bodyRef.current
    if (!outer || !inner || !body || !place) return { w, h }
    const i = inner.getBoundingClientRect()
    const o = outer.getBoundingClientRect()
    const room = i.right - o.left - place.x - MARGIN
    const below = i.bottom - body.getBoundingClientRect().top - MARGIN
    return {
      w: Math.round(Math.max(MIN_W, Math.min(w, MAX_W, room))),
      h: Math.round(Math.max(MIN_H, Math.min(h, below))),
    }
  }
  const resize = (w: number, h: number, keep: boolean) =>
    setPlace((p) => {
      if (!p) return p
      const next = { ...p, ...fit(w, h) }
      if (keep) save(next)
      return next
    })
  // Where a drag or a nudge starts: the open width, and the body's height
  // as shown (its cap, or the note's own height if that's less).
  // (through a ref: the corner's document listeners are bound once)
  const placeRef = useRef(place)
  placeRef.current = place
  const roomRef = useRef(room)
  roomRef.current = room
  const current = () => ({
    // (a note fitted to its text starts from the width it's drawn at)
    w: Math.min(
      placeRef.current?.w ?? ref.current?.offsetWidth ?? openWidth,
      roomRef.current,
    ),
    h: bodyRef.current?.offsetHeight ?? MIN_H,
  })

  // A drag on an edge or corner: from where it started, each side it
  // moves goes with the pointer. A left or top side moves the window too,
  // so the opposite side stays put; the top only as far as the note needs,
  // since the height is a cap and a taller cap wouldn't grow it.
  const edging = useRef<{
    sides: Sides
    px: number
    py: number
    place: Place
    w: number
    h: number
    natural: number
    bodyTop: number
  } | null>(null)
  const edgeTo = (clientX: number, clientY: number) => {
    const d = edging.current
    const outer = bounds.current
    const inner = area?.current ?? outer
    if (!d || !outer || !inner) return
    const o = outer.getBoundingClientRect()
    const i = inner.getBoundingClientRect()
    const dx = clientX - d.px
    const dy = clientY - d.py
    const within = (v: number, lo: number, hi: number) =>
      Math.round(Math.max(lo, Math.min(v, hi)))
    let { x, y } = d.place
    let { w, h } = d
    if (d.sides.r)
      w = within(w + dx, MIN_W, Math.min(MAX_W, i.right - o.left - x - MARGIN))
    if (d.sides.l) {
      const right = d.place.x + d.w
      w = within(
        w - dx,
        MIN_W,
        Math.min(MAX_W, right - (i.left - o.left + MARGIN)),
      )
      x = right - w
    }
    if (d.sides.b) h = within(h + dy, MIN_H, i.bottom - d.bodyTop - MARGIN)
    if (d.sides.t) {
      const bottom = d.place.y + d.h
      const most = Math.min(d.natural, bottom - (i.top - o.top + MARGIN))
      h = within(h - dy, Math.min(MIN_H, d.natural), most)
      y = bottom - h
    }
    setPlace((p) => (p ? { ...p, x, y, w, h } : p))
  }

  const shut = !!place?.shut
  // Until it's sized by hand, a note fits its text (Stanley, 2026-10-01):
  // as tall as it runs, to the area's bottom, and wide enough for what
  // doesn't wrap (the symbol table's rows), measured at the width it opens
  // at so it narrows again for a note that needs less.
  const [fitW, setFitW] = useState(openWidth)
  // Every render: the note's content is what changes it. (Measured at the
  // opening width, the same content gives the same width: it settles.)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body || docked || place?.w !== undefined) return
    const was = body.style.width
    body.style.width = `${openWidth - 2}px`
    const need = Math.min(MAX_W, Math.max(openWidth, body.scrollWidth + 2))
    body.style.width = was
    if (need !== fitW) setFitW(need)
  })
  // Docked, it fits its note too, up to the cap it's given (the editor's
  // room above it), and glides to the next note's height (Stanley,
  // 2026-10-01).
  const [fitDock, setFitDock] = useState<number | null>(null)
  const measureDock = () => {
    const body = bodyRef.current
    if (!body || !docked || height !== null) return
    const was = body.style.height
    body.style.height = 'auto'
    const need = Math.max(28, Math.min(cap, body.scrollHeight))
    body.style.height = was
    setFitDock(need)
  }
  useLayoutEffect(measureDock)
  // (and as what's in it grows in: a record's cards open after the step)
  useEffect(() => {
    const body = bodyRef.current
    if (!body || !docked || height !== null) return
    const observer = new ResizeObserver(measureDock)
    for (const child of Array.from(body.children)) observer.observe(child)
    return () => observer.disconnect()
  })
  const dockH = height ?? fitDock
  // Glided by an effect rather than `animate`: a StrictMode reattach stops
  // Motion's own animation midway (as animated.tsx's GlidingPath), where an
  // effect runs again and finishes it. Set at once the first time, and
  // while its edge is dragged.
  const dockHeight = useMotionValue(0)
  const primed = useRef(false)
  useEffect(() => {
    if (!docked || dockH === null) return
    if (!primed.current || height !== null || still) {
      primed.current = true
      dockHeight.set(dockH)
      return
    }
    const run = animate(dockHeight, dockH, { duration: 0.22, ease: EASE })
    return () => run.stop()
  }, [docked, dockH, height, still, dockHeight])
  const openW = Math.min(place?.w ?? fitW, room)
  // Bar (22px) and borders over the body.
  // (none until the area is measured)
  const fitH =
    place && Number.isFinite(floor)
      ? Math.max(MIN_H, floor - place.y - 24 - MARGIN)
      : undefined
  // Rolled up it is just the name and a +, exactly as wide as those
  // (monospace, 6.6px a character at 11px, plus the bar's padding).
  const width = docked
    ? '100%'
    : shut
      ? Math.ceil(
          title.length * TITLE_CH +
            39 +
            (onDock ? 15 : 0) +
            (lead ? 21 : 0) +
            (trail ? 15 : 0),
        )
      : openW
  const timing = { duration: still || resizing ? 0 : 0.22, ease: EASE }

  return (
    <motion.section
      ref={ref}
      {...rootProps}
      className={`ac-window ${docked ? 'docked' : ''} ${shut ? 'shut' : ''} ${error ? 'err' : ''} ${away ? 'away' : ''} ${className}`}
      aria-label={label}
      aria-hidden={away || undefined}
      initial={false}
      animate={{ width }}
      transition={timing}
      style={
        docked
          ? undefined
          : place
            ? { left: place.x, top: place.y }
            : // Measured before it's placed: hidden for that first frame.
              { visibility: 'hidden' }
      }
    >
      {!docked &&
        !shut &&
        place &&
        EDGES.map(([name, sides]) => (
          <div
            key={name}
            className={`ac-window-edge ${name}`}
            aria-hidden="true"
            onPointerDown={(e) => {
              const body = bodyRef.current
              if (e.button !== 0 || !body) return
              e.preventDefault()
              e.stopPropagation()
              e.currentTarget.setPointerCapture(e.pointerId)
              onHandle?.()
              edging.current = {
                sides,
                px: e.clientX,
                py: e.clientY,
                place,
                ...current(),
                natural: body.scrollHeight,
                bodyTop: body.getBoundingClientRect().top,
              }
              setResizing(true)
            }}
            onPointerMove={(e) => edgeTo(e.clientX, e.clientY)}
            onPointerUp={() => {
              if (!edging.current) return
              edging.current = null
              setResizing(false)
              setPlace((p) => {
                if (p) save(p)
                return p
              })
            }}
            onPointerCancel={() => {
              edging.current = null
              setResizing(false)
            }}
          />
        ))}
      <div
        className="ac-window-bar"
        onPointerDown={(e) => {
          if (docked || !place || (e.target as Element).closest('button'))
            return
          e.preventDefault()
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = { dx: e.clientX - place.x, dy: e.clientY - place.y }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d || !place) return
          onHandle?.()
          setPlace(
            clamp({ ...place, x: e.clientX - d.dx, y: e.clientY - d.dy }),
          )
        }}
        onPointerUp={() => {
          if (drag.current && place) save(place)
          drag.current = null
        }}
        onDoubleClick={roll}
      >
        {lead}
        <span className="ac-window-title">{title}</span>
        {onDock && (
          <button
            type="button"
            className="ac-window-box ac-window-dock"
            aria-label={`Dock ${noun}`}
            title="Dock"
            onClick={onDock}
          >
            ↙
          </button>
        )}
        <button
          type="button"
          className="ac-window-box"
          aria-label={shut ? `Expand ${noun}` : `Minimize ${noun}`}
          aria-expanded={!shut}
          onClick={roll}
        >
          {shut ? '+' : '−'}
        </button>
        {trail}
      </div>
      {/* Anchored at its top left: rolling up shrinks it into that corner,
          unrolling grows it back out, as a lexeme's card opens. */}
      <AnimatePresence initial={false}>
        {!shut && (
          <motion.div
            key="open"
            className="ac-window-open"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={timing}
          >
            {/* Laid out at the open width throughout, so the text wraps
                the same while the window grows and its height is right. */}
            <motion.div
              ref={bodyRef}
              className="ac-window-body"
              style={
                docked
                  ? dockH === null
                    ? undefined
                    : { height: dockHeight }
                  : { width: openW - 2, maxHeight: place?.h ?? fitH }
              }
              aria-live={live ? 'polite' : 'off'}
            >
              {children}
            </motion.div>
            {foot}
            {!docked && (
              <div
                className="ac-window-grip"
                role="separator"
                aria-orientation="vertical"
                aria-label={`Resize ${noun}`}
                aria-valuenow={openW}
                aria-valuemin={MIN_W}
                aria-valuemax={MAX_W}
                aria-valuetext={`${openW} px wide${place?.h ? `, at most ${place.h} px tall` : ''}; arrow keys resize`}
                tabIndex={0}
                onPointerDown={(e) => {
                  if (!place) return
                  e.preventDefault()
                  e.stopPropagation()
                  e.currentTarget.setPointerCapture(e.pointerId)
                  onHandle?.()
                  sizing.current = { x: e.clientX, y: e.clientY, ...current() }
                  setResizing(true)
                }}
                onPointerMove={(e) => {
                  const d = sizing.current
                  if (!d) return
                  resize(d.w + e.clientX - d.x, d.h + e.clientY - d.y, false)
                }}
                onPointerUp={() => {
                  if (!sizing.current) return
                  sizing.current = null
                  setResizing(false)
                  setPlace((p) => {
                    if (p) save(p)
                    return p
                  })
                }}
                onPointerCancel={() => {
                  sizing.current = null
                  setResizing(false)
                }}
                // Back to the size it opens at.
                onDoubleClick={() =>
                  setPlace((p) => {
                    if (!p) return p
                    const next = { ...p, w: undefined, h: undefined }
                    save(next)
                    return next
                  })
                }
                onKeyDown={(e) => {
                  const step = {
                    ArrowLeft: [-NUDGE, 0],
                    ArrowRight: [NUDGE, 0],
                    ArrowUp: [0, -NUDGE],
                    ArrowDown: [0, NUDGE],
                  }[e.key]
                  if (!step) return
                  e.preventDefault()
                  e.stopPropagation()
                  const { w, h } = current()
                  resize(w + step[0], h + step[1], true)
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}
