'use client'
import { useEffect, useState } from 'react'

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
// A note in the site menu's glass, under the bar on the bio's reading line (lofi-prompt.css). OK
// closes it at once, since the whole page changes under it; Not now rolls it back up first.
export function LofiPrompt() {
  const [open, setOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  // Lo-fi turned on elsewhere (the menu, the terminal, another tab) answers the offer.
  const lofi = useLofi()
  const shown = open && !lofi

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
