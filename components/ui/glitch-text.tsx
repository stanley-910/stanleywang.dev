'use client'

import { useState, useEffect } from 'react'

const GLITCH_CHARS = '!<>-_\\/[]{}—=+*^?#________'

interface GlitchTextProps {
  text: string
  className?: string
  variant?: 'default' | 'blue'
}

export function GlitchText({ text, className = '', variant = 'default' }: GlitchTextProps) {
  const [displayText, setDisplayText] = useState(text)
  const [isHovering, setIsHovering] = useState(false)

  useEffect(() => {
    let glitchInterval: NodeJS.Timeout
    let restoreInterval: NodeJS.Timeout

    if (isHovering) {
      // Glitch effect while hovering
      glitchInterval = setInterval(() => {
        setDisplayText(
          [...text].map(() => 
            GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
          ).join('')
        )
      }, 50)
    } else if (displayText !== text) {
      // Restore text gradually when not hovering
      let currentIdx = 0
      restoreInterval = setInterval(() => {
        if (currentIdx >= text.length) {
          clearInterval(restoreInterval)
          return
        }
        setDisplayText(prevText => 
          text.slice(0, currentIdx + 1) +
          [...text.slice(currentIdx + 1)]
            .map(() => GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)])
            .join('')
        )
        currentIdx++
      }, 50)
    }

    return () => {
      clearInterval(glitchInterval)
      clearInterval(restoreInterval)
    }
  }, [isHovering, text])

  return (
    <span
      className={`cursor-pointer crt-text crt-text-effect ${variant === 'blue' ? 'crt-text-blue' : ''} ${className}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {displayText}
    </span>
  )
} 