'use client'
import Link from 'next/link'
import { TextEffect } from '@/components/ui/text-effect'
import { ThemeSwitch } from '@/components/ui/theme-switch'
import { Terminal } from 'lucide-react'
import { ApertureIcon } from 'lucide-react'
import { NotepadTextIcon } from 'lucide-react'
import { KeyboardMusicIcon } from 'lucide-react'
import { GitHubLogoIcon } from '@radix-ui/react-icons'
import { useEffect, useState, useCallback } from 'react'
import { GlitchText } from '@/components/ui/glitch-text'
import { usePathname } from 'next/navigation'

export function Header() {
  const [isVisible, setIsVisible] = useState(true)


  // Debounce scroll handler to reduce number of updates
  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY
    
    // Only update state if visibility needs to change
    if (currentScrollY < 50 && !isVisible) {
      setIsVisible(true)
    } else if (currentScrollY >= 50 && isVisible) {
      // setIsVisible(false)
    }
  }, [isVisible])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  return (
    <>
      {/* Mouse detection area - make it pointer-events-none */}
      <div 
        className="fixed left-0 top-0 z-10 h-16 w-full" 
      />
      <div 
        className={`lg:fixed absolute left-0 top-4 z-20 transition-opacity duration-200 pointer-events-none w-full  lg:px-12 px-4 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex flex-row  sm:items-center justify-between max-w-full">
          <div className=" mb-0  flex-shrink-0">
            <Link href="/" className="font-serif text-2xl text-black dark:text-white pointer-events-auto" title="cd ~">
              Stanley Wang
            </Link>
            <TextEffect
              as="p"
              preset="fade"
              per="char"
              className="text-sm text-zinc-600 dark:text-zinc-500"
              delay={0.5}
            >
              What's an LLM?
            </TextEffect>
          </div>
          
          <nav className="flex flex-row items-center  space-x-6  -translate-y-2">
            <Link 
              href="/about" 
              className="text-[1.0em] font-serif italic text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors pointer-events-auto flex items-center"
              title="cd ~/about"
            >
              <span className="hidden lg:inline">about</span>
              <KeyboardMusicIcon className="w-4 h-4 lg:hidden" />
            </Link>
            <Link 
              href="/writing" 
              className="text-[1.0em] font-serif italic text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors pointer-events-auto flex items-center"
              title="cd ~/writing"
            >
              <span className="hidden lg:inline">writing</span>
              <NotepadTextIcon className="w-4 h-4 lg:hidden" />
            </Link>
            <Link 
              href="/projects" 
              className="text-[1.0em] font-serif italic text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors pointer-events-auto flex items-center"
              title="cd ~/projects"
            >
              <span className="hidden lg:inline">projects</span>
              <ApertureIcon className="w-4 h-4 lg:hidden" />
            </Link>
            <Link 
              href="https://sh.stanleywang.dev/"
              className="leading-6 text-[0.9em] font-mono text-zinc-600 dark:text-zinc-400 pointer-events-auto flex items-center  transition-colors"
              title="source ~/.sshrc"
            >
              <span className="hidden lg:inline">
                <GlitchText text="/bin/sh" />
              </span>
              <Terminal className=" w-4 h-4 lg:hidden dark:hover:text-white hover:text-black  transition-colors" />
            </Link>
            <Link 
              href="https://github.com/stanley-utf8" 
              className="text-[1.0em] font-serif italic text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors pointer-events-auto flex items-center"
              title="cd ~/projects"
            >
              {/* <span className="hidden lg:inline">projects</span> */}
              <GitHubLogoIcon className="w-4 h-4 " />
            </Link>
            <div className="pointer-events-auto ">
              <ThemeSwitch />
            </div>

          </nav>
        </div>
      </div>
    </>
  )
}
