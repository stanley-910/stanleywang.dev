import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import type { ReactNode, RefObject } from 'react'

// The step's explanation, in a small window of its own over the simulation,
// so the pane under the source can hold what the phase keeps track of (the
// stack, the scopes). A quiet window: a file's name on the bar to drag it
// by, and a − that rolls it up into its top-left corner, to the name and
// a + that grows it back out (Stanley, 2026-09-26). A grip at its bottom
// right sizes it: the width within bounds, the height only as a cap, so it
// never grows past what the note needs (2026-09-27). Where it sits, its
// size and whether it's rolled up are remembered in this browser. On a
// phone it docks over the controls instead (animated.css .ac-dock): no bar
// to drag or grip to size, only the − that rolls it up.
const KEY = 'mini-c-note-window'
const MARGIN = 8
const OPEN_W = 264
const MIN_W = 220
const MAX_W = 480
// The body's height cap: CSS gives min(220px, 40vh) until it's dragged.
const MIN_H = 72
// One arrow key's nudge of the grip.
const NUDGE = 16
// How far into the bottom-right corner the pointer folds the dog-ear.
const EAR_ZONE = 20
// Advance of one character of the 11px title.
const TITLE_CH = 6.6
// The page's easing for cards that open and close (animated.tsx).
const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

type Place = {
  x: number
  y: number
  shut: boolean
  /** The open width and the body's height cap, once resized. */
  w?: number
  h?: number
}

const load = (): Place | null => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
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
const save = (place: Place) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(place))
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
}) {
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
    setPlace(clamp(load() ?? { ...start(), shut: false }))
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // The width it can have here: a size saved on a wider screen gives way
  // (and comes back when there's room), rather than clipping the note.
  const [room, setRoom] = useState(Infinity)
  useEffect(() => {
    const area = bounds.current
    if (!area) return
    const observer = new ResizeObserver(() => {
      const inner = (areaRef.current ?? area).getBoundingClientRect()
      setRoom(Math.max(0, Math.floor(inner.width - 2 * MARGIN)))
      setPlace((p) => (p ? clamp(p) : p))
    })
    observer.observe(area)
    // It grows too: unrolled, or a longer note near the bottom edge.
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds])

  const roll = () =>
    setPlace((p) => {
      if (!p) return p
      const next = { ...p, shut: !p.shut }
      save(next)
      return next
    })

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
    w: Math.min(placeRef.current?.w ?? OPEN_W, roomRef.current),
    h: bodyRef.current?.offsetHeight ?? MIN_H,
  })

  const shut = !!place?.shut
  // The dog-ear (animated.css): folded while the pointer is in the window's
  // bottom-right corner. Found by where the pointer is, not by hovering the
  // grip: the fold clips the window there, and a clipped corner isn't
  // hovered, so it would unfold under the pointer and fold again. A press
  // anywhere in the corner, the cut part too, takes the grip.
  const gripRef = useRef<HTMLDivElement>(null)
  const [ear, setEar] = useState(false)
  useEffect(() => {
    if (shut || docked) {
      setEar(false)
      return
    }
    const inCorner = (e: PointerEvent) => {
      const box = ref.current?.getBoundingClientRect()
      return (
        !!box &&
        e.clientX >= box.right - EAR_ZONE &&
        e.clientX <= box.right &&
        e.clientY >= box.bottom - EAR_ZONE &&
        e.clientY <= box.bottom
      )
    }
    const moved = (e: PointerEvent) => {
      if (!sizing.current) setEar(e.pointerType !== 'touch' && inCorner(e))
    }
    const pressed = (e: PointerEvent) => {
      const grip = gripRef.current
      if (!grip || e.button !== 0 || !inCorner(e)) return
      if (grip.contains(e.target as Node)) return
      e.preventDefault()
      grip.setPointerCapture(e.pointerId)
      sizing.current = { x: e.clientX, y: e.clientY, ...current() }
      setResizing(true)
    }
    const away = () => setEar(false)
    document.addEventListener('pointermove', moved, { passive: true })
    document.addEventListener('pointerdown', pressed, { capture: true })
    window.addEventListener('blur', away)
    return () => {
      document.removeEventListener('pointermove', moved)
      document.removeEventListener('pointerdown', pressed, { capture: true })
      window.removeEventListener('blur', away)
    }
    // (current() reads the latest place and room through refs)
  }, [shut, docked])
  const openW = Math.min(place?.w ?? OPEN_W, room)
  // Rolled up it is just the name and a +, exactly as wide as those
  // (monospace, 6.6px a character at 11px, plus the bar's padding).
  const width = docked
    ? '100%'
    : shut
      ? Math.ceil(title.length * TITLE_CH + 39)
      : openW
  const timing = { duration: still || resizing ? 0 : 0.22, ease: EASE }

  return (
    <motion.section
      ref={ref}
      className={`ac-window ${docked ? 'docked' : ''} ${shut ? 'shut' : ''} ${error ? 'err' : ''} ${ear || resizing ? 'ear' : ''}`}
      aria-label="Current step"
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
        <span className="ac-window-title">{title}</span>
        <button
          type="button"
          className="ac-window-box"
          aria-label={shut ? 'Expand notes' : 'Minimize notes'}
          aria-expanded={!shut}
          onClick={roll}
        >
          {shut ? '+' : '−'}
        </button>
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
            <div
              ref={bodyRef}
              className="ac-window-body"
              style={
                docked ? undefined : { width: openW - 2, maxHeight: place?.h }
              }
              aria-live={live ? 'polite' : 'off'}
            >
              {children}
            </div>
            {foot}
            {!docked && (
              <div
                ref={gripRef}
                className="ac-window-grip"
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize notes"
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
