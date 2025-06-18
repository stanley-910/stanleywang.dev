'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export function ProgressBar() {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const pathname = usePathname()

  useEffect(() => {
    // Reset and show progress bar on route change
    setProgress(0)
    setVisible(true)

    // Simulate progress
    const timer = setTimeout(() => {
      setProgress(70) // Jump to 70% quickly
    }, 50)

    // Complete the progress
    const completeTimer = setTimeout(() => {
      setProgress(100)
      // Hide the bar after completion
      setTimeout(() => setVisible(false), 200)
    }, 200)

    return () => {
      clearTimeout(timer)
      clearTimeout(completeTimer)
    }
  }, [pathname]) // Reset on route change

  if (!visible) return null

  return (
    <div
      className="pointer-events-none fixed top-0 left-0 z-[1031] w-full"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
    >
      <div
        className="h-0.5 bg-zinc-600 opacity-75 transition-all duration-200 ease-out dark:bg-zinc-400"
        style={{
          width: `${progress}%`,
          transition: 'width 200ms ease-out',
        }}
      />
    </div>
  )
}
