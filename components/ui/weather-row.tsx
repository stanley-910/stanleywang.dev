'use client'
import { useState } from 'react'

import { setWeather, useWeather, WEATHERS } from '@/lib/weather'

import type { WeatherKind } from '@/lib/weather'

import './weather-row.css'

// The site menu's weather (design/circadian-meadow/components/SiteMenu): five
// glyphs on one line in the dots' family (16px box, 1.5 stroke, round caps,
// the 320ms overshoot), and under them a readout like the dials', value in
// ink and name muted: `rain weather`. A mouse resting on a glyph shows its
// name there before it's picked.

/** Points round the middle, `r` out, at `a` degrees clockwise from 3 o'clock. */
const at = (r: number, a: number) => {
  const t = (a * Math.PI) / 180
  const f = (v: number) => Math.round((8 + v) * 1000) / 1000
  return [f(r * Math.cos(t)), f(r * Math.sin(t))]
}

function Sun() {
  return (
    <>
      <circle className="core" cx="8" cy="8" r="2.5" />
      <g className="rays">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
          const [x1, y1] = at(5, a)
          const [x2, y2] = at(6.25, a)
          return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} />
        })}
      </g>
    </>
  )
}

// Five drops on a slant of 3 across for 8 down, in two staggered rows. A
// second set waits one slant (6 across, 16 down) up and to the left, so as
// the drops fall out of the box's bottom right, the same drops come in at its
// top left.
const DROPS = [
  [2.5, 2.75],
  [7.25, 4.25],
  [12, 2.75],
  [4, 10.25],
  [8.75, 11.75],
]
const drop = ([x, y]: number[], dx = 0, dy = 0) =>
  `M${x + dx} ${y + dy}l1.125 3`

function Rain() {
  return (
    <g className="drops">
      <path d={DROPS.map((p) => drop(p)).join('')} />
      <path d={DROPS.map((p) => drop(p, -6, -16)).join('')} />
    </g>
  )
}

function Snow() {
  return (
    <>
      <path d="M8 2V14M2.804 5 13.196 11M2.804 11 13.196 5" />
      {/* One branch drawn on the top arm, turned onto each of the six. */}
      {[0, 60, 120, 180, 240, 300].map((a, i) => (
        <g key={a} transform={`rotate(${a} 8 8)`}>
          <path
            className="branch"
            style={{ '--i': i } as React.CSSProperties}
            d="M6.7 2.7 8 4 9.3 2.7"
          />
        </g>
      ))}
    </>
  )
}

function Storm() {
  return (
    <path className="bolt" d="M9.5 1.75 5 8.5l6-1-4.5 6.75" pathLength="1" />
  )
}

// The sun's ring behind the moon's, which sits down and to the left: the sun
// shows only outside the moon, with a little gap at each crossing. Its arc
// starts at 207° and runs 216°, so its middle is at 315°, top right, where
// the bead of a diamond ring shows once the moon is over it.
function Eclipse() {
  return (
    <>
      <path
        className="sun"
        d="M4.213 6.071A4.25 4.25 0 1 1 11.787 9.929 4.25 4.25 0 1 1 4.213 6.071"
        pathLength="360"
      />
      <circle className="moon" cx="8" cy="8" r="4.25" />
      <circle className="bead" cx="11.005" cy="4.995" r="1.4" />
    </>
  )
}

const GLYPHS: Record<WeatherKind, () => React.JSX.Element> = {
  clear: Sun,
  rain: Rain,
  snow: Snow,
  storm: Storm,
  eclipse: Eclipse,
}

/** True while a glyph's hover animation (not a transition) is still running. */
const animating = (el: HTMLElement) =>
  el
    .getAnimations({ subtree: true })
    .some((a) => a.playState === 'running' && 'animationName' in a)

export function WeatherRow() {
  const weather = useWeather()
  const [peek, setPeek] = useState<WeatherKind | null>(null)
  const [play, setPlay] = useState<WeatherKind | null>(null)
  const shown = peek ?? weather

  return (
    <div className="weather-row">
      <div className="weather-row-glyphs" role="group" aria-label="Weather">
        {WEATHERS.map((w) => {
          const Glyph = GLYPHS[w]
          return (
            <button
              key={w}
              type="button"
              className="time-control-item weather-row-item"
              aria-label={w}
              aria-pressed={weather === w}
              data-weather={w}
              data-play={play === w ? '' : undefined}
              onClick={() => {
                setWeather(w)
                setPlay(w)
              }}
              onPointerEnter={(e) => {
                if (e.pointerType !== 'mouse') return
                setPeek(w)
                e.currentTarget.dataset.hover = ''
              }}
              onPointerLeave={(e) => {
                setPeek(null)
                // A loop finishes its round, and a strike its flicker, rather
                // than snapping back the moment the pointer leaves. Set by
                // hand, not :hover, which has already gone by this event.
                const el = e.currentTarget
                if (animating(el)) el.dataset.settle = ''
                delete el.dataset.hover
              }}
              onAnimationIteration={(e) => {
                delete e.currentTarget.dataset.settle
              }}
              onAnimationEnd={(e) => {
                delete e.currentTarget.dataset.settle
                if (play === w) setPlay(null)
              }}
            >
              <svg
                className="weather-glyph"
                viewBox="0 0 16 16"
                width="16"
                height="16"
                aria-hidden="true"
              >
                <Glyph />
              </svg>
            </button>
          )
        })}
      </div>
      <p className="time-control-readout">
        <span
          className="time-control-hour"
          data-peek={shown !== weather ? '' : undefined}
        >
          {shown}
        </span>
        <span className="time-control-phase">weather</span>
      </p>
    </div>
  )
}
