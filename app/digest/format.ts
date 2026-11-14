const TZ = process.env.DIGEST_TZ || 'UTC'

const dayKeyFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const dayFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})
const timeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour: 'numeric',
  minute: '2-digit',
})

/** The calendar day in the digest's time zone, e.g. "2026-11-14". */
export function dayKey(iso: string | Date): string {
  return dayKeyFmt.format(new Date(iso))
}

/** "Today", "Yesterday" or "Sat, Nov 14". */
export function day(iso: string | Date, now = new Date()): string {
  const key = dayKey(iso)
  if (key === dayKey(now)) return 'Today'
  if (key === dayKey(new Date(now.getTime() - 86_400_000))) return 'Yesterday'
  return dayFmt.format(new Date(iso))
}

/** "7:49 PM". */
export function time(iso: string | Date): string {
  return timeFmt.format(new Date(iso))
}

/** "Today, 7:49 PM". */
export function when(iso: string | Date): string {
  return `${day(iso)}, ${time(iso)}`
}

/** "jobs" → "Jobs", "price-drops" → "Price drops". */
export function feedName(feed: string): string {
  const s = feed.replace(/-/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}
