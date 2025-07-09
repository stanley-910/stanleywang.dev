'use client'

import { motion } from 'motion/react'

import { BLOG_POSTS, EXPERIENCE_POSTS } from '@/app/data'
import CaseStudiesTable from '@/components/CaseStudiesTable'
import PostsTable from '@/components/PostsTable'
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
      <div className="prose prose-gray dark:prose-invert mt-10 space-y-8">
        <motion.section
          variants={VARIANTS_SECTION}
          initial="hidden"
          animate="visible"
          transition={TRANSITION_SECTION}
        >
          <p className="mb-4 font-serif text-lg text-gray-900 dark:text-gray-100">
            In Writing
          </p>
          <PostsTable posts={BLOG_POSTS} />
        </motion.section>
        <motion.section
          variants={VARIANTS_SECTION}
          initial="hidden"
          animate="visible"
          transition={TRANSITION_SECTION}
        >
          <p className="mb-4 font-serif text-lg text-gray-900 dark:text-gray-100">
            On Experience
          </p>
          <CaseStudiesTable posts={EXPERIENCE_POSTS} />
        </motion.section>
      </div>
      <motion.section
        variants={VARIANTS_SECTION}
        initial="hidden"
        animate="visible"
        transition={TRANSITION_SECTION}
      >
        <CdOut link="/" title="Home" home />
      </motion.section>
    </main>
  )
}
