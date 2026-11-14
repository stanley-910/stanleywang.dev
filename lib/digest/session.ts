// Signed session cookie for /digest. Web Crypto only, so middleware (edge) and
// route handlers (node) share it. Token: v1.<expiry ms>.<HMAC-SHA256 of "v1.<expiry>">.

export const SESSION_COOKIE = 'digest_session'
export const SESSION_DAYS = 90

const enc = new TextEncoder()

function secret(): string {
  const s = process.env.DIGEST_SESSION_SECRET
  if (!s || s.length < 32)
    throw new Error('DIGEST_SESSION_SECRET is missing or shorter than 32 chars')
  return s
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, enc.encode(data)),
  )
  return btoa(String.fromCharCode(...sig))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function createSession(now = Date.now()): Promise<string> {
  const payload = `v1.${now + SESSION_DAYS * 864e5}`
  return `${payload}.${await hmac(payload)}`
}

export async function verifySession(
  token: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== 'v1') return false
  const exp = Number(parts[1])
  if (!Number.isFinite(exp) || exp < now) return false
  try {
    return safeEqual(parts[2], await hmac(`${parts[0]}.${parts[1]}`))
  } catch {
    return false
  }
}

/** Only same-site /digest paths are allowed as a post-login destination. */
export function safeNext(next: unknown): string {
  return typeof next === 'string' && /^\/digest(\/[a-z0-9/-]*)?$/.test(next)
    ? next
    : '/digest'
}
