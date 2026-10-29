'use client'
import { MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useRef, useState } from 'react'

import { paletteAt } from '@/components/garden/engine/palette'
import {
  applyColours,
  currentHour,
  HOUR_EVENT,
  readingColours,
  setHour,
  type PageTheme,
} from '@/lib/circadian'

import './time-control.css'

// The sun/moon opens the time slider (design/circadian-meadow/components/
// ReadingTime). The page's colours follow the hour shown here, the clock's or
// one set by hand for this visit, and home's meadow follows the same hour.

const PHASES: [number, string][] = [
  [0, 'night'],
  [4.5, 'dawn'],
  [7.5, 'day'],
  [16.75, 'golden'],
  [18.5, 'sunset'],
  [19.75, 'twilight'],
  [21.4, 'night'],
]

const phaseAt = (h: number) =>
  PHASES.reduce((name, [from, n]) => (h >= from ? n : name), 'night')

const label = (h: number) => {
  const m = Math.round(h * 60) % (24 * 60)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

// The track: the horizon's colour through the day, sampled every hour.
const TRACK = `linear-gradient(to right, ${Array.from(
  { length: 25 },
  (_, i) => {
    const [r, g, b] = paletteAt(i % 24).skyHorizon
    return `rgb(${r | 0} ${g | 0} ${b | 0}) ${(i / 24) * 100}%`
  },
).join(', ')})`

/** Text fades out for this long before a family switch (time-control.css fades it back). */
const DIP_OUT = 90

export function ThemeSwitch({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false)
  const [hour, setHourState] = useState(12)
  const [set, setSet] = useState(false)
  const [open, setOpen] = useState(false)
  const { setTheme } = useTheme()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const family = useRef<PageTheme | null>(null)
  const dip = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Paint the page for the current hour, dipping the text across a family
  // switch so ink never meets a page of its own lightness.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const html = document.documentElement
    const paint = () => {
      const now = currentHour()
      setHourState(now.hour)
      setSet(now.set)
      const c = readingColours(now.hour)
      const switching = family.current !== null && family.current !== c.theme
      family.current = c.theme
      if (!switching || reduced.matches) {
        if (dip.current) return
        applyColours(c)
        setTheme(c.theme)
        return
      }
      if (dip.current) clearTimeout(dip.current)
      html.classList.add('time-dip')
      dip.current = setTimeout(() => {
        dip.current = null
        // The hour may have moved on while the text faded.
        const latest = readingColours(currentHour().hour)
        family.current = latest.theme
        applyColours(latest)
        setTheme(latest.theme)
        html.classList.remove('time-dip')
      }, DIP_OUT)
    }
    setMounted(true)
    paint()
    const tick = setInterval(() => {
      if (!currentHour().set) paint()
    }, 30_000)
    window.addEventListener(HOUR_EVENT, paint)
    return () => {
      clearInterval(tick)
      window.removeEventListener(HOUR_EVENT, paint)
      if (dip.current) clearTimeout(dip.current)
    }
  }, [setTheme])

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!popRef.current?.contains(t) && !buttonRef.current?.contains(t))
        setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!mounted) {
    return <span className={`inline-block h-4 w-4 ${className ?? ''}`} />
  }

  const isDark = readingColours(hour).theme === 'dark'
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const step = { PageUp: 1, PageDown: -1 }[e.key]
    if (step === undefined) return
    e.preventDefault()
    setHour(Math.min(24, Math.max(0, hour + step)))
  }

  return (
    <span className={`time-control ${className ?? ''}`}>
      <button
        ref={buttonRef}
        className="time-control-icon"
        type="button"
        aria-label="Time of day"
        aria-expanded={open}
        title={label(hour)}
        onClick={() => setOpen((o) => !o)}
      >
        {isDark ? (
          <MoonIcon className="h-4 w-4" strokeWidth={1.5} />
        ) : (
          <SunIcon className="h-4 w-4" strokeWidth={1.5} />
        )}
      </button>
      {open && (
        <div ref={popRef} className="time-control-pop">
          <input
            className="time-control-range"
            type="range"
            min={0}
            max={24}
            step={0.25}
            value={hour}
            aria-label="Hour"
            aria-valuetext={`${label(hour)}, ${phaseAt(hour)}`}
            style={{ '--track': TRACK } as React.CSSProperties}
            onChange={(e) => setHour(Number(e.target.value))}
            onKeyDown={onKeyDown}
          />
          <p className="time-control-readout">
            <span className="time-control-hour">{label(hour)}</span>
            <span className="time-control-phase">{phaseAt(hour)}</span>
            {set && (
              <button
                type="button"
                className="link-quiet time-control-now"
                onClick={() => setHour(null)}
              >
                now
              </button>
            )}
          </p>
        </div>
      )}
    </span>
  )
}
