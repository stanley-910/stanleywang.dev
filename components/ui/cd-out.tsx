import Link from 'next/link'
import { ArrowUpLeft } from 'lucide-react'
import '@/app/styles/prose.css'
import '@/app/styles/markdown.css'

interface CdOutProps {
    link: string
    title?: string
}

export default function CdOut({ link, title }: CdOutProps) {
  return (
    <div className="flex justify-end my-10 not-prose">
      <Link title={`${title ? `${title}` : 'Back'}`} href={link} className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
        <ArrowUpLeft className="w-4 h-4" />
        <span className="font-mono">..</span>
      </Link>
    </div>
  )
}
