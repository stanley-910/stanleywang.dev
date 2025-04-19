'use client'
import Link from 'next/link'
import { TextEffect } from '@/components/ui/text-effect'
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
      {/* Invisible div that detects mouse hover near top */}
      <div 
        className="fixed left-0 top-0 z-10 h-16 w-full" 
        onMouseEnter={() => setIsVisible(true)}
      />
      {/* Left part of the header - absolute on mobile, fixed on desktop */}
      <div 
        className={`absolute md:fixed left-4 top-4 z-20 transition-opacity duration-200 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center justify-between w-[calc(100vw-2rem)]">
          <div className="pl-4">
            <Link href="/" className="font-serif text-2xl text-black dark:text-white">
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
          
          <nav className="hidden md:flex items-center">
            <Link 
              href="/posts" 
              className="text-sm text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors"
            >
              Posts
            </Link>
          </nav>
        </div>
      </div>
    </>
  )
}
