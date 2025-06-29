import { NextResponse } from 'next/server'

import { SPOTIFY_AUTH_URL } from '@/lib/constants'

export async function GET() {
  return NextResponse.redirect(SPOTIFY_AUTH_URL)
}
