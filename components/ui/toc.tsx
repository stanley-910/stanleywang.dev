'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import GithubSlugger from 'github-slugger'
import '@/app/styles/toc.css'
import { TableOfContents as TableOfContentsIcon } from 'lucide-react'

interface TocItem {
  level: number
  text: string
  slug: string
}

export function TableOfContents({ title }: { title?: string }) {
  const [headings, setHeadings] = useState<TocItem[]>([])
  const [isVisible, setIsVisible] = useState(true)
  const [minLevel, setMinLevel] = useState(1)
  const [isMounted, setIsMounted] = useState(false)
  const [activeId, setActiveId] = useState<string>('')
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const [isScrollingProgrammatically, setIsScrollingProgrammatically] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const scrollTimeoutRef = useRef<number | null>(null)

  // Handle mounting state separately
  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  const scrollToTop = useCallback(() => {
    setIsScrollingProgrammatically(true)
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
    scrollTimeoutRef.current = window.setTimeout(() => {
      setIsScrollingProgrammatically(false)
      scrollTimeoutRef.current = null
    }, 500)
  }, [])
  
  // Scroll to heading helper
  const scrollToHeading = useCallback((slug: string | null, index: number) => {
    // Add early return if not initialized
    if (!isInitialized) {
      return
    }

    // Clear any existing timeout
    if (scrollTimeoutRef.current !== null) {
      window.clearTimeout(scrollTimeoutRef.current)
    }

    setIsScrollingProgrammatically(true)
    
    if (slug === null) {
      // Scroll to top when slug is null
      window.history.pushState({}, '', window.location.pathname)
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
      setActiveId('')
      setSelectedIndex(-1)
    } else {
      const element = document.getElementById(slug)
      if (element) {
        window.history.pushState({}, '', `#${slug}`)
        
        const elementPosition = element.getBoundingClientRect().top
        // Calculate the desired position (3% from the top)
        const desiredTopPercentage = 0.03;
        const viewportHeight = window.innerHeight;
        const desiredTopPosition = viewportHeight * desiredTopPercentage;

        // Calculate the offset needed to position the element at the desired position
        const offsetPosition = elementPosition + window.scrollY - desiredTopPosition;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        })
        
        setActiveId(slug)
        setSelectedIndex(index)
      }
    }
    
    // Set new timeout and store its reference
    scrollTimeoutRef.current = window.setTimeout(() => {
      setIsScrollingProgrammatically(false)
      scrollTimeoutRef.current = null
    }, 500)
  }, [isInitialized])

  // Setup headings
  useEffect(() => {
    const slugger = new GithubSlugger()
    const headingElements = document.querySelectorAll('h1, h2, h3, h4')
    
    const items: TocItem[] = Array.from(headingElements)
      .filter(heading => !heading.hasAttribute('data-toc-exclude'))
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
      const minHeadingLevel = Math.min(...items.map(item => item.level))
      setMinLevel(minHeadingLevel)
    }

    setHeadings(items)
    setIsInitialized(true)
  }, []) // Run once on mount

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (headings.length === 0) return

      if (e.key === 'j' || e.key === 'k') {
        e.preventDefault()
        
        let nextIndex = selectedIndex
        const currentLevel = selectedIndex !== -1 ? headings[selectedIndex].level : null

        if (e.key === 'j') {
          if (e.ctrlKey && currentLevel !== null) {
            for (let i = selectedIndex + 1; i < headings.length; i++) {
              if (headings[i].level === currentLevel) {
                nextIndex = i
                break
              }
            }
          } else {
            // If at top (-1), go to first heading
            nextIndex = selectedIndex === -1 ? 0 : Math.min(selectedIndex + 1, headings.length - 1)
          }
        } else if (e.key === 'k') {
          if (e.ctrlKey && currentLevel !== null) {
            for (let i = selectedIndex - 1; i >= 0; i--) {
              if (headings[i].level === currentLevel) {
                nextIndex = i
                break
              }
            }
          } else {
            // If at first heading and going up, go to top
            if (selectedIndex <= 0) {
              nextIndex = -1
            } else {
              nextIndex = Math.max(selectedIndex - 1, 0)
            }
          }
        }

        // Scroll to heading or top
        if (nextIndex !== selectedIndex) {
          if (nextIndex === -1) {
            scrollToHeading(null, -1)
          } else {
            scrollToHeading(headings[nextIndex].slug, nextIndex)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [headings, scrollToHeading, selectedIndex])

  // Setup intersection observer
  useEffect(() => {
    if (headings.length === 0) return

    let timeoutId: number | null = null

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingProgrammatically) {
          // Clear any existing timeout
          if (timeoutId !== null) {
            window.clearTimeout(timeoutId)
          }
          // Set a new timeout to allow intersection updates after scrolling
          timeoutId = window.setTimeout(() => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                if (window.scrollY < 10) {
                  setActiveId('')
                  setSelectedIndex(-1)
                } else {
                  setActiveId(entry.target.id)
                  const newIndex = headings.findIndex(item => item.slug === entry.target.id)
                  if (newIndex !== -1) {
                    setSelectedIndex(newIndex)
                  }
                }
              }
            })
          }, 500) // Small delay to ensure scroll has completed
          return
        }

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (window.scrollY < 10) {
              setActiveId('')
              setSelectedIndex(-1)
            } else {
              setActiveId(entry.target.id)
              const newIndex = headings.findIndex(item => item.slug === entry.target.id)
              if (newIndex !== -1) {
                setSelectedIndex(newIndex)
              }
            }
          }
        })
      },
      {
        rootMargin: '-3% 0px -92% 0px' // 3-8% from the top,
      }
    )

    const headingElements = document.querySelectorAll('h1, h2, h3, h4')
    headingElements.forEach((heading) => {
      if (heading.id) {
        observer.observe(heading)
      }
    })

    return () => {
      observer.disconnect()
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [headings, isScrollingProgrammatically])

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

  if (headings.length === 0) {
    return null
  }

  return (
    <nav 
      className={`ml-6 table-of-contents ${isVisible ? 'toc-always-on' : ''} ${isMounted ? 'mounted' : ''}`}
      aria-hidden={!isMounted}
    >
      <div className="flex items-center pt-2">
        {/* <button 
          className="table-of-contents-anchor"
          aria-label="Toggle table of contents"
        >
          <TableOfContentsIcon className="h-4 w-4" /> 
        </button> */}
        {title && (
          <span 
            className={`mb-2 font-bold text-sm text-zinc-500 dark:text-zinc-400 transition-opacity duration-700 cursor-pointer `}
            onClick={() => {
              setActiveId('')
              setSelectedIndex(-1)
              if (window.location.hash) {
                window.history.pushState({}, '', window.location.pathname)
              }
              scrollToTop()
            }}
          >
            {title}
          </span>
        )}
      </div>
      <ul>
        {headings.map((heading, index) => (
          <li 
            key={index} 
            className={`${getIndentClass(heading.level)} `}
          >
            <a
              href={`#${heading.slug}`}
              onClick={(e) => {
                e.preventDefault()
                scrollToHeading(heading.slug, index)
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