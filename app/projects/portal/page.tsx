import { readFileSync } from 'node:fs'
import path from 'node:path'

import Link from 'next/link'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Portal — Stanley Wang',
  description:
    'A multiplayer globe for getting between places in Asia. Draw a trip with friends and Portal finds the trains, flights and buses to get everyone there.',
}

// Rendered from architecture.mmd by scripts/portal-architecture.mjs; its colours are the --arch-* variables below.
const ARCHITECTURE = readFileSync(
  path.join(process.cwd(), 'app/projects/portal/architecture.svg'),
  'utf8',
)

const ARCH_THEME = [
  '[--arch-node:var(--color-white)]',
  '[--arch-border:var(--color-zinc-300)]',
  '[--arch-text:var(--color-zinc-800)]',
  '[--arch-line:var(--color-zinc-400)]',
  '[--arch-cluster:var(--color-zinc-100)]',
  '[--arch-cluster-border:var(--color-zinc-200)]',
  '[--arch-muted:var(--color-zinc-500)]',
  '[--arch-accent-bg:var(--color-sky-50)]',
  '[--arch-accent:var(--color-sky-400)]',
  '[--arch-accent-text:var(--color-sky-900)]',
  'dark:[--arch-node:var(--color-zinc-900)]',
  'dark:[--arch-border:var(--color-zinc-700)]',
  'dark:[--arch-text:var(--color-zinc-200)]',
  'dark:[--arch-line:var(--color-zinc-600)]',
  'dark:[--arch-cluster:var(--color-zinc-950)]',
  'dark:[--arch-cluster-border:var(--color-zinc-800)]',
  'dark:[--arch-muted:var(--color-zinc-400)]',
  'dark:[--arch-accent-bg:var(--color-sky-950)]',
  'dark:[--arch-accent:var(--color-sky-600)]',
  'dark:[--arch-accent-text:var(--color-sky-100)]',
].join(' ')

export default function PortalPage() {
  return (
    <main className="mt-10 space-y-10">
      <Link
        href="/projects"
        className="prose-link block w-fit font-mono text-sm text-zinc-600 dark:text-zinc-400"
      >
        ← All projects
      </Link>

      <header className="space-y-3">
        <p className="font-mono text-xs tracking-wide text-zinc-500 dark:text-zinc-400">
          HKU Hackathon · Fall 2026
        </p>
        <h1 className="font-serif text-3xl text-zinc-900 dark:text-zinc-100">
          Portal
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Draw a trip on a globe with your friends, and Portal works out how
          everyone gets there.
        </p>
        <p className="font-mono text-sm">
          <a
            href="https://github.com/stanley-910/portal"
            target="_blank"
            rel="noopener noreferrer"
            className="prose-link text-zinc-600 dark:text-zinc-400"
          >
            Source on GitHub ↗
          </a>
        </p>
      </header>

      <figure className="space-y-2">
        <img
          src="/images/projects/portal-party-light.jpg"
          alt="Four friends planning a trip from Hong Kong, Seoul and Taipei to Shanghai, Tokyo and Osaka, with their live cursors on a shared globe."
          className="w-full rounded-xl ring-1 ring-zinc-200 dark:hidden"
        />
        <img
          src="/images/projects/portal-party-dark.jpg"
          alt="Four friends planning a trip from Hong Kong, Seoul and Taipei to Shanghai, Tokyo and Osaka, with their live cursors on a shared globe."
          className="hidden w-full rounded-xl ring-1 ring-zinc-800 dark:block"
        />
        <figcaption className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
          Mei, Ada, Joon and Sam in one trip: two take the train from Hong Kong,
          one flies in from Seoul, one from Taipei.
        </figcaption>
      </figure>

      <section className="space-y-4 text-zinc-700 dark:text-zinc-300">
        <h2 className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
          What it does
        </h2>
        <p>
          Click to take off and a paper plane follows your cursor along a
          great-circle route. Each stop starts a new leg; landing searches the
          trains, flights and buses between the nearest real stations and
          airports. Friends join the same trip from wherever they are, and
          Portal suggests where to meet, then splits the cost by who is there
          for each leg and each night.
        </p>
        <p>
          The trip has a shared agent, Pip, that lives in the group chat. Ask it
          to move the meet-up a day later or find somewhere everyone can reach
          cheaply, and it edits the plan for everyone, with an Undo. It can also
          book your own seat, but only after showing you the flights, price and
          card, and hearing a yes.
        </p>
      </section>

      <section className="space-y-4 text-zinc-700 dark:text-zinc-300">
        <h2 className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
          How it fits together
        </h2>
        <figure
          className={`overflow-x-auto rounded-2xl border border-zinc-200/70 bg-zinc-50/40 p-4 dark:border-zinc-800/70 dark:bg-zinc-950/40 [&_svg]:mx-auto [&_svg]:h-auto ${ARCH_THEME}`}
          aria-label="Portal's architecture: friends use a WebGL2 globe in a Next.js app, which shares a Liveblocks room with Pip, searches routes across Duffel, Travelpayouts and rail and bus feeds, and books through Duffel and Stripe, with accounts in Supabase."
          dangerouslySetInnerHTML={{ __html: ARCHITECTURE }}
        />
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-medium">The globe</strong> is a custom
            WebGL2 renderer: the camera, picking, routes and paper-atlas shading
            are written by hand rather than through a map library.
          </li>
          <li>
            <strong className="font-medium">The room</strong> is the trip. The
            plan, everyone’s cursors and the chat live in one Liveblocks room,
            and its URL is the invite.
          </li>
          <li>
            <strong className="font-medium">Search</strong> fans out to every
            provider that covers the leg and ranks what comes back. Anything
            that isn’t a live fare says so with an estimated badge, and every
            provider has a fallback, so a slow API never empties the list.
          </li>
          <li>
            <strong className="font-medium">Booking</strong> settles the group
            on one fare, then each rider holds their own share on their card.
            Nobody is charged until every seat is held.
          </li>
        </ul>
      </section>
    </main>
  )
}
