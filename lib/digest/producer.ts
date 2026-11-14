import { safeEqual } from './session'

// DIGEST_INGEST_KEYS="mac:<key>,devbox:<key>": one key per producer machine, so one can be
// revoked without touching the others. Returns the matching producer's name, or null.
export function producerFor(auth: string | null): string | null {
  const token = auth?.match(/^Bearer (.+)$/)?.[1]
  if (!token) return null
  let found: string | null = null
  for (const entry of (process.env.DIGEST_INGEST_KEYS ?? '').split(',')) {
    const i = entry.indexOf(':')
    if (i < 1) continue
    const key = entry.slice(i + 1).trim()
    if (key.length >= 32 && safeEqual(key, token))
      found = entry.slice(0, i).trim()
  }
  return found
}
