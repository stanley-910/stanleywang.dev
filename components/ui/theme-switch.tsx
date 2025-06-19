'use client'
import { MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeSwitch({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="h-4 w-4"></div>
  }

  return (
    <div className={` ${className}`}>
      <button
        className="inline-flex h-4 w-4 items-center justify-center text-zinc-500 dark:text-zinc-400"
        type="button"
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      >
        {theme === 'dark' ? (
          <MoonIcon
            className="h-4 w-4 cursor-pointer transition-colors duration-100 hover:text-zinc-950 dark:hover:text-zinc-50"
            onClick={() => setTheme('light')}
          />
        ) : (
          <SunIcon
            className="h-4 w-4 cursor-pointer transition-colors duration-100 hover:text-zinc-950 dark:hover:text-zinc-50"
            onClick={() => setTheme('dark')}
          />
        )}
      </button>
    </div>
  )
}
