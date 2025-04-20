'use client'
import Link from 'next/link'
import { TextEffect } from '@/components/ui/text-effect'
import { ThemeSwitch } from '@/components/ui/theme-switch'
import { useEffect, useState, useCallback } from 'react'

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
        className="fixed left-0 top-0 z-10 h-16 w-full pointer-events-none" 
        onMouseEnter={() => setIsVisible(true)}
      />
      {/* Theme Switch for large screens - Fixed in top right */}
      <div className="lg:mr-4 fixed top-4 right-4 z-30 pointer-events-auto hidden lg:block">
        <ThemeSwitch />
      </div>
      {/* Header container - only interactive elements should capture pointer events */}
      <div 
        className={`lg:fixed sm:absolute  left-0 top-4 z-20 transition-opacity duration-200 pointer-events-none w-full px-4 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex flex-col sm:flex-row lg:flex-col sm:items-center lg:items-start sm:justify-between max-w-full
        ">
          <div className="lg:ml-4 mb-6 sm:mb-0 lg:mb-6">
            <Link href="/" className="font-serif text-2xl text-black dark:text-white pointer-events-auto" title="@stanley-wang.dev">
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
          
          <nav className="flex flex-row lg:flex-col items-center lg:items-start lg:ml-6 space-y-0 lg:space-y-2 space-x-6 lg:space-x-0">
            <Link 
              href="/posts" 
              className="text-[1.1em] font-serif italic text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors pointer-events-auto"
            >
              Writing
            </Link>
            <Link 
              href="/projects" 
              className="text-[1.1em] font-serif italic text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors pointer-events-auto"
            >
              Projects
            </Link>
            <Link 
              href="/about" 
              className="text-[1.1em] font-serif italic text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors pointer-events-auto"
            >
              About
            </Link>
            <Link 
              // href="/about" 
              href="https://stanleywang.dev"
              className="text-[1em] font-mono text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors pointer-events-auto"
            >
              run x86
            </Link>
            {/* Theme Switch for small/medium screens - In navigation */}
            <div className="pointer-events-auto lg:hidden">
              <ThemeSwitch />
            </div>
          </nav>
        </div>
      </div>
    </>
  )
}
