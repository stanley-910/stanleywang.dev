import { NextResponse } from 'next/server'

import { exchangeCode } from '@/lib/spotify'

const NO_STORE = { 'Cache-Control': 'no-store' }

// Development-only: prints the refresh token to save as SPOTIFY_REFRESH_TOKEN.
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return new Response(null, { status: 404, headers: NO_STORE })
  }

  const code = new URL(request.url).searchParams.get('code')
  const refreshToken =
    code && code.length <= 2048 ? await exchangeCode(code) : null

  if (!refreshToken) {
    return NextResponse.json(
      { error: 'Authorization failed' },
      { status: 400, headers: NO_STORE },
    )
  }

  return NextResponse.json(
    {
      refresh_token: refreshToken,
      message: 'Save this refresh token as SPOTIFY_REFRESH_TOKEN',
    },
    { headers: NO_STORE },
  )
}
