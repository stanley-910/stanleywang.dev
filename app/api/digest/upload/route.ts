import { NextResponse } from 'next/server'

import { producerFor } from '@/lib/digest/producer'
import { saveFile } from '@/lib/digest/store'
import { FILE_NAME, SLUG } from '@/lib/digest/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 3 * 1024 * 1024

// POST /api/digest/upload?feed=jobs&run=2026-11-14-0807&name=stripe-resume.pdf, raw body.
// Upload a run's files first, then post the run with items[].files naming them.
export async function POST(req: Request) {
  if (!producerFor(req.headers.get('authorization')))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const q = new URL(req.url).searchParams
  const feed = q.get('feed') ?? ''
  const run = q.get('run') ?? ''
  const name = q.get('name') ?? ''
  if (!SLUG.test(feed) || !SLUG.test(run) || !FILE_NAME.test(name))
    return NextResponse.json(
      { error: 'feed, run and name must be lowercase slugs' },
      { status: 400 },
    )

  const body = Buffer.from(await req.arrayBuffer())
  if (body.length === 0)
    return NextResponse.json({ error: 'empty body' }, { status: 400 })
  if (body.length > MAX_BYTES)
    return NextResponse.json({ error: 'file too large' }, { status: 413 })

  await saveFile(feed, run, name, body)
  return NextResponse.json({ ok: true, name })
}
