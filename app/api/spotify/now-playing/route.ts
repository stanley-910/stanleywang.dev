import { NextResponse } from 'next/server'

import { getNowPlaying } from '@/lib/spotify'

export async function GET() {
  const response = await getNowPlaying()

  if (!response) {
    return NextResponse.json({ isPlaying: false })
  }

  const song = {
    isPlaying: response.is_playing,
    title: response.item.name,
    artist: response.item.artists
      .map((_artist: any) => _artist.name)
      .join(', '),
    album: response.item.album.name,
    albumImageUrl: response.item.album.images[0].url,
    songUrl: response.item.external_urls.spotify,
  }

  return NextResponse.json(song)
}
