'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import type { CSSProperties } from 'react'

// The rows of the site index (SiteIndex) and the top bar's dropdowns
// (SiteHeader): a mark (the site index's only), a name, and a dotted leader
// out to a count or a date, styled in site-index.css. Opening, each row's
// words bloom in through the garden's petal ramp, sparse to dense
// (garden/engine/typeset.ts), and the current row's mark through the flower
// centre's.

const PETAL = ".':-=+*x#%"
const DISC = '.o0O'
/** Each row starts this long after the one above it, in ms. */
const STAGGER = 26
/** Each letter starts this long after the one before it. */
const LETTER = 5
/** One letter's run through the ramp. */
const RAMP = 150

export const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** How long `labels`, one per row, take to bloom in, in ms. */
export function bloomMs(labels: string[]) {
  const longest = Math.max(...labels.map((l) => l.length))
  return (labels.length - 1) * STAGGER + longest * LETTER + RAMP
}

function bloom(text: string, t: number, ramp: string) {
  let out = ''
  for (let k = 0; k < text.length; k++) {
    const c = text[k]
    const p = (t - k * LETTER) / RAMP
    out +=
      c === ' ' || p >= 1 ? c : p < 0 ? ' ' : ramp[Math.floor(p * ramp.length)]
  }
  return out
}

type BloomProps = { text: string; row: number; t: number | null; ramp?: string }

/** Text that blooms in while `t` runs; screen readers get the words as they are. */
function Bloom({ text, row, t, ramp = PETAL }: BloomProps) {
  const shown = t === null ? text : bloom(text, t - row * STAGGER, ramp)
  if (shown === text) return <>{text}</>
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{shown}</span>
    </>
  )
}

/**
 * The bloom's clock: the time since opening while the rows bloom, else null.
 * Call `start` as it opens, so its first frame is already blank; the clock
 * runs while `open`, for `ms`.
 */
export function useBloom(open: boolean, ms: number) {
  const [t, setT] = useState<number | null>(null)
  useEffect(() => {
    if (!open || reducedMotion()) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const e = now - t0
      setT(e >= ms ? null : e)
      if (e < ms) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      setT(null)
    }
  }, [open, ms])
  const start = () => setT(reducedMotion() ? null : 0)
  return [t, start] as const
}

export type IndexEntry = { href: string; label: string; meta?: string }

type IndexRowProps = {
  entry: IndexEntry
  /** Its place in the list, for the stagger. */
  row: number
  current: boolean
  t: number | null
  onClick?: () => void
  tabIndex?: number
  /** Leads with the mark; the top bar's dropdowns go without. */
  mark?: boolean
}

/**
 * One row: `·`, or `@` for the current one (unless `mark` is off), its name,
 * and a leader to its meta.
 */
export function IndexRow({
  entry,
  row,
  current,
  t,
  onClick,
  tabIndex,
  mark = true,
}: IndexRowProps) {
  return (
    <Link
      href={entry.href}
      className="site-index-row"
      aria-current={current ? 'page' : undefined}
      style={{ '--i': row } as CSSProperties}
      tabIndex={tabIndex}
      onClick={onClick}
    >
      {mark && (
        <span className="site-index-mark" aria-hidden="true">
          {current ? <Bloom text="@" row={row} t={t} ramp={DISC} /> : '·'}
        </span>
      )}
      <span className="site-index-name">
        <Bloom text={entry.label} row={row} t={t} />
      </span>
      {entry.meta && (
        <>
          <span className="site-index-lead" aria-hidden="true" />
          <span className="site-index-meta">{entry.meta}</span>
        </>
      )}
    </Link>
  )
}
