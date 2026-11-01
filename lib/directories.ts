import { BLOG_POSTS, EXPERIENCE_POSTS, PROJECTS } from '@/app/data'
import { PHOTOS } from '@/app/photos/photos'

import type { IndexEntry } from '@/components/ui/index-row'

// What's in each of the top bar's sections, for its dropdowns on a desktop
// (design/circadian-meadow/components/SiteHeader, "Dropdowns"). Text only:
// no photo is loaded for it.

/**
 * Every project, in the page's order, with its kind. One you can try on the
 * site (Mini Compiler's walkthrough) opens there; the rest, their place on
 * the projects page.
 */
const projects: IndexEntry[] = PROJECTS.map((p) => ({
  href: p.snippet?.href ?? `/projects#${p.slug}`,
  label: p.name,
  meta: p.category?.toLowerCase(),
}))

const AGO = new Intl.RelativeTimeFormat('en', { numeric: 'always' })

/** How long ago a `YYYY-MM-DD` day was: "3 weeks ago", "8 months ago". */
function ago(date: string, now = new Date()) {
  const [y, m, d] = date.split('-').map(Number)
  const then = new Date(y, m - 1, d)
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000)
  if (days < 1) return 'today'
  if (days < 7) return AGO.format(-days, 'day')
  if (days < 30) return AGO.format(-Math.floor(days / 7), 'week')
  const months =
    (now.getFullYear() - y) * 12 +
    now.getMonth() -
    (m - 1) -
    (now.getDate() < d ? 1 : 0)
  if (months < 12) return AGO.format(-Math.max(months, 1), 'month')
  return AGO.format(-Math.floor(months / 12), 'year')
}

/** Every post, newest first, with how long ago it was. The poem isn't listed. */
const writing: IndexEntry[] = [...BLOG_POSTS, ...EXPERIENCE_POSTS]
  .sort((a, b) => b.date.localeCompare(a.date))
  .map((p) => ({ href: p.link, label: p.title, meta: ago(p.date) }))

/**
 * The photos by place, in the wall's order: each place's year, and how many
 * there are when more than one. They all open the wall, which has no place
 * of its own for each.
 */
function places(): IndexEntry[] {
  const byPlace = new Map<string, { n: number; years: Set<string> }>()
  for (const p of PHOTOS) {
    const place = p.location ?? 'elsewhere'
    const entry = byPlace.get(place) ?? { n: 0, years: new Set<string>() }
    entry.n++
    if (p.date) entry.years.add(p.date.slice(0, 4))
    byPlace.set(place, entry)
  }
  return [...byPlace].map(([place, { n, years }]) => {
    const when = [...years].sort().join('–')
    return {
      href: '/photos',
      label: place,
      meta: [n > 1 ? `${n} photos` : '', when].filter(Boolean).join(' · '),
    }
  })
}

export const DIRECTORIES: Record<string, IndexEntry[]> = {
  '/projects': projects,
  '/writing': writing,
  '/photos': places(),
}
