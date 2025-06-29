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

  return response.json()
}

/**
 * Make an authenticated request to Spotify API
 */
export const spotifyFetch = async (endpoint: string) => {
  const { access_token } = await getAccessToken()

  return fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  })
}

/**
 * Get the user's currently playing track
 */
export const getNowPlaying = async () => {
  const response = await spotifyFetch(NOW_PLAYING_ENDPOINT)

  if (response.status === 204 || response.status > 400) {
    return null
  }

  const song = await response.json()
  return song
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
