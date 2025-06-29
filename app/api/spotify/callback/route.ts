import { NextResponse } from 'next/server'

import {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI,
} from '@/lib/constants'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.json(
      { error: 'Missing code parameter' },
      { status: 400 },
    )
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`,
      ).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
    }),
  })

  const data = await response.json()

  if (data.error) {
    return NextResponse.json(data, { status: 400 })
  }

  // Return the refresh token - you'll need to save this somewhere secure
  return NextResponse.json({
    refresh_token: data.refresh_token,
    message:
      'Save this refresh token in your environment variables as SPOTIFY_REFRESH_TOKEN',
  })
}
