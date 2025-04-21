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
    <main className="prose prose-gray mt-10 pb-20 dark:prose-invert">  
    <div className="space-y-8">
      <motion.section
        variants={VARIANTS_SECTION}
        initial="hidden"
        animate="visible"
        transition={TRANSITION_SECTION}
      >
        <p className="text-lg font-serif italic mb-4 text-gray-900 dark:text-gray-100">
          About Me
        </p>
        <div className="prose dark:prose-invert">
          <p className="text-zinc-600 dark:text-zinc-400">
            I'm Stanley Wang, a software engineer and researcher based in Montreal. I'm currently studying Computer Science at McGill University, where I focus on AI Ethics and Systems Programming.
          </p>
          
          <p className="text-zinc-600 dark:text-zinc-400 mt-4">
            My work spans across various domains of computer science, from low-level systems programming to high-level AI applications. I'm particularly interested in the intersection of technology and ethics, exploring how we can build more responsible and human-centered AI systems.
          </p>

          <p className="text-zinc-600 dark:text-zinc-400 mt-4">
            When I'm not coding or researching, you can find me playing jazz piano, writing about technology, or exploring the beautiful city of Montreal.
          </p>
        </div>
      </motion.section>
    </div>
    </main>
  )
} 