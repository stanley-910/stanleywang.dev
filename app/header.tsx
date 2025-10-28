'use client'
import { GitHubLogoIcon } from '@radix-ui/react-icons'
import { Menu, X, RssIcon } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'

import { GlitchText } from '@/components/ui/glitch-text'
// import { TextEffect } from '@/components/ui/text-effect'
import { ThemeSwitch } from '@/components/ui/theme-switch'
// import { usePathname } from 'next/navigation'

type NowPlayingData = {
  isPlaying: boolean
  title: string
  artist: string
  album: string
  albumImageUrl: string
  songUrl: string
}

export function Header() {
  const [isVisible, setIsVisible] = useState(true)
  const [isHovered, setIsHovered] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [nowPlaying, setNowPlaying] = useState<NowPlayingData | null>(null)

  useEffect(() => {
    let isMounted = true

    const fetchNowPlaying = async () => {
      try {
        const res = await fetch('/api/spotify/now-playing')
        const data = await res.json()
        if (isMounted) {
          setNowPlaying(data)
        }
      } catch (error) {
        console.error('Error fetching now playing:', error)
      }
    }

    // Initial fetch
    fetchNowPlaying()

    // Set up interval for subsequent fetches
    const interval = setInterval(fetchNowPlaying, 30000)

    // Cleanup function
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  // Debounce scroll handler to reduce number of updates
  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY

    // Only update state if visibility needs to change
    if (currentScrollY < 50 && !isVisible) {
      setIsVisible(true)
    } else if (currentScrollY >= 50 && isVisible) {
      setIsVisible(false)
    }
  }, [isVisible])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Close mobile menu when clicking outside or on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false)
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (isMobileMenuOpen) {
        // Check if click is outside the mobile menu container
        const target = e.target as Element
        if (!target.closest('.mobile-menu-container')) {
          setIsMobileMenuOpen(false)
        }
      }
    }

    if (isMobileMenuOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.addEventListener('click', handleClickOutside)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [isMobileMenuOpen])

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  return (
    <>
      <div
        className="pointer-events-none absolute top-4 left-0 z-20 w-full px-4 before:pointer-events-auto before:absolute before:-top-4 before:left-0 before:h-8 before:w-full before:content-[''] lg:fixed lg:px-12"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex max-w-full flex-row justify-between sm:items-center">
          {/* Left side - always visible */}
          <div className="pointer-events-auto mb-0 flex-shrink-0 transition-opacity duration-200">
            <Link
              href="/"
              className="pointer-events-auto font-serif text-2xl text-black dark:text-white"
              title="cd ~"
            >
              Stanley Wang
            </Link>
            {/* <TextEffect
              as="p"
              preset="fade"
              per="char" */}
            <p className="font-mono leading-tight tracking-tight text-zinc-600 dark:text-zinc-500">
              {nowPlaying?.isPlaying ? (
                <>
                  <span className="text-md font-mono font-bold text-zinc-900 dark:text-zinc-300">
                    ♪{' '}
                  </span>
                  <a
                    href={nowPlaying.songUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
                    title={`${nowPlaying.title} by ${nowPlaying.artist}`}
                  >
                    {nowPlaying.title}
                  </a>
                </>
              ) : (
                <br />
              )}
            </p>
            {/* idea: connect this to actual spotify listening */}
          </div>

          <div className="pointer-events-auto flex h-16 items-center">
            {/* Desktop navigation - hidden on mobile */}
            <nav
              className={`hidden flex-row items-center gap-2 space-x-4 lg:flex lg:gap-0 ${
                !isVisible && !isHovered
                  ? 'pointer-events-none -translate-y-16 opacity-0 transition-all delay-1000 duration-500'
                  : '-translate-y-2 opacity-100 transition-all delay-0 duration-500'
              }`}
            >
              {/* <Link
                href="/about"
                className="text-[1.0em] font-serif italic text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors pointer-events-auto flex items-center"
                title="cd ~/about"
              >
                <span className="hidden lg:inline">about</span>
                <KeyboardMusicIcon className="w-4 h-4 lg:hidden" />
              </Link> */}
              <Link
                href="/writing"
                className="pointer-events-auto flex items-center font-serif text-[1.0em] text-zinc-600 italic transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
                title="cd ~/writing"
              >
                <span className="lg:inline">writing</span>
              </Link>
              {/*<span className="pointer-events-none translate-y-[0.95px] text-xs text-zinc-600 dark:text-zinc-400">
                ▧
              </span>*/}
              <Link
                href="/projects"
                className="pointer-events-auto flex items-center font-serif text-[1.0em] text-zinc-600 italic transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
                title="cd ~/projects"
              >
                <span className="lg:inline">projects</span>
              </Link>
              {/*<span className="pointer-events-none translate-y-[0.3px] text-xs text-zinc-600 dark:text-zinc-400">
                ∷
              </span>*/}
              <Link
                href="/experience"
                className="pointer-events-auto flex items-center font-serif text-[1.0em] text-zinc-600 italic transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
                title="cd ~/experience"
              >
                <span className="lg:inline">experience</span>
              </Link>
              {/*<span className="pointer-events-none translate-y-[0.3px] text-sm text-zinc-600 dark:text-zinc-400">
                ····
              </span>*/}
              <a
                href="https://sh.stanleywang.dev/"
                className="pointer-events-auto flex translate-y-[1px] items-center font-mono text-[0.85em] text-zinc-600 transition-colors dark:text-zinc-400"
                title="source ~/.sshrc"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="lg:inline">
                  <GlitchText text="/bin/sh" />
                </span>
              </a>
              {/*<span className="pointer-events-none translate-y-[0.95px] text-xs text-zinc-600 dark:text-zinc-400">
                ▣
              </span>*/}
              <Link
                href="/api/feed"
                className="pointer-events-auto flex items-center font-serif text-[1.0em] text-zinc-600 italic transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
                title="RSS Feed"
              >
                <RssIcon className="h-4 w-4" />
              </Link>
              <a
                href="https://github.com/stanley-910"
                className="pointer-events-auto flex items-center font-serif text-[1.0em] text-zinc-600 italic transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
                title="View on GitHub"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GitHubLogoIcon className="h-4 w-4" />
              </a>
              <ThemeSwitch className="pointer-events-auto translate-x-[2px] translate-y-[2px]" />
            </nav>

            {/* Mobile hamburger menu button - visible only on mobile */}
            <div className="mobile-menu-container relative lg:hidden">
              <button
                onClick={toggleMobileMenu}
                className="flex cursor-pointer items-center justify-center p-2 text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
                title="Menu"
                aria-label="Toggle mobile menu"
              >
                {isMobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>

              {/* Mobile menu dropdown - anchored to hamburger button */}
              <div
                className={`absolute top-full right-0 mt-1 w-32 rounded-lg border border-zinc-200/80 bg-white/90 px-4 py-4 shadow-lg transition-all duration-300 ease-out dark:border-zinc-800/80 dark:bg-zinc-900/90 ${
                  isMobileMenuOpen
                    ? 'translate-x-0 opacity-100'
                    : 'pointer-events-none translate-x-4 opacity-0'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <nav className="flex flex-col space-y-3">
                  {/* Main navigation items */}
                  <Link
                    href="/writing"
                    className="text-md flex items-center justify-end font-serif text-zinc-600 italic transition-all duration-300 hover:-translate-x-1 hover:text-black dark:text-zinc-400 dark:hover:text-white"
                    title="cd ~/writing"
                    onClick={closeMobileMenu}
                  >
                    <span>writing</span>
                    {/*<BookOpenIcon className="h-4 w-4" />*/}
                  </Link>

                  <Link
                    href="/projects"
                    className="text-md flex items-center justify-end font-serif text-zinc-600 italic transition-all duration-300 hover:-translate-x-1 hover:text-black dark:text-zinc-400 dark:hover:text-white"
                    title="cd ~/projects"
                    onClick={closeMobileMenu}
                  >
                    <span>projects</span>
                    {/*<ClapperboardIcon className="h-4 w-4" />*/}
                  </Link>

                  <Link
                    href="/experience"
                    className="text-md flex items-center justify-end font-serif text-zinc-600 italic transition-all duration-300 hover:-translate-x-1 hover:text-black dark:text-zinc-400 dark:hover:text-white"
                    title="cd ~/experience"
                    onClick={closeMobileMenu}
                  >
                    <span>experience</span>
                    {/*<BriefcaseIcon className="h-4 w-4" />*/}
                  </Link>
                  <a
                    href="https://sh.stanleywang.dev/"
                    className="pointer-events-auto flex translate-y-[1px] items-center justify-end font-mono text-[0.85em] text-zinc-600 transition-all duration-300 hover:-translate-x-1 dark:text-zinc-400"
                    title="source ~/.sshrc"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="lg:inline">
                      <GlitchText text="/bin/sh" />
                    </span>
                  </a>
                  {/* Bottom row with icons only */}
                  <div className="flex items-center justify-center border-t border-zinc-200/50 pt-2 dark:border-zinc-700/50">
                    <div className="flex items-center space-x-3">
                      {/*<a
                        href="https://sh.stanleywang.dev/"
                        className="flex items-center text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
                        title="source ~/.sshrc"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={closeMobileMenu}
                      >
                        <Terminal className="h-4 w-4" />
                      </a>*/}

                      <Link
                        href="/api/feed"
                        className="flex items-center text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
                        title="RSS Feed"
                        onClick={closeMobileMenu}
                      >
                        <RssIcon className="h-4 w-4" />
                      </Link>

                      <a
                        href="https://github.com/stanley-910"
                        className="flex items-center text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
                        title="View on GitHub"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={closeMobileMenu}
                      >
                        <GitHubLogoIcon className="h-4 w-4" />
                      </a>
                      <ThemeSwitch className="pointer-events-auto translate-x-[2px] translate-y-[2px]" />
                    </div>
                  </div>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
