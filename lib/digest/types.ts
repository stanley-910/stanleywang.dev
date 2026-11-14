// A digest is a private inbox of runs posted by scripts (job alerts, price drops, …).
// Producers POST one Run to /api/digest/ingest; the pages render any feed the same way.

export type Mark = 'good' | 'maybe' | 'info' | 'alert'

export interface DigestItem {
  title: string
  /** Who or what it's about, e.g. the company or the store. */
  subtitle?: string
  mark?: Mark
  /** Short facts. One row: ["$130k-180k", "NYC, SF"]. Several rows, one line each:
   *  [["$130k-180k", "NYC, SF"], ["Fall 2026 to Summer 2027", "posted 3d ago", "rolling"]]. */
  facts?: string[] | string[][]
  note?: string
  url?: string
  /** Groups consecutive items under a heading, e.g. "Good fits" / "Maybes". */
  section?: string
}

export interface DigestRun {
  feed: string
  id: string
  title: string
  summary?: string
  items: DigestItem[]
  createdAt: string
  /** Which producer key posted it, e.g. "mac". Set by the server. */
  source: string
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/
const MARKS: Mark[] = ['good', 'maybe', 'info', 'alert']
const MAX_ITEMS = 300

function str(v: unknown, max: number, field: string): string {
  if (typeof v !== 'string' || !v.trim())
    throw new Error(`${field} must be a non-empty string`)
  return v.trim().slice(0, max)
}

function optStr(v: unknown, max: number, field: string): string | undefined {
  if (v === undefined || v === null || v === '') return undefined
  return str(v, max, field)
}

function httpUrl(v: unknown, field: string): string | undefined {
  const s = optStr(v, 2000, field)
  if (!s) return undefined
  const u = new URL(s)
  if (u.protocol !== 'https:' && u.protocol !== 'http:')
    throw new Error(`${field} must be http(s)`)
  return u.toString()
}

function parseFacts(facts: unknown[], field: string): string[] | string[][] {
  const row = (r: unknown[], f: string) =>
    r.slice(0, 8).map((x, j) => str(x, 120, `${f}[${j}]`))
  if (facts.every((r) => Array.isArray(r)))
    return (facts as unknown[][])
      .slice(0, 4)
      .map((r, k) => row(r, `${field}[${k}]`))
  return row(facts, field)
}

/** Fact rows, whether the item was posted with one row or several. */
export function factRows(item: DigestItem): string[][] {
  const f = item.facts
  if (!f || f.length === 0) return []
  const rows = (Array.isArray(f[0]) ? f : [f]) as string[][]
  return rows.filter((r) => r.length > 0)
}

/** Validates a producer payload. Throws with a message safe to return to the producer. */
export function parseRun(
  body: unknown,
  source: string,
  now = new Date(),
): DigestRun {
  if (!body || typeof body !== 'object')
    throw new Error('body must be a JSON object')
  const b = body as Record<string, unknown>
  const feed = str(b.feed, 64, 'feed').toLowerCase()
  if (!SLUG.test(feed)) throw new Error('feed must be a lowercase slug')
  const id =
    b.id === undefined
      ? now.toISOString().slice(0, 16).replace(/[:T]/g, '-')
      : str(b.id, 64, 'id').toLowerCase()
  if (!SLUG.test(id)) throw new Error('id must be a lowercase slug')
  if (!Array.isArray(b.items)) throw new Error('items must be an array')
  if (b.items.length > MAX_ITEMS) throw new Error(`at most ${MAX_ITEMS} items`)
  const items = b.items.map((raw, i): DigestItem => {
    if (!raw || typeof raw !== 'object')
      throw new Error(`items[${i}] must be an object`)
    const it = raw as Record<string, unknown>
    const mark = it.mark === undefined ? undefined : (it.mark as Mark)
    if (mark !== undefined && !MARKS.includes(mark))
      throw new Error(`items[${i}].mark must be one of ${MARKS.join(', ')}`)
    const facts = it.facts === undefined ? undefined : it.facts
    if (facts !== undefined && !Array.isArray(facts))
      throw new Error(`items[${i}].facts must be an array`)
    return {
      title: str(it.title, 300, `items[${i}].title`),
      subtitle: optStr(it.subtitle, 120, `items[${i}].subtitle`),
      mark,
      facts: facts && parseFacts(facts, `items[${i}].facts`),
      note: optStr(it.note, 1000, `items[${i}].note`),
      url: httpUrl(it.url, `items[${i}].url`),
      section: optStr(it.section, 60, `items[${i}].section`),
    }
  })
  return {
    feed,
    id,
    title: str(b.title, 200, 'title'),
    summary: optStr(b.summary, 2000, 'summary'),
    items,
    createdAt: now.toISOString(),
    source,
  }
}
