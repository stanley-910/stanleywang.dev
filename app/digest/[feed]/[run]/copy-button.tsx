'use client'

import { useEffect, useState } from 'react'

/** The clipboard API, or a selected off-screen textarea where it's refused. */
async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    if (!ok) throw new Error('copy refused')
  }
}

/** Puts an item's brief on the clipboard, then says so for a moment. */
export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (state === 'idle') return
    const t = setTimeout(() => setState('idle'), 1600)
    return () => clearTimeout(t)
  }, [state])

  return (
    <span className="digest-copy">
      <button
        type="button"
        className="digest-copy-button"
        aria-label="Copy brief"
        title="Copy brief"
        onClick={() =>
          copyText(text).then(
            () => setState('copied'),
            () => setState('failed'),
          )
        }
      >
        <svg
          viewBox="0 0 16 16"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
          <path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" />
        </svg>
      </button>
      <span className="digest-copy-said" aria-live="polite">
        {state === 'copied'
          ? 'copied brief'
          : state === 'failed'
            ? 'copy failed'
            : ''}
      </span>
    </span>
  )
}
