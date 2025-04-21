'use client'
import ProjectsTable from '@/components/ProjectsTable'
import { PROJECTS } from '@/app/data'
import { motion } from 'motion/react'

const VARIANTS_SECTION = {
  hidden: { opacity: 0, y: 10, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
}

const TRANSITION_SECTION = {
  duration: 0.3,
}

export default function ProjectsPage() {
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
          Projects
        </p>
        <ProjectsTable projects={PROJECTS} />
      </motion.section>
    </div>
    </main>
  )
} 