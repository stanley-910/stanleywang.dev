import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requireSession } from '@/lib/digest/auth'
import { getRun } from '@/lib/digest/store'
import { factRows, type DigestItem } from '@/lib/digest/types'

import { CopyButton } from './copy-button'
import { FactIcon } from './fact-icon'
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

function Item({ item, base }: { item: DigestItem; base: string }) {
  const mark =
    !item.section && item.mark && SHOWN_MARKS.has(item.mark)
      ? item.mark
      : undefined
  const rows = factRows(item)
  return (
    <li className="digest-item" data-mark={item.mark}>
      <div className="digest-item-head">
        {(item.subtitle || mark) && (
          <p className="digest-item-who">
            {item.subtitle && (
              <span className="digest-name">{item.subtitle}</span>
            )}
            {mark && <span className="digest-meta digest-mark">{mark}</span>}
          </p>
        )}
        <p className="digest-heading">
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
            item.title
          )}
        </p>
        {rows.length > 0 && (
          <div className="digest-fact-rows">
            {rows.map((row, r) => (
              <ul
                key={r}
                className="digest-facts"
                data-icons={row.some((f) => f.icon) ? '' : undefined}
              >
                {row.map((f, k) => (
                  <li key={k} data-strong={f.strong ? '' : undefined}>
                    {f.icon && <FactIcon kind={f.icon} />}
                    <span>{f.text}</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        )}
      </div>
      {item.points && item.points.length > 0 && (
        <dl className="digest-points">
          {item.points.map((pt) => (
            <div key={pt.label}>
              <dt>{pt.label}</dt>
              <dd>{pt.text}</dd>
            </div>
          ))}
        </dl>
      )}
      {item.note && (
        <div className="digest-notes">
          {item.note.split('\n').map((para, k) => (
            <p key={k} className="digest-note">
              {para}
            </p>
          ))}
        </div>
      )}
      {item.details?.map((d) => (
        <details key={d.label} className="digest-details">
          <summary>{d.label}</summary>
          <ul>
            {d.lines.map((l, k) => (
              <li key={k}>{l}</li>
            ))}
          </ul>
        </details>
      ))}
      {(item.copy || (item.files && item.files.length > 0)) && (
        <div className="digest-actions">
          {item.files?.map((f) => (
            <a
              key={f.name}
              className="digest-action"
              href={`${base}/${f.name}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {f.label}
            </a>
          ))}
          {item.copy && <CopyButton text={item.copy} />}
        </div>
      )}
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
              <Item
                key={j}
                item={it}
                base={`/digest/files/${run.feed}/${run.id}`}
              />
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
