'use client'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { BLOG_POSTS, EXPERIENCE_POSTS, PROJECTS } from '@/app/data'
import { PHOTOS } from '@/app/photos/photos'
import { announceMenuOpen, useCloseOnOtherMenu } from '@/lib/menus'

import './site-index.css'

// The top bar on a phone: the five words fold into a glyph in the top-left
// corner that opens an index of the site, in the site menu's glass
// (design/circadian-meadow/components/SiteIndex). Each section is a dot on a
// stalk, the current one a flower's `@`, with a few real entries under it.

type Entry = { href: string; label: string; meta?: string }
type Section = Entry & { entries?: Entry[] }

const POSTS = [...BLOG_POSTS, ...EXPERIENCE_POSTS].sort((a, b) =>
  b.date.localeCompare(a.date),
)

/** The top bar's five words (app/header.tsx), each with what's under it. */
const SECTIONS: Section[] = [
  { href: '/', label: 'meadow' },
  {
    href: '/projects',
    label: 'projects',
    meta: String(PROJECTS.length),
    entries: PROJECTS.slice(0, 3).map((p) => ({
      href: `/projects#${p.slug}`,
      label: p.name,
    })),
  },
  { href: '/photos', label: 'photos', meta: String(PHOTOS.length) },
  {
    href: '/writing',
    label: 'writing',
    meta: String(POSTS.length),
    entries: POSTS.slice(0, 3).map((p) => ({
      href: p.link,
      label: p.title,
      meta: p.date.slice(0, 7),
    })),
  },
  { href: '/music', label: 'music', meta: 'soon' },
]

const ROW_COUNT = SECTIONS.reduce((n, s) => n + 1 + (s.entries?.length ?? 0), 0)

// Opening, each row's words bloom in through the garden's petal ramp, sparse
// to dense (garden/engine/typeset.ts), and the current section's mark
// through the flower centre's.
const PETAL = ".':-=+*x#%"
const DISC = '.o0O'
/** Each row starts this long after the one above it, in ms. */
const STAGGER = 26
/** Each letter starts this long after the one before it. */
const LETTER = 5
/** One letter's run through the ramp. */
const RAMP = 150
const LONGEST = Math.max(
  ...SECTIONS.flatMap((s) => [s, ...(s.entries ?? [])]).map(
    (e) => e.label.length,
  ),
)
const BLOOM_MS = (ROW_COUNT - 1) * STAGGER + LONGEST * LETTER + RAMP

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

const isCurrent = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href)

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

type Phase = 'closed' | 'open' | 'closing'

type SiteIndexProps = { pathname: string; hidden: boolean }

export function SiteIndex({ pathname, hidden }: SiteIndexProps) {
  const [phase, setPhase] = useState<Phase>('closed')
  // Time since opening while the rows bloom, else null.
  const [t, setT] = useState<number | null>(null)
  const [lastPath, setLastPath] = useState(pathname)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // A new page, or hidden text, shuts it at once.
  if (pathname !== lastPath) {
    setLastPath(pathname)
    if (phase !== 'closed') setPhase('closed')
  }
  if (hidden && phase !== 'closed') setPhase('closed')

  /** Closes, handing focus back to the glyph unless it has gone elsewhere. */
  const close = useCallback(() => {
    setPhase((p) => (p !== 'open' ? p : reducedMotion() ? 'closed' : 'closing'))
    const active = document.activeElement
    if (
      !active ||
      active === document.body ||
      panelRef.current?.contains(active)
    )
      buttonRef.current?.focus({ preventScroll: true })
  }, [])

  const toggle = () => {
    if (phase === 'open') return close()
    announceMenuOpen('index')
    setPhase('open')
    setT(reducedMotion() ? null : 0)
  }

  useCloseOnOtherMenu('index', phase === 'open', close)

  // Focus goes to the first entry, and the rows bloom.
  useEffect(() => {
    if (phase !== 'open') return
    panelRef.current
      ?.querySelector<HTMLElement>('a')
      ?.focus({ preventScroll: true })
    if (reducedMotion()) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const e = now - t0
      setT(e >= BLOOM_MS ? null : e)
      if (e < BLOOM_MS) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      setT(null)
    }
  }, [phase])

  // Close on a tap outside, Escape, focus leaving, or the window growing
  // past a phone's, where the words come back.
  useEffect(() => {
    if (phase !== 'open') return
    const panel = panelRef.current
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!panel?.contains(target) && !buttonRef.current?.contains(target))
        close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null
      if (next && !panel?.contains(next) && next !== buttonRef.current)
        setPhase('closed')
    }
    const wide = window.matchMedia('(min-width: 481px)')
    const onWide = () => wide.matches && setPhase('closed')
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    panel?.addEventListener('focusout', onFocusOut)
    wide.addEventListener('change', onWide)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      panel?.removeEventListener('focusout', onFocusOut)
      wide.removeEventListener('change', onWide)
    }
  }, [phase, close])

  let row = 0
  const link = (entry: Entry, mark: string, current: boolean) => {
    const i = row++
    return (
      <Link
        href={entry.href}
        className="site-index-row"
        aria-current={current ? 'page' : undefined}
        style={{ '--i': i } as React.CSSProperties}
        onClick={close}
      >
        <span className="site-index-mark" aria-hidden="true">
          {mark === '@' ? <Bloom text="@" row={i} t={t} ramp={DISC} /> : mark}
        </span>
        <span className="site-index-name">
          <Bloom text={entry.label} row={i} t={t} />
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

  return (
    <div className="site-index">
      <button
        ref={buttonRef}
        type="button"
        className="site-index-toggle"
        data-avoid
        aria-label="Index"
        aria-expanded={phase === 'open'}
        aria-controls="site-index"
        onClick={toggle}
      >
        <svg
          className="site-index-glyph"
          viewBox="0 0 16 16"
          width="16"
          height="16"
          aria-hidden="true"
        >
          <line x1="1" y1="4" x2="15" y2="4" />
          <line x1="1" y1="8" x2="15" y2="8" />
          <line x1="1" y1="12" x2="15" y2="12" />
        </svg>
      </button>
      <div
        ref={panelRef}
        id="site-index"
        className="site-index-pop"
        data-state={phase}
        data-own-scroll
        hidden={phase === 'closed'}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget && phase === 'closing')
            setPhase('closed')
        }}
      >
        <ol className="site-index-list">
          {SECTIONS.map((section) => {
            const current = isCurrent(pathname, section.href)
            return (
              <li key={section.href}>
                {link(section, current ? '@' : '·', current)}
                {section.entries && (
                  <ul className="site-index-list">
                    {section.entries.map((entry) => (
                      <li key={entry.href} className="site-index-entry">
                        {link(entry, '|', pathname === entry.href)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
