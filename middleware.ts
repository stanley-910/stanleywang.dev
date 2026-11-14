import { NextResponse, type NextRequest } from 'next/server'

import { SESSION_COOKIE, verifySession } from '@/lib/digest/session'

// Only /digest is private. Pages check the session again on the server (lib/digest/auth.ts),
// so this is the first gate, not the only one.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname === '/digest/login') return NextResponse.next()
  if (await verifySession(req.cookies.get(SESSION_COOKIE)?.value))
    return NextResponse.next()
  const login = new URL('/digest/login', req.url)
  if (pathname !== '/digest') login.searchParams.set('next', pathname)
  return NextResponse.redirect(login)
}

export const config = { matcher: ['/digest', '/digest/:path*'] }
