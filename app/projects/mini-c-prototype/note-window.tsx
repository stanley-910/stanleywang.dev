import { useEffect, useRef, useState } from 'react'

import type { ReactNode, RefObject } from 'react'

// The step's explanation, in a small window of its own over the simulation,
// so the pane under the source can hold what the phase keeps track of (the
// stack, the scopes). A quiet window: a file's name on the bar to drag it
// by, and a − that rolls it up to the bar alone (□ unrolls it) (Stanley,
// 2026-09-26). Where it sits and whether it's rolled up are remembered in
// this browser.
const KEY = 'mini-c-note-window'
const MARGIN = 8

type Place = { x: number; y: number; shut: boolean }

const load = (): Place | null => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return saved && typeof saved.x === 'number' && typeof saved.y === 'number'
      ? { x: saved.x, y: saved.y, shut: !!saved.shut }
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
}: {
  title: ReactNode
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
}) {
  const ref = useRef<HTMLElement>(null)
  const [place, setPlace] = useState<Place | null>(null)
  const drag = useRef<{ dx: number; dy: number } | null>(null)

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
  useEffect(() => {
    const area = bounds.current
    if (!area) return
    const observer = new ResizeObserver(() =>
      setPlace((p) => (p ? clamp(p) : p)),
    )
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

  return (
    <section
      ref={ref}
      className={`ac-window ${place?.shut ? 'shut' : ''} ${error ? 'err' : ''}`}
      aria-label="Current step"
      style={
        place
          ? { left: place.x, top: place.y }
          : // Measured before it's placed: hidden for that first frame.
            { visibility: 'hidden' }
      }
    >
      <div
        className="ac-window-bar"
        onPointerDown={(e) => {
          if (!place || (e.target as Element).closest('button')) return
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
          aria-label={place?.shut ? 'Expand' : 'Minimize'}
          aria-expanded={!place?.shut}
          onClick={roll}
        >
          {place?.shut ? '□' : '−'}
        </button>
      </div>
      {!place?.shut && (
        <>
          <div className="ac-window-body" aria-live={live ? 'polite' : 'off'}>
            {children}
          </div>
          {foot}
        </>
      )}
    </section>
  )
}
