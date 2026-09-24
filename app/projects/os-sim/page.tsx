import { ProjectPreview } from '@/components/ui/project-preview'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'OS Sim — Stanley Wang',
  description:
    'A teaching shell in C exploring scheduling, demand paging, and multithreading. Writeup in progress.',
}

export default function OsSimPage() {
  return (
    <ProjectPreview
      title="OS Sim"
      description="A teaching shell in C for exploring how an operating system shares time and memory between programs."
    >
      <p>
        This coursework brings together process scheduling, demand paging, and
        multithreaded execution. It explores policies such as first-come,
        first-served, shortest-job-first, and round robin, alongside page
        replacement and a thread-safe execution queue.
      </p>
      <p>
        I’m putting together a writeup of the design and what changes when
        several programs compete for the same resources. It’s a simulation, not
        a full operating system.
      </p>
    </ProjectPreview>
  )
}
