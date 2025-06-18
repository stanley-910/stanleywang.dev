'use client'
import GithubSlugger from 'github-slugger'
import { useEffect, useState } from 'react'
import '@/app/styles/toc.css'

interface TocItem {
  level: number
  text: string
  slug: string
}

export function TableOfContents({ title }: { title?: string }) {
  const [headings, setHeadings] = useState<TocItem[]>([])
  const [minLevel, setMinLevel] = useState(1)
  const [activeId, setActiveId] = useState<string>('')

  // Setup headings
  useEffect(() => {
    const slugger = new GithubSlugger()
    const headingElements = document.querySelectorAll('h1, h2, h3, h4')

    const items: TocItem[] = Array.from(headingElements)
      .filter((heading) => !heading.hasAttribute('data-toc-exclude'))
      .map((heading) => {
        const level = parseInt(heading.tagName[1])
        const text = heading.textContent || ''
        const slug = slugger.slug(text)

        if (!heading.id) {
          heading.id = slug
        }

        return { level, text, slug }
      })

    if (items.length > 0) {
      const minHeadingLevel = Math.min(...items.map((item) => item.level))
      setMinLevel(minHeadingLevel)
      setHeadings(items)
    }
  }, [])

  // Setup intersection observer for active state
  useEffect(() => {
    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (window.scrollY < 10) {
              setActiveId('')
            } else {
              setActiveId(entry.target.id)
            }
          }
        })
      },
      {
        rootMargin: '-3% 0px -92% 0px',
      },
    )

    const headingElements = document.querySelectorAll('h1, h2, h3, h4')
    headingElements.forEach((heading) => {
      if (heading.id) {
        observer.observe(heading)
      }
    })

    return () => observer.disconnect()
  }, [headings])

  const scrollToHeading = (slug: string) => {
    const element = document.getElementById(slug)
    if (element) {
      const scrollMargin = Math.round(window.innerHeight * 0.03)
      element.style.scrollMarginTop = `${scrollMargin}px`

      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })

      // Reset scroll margin after animation
      setTimeout(() => {
        element.style.scrollMarginTop = ''
      }, 1000)
    }
  }

  const getIndentClass = (level: number) => {
    const relativeLevel = level - minLevel
    switch (relativeLevel) {
      case 0:
        return 'toc-level-0'
      case 1:
        return 'toc-level-1'
      case 2:
        return 'toc-level-2'
      case 3:
        return 'toc-level-3'
      default:
        return 'toc-level-0'
    }
  }

  if (headings.length === 0) {
    return null
  }

  return (
    <nav
      className="table-of-contents toc-always-on mounted ml-6"
      data-next-scroll-boundary
    >
      {title && (
        <div className="flex items-center pt-2">
          <span className="mb-2 text-sm font-bold">{title}</span>
        </div>
      )}
      <ul>
        {headings.map((heading, index) => (
          <li key={index} className={getIndentClass(heading.level)}>
            <a
              href={`#${heading.slug}`}
              onClick={(e) => {
                e.preventDefault()
                scrollToHeading(heading.slug)
              }}
              className={activeId === heading.slug ? 'active' : ''}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
