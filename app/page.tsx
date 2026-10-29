'use client'
import { useEffect, useState } from 'react'

import { GardenHome } from '@/components/garden/garden-home'
import { ExperienceLink } from '@/components/ui/experience-card'

import '@/app/styles/prose.css'
import '@/app/styles/markdown.css'

import { WORK_EXPERIENCE, EMAIL } from './data'

// import { cn } from '@/lib/utils'

// A role from data.ts for a company name in the bio, linked where the bio
// links it.
const job = (company: string, link: string) => {
  const found = WORK_EXPERIENCE.find((j) => j.company === company)
  if (!found) throw new Error(`No experience for ${company}`)
  return { ...found, link }
}

// A click copies the address and shows "copied" under it for a moment;
// the address itself stays put.
function CopyEmail() {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <button
      className="link-quiet relative cursor-pointer select-text"
      title="Copy to clipboard"
      onClick={() => {
        navigator.clipboard.writeText(EMAIL).then(() => setCopied(true))
      }}
    >
      {EMAIL}
      <span
        aria-hidden
        className={`pointer-events-none absolute top-full left-1/2 mt-1 -translate-x-1/2 font-mono text-xs font-normal text-[color:var(--ink-muted)] transition-all duration-200 ${
          copied ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
        }`}
      >
        copied
      </span>
    </button>
  )
}

export default function Personal() {
  return (
    <GardenHome>
      <div className="bio prose" data-avoid>
        <span className="block">你好, I&apos;m Stanley.</span>
        Currently studying Computer Science at{' '}
        <a
          href="https://www.mcgill.ca"
          target="_blank"
          rel="noopener noreferrer"
          className="link"
        >
          McGill University.
        </a>{' '}
        Most recently, I interned on Commerce & Identity at{' '}
        <ExperienceLink job={job('Electronic Arts', 'https://www.ea.com')}>
          Electronic Arts.
        </ExperienceLink>{' '}
        Before that, I wrote software with the{' '}
        <ExperienceLink
          job={job(
            'Autodesk',
            'https://www.autodesk.com/ca-en/products/flow-production-tracking/overview',
          )}
        >
          Flow PT team
        </ExperienceLink>{' '}
        at Autodesk and engineered structural tooling for{' '}
        <ExperienceLink job={job('BETA Technologies', 'https://beta.team/')}>
          BETA Technologies.
        </ExperienceLink>{' '}
      </div>
      <p className="link-row" data-avoid>
        <a className="link-quiet" href="https://github.com/stanley-910">
          github
        </a>
        <span className="sep">/</span>
        <a
          className="link-quiet"
          href="https://www.linkedin.com/in/notstanleywang/"
        >
          linkedin
        </a>
        <span className="sep">/</span>
        <a
          className="link-quiet"
          href="/resume"
          target="_blank"
          rel="noopener noreferrer"
        >
          resume
        </a>
        <span className="sep">/</span>
        <CopyEmail />
      </p>
    </GardenHome>
  )
}
