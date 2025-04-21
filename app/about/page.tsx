'use client'
import { motion } from 'motion/react'

const VARIANTS_SECTION = {
  hidden: { opacity: 0, y: 10, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
}

const TRANSITION_SECTION = {
  duration: 0.3,
}

export default function AboutPage() {
  return (
    <main className="prose prose-gray mt-10 dark:prose-invert">  
    <div className="space-y-8">
      <motion.section
        variants={VARIANTS_SECTION}
        initial="hidden"
        animate="visible"
        transition={TRANSITION_SECTION}
      >
        <p className="text-lg font-serif italic mb-4 text-gray-900 dark:text-gray-100">
          Who am I?
        </p>
        <div className="prose dark:prose-invert">
          <p className="text-zinc-600 dark:text-zinc-400">
            Yes, many have asked this question.
          </p>
          
          <p className="text-zinc-600 dark:text-zinc-400 mt-4">
          // TODO: finish this
          </p>

          {/* <p className="text-zinc-600 dark:text-zinc-400 mt-4">
          
          </p> */}
        </div>
      </motion.section>
    </div>
    </main>
  )
} 