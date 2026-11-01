'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

import { BLOG_POSTS, EXPERIENCE_POSTS, PROJECTS } from '@/app/data'
import { PHOTOS } from '@/app/photos/photos'
import { announceMenuOpen, useCloseOnOtherMenu } from '@/lib/menus'

import { bloomMs, IndexRow, reducedMotion, useBloom } from './index-row'

import type { IndexEntry } from './index-row'

import './site-index.css'

// The top bar on a phone: the five words fold into a glyph in the top-left
// corner that opens an index of the site, in the site menu's glass
// (design/circadian-meadow/components/SiteIndex). Each section is a dot, the
// current one a flower's `@`, with a dotted leader out to what's in it.

const POSTS = [...BLOG_POSTS, ...EXPERIENCE_POSTS]

/** The top bar's five words (app/header.tsx), each with how much is in it. */
const SECTIONS: IndexEntry[] = [
  { href: '/', label: 'meadow' },
  { href: '/projects', label: 'projects', meta: String(PROJECTS.length) },
  { href: '/photos', label: 'photos', meta: String(PHOTOS.length) },
  { href: '/writing', label: 'writing', meta: String(POSTS.length) },
  { href: '/music', label: 'music', meta: 'soon' },
]

const BLOOM_MS = bloomMs(SECTIONS.map((s) => s.label))

const isCurrent = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href)

type Phase = 'closed' | 'open' | 'closing'

type SiteIndexProps = { pathname: string; hidden: boolean }

export function SiteIndex({ pathname, hidden }: SiteIndexProps) {
  const [phase, setPhase] = useState<Phase>('closed')
  const [t, startBloom] = useBloom(phase === 'open', BLOOM_MS)
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
    startBloom()
  }

  useCloseOnOtherMenu('index', phase === 'open', close)

  // Focus goes to the first entry.
  useEffect(() => {
    if (phase !== 'open') return
    panelRef.current
      ?.querySelector<HTMLElement>('a')
      ?.focus({ preventScroll: true })
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
          {SECTIONS.map((section, i) => {
            const current = isCurrent(pathname, section.href)
            return (
              <li key={section.href}>
                <IndexRow
                  entry={section}
                  row={i}
                  current={current}
                  t={t}
                  onClick={close}
                />
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
