'use client'
import { MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeSwitch({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false)
  // resolvedTheme is what's showing; theme can be 'system', which would
  // make the first click set the theme the page already has.
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="h-4 w-4"></div>
  }

  return (
    <div className={` ${className}`}>
      <button
        className="inline-flex h-4 w-4 cursor-pointer items-center justify-center text-zinc-500 transition-colors duration-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        type="button"
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
      >
        {isDark ? (
          <MoonIcon className="h-4 w-4" />
        ) : (
          <SunIcon className="h-4 w-4" />
        )}
      </button>
    </div>
  )
}
