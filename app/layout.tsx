// Font styles
import '@fontsource/dm-mono'
import './styles/fonts.css'
import './styles/prose.css'
import './styles/toc.css'
import './styles/globals.css'
import { Analytics } from '@vercel/analytics/react'
import { ThemeProvider } from 'next-themes'

import { BackgroundArt } from '@/components/art/BackgroundArt'
import { ScrollToTop } from '@/components/ScrollToTop'
import { ProgressBar } from '@/components/ui/progress-bar'

import { Footer } from './footer'
import { Header } from './header'

import type { Metadata, Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#09090b' }, // Dark mode - zinc-950
    { media: '(prefers-color-scheme: light)', color: '#fafafa' }, // Light mode - zinc-50
  ],
}

export const metadata: Metadata = {
  title: 'stanleywang.dev',
  description: 'By Stanley Wang',
  icons: {
    icon: '/favicon.ico',
  },
  alternates: {
    types: {
      'application/rss+xml': 'https://stanleywang.dev/api/feed',
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white antialiased dark:bg-zinc-950">
        <ProgressBar />
        <ThemeProvider
          enableSystem={true}
          attribute="class"
          storageKey="theme"
          defaultTheme="system"
        >
          <div className="flex min-h-screen w-full flex-col">
            <div className="relative mx-auto flex w-full max-w-[45ch] flex-1 flex-col px-4 pt-20 sm:max-w-[65ch]">
              <BackgroundArt type="random" />
              <Header />
              <main className="flex-1">
                {children}
                <Analytics />
              </main>
              <Footer />
              <ScrollToTop />
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
