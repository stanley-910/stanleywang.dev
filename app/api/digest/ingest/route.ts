import { NextResponse } from 'next/server'

import { safeEqual } from '@/lib/digest/session'
import { saveRun } from '@/lib/digest/store'
import { parseRun } from '@/lib/digest/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 512 * 1024

// DIGEST_INGEST_KEYS="mac:<key>,devbox:<key>": one key per producer machine, so one can be
// revoked without touching the others. The name is recorded on each run as its source.
function producerFor(auth: string | null): string | null {
  const token = auth?.match(/^Bearer (.+)$/)?.[1]
  if (!token) return null
  let found: string | null = null
  for (const entry of (process.env.DIGEST_INGEST_KEYS ?? '').split(',')) {
    const i = entry.indexOf(':')
    if (i < 1) continue
    const key = entry.slice(i + 1).trim()
    if (key.length >= 32 && safeEqual(key, token))
      found = entry.slice(0, i).trim()
  }
  return found
}

export async function POST(req: Request) {
  const source = producerFor(req.headers.get('authorization'))
  if (!source)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const text = await req.text()
  if (text.length > MAX_BYTES)
    return NextResponse.json({ error: 'payload too large' }, { status: 413 })

  let run
  try {
    run = parseRun(JSON.parse(text), source)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
  await saveRun(run)
  const url = new URL(`/digest/${run.feed}/${run.id}`, req.url).toString()
  return NextResponse.json({ ok: true, feed: run.feed, id: run.id, url })
}
