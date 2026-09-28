import 'server-only'

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || ''
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || ''
const REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN || ''

// The setup routes only run in development, on the loopback address.
const REDIRECT_URI = 'http://127.0.0.1:3000/api/spotify/callback'
const SCOPES = 'user-read-currently-playing'

const AUTHORIZE_ENDPOINT = 'https://accounts.spotify.com/authorize'
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'
const NOW_PLAYING_ENDPOINT =
  'https://api.spotify.com/v1/me/player/currently-playing'

const UPSTREAM_TIMEOUT_MS = 5000
// Refresh the access token this long before Spotify says it expires.
const TOKEN_EXPIRY_MARGIN_MS = 60_000
// How long a snapshot is served before Spotify is asked again.
const SNAPSHOT_TTL_MS = 30_000
// Upper bound on how long a Retry-After can hold off requests.
const MAX_RETRY_AFTER_MS = 10 * 60_000
// While Spotify is failing, the last good snapshot is served for this long.
const MAX_STALE_MS = 10 * 60_000

export type NowPlaying =
  | { isPlaying: false; error?: string }
  | {
      isPlaying: boolean
      title: string
      artist: string
      album: string
      albumImageUrl: string
      songUrl: string
    }

export type NowPlayingResult = {
  data: NowPlaying
  /** From a successful request less than SNAPSHOT_TTL_MS ago. */
  fresh: boolean
  /** How much longer this data may be served; 0 for the error payload. */
  remainingMs: number
}

const NOT_PLAYING: NowPlaying = { isPlaying: false }
const UNAVAILABLE: NowPlaying = { isPlaying: false, error: 'unavailable' }

/** An upstream failure, described by an HTTP status or a short fixed code. */
class SpotifyError extends Error {
  readonly code: number | string
  readonly retryAfterMs?: number

  constructor(code: number | string, retryAfterMs?: number) {
    super(`spotify: ${code}`)
    this.code = code
    this.retryAfterMs = retryAfterMs
  }
}

/** Retry-After as delta-seconds or an HTTP-date (RFC 9110); 0 if unusable. */
function retryAfterMs(value: string | null) {
  const trimmed = value?.trim() ?? ''
  const ms = /^\d+$/.test(trimmed)
    ? Number(trimmed) * 1000
    : Date.parse(trimmed) - Date.now()
  return Number.isFinite(ms) && ms > 0 ? Math.min(ms, MAX_RETRY_AFTER_MS) : 0
}

function failure(response: Response) {
  return response.status === 429
    ? new SpotifyError(429, retryAfterMs(response.headers.get('Retry-After')))
    : new SpotifyError(response.status)
}

/** The body as JSON; a timeout while reading stays a timeout. */
async function readJson(response: Response, code: string): Promise<unknown> {
  try {
    return await response.json()
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') throw error
    throw new SpotifyError(code)
  }
}

function basicAuth() {
  return `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`
}

function upstreamFailure(error: unknown): number | string {
  if (error instanceof SpotifyError) return error.code
  if (error instanceof Error && error.name === 'TimeoutError') return 'timeout'
  return 'network'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function postToken(body: URLSearchParams) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: basicAuth(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  })
  if (!response.ok) throw failure(response)
  const data = await readJson(response, 'bad-token')
  if (!isRecord(data)) throw new SpotifyError('bad-token')
  return data
}

// Setup flow (development only)

export function authorizeUrl() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
  })
  return `${AUTHORIZE_ENDPOINT}?${params}`
}

/** Exchanges an authorization code for a refresh token, or returns null. */
export async function exchangeCode(code: string): Promise<string | null> {
  try {
    const data = await postToken(
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    )
    return typeof data.refresh_token === 'string' ? data.refresh_token : null
  } catch (error) {
    console.error('spotify: code exchange failed', upstreamFailure(error))
    return null
  }
}

// Access token, cached privately in this instance

let accessToken: { value: string; expiresAt: number } | null = null
let tokenRequest: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const data = await postToken(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: REFRESH_TOKEN,
    }),
  )
  const { access_token: value, expires_in: expiresIn } = data
  if (typeof value !== 'string' || typeof expiresIn !== 'number') {
    throw new SpotifyError('bad-token')
  }
  accessToken = {
    value,
    expiresAt: Date.now() + expiresIn * 1000 - TOKEN_EXPIRY_MARGIN_MS,
  }
  return value
}

function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < accessToken.expiresAt) {
    return Promise.resolve(accessToken.value)
  }
  tokenRequest ??= refreshAccessToken().finally(() => {
    tokenRequest = null
  })
  return tokenRequest
}

// Now-playing snapshot, shared by concurrent requests

let snapshot: { data: NowPlaying; at: number } | null = null
let nextFetchAt = 0
let snapshotRequest: Promise<NowPlayingResult> | null = null

function current(): NowPlayingResult {
  const age = snapshot ? Date.now() - snapshot.at : Infinity
  if (!snapshot || age >= MAX_STALE_MS) {
    return { data: UNAVAILABLE, fresh: false, remainingMs: 0 }
  }
  return {
    data: snapshot.data,
    fresh: age < SNAPSHOT_TTL_MS,
    remainingMs: MAX_STALE_MS - age,
  }
}

/**
 * Nothing playing (no item, or a podcast/ad rather than a track), a track, or
 * null when the payload isn't what Spotify documents.
 */
function toNowPlaying(body: unknown): NowPlaying | null {
  if (!isRecord(body) || typeof body.is_playing !== 'boolean') return null
  const { item } = body
  if (item === null || item === undefined) return NOT_PLAYING
  if (!isRecord(item)) return null
  if (item.type !== undefined && item.type !== 'track') return NOT_PLAYING
  const { artists, album, external_urls: urls } = item
  if (
    typeof item.name !== 'string' ||
    !Array.isArray(artists) ||
    !isRecord(album) ||
    typeof album.name !== 'string'
  ) {
    return null
  }
  const names = artists
    .map((artist) => (isRecord(artist) ? artist.name : undefined))
    .filter((name): name is string => typeof name === 'string')
  const image = Array.isArray(album.images) ? album.images[0] : undefined
  return {
    isPlaying: body.is_playing,
    title: item.name,
    artist: names.join(', '),
    album: album.name,
    albumImageUrl:
      isRecord(image) && typeof image.url === 'string' ? image.url : '',
    songUrl:
      isRecord(urls) && typeof urls.spotify === 'string' ? urls.spotify : '',
  }
}

async function fetchNowPlaying(): Promise<NowPlayingResult> {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
      throw new SpotifyError('not-configured')
    }
    const token = await getAccessToken()
    const response = await fetch(NOW_PLAYING_ENDPOINT, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
    if (response.status === 401) accessToken = null
    if (response.status !== 204 && !response.ok) throw failure(response)

    const data =
      response.status === 204
        ? NOT_PLAYING
        : toNowPlaying(await readJson(response, 'bad-json'))
    if (!data) throw new SpotifyError('bad-payload')
    snapshot = { data, at: Date.now() }
    nextFetchAt = Date.now() + SNAPSHOT_TTL_MS
  } catch (error) {
    console.error('spotify: now-playing failed', upstreamFailure(error))
    const wait = error instanceof SpotifyError ? error.retryAfterMs : undefined
    nextFetchAt = Date.now() + Math.max(wait ?? 0, SNAPSHOT_TTL_MS)
  }
  return current()
}

/**
 * The listener's current track. Spotify is asked at most once per
 * SNAPSHOT_TTL_MS per instance, and not before a Retry-After has passed;
 * concurrent callers share one request. While Spotify is failing, the last
 * good snapshot is served, marked stale, for up to MAX_STALE_MS.
 */
export function getNowPlaying(): Promise<NowPlayingResult> {
  if (Date.now() < nextFetchAt) return Promise.resolve(current())
  snapshotRequest ??= fetchNowPlaying().finally(() => {
    snapshotRequest = null
  })
  return snapshotRequest
}
