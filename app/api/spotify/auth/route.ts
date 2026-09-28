import { authorizeUrl } from '@/lib/spotify'

// One-time setup helper: run `next dev` locally and open this route to
// authorize the app. It does not exist in production.
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return new Response(null, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  return new Response(null, {
    status: 307,
    headers: { Location: authorizeUrl(), 'Cache-Control': 'no-store' },
  })
}
