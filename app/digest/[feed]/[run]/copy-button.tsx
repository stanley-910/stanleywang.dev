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
    <button
      type="button"
      className="digest-action"
      onClick={() =>
        copyText(text).then(
          () => setState('copied'),
          () => setState('failed'),
        )
      }
    >
      <span aria-live="polite">
        {state === 'copied'
          ? 'Copied'
          : state === 'failed'
            ? 'Copy failed'
            : 'Copy brief'}
      </span>
    </button>
  )
}
