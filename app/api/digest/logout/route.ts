import { NextResponse } from 'next/server'

import { SESSION_COOKIE } from '@/lib/digest/session'

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL('/digest/login', req.url), 303)
  res.cookies.delete(SESSION_COOKIE)
  return res
}
