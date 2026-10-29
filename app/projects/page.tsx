import { GitHubLogoIcon } from '@radix-ui/react-icons'
import { GlobeIcon, YoutubeIcon } from 'lucide-react'

import { PROJECTS, type Project } from '@/app/data'
import { CodeSnippet } from '@/components/ui/code-snippet'
import { PipIcon } from '@/components/ui/pip-icon'
import { TrackPlayer } from '@/components/ui/track-player'

import { ProjectMedia } from './project-media'

import './projects.css'

// The flagship leads the page and its glimpse spans the full measure
// (design/circadian-meadow/components/ProjectsPage).
const FLAGSHIP = 'mini-compiler'
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
