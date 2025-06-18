import { ArrowUpLeft } from 'lucide-react'
import Link from 'next/link'
import '@/app/styles/prose.css'
import '@/app/styles/markdown.css'

interface CdOutProps {
  link: string
  title?: string
  home?: boolean
}

export default function CdOut({ link, title, home }: CdOutProps) {
  return (
    <div className="not-prose my-10 flex justify-end">
      <Link
        title={`${title ? `${title}` : 'Back'}`}
        href={link}
        className="flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
      >
        <ArrowUpLeft className="h-4 w-4" />
        <span className="font-mono">{home ? '~' : '..'}</span>
      </Link>
    </div>
  )
}
