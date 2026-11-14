'use client'

import { useLayoutEffect, useRef, useState } from 'react'

export interface SectionTab {
  label: string
  content: React.ReactNode
}

/** Two or more sections become tabs; one underline slides to the active one. */
export function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  const [active, setActive] = useState(0)
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  useLayoutEffect(() => {
    const measure = () => {
      const el = tabRefs.current[active]
      if (el) setBar({ x: el.offsetLeft, w: el.offsetWidth })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (listRef.current) ro.observe(listRef.current)
    return () => ro.disconnect()
  }, [active])

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (active + step + tabs.length) % tabs.length
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="digest-tabs">
      <div
        ref={listRef}
        className="digest-tablist"
        role="tablist"
        aria-label="Sections"
        onKeyDown={onKey}
      >
        {tabs.map((t, i) => (
          <button
            key={t.label}
            ref={(el) => {
              tabRefs.current[i] = el
            }}
            id={`digest-tab-${i}`}
            className="digest-tab"
            role="tab"
            type="button"
            aria-selected={i === active}
            aria-controls={`digest-panel-${i}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
          >
            {t.label}
          </button>
        ))}
        {bar && (
          <span
            className="digest-tab-bar"
            aria-hidden="true"
            style={{ transform: `translateX(${bar.x}px)`, width: bar.w }}
          />
        )}
      </div>
      {tabs.map((t, i) => (
        <div
          key={t.label}
          id={`digest-panel-${i}`}
          role="tabpanel"
          aria-labelledby={`digest-tab-${i}`}
          hidden={i !== active}
        >
          {t.content}
        </div>
      ))}
    </div>
  )
}
