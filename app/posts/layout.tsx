'use client'

import Giscus from '@giscus/react'
import { useTheme } from 'next-themes'
import { usePathname } from 'next/navigation'

// This is a root layout for the posts page that won't inherit the scroll progress
export default function RootLayoutPosts({
  children,
}: {
  children: React.ReactNode
}) {
  const { resolvedTheme } = useTheme()
  const pathname = usePathname()

  return (
    <main className="prose prose-gray mt-10 pb-20 dark:prose-invert">
      {children}
      
      {/* Comments section with custom styling */}
      <div className="mt-16 -mx-4 sm:mx-0">
        <h2 className="text-xl font-serif italic mb-8">Discussion</h2>
        <Giscus
          repo="stanley-utf8/stanley"
          repoId="R_kgDOOcaodg"
          category="posts"
          categoryId="DIC_kwDOOcaods4CpSwU"
          mapping="pathname"
          strict="0"
          reactionsEnabled="0"
          emitMetadata="0"
          inputPosition="top"
          theme="transparent_dark"
          lang="en"
          loading="lazy"
        />
      </div>
    </main>
  )
} 