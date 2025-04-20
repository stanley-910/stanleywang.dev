'use client'
import { TextLoop } from '@/components/ui/text-loop'
import { useEffect, useState } from 'react'

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
        timeZoneName: 'short'
      })}
    </span>
  )
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-zinc-100 px-0 py-4 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <a href="https://github.com/ibelick/nim" target="_blank">
          <TextLoop 
            className="text-xs text-zinc-500" 
            interval={4}
            transition={{ duration: 0.5 }}
          >
            <span>© 2025 Stanley Wang</span>
            <span>finish what you start</span>
          </TextLoop>
        </a>
        <div className="text-xs text-zinc-500">
          <Clock />
        </div>
        {/* <div className="text-xs text-zinc-400">
          <ThemeSwitch />
        </div> */}
      </div>
    </footer>
  )
}
