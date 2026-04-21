'use client'
import GithubSlugger from 'github-slugger'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { BLOG_POSTS } from '@/app/data'
import '@/app/styles/toc.css'
import { layoutStars } from '@/lib/toc-starmap'

interface TocItem {
  level: number
  text: string
  slug: string
}

export type TocVariant = 'classic' | 'staffline' | 'vim' | 'constellation'

const CONSTELLATION_MAX_NODES = 12

const variantByTag: Record<string, TocVariant> = {
  jazz: 'staffline',
  music: 'staffline',
  essay: 'staffline',
  art: 'staffline',
  ml: 'vim',
  'machine learning': 'vim',
  dev: 'vim',
  code: 'vim',
  algorithms: 'vim',
  rnns: 'vim',
}

function resolveVariantFromTags(tags: string[]): TocVariant {
  for (const tag of tags) {
    const mapped = variantByTag[tag.toLowerCase()]
    if (mapped) return mapped
  }
  return 'classic'
}

export function TableOfContents({
  title,
  variant,
}: {
  title?: string
  variant?: TocVariant
}) {
  const pathname = usePathname()
  const [headings, setHeadings] = useState<TocItem[]>([])
  const [minLevel, setMinLevel] = useState(1)
  const [activeId, setActiveId] = useState<string>('')
  const [scrollProgress, setScrollProgress] = useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  const post = BLOG_POSTS.find((p) => p.link === pathname)
  const requestedVariant: TocVariant =
    variant ?? resolveVariantFromTags(post?.tags ?? [])

  const shouldFallbackFromConstellation =
    requestedVariant === 'constellation' &&
    (headings.length > CONSTELLATION_MAX_NODES || prefersReducedMotion)

  const resolvedVariant: TocVariant = shouldFallbackFromConstellation
    ? 'staffline'
    : requestedVariant

  const totalMinutes = post?.readingTime
    ? parseInt(post.readingTime, 10) || 0
    : 0
  const minutesLeft = Math.max(
    0,
    Math.ceil(totalMinutes * (1 - scrollProgress)),
  )

  // Setup headings
  useEffect(() => {
    const slugger = new GithubSlugger()
    const headingElements = document.querySelectorAll('h1, h2, h3, h4')

    const items: TocItem[] = Array.from(headingElements)
      .filter((heading) => !heading.hasAttribute('data-toc-exclude'))
      .map((heading) => {
        const level = parseInt(heading.tagName[1])
        // Get text content and remove the hash symbol that appears in clickable headers
        const rawText = heading.textContent || ''
        const text = rawText.replace(/\s*#\s*$/, '').trim() // Remove trailing hash symbol with optional whitespace
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

  // Detect prefers-reduced-motion so constellation can fall back
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setPrefersReducedMotion(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Track scroll progress for the vim status bar
  useEffect(() => {
    if (resolvedVariant !== 'vim') return
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setScrollProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [resolvedVariant])

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

  const activeIndex = headings.findIndex((h) => h.slug === activeId)

  const items = headings.map((heading, index) => (
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
  ))

  const variantTitle =
    resolvedVariant === 'vim'
      ? ':TOC'
      : resolvedVariant === 'staffline'
        ? '§ contents'
        : resolvedVariant === 'constellation'
          ? 'index'
          : title

  if (resolvedVariant === 'constellation') {
    return (
      <ConstellationToc
        headings={headings}
        activeId={activeId}
        activeIndex={activeIndex}
        title={variantTitle}
        seed={pathname ?? 'default'}
        onNav={scrollToHeading}
      />
    )
  }

  return (
    <nav
      className={`table-of-contents toc-variant-${resolvedVariant} toc-always-on mounted ml-6`}
      data-next-scroll-boundary
    >
      {variantTitle && (
        <div className="flex items-center pt-2">
          <span className="toc-title mb-2 text-sm font-bold">
            {variantTitle}
          </span>
        </div>
      )}
      {resolvedVariant === 'vim' ? <ol>{items}</ol> : <ul>{items}</ul>}
      {resolvedVariant === 'vim' && (
        <div className="status">
          <span>
            {totalMinutes > 0 ? (
              <b>~{minutesLeft} min left</b>
            ) : (
              <b>─ NORMAL ─</b>
            )}
          </span>
          <span>
            {Math.max(0, activeIndex) + 1}/{headings.length}
          </span>
        </div>
      )}
    </nav>
  )
}

function ConstellationToc({
  headings,
  activeId,
  activeIndex,
  title,
  seed,
  onNav,
}: {
  headings: TocItem[]
  activeId: string
  activeIndex: number
  title?: string
  seed: string
  onNav: (slug: string) => void
}) {
  const points = useMemo(
    () => layoutStars(headings.length, seed),
    [headings.length, seed],
  )

  return (
    <nav
      className="table-of-contents toc-variant-constellation toc-always-on mounted ml-6"
      data-next-scroll-boundary
    >
      {title && (
        <div className="flex items-center pt-2">
          <span className="toc-title mb-2 text-sm font-bold">{title}</span>
        </div>
      )}
      <div className="map">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {points.slice(0, -1).map((p, i) => {
            const next = points[i + 1]
            const isActiveEdge = i === activeIndex
            return (
              <line
                key={i}
                x1={p.x}
                y1={p.y}
                x2={next.x}
                y2={next.y}
                stroke="var(--amber)"
                strokeOpacity={isActiveEdge ? 0.5 : 0.2}
                strokeWidth={0.4}
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
        </svg>
        <ul>
          {headings.map((heading, i) => {
            const p = points[i]
            const isActive = activeId === heading.slug
            return (
              <li
                key={heading.slug}
                className={`node${isActive ? ' active' : ''}`}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
              >
                <a
                  href={`#${heading.slug}`}
                  onClick={(e) => {
                    e.preventDefault()
                    onNav(heading.slug)
                  }}
                >
                  <span className="dot" aria-hidden="true" />
                  <span className="lbl">{heading.text}</span>
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
