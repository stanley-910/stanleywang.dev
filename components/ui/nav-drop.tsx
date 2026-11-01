'use client'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { announceMenuOpen, useCloseOnOtherMenu } from '@/lib/menus'

import { bloomMs, IndexRow, reducedMotion, useBloom } from './index-row'

import type { IndexEntry } from './index-row'
import type { KeyboardEvent } from 'react'

import './nav-drop.css'

// A top bar word with a dropdown of what's in its section, for a mouse
// (design/circadian-meadow/components/SiteHeader, "Dropdowns"). Hovering the
// word, or focusing it from the keyboard, unrolls the site index's rows under
// it. The word still goes to its page; a finger only gets the word.

/** A pointer that rests on the word this long opens it, in ms. */
const OPEN_DELAY = 140
/** Leaving it, the pointer has this long to come back before it closes. */
const CLOSE_GRACE = 260
const HOVER = '(hover: hover) and (pointer: fine)'

/** The dropdown that's open, so moving along the words switches at once. */
let shown: string | null = null

type Phase = 'closed' | 'open' | 'closing'

type NavDropProps = {
  href: string
  label: string
  entries: IndexEntry[]
  pathname: string
  current: boolean
  hidden: boolean
}

export function NavDrop({
  href,
  label,
  entries,
  pathname,
  current,
  hidden,
}: NavDropProps) {
  const [phase, setPhase] = useState<Phase>('closed')
  const [canHover, setCanHover] = useState(false)
  const [lastPath, setLastPath] = useState(pathname)
  const [t, startBloom] = useBloom(
    phase === 'open',
    bloomMs(entries.map((e) => e.label)),
  )
  const itemRef = useRef<HTMLLIElement>(null)
  const wordRef = useRef<HTMLAnchorElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const phaseRef = useRef<Phase>('closed')
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])
  const id = `nav-drop-${label}`

  // A new page, or hidden text, shuts it at once.
  if (pathname !== lastPath) {
    setLastPath(pathname)
    if (phase !== 'closed') setPhase('closed')
  }
  if (hidden && phase !== 'closed') setPhase('closed')

  useEffect(() => {
    const mq = window.matchMedia(HOVER)
    const update = () => setCanHover(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const open = useCallback(() => {
    window.clearTimeout(timer.current)
    shown = label
    announceMenuOpen(id)
    if (phaseRef.current === 'open') return
    phaseRef.current = 'open'
    startBloom()
    setPhase('open')
  }, [id, label, startBloom])

  const close = useCallback(() => {
    window.clearTimeout(timer.current)
    if (shown === label) shown = null
    setPhase((p) => (p !== 'open' ? p : reducedMotion() ? 'closed' : 'closing'))
  }, [label])

  useCloseOnOtherMenu(id, phase === 'open', close)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Escape, or a click outside, closes it.
  useEffect(() => {
    if (phase !== 'open') return
    const onDown = (e: PointerEvent) => {
      if (!itemRef.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (itemRef.current?.contains(document.activeElement))
        wordRef.current?.focus({ preventScroll: true })
      close()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [phase, close])

  const links = () => [
    ...(itemRef.current?.querySelectorAll<HTMLElement>('.nav-drop-pop a') ??
      []),
  ]

  // Arrows go down into the list and along it; Tab moves on to the next
  // word, so the bar stays five stops long.
  const onKeyDown = (e: KeyboardEvent<HTMLLIElement>) => {
    if (!canHover || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return
    e.preventDefault()
    if (phase !== 'open') {
      if (e.key === 'ArrowUp') return
      // The rows can take focus once they're shown, a frame on.
      open()
      requestAnimationFrame(() => links()[0]?.focus({ preventScroll: true }))
      return
    }
    const all = links()
    const at = all.indexOf(document.activeElement as HTMLElement)
    const next =
      e.key === 'ArrowDown' ? Math.min(at + 1, all.length - 1) : at - 1
    const target = next < 0 ? wordRef.current : all[next]
    target?.focus({ preventScroll: true })
  }

  const hoverHandlers = canHover
    ? {
        onPointerEnter: (e: React.PointerEvent) => {
          if (e.pointerType !== 'mouse') return
          window.clearTimeout(timer.current)
          if (phase === 'open') return
          // Moving along from another open word switches at once.
          timer.current = window.setTimeout(open, shown ? 0 : OPEN_DELAY)
        },
        onPointerLeave: (e: React.PointerEvent) => {
          if (e.pointerType !== 'mouse') return
          window.clearTimeout(timer.current)
          const active = document.activeElement
          // Held open by the keyboard.
          if (
            itemRef.current?.contains(active) &&
            active?.matches(':focus-visible')
          )
            return
          timer.current = window.setTimeout(close, CLOSE_GRACE)
        },
        onFocus: (e: React.FocusEvent) => {
          if (
            e.target === wordRef.current &&
            e.target.matches(':focus-visible')
          )
            open()
        },
        onBlur: (e: React.FocusEvent) => {
          if (!itemRef.current?.contains(e.relatedTarget as Node | null))
            close()
        },
      }
    : {}

  return (
    <li
      ref={itemRef}
      className="nav-drop"
      onKeyDown={onKeyDown}
      {...hoverHandlers}
    >
      <Link
        ref={wordRef}
        href={href}
        data-avoid="light"
        aria-current={current ? 'page' : undefined}
        aria-expanded={canHover ? phase === 'open' : undefined}
        aria-controls={canHover ? id : undefined}
        onClick={close}
      >
        {label}
      </Link>
      {canHover && (
        <div
          id={id}
          className="nav-drop-pop"
          data-state={phase}
          data-own-scroll
          hidden={phase === 'closed'}
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget && phase === 'closing')
              setPhase('closed')
          }}
        >
          <ul className="site-index-list" aria-label={label}>
            {entries.map((entry, i) => (
              <li key={entry.label}>
                <IndexRow
                  entry={entry}
                  row={i}
                  current={pathname === entry.href}
                  t={t}
                  tabIndex={-1}
                  mark={false}
                  onClick={close}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}
