import Link from 'next/link'

interface ProjectPreviewProps {
  title: string
  description: string
  children: React.ReactNode
}

export function ProjectPreview({
  title,
  description,
  children,
}: ProjectPreviewProps) {
  return (
    <main className="mt-10 space-y-8">
      <Link
        href="/projects"
        className="prose-link block w-fit font-mono text-sm text-zinc-600 dark:text-zinc-400"
      >
        ← All projects
      </Link>
      <header className="space-y-3">
        <p className="font-mono text-xs tracking-wide text-zinc-500 dark:text-zinc-400">
          Work in progress
        </p>
        <h1 className="font-serif text-3xl text-zinc-900 dark:text-zinc-100">
          {title}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">{description}</p>
      </header>
      <section className="space-y-3 rounded-2xl border border-zinc-200/70 bg-zinc-50/40 p-5 text-sm text-zinc-600 dark:border-zinc-800/70 dark:bg-zinc-950/40 dark:text-zinc-400">
        <h2 className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
          What I’m building
        </h2>
        {children}
      </section>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        A closer look at the implementation is on the way. This page is a
        preview, not an interactive demo.
      </p>
    </main>
  )
}
