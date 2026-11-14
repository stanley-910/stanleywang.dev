import { cookies } from 'next/headers'

import { SESSION_COOKIE, verifySession } from '@/lib/digest/session'
import { contentTypeFor, getFile } from '@/lib/digest/store'
import { FILE_NAME, SLUG } from '@/lib/digest/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// A run's uploaded file, for a signed-in viewer only. PDFs open in the browser; anything
// else downloads.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ feed: string; run: string; name: string }> },
) {
  const { feed, run, name } = await params
  if (!(await verifySession((await cookies()).get(SESSION_COOKIE)?.value)))
    return Response.redirect(new URL('/digest/login', req.url), 303)
  if (!SLUG.test(feed) || !SLUG.test(run) || !FILE_NAME.test(name))
    return new Response('Not found', { status: 404 })

  const stream = await getFile(feed, run, name)
  if (!stream) return new Response('Not found', { status: 404 })
  const type = contentTypeFor(name)
  return new Response(stream, {
    headers: {
      'Content-Type': type,
      'Content-Disposition': `${type === 'application/pdf' ? 'inline' : 'attachment'}; filename="${name}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
