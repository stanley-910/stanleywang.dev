import { NextResponse } from 'next/server'

import { getNowPlaying, type NowPlayingResult } from '@/lib/spotify'

export const dynamic = 'force-dynamic'

const FRESH_CACHE_CONTROL =
  'public, max-age=0, s-maxage=30, stale-while-revalidate=120'

// Fresh snapshots get the full CDN policy. A stale fallback may be cached only
// for what's left of its lifetime (at most 30s), and the error payload not at
// all.
function cacheControl({ fresh, remainingMs }: NowPlayingResult) {
  if (fresh) return FRESH_CACHE_CONTROL
  const seconds = Math.min(Math.floor(remainingMs / 1000), 30)
  return seconds > 0 ? `public, max-age=0, s-maxage=${seconds}` : 'no-store'
}

export async function GET() {
  const result = await getNowPlaying()
  return NextResponse.json(result.data, {
    headers: { 'Cache-Control': cacheControl(result) },
  })
}
