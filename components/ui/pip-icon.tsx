'use client'
import { useEffect, useRef } from 'react'

// Pip, Portal's alien, as the Portal demo icon. The art, shading, outline
// and portal ring are ported from the Portal repo
// (src/components/agent/pixel.ts and pip-sprite.tsx). Still at rest; on
// hover Pip chatters, and every third hover he does a trick instead: a ride
// in his saucer, or a drop through a portal.

type Key = 'body' | 'shade' | 'ink' | 'light' | 'cheek' | 'hull' | 'under'
type Asset = {
  grid: string[][]
  paint: (c: string, x: number, y: number) => Key | null
  extras?: [number, number, Key][]
  // false for light, like the beam, which has no outline
  outline?: boolean
}

// Portal's tokens (src/design/tokens.css); the same in both themes.
const COLORS: Record<Key, string> = {
  body: '#b8cc94',
  shade: '#8fad73',
  ink: '#283020',
  light: '#f6f0de',
  cheek: '#dbe6c4',
  hull: '#f2e7cb',
  under: '#c9bf9f',
}

// . empty · B body · S shade · H hand · O eye · W shine · K cheek · M mouth
// · A bobble · T stalk
const PIP = [
  '.AA..........AA.',
  '.AA..........AA.',
  '...T........T...',
  '....T......T....',
  '.....BBBBBB.....',
  '...BBBBBBBBBB...',
  '..BBBBBBBBBBBB..',
  '.BBOOBBBBBBOOBB.',
  '.BOWWOBBBBWWOOB.',
  '.BOOOOBBBBOOOOB.',
  '.BBOOBBBBBBOOBB.',
  '.BKKBBMBBMBBKKB.',
  '..BBBBBMMBBBBB..',
  '....BBBBBBBB....',
  '....HSSSSSSH....',
  '.....SS..SS.....',
]

const bob = (tick: number) => Math.floor(tick / 2) % 2

function pip(tick: number, talking: boolean): Asset {
  const g = PIP.map((row) => row.split(''))
  const beat = bob(tick)
  if (talking && tick % 34 < 2) {
    for (const y of [7, 8, 9])
      for (let x = 0; x < 16; x++)
        if (g[y][x] === 'O' || g[y][x] === 'W') g[y][x] = 'B'
  }
  if (talking && beat) {
    g[11][6] = g[11][9] = 'B'
    g[11][7] = g[11][8] = g[12][7] = g[12][8] = 'M'
    for (const y of [0, 1]) g[y] = 'AA............AA'.split('')
  }
  return {
    grid: g,
    paint: (c, x, y) => {
      if (c === 'B')
        return (x - 7.5) * 0.6 + (y - 9) * 0.8 > 4.4 && (x + y) % 2 === 0
          ? 'shade'
          : 'body'
      return (
        (
          {
            S: 'shade',
            H: 'shade',
            T: 'shade',
            O: 'ink',
            M: 'ink',
            W: 'light',
            A: 'light',
            K: 'cheek',
          } as const
        )[c as 'S'] ?? null
      )
    },
    extras:
      talking && Math.floor(tick / 5) % 4 === 0
        ? [
            [1, -1, 'light'],
            [14, -1, 'light'],
          ]
        : [],
  }
}

const PORTAL_W = 22
const PORTAL_H = 6

function portal(open: number, tick: number): Asset {
  const w = 2 * Math.max(1, Math.round((PORTAL_W / 2) * open))
  const h = 2 * Math.max(1, Math.round((PORTAL_H / 2) * open))
  const grid = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => {
      const dx = (x + 0.5 - w / 2) / (w / 2)
      const dy = (y + 0.5 - h / 2) / (h / 2)
      const d = dx * dx + dy * dy
      return d > 1 ? '.' : d > 0.5 ? 'R' : 'V'
    }),
  )
  return {
    grid,
    paint: (c, x, y) =>
      c === 'R'
        ? (x + tick) % 4 === 0
          ? 'cheek'
          : 'light'
        : (x * 3 + y * 5 + tick) % 7 === 0
          ? 'body'
          : 'ink',
  }
}

// . empty · G glass · A antenna · P Pip · O eye · K cheek · H hull
// · L rim light · U underside
const UFO = [
  '.....GGGGGGGG.....',
  '....GGAGGGGAGG....',
  '....GPPPPPPPPG....',
  '....GPOPPPPOPG....',
  '...GGPKPPPPKPGG...',
  '..HHHHHHHHHHHHHH..',
  '.HHHHHHHHHHHHHHHH.',
  'LHHLHHLHHLHHLHHLHL',
  '.UUUUUUUUUUUUUUUU.',
  '....UUUUUUUUUU....',
]
const LIGHTS = [...UFO[7]].flatMap((c, x) => (c === 'L' ? [x] : []))

// The saucer: its rim lights chase round so it reads as spinning, and Pip's
// eyes follow them.
function ufo(tick: number): Asset {
  const g = UFO.map((row) => row.split(''))
  const look = [-1, 0, 1, 0][Math.floor(tick / 3) % 4]
  for (const x of [6, 11]) {
    g[3][x] = 'P'
    g[3][x + look] = 'O'
  }
  return {
    grid: g,
    paint: (c, x, y) => {
      if (c === 'L')
        return (LIGHTS.indexOf(x) - tick) % 3 === 0 ? 'light' : 'shade'
      if (c === 'G') return (x + y) % 2 ? null : 'light'
      return (
        (
          {
            A: 'shade',
            P: 'body',
            O: 'ink',
            K: 'cheek',
            H: 'hull',
            U: 'under',
          } as const
        )[c as 'A'] ?? null
      )
    },
  }
}

// The tractor beam: a widening dithered cone, shimmering with the tick.
function beam(height: number, tick: number): Asset {
  const grid = Array.from({ length: Math.max(0, height) }, (_, y) => {
    const half = 4 + Math.floor((y * 5) / Math.max(1, height))
    return Array.from({ length: 18 }, (_, x) =>
      Math.abs(x - 8.5) < half ? 'Y' : '.',
    )
  })
  return {
    grid,
    paint: (_, x, y) => ((x + y + tick) % 2 ? 'light' : null),
    outline: false,
  }
}

// Every asset gets a 1-cell outline; `rows` and `from` draw part of it.
function draw(
  ctx: CanvasRenderingContext2D,
  asset: Asset,
  ox: number,
  oy: number,
  rows = Infinity,
  from = 0,
) {
  const g = asset.grid
  const h = Math.min(g.length, rows)
  const filled = (x: number, y: number) =>
    y >= from && y < h && x >= 0 && x < g[y].length && g[y][x] !== '.'
  const put = (x: number, y: number, key: Key) => {
    ctx.fillStyle = COLORS[key]
    ctx.fillRect(ox + x, oy + y, 1, 1)
  }
  for (let y = from - 1; y <= (asset.outline === false ? -2 : h); y++)
    for (let x = -1; x <= (g[0]?.length ?? 0); x++)
      if (
        !filled(x, y) &&
        (filled(x - 1, y) ||
          filled(x + 1, y) ||
          filled(x, y - 1) ||
          filled(x, y + 1))
      )
        put(x, y, 'ink')
  for (let y = from; y < h; y++)
    for (let x = 0; x < g[y].length; x++) {
      if (g[y][x] === '.') continue
      const key = asset.paint(g[y][x], x, y)
      if (key) put(x, y, key)
    }
  for (const [x, y, key] of asset.extras ?? []) put(x, y, key)
}

// Canvas in cells: room for the bobble glints above and the ring's spill
// past Pip on both sides.
const W = PORTAL_W + 2
const H = 20
const PX = (W - 16) / 2
const PY = 2

// The dive, in ms: the portal opens, Pip sinks, waits below, rises, closes.
const OPEN = 260
const SINK = 800
const DOWN = 1100
const RISE = 1620
const CLOSE = 1880

const clamp = (n: number) => Math.min(1, Math.max(0, n))
const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a))
const easeOut = (p: number) => 1 - (1 - p) ** 3
const easeIn = (p: number) => p ** 3

function drawDive(ctx: CanvasRenderingContext2D, t: number, tick: number) {
  const open =
    t < DOWN ? easeOut(span(t, 0, OPEN)) : 1 - easeIn(span(t, RISE, CLOSE))
  const sunk =
    t < DOWN
      ? 16 * easeIn(span(t, OPEN, SINK))
      : 16 * (1 - easeOut(span(t, DOWN, RISE)))
  const ring = portal(open, tick)
  const rx = PX + 8 - ring.grid[0].length / 2
  const ry = PY + 14 - ring.grid.length / 2
  draw(ctx, ring, rx, ry)
  const below = Math.round(sunk)
  if (below < 16) draw(ctx, pip(0, false), PX, PY + below, 16 - below)
  // the ring's front lip over Pip's middle
  draw(ctx, ring, rx, ry, Infinity, ring.grid.length / 2)
}

// The saucer ride, in ms: Pip hops out of frame, his saucer drops in and
// hovers over its beam, zips off, and Pip drops back down.
const HOP = 260
const ARRIVE = 560
const LEAVE = 1800
const GONE = 2080
const LAND = 2420
const UX = (W - 18) / 2
const UY = 3

function drawUfo(ctx: CanvasRenderingContext2D, t: number, tick: number) {
  if (t < HOP) {
    draw(ctx, pip(0, false), PX, PY - Math.round(20 * easeIn(span(t, 0, HOP))))
    return
  }
  if (t >= GONE) {
    const drop = 20 * (1 - easeOut(span(t, GONE, LAND)))
    draw(ctx, pip(0, false), PX, PY - Math.round(drop))
    return
  }
  const y =
    t < ARRIVE
      ? -12 + (UY + 12) * easeOut(span(t, HOP, ARRIVE))
      : t > LEAVE
        ? UY - (UY + 12) * easeIn(span(t, LEAVE, GONE))
        : UY - (Math.floor(tick / 4) % 2)
  const hovering = t > ARRIVE + 120 && t < LEAVE
  if (hovering) draw(ctx, beam(H - (UY + 10), tick), UX, UY + 10)
  draw(ctx, ufo(tick), UX, Math.round(y))
}

export function PipIcon() {
  // one CSS pixel per cell keeps the pixel art crisp
  const height = H
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const still = () => {
      ctx.clearRect(0, 0, W, H)
      draw(ctx, { ...pip(0, false), extras: [] }, PX, PY)
    }
    still()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Hover lands on the link around the icon.
    const target = el.closest('a') ?? el
    let frame = 0
    let hovers = 0
    const start = () => {
      cancelAnimationFrame(frame)
      // every third hover a trick, the saucer and the portal in turn;
      // otherwise chatter
      const n = ++hovers
      const trick = n % 3 !== 0 ? null : (n / 3) % 2 === 1 ? 'ufo' : 'dive'
      const from = performance.now()
      const loop = (now: number) => {
        const t = now - from
        ctx.clearRect(0, 0, W, H)
        if (trick === 'dive') {
          drawDive(ctx, t, Math.floor(t / 40))
          if (t >= CLOSE) return still()
        } else if (trick === 'ufo') {
          drawUfo(ctx, t, Math.floor(t / 110))
          if (t >= LAND) return still()
        } else {
          const tick = Math.floor(t / 120)
          draw(ctx, pip(tick, true), PX, PY - bob(tick))
        }
        frame = requestAnimationFrame(loop)
      }
      frame = requestAnimationFrame(loop)
    }
    const stop = () => {
      // a trick finishes on its own; chatter stops with the pointer
      if (hovers % 3 !== 0) {
        cancelAnimationFrame(frame)
        still()
      }
    }
    target.addEventListener('pointerenter', start)
    target.addEventListener('pointerleave', stop)
    target.addEventListener('focus', start)
    target.addEventListener('blur', stop)
    return () => {
      cancelAnimationFrame(frame)
      target.removeEventListener('pointerenter', start)
      target.removeEventListener('pointerleave', stop)
      target.removeEventListener('focus', start)
      target.removeEventListener('blur', stop)
    }
  }, [])

  const cell = height / H
  return (
    <canvas
      ref={canvas}
      width={W}
      height={H}
      aria-hidden
      className="block [image-rendering:pixelated]"
      style={{
        width: W * cell,
        height,
        // the ring's spill past Pip doesn't push the GitHub icon away, and
        // the extra height doesn't grow the row
        marginInline: -PX * cell,
        marginBlock: -2,
      }}
    />
  )
}
