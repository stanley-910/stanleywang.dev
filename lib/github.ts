export const GITHUB_USER = 'stanley-910'

// 0 is no contributions; 1–4 are GitHub's quartiles.
export type ContributionLevel = 0 | 1 | 2 | 3 | 4

export type ContributionCalendar = {
  total: number
  // Columns of seven days, Sunday first, oldest week first. A day outside
  // the year (the first and last weeks are partial) is null.
  weeks: (ContributionLevel | null)[][]
}

// GitHub has no API for the calendar without a token, but the profile's
// public calendar fragment carries every day as a cell:
//   <td data-date="2026-10-24" id="contribution-day-component-6-51" data-level="0" …>
// where the id is the row (weekday) and the column (week).
export async function getContributionCalendar(
  user = GITHUB_USER,
): Promise<ContributionCalendar | null> {
  try {
    // The calendar changes once a day; so does the preview that draws it.
    const res = await fetch(`https://github.com/users/${user}/contributions`, {
      next: { revalidate: 86400 },
    })
    if (!res.ok) {
      console.error(`GitHub contributions for ${user}: HTTP ${res.status}`)
      return null
    }
    const html = await res.text()

    const weeks: (ContributionLevel | null)[][] = []
    for (const [cell] of html.matchAll(
      /<td[^>]*ContributionCalendar-day[^>]*>/g,
    )) {
      const position = cell.match(/contribution-day-component-(\d)-(\d+)/)
      const level = cell.match(/data-level="([0-4])"/)
      if (!position || !level) continue
      const day = Number(position[1])
      const week = Number(position[2])
      weeks[week] ??= Array<ContributionLevel | null>(7).fill(null)
      weeks[week][day] = Number(level[1]) as ContributionLevel
    }

    const total = html.match(/([\d,]+)\s+contributions\s+in the last year/)
    if (weeks.length === 0 || !total) {
      console.error(`GitHub contributions for ${user}: calendar not found`)
      return null
    }
    return {
      total: Number(total[1].replaceAll(',', '')),
      weeks: Array.from(weeks, (w) => w ?? Array(7).fill(null)),
    }
  } catch (error) {
    console.error(`GitHub contributions for ${user}:`, error)
    return null
  }
}
