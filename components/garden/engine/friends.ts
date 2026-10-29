import { clamp, lerp, mulberry32, TAU } from './math'
import { mix, type Palette, type Rgb } from './palette'
import {
  figureSize,
  pushShown,
  showSize,
  sizeFor,
  type FigureSize,
  type Shown,
} from './typeset'

import type { Head, Look, Raster } from './raster'
import type { Visitors } from './visitors'
import type { Wind } from './wind'

/** A flower this close to the last is a hop, flown slower. */
const HOP_RANGE = 320
/** Flowers the pair visits on its own; on the last they stay until called. */
const VISITS = 4
/** A cell and a row in scene px. */
const CELL = 5
const ROW = 7
/** Their circle in flight, cells across and rows down by size (cells are tall, so it's wide). */
const ORBIT: Record<FigureSize, [number, number]> = {
  big: [4, 2],
  mid: [3, 1.5],
  small: [1.5, 1],
}
/** The tight lap before the kiss, cells and rows. */
const TIGHT: [number, number] = [3, 1]
/** Seconds a lap takes in flight. */
const LAP = 1.6
/** How close the centre comes to a flower before they settle onto it, px. */
const SETTLE_AT = 46
/** The meeting, s: break off to the middle, a tight lap, the kiss held, lift away. */
const CLOSE = 0.4
const CIRCLE = 0.8
const KISS = 0.6
const PART = 0.6
/** The heart, s: a beat at the pair's size, a row up every step, and `<3` for the fade. */
const HEART = 1.2
const HEART_BEAT = 0.12
const HEART_STEP = 0.4
const HEART_FADE = 0.3
/** Wing frames, s each: the bee's buzz, the ladybug's heavier beat, slower in the kiss. */
const BEE_FRAME = 0.04
const LADY_FRAME = 0.08
const LADY_KISS_FRAME = 0.16
/** A bug keeps a facing at least this long, s, so it doesn't flicker at the ends of the circle. */
const FACING_HOLD = 0.15

/** Ladybug, bee and heart colours by day (MeadowVisitors). */
const LADYBUG: Look = {
  base: [204, 38, 30],
  pattern: [22, 18, 18],
  edge: [246, 240, 228],
  body: [26, 22, 22],
}
const BEE: Look = {
  base: [238, 178, 40],
  pattern: [30, 26, 22],
  edge: [226, 206, 156],
  body: [30, 26, 22],
}
const HEART_LOOK: Look = {
  base: [214, 48, 86],
  pattern: [255, 205, 214],
  edge: [140, 24, 58],
  body: [140, 24, 58],
}

/** One class down, for the heart over the pair. */
const smaller = (size: FigureSize): FigureSize =>
  size === 'big' ? 'mid' : 'small'

/**
 * Cells from the ladybug's anchor to the bee's when they face each other, ladybug on the left,
 * with their heads in neighbouring cells. A figure anchors on its middle column and faces right;
 * the bee, turned, has its head in its first.
 */
const gap = (size: FigureSize) => {
  const a = figureSize('ladybug', size).cols
  const b = figureSize('bee', size).cols
  return a - 1 - (a >> 1) + (b >> 1) + 1
}

/** Rows the ladybug sits below the bee to bring their heads level: the big ladybug stands on legs. */
const drop = (size: FigureSize) => (size === 'big' ? 1 : 0)

/** The middle of the column a point falls in, so figures a whole number of cells apart stay so. */
const snap = (x: number) => (Math.floor(x / CELL) + 0.5) * CELL

/** The angle equal to `to` (mod a turn) nearest `from`. */
const nearest = (from: number, to: number) =>
  Math.round((from - to) / TAU) * TAU + to

/** Size for a flower at this depth, as the butterflies take it: small far off, full size up front. */
const spanAt = (head: Head) => 12 + 36 * (head.depth ?? 0.6) ** 1.5

const ease = (from: number, to: number, rate: number, dt: number) =>
  from + (to - from) * Math.min(1, dt * rate)

/**
 * travel: flying to a flower, circling each other. settle: the glide down onto it. perch: side
 * by side on the head. takeoff: up off it together. leave: away and out of the garden.
 */
type Mode = 'travel' | 'settle' | 'perch' | 'takeoff' | 'leave'
/** A tap in flight: they close in, lap each other tight, kiss under a heart, and lift away. */
type Moment = 'close' | 'circle' | 'kiss' | 'part'

type Bug = {
  kind: 'ladybug' | 'bee'
  x: number
  y: number
  facing: 1 | -1
  /** Seconds since it last turned. */
  turned: number
  /** Wing clock, s. */
  clock: number
}

type Pair = {
  /** The point they circle. */
  cx: number
  cy: number
  vx: number
  vy: number
  mode: Mode
  target: object | null
  visits: number
  /** Seconds left: on the flower, in the takeoff, or in the settle. */
  t: number
  cruise: number
  wander: number
  /** Angle round each other, spin in rad/s, and the circle's half-width and half-height, px. */
  theta: number
  spin: number
  rx: number
  ry: number
  /** How far they've moved from the circle to their places side by side, 0 to 1. */
  hold: number
  /** Their places side by side: on the flower, or in the kiss. */
  rest: { lx: number; ly: number; bx: number; by: number }
  moment: Moment | null
  momentT: number
  /** The tight lap's start and end angles. */
  lap: [number, number]
  /** Still, under reduced motion: no beat or rise, and it goes when `calm` says. */
  heart: { x: number; y: number; age: number; still: boolean } | null
  span: number
  size: FigureSize
  /** The size as printed, easing between figures when `size` steps. */
  shown: Shown
  /** The flight to the flower they're bound for: its start's size and distance, so they
   * shrink or grow with the way covered rather than all at once on leaving. */
  leg: { owner: object; span: number; d: number } | null
  lady: Bug
  bee: Bug
  /** Perched, seconds to the bee's next wing flick, and how long the flick has left. */
  flickIn: number
  flick: number
  /** Perched, seconds to the ladybug's next shuffle, and the cell it's shuffled along the rim. */
  shuffleIn: number
  shuffle: number
  rng: () => number
  /** A flower called while they were busy with each other, to fly to after. */
  call: object | null
}

/**
 * The poem's visitors: a ladybug and a bumblebee, friends, the only pair in the garden. A click
 * on a flower calls them in from the nearest edge, or steers them there if they're already about.
 * They fly circling each other, settle side by side on the flower, hop to a few more nearby, and
 * stay on the last until called. Tapping either in flight brings them together: a tight lap, a
 * kiss under a heart, then on to where they were going. Under reduced motion they don't fly: a
 * click puts them on the flower, and a tap shows the heart, still.
 */
export class Friends implements Visitors {
  private pair: Pair | null = null
  private pending: { owner: object; t: number }[] = []
  private seed = 1
  private width = 0
  private reduced = false
  private looks: {
    night: number
    haze: Rgb
    ladybug: Look
    bee: Look
    heart: Look
  } | null = null

  still(on: boolean) {
    this.reduced = on
    // A pair caught in flight can't finish without frames.
    if (on && this.pair && this.pair.mode !== 'perch') this.pair = null
  }

  calm() {
    if (this.pair) this.pair.heart = null
  }

  clear() {
    this.pair = null
    this.pending = []
  }

  later(owner: object, seconds: number) {
    this.pending.push({ owner, t: seconds })
  }

  summon(owner: object, heads: Head[]) {
    const head = heads.find((h) => h.owner === owner)
    if (!head) return
    let pair = this.pair
    if (pair && !this.reduced) {
      pair.visits = 0
      if (pair.moment) pair.call = owner
      else this.steer(pair, owner, head)
      return
    }
    if (!pair) {
      const rng = mulberry32(this.seed++)
      const w = this.width || head.x * 2
      const side = Math.min(head.x, w - head.x, head.y)
      const x =
        side === head.y
          ? head.x + (rng() - 0.5) * 300
          : side === head.x
            ? -30
            : w + 30
      const y = side === head.y ? -30 : head.y - 60 - rng() * 120
      const bug = (kind: Bug['kind']): Bug => ({
        kind,
        x,
        y,
        facing: x < head.x ? 1 : -1,
        turned: 0,
        clock: rng(),
      })
      const span = spanAt(head)
      const size = sizeFor('bee', span / CELL)
      pair = this.pair = {
        cx: x,
        cy: y,
        vx: 0,
        vy: 0,
        mode: 'travel',
        target: null,
        visits: 0,
        t: 0,
        cruise: 0,
        wander: rng() * TAU,
        theta: rng() * TAU,
        spin: TAU / LAP,
        rx: ORBIT[size][0] * CELL,
        ry: ORBIT[size][1] * ROW,
        hold: 0,
        rest: { lx: x, ly: y, bx: x, by: y },
        moment: null,
        momentT: 0,
        lap: [0, 0],
        heart: null,
        span,
        size,
        shown: { size, from: null, k: 1 },
        leg: null,
        lady: bug('ladybug'),
        bee: bug('bee'),
        flickIn: 2,
        flick: 0,
        shuffleIn: 4,
        shuffle: 0,
        rng,
        call: null,
      }
    }
    if (this.reduced) {
      // No flight: straight onto the flower, to stay.
      pair.target = owner
      pair.mode = 'perch'
      pair.t = Infinity
      pair.hold = 1
      pair.span = spanAt(head)
      pair.size = sizeFor('bee', pair.span / CELL)
      this.perchOn(pair, head)
      this.place(pair, 0)
      return
    }
    this.steer(pair, owner, head)
  }

  /** Points them at a flower; sitting, they take off first and go there once up. */
  private steer(pair: Pair, owner: object, head: Head) {
    if (
      pair.mode === 'perch' ||
      pair.mode === 'settle' ||
      pair.mode === 'takeoff'
    ) {
      if (pair.target === owner && pair.mode !== 'takeoff') return
      pair.call = owner
      if (pair.mode !== 'takeoff') this.takeoff(pair)
      return
    }
    if (pair.target === owner && pair.mode !== 'leave') return
    pair.target = owner
    pair.mode = 'travel'
    const d = Math.hypot(head.x - pair.cx, head.y - pair.cy)
    pair.cruise = d < HOP_RANGE ? 120 : clamp(120 + d * 0.2, 120, 320)
  }

  private takeoff(pair: Pair) {
    pair.mode = 'takeoff'
    pair.t = 0.6
    pair.vx = 0
    pair.vy = -40
  }

  /**
   * A click on either bug, or in flight anywhere on the circle they fly, sets off the meeting:
   * on the wing they meet and fly on, on a flower they dance there and settle back. Under reduced
   * motion, on a flower it shows the heart. True whenever it lands, so the click doesn't also sow.
   * `reach` is the least half-size of a bug's target, px, so small figures stay tappable.
   */
  tap(x: number, y: number, reach = 0) {
    const pair = this.pair
    if (!pair) return false
    let hw = reach
    let hh = reach
    const hit = [pair.lady, pair.bee].some((b) => {
      // The figure's cells and one more all round; its last row sits on the point.
      const { cols, rows } = figureSize(b.kind, pair.size)
      hw = Math.max((cols / 2 + 1) * CELL, reach)
      const top = b.y - (rows - 0.5) * ROW - ROW
      const bottom = b.y + ROW * 1.5
      hh = Math.max((bottom - top) / 2, reach)
      return Math.abs(x - b.x) < hw && Math.abs(y - (top + bottom) / 2) < hh
    })
    // Flying, they're quick: the whole ring they trace answers, a figure's size beyond it.
    const flying = pair.mode === 'travel' || pair.mode === 'leave'
    const dx = (x - pair.cx) / (pair.rx + hw)
    const dy = (y - (pair.cy - hh / 2)) / (pair.ry + hh)
    if (!hit && !(flying && dx * dx + dy * dy < 1)) return false
    if (pair.moment || pair.heart) return true
    if (this.reduced) {
      if (pair.mode === 'perch') this.heartOver(pair, true)
      return true
    }
    // Lifting off, it's too soon to turn back.
    if (pair.mode === 'takeoff') return true
    // On a flower they dance where they sit, with no way left over from the flight in.
    if (pair.mode === 'perch' || pair.mode === 'settle') {
      pair.vx = 0
      pair.vy = 0
    }
    pair.moment = 'close'
    pair.momentT = CLOSE
    return true
  }

  step(dt: number, heads: Head[], wind: Wind, width: number, height: number) {
    this.width = width
    for (const q of this.pending) q.t -= dt
    for (const q of this.pending.filter((q) => q.t <= 0))
      this.summon(q.owner, heads)
    this.pending = this.pending.filter((q) => q.t > 0)

    const pair = this.pair
    if (!pair) return
    const head = pair.target
      ? heads.find((h) => h.owner === pair.target && h.alpha > 0.3)
      : undefined
    // Their flower gone (faded, gone to seed): up off it and on, or away.
    if (!head && (pair.mode === 'perch' || pair.mode === 'settle'))
      this.takeoff(pair)
    else if (!head && pair.mode !== 'leave' && pair.mode !== 'takeoff')
      this.leave(pair)
    // One size for both, by the bee's widths, so they never print at different scales; held
    // through a meeting, which is spaced by it.
    if (head && !pair.moment) {
      const d = Math.hypot(head.x - pair.cx, head.y - pair.cy)
      if (pair.target && pair.leg?.owner !== pair.target)
        pair.leg = { owner: pair.target, span: pair.span, d: Math.max(d, 1) }
      const goal = pair.leg
        ? lerp(spanAt(head), pair.leg.span, clamp(d / pair.leg.d, 0, 1))
        : spanAt(head)
      pair.span = ease(pair.span, goal, 4, dt)
      pair.size = sizeFor('bee', pair.span / CELL)
    }
    showSize(pair.shown, pair.size, dt)

    if (pair.heart && !pair.heart.still) {
      pair.heart.age += dt
      if (pair.heart.age >= HEART) pair.heart = null
    }

    if (pair.moment) this.meet(pair, dt, heads)
    if (!pair.moment || pair.moment === 'part')
      this.fly(pair, dt, head, heads, wind, width)

    this.place(pair, dt)
    if (
      pair.mode === 'leave' &&
      (pair.cx < -120 ||
        pair.cx > width + 120 ||
        pair.cy < -120 ||
        pair.cy > height + 60)
    )
      this.pair = null
  }

  /** The centre's course for this mode. */
  private fly(
    pair: Pair,
    dt: number,
    head: Head | undefined,
    heads: Head[],
    wind: Wind,
    width: number,
  ) {
    const [ox, oy] = ORBIT[pair.size]
    // A dance on the flower parts back into the circle before they take their places again.
    if (
      pair.moment === 'part' &&
      (pair.mode === 'perch' || pair.mode === 'settle')
    )
      return
    switch (pair.mode) {
      case 'perch': {
        // The head sways in the wind; they ride it.
        if (head) this.perchOn(pair, head)
        // The circle's centre rides along between them, for the takeoff; eased, so a dance on
        // the flower hands back to their places without a step.
        pair.cx = ease(pair.cx, (pair.rest.lx + pair.rest.bx) / 2, 10, dt)
        pair.cy = ease(pair.cy, pair.rest.by, 10, dt)
        pair.hold = ease(pair.hold, 1, 8, dt)
        this.fidget(pair, dt)
        pair.t -= dt
        if (pair.t <= 0) this.takeoff(pair)
        return
      }
      case 'settle': {
        if (!head) return
        // The circle gives way to their places on the head as they glide down onto it.
        this.perchOn(pair, head)
        pair.hold = ease(pair.hold, 1, 4, dt)
        const k = Math.min(1, dt * 4)
        pair.cx += (head.x - pair.cx) * k
        pair.cy += (head.y - head.r * 0.35 - pair.cy) * k
        pair.t -= dt
        if (pair.t <= 0) {
          pair.mode = 'perch'
          pair.visits++
          // On the last flower of their round they stay until called.
          pair.t = pair.visits >= VISITS ? Infinity : 5 + pair.rng() * 4
          pair.flickIn = 2 + pair.rng() * 2
        }
        return
      }
      case 'takeoff': {
        pair.vy = ease(pair.vy, -90, 3, dt)
        pair.vx *= Math.exp(-2 * dt)
        pair.t -= dt
        if (pair.t <= 0) this.next(pair, heads)
        break
      }
      case 'travel': {
        if (!head) break
        const dx = head.x - pair.cx
        const dy = head.y - head.r * 0.35 - pair.cy
        const d = Math.hypot(dx, dy) || 1
        if (d < SETTLE_AT && !pair.moment) {
          pair.mode = 'settle'
          pair.t = 0.9
          return
        }
        this.seek(
          pair,
          dt,
          dx / d,
          dy / d,
          pair.cruise * clamp(d / 140, 0.45, 1),
        )
        break
      }
      case 'leave': {
        this.seek(pair, dt, 0.9, -0.44, 120)
        break
      }
    }
    // Flying, they're on the circle alone: whatever pulled them to their places lets go.
    if (pair.moment !== 'part')
      pair.hold = pair.hold < 0.01 ? 0 : ease(pair.hold, 0, 4, dt)
    if (!pair.moment) {
      pair.rx = ease(pair.rx, ox * CELL, 2, dt)
      pair.ry = ease(pair.ry, oy * ROW, 2, dt)
      pair.spin = ease(pair.spin, TAU / LAP, 2, dt)
    }
    pair.vx += wind.at(pair.cx, pair.cy, 0.5) * 12 * dt
    pair.cx += pair.vx * dt
    pair.cy += pair.vy * dt
    pair.cx = clamp(pair.cx, -200, width + 200)
  }

  /** Toward a heading at a speed, with a slow sideways weave so the course never runs straight. */
  private seek(pair: Pair, dt: number, ux: number, uy: number, speed: number) {
    pair.wander += dt * 1.3
    const weave = Math.sin(pair.wander) * 0.35
    const wx = ux - uy * weave
    const wy = uy + ux * weave
    pair.vx = ease(pair.vx, wx * speed, 2.2, dt)
    pair.vy = ease(pair.vy, wy * speed, 2.2, dt)
  }

  /** Their places on a flower: the bee on the head's middle, the ladybug a row down on the rim. */
  private perchOn(pair: Pair, head: Head) {
    const bx = snap(head.x)
    const by = head.y - head.r * 0.35
    // Close beside it, a cell between their heads: friends sit together, however wide the head.
    const cells = gap(pair.size) + 1 + pair.shuffle
    pair.rest = { lx: bx - cells * CELL, ly: by + ROW, bx, by }
  }

  /** On a flower the bee flicks its wings now and then, and the ladybug shuffles along the rim. */
  private fidget(pair: Pair, dt: number) {
    pair.flick = Math.max(0, pair.flick - dt)
    pair.flickIn -= dt
    if (pair.flickIn <= 0) {
      pair.flick = 0.08
      pair.flickIn = 2 + pair.rng() * 2
    }
    pair.shuffleIn -= dt
    if (pair.shuffleIn <= 0) {
      pair.shuffle = pair.shuffle ? 0 : 1
      pair.shuffleIn = 3 + pair.rng() * 4
    }
  }

  /**
   * The meeting. They break off to the middle and draw the circle in, take one tight lap that
   * ends with the ladybug on the left, then come face to face and hold there under the heart;
   * then the circle opens again and they fly on (`fly` takes over the centre for that).
   */
  private meet(pair: Pair, dt: number, heads: Head[]) {
    pair.momentT -= dt
    switch (pair.moment) {
      case 'close': {
        pair.vx *= Math.exp(-6 * dt)
        pair.vy *= Math.exp(-6 * dt)
        pair.cx += pair.vx * dt
        pair.cy += pair.vy * dt
        pair.hold = pair.hold < 0.01 ? 0 : ease(pair.hold, 0, 6, dt)
        pair.rx = ease(pair.rx, TIGHT[0] * CELL, 6, dt)
        pair.ry = ease(pair.ry, TIGHT[1] * ROW, 6, dt)
        pair.spin = ease(pair.spin, TAU / CIRCLE, 6, dt)
        if (pair.momentT <= 0) {
          pair.moment = 'circle'
          pair.momentT = CIRCLE
          // Once round, stopping where the ladybug is on the left.
          const end = nearest(pair.theta + TAU, Math.PI)
          pair.lap = [
            pair.theta,
            end < pair.theta + TAU * 0.75 ? end + TAU : end,
          ]
        }
        break
      }
      case 'circle': {
        const u = 1 - Math.max(0, pair.momentT) / CIRCLE
        // Quick out of the close, slowing into the kiss.
        const e = 1 - (1 - u) ** 2
        const [from, to] = pair.lap
        pair.theta = from + (to - from) * e
        pair.spin = 0
        pair.rx = TIGHT[0] * CELL
        pair.ry = TIGHT[1] * ROW
        if (pair.momentT <= 0) {
          pair.moment = 'kiss'
          pair.momentT = KISS
          // Face to face, heads in neighbouring cells and level.
          const lx = snap(pair.cx - (gap(pair.size) * CELL) / 2)
          const by = pair.cy
          pair.rest = {
            lx,
            ly: by + drop(pair.size) * ROW,
            bx: lx + gap(pair.size) * CELL,
            by,
          }
          this.heartOver(pair, false)
        }
        break
      }
      case 'kiss': {
        pair.hold = ease(pair.hold, 1, 14, dt)
        if (pair.momentT <= 0) {
          pair.moment = 'part'
          pair.momentT = PART
        }
        break
      }
      case 'part': {
        pair.hold = pair.hold < 0.01 ? 0 : ease(pair.hold, 0, 5, dt)
        const [ox, oy] = ORBIT[pair.size]
        pair.rx = ease(pair.rx, ox * CELL, 4, dt)
        pair.ry = ease(pair.ry, oy * ROW, 4, dt)
        pair.spin = ease(pair.spin, TAU / LAP, 4, dt)
        if (pair.momentT <= 0) {
          pair.moment = null
          const call = pair.call
          pair.call = null
          const head =
            call && heads.find((h) => h.owner === call && h.alpha > 0.3)
          if (call && head) this.steer(pair, call, head)
        }
        break
      }
    }
  }

  /** The heart over the two of them, centred on their heads, its bottom row a row above the bee's top. */
  private heartOver(pair: Pair, still: boolean) {
    const { rest, size } = pair
    const a = figureSize('ladybug', size).cols
    const bee = figureSize('bee', size)
    // Heads: the ladybug's at its right end, the turned bee's at its left.
    const ladyHead = rest.lx + (a - 1 - (a >> 1)) * CELL
    const beeHead = rest.bx - (bee.cols >> 1) * CELL
    const top = rest.by - (bee.rows - 1) * ROW
    pair.heart = {
      x: (ladyHead + beeHead) / 2,
      y: top - ROW,
      age: still ? HEART_BEAT : 0,
      still,
    }
  }

  /**
   * Where each bug is: opposite each other on the circle, eased toward their places side by side
   * when they sit or kiss, then turned to each other.
   */
  private place(pair: Pair, dt: number) {
    const { lady, bee } = pair
    pair.theta += pair.spin * dt
    const cos = Math.cos(pair.theta)
    const sin = Math.sin(pair.theta)
    // The centre bobs a little with the beat, never more than a row.
    lady.clock += dt
    bee.clock += dt
    const bob = Math.sin(lady.clock * TAU * 0.9) * ROW * 0.35 * (1 - pair.hold)
    const h = pair.hold
    const { rest } = pair
    const turned = h > 0.5
    this.move(
      lady,
      pair.cx + cos * pair.rx + (rest.lx - pair.cx - cos * pair.rx) * h,
      pair.cy +
        sin * pair.ry +
        bob +
        (rest.ly - pair.cy - sin * pair.ry - bob) * h,
      turned ? 1 : 0,
      dt,
    )
    this.move(
      bee,
      pair.cx - cos * pair.rx + (rest.bx - pair.cx + cos * pair.rx) * h,
      pair.cy -
        sin * pair.ry +
        bob +
        (rest.by - pair.cy + sin * pair.ry - bob) * h,
      turned ? -1 : 0,
      dt,
    )
  }

  /** Puts a bug at a point; with no facing given it turns the way it's moving, once it may. */
  private move(b: Bug, x: number, y: number, facing: 1 | -1 | 0, dt: number) {
    const vx = dt > 0 ? (x - b.x) / dt : 0
    b.x = x
    b.y = y
    b.turned += dt
    const want = facing || (Math.abs(vx) > 8 ? (vx > 0 ? 1 : -1) : b.facing)
    if (want !== b.facing && (facing || b.turned >= FACING_HOLD)) {
      b.facing = want
      b.turned = 0
    }
  }

  /** Off a flower: to the one called, or on to a nearby one they haven't just left. */
  private next(pair: Pair, heads: Head[]) {
    const from = pair.target
    const called = pair.call
    pair.call = null
    const near = heads
      .filter(
        (h) =>
          h.owner &&
          h.owner !== from &&
          h.alpha > 0.5 &&
          Math.hypot(h.x - pair.cx, h.y - pair.cy) < HOP_RANGE,
      )
      .sort(
        (a, c) =>
          Math.hypot(a.x - pair.cx, a.y - pair.cy) -
          Math.hypot(c.x - pair.cx, c.y - pair.cy),
      )
    const head =
      (called && heads.find((h) => h.owner === called && h.alpha > 0.3)) ||
      near[Math.floor(pair.rng() * Math.min(3, near.length))]
    if (!head?.owner) {
      this.leave(pair)
      return
    }
    pair.target = null
    pair.mode = 'travel'
    this.steer(pair, head.owner, head)
  }

  private leave(pair: Pair) {
    pair.mode = 'leave'
    pair.target = null
  }

  /** After dark they mute toward the haze like the moths, gradually, as the poem runs the hours. */
  private muted(night: number, haze: Rgb) {
    const was = this.looks
    // The palette is made fresh each frame, so compare the colour, not the array.
    if (was && was.night === night && was.haze.every((c, i) => c === haze[i]))
      return was
    const f = 0.25 * night
    const mute = (l: Look): Look => ({
      base: mix(l.base, haze, f),
      pattern: mix(l.pattern, haze, f),
      edge: mix(l.edge, haze, f),
      body: mix(l.body, haze, f),
    })
    this.looks = {
      night,
      haze,
      ladybug: mute(LADYBUG),
      bee: mute(BEE),
      heart: mute(HEART_LOOK),
    }
    return this.looks
  }

  draw(r: Raster, p: Palette) {
    const pair = this.pair
    if (!pair) return
    // From the palette drawn, not the last step's: under reduced motion the hour moves with none.
    const looks = this.muted(p.night, p.haze)
    const sitting = pair.mode === 'perch' || this.reduced
    // The one on the near side of the circle, lower on screen, prints over the other.
    const order =
      pair.lady.y > pair.bee.y ? [pair.bee, pair.lady] : [pair.lady, pair.bee]
    for (const b of order) {
      const frame =
        b.kind === 'bee'
          ? BEE_FRAME
          : pair.moment === 'kiss'
            ? LADY_KISS_FRAME
            : LADY_FRAME
      const pose = sitting
        ? b.kind === 'bee' && pair.flick > 0
          ? 0
          : 2
        : Math.floor(b.clock / frame) % 2
      pushShown(
        r.sprites,
        {
          x: b.x,
          y: b.y,
          pose,
          look: looks[b.kind],
          kind: b.kind,
          span: pair.span,
          facing: b.facing,
        },
        pair.shown,
      )
    }
    const heart = pair.heart
    if (heart) {
      // A beat at the pair's size, then a class down, rising a row a step; `<3` as it goes.
      const size =
        heart.age < HEART_BEAT
          ? pair.size
          : heart.age > HEART - HEART_FADE
            ? 'small'
            : smaller(pair.size)
      const rise = heart.still ? 0 : Math.floor(heart.age / HEART_STEP)
      r.sprites.push({
        x: heart.x,
        y: heart.y - rise * ROW,
        pose: 0,
        look: looks.heart,
        kind: 'heart',
        span: pair.span,
        size,
      })
    }
  }
}
