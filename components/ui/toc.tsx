'use client'
import { useEffect, useState } from 'react'
import GithubSlugger from 'github-slugger'
import '@/app/styles/toc.css'

interface TocItem {
  level: number
  text: string
  slug: string
}

export function TableOfContents() {
  const [headings, setHeadings] = useState<TocItem[]>([])
  const [isVisible, setIsVisible] = useState(true)
  const [minLevel, setMinLevel] = useState(1)

  useEffect(() => {
    // Find all heading elements in the document
    const headingElements = document.querySelectorAll('h1, h2, h3, h4')
    const slugger = new GithubSlugger()
    
    const items: TocItem[] = Array.from(headingElements)
      .filter(heading => !heading.hasAttribute('data-toc-exclude')) // Exclude headings with data-toc-exclude
      .map((heading) => {
        const level = parseInt(heading.tagName[1]) // Get the heading level from h1, h2, etc.
        const text = heading.textContent || ''
        const slug = slugger.slug(text)
        
        // Ensure the heading has an ID for scrolling
        if (!heading.id) {
          heading.id = slug
        }

        return {
          level,
          text,
          slug
        }
      })

    // Find the minimum heading level
    if (items.length > 0) {
      const minHeadingLevel = Math.min(...items.map(item => item.level))
      setMinLevel(minHeadingLevel)
    }

    setHeadings(items)
  }, []) // Run once when component mounts

  const getIndentClass = (level: number) => {
    // Calculate relative indentation based on minimum level
    const relativeLevel = level - minLevel
    switch (relativeLevel) {
      case 0: // Top level (no indent)
        return 'toc-level-0'
      case 1: // One level deeper
        return 'toc-level-1'
      case 2: // Two levels deeper
        return 'toc-level-2'
      case 3: // Three levels deeper
        return 'toc-level-3'
      default:
        return 'toc-level-0'
    }
  }

  const scrollToHeading = (e: React.MouseEvent<HTMLAnchorElement>, slug: string) => {
    e.preventDefault()
    const element = document.getElementById(slug)
    if (element) {
      // Update URL with hash
      window.history.pushState({}, '', `#${slug}`)
      
      // Calculate scroll position with offset for some spacing at top
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.scrollY - 20 // 20px offset
      
      // Smooth scroll to element with offset
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }
  }

  if (headings.length === 0) {
    return null
  }

  return (
    <nav className={`table-of-contents ${isVisible ? 'toc-always-on' : ''}`}>
      <button 
        className="table-of-contents-anchor"
        // onClick={() => setIsVisible(!isVisible)}
        aria-label="Toggle table of contents"
      >
        ≡
        {/* {isVisible ? '≡' : '☰'} */}
      </button>
      <ul>
        {headings.map((heading, index) => (
          <li key={index} className={getIndentClass(heading.level)}>
            <a
              href={`#${heading.slug}`}
              onClick={(e) => scrollToHeading(e, heading.slug)}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
} 