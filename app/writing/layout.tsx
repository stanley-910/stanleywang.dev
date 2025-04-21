// This is the 'markdown' renderer for the blog posts, which determines layout, i.e., copying the URL, displaying text
'use client'
import { TextMorph } from '@/components/ui/text-morph'
import { ScrollProgress } from '@/components/ui/scroll-progress'
import { useEffect, useState } from 'react'
import { BLOG_POSTS } from '@/app/data'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import '@/app/styles/prose.css'
import '@/app/styles/markdown.css'
import '@/app/styles/code.css'
import 'katex/dist/katex.css'
import Giscus from '@giscus/react'
import { useTheme } from 'next-themes'
import PostsPage from '@/app/writing/page'

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
function CopyButton() {
  const [text, setText] = useState('Copy')
  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''

  useEffect(() => {
    setTimeout(() => {
      setText('Copy')
    }, 2000)
  }, [text])

  return (
    <div className="flex items-center gap-1 text-sm ">
      <button
        onClick={() => {
          setText('Copied')
          navigator.clipboard.writeText(currentUrl)
        }}
        className="transition-colors"
        type="button"
      >
        <span className="flex items-center gap-1 duration-200 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"><TextMorph>{text}</TextMorph> URL</span>
      </button>
    </div>
  )
}

function BlogHeader() {
  const pathname = usePathname()
  const post = BLOG_POSTS.find((post) => post.link === pathname)

  if (!post) return null

  return (
    <header className="mb-8">
      <meta property="og:title" content={post.title} data-toc-exclude />
      <h1 className="mb-2 text-3xl font-medium" data-toc-exclude>
        {post.title}
      </h1>
      <div className="flex flex-col">
        <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          <time dateTime={post.date}>
            {new Date(post.date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
          <span>•</span>
          <span>{post.readingTime}</span>
        </div>
        {/* TODO: Add tags back in */}
        {/* <div className="flex flex-row flex-wrap gap-2 mt-2"> */}
          {/* {post.tags.map((tag) => (
            <span 
              key={tag} 
              className="cursor-pointer text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
            >
              #{tag}
            </span>
          ))} */}
        {/* </div> */}
        <CopyButton />
      </div>
    </header>
  )
}



export default function LayoutBlogPost({
  children,
}: {
  children: React.ReactNode
}) {
  const { resolvedTheme } = useTheme()
  const pathname = usePathname()
  const isPostsPage = pathname === '/writing'

  // Add scroll to top effect when pathname changes
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  if (isPostsPage) {
    return <PostsPage />
  }

  return (
    <>
      <ScrollProgress
        className="fixed top-0 z-20 h-0.5 bg-gray-300 dark:bg-zinc-600"
        springOptions={{
          bounce: 0,
        }}
      />
      <main className="prose prose-gray mt-10 dark:prose-invert prose-pre:bg-transparent prose-pre:p-0">
    <motion.main
      className="space-y-12 mt-10 "
      variants={VARIANTS_CONTAINER}
      initial="hidden"
      animate="visible"
    >
          <BlogHeader />
            {children}
        </motion.main>
      </main>
      <hr className="prose-hr"></hr>
      <div className="">
        <Giscus
          repo="stanley-utf8/stanley"
          repoId="R_kgDOOcaodg"
          category="Writing"
          categoryId="DIC_kwDOOcaods4CpSuT"
          mapping="og:title"
          strict="0"
          reactionsEnabled="0"
          emitMetadata="0"
          inputPosition="top"
          theme={resolvedTheme === 'dark' ? 'transparent_dark' : 'light'}
          lang="en"
          // loading="lazy"
        />
      </div>
    </>
  )
}
