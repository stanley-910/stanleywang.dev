import { ArrowUpLeft } from 'lucide-react'
import Link from 'next/link'
import '@/app/styles/prose.css'
import '@/app/styles/markdown.css'

interface CdOutProps {
  link: string
  title?: string
  display?: string
  home?: boolean
  left?: boolean
}

export default function CdOut({
  link,
  title,
  home,
  left,
  display,
}: CdOutProps) {
  return (
    <div
      className={`not-prose my-10 flex ${left ? 'justify-start' : 'justify-end'}`}
    >
      <Link
        title={`${title ? `${title}` : 'Back'}`}
        href={link}
        className="flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
      >
        <ArrowUpLeft className="h-4 w-4" />
        {display ? (
          <span className="font-mono">{display}</span>
        ) : (
          <span className="font-mono">{home ? '~' : '..'}</span>
        )}
      </Link>
    </div>
  )
}
