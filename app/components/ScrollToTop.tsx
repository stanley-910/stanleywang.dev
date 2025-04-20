'use client'
import { useEffect, useState } from 'react'

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false)

  // Handle scroll event
  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    // Add scroll event listener
    window.addEventListener('scroll', toggleVisibility)

    // Clean up
    return () => {
      window.removeEventListener('scroll', toggleVisibility)
    }
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  return (
    <button
      onClick={scrollToTop}
      title="Scroll to top"
      className={`
        fixed right-3 bottom-3 w-10 h-10 rounded-full
        
        hover:bg-zinc-200 dark:hover:bg-zinc-700
        transition-all duration-300 z-50 print:hidden
        flex items-center justify-center
        ${isVisible ? 'opacity-30 hover:opacity-100' : 'opacity-0 pointer-events-none'}
      `}
      aria-label="Scroll to top"
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-5 w-5"
        viewBox="0 0 24 24"
      >
        <path 
          fill="none" 
          stroke="currentColor" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth="2" 
          d="M12 19V5m-7 7l7-7l7 7"
        />
      </svg>
    </button>
  )
} 