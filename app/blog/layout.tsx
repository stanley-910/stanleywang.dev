// This is the 'markdown' renderer for the blog posts, which determines layout, i.e., copying the URL, displaying text
'use client'
import { TextMorph } from '@/components/ui/text-morph'
import { ScrollProgress } from '@/components/ui/scroll-progress'
import { useEffect, useState } from 'react'
import { BLOG_POSTS } from '@/app/data'
import { usePathname } from 'next/navigation'
import '@/app/styles/prose.css'
import '@/app/styles/markdown.css'
import '@/app/styles/code.css'
function CopyButton() {
  const [text, setText] = useState('Copy')
  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''

  useEffect(() => {
    setTimeout(() => {
      setText('Copy')
    }, 2000)
  }, [text])

  return (
    <button
      onClick={() => {
        setText('Copied')
        navigator.clipboard.writeText(currentUrl)
      }}
      className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 transition-colors"
      type="button"
    >
      <TextMorph>{text}</TextMorph>
      <span>URL</span>
    </button>
  )
}

function BlogHeader() {
  const pathname = usePathname()
  const post = BLOG_POSTS.find((post) => post.link === pathname)

  if (!post) return null

  return (
    <header className="mb-8">
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
        <div className="flex flex-row flex-wrap gap-2 mt-2">
          {post.tags.map((tag) => (
            <span 
              key={tag} 
              className="cursor-pointer text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
            >
              #{tag}
            </span>
          ))}
        </div>
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
  return (
    <>
      <ScrollProgress
        className="fixed top-0 z-20 h-0.5 bg-gray-300 dark:bg-zinc-600"
        springOptions={{
          bounce: 0,
        }}
      />
      <main className="prose prose-gray mt-10 pb-20 dark:prose-invert">
        <BlogHeader />
        {children}
      </main>
    </>
  )
}
