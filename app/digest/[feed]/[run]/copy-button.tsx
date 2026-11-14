'use client'

import { useEffect, useState } from 'react'

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
      className="link-quiet digest-quiet digest-copy"
      onClick={() =>
        navigator.clipboard.writeText(text).then(
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
