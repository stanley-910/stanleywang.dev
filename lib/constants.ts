export const WEBSITE_URL = 'https://stanleywang.dev'

// Spotify Configuration
export const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || ''
export const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || ''
export const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN || ''

// Use environment variable if set, otherwise fall back to computed value
const isDevelopment = process.env.NODE_ENV === 'development'
export const SPOTIFY_REDIRECT_URI = isDevelopment
  ? 'http://127.0.0.1:3000/api/spotify/callback'
  : process.env.SPOTIFY_REDIRECT_URI

export const SPOTIFY_SCOPES = [
  'user-read-currently-playing',
  'user-read-recently-played',
  'user-read-playback-state',
  'user-top-read',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ')

export const SPOTIFY_AUTH_URL = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&scope=${encodeURIComponent(SPOTIFY_SCOPES)}`
