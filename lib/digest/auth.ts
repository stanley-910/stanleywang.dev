import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { SESSION_COOKIE, verifySession } from './session'

/** Server-side gate for /digest pages, independent of middleware. */
export async function requireSession(next = '/digest'): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!(await verifySession(token))) {
    redirect(
      next === '/digest'
        ? '/digest/login'
        : `/digest/login?next=${encodeURIComponent(next)}`,
    )
  }
}
