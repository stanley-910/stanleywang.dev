'use client'
import GithubSlugger from 'github-slugger'
import { useEffect, useRef, useState } from 'react'

import '@/app/styles/toc.css'

// A post's table of contents (design/circadian-meadow/components/
// TableOfContents): a rail in the left gutter from 1280px, and a closed
// "contents" disclosure in the reading column below that. Opt in per post
// with <TOC /> in its MDX.

type Heading = {
  slug: string
  text: string
  /** 0 for the post's shallowest heading level, at most 2. */
  depth: number
}

type Node = Heading & { children: Node[] }

/** The heading counts as current once its top is above this share of the window. */
const CURRENT_LINE = 0.25

// The post body's section headings: not the header's title, nor anything
// marked out (the footnotes).
function readHeadings(): Heading[] {
  const slugger = new GithubSlugger()
  const els = [
    ...document.querySelectorAll<HTMLElement>(
      'main.post :is(h1, h2, h3, h4):not([data-toc-exclude])',
    ),
  ]
  const levels = els.map((el) => Number(el.tagName[1]))
  const top = Math.min(...levels)
  return els.map((el, i) => {
    // Clickable headers end in a "#"; it isn't part of the title.
    const text = (el.textContent ?? '').replace(/\s*#\s*$/, '').trim()
    if (!el.id) el.id = slugger.slug(text)
    return { slug: el.id, text, depth: Math.min(2, levels[i] - top) }
  })
}

// Nests the flat list so each <ol> mirrors a heading level.
function nest(headings: Heading[]): Node[] {
  const root: Node[] = []
  const stack: Node[] = []
  for (const h of headings) {
    const node: Node = { ...h, children: [] }
    while (stack.length && stack[stack.length - 1].depth >= h.depth) stack.pop()
    ;(stack.length ? stack[stack.length - 1].children : root).push(node)
    stack.push(node)
  }
  return root
}

export function TableOfContents() {
  const [headings, setHeadings] = useState<Heading[]>([])
  const [current, setCurrent] = useState('')
  const railRef = useRef<HTMLDivElement>(null)

  useEffect(() => setHeadings(readHeadings()), [])

  // The current section: the last heading above the line, or the last of
  // all at the page's foot. Read once per frame while scrolling.
  useEffect(() => {
    if (!headings.length) return
    const els = headings
      .map((h) => document.getElementById(h.slug))
      .filter((el): el is HTMLElement => el !== null)
    let frame = 0
    const update = () => {
      frame = 0
      const atFoot =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2
      if (atFoot) return setCurrent(els[els.length - 1].id)
      const line = window.innerHeight * CURRENT_LINE
      let id = ''
      for (const el of els) {
        if (el.getBoundingClientRect().top <= line) id = el.id
        else break
      }
      setCurrent(id)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [headings])

  // Keep the current row in view inside the rail, without scrolling the page.
  useEffect(() => {
    const rail = railRef.current
    const row = rail?.querySelector<HTMLElement>('[aria-current]')
    if (!rail || !row) return
    const top = row.offsetTop - rail.offsetTop
    if (top < rail.scrollTop) rail.scrollTop = top
    else if (top + row.offsetHeight > rail.scrollTop + rail.clientHeight)
      rail.scrollTop = top + row.offsetHeight - rail.clientHeight
  }, [current])

  if (!headings.length) return null

  const jump = (e: React.MouseEvent, slug: string) => {
    const el = document.getElementById(slug)
    if (!el) return
    e.preventDefault()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    el.scrollIntoView({
      behavior: reduced.matches ? 'auto' : 'smooth',
      block: 'start',
    })
    history.replaceState(null, '', `#${slug}`)
    setCurrent(slug)
    el.tabIndex = -1
    el.focus({ preventScroll: true })
  }

  const list = (nodes: Node[]) => (
    <ol>
      {nodes.map((n) => (
        <li key={n.slug}>
          <a
            href={`#${n.slug}`}
            aria-current={current === n.slug ? 'location' : undefined}
            style={{ '--depth': n.depth } as React.CSSProperties}
            onClick={(e) => jump(e, n.slug)}
          >
            {n.text}
          </a>
          {n.children.length > 0 && list(n.children)}
        </li>
      ))}
    </ol>
  )

  const tree = nest(headings)

  return (
    <nav className="toc" aria-label="Contents" data-toc-exclude>
      <div ref={railRef} className="toc-rail">
        <p className="toc-label">contents</p>
        {list(tree)}
      </div>
      <details className="toc-inline">
        <summary className="toc-label">contents</summary>
        {list(tree)}
      </details>
    </nav>
  )
}
