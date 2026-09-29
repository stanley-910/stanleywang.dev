// Where the interference graph's nodes sit, rather than a ring in numeric
// order that sent a busy node's edges across the whole graph. Each group
// of registers joined by edges gets a spring layout (Fruchterman and
// Reingold), so the ones that interfere sit together; the groups are then
// packed in rows shaped like the view, the biggest first and registers
// with no edges last. No randomness: a program always lays out the same way.

type GraphLayout = {
  at: Map<string, { x: number; y: number }>
  // Half the extent each way, about the centre (0, 0).
  halfW: number
  halfH: number
}

// Ideal edge length, and the least room between two nodes' centres (the
// nodes are 38px across), in scene pixels.
const EDGE = 84
const ROOM = 58
const ROUNDS = 360

export function springLayout(
  nodes: readonly string[],
  edges: readonly (readonly [string, string])[],
  // The view's width over its height, which the rows are shaped to.
  aspect = 1.4,
): GraphLayout {
  const index = new Map(nodes.map((v, i) => [v, i]))
  const near = nodes.map(() => [] as number[])
  for (const [a, b] of edges) {
    const i = index.get(a),
      j = index.get(b)
    if (i === undefined || j === undefined || i === j) continue
    near[i].push(j)
    near[j].push(i)
  }
  // The groups, each in the order its registers were numbered.
  const group = new Array<number>(nodes.length).fill(-1)
  const groups: number[][] = []
  nodes.forEach((_, i) => {
    if (group[i] >= 0) return
    const members = [i]
    group[i] = groups.length
    for (let k = 0; k < members.length; k++)
      for (const j of near[members[k]])
        if (group[j] < 0) {
          group[j] = groups.length
          members.push(j)
        }
    groups.push(members.sort((a, b) => a - b))
  })
  const placed = groups.map((members) => settle(members, near))
  // Biggest first; registers with no edges keep their numeric order at the end.
  const order = placed
    .map((_, g) => g)
    .sort((a, b) => groups[b].length - groups[a].length || a - b)
  const area = placed.reduce((sum, p) => sum + (p.w + GAP) * (p.h + GAP), 0)
  const width = Math.max(
    Math.max(...placed.map((p) => p.w)),
    Math.sqrt(area * aspect),
  )
  const at = new Map<string, { x: number; y: number }>()
  let x = 0,
    y = 0,
    row = 0,
    right = 0
  for (const g of order) {
    const p = placed[g]
    if (x > 0 && x + p.w > width) {
      x = 0
      y += row + GAP
      row = 0
    }
    p.members.forEach((m, k) =>
      at.set(nodes[m], { x: x + p.x[k], y: y + p.y[k] }),
    )
    x += p.w + GAP
    right = Math.max(right, x - GAP)
    row = Math.max(row, p.h)
  }
  const bottom = y + row
  for (const p of at.values()) {
    p.x -= right / 2
    p.y -= bottom / 2
  }
  return { at, halfW: right / 2, halfH: bottom / 2 }
}

// Between groups, edge to edge.
const GAP = 34

// One group's spring layout, from a ring, then any two nodes still too
// close pushed apart; offsets from its top left corner, which is ROOM / 2
// out from its outermost nodes.
function settle(members: number[], near: number[][]) {
  const n = members.length
  const local = new Map(members.map((m, k) => [m, k]))
  const start = n > 1 ? (EDGE * Math.sqrt(n)) / 2 : 0
  const x = members.map((_, k) => Math.cos((k / n) * Math.PI * 2) * start)
  const y = members.map((_, k) => Math.sin((k / n) * Math.PI * 2) * start)
  const links: [number, number][] = []
  members.forEach((m, k) => {
    for (const j of near[m]) {
      const l = local.get(j)
      if (l !== undefined && l > k) links.push([k, l])
    }
  })
  const dx = new Array<number>(n)
  const dy = new Array<number>(n)
  for (let round = 0; n > 1 && round < ROUNDS; round++) {
    dx.fill(0)
    dy.fill(0)
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        let ex = x[i] - x[j],
          ey = y[i] - y[j]
        let d = Math.hypot(ex, ey)
        // (two on one spot part along a fixed direction)
        if (d < 0.01) {
          ex = 0.01 * (1 + (i % 3))
          ey = 0.01 * (1 + (j % 3))
          d = Math.hypot(ex, ey)
        }
        const push = (EDGE * EDGE) / d
        dx[i] += (ex / d) * push
        dy[i] += (ey / d) * push
        dx[j] -= (ex / d) * push
        dy[j] -= (ey / d) * push
      }
    for (const [i, j] of links) {
      const ex = x[i] - x[j],
        ey = y[i] - y[j]
      const d = Math.max(0.01, Math.hypot(ex, ey))
      const pull = (d * d) / EDGE
      dx[i] -= (ex / d) * pull
      dy[i] -= (ey / d) * pull
      dx[j] += (ex / d) * pull
      dy[j] += (ey / d) * pull
    }
    const heat = EDGE * (1 - round / ROUNDS) + 1
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(dx[i], dy[i])
      if (d > 0) {
        x[i] += (dx[i] / d) * Math.min(d, heat)
        y[i] += (dy[i] / d) * Math.min(d, heat)
      }
    }
  }
  for (let pass = 0; pass < 40; pass++) {
    let moved = false
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const ex = x[i] - x[j],
          ey = y[i] - y[j]
        const d = Math.hypot(ex, ey)
        if (d >= ROOM) continue
        moved = true
        const k = (ROOM - d) / 2 / Math.max(d, 0.01)
        x[i] += ex * k
        y[i] += ey * k
        x[j] -= ex * k
        y[j] -= ey * k
      }
    if (!moved) break
  }
  const left = Math.min(...x) - ROOM / 2
  const top = Math.min(...y) - ROOM / 2
  return {
    members,
    x: x.map((v) => v - left),
    y: y.map((v) => v - top),
    w: Math.max(...x) - left + ROOM / 2,
    h: Math.max(...y) - top + ROOM / 2,
  }
}
