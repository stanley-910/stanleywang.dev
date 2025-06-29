import {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REFRESH_TOKEN,
} from './constants'

const basic = Buffer.from(
  `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`,
).toString('base64')

const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'
const NOW_PLAYING_ENDPOINT =
  'https://api.spotify.com/v1/me/player/currently-playing'
const TOP_TRACKS_ENDPOINT = 'https://api.spotify.com/v1/me/top/tracks'
const RECENTLY_PLAYED_ENDPOINT =
  'https://api.spotify.com/v1/me/player/recently-played'

/**
 * Get a new access token using the refresh token
 */
export const getAccessToken = async () => {
  try {
    console.log('Attempting to get access token...')
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: SPOTIFY_REFRESH_TOKEN,
      }),
    })

    if (!response.ok) {
      console.error('Failed to get access token:', {
        status: response.status,
        statusText: response.statusText,
      })
      // Log the raw response text for debugging
      const rawText = await response.text()
      console.error('Raw error response:', rawText)
      try {
        const errorData = JSON.parse(rawText)
        console.error('Error details:', errorData)
      } catch (parseError) {
        console.error('Could not parse error response as JSON:', parseError)
      }
      throw new Error('Failed to get access token')
    }

    // First get the raw text
    const rawText = await response.text()
    console.log('Raw token response:', rawText)
    
    // Then try to parse it
    let data
    try {
      data = JSON.parse(rawText)
    } catch (parseError) {
      console.error('Failed to parse access token response:', parseError)
      throw new Error('Invalid JSON in access token response')
    }

    console.log('Successfully obtained access token')
    return data
  } catch (error) {
    console.error('Error in getAccessToken:', error)
    throw error
  }
}

/**
 * Make an authenticated request to Spotify API
 */
export const spotifyFetch = async (endpoint: string) => {
  try {
    const { access_token } = await getAccessToken()
    console.log('Making authenticated request to:', endpoint)

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    })

    console.log('Spotify API response status:', response.status)
    return response
  } catch (error) {
    console.error('Error in spotifyFetch:', error)
    throw error
  }
}

/**
 * Get the user's currently playing track
 */
export const getNowPlaying = async () => {
  try {
    const response = await spotifyFetch(NOW_PLAYING_ENDPOINT)
    console.log('Now Playing response status:', response.status)

    if (response.status === 204) {
      console.log('No track currently playing')
      return null
    }

    if (response.status > 400) {
      console.error('Error response from Spotify:', {
        status: response.status,
        statusText: response.statusText,
      })
      // Log the raw response text for debugging
      const rawText = await response.text()
      console.error('Raw error response:', rawText)
      try {
        const errorData = JSON.parse(rawText)
        console.error('Error details:', errorData)
      } catch (parseError) {
        console.error('Could not parse error response as JSON:', parseError)
      }
      return null
    }

    // First get the raw text
    const rawText = await response.text()
    console.log('Raw now playing response:', rawText)
    
    // Then try to parse it
    let song
    try {
      song = JSON.parse(rawText)
    } catch (parseError) {
      console.error('Failed to parse now playing response:', parseError)
      return null
    }

    console.log('Successfully fetched now playing data')
    return song
  } catch (error) {
    console.error('Error in getNowPlaying:', error)
    return null
  }
}

/**
 * Get the user's top tracks
 */
export const getTopTracks = async () => {
  const response = await spotifyFetch(TOP_TRACKS_ENDPOINT)

  if (response.status === 204 || response.status > 400) {
    return []
  }

  const { items } = await response.json()
  return items
}

/**
 * Get the user's recently played tracks
 */
export const getRecentlyPlayed = async () => {
  const response = await spotifyFetch(RECENTLY_PLAYED_ENDPOINT)

  if (response.status === 204 || response.status > 400) {
    return []
  }

  const { items } = await response.json()
  return items
}
