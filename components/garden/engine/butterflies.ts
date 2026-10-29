import { clamp, lerp, mulberry32, TAU } from './math'
import { mix, type Palette, type Rgb } from './palette'

import type { Head, Look, Raster } from './raster'
import type { Wind } from './wind'

/** At most this many in the air at once, and in the garden at all. */
const FLYING_MAX = 3
const TOTAL_MAX = 5
/** A flower this close to the one it's leaving is a hop, not a journey. */
const HOP_RANGE = 300

/**
 * Species by day, each a wing ground, a pattern over it, the dark margin and the body. The
 * chooser takes whichever ground stands out most from the flower.
 */
const BUTTERFLIES: Look[] = [
  // Monarch: orange, cream spots in black margins.
  {
    base: [228, 118, 30],
    pattern: [250, 236, 205],
    edge: [46, 34, 30],
    body: [38, 32, 30],
  },
  // Swallowtail: yellow with blue along the hindwing hem.
  {
    base: [236, 206, 84],
    pattern: [92, 128, 214],
    edge: [48, 40, 36],
    body: [40, 36, 34],
  },
  // Morpho: blue with pale tips.
  {
    base: [72, 122, 222],
    pattern: [214, 228, 252],
    edge: [40, 44, 70],
    body: [40, 40, 56],
  },
  // Peacock: rust with violet eyespots.
  {
    base: [178, 58, 54],
    pattern: [116, 124, 210],
    edge: [52, 36, 36],
    body: [44, 34, 34],
  },
  // Red admiral: near-black with an orange band and cream-tipped margins.
  {
    base: [58, 40, 42],
    pattern: [226, 108, 40],
    edge: [236, 230, 214],
    body: [40, 32, 32],
  },
]

/** Moths after dark: quieter colours, but still a ground, a pattern and a margin. */
/** Wingspan in px for a flower at this depth: a few px on the far field, full size up front. */
const spanAt = (head: Head) => 12 + 36 * (head.depth ?? 0.6) ** 1.5

const MOTHS: Look[] = [
  // Luna: pale green with cream eyespots.
  {
    base: [158, 202, 160],
    pattern: [230, 242, 222],
    edge: [98, 92, 124],
    body: [122, 112, 102],
  },
  // Garden tiger: ochre with cream bands.
  {
    base: [196, 150, 88],
    pattern: [240, 226, 196],
    edge: [72, 54, 46],
    body: [70, 50, 44],
  },
  // Emperor: taupe with rose eyespots.
  {
    base: [156, 136, 128],
    pattern: [228, 182, 172],
    edge: [76, 62, 68],
    body: [70, 58, 60],
  },
]

/**
 * approach: erratic flight toward the flower. circle: hesitating above it in a tightening
 * loop. land: the last glide down. perch: on the head, basking. takeoff: the first beats up off
 * it. leave: away and out of the garden.
 */
type State = 'approach' | 'circle' | 'land' | 'perch' | 'takeoff' | 'leave'

type Butterfly = {
  x: number
  y: number
  vx: number
  vy: number
  state: State
  /** The plant whose head it's flying to or sitting on. */
  target: object | null
  age: number
  rng: () => number
  look: Look
  moth: boolean
  visits: number
  /** Speed this trip aims for, px/s. */
  cruise: number
  /** Where the current burst of flapping pushes, in radians. */
  heading: number
  /** Flight alternates bursts of flapping and glides; seconds left in the current one. */
  flapping: boolean
  phaseT: number
  /** Wing beat while flapping, in radians. */
  beat: number
  /** Wing position at rest, 0 open to 2 folded, easing toward an aim between slow decisions. */
  wingPos: number
  wingAim: number
  wingT: number
  /** Angle around the flower while circling, seconds of circling left, and how long it was. */
  orbit: number
  orbitT: number
  orbitDur: number
  /** Seconds left on the flower. */
  rest: number
  /** Sideways shuffle on the head, px, easing toward an aim. */
  shift: number
  shiftAim: number
  /** Seconds of wariness after a startle: wider circles, wilder flight. */
  shy: number
  /** A short hop from the last flower, so the approach is briefer. */
  hop: boolean
  /** Which way round it circles a flower. */
  spin: 1 | -1
  /** A flower it was called to while sitting, to fly to once it's up. */
  call: object | null
  /** When it was last called, so the latest one answers the next click. */
  called: number
  /** Wingspan in px, easing toward its flower's scale so far visitors print small. */
  span: number
}

/**
 * Butterflies by day and moths after dark. One flies in from the nearest edge when a flower is
 * clicked, in bursts of flapping and glides that never run straight, circles the head once or
 * twice, lands and basks, opening and closing its wings slowly and shuffling about, then hops to
 * a nearby flower or leaves. A fast sweep of the cursor nearby startles it off. Clicking another
 * flower while it's about steers it there instead of calling a second one.
 */
export class Butterflies {
  list: Butterfly[] = []
  /** Flowers sown by a click get a visitor once they've opened. */
  private pending: { owner: object; t: number }[] = []
  private nextSeed = 1
  private calls = 0
  private width = 0

  clear() {
    this.list = []
    this.pending = []
  }

  /**
   * Sends a butterfly to the flower. One already about, and not on its way out, takes the call
   * wherever it is, so a click steers the butterfly on screen; only when none is about does a new
   * one fly in from the nearest edge.
   */
  summon(owner: object, heads: Head[], p: Palette) {
    const head = heads.find((h) => h.owner === owner)
    if (!head) return
    const about = this.list
      .filter((b) => b.state !== 'leave')
      .sort((a, c) => c.called - a.called)[0]
    if (about) {
      this.redirect(about, owner, head)
      return
    }
    if (
      this.list.some(
        (b) =>
          b.target === owner && b.state !== 'leave' && b.state !== 'takeoff',
      )
    )
      return
    const flying = this.list.filter((b) => b.state !== 'perch').length
    if (this.list.length >= TOTAL_MAX || flying >= FLYING_MAX) {
      // Reroute the one that's been about longest, so a click always gets an answer.
      const b = [...this.list].sort((a, c) => c.age - a.age)[0]
      if (!b) return
      this.send(b, owner, head, false)
      return
    }
    const rng = mulberry32(this.nextSeed++)
    const moth = p.night > 0.55
    // Enter from whichever edge is nearest, so the answer to a click is on its way at once.
    const w = this.width || head.x * 2
    const side = Math.min(head.x, w - head.x, head.y)
    const x =
      side === head.y
        ? head.x + (rng() - 0.5) * 300
        : side === head.x
          ? -24
          : w + 24
    const y = side === head.y ? -24 : head.y - 40 - rng() * 120
    const b: Butterfly = {
      x,
      y,
      vx: side === head.y ? 0 : side === head.x ? 120 : -120,
      vy: side === head.y ? 120 : 0,
      state: 'approach',
      target: owner,
      age: 0,
      rng,
      look: this.look(head.petal, p, moth, rng),
      moth,
      visits: 0,
      cruise: 0,
      heading: 0,
      flapping: true,
      phaseT: 0,
      beat: rng() * TAU,
      wingPos: 0,
      wingAim: 0,
      wingT: 0,
      orbit: 0,
      orbitT: 0,
      orbitDur: 1,
      rest: 0,
      shift: 0,
      shiftAim: 0,
      shy: 0,
      hop: false,
      spin: rng() < 0.5 ? 1 : -1,
      span: spanAt(head),
      call: null,
      called: ++this.calls,
    }
    this.send(b, owner, head, false)
    this.list.push(b)
  }

  /** Steers a butterfly already about to another flower; a sitting one takes off first. */
  private redirect(b: Butterfly, owner: object, head: Head) {
    b.called = ++this.calls
    b.visits = 0
    if (b.target === owner && b.state !== 'takeoff') return
    if (b.state === 'perch' || b.state === 'land') {
      b.call = owner
      b.state = 'takeoff'
      b.phaseT = 0.3
      b.flapping = true
      b.beat = 0
      b.vx = (b.rng() - 0.5) * 80
      b.vy = -70
    } else if (b.state === 'takeoff') b.call = owner
    else
      this.send(
        b,
        owner,
        head,
        Math.hypot(head.x - b.x, head.y - b.y) < HOP_RANGE,
      )
  }

  /** A visitor for a newly sown flower, once it has had time to open. */
  later(owner: object, seconds: number) {
    this.pending.push({ owner, t: seconds })
  }

  /** Points a butterfly at a flower; a far one flies faster, so no journey drags. */
  private send(b: Butterfly, owner: object, head: Head, hop: boolean) {
    b.target = owner
    b.state = 'approach'
    b.hop = hop
    const d = Math.hypot(head.x - b.x, head.y - b.y)
    b.cruise = hop ? 110 : clamp(120 + d * 0.25, 120, 320)
    b.phaseT = 0
    b.flapping = false
  }

  /** Moths are muted toward the night haze; butterflies take a species whose ground stands out from the flower. */
  private look(petal: Rgb, p: Palette, moth: boolean, rng: () => number): Look {
    if (moth) {
      const m = MOTHS[Math.floor(rng() * MOTHS.length)]
      const mute = (c: Rgb) => mix(c, p.haze, 0.25)
      return {
        base: mute(m.base),
        pattern: mute(m.pattern),
        edge: mute(m.edge),
        body: mute(m.body),
      }
    }
    const far = (c: Rgb) =>
      (c[0] - petal[0]) ** 2 + (c[1] - petal[1]) ** 2 + (c[2] - petal[2]) ** 2
    const ranked = [...BUTTERFLIES].sort((a, c) => far(c.base) - far(a.base))
    // Either of the two that contrast most, so the same flower doesn't always draw the same species.
    return ranked[rng() < 0.6 ? 0 : 1]
  }

  step(
    dt: number,
    heads: Head[],
    wind: Wind,
    width: number,
    height: number,
    p: Palette,
  ) {
    this.width = width
    for (const q of this.pending) q.t -= dt
    for (const q of this.pending.filter((q) => q.t <= 0))
      this.summon(q.owner, heads, p)
    this.pending = this.pending.filter((q) => q.t > 0)

    const ptr = wind.pointer
    const sweep = ptr.active && Math.hypot(ptr.vx, ptr.vy) > 300
    this.list = this.list.filter((b) => {
      b.age += dt
      b.shy = Math.max(0, b.shy - dt)
      const head = b.target
        ? heads.find((h) => h.owner === b.target && h.alpha > 0.3)
        : undefined
      if (!head && b.state !== 'leave' && b.state !== 'takeoff') this.depart(b)
      if (head) b.span += (spanAt(head) - b.span) * Math.min(1, dt * 1.5)
      const px = head ? head.x + b.shift : b.x
      const py = head ? head.y - head.r * 0.35 : b.y
      const startled = sweep && Math.hypot(ptr.x - b.x, ptr.y - b.y) < 90

      switch (b.state) {
        case 'perch': {
          b.x = px
          b.y = py
          b.vx = 0
          b.vy = 0
          this.bask(b, dt, head ? head.r : 10)
          b.rest -= dt
          if (startled) b.rest = 0
          if (b.rest <= 0) {
            b.state = 'takeoff'
            b.phaseT = 0.3
            b.flapping = true
            b.beat = 0
            b.vx = (b.rng() - 0.5) * 80
            b.vy = -70
            b.shy = startled ? 2 : 0
          }
          return true
        }
        case 'takeoff': {
          // The first beats climb straight up before it picks a direction.
          b.beat += dt * 9 * TAU
          b.vy += (-260 - b.vy * 2) * dt
          b.phaseT -= dt
          if (b.phaseT <= 0) {
            const called = b.call
              ? heads.find((h) => h.owner === b.call && h.alpha > 0.3)
              : undefined
            b.call = null
            if (called?.owner)
              this.send(
                b,
                called.owner,
                called,
                Math.hypot(called.x - b.x, called.y - b.y) < HOP_RANGE,
              )
            else this.lift(b, heads)
          }
          break
        }
        case 'approach': {
          if (head) {
            const dx = px - b.x
            const dy = py - b.y
            const d = Math.hypot(dx, dy)
            const near = head.r * 1.2 + 28 + b.shy * 20
            if (d < near) {
              b.state = 'circle'
              b.orbit = Math.atan2(b.y - py, b.x - px)
              b.orbitDur = b.hop
                ? 0.25 + b.rng() * 0.5
                : 0.7 + b.rng() * 1.0 + b.shy * 0.5
              b.orbitT = b.orbitDur
              break
            }
            // Wide wanders out in the open, tightening on the way in; wilder while wary.
            const spread = lerp(0.3, 1.1, clamp(d / 400, 0, 1)) + b.shy * 0.3
            this.flight(
              b,
              dt,
              Math.atan2(dy, dx),
              spread,
              b.cruise * (d < 120 ? 0.6 : 1),
              wind,
            )
          }
          break
        }
        case 'circle': {
          if (startled) this.scare(b, ptr.x, ptr.y)
          b.orbitT -= dt
          if (b.orbitT <= 0) {
            b.state = 'land'
            b.phaseT = 0.4
            break
          }
          // A loop that tightens from the approach radius to the head, held a little above it.
          const k = clamp(b.orbitT / b.orbitDur, 0, 1)
          const R = lerp(6, (head ? head.r : 10) * 1.2 + 26, k)
          b.orbit += dt * 4.5 * b.spin
          const ax = px + Math.cos(b.orbit) * R
          const ay = py + Math.sin(b.orbit) * R * 0.6 - R * 0.5
          b.beat += dt * 7 * TAU
          b.vx += ((ax - b.x) * 14 - b.vx * 5) * dt
          b.vy += ((ay - b.y) * 14 - b.vy * 5 - Math.sin(b.beat) * 60) * dt
          break
        }
        case 'land': {
          if (startled) this.scare(b, ptr.x, ptr.y)
          // Slowing beats on the way down; it touches with wings open and folds them once settled.
          b.beat += dt * 4 * TAU
          b.phaseT -= dt
          const ease = Math.min(1, dt * 9)
          b.x += (px - b.x) * ease
          b.y += (py - b.y) * ease
          b.vx = 0
          b.vy = 0
          if (b.phaseT <= 0 || Math.hypot(px - b.x, py - b.y) < 1.5) {
            b.state = 'perch'
            b.x = px
            b.y = py
            b.rest = 4 + b.rng() * 5
            b.wingPos = 0
            b.wingAim = 0
            b.wingT = 0.6 + b.rng() * 0.8
            b.shiftAim = 0
            b.visits++
          }
          break
        }
        case 'leave': {
          // Up and downwind, wandering; gusts run left to right.
          this.flight(b, dt, Math.atan2(-0.45, 1), 0.7, 130, wind)
          break
        }
      }
      if (b.state !== 'perch' && b.state !== 'land') {
        b.x += b.vx * dt
        b.y += b.vy * dt
      }
      return b.x > -80 && b.x < width + 80 && b.y > -80 && b.y < height + 40
    })
  }

  /**
   * A burst of flapping toward a heading, then a glide that slows and sinks, over and over.
   * Each burst picks the heading afresh, so the course jinks rather than curves.
   */
  private flight(
    b: Butterfly,
    dt: number,
    toward: number,
    spread: number,
    cruise: number,
    wind: Wind,
  ) {
    b.phaseT -= dt
    if (b.phaseT <= 0) {
      b.flapping = !b.flapping
      if (b.flapping) {
        b.phaseT = 0.25 + b.rng() * 0.45
        b.heading = toward + (b.rng() - 0.5) * 2 * spread
      } else b.phaseT = 0.1 + b.rng() * 0.4
    }
    let ax: number
    let ay: number
    if (b.flapping) {
      b.beat += dt * 8 * TAU
      // Thrust along the heading; each downstroke lifts a little, so the body bobs with the beat.
      ax = (Math.cos(b.heading) * cruise - b.vx) * 4
      ay = (Math.sin(b.heading) * cruise - b.vy) * 4 - Math.sin(b.beat) * 90
    } else {
      // Gliding on open wings: drag and a gentle sink.
      ax = -b.vx * 0.8
      ay = 70 - b.vy * 0.8
    }
    ax += wind.at(b.x, b.y, 0.5) * 25
    b.vx += ax * dt
    b.vy += ay * dt
  }

  /** On the flower: slow opens to bask and closes to rest, the odd flick, and a shuffle now and then. */
  private bask(b: Butterfly, dt: number, headR: number) {
    b.wingT -= dt
    if (b.wingT <= 0) {
      if (b.wingAim >= 2) {
        b.wingAim = 0
        b.wingT = 0.8 + b.rng() * 2
      } else if (b.wingAim === 0 && b.rng() < 0.3) {
        // A flick half shut and back, the way a basking butterfly tests the air.
        b.wingAim = 1
        b.wingT = 0.15
      } else {
        b.wingAim = 2
        b.wingT = 1 + b.rng() * 2.5
      }
    }
    // Closing is quicker than opening.
    const rate = b.wingAim > b.wingPos ? 7 : 4
    b.wingPos += clamp(b.wingAim - b.wingPos, -rate * dt, rate * dt)
    if (b.rng() < dt / 2.5) b.shiftAim = (b.rng() - 0.5) * headR * 0.5
    b.shift += clamp(b.shiftAim - b.shift, -18 * dt, 18 * dt)
  }

  /** A fast cursor nearby throws it back off the flower, wary, to come round again. */
  private scare(b: Butterfly, x: number, y: number) {
    const dx = b.x - x
    const dy = b.y - y
    const d = Math.hypot(dx, dy) || 1
    b.vx = (dx / d) * 220
    b.vy = (dy / d) * 120 - 120
    b.state = 'approach'
    b.shy = 1.5
    b.phaseT = 0
    b.flapping = false
  }

  /** Off the flower: a hop to a nearby one now and then, otherwise away. */
  private lift(b: Butterfly, heads: Head[]) {
    const taken = new Set(
      this.list
        .filter((o) => o !== b && o.state !== 'leave')
        .map((o) => o.target),
    )
    const others = heads
      .filter(
        (h) =>
          h.owner &&
          h.owner !== b.target &&
          !taken.has(h.owner) &&
          h.alpha > 0.5 &&
          Math.hypot(h.x - b.x, h.y - b.y) < HOP_RANGE,
      )
      .sort(
        (a, c) =>
          Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y),
      )
    const next = others[Math.floor(b.rng() * Math.min(3, others.length))]
    if (b.visits < 3 && b.shy <= 0 && next?.owner && b.rng() < 0.7)
      this.send(b, next.owner, next, true)
    else this.depart(b)
  }

  private depart(b: Butterfly) {
    b.state = 'leave'
    b.target = null
    b.phaseT = 0
    b.flapping = false
  }

  /** Wing pose: 0 open, 1 half, 2 folded. Beating wings cycle through all three; gliding ones stay open. */
  draw(r: Raster) {
    for (const b of this.list) {
      let pose: number
      if (b.state === 'perch') pose = Math.round(b.wingPos)
      else if (
        b.flapping ||
        b.state === 'circle' ||
        b.state === 'land' ||
        b.state === 'takeoff'
      ) {
        const s = Math.sin(b.beat)
        pose = s > 0.3 ? 0 : s > -0.3 ? 1 : 2
      } else pose = 0
      r.sprites.push({
        x: b.x,
        y: b.y,
        pose,
        look: b.look,
        kind: b.moth ? 'moth' : 'butterfly',
        span: b.span,
      })
    }
  }
}
