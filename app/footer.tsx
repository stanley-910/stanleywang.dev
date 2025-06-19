'use client'
import { useEffect, useState } from 'react'

import { TextLoop } from '@/components/ui/text-loop'

function Clock() {
  const [time, setTime] = useState(new Date())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Only render the clock on the client side
  if (!mounted) {
    return <span>Loading...</span>
  }

  return (
    <span>
      {time.toLocaleString('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true,
        timeZoneName: 'short',
      })}
    </span>
  )
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-zinc-300 px-0 py-4 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <TextLoop
          className="text-xs text-zinc-500"
          interval={10}
          transition={{ duration: 0.5 }}
        >
          <a
            href="https://github.com/stanley-910/stanleywang.dev"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>© 2025 Stanley Wang</span>
          </a>
          <a
            href="https://www.youtube.com/watch?v=RDp61U9zTj0"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>darlin, don&apos;t you give up on a monday</span>
          </a>
        </TextLoop>
        <div className="text-xs text-zinc-500">
          <Clock />
        </div>
      </div>
    </footer>
  )
}
