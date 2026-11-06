'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import {
  dismissLofi,
  LOFI_ASK_EVENT,
  lofiAskForced,
  setLofi,
  useLofi,
} from '@/lib/lofi'

import './lofi-prompt.css'

// The offer of lo-fi (lib/lofi.ts) once the meadow has run slow for a while (lag.ts). OK turns
// lo-fi on and keeps it; dismissing it means it isn't offered again this session. It doesn't take
// focus from the page; a live region, always present, announces it instead.
//
// A note in the site menu's glass, hung from the menu's dots where the menu itself opens (lofi-prompt.css). OK
// closes it at once, since the whole page changes under it; Not now rolls it back up first.
export function LofiPrompt() {
  const [open, setOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  // Lo-fi turned on elsewhere (the menu, the terminal, another tab) answers the offer.
  const lofi = useLofi()
  const shown = open && !lofi
  const ref = useRef<HTMLDivElement>(null)

  // Hang it from the menu's dots, as the menu hangs: their bottom edge plus the menu's gap, its
  // right edge where the menu's is. The dots move between the phone's row and the corner, so
  // this is read from them rather than restated in CSS.
  useLayoutEffect(() => {
    const note = ref.current
    if (!shown || !note) return
    const place = () => {
      const dots = document.querySelector('.time-control-icon')
      if (!dots) return
      const r = dots.getBoundingClientRect()
      const gap =
        parseFloat(getComputedStyle(note).getPropertyValue('--space-2')) || 16
      note.style.setProperty('--offer-top', `${r.bottom + gap}px`)
      note.style.setProperty(
        '--offer-right',
        `${Math.max(0, innerWidth - r.right - gap)}px`,
      )
    }
    place()
    addEventListener('resize', place)
    return () => removeEventListener('resize', place)
  }, [shown])

  useEffect(() => {
    const ask = () => setOpen(true)
    window.addEventListener(LOFI_ASK_EVENT, ask)
    if (lofiAskForced()) setOpen(true)
    return () => window.removeEventListener(LOFI_ASK_EVENT, ask)
  }, [])

  const close = () => {
    setOpen(false)
    setLeaving(false)
  }

  // Not now: the note rolls up, then goes. With reduced motion there's no animation to wait for.
  const dismiss = () => {
    dismissLofi()
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) close()
    else setLeaving(true)
  }

  useEffect(() => {
    if (!shown || leaving) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // dismiss only reaches state setters, which are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, leaving])

  return (
    <div aria-live="polite">
      {(shown || leaving) && (
        <div
          ref={ref}
          role="group"
          aria-label="Lighter home"
          data-no-sow
          className="lofi-offer"
          data-leaving={leaving || undefined}
          onAnimationEnd={(e) => {
            if (e.animationName === 'lofi-offer-out') close()
          }}
        >
          {/* Draft copy; Stanley rewrites it (docs/handoffs/2026-11-05-overnight-lofi.md). */}
          <p className="lofi-offer-text">
            The meadow&apos;s running slow here.{' '}
            <span className="whitespace-nowrap">Lo-fi</span> instead?
          </p>
          <div className="lofi-offer-actions">
            <button
              type="button"
              className="lofi-offer-item"
              onClick={dismiss}
              disabled={leaving}
            >
              Not now
            </button>
            <button
              type="button"
              className="lofi-offer-item lofi-offer-primary"
              onClick={() => {
                setLofi(true)
                close()
              }}
              disabled={leaving}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
