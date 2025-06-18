'use client'
import { GitHubLogoIcon } from '@radix-ui/react-icons'
import { Terminal, ClapperboardIcon } from 'lucide-react'
// import { ApertureIcon } from 'lucide-react'
import { BookOpenIcon } from 'lucide-react'
// import { KeyboardMusicIcon } from 'lucide-react'
import { RssIcon } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'

import { GlitchText } from '@/components/ui/glitch-text'
import { TextEffect } from '@/components/ui/text-effect'
import { ThemeSwitch } from '@/components/ui/theme-switch'
// import { usePathname } from 'next/navigation'

export function Header() {
  const [isVisible, setIsVisible] = useState(true)
  const [isHovered, setIsHovered] = useState(false)

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

  return (
    <div
      className="absolute top-4 left-0 z-20 w-full px-4 before:absolute before:-top-4 before:left-0 before:h-8 before:w-full before:content-[''] lg:fixed lg:px-12"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex max-w-full flex-row justify-between sm:items-center">
        {/* Left side - always visible */}
        <div className="mb-0 flex-shrink-0 transition-opacity duration-200">
          <Link
            href="/"
            className="pointer-events-auto font-serif text-2xl text-black dark:text-white"
            title="cd ~"
          >
            Stanley Wang
          </Link>
          <TextEffect
            as="p"
            preset="fade"
            per="char"
            className="font-mono text-sm tracking-tighter text-zinc-600 dark:text-zinc-500"
            delay={0.5}
          >
            Montréal, QC
          </TextEffect>
          {/* idea: connect this to actual spotify listening */}
        </div>

        <div className="flex h-16 items-center">
          {/* Right side nav - hides on scroll, reveals on hover */}
          <nav
            className={`flex flex-row items-center gap-2 space-x-4 transition-all duration-300 lg:gap-0 ${
              !isVisible && !isHovered
                ? '-translate-y-16 opacity-0'
                : '-translate-y-2 opacity-100'
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
              <span className="hidden lg:inline">writing</span>
              <BookOpenIcon className="h-4 w-4 lg:hidden" />
            </Link>
            <span className="hidden translate-y-[0.95px] text-xs text-zinc-600 lg:inline dark:text-zinc-400">
              ▧
            </span>
            <Link
              href="/projects"
              className="pointer-events-auto flex items-center font-serif text-[1.0em] text-zinc-600 italic transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
              title="cd ~/projects"
            >
              <span className="hidden lg:inline">projects</span>
              <ClapperboardIcon className="h-4 w-4 lg:hidden" />
            </Link>
            <span className="hidden translate-y-[0.3px] text-xs text-zinc-600 lg:inline dark:text-zinc-400">
              ∷
            </span>
            <Link
              href="https://sh.stanleywang.dev/"
              className="pointer-events-auto flex translate-y-[1px] items-center font-mono text-[0.85em] text-zinc-600 transition-colors dark:text-zinc-400"
              title="source ~/.sshrc"
            >
              <span className="hidden lg:inline">
                <GlitchText text="/bin/sh" />
              </span>
              <Terminal className="h-4 w-4 transition-colors hover:text-black lg:hidden dark:hover:text-white" />
            </Link>
            <span className="hidden translate-y-[0.95px] text-xs text-zinc-600 lg:inline dark:text-zinc-400">
              ▣
            </span>
            <Link
              href="/api/feed"
              className="pointer-events-auto flex hidden items-center font-serif text-[1.0em] text-zinc-600 italic transition-colors hover:text-black lg:block dark:text-zinc-400 dark:hover:text-white"
              title="RSS Feed"
            >
              <RssIcon className="h-4 w-4" />
            </Link>
            <Link
              href="https://github.com/stanley-utf8"
              className="pointer-events-auto flex items-center font-serif text-[1.0em] text-zinc-600 italic transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
              title="cd ~/projects"
            >
              {/* <span className="hidden lg:inline">projects</span> */}
              <GitHubLogoIcon className="h-4 w-4" />
            </Link>
            <ThemeSwitch className="pointer-events-auto translate-y-[1px]" />
          </nav>
        </div>
      </div>
    </div>
  )
}
