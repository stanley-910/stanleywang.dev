import { NextResponse } from 'next/server'

import {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REFRESH_TOKEN,
} from '@/lib/constants'
import { getNowPlaying } from '@/lib/spotify'

// Cache store at module level
interface CacheData {
  data: any
  timestamp: number
}

let cache: CacheData | null = null
const CACHE_DURATION = 30000 // 30 seconds in milliseconds

export async function GET() {
  // Log environment info
//   console.log('Spotify credentials check:', {
//     hasClientId: !!SPOTIFY_CLIENT_ID,
//     hasClientSecret: !!SPOTIFY_CLIENT_SECRET,
//     hasRefreshToken: !!SPOTIFY_REFRESH_TOKEN,
//     // Log partial tokens for verification (first 4 chars)
//     clientIdPrefix: SPOTIFY_CLIENT_ID.slice(0, 4),
//     refreshTokenPrefix: SPOTIFY_REFRESH_TOKEN.slice(0, 4),
//   })

  // Check if we have valid cached data
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    // console.log('Returning cached Spotify data')
    return NextResponse.json(cache.data)
  }

  // If no cache or cache expired, fetch new data
  try {
    // console.log('Fetching fresh Spotify data')
    const response = await getNowPlaying()
    // console.log('Spotify response received:', response ? 'has data' : 'null')

    if (!response) {
      const noPlaybackData = { isPlaying: false }
      cache = {
        data: noPlaybackData,
        timestamp: Date.now(),
      }
    //   console.log('No playback data available')
      return NextResponse.json(noPlaybackData)
    }

    const song = {
      isPlaying: response.is_playing,
      title: response.item.name,
      artist: response.item.artists
        .map((_artist: { name: string }) => _artist.name)
        .join(', '),
      album: response.item.album.name,
      albumImageUrl: response.item.album.images[0].url,
      songUrl: response.item.external_urls.spotify,
    }

    // Update cache with new data
    cache = {
      data: song,
      timestamp: Date.now(),
    }

    // console.log('Cached new song data:', song)
    return NextResponse.json(song)
  } catch (error: any) {
    console.error('Error in Now Playing route:', error)

    const errorResponse = {
      isPlaying: false,
      error: 'Failed to fetch now playing data',
    }
    cache = {
      data: errorResponse,
      timestamp: Date.now(),
    }
    return NextResponse.json(errorResponse)
  }
}
