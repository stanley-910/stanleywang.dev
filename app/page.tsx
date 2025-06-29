'use client'
import { motion } from 'motion/react'
import Link from 'next/link'

import { AnimatedBackground } from '@/components/ui/animated-background'
import { AsciiArt } from '@/components/ui/ascii'
import { Magnetic } from '@/components/ui/magnetic'
import { Spotlight } from '@/components/ui/spotlight'
import { Stars } from '@/components/ui/stars'

import '@/app/styles/prose.css'
import '@/app/styles/markdown.css'

import { WORK_EXPERIENCE, BLOG_POSTS, EMAIL, SOCIAL_LINKS } from './data'

import { format } from 'date-fns'

// import { cn } from '@/lib/utils'

const VARIANTS_CONTAINER = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
}

const VARIANTS_SECTION = {
  hidden: { opacity: 0, y: 10, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
}

const TRANSITION_SECTION = {
  duration: 0.3,
}

export default function Personal() {
  return (
    <motion.main
      className="space-y-6"
      variants={VARIANTS_CONTAINER}
      initial="hidden"
      animate="visible"
    >
      <motion.section
        variants={VARIANTS_SECTION}
        transition={TRANSITION_SECTION}
      >
        <div className="mt-10 flex-1">
          <div className="prose">
            Currently studying Computer Science at{' '}
            <a
              href="https://www.mcgill.ca"
              target="_blank"
              rel="noopener noreferrer"
              className="prose-link"
            >
              McGill University
            </a>{' '}
            and writing software with the <br />
            <a
              href="https://www.autodesk.com/ca-en/products/flow-production-tracking/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="prose-link"
            >
              Flow PT team
            </a>{' '}
            at Autodesk.
            <br />
            <br />
            I&apos;m trying to be better at valuing <strong>
              improvement
            </strong>{' '}
            over <strong>iteration</strong>, and prioritize the
            <br />
            <strong>
              <em>comprehension</em>
            </strong>{' '}
            of my work, rather than the{' '}
            <strong>
              <em>momentum</em>
            </strong>{' '}
            of it.
            <br />
            <br />
            Outside of writing software{' '}
            <span className="font-mono text-sm text-zinc-500 dark:text-zinc-500">
              (vim)
            </span>
            , I enjoy playing music and spending time with my girlfriend.
            <br />
            <br />
            <div className="text-right font-mono text-xs text-zinc-500 dark:text-zinc-400">
              <b>Stanley Wang</b>
              <br />
              Last Updated: June 18, 2025
            </div>
          </div>
        </div>
      </motion.section>
      <Stars className="fill-[rgb(186,149,94)] transition-colors dark:fill-[rgb(186,149,94)]" />

      <motion.section
        variants={VARIANTS_SECTION}
        transition={TRANSITION_SECTION}
        className="my-6"
      >
        <h3 className="mb-3 font-serif text-lg font-medium">
          <Link className="prose-link" href="/writing">
            Writing
          </Link>
        </h3>

        <div className="flex flex-col space-y-0">
          <AnimatedBackground
            enableHover
            className="h-full w-full rounded-lg bg-zinc-100 dark:bg-zinc-900/80"
            transition={{
              type: 'spring',
              bounce: 0,
              duration: 0.2,
            }}
          >
            {BLOG_POSTS.map((post) => (
              <Link
                key={post.uid}
                className="-mx-3 rounded-xl px-3 py-3"
                href={post.link}
                data-id={post.uid}
              >
                <h4 className="text-md mb-1 font-normal dark:text-zinc-100">
                  {post.title}
                </h4>
                <p className="mb-1 text-sm text-zinc-500">
                  <time dateTime={post.date}>
                    {format(new Date(post.date), 'MMMM dd, yyyy')}
                  </time>
                  {' · '}
                  {post.readingTime}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {post.description}
                </p>
              </Link>
            ))}
          </AnimatedBackground>
        </div>
      </motion.section>

      <motion.section
        variants={VARIANTS_SECTION}
        transition={TRANSITION_SECTION}
        className="my-6"
      >
        <h3
          className="mb-6 font-serif text-lg font-medium"
          title="In Development"
        >
          <span className="prose-link">Experience</span>
        </h3>
        <div className="flex flex-col space-y-2">
          {WORK_EXPERIENCE.map((job) => (
            <a
              className="relative overflow-hidden rounded-2xl bg-zinc-300/50 p-[1px] dark:bg-zinc-600/30"
              href={job.link}
              target="_blank"
              rel="noopener noreferrer"
              key={job.id}
            >
              <Spotlight
                className={
                  'from-red-900 via-red-800 to-red-700 blur-2xl dark:from-red-100 dark:via-red-200 dark:to-red-50'
                }
                size={64}
              />
              <div className="relative h-full w-full rounded-[15px] bg-white p-4 dark:bg-zinc-950">
                <div className="relative flex w-full flex-row justify-between">
                  <div>
                    <h4 className="text-md mb-1 font-normal dark:text-zinc-100">
                      {job.title}
                      <span className={`text-zinc-600 dark:text-zinc-400`}>
                        {' '}
                        @ {job.company}
                      </span>
                    </h4>
                    <p className="mb-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {job.location}
                    </p>
                  </div>
                  <p className="font-inter text-xs text-zinc-600 italic dark:text-zinc-400">
                    {job.start}
                    {job.end && ` - ${job.end}`}
                  </p>
                </div>
                {/* <svg className="w-10 h-10">
                  <use href={hr_handwritten_white.src} />
                </svg> */}
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {job.desc}
                </p>
              </div>
            </a>
          ))}
        </div>
      </motion.section>

      <motion.section
        variants={VARIANTS_SECTION}
        transition={TRANSITION_SECTION}
        className="mt-8 mb-6"
      >
        <p className="flex items-center justify-center space-x-2 overflow-x-auto pb-2 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
          <button
            className="prose-link cursor-pointer font-mono text-sm underline select-text dark:text-zinc-300"
            title="Copy to clipboard"
            onClick={() => {
              navigator.clipboard.writeText(EMAIL)
            }}
          >
            email
          </button>
          <span>·</span>
          <a
            className="prose-link font-mono text-sm underline dark:text-zinc-300"
            href="https://github.com/stanley-910"
          >
            github
          </a>
          <span>·</span>
          <a
            className="prose-link font-mono text-sm underline dark:text-zinc-300"
            href="https://www.linkedin.com/in/notstanleywang/"
          >
            linkedin
          </a>
        </p>
      </motion.section>

      <Stars className="fill-[rgb(186,149,94)] transition-colors dark:fill-[rgb(186,149,94)]" />
      <motion.section
        variants={VARIANTS_SECTION}
        transition={TRANSITION_SECTION}
      >
        <AsciiArt />
      </motion.section>
    </motion.main>
  )
}
