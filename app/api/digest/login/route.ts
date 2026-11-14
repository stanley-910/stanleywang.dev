import { createHash, timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import {
  SESSION_COOKIE,
  SESSION_DAYS,
  createSession,
  safeNext,
} from '@/lib/digest/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const digest = (s: string) => createHash('sha256').update(s).digest()

export async function POST(req: Request) {
  const form = await req.formData()
  const next = safeNext(form.get('next'))
  const given = String(form.get('password') ?? '')
  const expected = process.env.DIGEST_PASSWORD

  const ok =
    !!expected &&
    expected.length >= 12 &&
    timingSafeEqual(digest(given), digest(expected))
  if (!ok) {
    await new Promise((r) => setTimeout(r, 800)) // slows guessing; no store needed
    const back = new URL('/digest/login', req.url)
    back.searchParams.set('error', '1')
    if (next !== '/digest') back.searchParams.set('next', next)
    return NextResponse.redirect(back, 303)
  }

  const res = NextResponse.redirect(new URL(next, req.url), 303)
  res.cookies.set(SESSION_COOKIE, await createSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  })
  return res
}
