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

// Two far flowers from the garden's MOTIFS (poppy.small, cosmos.small),
// coloured as the garden colours them at sunset. Each char maps to its
// colour; spaces draw nothing.
const POPPY = {
  rows: [' .-. ', '(*@*)'],
  colors: {
    '.': '#ff9e85',
    '-': '#ff9e85',
    '(': '#ff9e85',
    ')': '#ff9e85',
    '*': '#ff7252',
    '@': '#7d1f2a', // sunset-poppy-deep, so the eye shows on the dark page
  } as Record<string, string>,
}
const COSMOS = {
  rows: ['\\|/', '-o-', '/|\\'],
  colors: { o: '#ffb04a' } as Record<string, string>, // sunset-dandelion
  petal: '#f8caba',
}
const STEM = '#9a6c50' // sunset-stem

type Placed = {
  glyph: string
  color: string
  left: number
  top: number
  // A 26px stalk fills its 26px line, so the stalk reads unbroken.
  size: number
}

// A flower's head drawn from its top left cell, and a stalk of `stalk` cells
// from `stalkLeft` down from `stalkTop`.
function flower(
  art: { rows: string[]; colors: Record<string, string>; petal?: string },
  left: number,
  top: number,
  stalkLeft: number,
  stalkTop: number,
  stalk: number,
): Placed[] {
  const head = art.rows.flatMap((row, y) =>
    [...row].flatMap((glyph, x) =>
      glyph === ' '
        ? []
        : [
            {
              glyph,
              color: art.colors[glyph] ?? art.petal ?? STEM,
              left: left + x * CELL.width,
              top: top + y * CELL.height,
              size: 20,
            },
          ],
    ),
  )
  const stalkCells = Array.from({ length: stalk }, (_, i) => ({
    glyph: '|',
    color: STEM,
    left: stalkLeft,
    top: stalkTop + i * CELL.height,
    size: CELL.height,
  }))
  return [...head, ...stalkCells]
}

// Over the graph, the flowers sit half a cell right of its columns, so each
// stalk runs down the gap between two weeks and covers no day.
const FLOWERS_OVER_GRAPH = [
  ...flower(POPPY, 854, 202, 894, 254, 12),
  ...flower(COSMOS, 994, 280, 1014, 358, 8),
]

// Over the fallback's grass, they drop onto its grid and each stalk runs
// into a tuft's centre blade.
const FLOWERS_OVER_GRASS = [
  ...flower(POPPY, 864, 384, 904, 436, 3),
  ...flower(COSMOS, 1004, 410, 1024, 488, 2),
]

// A plain function, not a component: Satori can't render a component that
// returns an array.
function flowers(glyphs: Placed[]) {
  return glyphs.map(({ glyph, color, left, top, size }) => (
    <div
      key={`${left},${top}`}
      style={{
        display: 'flex',
        position: 'absolute',
        left,
        top,
        width: CELL.width,
        height: CELL.height,
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Geist Mono',
        fontWeight: 500,
        fontSize: size,
        lineHeight: `${CELL.height}px`,
        color,
      }}
    >
      {glyph}
    </div>
  ))
}

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
        {flowers(calendar ? FLOWERS_OVER_GRAPH : FLOWERS_OVER_GRASS)}
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
