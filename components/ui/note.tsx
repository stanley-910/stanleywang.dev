'use client'
import { useEffect, useId, useState } from 'react'

import { cn } from '@/lib/utils'
import '@/app/styles/note.css'

type NoteProps = {
  children: React.ReactNode
  aside: React.ReactNode
  mode?: 'tip' | 'footnote'
}

export function Note({ children, aside, mode = 'tip' }: NoteProps) {
  const [open, setOpen] = useState(false)
  const [narrow, setNarrow] = useState(false)
  const id = useId()

  useEffect(() => {
    if (mode !== 'tip') return
    const mq = window.matchMedia('(max-width: 480px)')
    const update = () => setNarrow(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [mode])

  const effectiveMode = mode === 'tip' && narrow ? 'footnote' : mode

  if (effectiveMode === 'tip') {
    return (
      <span className="note-tip" tabIndex={0} aria-describedby={id}>
        {children}
        <span role="tooltip" id={id} className="note-tip-bubble">
          {aside}
        </span>
      </span>
    )
  }

  const toggle = () => setOpen((o) => !o)

  return (
    <>
      <span
        className="note-fn"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            toggle()
          }
        }}
      >
        {children}
        <sup>†</sup>
      </span>
      <span id={id} className={cn('note-fn-aside', open && 'open')}>
        {aside}
      </span>
    </>
  )
}
