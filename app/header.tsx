'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { ThemeSwitch } from '@/components/ui/theme-switch'
import { useUiHidden } from '@/lib/hide-ui'

// The top bar: one row of lowercase mono words on the page colour, the
// current page in `ink`, the rest muted, and the site menu in the corner
// (design/circadian-meadow/components/SiteHeader).
const NAV = [
  { href: '/', label: 'meadow' },
  { href: '/projects', label: 'projects' },
  { href: '/photos', label: 'photos' },
  { href: '/writing', label: 'writing' },
  { href: '/music', label: 'music' },
]

function isCurrent(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

export function Header() {
  const pathname = usePathname() ?? '/'
  const hidden = useUiHidden()

  return (
    <header className="site-header">
      {/* A halo round each word (garden.css) and a light fade behind it (garden/mount.ts), not
          the bio's: a full box over the row cut a dark rectangle out of the eclipse's glow. */}
      <nav aria-label="Site" inert={hidden}>
        <ul>
          {NAV.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                data-avoid="light"
                aria-current={isCurrent(pathname, href) ? 'page' : undefined}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <ThemeSwitch />
    </header>
  )
}
