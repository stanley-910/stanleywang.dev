import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
// Font styles
import '@fontsource/dm-mono'
import './styles/fonts.css'
import './styles/prose.css'
import './styles/toc.css'
import './globals.css'
import { Header } from './header'
import { Footer } from './footer'
import { ThemeProvider } from 'next-themes'
import { BackgroundArt } from '@/components/art/BackgroundArt'
import { ScrollToTop } from './components/ScrollToTop'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
}

export const metadata: Metadata = {
  title: 'Nim - Personal website template',
  description:
    'Nim is a free and open-source personal website template built with Next.js 15, React 19 and Motion-Primitives.',
}

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

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
      {/* <body
        className={`          ${geist.variable} ${geistMono.variable} 
        bg-white tracking-tight antialiased dark:bg-zinc-950`}
      > */}
        {/* This is the theme provider, which allows the user to switch between light and dark mode */}
        <ThemeProvider
          enableSystem={true}
          attribute="class"
          storageKey="theme"
          defaultTheme="system"
        >
          <div className="flex min-h-screen w-full flex-col">
            <div className="relative mx-auto w-full max-w-screen-sm flex-1 px-4 pt-20 flex flex-col">
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

