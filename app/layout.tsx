import type { Metadata, Viewport } from 'next'
import { Analytics } from "@vercel/analytics/react"
// import { Geist, Geist_Mono } from 'next/font/google'
// Font styles
import '@fontsource/dm-mono'
import './styles/fonts.css'
import './styles/prose.css'
import './styles/toc.css'
import './styles/globals.css'
import { Header } from './header'
import { Footer } from './footer'
import { ThemeProvider } from 'next-themes'
import { BackgroundArt } from '@/components/art/BackgroundArt'
import { ScrollToTop } from '@/components/ScrollToTop'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: 'rgb(9 9 11)' }
  ],
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Stanley Wang',
  description: 'Stanley Wang - Site',
  icons: {
    icon: '/favicon.ico',
  },
}

// const geist = Geist({
//   variable: '--font-geist',
//   subsets: ['latin'],
// })

// const geistMono = Geist_Mono({
//   variable: '--font-geist-mono',
//   subsets: ['latin'],
// })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="bg-white tracking-tight antialiased dark:bg-zinc-950"
      >
        <ThemeProvider
          enableSystem={true}
          attribute="class"
          storageKey="theme"
          defaultTheme="system"
        >
          <div className="flex min-h-screen w-full flex-col">
            <div className="relative mx-auto w-full max-w-[65ch] flex-1 px-4 pt-20 flex flex-col">
              <BackgroundArt type="random" />
              <Header />
              <main className="flex-1">
                {children}
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

