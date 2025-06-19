'use client'

import React, { ReactNode } from 'react'

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
  dataAttributes = {},
}: ClickableHeaderProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    // Update URL hash without scrolling
    window.history.pushState(null, '', `#${slug}`)
    // Smooth scroll to the element
    document.getElementById(slug)?.scrollIntoView({ behavior: 'smooth' })
  }

  // Create the appropriate header element based on level
  const headerProps = {
    id: slug,
    className,
    ...dataAttributes,
  }

  const linkContent = (
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
  )

  // Return the appropriate header level with proper TypeScript typing
  switch (level) {
    case 1:
      return <h1 {...headerProps}>{linkContent}</h1>
    case 2:
      return <h2 {...headerProps}>{linkContent}</h2>
    case 3:
      return <h3 {...headerProps}>{linkContent}</h3>
    case 4:
      return <h4 {...headerProps}>{linkContent}</h4>
    default:
      return <h2 {...headerProps}>{linkContent}</h2>
  }
}
