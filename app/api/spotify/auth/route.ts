import { NextResponse } from 'next/server'

import { SPOTIFY_AUTH_URL, SPOTIFY_REDIRECT_URI } from '@/lib/constants'

export async function GET() {
  // Log the redirect URI for debugging
  console.log('Using Redirect URI:', SPOTIFY_REDIRECT_URI)
  console.log('Full Auth URL:', SPOTIFY_AUTH_URL)
  
  return NextResponse.redirect(SPOTIFY_AUTH_URL)
}
