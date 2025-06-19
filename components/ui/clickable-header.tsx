'use client'

import { ReactNode } from 'react'

interface ClickableHeaderProps {
  children: ReactNode
  slug: string
  level: 1 | 2 | 3 | 4
  className?: string
  dataAttributes?: Record<string, string>
}

// Client component to handle header clicks and URL hash updates
export function ClickableHeader({ 
  children, 
  slug, 
  level, 
  className = 'scroll-mt-[3vh]',
  dataAttributes = {}
}: ClickableHeaderProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    // Update URL hash without scrolling
    window.history.pushState(null, '', `#${slug}`)
    // Smooth scroll to the element
    document
      .getElementById(slug)
      ?.scrollIntoView({ behavior: 'smooth' })
  }

  const HeaderTag = `h${level}` as keyof JSX.IntrinsicElements

  return (
    <HeaderTag id={slug} className={className} {...dataAttributes}>
      <a
        href={`#${slug}`}
        className="group relative no-underline hover:no-underline"
        onClick={handleClick}
      >
        {children}
        {/* Hash symbol that appears on hover */}
        <span className="ml-2 opacity-0 transition-opacity group-hover:opacity-50">
          #
        </span>
      </a>
    </HeaderTag>
  )
} 