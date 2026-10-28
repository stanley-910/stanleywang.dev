import './styles/tokens.css'
import './styles/fonts.css'
import './styles/prose.css'
import './styles/toc.css'
import './styles/globals.css'
import { Analytics } from '@vercel/analytics/react'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'

import { ScrollToTop } from '@/components/ScrollToTop'
import { ProgressBar } from '@/components/ui/progress-bar'
import { THEME_SCRIPT } from '@/lib/circadian'

import { Footer } from './footer'
import { Header } from './header'

import type { Metadata, Viewport } from 'next'

// tokens.css names these --font-sans and --font-mono.
const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#1b1b19' }, // page-dark
    { media: '(prefers-color-scheme: light)', color: '#ebeae6' }, // page-light
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
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Picks the hour's theme before next-themes applies it. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="antialiased">
        <ProgressBar />
        <ThemeProvider
          enableSystem={false}
          attribute={['class', 'data-theme']}
          storageKey="theme"
          defaultTheme="light"
        >
          <div className="flex min-h-screen w-full flex-col">
            <div className="relative mx-auto flex w-full max-w-[45ch] flex-1 flex-col px-4 pt-20 sm:max-w-[65ch]">
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
