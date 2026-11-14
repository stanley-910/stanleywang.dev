import { NextResponse } from 'next/server'

import { producerFor } from '@/lib/digest/producer'
import { saveRun } from '@/lib/digest/store'
import { parseRun } from '@/lib/digest/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 1024 * 1024

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
