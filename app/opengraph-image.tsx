import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { ImageResponse } from 'next/og'

import { getContributionCalendar } from '@/lib/github'

import type { ContributionLevel } from '@/lib/github'

// The link preview: name, domain and the last year of GitHub contributions,
// drawn as glyphs. Spec: design/circadian-meadow/components/SocialPreview.

export const alt = 'Stanley Wang, stanleywang.dev'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 86400

// Satori takes no CSS variables, so these are the dark tokens resolved.
const PAGE = '#1b1b19' // page-dark
const INK = '#e4e2da' // ink, dark
const INK_MUTED = '#9d9b94' // ink-muted, dark
const HAIRLINE = '#6a6964' // hairline, dark

const LEVELS: Record<ContributionLevel, { glyph: string; color: string }> = {
  0: { glyph: '·', color: HAIRLINE },
  1: { glyph: ':', color: '#b35a4e' }, // sunset-haze
  2: { glyph: '+', color: '#ff5a36' }, // sunset-poppy
  3: { glyph: '#', color: '#ffb04a' }, // sunset-dandelion
  4: { glyph: '@', color: '#ffd9bf' }, // sunset-fluff
}

const WEEKS = 53
const CELL = { width: 20, height: 26 }
const GUTTER = 64
const GRAPH_TOP = 384

// When GitHub can't be read: grass in the graph's bottom two rows, a fixed
// pattern that can't pass for a year of data. Each row is 53 cells.
const TUFTS = [
  '  \\ | /        \\ | /       \\ | /        \\ | /        ',
  '   \\|/   \\|/    \\|/  \\|/    \\|/   \\|/    \\|/   \\|/   ',
]

type Glyph = { glyph: string; color: string } | null

function font(file: string) {
  return readFile(join(process.cwd(), 'public/fonts/geist', file))
}

function Cell({ glyph }: { glyph: Glyph }) {
  return (
    <div
      style={{
        display: 'flex',
        width: CELL.width,
        height: CELL.height,
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Geist Mono',
        fontWeight: 500,
        fontSize: 20,
        lineHeight: `${CELL.height}px`,
        color: glyph?.color,
      }}
    >
      {glyph?.glyph}
    </div>
  )
}

// Columns of cells, left to right, at the graph's top left.
function Columns({ columns, top }: { columns: Glyph[][]; top: number }) {
  return (
    <div
      style={{
        display: 'flex',
        position: 'absolute',
        left: GUTTER,
        top,
      }}
    >
      {columns.map((column, x) => (
        <div key={x} style={{ display: 'flex', flexDirection: 'column' }}>
          {column.map((glyph, y) => (
            <Cell key={y} glyph={glyph} />
          ))}
        </div>
      ))}
    </div>
  )
}

function tuftColumns(): Glyph[][] {
  return Array.from({ length: WEEKS }, (_, x) =>
    TUFTS.map((row) => {
      const char = row[x]
      if (char === '|') return { glyph: char, color: INK_MUTED }
      if (char === '\\' || char === '/') return { glyph: char, color: HAIRLINE }
      return null
    }),
  )
}

export default async function Image() {
  const [calendar, geistMedium, monoRegular, monoMedium] = await Promise.all([
    getContributionCalendar(),
    font('Geist-Medium.ttf'),
    font('GeistMono-Regular.ttf'),
    font('GeistMono-Medium.ttf'),
  ])

  const graph = calendar ? (
    <Columns
      top={GRAPH_TOP}
      columns={calendar.weeks
        .slice(-WEEKS)
        .map((week) =>
          week.map((level) => (level === null ? null : LEVELS[level])),
        )}
    />
  ) : (
    <Columns top={GRAPH_TOP + 5 * CELL.height} columns={tuftColumns()} />
  )

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          position: 'relative',
          width: '100%',
          height: '100%',
          background: PAGE,
        }}
      >
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            left: GUTTER,
            top: 64,
            fontFamily: 'Geist',
            fontWeight: 500,
            fontSize: 56,
            lineHeight: '64px',
            color: INK,
          }}
        >
          Stanley Wang
        </div>
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            left: GUTTER,
            top: 136,
            fontFamily: 'Geist Mono',
            fontWeight: 400,
            fontSize: 30,
            lineHeight: '36px',
            color: INK_MUTED,
          }}
        >
          stanleywang.dev
        </div>
        {graph}
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Geist', data: geistMedium, weight: 500, style: 'normal' },
        { name: 'Geist Mono', data: monoRegular, weight: 400, style: 'normal' },
        { name: 'Geist Mono', data: monoMedium, weight: 500, style: 'normal' },
      ],
    },
  )
}
