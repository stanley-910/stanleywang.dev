'use client'
import { useEffect, useState, useCallback } from 'react'
import { ChevronsUp, ChevronsDown } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false)
  const [isVisibleBottom, setIsVisibleBottom] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isHoveredBottom, setIsHoveredBottom] = useState(false)
  const [lastKeyTime, setLastKeyTime] = useState(0)
  const [lastKey, setLastKey] = useState('')

  // Handle scroll event
  useEffect(() => {
    const onScroll = () => setIsVisible(window.scrollY > 300)
    window.addEventListener('scroll', onScroll)
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // bottom
  useEffect(() => {
    const onScrollBottom = () => {
      const maxScroll = 
        document.documentElement.scrollHeight 
        - document.documentElement.clientHeight
      setIsVisibleBottom(maxScroll - window.scrollY > 300)
    }
    window.addEventListener('scroll', onScrollBottom)
    onScrollBottom()
    return () => window.removeEventListener('scroll', onScrollBottom)
  }, [])

  const scrollToTop = useCallback(() => {
    if (window.location.hash) {
      window.history.pushState({}, '', window.location.pathname)
    }
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }, [])

  const scrollToBottom = useCallback(() => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth'
    })
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      const currentTime = Date.now()

      // Handle Ctrl+D (half page down) and Ctrl+U (half page up)
      if (e.ctrlKey) {
        if (e.key === 'd') {
          e.preventDefault() // Prevent browser's default behavior
          const scrollAmount = Math.floor(window.innerHeight * 0.8) // Increased to 80% of viewport
          window.scrollBy({
            top: scrollAmount,
            behavior: 'smooth'

          })
          return
        }
        if (e.key === 'u') {
          e.preventDefault() // Prevent browser's default behavior
          const scrollAmount = Math.floor(window.innerHeight * 0.8) // Increased to 80% of viewport
          window.scrollBy({
            top: -scrollAmount,
            behavior: 'smooth'
          })
          return
        }
      }

      // Handle Shift+G for bottom
      if (e.key === 'G' && e.shiftKey) {
        scrollToBottom()
        return
      }

      // Handle 'gg' for top
      if (e.key === 'g') {
        if (lastKey === 'g' && currentTime - lastKeyTime < 500) {
          // Second 'g' pressed within 500ms
          scrollToTop()
          setLastKey('')
          setLastKeyTime(0)
        } else {
          // First 'g' pressed
          setLastKey('g')
          setLastKeyTime(currentTime)
        }
      } else {
        // Reset if any other key is pressed
        setLastKey('')
        setLastKeyTime(0)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [lastKey, lastKeyTime, scrollToTop, scrollToBottom])

  return (
    <div className="flex flex-col gap-2">
    <button
      onClick={scrollToTop}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        fixed right-3 bottom-14 w-10 h-10 rounded-full
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
            key="up"
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
    <button
      onClick={scrollToBottom}
      onMouseEnter={() => setIsHoveredBottom(true)}
      onMouseLeave={() => setIsHoveredBottom(false)}
      className={`
        fixed right-3 bottom-3 w-10 h-10 rounded-full
        transition-all duration-300 z-50 print:hidden
        flex items-center justify-center
        ${isVisibleBottom ? 'opacity-30 hover:opacity-100' : 'opacity-0 pointer-events-none'}
      `}
    >
      <AnimatePresence mode="wait">
        {isHoveredBottom ? (
          <motion.span
            key="G"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="font-mono text-zinc-500 dark:text-zinc-400 -translate-y-[2px]"
          >
            G
          </motion.span>
        ) : (
          <motion.span
            key="down"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronsDown className="h-5 w-5 " />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
    </div>

  )
} 