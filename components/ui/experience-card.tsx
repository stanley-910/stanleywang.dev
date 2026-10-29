'use client'
import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import './experience-card.css'

export type Experience = {
  company: string
  title: string
  start: string
  end: string
  desc: string
  link: string
  logo?: string
  caseStudy?: string
}

// How long the pointer may be away (moving from the name to the card, say)
// before the card closes.
const CLOSE_DELAY = 120
// Closest the card may come to the window's edge.
const EDGE = 12
// The card's distance from the line (--space-1).
const GAP = 8

// A company name in the bio. Hovering or focusing it opens a small card
// above the line: who, when, the role and what the work was
// (design/circadian-meadow/components/ExperienceCard). On a touch screen the
// first tap opens the card and a second opens the site.
export function ExperienceLink({
  job,
  children,
}: {
  job: Experience
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [shift, setShift] = useState({ x: 0, below: false })
  const wrapRef = useRef<HTMLSpanElement>(null)
  const cardRef = useRef<HTMLSpanElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const tapToOpen = useRef(false)
  const id = useId()

  const show = useCallback(() => {
    clearTimeout(closeTimer.current)
    setOpen(true)
  }, [])
  const hide = useCallback(() => {
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY)
  }, [])

  // Keep the card inside the window: slide it sideways, or drop it below
  // the line when there's no room above.
  useLayoutEffect(() => {
    if (!open || !cardRef.current || !wrapRef.current) return
    // Measured from the name, not the card, so a card left shifted or
    // flipped from last time doesn't skew it.
    const name = wrapRef.current.getClientRects()[0]
    const { offsetWidth: w, offsetHeight: h } = cardRef.current
    const vw = document.documentElement.clientWidth
    let x = 0
    if (name.left + w > vw - EDGE) x = vw - EDGE - (name.left + w)
    if (name.left + x < EDGE) x = EDGE - name.left
    setShift({ x, below: name.top - GAP - h < EDGE })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  useEffect(() => () => clearTimeout(closeTimer.current), [])

  return (
    <span
      ref={wrapRef}
      className="xp"
      onPointerEnter={(e) => e.pointerType === 'mouse' && show()}
      onPointerLeave={(e) => e.pointerType === 'mouse' && hide()}
      onFocus={show}
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node)) hide()
      }}
    >
      <a
        href={job.link}
        target="_blank"
        rel="noopener noreferrer"
        className="link"
        aria-describedby={open ? id : undefined}
        onPointerDown={(e) => {
          // Read before the tap's focus opens the card.
          tapToOpen.current = e.pointerType !== 'mouse' && !open
        }}
        onClick={(e) => {
          // On touch, the first tap shows the card instead of leaving.
          if (tapToOpen.current) {
            tapToOpen.current = false
            e.preventDefault()
            show()
          }
        }}
      >
        {children}
      </a>
      <span
        ref={cardRef}
        id={id}
        className="xp-card"
        data-open={open || undefined}
        data-below={shift.below || undefined}
        style={{ '--shift-x': `${shift.x}px` } as React.CSSProperties}
      >
        <span className="xp-body">
          <span className="xp-top">
            <span className="xp-company">
              {job.logo && (
                <span
                  className="xp-logo"
                  aria-hidden="true"
                  style={
                    { '--logo': `url(${job.logo})` } as React.CSSProperties
                  }
                />
              )}
              {job.company}
            </span>
            <span className="xp-when">
              {job.end ? `${job.start}–${job.end}` : job.start}
            </span>
          </span>
          <span className="xp-role">{job.title}</span>
          <span className="xp-desc">{job.desc}</span>
          {job.caseStudy && (
            <Link
              href={job.caseStudy}
              className="link-quiet xp-more"
              tabIndex={open ? 0 : -1}
            >
              case study
            </Link>
          )}
        </span>
      </span>
    </span>
  )
}
