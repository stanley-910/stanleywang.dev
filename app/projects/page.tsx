'use client'
import { GitHubLogoIcon } from '@radix-ui/react-icons'
import { GlobeIcon, XIcon, YoutubeIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'

// UI Components
import { PROJECTS, type MediaItem, type Project } from '@/app/data'
import CdOut from '@/components/ui/cd-out'
import { CodeSnippet } from '@/components/ui/code-snippet'
import {
  MorphingDialog,
  MorphingDialogTrigger,
  MorphingDialogContent,
  MorphingDialogClose,
  MorphingDialogContainer,
} from '@/components/ui/morphing-dialog'
import { PipIcon } from '@/components/ui/pip-icon'
import { TrackPlayer } from '@/components/ui/track-player'

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
  media: NonNullable<Project['media']>
  name: string
}

// The frame around a project's image or video, not its dots.
const MEDIA_FRAME_CLASS =
  'rounded-2xl bg-zinc-50/40 p-1 ring-1 ring-zinc-200/50 ring-inset dark:bg-zinc-950/40 dark:ring-zinc-800/50'

const STRIP_CLASS =
  'flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

// Which slide a snap strip is showing.
function stripIndex(strip: HTMLDivElement) {
  return Math.round(strip.scrollLeft / strip.clientWidth)
}

function scrollStripTo(
  strip: HTMLDivElement | null,
  index: number,
  behavior: ScrollBehavior = 'smooth',
) {
  strip?.scrollTo({ left: index * strip.clientWidth, behavior })
}

// One slide: a plain image, or a light and dark pair that follows the
// site's theme.
function Slide({
  src,
  alt,
  className,
  fit,
}: {
  src: MediaItem
  alt: string
  className: string
  fit: string
}) {
  if (typeof src === 'string')
    return (
      <img
        src={src}
        alt={alt}
        className={`${className} ${fit}`}
        draggable={false}
      />
    )
  return (
    <div className={className}>
      <img
        src={src.light}
        alt={alt}
        className={`h-full w-full dark:hidden ${fit}`}
        draggable={false}
      />
      <img
        src={src.dark}
        alt={alt}
        className={`hidden h-full w-full dark:block ${fit}`}
        draggable={false}
      />
    </div>
  )
}

const slideKey = (src: MediaItem) => (typeof src === 'string' ? src : src.light)

type FullscreenGalleryProps = {
  media: NonNullable<Project['media']>
  name: string
  index: number
  onIndexChange: (index: number) => void
}

// Mounted only while the dialog is open. The arrows and counter sit inside
// the dialog content, because a press outside it closes the dialog.
function FullscreenGallery({
  media,
  name,
  index,
  onIndexChange,
}: FullscreenGalleryProps) {
  const stripRef = useRef<HTMLDivElement>(null)
  const count = media.sources.length

  useEffect(() => {
    scrollStripTo(stripRef.current, index, 'instant')
    // Only on open: later index changes come from the strip itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const step = useCallback(
    (delta: number) => {
      const strip = stripRef.current
      if (!strip) return
      scrollStripTo(strip, (stripIndex(strip) + delta + count) % count)
    },
    [count],
  )

  useEffect(() => {
    if (count <= 1) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        step(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        step(1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [count, step])

  return (
    <>
      <div
        ref={stripRef}
        className={`${STRIP_CLASS} h-full w-full rounded-xl`}
        onScroll={(e) => onIndexChange(stripIndex(e.currentTarget))}
      >
        {media.sources.map((src, i) => (
          <Slide
            key={slideKey(src)}
            src={src}
            alt={media.alt ?? `${name} — image ${i + 1}`}
            className="h-full w-full shrink-0 snap-center"
            fit="object-contain"
          />
        ))}
      </div>
      {count > 1 && (
        <>
          <GalleryArrow side="left" onClick={() => step(-1)} />
          <GalleryArrow side="right" onClick={() => step(1)} />
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
            {index + 1} / {count}
          </div>
        </>
      )}
    </>
  )
}

function GalleryArrow({
  side,
  onClick,
}: {
  side: 'left' | 'right'
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`absolute top-1/2 ${side === 'left' ? 'left-3' : 'right-3'} -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-lg transition-all hover:bg-white dark:bg-zinc-800/90 dark:hover:bg-zinc-800`}
      aria-label={side === 'left' ? 'Previous image' : 'Next image'}
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
        <polyline
          points={side === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'}
        ></polyline>
      </svg>
    </button>
  )
}

function ProjectMedia({ media, name }: ProjectMediaProps) {
  const aspect = media.aspect ?? 16 / 9
  const [index, setIndex] = useState(0)
  const stripRef = useRef<HTMLDivElement>(null)
  const count = media.sources.length

  // Follow the fullscreen view, so closing it lands on the same image.
  useEffect(() => {
    const strip = stripRef.current
    if (strip && stripIndex(strip) !== index) {
      scrollStripTo(strip, index, 'instant')
    }
  }, [index])

  if (media.type === 'video') {
    return (
      <MorphingDialog
        transition={{
          type: 'spring',
          bounce: 0,
          duration: 0.3,
        }}
      >
        <MorphingDialogTrigger className={MEDIA_FRAME_CLASS}>
          <div className="relative w-full">
            <video
              src={slideKey(media.sources[0])}
              autoPlay
              loop
              muted
              playsInline
              className="w-full cursor-zoom-in rounded-xl"
              style={{ aspectRatio: aspect }}
              onClick={(e) => {
                e.preventDefault()
              }}
            />
          </div>
        </MorphingDialogTrigger>
        <MorphingDialogContainer>
          <MorphingDialogContent className="relative aspect-video rounded-2xl bg-zinc-50 p-1 ring-1 ring-zinc-200/50 ring-inset dark:bg-zinc-950 dark:ring-zinc-800/50">
            <video
              src={slideKey(media.sources[0])}
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
      <MorphingDialogTrigger className={MEDIA_FRAME_CLASS}>
        <div
          ref={stripRef}
          className={`${STRIP_CLASS} w-full rounded-xl`}
          style={{ aspectRatio: aspect }}
          onScroll={(e) => setIndex(stripIndex(e.currentTarget))}
        >
          {media.sources.map((src, i) => (
            <Slide
              key={slideKey(src)}
              src={src}
              alt={media.alt ?? `${name} — image ${i + 1}`}
              className="h-full w-full shrink-0 cursor-zoom-in snap-center"
              fit={media.fit === 'cover' ? 'object-cover' : 'object-contain'}
            />
          ))}
        </div>
      </MorphingDialogTrigger>
      {count > 1 && (
        <div className="flex justify-center gap-1.5 pt-2 pb-1">
          {media.sources.map((src, i) => (
            <button
              key={slideKey(src)}
              onClick={() => scrollStripTo(stripRef.current, i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-zinc-500 dark:bg-zinc-400' : 'w-1.5 bg-zinc-300 dark:bg-zinc-700'}`}
              aria-label={`Show image ${i + 1}`}
            />
          ))}
        </div>
      )}
      <MorphingDialogContainer>
        <MorphingDialogContent
          style={{
            aspectRatio: aspect,
            width: `min(92vw, calc(80vh * ${aspect}))`,
          }}
          className="relative rounded-2xl bg-zinc-50 p-1 ring-1 ring-zinc-200/50 ring-inset dark:bg-zinc-950 dark:ring-zinc-800/50"
        >
          <FullscreenGallery
            media={media}
            name={name}
            index={index}
            onIndexChange={setIndex}
          />
        </MorphingDialogContent>
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
          <XIcon className="h-5 w-5 text-zinc-500" />
        </MorphingDialogClose>
      </MorphingDialogContainer>
    </MorphingDialog>
  )
}

const ICON_LINK_CLASS =
  'text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'

// Stands on the strip's first frame and runs through the rest on hover.
function SpriteIcon({
  sprite,
}: {
  sprite: NonNullable<Project['demoSprite']>
}) {
  const { src, width, height, frames } = sprite
  return (
    <span
      className="sprite-icon block"
      style={
        {
          width,
          height,
          backgroundImage: `url(${src})`,
          backgroundSize: `${width * (frames + 1)}px ${height}px`,
          '--sprite-from': `-${width}px`,
          '--sprite-to': `-${width * (frames + 1)}px`,
          '--sprite-frames': frames,
        } as React.CSSProperties
      }
    />
  )
}

function ProjectLinks({ project }: { project: Project }) {
  if (!project.demo && !project.github) return null
  return (
    <div className="flex shrink-0 items-center gap-3">
      {project.demo && (
        <a
          className={`group ${ICON_LINK_CLASS}`}
          href={project.demo}
          {...(project.demo.startsWith('/')
            ? {}
            : { target: '_blank', rel: 'noopener noreferrer' })}
          title={project.demoKind === 'video' ? 'Video' : 'Demo'}
          aria-label={`${project.name} ${project.demoKind === 'video' ? 'video' : 'demo'}`}
        >
          {project.demoMascot === 'pip' ? (
            <PipIcon />
          ) : project.demoSprite ? (
            <SpriteIcon sprite={project.demoSprite} />
          ) : project.demoIcon ? (
            <img src={project.demoIcon} alt="" className="h-4 w-auto" />
          ) : project.demoKind === 'video' ? (
            <YoutubeIcon className="-m-0.5 h-5 w-5" strokeWidth={1.75} />
          ) : (
            <GlobeIcon className="h-4 w-4" />
          )}
        </a>
      )}
      {project.github && (
        <a
          className={ICON_LINK_CLASS}
          href={project.github}
          target="_blank"
          rel="noopener noreferrer"
          title="Source"
          aria-label={`${project.name} source on GitHub`}
        >
          <GitHubLogoIcon className="h-4 w-4" />
        </a>
      )}
    </div>
  )
}

const TITLE_CLASS = 'font-mono tracking-tight text-zinc-900 dark:text-zinc-50'

export default function ProjectsPage() {
  const isFeatured = (project: Project) =>
    (project.media?.sources.length ?? 0) > 0
  const featured = PROJECTS.filter(isFeatured)
  const rest = PROJECTS.filter((project) => !isFeatured(project))

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
        </motion.section>
      </motion.div>
      <motion.section
        variants={VARIANTS_SECTION}
        initial="hidden"
        animate="visible"
        transition={TRANSITION_SECTION}
        className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70"
      >
        {featured.map((project) => (
          <article
            key={project.id}
            id={project.slug}
            className="space-y-3 py-10 first:pt-4"
          >
            <h2 className={`px-1 text-[15px] ${TITLE_CLASS}`}>
              {project.name}
            </h2>
            {project.media && project.media.sources.length > 0 && (
              <ProjectMedia media={project.media} name={project.name} />
            )}
            <div className="flex items-end justify-between gap-6 px-1">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {project.description}
              </p>
              <ProjectLinks project={project} />
            </div>
            {project.snippet && <CodeSnippet snippet={project.snippet} />}
            {project.tracks && (
              <div className="space-y-3 pt-1">
                {project.tracks.map((track) => (
                  <TrackPlayer key={track.src} track={track} />
                ))}
              </div>
            )}
          </article>
        ))}
      </motion.section>
      {rest.length > 0 && (
        <motion.section
          variants={VARIANTS_SECTION}
          initial="hidden"
          animate="visible"
          transition={TRANSITION_SECTION}
          className="border-t border-zinc-200/70 pt-10 dark:border-zinc-800/70"
        >
          <h3 className="mb-3 font-serif text-lg text-zinc-900 dark:text-zinc-100">
            More
          </h3>
          <div className="flex flex-col gap-6">
            {rest.map((project) => (
              <div
                key={project.id}
                id={project.slug}
                className="flex items-end justify-between gap-6"
              >
                <div>
                  <h2 className={`mb-1 text-sm ${TITLE_CLASS}`}>
                    {project.name}
                  </h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {project.description}
                  </p>
                </div>
                <ProjectLinks project={project} />
              </div>
            ))}
          </div>
        </motion.section>
      )}
      <motion.section
        variants={VARIANTS_SECTION}
        initial="hidden"
        animate="visible"
        transition={TRANSITION_SECTION}
        className="pt-6"
      >
        <CdOut link="/" title="Home" home />
      </motion.section>
    </motion.main>
  )
}
