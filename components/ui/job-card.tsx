'use client'

import Link from 'next/link'

import { Spotlight } from './spotlight'

type JobCardProps = {
  title: string
  company: string
  location: string
  start: string
  end?: string
  desc: string
  link: string
  caseStudy?: string
}

export function JobCard({
  title,
  company,
  location,
  start,
  end,
  desc,
  link,
  caseStudy,
}: JobCardProps) {
  // Common card content that's shared between both variants
  const CardContent = () => (
    <div className="relative h-full w-full rounded-[15px] bg-white p-4 dark:bg-zinc-950">
      <div className="relative flex w-full flex-row justify-between">
        <div>
          <h4 className="text-md mb-1 font-normal dark:text-zinc-100">
            {title}
            <span className={`text-zinc-600 dark:text-zinc-400`}>
              {' '}
              @ {company}
            </span>
          </h4>
          <p className="mb-1 text-sm text-zinc-500 dark:text-zinc-400">
            {location}
          </p>
        </div>
        <p className="font-inter text-xs text-zinc-600 italic dark:text-zinc-400">
          {start}
          {end && ` - ${end}`}
        </p>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{desc}</p>
      {caseStudy && (
        <div className="mt-4 flex justify-end">
          <Link
            href={caseStudy}
            className="text-sm text-blue-600 transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            View Case Study →
          </Link>
        </div>
      )}
    </div>
  )

  return (
    <div className="relative overflow-hidden rounded-2xl bg-zinc-300/50 p-[1px] dark:bg-zinc-600/30">
      <Spotlight
        className="from-red-900 via-red-800 to-red-700 blur-2xl dark:from-red-100 dark:via-red-200 dark:to-red-50"
        size={64}
      />
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <CardContent />
      </a>
    </div>
  )
}
