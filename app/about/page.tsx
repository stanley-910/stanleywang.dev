'use client'
import { motion } from 'motion/react'

import CdOut from '@/components/ui/cd-out'

const VARIANTS_SECTION = {
  hidden: { opacity: 0, y: 10, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
}

const TRANSITION_SECTION = {
  duration: 0.3,
}

export default function AboutPage() {
  return (
    <main className="">
      <div className="prose prose-gray dark:prose-invert mt-10 space-y-8">
        <motion.section
          variants={VARIANTS_SECTION}
          initial="hidden"
          animate="visible"
          transition={TRANSITION_SECTION}
        >
          <p className="mb-4 font-serif text-lg text-gray-900 italic dark:text-gray-100">
            Who am I?
          </p>
          <div className="prose dark:prose-invert">
            <p className="text-zinc-600 dark:text-zinc-400">
              Yes, many have asked this question.
            </p>

            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              // TODO: finish this
            </p>

            {/* <p className="text-zinc-600 dark:text-zinc-400 mt-4">
          
          </p> */}
          </div>
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
