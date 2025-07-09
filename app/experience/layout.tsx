// This is the 'markdown' renderer for the blog posts, which determines layout, i.e., copying the URL, displaying text
'use client'

import Giscus from '@giscus/react'
import { motion } from 'motion/react'
import { usePathname } from 'next/navigation'
import '@/app/styles/prose.css'
import '@/app/styles/markdown.css'
import '@/app/styles/code.css'
import 'katex/dist/katex.css'
import { useTheme } from 'next-themes'
import { useEffect } from 'react'

import { EXPERIENCE_POSTS } from '@/app/data'
import ExperiencePage from '@/app/experience/page'
import CdOut from '@/components/ui/cd-out'
import { ScrollProgress } from '@/components/ui/scroll-progress'

const VARIANTS_CONTAINER = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
}

const VARIANTS_SECTION = {
  hidden: { opacity: 0, y: 10, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
}

const TRANSITION_SECTION = {
  duration: 0.3,
}

function ExperienceHeader() {
  const pathname = usePathname()
  const post = EXPERIENCE_POSTS.find((post) => post.link === pathname)

  if (!post) return null

  return (
    <header className="mb-10">
      <meta property="og:title" content={post.title} data-toc-exclude />
      <h2 className="font-inter mb-3 text-2xl font-semibold" data-toc-exclude>
        {post.title}
      </h2>
      <div className="font-inter flex flex-row items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        {post.description}
      </div>
    </header>
  )
}

export default function ExperienceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { resolvedTheme } = useTheme()
  const pathname = usePathname()
  const isExperiencePage = pathname === '/experience'

  // Add scroll to top effect when pathname changes, but not on refresh
  useEffect(() => {
    // Don't scroll to top if there's a hash in the URL (anchor navigation)
    if (!window.location.hash) {
      window.scrollTo(0, 0)
    }
  }, [pathname])

  if (isExperiencePage) {
    return <ExperiencePage />
  }

  return (
    <>
      <ScrollProgress
        className="fixed top-0 z-20 h-0.5 bg-gray-300 dark:bg-zinc-600"
        springOptions={{
          bounce: 0,
        }}
      />

      <motion.main
        className="prose prose-gray dark:prose-invert prose-pre:bg-transparent prose-pre:p-0 mt-10 space-y-12"
        variants={VARIANTS_CONTAINER}
        initial="hidden"
        animate="visible"
      >
        <motion.section
          variants={VARIANTS_SECTION}
          initial="hidden"
          animate="visible"
          transition={TRANSITION_SECTION}
        >
          <ExperienceHeader />
        </motion.section>
      </motion.main>
      <motion.section
        className="prose prose-gray dark:prose-invert prose-pre:bg-transparent prose-pre:p-0 mt-10 space-y-12"
        variants={VARIANTS_SECTION}
        initial="hidden"
        animate="visible"
        transition={TRANSITION_SECTION}
      >
        {children}
      </motion.section>

      <motion.section
        variants={VARIANTS_SECTION}
        initial="hidden"
        animate="visible"
        transition={TRANSITION_SECTION}
      >
        <CdOut title="Back Home" link="/" home left display="Home" />
      </motion.section>
      <motion.section
        variants={VARIANTS_SECTION}
        initial="hidden"
        animate="visible"
        transition={TRANSITION_SECTION}
      >
        <hr className="prose-hr" />
      </motion.section>
      <motion.section
        variants={VARIANTS_SECTION}
        initial="hidden"
        animate="visible"
        transition={TRANSITION_SECTION}
      >
        <div id="giscus-container">
          <Giscus
            repo="stanley-910/stanleywang.dev"
            repoId="R_kgDOOcaodg"
            category="Experience"
            categoryId="DIC_kwDOOcaods4Cstz5"
            mapping="og:title"
            strict="0"
            reactionsEnabled="0"
            emitMetadata="0"
            inputPosition="top"
            theme={resolvedTheme === 'dark' ? 'transparent_dark' : 'light'}
            lang="en"
            loading="lazy"
          />
        </div>
      </motion.section>
    </>
  )
}
