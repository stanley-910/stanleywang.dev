'use client'
import { GitHubLogoIcon } from '@radix-ui/react-icons'
import { GlobeIcon, XIcon, YoutubeIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

// UI Components
import { PROJECTS, type MediaItem, type Project } from '@/app/data'
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

import './projects.css'

// The flagship leads the page and its glimpse spans the full measure
// (design/circadian-meadow/components/ProjectsPage).
const FLAGSHIP = 'mini-compiler'

type ProjectMediaProps = {
  media: NonNullable<Project['media']>
  name: string
}

// The frame around a project's image or video, not its dots.
const MEDIA_FRAME_CLASS = 'plate'

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
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    )
  return (
    <div className={className}>
      <img
        src={src.light}
        alt={alt}
        className={`h-full w-full dark:hidden ${fit}`}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
      <img
        src={src.dark}
        alt={alt}
        className={`hidden h-full w-full dark:block ${fit}`}
        loading="lazy"
        decoding="async"
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
        className={`${STRIP_CLASS} h-full w-full`}
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
          <div className="plate-count">
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
      className={`plate-arrow ${side === 'left' ? 'left-3' : 'right-3'}`}
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
            <InViewVideo
              src={slideKey(media.sources[0])}
              className="w-full cursor-zoom-in"
              style={{ aspectRatio: aspect }}
              onClick={(e) => {
                e.preventDefault()
              }}
            />
          </div>
        </MorphingDialogTrigger>
        <MorphingDialogContainer>
          <MorphingDialogContent className="plate-open relative aspect-video">
            <video
              src={slideKey(media.sources[0])}
              autoPlay
              loop
              muted
              playsInline
              className="aspect-video h-[50vh] w-full md:h-[70vh]"
            />
          </MorphingDialogContent>
          <MorphingDialogClose
            className="plate-close"
            variants={{
              initial: { opacity: 0 },
              animate: {
                opacity: 1,
                transition: { delay: 0.3, duration: 0.1 },
              },
              exit: { opacity: 0, transition: { duration: 0 } },
            }}
          >
            <XIcon className="h-4 w-4" strokeWidth={1.5} />
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
          className={`${STRIP_CLASS} w-full`}
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
        <div className="plate-dots">
          {media.sources.map((src, i) => (
            <button
              key={slideKey(src)}
              onClick={() => scrollStripTo(stripRef.current, i)}
              aria-current={i === index || undefined}
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
          className="plate-open relative"
        >
          <FullscreenGallery
            media={media}
            name={name}
            index={index}
            onIndexChange={setIndex}
          />
        </MorphingDialogContent>
        <MorphingDialogClose
          className="plate-close"
          variants={{
            initial: { opacity: 0 },
            animate: {
              opacity: 1,
              transition: { delay: 0.3, duration: 0.1 },
            },
            exit: { opacity: 0, transition: { duration: 0 } },
          }}
        >
          <XIcon className="h-4 w-4" strokeWidth={1.5} />
        </MorphingDialogClose>
      </MorphingDialogContainer>
    </MorphingDialog>
  )
}

const ICON_LINK_CLASS = 'project-icon'

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
    <div className="project-links">
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

// One project: what it is on the left (name, kind, links), and on the right
// a glimpse of it working, Stanley's description, and anything to try.
function ProjectRow({
  project,
  flagship,
}: {
  project: Project
  flagship?: boolean
}) {
  const hasMedia = (project.media?.sources.length ?? 0) > 0
  return (
    <article
      id={project.slug}
      className="project"
      data-flagship={flagship || undefined}
      data-plain={!hasMedia || undefined}
    >
      <header className="project-meta">
        <h2 className="project-name">{project.name}</h2>
        {project.category && <p className="project-kind">{project.category}</p>}
        <ProjectLinks project={project} />
      </header>
      <div className="project-body">
        {hasMedia && project.media && (
          <ProjectMedia media={project.media} name={project.name} />
        )}
        <p className="project-desc">{project.description}</p>
        {project.snippet && <CodeSnippet snippet={project.snippet} />}
        {project.tracks && (
          <div className="project-tracks">
            {project.tracks.map((track) => (
              <TrackPlayer key={track.src} track={track} />
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

// Plays only while on screen, so a page of projects isn't decoding video
// out of sight.
function InViewVideo({
  src,
  className,
  style,
}: {
  src: string
  className: string
  style: React.CSSProperties
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const video = ref.current
    if (!video) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !reduce.matches) video.play().catch(() => {})
      else video.pause()
    })
    observer.observe(video)
    return () => observer.disconnect()
  }, [])
  return (
    <video
      ref={ref}
      src={src}
      loop
      muted
      playsInline
      preload="metadata"
      className={className}
      style={style}
      onClick={(e) => e.preventDefault()}
    />
  )
}

export default function ProjectsPage() {
  const flagship = PROJECTS.find((p) => p.slug === FLAGSHIP)
  const hasMedia = (p: Project) => (p.media?.sources.length ?? 0) > 0
  const others = PROJECTS.filter((p) => p !== flagship)
  const shown = others.filter(hasMedia)
  const plain = others.filter((p) => !hasMedia(p))

  return (
    <div className="projects">
      <h1 className="sr-only">Projects</h1>
      {flagship && <ProjectRow project={flagship} flagship />}
      {shown.map((project) => (
        <ProjectRow key={project.id} project={project} />
      ))}
      {plain.length > 0 && (
        <section className="projects-plain" aria-label="Smaller projects">
          {plain.map((project) => (
            <ProjectRow key={project.id} project={project} />
          ))}
        </section>
      )}
    </div>
  )
}
