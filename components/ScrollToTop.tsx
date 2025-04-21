'use client'
import { useEffect, useState } from 'react'
import { ChevronsUp } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        fixed right-3 bottom-3 w-10 h-10 rounded-full
        transition-all duration-300 z-50 print:hidden
        flex items-center justify-center
        ${isVisible ? 'opacity-30 hover:opacity-100' : 'opacity-0 pointer-events-none'}
      `}
    >
      <AnimatePresence mode="wait">
        {isHovered ? (
          <motion.span
            key="gg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="font-mono text-zinc-500 dark:text-zinc-400 -translate-y-[2px]"
          >
            gg
          </motion.span>
        ) : (
          <motion.span
            key="chevrons"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronsUp className="h-5 w-5 " />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
} 