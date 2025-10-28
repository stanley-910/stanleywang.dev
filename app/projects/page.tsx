'use client'
import { XIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
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
  const [thumbnailIndex, setThumbnailIndex] = useState(0)
  const [fullscreenIndex, setFullscreenIndex] = useState(0)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Auto-advance thumbnail slideshow every 3 seconds (pause when dialog is open)
  useEffect(() => {
    if (media.type === 'images' && media.sources.length > 1 && !isDialogOpen) {
      const timer = setInterval(() => {
        setThumbnailIndex((prev) =>
          prev === media.sources.length - 1 ? 0 : prev + 1,
        )
      }, 3000)
      return () => clearInterval(timer)
    }
  }, [media, isDialogOpen])

  // Keyboard navigation for fullscreen view
  useEffect(() => {
    if (!isDialogOpen || media.type !== 'images' || media.sources.length <= 1)
      return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setFullscreenIndex((prev) =>
          prev === 0 ? media.sources.length - 1 : prev - 1,
        )
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setFullscreenIndex((prev) =>
          prev === media.sources.length - 1 ? 0 : prev + 1,
        )
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDialogOpen, media])

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
              playsInline
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
        <div
          className="relative aspect-video w-full overflow-hidden rounded-xl"
          onClick={() => {
            setFullscreenIndex(thumbnailIndex)
            setIsDialogOpen(true)
          }}
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={thumbnailIndex}
              src={media.sources[thumbnailIndex]}
              alt={`Project image ${thumbnailIndex + 1}`}
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
        <MorphingDialogContent className="relative flex aspect-video items-center justify-center rounded-2xl bg-zinc-50 p-1 ring-1 ring-zinc-200/50 ring-inset dark:bg-zinc-950 dark:ring-zinc-800/50">
          <AnimatePresence mode="wait">
            <motion.div
              key={fullscreenIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex h-full w-full items-center justify-center"
            >
              <motion.img
                src={media.sources[fullscreenIndex]}
                alt={`Project image ${fullscreenIndex + 1}`}
                className="h-auto max-h-[80vh] w-auto max-w-[90vw] rounded-xl object-contain"
              />
            </motion.div>
          </AnimatePresence>
        </MorphingDialogContent>
        {media.sources.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setFullscreenIndex((prev) =>
                  prev === 0 ? media.sources.length - 1 : prev - 1,
                )
              }}
              className="fixed top-1/2 left-6 z-20 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-lg transition-all hover:bg-white dark:bg-zinc-800/90 dark:hover:bg-zinc-800"
              aria-label="Previous image"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-zinc-700 dark:text-zinc-300"
              >
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setFullscreenIndex((prev) =>
                  prev === media.sources.length - 1 ? 0 : prev + 1,
                )
              }}
              className="fixed top-1/2 right-6 z-20 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-lg transition-all hover:bg-white dark:bg-zinc-800/90 dark:hover:bg-zinc-800"
              aria-label="Next image"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-zinc-700 dark:text-zinc-300"
              >
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
            <div className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
              {fullscreenIndex + 1} / {media.sources.length}
            </div>
          </>
        )}
        <MorphingDialogClose
          className="fixed top-6 right-6 z-20 h-fit w-fit rounded-full bg-white p-1"
          variants={{
            initial: { opacity: 0 },
            animate: {
              opacity: 1,
              transition: { delay: 0.3, duration: 0.1 },
            },
            exit: { opacity: 0, transition: { duration: 0 } },
          }}
        >
          <div onClick={() => setIsDialogOpen(false)}>
            <XIcon className="h-5 w-5 text-zinc-500" />
          </div>
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
