import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requireSession } from '@/lib/digest/auth'
import { getRun } from '@/lib/digest/store'
import { factRows, type DigestItem } from '@/lib/digest/types'

import { SectionTabs } from './section-tabs'
import { when } from '../../format'

export const dynamic = 'force-dynamic'

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/

function groups(
  items: DigestItem[],
): { section?: string; items: DigestItem[] }[] {
  const out: { section?: string; items: DigestItem[] }[] = []
  for (const it of items) {
    const last = out[out.length - 1]
    if (last && last.section === it.section) last.items.push(it)
    else out.push({ section: it.section, items: [it] })
  }
  return out
}

/** A mark prints only outside a section: inside one, the heading ("Good fits") already says it. */
const SHOWN_MARKS = new Set(['good', 'maybe', 'alert'])

function Item({ item }: { item: DigestItem }) {
  const mark =
    !item.section && item.mark && SHOWN_MARKS.has(item.mark)
      ? item.mark
      : undefined
  return (
    <li className="digest-row" data-mark={item.mark}>
      {(item.subtitle || mark) && (
        <p className="digest-row-meta">
          {item.subtitle && (
            <span className="digest-name">{item.subtitle}</span>
          )}
          {mark && <span className="digest-meta digest-mark">{mark}</span>}
        </p>
      )}
      <div className="digest-row-body">
        {item.url ? (
          <a
            className="link digest-link"
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {item.title}
          </a>
        ) : (
          <span>{item.title}</span>
        )}
        {factRows(item).length > 0 && (
          <div className="digest-fact-rows">
            {factRows(item).map((row, r) => (
              <ul key={r} className="digest-facts">
                {row.map((f, k) => (
                  <li key={k}>{f}</li>
                ))}
              </ul>
            ))}
          </div>
        )}
        {item.note && <p className="digest-note">{item.note}</p>}
      </div>
    </li>
  )
}

export default async function DigestRunPage({
  params,
}: {
  params: Promise<{ feed: string; run: string }>
}) {
  const { feed, run: id } = await params
  await requireSession(`/digest/${feed}/${id}`)
  if (!SLUG.test(feed) || !SLUG.test(id)) notFound()
  const run = await getRun(feed, id)
  if (!run) notFound()

  return (
    <div className="digest-page">
      <header className="digest-run-head">
        <nav className="link-row digest-crumbs" aria-label="Digest">
          <Link className="link-quiet digest-quiet" href="/digest">
            digest
          </Link>
          <span className="sep" aria-hidden="true">
            /
          </span>
          <span aria-current="page">{run.feed.replace(/-/g, ' ')}</span>
        </nav>
        <h1 className="digest-title">{run.title}</h1>
        <p className="digest-meta">{when(run.createdAt)}</p>
        {run.summary && <p className="digest-note">{run.summary}</p>}
      </header>
      {(() => {
        const gs = groups(run.items)
        const list = (items: DigestItem[]) => (
          <ol className="digest-ledger">
            {items.map((it, j) => (
              <Item key={j} item={it} />
            ))}
          </ol>
        )
        // Two or more named sections read one at a time, as tabs.
        if (gs.length > 1 && gs.every((g) => g.section)) {
          return (
            <SectionTabs
              tabs={gs.map((g) => ({
                label: g.section as string,
                content: list(g.items),
              }))}
            />
          )
        }
        return gs.map((g, i) => (
          <section key={i} className="digest-section">
            {g.section && <h2 className="digest-section-title">{g.section}</h2>}
            {list(g.items)}
          </section>
        ))
      })()}
    </div>
  )
}
