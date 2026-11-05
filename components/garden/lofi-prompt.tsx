'use client'
import { useEffect, useState } from 'react'

import { dismissLofi, LOFI_ASK_EVENT, lofiAskForced, setLofi } from '@/lib/lofi'

// The offer of lo-fi (lib/lofi.ts) once the meadow has run slow for a while (lag.ts). OK turns
// lo-fi on and keeps it; dismissing it means it isn't offered again this session.
// TODO(design): a placeholder in existing tokens. Fable designs its look, placement, motion and
// copy (docs/handoffs/2026-11-02-status-tickets.md, LF1).
export function LofiPrompt() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const ask = () => setOpen(true)
    window.addEventListener(LOFI_ASK_EVENT, ask)
    if (lofiAskForced()) setOpen(true)
    return () => window.removeEventListener(LOFI_ASK_EVENT, ask)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      dismissLofi()
      setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null
  return (
    <div
      role="dialog"
      aria-label="Lighter version"
      data-no-sow
      className="fixed bottom-6 left-1/2 z-30 flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-4 rounded-[var(--radius-hair)] border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-[length:var(--text-meta)] text-[color:var(--ink)]"
    >
      {/* TODO(design): copy. */}
      <span>
        The meadow is running slowly here. Switch to a lighter version?
      </span>
      <button
        type="button"
        className="link-quiet"
        onClick={() => {
          setLofi(true)
          setOpen(false)
        }}
      >
        OK
      </button>
      <button
        type="button"
        className="link-quiet text-[color:var(--ink-muted)]"
        onClick={() => {
          dismissLofi()
          setOpen(false)
        }}
      >
        Not now
      </button>
    </div>
  )
}
