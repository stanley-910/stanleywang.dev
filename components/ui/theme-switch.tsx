'use client'
import { MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

import {
  nextSwitch,
  OVERRIDE_KEY,
  setChrome,
  themeAt,
  type PageTheme,
} from '@/lib/circadian'

// The theme follows the hour; a click picks the other one until the hour's
// next switch (lib/circadian.ts). An open tab follows the switch when it
// comes.
export function ThemeSwitch({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  useEffect(() => {
    setMounted(true)
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      const now = new Date()
      timer = setTimeout(
        () => {
          localStorage.removeItem(OVERRIDE_KEY)
          setTheme(themeAt(new Date()))
          schedule()
        },
        nextSwitch(now).getTime() - now.getTime() + 1000,
      )
    }
    schedule()
    return () => clearTimeout(timer)
  }, [setTheme])

  useEffect(() => {
    if (resolvedTheme === 'light' || resolvedTheme === 'dark')
      setChrome(resolvedTheme)
  }, [resolvedTheme])

  const pick = (theme: PageTheme) => {
    const now = new Date()
    if (theme === themeAt(now)) localStorage.removeItem(OVERRIDE_KEY)
    else
      localStorage.setItem(
        OVERRIDE_KEY,
        JSON.stringify({ theme, until: nextSwitch(now).getTime() }),
      )
    setTheme(theme)
  }

  if (!mounted) {
    return <span className={`inline-block h-4 w-4 ${className ?? ''}`} />
  }

  return (
    <button
      className={`inline-flex h-4 w-4 cursor-pointer items-center justify-center text-[color:var(--ink-muted)] transition-colors duration-100 hover:text-[color:var(--ink)] ${className ?? ''}`}
      type="button"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      title={isDark ? 'Night' : 'Day'}
      onClick={() => pick(isDark ? 'light' : 'dark')}
    >
      {isDark ? (
        <MoonIcon className="h-4 w-4" strokeWidth={1.5} />
      ) : (
        <SunIcon className="h-4 w-4" strokeWidth={1.5} />
      )}
    </button>
  )
}
