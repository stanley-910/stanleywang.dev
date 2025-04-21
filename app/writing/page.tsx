'use client'

import { motion } from 'motion/react'
import PostsTable from '@/components/PostsTable'
import { BLOG_POSTS } from '@/app/data'
import CdOut from '@/components/ui/cd-out'
const VARIANTS_SECTION = {
  hidden: { opacity: 0, y: 10, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
}

const TRANSITION_SECTION = {
  duration: 0.3,
}

export default function PostsPage() {
  return (
    <main className="">
      <div className="space-y-8 prose prose-gray mt-10 dark:prose-invert">
        <motion.section
          variants={VARIANTS_SECTION}
          initial="hidden"
          animate="visible"
          transition={TRANSITION_SECTION}
        >
          <p className="text-lg font-serif italic mb-4 text-gray-900 dark:text-gray-100">
            In Writing
          </p>
          <PostsTable posts={BLOG_POSTS} />
        </motion.section>
      </div>
      <motion.section
        variants={VARIANTS_SECTION}
        initial="hidden"
        animate="visible"
        transition={TRANSITION_SECTION}
      >
        <CdOut link="/" title="Home" />
      </motion.section>
    </main>
  )
} 