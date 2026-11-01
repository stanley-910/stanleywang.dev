import { BLOG_POSTS, EXPERIENCE_POSTS, PROJECTS } from '@/app/data'
import { PHOTOS } from '@/app/photos/photos'

import type { IndexEntry } from '@/components/ui/index-row'

// What's in each of the top bar's sections, for its dropdowns on a desktop
// (design/circadian-meadow/components/SiteHeader, "Dropdowns"). Text only:
// no photo is loaded for it.

/** Every project, in the page's order, with its kind. */
const projects: IndexEntry[] = PROJECTS.map((p) => ({
  href: `/projects#${p.slug}`,
  label: p.name,
  meta: p.category?.toLowerCase(),
}))

/** Every post, newest first, with its year and month. The poem isn't listed. */
const writing: IndexEntry[] = [...BLOG_POSTS, ...EXPERIENCE_POSTS]
  .sort((a, b) => b.date.localeCompare(a.date))
  .map((p) => ({ href: p.link, label: p.title, meta: p.date.slice(0, 7) }))

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
