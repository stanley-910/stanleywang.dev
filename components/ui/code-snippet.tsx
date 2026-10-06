'use client'
import Link from 'next/link'
import { useState } from 'react'

import type { Project } from '@/app/data'

// The compiler's editor window (mini-c-prototype/animated.css: .ac-bar,
// .ac-source), small enough for a project card. Edits stay here until
// compile hands them to the project's page.
export function CodeSnippet({
  snippet,
}: {
  snippet: NonNullable<Project['snippet']>
}) {
  const [code, setCode] = useState(snippet.source)
  const edited = code !== snippet.source
  const lineCount = code.replace(/\n$/, '').split('\n').length
  const href = edited
    ? `${snippet.href}?source=${encodeURIComponent(code)}`
    : `${snippet.href}?example=${encodeURIComponent(snippet.label)}`

  return (
    <div className="overflow-hidden rounded-xl bg-[#f7f7f8] font-mono text-[12px] text-zinc-900 ring-1 ring-[#dcdce0] ring-inset dark:bg-[#09090b] dark:text-zinc-200 dark:ring-[#27272a]">
      <div className="flex h-7 items-center justify-between border-b border-[#dcdce0] px-2.5 text-zinc-500 dark:border-[#27272a] dark:text-zinc-400">
        <span className="text-zinc-900 dark:text-zinc-200">{snippet.file}</span>
        <span>{edited ? 'edited' : snippet.label}</span>
      </div>
      <div className="grid grid-cols-[34px_1fr] overflow-x-auto py-2 leading-[19px]">
        <div
          className="pr-2 text-right text-[#8a8a94] select-none dark:text-[#52525b]"
          aria-hidden
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Tab' || e.shiftKey) return
            e.preventDefault()
            const el = e.currentTarget
            const { selectionStart: start, selectionEnd: end } = el
            setCode(code.slice(0, start) + '  ' + code.slice(end))
            requestAnimationFrame(() =>
              el.setSelectionRange(start + 2, start + 2),
            )
          }}
          rows={lineCount}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label={`Edit ${snippet.file}`}
          className="block w-full resize-none overflow-hidden bg-transparent pr-2.5 leading-[19px] whitespace-pre caret-zinc-900 outline-none dark:caret-zinc-200"
        />
      </div>
      <div className="flex h-8 items-center justify-end border-t border-[#dcdce0] px-2.5 dark:border-[#27272a]">
        <Link
          href={href}
          prefetch={false}
          className="bg-zinc-900 px-1 py-px text-[#f7f7f8] transition-opacity hover:opacity-80 dark:bg-zinc-200 dark:text-[#09090b]"
        >
          compile
        </Link>
      </div>
    </div>
  )
}
