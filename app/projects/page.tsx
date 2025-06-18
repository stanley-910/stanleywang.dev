'use client'
import { XIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'

// UI Components
import { PROJECTS } from '@/app/data'
import CdOut from '@/components/ui/cd-out'
import {
  MorphingDialog,
  MorphingDialogTrigger,
  MorphingDialogContent,
  MorphingDialogClose,
  MorphingDialogContainer,
} from '@/components/ui/morphing-dialog'

// Data

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

type ProjectMediaProps = {
  media: {
    type: 'video' | 'images'
    sources: string[]
  }
}

function ProjectMedia({ media }: ProjectMediaProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  // Auto-advance slideshow every 3 seconds
  useEffect(() => {
    if (media.type === 'images' && media.sources.length > 1) {
      const timer = setInterval(() => {
        setCurrentImageIndex((prev) =>
          prev === media.sources.length - 1 ? 0 : prev + 1,
        )
      }, 3000)
      return () => clearInterval(timer)
    }
  }, [media])

  if (media.type === 'video') {
    return (
      <MorphingDialog
        transition={{
          type: 'spring',
          bounce: 0,
          duration: 0.3,
        }}
      >
        <MorphingDialogTrigger>
          <div className="relative w-full">
            <video
              src={media.sources[0]}
              autoPlay
              loop
              muted
              playsInline
              className="aspect-video w-full cursor-zoom-in rounded-xl"
              onClick={(e) => {
                // Only prevent the video's default behavior
                e.preventDefault()
              }}
            />
          </div>
        </MorphingDialogTrigger>
        <MorphingDialogContainer>
          <MorphingDialogContent className="relative aspect-video rounded-2xl bg-zinc-50 p-1 ring-1 ring-zinc-200/50 ring-inset dark:bg-zinc-950 dark:ring-zinc-800/50">
            <video
              src={media.sources[0]}
              autoPlay
              loop
              muted
              className="aspect-video h-[50vh] w-full rounded-xl md:h-[70vh]"
            />
          </MorphingDialogContent>
          <MorphingDialogClose
            className="fixed top-6 right-6 h-fit w-fit rounded-full bg-white p-1"
            variants={{
              initial: { opacity: 0 },
              animate: {
                opacity: 1,
                transition: { delay: 0.3, duration: 0.1 },
              },
              exit: { opacity: 0, transition: { duration: 0 } },
            }}
          >
            <XIcon className="h-5 w-5 text-zinc-500" />
          </MorphingDialogClose>
        </MorphingDialogContainer>
      </MorphingDialog>
    )
  }

  return (
    <MorphingDialog
      transition={{
        type: 'spring',
        bounce: 0,
        duration: 0.3,
      }}
    >
      <MorphingDialogTrigger>
        <div className="relative aspect-video w-full overflow-hidden rounded-xl">
          <AnimatePresence mode="wait">
            <motion.img
              key={currentImageIndex}
              src={media.sources[currentImageIndex]}
              alt={`Project image ${currentImageIndex + 1}`}
              className="h-full w-full cursor-pointer object-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            />
          </AnimatePresence>
        </div>
      </MorphingDialogTrigger>
      <MorphingDialogContainer>
        <MorphingDialogContent className="relative aspect-video rounded-2xl bg-zinc-50 p-1 ring-1 ring-zinc-200/50 ring-inset dark:bg-zinc-950 dark:ring-zinc-800/50">
          <Image
            src={media.sources[currentImageIndex]}
            alt={`Project image ${currentImageIndex + 1}`}
            className="h-full max-h-[80vh] w-full max-w-[90vw] rounded-xl object-contain"
          />
        </MorphingDialogContent>
        <MorphingDialogClose
          className="fixed top-6 right-6 h-fit w-fit rounded-full bg-white p-1"
          variants={{
            initial: { opacity: 0 },
            animate: {
              opacity: 1,
              transition: { delay: 0.3, duration: 0.1 },
            },
            exit: { opacity: 0, transition: { duration: 0 } },
          }}
        >
          <XIcon className="h-5 w-5 text-zinc-500" />
        </MorphingDialogClose>
      </MorphingDialogContainer>
    </MorphingDialog>
  )
}

export default function ProjectsPage() {
  return (
    <motion.main
      className="space-y-4"
      variants={VARIANTS_CONTAINER}
      initial="hidden"
      animate="visible"
    >
      <motion.div className="prose prose-gray dark:prose-invert mt-10 space-y-8">
        <motion.section
          variants={VARIANTS_SECTION}
          initial="hidden"
          animate="visible"
          transition={TRANSITION_SECTION}
        >
          <p className="mb-4 font-serif text-lg text-gray-900 dark:text-gray-100">
            Showcase
          </p>
          {/* <ProjectsTable projects={PROJECTS} /> */}
        </motion.section>
      </motion.div>
      <motion.section
        variants={VARIANTS_SECTION}
        initial="hidden"
        animate="visible"
        transition={TRANSITION_SECTION}
      >
        {/* <h3 className="mb-5 text-lg font-medium font-serif"><Link className="prose-link" href="/projects">Showcase</Link></h3> */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {PROJECTS.map((project) => (
            <div key={project.name} className="space-y-2">
              <div className="relative rounded-2xl bg-zinc-50/40 p-1 ring-1 ring-zinc-200/50 ring-inset dark:bg-zinc-950/40 dark:ring-zinc-800/50">
                <ProjectMedia media={project.media} />
              </div>
              <div className="px-1">
                <a
                  className="group relative inline-block font-mono text-sm tracking-tight text-zinc-900 dark:text-zinc-50"
                  href={project.link}
                  target="_blank"
                >
                  {project.name}
                  <span className="absolute bottom-0.5 left-0 block h-[1px] w-full max-w-0 bg-zinc-900 transition-all duration-200 group-hover:max-w-full dark:bg-zinc-400"></span>
                </a>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {project.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </motion.section>
      <motion.section
        variants={VARIANTS_SECTION}
        initial="hidden"
        animate="visible"
        transition={TRANSITION_SECTION}
      >
        <CdOut link="/" title="Home" home />
      </motion.section>
    </motion.main>
  )
}
