import Link from 'next/link'

import { requireSession } from '@/lib/digest/auth'
import { getRun, listRuns } from '@/lib/digest/store'

import { day, dayKey, feedName, time } from './format'

import type { DigestRun } from '@/lib/digest/types'

export const dynamic = 'force-dynamic'

const SHOWN = 40

/** Runs arrive newest first; consecutive runs on one calendar day share a heading. */
function byDay(runs: DigestRun[]): { label: string; runs: DigestRun[] }[] {
  const out: { key: string; label: string; runs: DigestRun[] }[] = []
  for (const run of runs) {
    const key = dayKey(run.createdAt)
    const last = out[out.length - 1]
    if (last && last.key === key) last.runs.push(run)
    else out.push({ key, label: day(run.createdAt), runs: [run] })
  }
  return out
}

export default async function DigestIndex() {
  await requireSession()
  const refs = (await listRuns()).slice(0, SHOWN)
  const runs = (
    await Promise.all(refs.map((r) => getRun(r.feed, r.id)))
  ).filter((r) => r !== null)

  return (
    <div className="digest-page">
      <h1 className="digest-title">Digest</h1>
      {runs.length === 0 && <p className="digest-note">Nothing yet.</p>}
      {byDay(runs).map((g) => (
        <section key={g.label} className="digest-section">
          <h2 className="digest-section-title">{g.label}</h2>
          <ol className="digest-ledger">
            {g.runs.map((run) => (
              <li key={`${run.feed}/${run.id}`} className="digest-row">
                <p className="digest-row-meta digest-meta">
                  <span>{feedName(run.feed)}</span>
                  <span>{time(run.createdAt)}</span>
                </p>
                <div className="digest-row-body">
                  <p className="digest-heading">
                    <Link
                      className="link digest-link"
                      href={`/digest/${run.feed}/${run.id}`}
                    >
                      {run.title}
                    </Link>
                  </p>
                  {run.summary && (
                    <p className="digest-note digest-clamp">{run.summary}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
      <footer className="digest-foot">
        <form method="post" action="/api/digest/logout">
          <button className="link-quiet digest-quiet" type="submit">
            sign out
          </button>
        </form>
      </footer>
    </div>
  )
}
