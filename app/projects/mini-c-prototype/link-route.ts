// Routes a "name → declaration" link around the other nodes of the tree,
// instead of arcing over them (Fable 5.1's proposal, 2026-09-24).
//
// Geometry. A Box is a pixel rectangle {x, y, w, h} with x, y its top-left
// corner, as the pieces sit in the scene (centre ± half width, pieceHalf).
// Tree edges are given as {from, to} pixel points and rebuilt into the same
// smoothstep cubic as animated.tsx `edgePath`, so the router can tell a
// square crossing from a run alongside one.
//
// Routing. Rows only hold boxes; edges only live in the channels between
// rows. So the route is orthogonal, on a sparse grid: x lines at every box
// side pushed out by the clearance (or to the middle of a narrow gap), at
// the middle of each wider gap in a row, and at the ports; y lines at each
// row's mid-height and the middle of each channel; lines closer than 3px
// merge. A* over (grid node, heading) charges length, a fixed price per
// bend, a small price for crossing an edge and a steep one for crossing it
// at under ~20° or running beside it, and more per px on the ring around
// the whole tree; boxes (inflated) are impassable. Ports keep clear of
// where edges attach: a link leaves the use from its side, and lands on the
// declaration's side facing the use, the bottom of a leaf, or, last resort,
// its top off centre. The turn out of the use and the turn into the
// declaration are free, so a route turns at the box, not a little way
// along the row. The winner gets quarter circles at the corners.
//
// Output. `d` is always `M` plus exactly SEGMENTS cubics (`C`), the unused
// ones collapsed to the end point, so motion can tween any two routes and a
// route to its `hook`, the first 16px of itself. Tweening two routes with a
// different number of bends matches cubics by index, so the middle frames
// wobble for the 0.4s of the transition but land right; the usual case
// (full route ↔ its hook, or one arc ↔ another) tweens cleanly. Without a
// clean route it returns the old lifted arc with `clean: false`.
//
// Styling proposal (CSS is in the handoff report, not here):
// - The step's link: 1px solid ink, drawn in with pathLength over the
//   normal transition, from the use to the declaration. Under it a 3px
//   background-coloured copy of the same path (a halo), so where the link
//   crosses a tree edge it visibly passes over it, like a wire.
// - The declaration end lands on the box border and gets a 2px ink dot with
//   a 1px background ring, popping in when the draw-in ends. The use end
//   has no marker: the focused piece is already inverted, and the wire
//   simply leaves its border.
// - A settled link keeps `hook`: the first 16px of its own route (out of the
//   side, one rounded turn), at 0.6 opacity, so it points the way the link
//   went. Since `d` and `hook` have the same shape, moving on reels the
//   route back into its hook and hovering pays it out again.
// - No dashes, no arrowheads; the error colour stays for errors.

export type Pt = { x: number; y: number }
export type Box = { x: number; y: number; w: number; h: number }
/** A tree edge as animated.tsx draws it: parent bottom to child top. */
export type Edge = { from: Pt; to: Pt }

export type Route = {
  /** `M` + SEGMENTS cubics, in pixels. */
  d: string
  /** The first 16px of `d` (out and round the first corner), same command
   * shape, for a settled link. */
  hook: string
  /** Where the route meets the use's border. */
  start: Pt
  /** Where it meets the declaration's border; put the dot here. */
  end: Pt
  /** False when no route clears every box and `d` is the old arc. */
  clean: boolean
  bends: number
}

export type RouteOptions = {
  /** Gap kept beside (x) and above/below (y) boxes; each shrinks to fit
   * the narrowest gap or channel. */
  clearance?: { x: number; y: number }
  /** Corner radius; shorter runs get a smaller one. */
  radius?: number
  /** Tree edges to cross squarely rather than run along. */
  edges?: Edge[]
  /** Room the route may use; defaults to the boxes' extent plus a margin. */
  bounds?: Box
}

export const SEGMENTS = 14

const BEND = 30
const CROSS = 6
const SHALLOW = 120
const ALONG = 40
const NEAR = 4
// Price per px on the outer ring around the tree.
const OUTER = 1.6
// Gaps narrower than this are walls, not corridors.
const CORRIDOR = 8
const SNAP = 3
// Out of the side, round the first corner, and 3px on: 10 × 9 px.
const HOOK = 16
const EPS = 0.01
const SAMPLES = 8

type Span = { a: number; b: number; cost: number }
type Line = {
  block: Span[]
  cross: { at: number; cost: number }[]
  along: Span[]
}
type Port = { at: Pt; node: Pt; cost: number; dir: number }
type Piece = { a: Pt; b: Pt }
type Rect = { x0: number; y0: number; x1: number; y1: number }

// Headings, as (dx, dy) grid steps.
const DIRS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
]

const same = (a: Box, b: Box) =>
  a === b || (a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h)

// Smoothstep cubic, sampled: the shape `edgePath` draws.
const pieces = (e: Edge): Piece[] => {
  const mid = (e.from.y + e.to.y) / 2
  const at = (t: number): Pt => {
    const u = 1 - t
    return {
      x: e.from.x * u * u * (1 + 2 * t) + e.to.x * t * t * (3 - 2 * t),
      y: e.from.y * u * u * u + mid * 3 * t * u + e.to.y * t * t * t,
    }
  }
  const out: Piece[] = []
  let prev = at(0)
  for (let i = 1; i <= SAMPLES; i++) {
    const next = at(i / SAMPLES)
    out.push({ a: prev, b: next })
    prev = next
  }
  return out
}

// Squared cosine of a piece's angle to the line: 0 square, 1 parallel.
// Shallow starts to cost at about 25° and is full price by 10°.
const shallow = (cos2: number) => {
  const s = Math.min(1, Math.max(0, (cos2 - 0.8) / 0.17))
  return CROSS + SHALLOW * s * s
}

// What a grid line meets: the boxes it runs into, each edge piece it
// crosses, priced by angle, and each near-parallel piece it runs beside.
const lineInfo = (
  rects: Rect[],
  edges: Piece[],
  vertical: boolean,
  at: number,
): Line => {
  const block: Span[] = []
  for (const r of rects) {
    const inside = vertical
      ? at > r.x0 + EPS && at < r.x1 - EPS
      : at > r.y0 + EPS && at < r.y1 - EPS
    if (inside)
      block.push(
        vertical
          ? { a: r.y0, b: r.y1, cost: 0 }
          : { a: r.x0, b: r.x1, cost: 0 },
      )
  }
  const cross: { at: number; cost: number }[] = []
  const along: Span[] = []
  for (const p of edges) {
    // Coordinates seen from the line: `u` across it, `v` along it.
    const au = vertical ? p.a.x : p.a.y,
      bu = vertical ? p.b.x : p.b.y
    const av = vertical ? p.a.y : p.a.x,
      bv = vertical ? p.b.y : p.b.x
    const du = bu - au,
      dv = bv - av
    const len = Math.hypot(du, dv)
    if (len < EPS) continue
    const cos2 = (dv * dv) / (len * len)
    const lo = Math.min(au, bu),
      hi = Math.max(au, bu)
    if (at > lo && at <= hi && Math.abs(du) > EPS) {
      const t = (at - au) / du
      cross.push({ at: av + t * dv, cost: shallow(cos2) })
    } else if (cos2 > 0.9 && at > lo - NEAR && at < hi + NEAR) {
      along.push({ a: Math.min(av, bv), b: Math.max(av, bv), cost: ALONG })
    }
  }
  return { block, cross, along }
}

const spanCost = (line: Line, a: number, b: number) => {
  const lo = Math.min(a, b),
    hi = Math.max(a, b)
  for (const s of line.block)
    if (hi > s.a + EPS && lo < s.b - EPS) return Infinity
  let cost = 0
  for (const c of line.cross) if (c.at > lo && c.at < hi) cost += c.cost
  for (const s of line.along) {
    const overlap = Math.min(hi, s.b) - Math.max(lo, s.a)
    if (overlap > 0) cost += (s.cost * overlap) / Math.max(EPS, s.b - s.a)
  }
  return cost
}

// Sorted, with lines closer than SNAP merged onto the first.
const snapped = (values: number[]) => {
  const out: number[] = []
  for (const v of [...values].sort((p, q) => p - q))
    if (!out.length || v - out[out.length - 1] > SNAP) out.push(v)
  return out
}
const snap = (v: number, lines: number[]) => {
  let best = lines[0]
  for (const l of lines) if (Math.abs(l - v) < Math.abs(best - v)) best = l
  return Math.abs(best - v) <= SNAP ? best : v
}

// Boxes with the same mid-height, in x order.
const rowsOf = (boxes: Box[]) => {
  const rows: Box[][] = []
  for (const b of [...boxes].sort((p, q) => p.y + p.h / 2 - (q.y + q.h / 2))) {
    const last = rows[rows.length - 1]
    if (last && Math.abs(last[0].y + last[0].h / 2 - (b.y + b.h / 2)) < 1)
      last.push(b)
    else rows.push([b])
  }
  for (const r of rows) r.sort((p, q) => p.x - q.x)
  return rows
}

// A small binary heap keyed on cost, ties by insertion, so equal routes
// come out the same every time.
class Heap {
  private items: { cost: number; seq: number; state: number }[] = []
  private seq = 0
  push(cost: number, state: number) {
    const items = this.items
    items.push({ cost, seq: this.seq++, state })
    let i = items.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (!this.less(items[i], items[p])) break
      ;[items[i], items[p]] = [items[p], items[i]]
      i = p
    }
  }
  pop() {
    const items = this.items
    const top = items[0]
    const last = items.pop()
    if (items.length && last) {
      items[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1,
          r = l + 1
        let m = i
        if (l < items.length && this.less(items[l], items[m])) m = l
        if (r < items.length && this.less(items[r], items[m])) m = r
        if (m === i) break
        ;[items[i], items[m]] = [items[m], items[i]]
        i = m
      }
    }
    return top
  }
  get size() {
    return this.items.length
  }
  private less(
    p: { cost: number; seq: number },
    q: { cost: number; seq: number },
  ) {
    return p.cost < q.cost || (p.cost === q.cost && p.seq < q.seq)
  }
}

export function linkRouter(obstacles: Box[], opts: RouteOptions = {}) {
  const radius = opts.radius ?? 6
  const clearX = opts.clearance?.x ?? 10
  const rows = rowsOf(obstacles)
  // Channels: between consecutive rows, and one above and one below.
  let channel = Infinity
  for (let i = 1; i < rows.length; i++) {
    const top = Math.min(...rows[i].map((b) => b.y))
    const bottom = Math.max(...rows[i - 1].map((b) => b.y + b.h))
    channel = Math.min(channel, top - bottom)
  }
  const clearY = Math.max(
    2,
    Math.min(opts.clearance?.y ?? 6, (channel - 3) / 2),
  )
  const bounds = opts.bounds ?? {
    x: Math.min(...obstacles.map((b) => b.x)) - clearX - 12,
    y: Math.min(...obstacles.map((b) => b.y)) - clearY - 12,
    w: 0,
    h: 0,
  }
  if (!opts.bounds) {
    bounds.w =
      Math.max(...obstacles.map((b) => b.x + b.w)) + clearX + 12 - bounds.x
    bounds.h =
      Math.max(...obstacles.map((b) => b.y + b.h)) + clearY + 12 - bounds.y
  }

  // Inflated boxes. Beside a narrow gap the clearance shrinks to half the
  // gap, so the middle of the gap stays open; a gap too narrow to be a
  // corridor is closed.
  const side = new Map<Box, { left: number; right: number }>()
  for (const row of rows)
    row.forEach((b, k) => {
      const gap = (m: number) =>
        m < 0 || m >= row.length
          ? Infinity
          : m < k
            ? b.x - (row[m].x + row[m].w)
            : row[m].x - (b.x + b.w)
      const fit = (g: number) =>
        g < CORRIDOR ? clearX : Math.min(clearX, g / 2)
      side.set(b, { left: fit(gap(k - 1)), right: fit(gap(k + 1)) })
    })
  const rects: Rect[] = obstacles.map((b) => {
    const s = side.get(b) ?? { left: clearX, right: clearX }
    return {
      x0: b.x - s.left,
      y0: b.y - clearY,
      x1: b.x + b.w + s.right,
      y1: b.y + b.h + clearY,
    }
  })
  const edgePieces = (opts.edges ?? []).flatMap(pieces)
  const vLines = new Map<number, Line>()
  const hLines = new Map<number, Line>()
  const line = (vertical: boolean, at: number) => {
    const cache = vertical ? vLines : hLines
    let info = cache.get(at)
    if (!info) {
      info = lineInfo(rects, edgePieces, vertical, at)
      cache.set(at, info)
    }
    return info
  }

  const baseXs: number[] = [bounds.x, bounds.x + bounds.w]
  const baseYs: number[] = [bounds.y, bounds.y + bounds.h]
  for (const r of rects) baseXs.push(r.x0, r.x1)
  rows.forEach((row, i) => {
    baseYs.push(row[0].y + row[0].h / 2)
    for (let k = 1; k < row.length; k++) {
      const gap = row[k].x - (row[k - 1].x + row[k - 1].w)
      if (gap > clearX * 2) baseXs.push(row[k - 1].x + row[k - 1].w + gap / 2)
    }
    if (i) {
      const top = Math.min(...row.map((b) => b.y))
      const bottom = Math.max(...rows[i - 1].map((b) => b.y + b.h))
      baseYs.push((top + bottom) / 2)
    }
  })
  const gridXs = snapped(baseXs)
  const gridYs = snapped(baseYs)

  // Ports: where a route may meet a box, the grid node it goes through,
  // its heading there (leaving, or arriving), and a preference.
  const sidePorts = (b: Box, lean: number, leaving: boolean): Port[] => {
    const cy = snap(b.y + b.h / 2, gridYs)
    const s = side.get(b) ?? { left: clearX, right: clearX }
    return [lean, -lean].map((dir, i) => ({
      at: { x: dir > 0 ? b.x + b.w : b.x, y: cy },
      node: {
        x: snap(dir > 0 ? b.x + b.w + s.right : b.x - s.left, gridXs),
        y: cy,
      },
      cost: i ? 40 : 0,
      // Leaving heads outward; arriving heads inward.
      dir: dir > 0 === leaving ? 0 : 2,
    }))
  }
  const endPorts = (b: Box, lean: number): Port[] => {
    const cx = b.x + b.w / 2
    const below = gridYs.find((y) => y >= b.y + b.h + clearY - SNAP)
    const above = [...gridYs].reverse().find((y) => y <= b.y - clearY + SNAP)
    // The side facing the use is the near one.
    const out = sidePorts(b, -lean, false)
    // A snapped line may sit a couple of px off centre; the port follows
    // it so the stub stays vertical.
    const under = snap(cx, gridXs)
    if (below !== undefined)
      out.push({
        at: { x: under, y: b.y + b.h },
        node: { x: under, y: below },
        cost: 8,
        dir: 3,
      })
    if (above !== undefined)
      for (const [dir, cost] of [
        [-lean, 25],
        [lean, 45],
      ]) {
        const x = snap(cx + (dir * b.w) / 4, gridXs)
        if (Math.abs(x - cx) < 4) continue
        out.push({ at: { x, y: b.y }, node: { x, y: above }, cost, dir: 1 })
      }
    return out
  }

  // A stub between a port and its grid node may sit inside its own box's
  // clearance, so it is checked against the other boxes only.
  const stubCost = (p: Port, own: Box[]) => {
    const vertical = Math.abs(p.at.x - p.node.x) < EPS
    const at = vertical ? p.at.x : p.at.y
    const a = vertical ? p.at.y : p.at.x,
      b = vertical ? p.node.y : p.node.x
    const lo = Math.min(a, b) + EPS,
      hi = Math.max(a, b) - EPS
    for (let i = 0; i < rects.length; i++) {
      if (own.some((k) => same(k, obstacles[i]))) continue
      const r = rects[i]
      const inside = vertical
        ? at > r.x0 + EPS && at < r.x1 - EPS
        : at > r.y0 + EPS && at < r.y1 - EPS
      if (!inside) continue
      if (hi > (vertical ? r.y0 : r.x0) && lo < (vertical ? r.y1 : r.x1))
        return Infinity
    }
    const info = line(vertical, at)
    let cost = p.cost
    for (const c of info.cross) if (c.at > lo && c.at < hi) cost += c.cost
    for (const s of info.along) {
      const overlap = Math.min(hi, s.b) - Math.max(lo, s.a)
      if (overlap > 0) cost += (s.cost * overlap) / Math.max(EPS, s.b - s.a)
    }
    return cost
  }

  const route = (from: Box, to: Box): Route => {
    const fc = { x: from.x + from.w / 2, y: from.y + from.h / 2 }
    const tc = { x: to.x + to.w / 2, y: to.y + to.h / 2 }
    const lean = Math.sign(tc.x - fc.x) || -1
    const fallback = (): Route => {
      const lift = 28 + Math.abs(fc.x - tc.x) * 0.12
      const a = { x: fc.x, y: from.y },
        b = { x: tc.x, y: to.y }
      const d = cubics(a, [
        [{ x: a.x, y: a.y - lift }, { x: b.x, y: b.y - lift }, b],
      ])
      return {
        d,
        hook: cubics(a, [
          [
            { x: a.x, y: a.y - HOOK / 2 },
            { x: a.x, y: a.y - HOOK },
            { x: a.x, y: a.y - HOOK },
          ],
        ]),
        start: a,
        end: b,
        clean: false,
        bends: 0,
      }
    }
    const starts = sidePorts(from, lean, true)
    const ends = endPorts(to, lean)
    const ports = [...starts, ...ends]
    const xs = snapped([...gridXs, ...ports.map((p) => p.node.x)])
    const ys = snapped([...gridYs, ...ports.map((p) => p.node.y)])
    const nx = xs.length,
      ny = ys.length
    const index = (v: number, arr: number[]) => {
      let lo = 0,
        hi = arr.length - 1
      while (lo < hi) {
        const m = (lo + hi) >> 1
        if (arr[m] < v - EPS) lo = m + 1
        else hi = m
      }
      return Math.abs(arr[lo] - v) <= EPS ? lo : -1
    }
    const own = [from, to]

    // A grid segment's price, worked out once per query: its length, what
    // its line meets there, and a surcharge on the outer ring, which is a
    // detour around the whole tree rather than a way through it.
    const segs = new Float64Array(nx * ny * 2).fill(NaN)
    const segCost = (i: number, j: number, vertical: boolean) => {
      const k = (j * nx + i) * 2 + (vertical ? 1 : 0)
      let cost = segs[k]
      if (Number.isNaN(cost)) {
        const a = vertical ? ys[j] : xs[i],
          b = vertical ? ys[j + 1] : xs[i + 1]
        const at = vertical ? xs[i] : ys[j]
        const outer = vertical
          ? i === 0 || i === nx - 1
          : j === 0 || j === ny - 1
        cost =
          (b - a) * (outer ? OUTER : 1) + spanCost(line(vertical, at), a, b)
        segs[k] = cost
      }
      return cost
    }

    // A* over (node, heading): the heuristic is the Manhattan distance to
    // the nearest goal node, which no route can beat.
    const states = nx * ny * 4
    const dist = new Float64Array(states).fill(Infinity)
    const prev = new Int32Array(states).fill(-1)
    const goalCost = new Float64Array(states).fill(Infinity)
    const goalPort: Port[] = []
    const goalAt: Pt[] = []
    for (const p of ends) {
      const i = index(p.node.x, xs),
        j = index(p.node.y, ys)
      const cost = stubCost(p, own)
      if (i < 0 || j < 0 || cost === Infinity) continue
      goalAt.push(p.node)
      // The turn into a port is part of the connector, not a bend, so a
      // route turns at the box rather than a little way along the row.
      const node = j * nx + i
      for (let d = 0; d < 4; d++) {
        if ((d + 2) % 4 === p.dir) continue
        const s = node * 4 + d
        if (cost < goalCost[s]) {
          goalCost[s] = cost
          goalPort[s] = p
        }
      }
    }
    if (!goalAt.length) return fallback()
    const guesses = new Float64Array(nx * ny)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        let h = Infinity
        for (const g of goalAt) {
          const dx = Math.abs(g.x - xs[i]),
            dy = Math.abs(g.y - ys[j])
          // Off both axes takes at least one bend.
          h = Math.min(h, dx + dy + (dx > EPS && dy > EPS ? BEND : 0))
        }
        guesses[j * nx + i] = h
      }
    const guess = (i: number, j: number) => guesses[j * nx + i]
    const heap = new Heap()
    for (const p of starts) {
      const i = index(p.node.x, xs),
        j = index(p.node.y, ys)
      const cost = stubCost(p, own)
      if (i < 0 || j < 0 || cost === Infinity) continue
      // Likewise the turn out of the port: straight on, up or down.
      for (const d of [p.dir, 1, 3]) {
        const s = (j * nx + i) * 4 + d
        if (cost < dist[s]) {
          dist[s] = cost
          heap.push(cost + guess(i, j), s)
        }
      }
    }
    let best: { state: number; total: number } | undefined
    while (heap.size) {
      const { cost: f, state } = heap.pop()
      if (best && f >= best.total) break
      const cost = dist[state]
      const node = state >> 2,
        dir = state & 3
      const i = node % nx,
        j = (node - i) / nx
      if (f > cost + guess(i, j) + EPS) continue
      if (cost + goalCost[state] < (best?.total ?? Infinity))
        best = { state, total: cost + goalCost[state] }
      for (let d = 0; d < 4; d++) {
        if ((d + 2) % 4 === dir) continue
        const ni = i + DIRS[d][0],
          nj = j + DIRS[d][1]
        if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue
        const vertical = d === 1 || d === 3
        const extra = segCost(Math.min(i, ni), Math.min(j, nj), vertical)
        if (extra === Infinity) continue
        const step = extra + (d === dir ? 0 : BEND)
        const next = (nj * nx + ni) * 4 + d
        if (cost + step < dist[next]) {
          dist[next] = cost + step
          prev[next] = state
          heap.push(cost + step + guess(ni, nj), next)
        }
      }
    }
    if (!best) return fallback()
    const port = goalPort[best.state]

    // Grid nodes back to the start, then the ports on either end.
    const points: Pt[] = []
    for (let s = best.state; s >= 0; s = prev[s]) {
      const node = s >> 2
      const i = node % nx
      points.push({ x: xs[i], y: ys[(node - i) / nx] })
    }
    points.reverse()
    const first = points[0]
    const start = starts.find(
      (p) =>
        Math.abs(p.node.x - first.x) < EPS &&
        Math.abs(p.node.y - first.y) < EPS,
    )
    if (!start) return fallback()
    points.unshift(start.at)
    points.push(port.at)
    const poly = simplify(points)
    const bends = poly.length - 2
    if (bends + 1 + bends > SEGMENTS) return fallback()
    const full = rounded(poly, radius)
    return {
      d: cubics(poly[0], full),
      hook: cubics(poly[0], hookOf(poly[0], full)),
      start: poly[0],
      end: poly[poly.length - 1],
      clean: true,
      bends,
    }
  }
  return { route }
}

/** One-off: builds the router and routes a single link. */
export const routeLink = (
  from: Box,
  to: Box,
  obstacles: Box[],
  opts?: RouteOptions,
) => linkRouter(obstacles, opts).route(from, to)

// Drops repeated and collinear points.
const simplify = (points: Pt[]) => {
  const out: Pt[] = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.x - p.x) < EPS && Math.abs(last.y - p.y) < EPS)
      continue
    const before = out[out.length - 2]
    if (
      last &&
      before &&
      ((Math.abs(before.x - last.x) < EPS && Math.abs(last.x - p.x) < EPS) ||
        (Math.abs(before.y - last.y) < EPS && Math.abs(last.y - p.y) < EPS))
    )
      out[out.length - 1] = p
    else out.push(p)
  }
  return out
}

type Cubic = [Pt, Pt, Pt]
const K = 0.5523

// Straight runs with quarter circles at the corners, each as a cubic.
const rounded = (poly: Pt[], radius: number): Cubic[] => {
  const out: Cubic[] = []
  let at = poly[0]
  for (let i = 1; i < poly.length; i++) {
    const p = poly[i]
    const last = i === poly.length - 1
    const dir = unit(at, p)
    let r = 0
    if (!last) {
      const next = poly[i + 1]
      r = Math.min(radius, dist(at, p) / 2, dist(p, next) / 2)
    }
    const end = { x: p.x - dir.x * r, y: p.y - dir.y * r }
    out.push(straight(at, end))
    if (!last && r > EPS) {
      const out2 = unit(p, poly[i + 1])
      const after = { x: p.x + out2.x * r, y: p.y + out2.y * r }
      out.push([
        { x: end.x + dir.x * r * K, y: end.y + dir.y * r * K },
        { x: after.x - out2.x * r * K, y: after.y - out2.y * r * K },
        after,
      ])
      at = after
    } else at = p
  }
  return out
}

const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y)
const unit = (a: Pt, b: Pt) => {
  const d = dist(a, b) || 1
  return { x: (b.x - a.x) / d, y: (b.y - a.y) / d }
}
const straight = (a: Pt, b: Pt): Cubic => [
  { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 },
  { x: a.x + ((b.x - a.x) * 2) / 3, y: a.y + ((b.y - a.y) * 2) / 3 },
  b,
]

// The first HOOK px of a route: cubics whole while they fit, the next one
// cut short, the rest collapsed onto the tip.
const hookOf = (start: Pt, full: Cubic[]): Cubic[] => {
  const out: Cubic[] = []
  let at = start
  let left = HOOK
  for (const c of full) {
    // Cubic length, by its polygon: close enough for straights and arcs.
    const len = dist(at, c[0]) + dist(c[0], c[1]) + dist(c[1], c[2])
    if (len <= left) {
      out.push(c)
      left -= len
      at = c[2]
      if (left <= EPS) break
      continue
    }
    if (left > EPS) out.push(split(at, c, left / len))
    break
  }
  return out
}

// The first `t` of a cubic (de Casteljau).
const split = (a: Pt, c: Cubic, t: number): Cubic => {
  const mix = (p: Pt, q: Pt): Pt => ({
    x: p.x + (q.x - p.x) * t,
    y: p.y + (q.y - p.y) * t,
  })
  const ab = mix(a, c[0]),
    bc = mix(c[0], c[1]),
    cd = mix(c[1], c[2])
  const abc = mix(ab, bc),
    bcd = mix(bc, cd)
  return [ab, abc, mix(abc, bcd)]
}

const n = (v: number) => (Math.round(v * 100) / 100).toString()
const cubics = (start: Pt, list: Cubic[]) => {
  let at = start
  const parts = [`M ${n(start.x)} ${n(start.y)}`]
  for (let i = 0; i < SEGMENTS; i++) {
    const c = list[i] ?? [at, at, at]
    parts.push(
      `C ${n(c[0].x)} ${n(c[0].y)}, ${n(c[1].x)} ${n(c[1].y)}, ${n(c[2].x)} ${n(c[2].y)}`,
    )
    at = c[2]
  }
  return parts.join(' ')
}
