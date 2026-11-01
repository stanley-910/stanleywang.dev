'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { NavDrop } from '@/components/ui/nav-drop'
import { SiteIndex } from '@/components/ui/site-index'
import { ThemeSwitch } from '@/components/ui/theme-switch'
import { DIRECTORIES } from '@/lib/directories'
import { useUiHidden } from '@/lib/hide-ui'

// The top bar: one row of lowercase mono words on the page colour, the
// current page in `ink`, the rest muted, and the site menu in the corner
// (design/circadian-meadow/components/SiteHeader). With a mouse, projects,
// writing and photos each drop down what's in them (NavDrop). On a phone the
// words fold into the site index's glyph (SiteIndex).
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
        <ul className="site-words">
          {NAV.map(({ href, label }) =>
            DIRECTORIES[href] ? (
              <NavDrop
                key={href}
                href={href}
                label={label}
                entries={DIRECTORIES[href]}
                pathname={pathname}
                current={isCurrent(pathname, href)}
                hidden={hidden}
              />
            ) : (
              <li key={href}>
                <Link
                  href={href}
                  data-avoid="light"
                  aria-current={isCurrent(pathname, href) ? 'page' : undefined}
                >
                  {label}
                </Link>
              </li>
            ),
          )}
        </ul>
        <SiteIndex pathname={pathname} hidden={hidden} />
      </nav>
      <ThemeSwitch />
    </header>
  )
}
