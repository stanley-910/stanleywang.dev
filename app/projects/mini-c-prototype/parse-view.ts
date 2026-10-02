import type { Frame, Trace } from './trace'

// How the parse phase shows precedence in the tree itself, rather than in a
// call stack or a table (GPT-6 Astra's "held operand" proposal, 2026-09-24;
// docs/handoffs/2026-09-24-parse-visual-astra-answer.md).
//
// The finished tree's layout is the target. Until a node is attached, it
// sits in the open slot of its nearest shown ancestor: after `4 +`, the `2`
// waits where the right side of `+` will be. When an operator between them
// appears (`×`), the node moves down under it, and a finished subtree moves
// into its parent's slot as one piece.

type Point = { x: number; y: number }

type ParseView = {
  /** Offset from the finished layout, in tree units, per shown node. */
  shift: Map<number, Point>
  /** An incoming operator shown a step early, where it will sit. */
  preview?: number
  /** [holder, node]: shown but not yet attached, drawn as a dashed socket. */
  held: [number, number][]
  /** One short word on one node: why this step went the way it did. */
  cue?: { node: number; text: string }
  /** Parenthesised nodes while their group is being read. */
  group?: { nodes: number[]; slot: number; closed: boolean }
  /** Operators waiting outside an open group. */
  outside: number[]
}

const EMPTY: ParseView = { shift: new Map(), held: [], outside: [] }

export const parentsOf = (trace: Trace) => {
  const parent = new Map<number, number>()
  for (const n of trace.nodes) for (const c of n.children) parent.set(c, n.id)
  return parent
}

// Groups as [open frame, sealing frame, span], matched innermost first. A
// group seals on the step that finished it (`Frame.sealed`); one still open
// at a parse error has no sealing frame and is left out.
export const groupsOf = (frames: Frame[]) => {
  const open: number[] = []
  const groups: { open: number; closed: number; start: number; end: number }[] =
    []
  const seal = (i: number, span: { start: number; end: number }) => {
    const at = open.pop()
    if (at !== undefined)
      groups.push({ open: at, closed: i, start: span.start, end: span.end })
  }
  frames.forEach((f, i) => {
    if (f.why.kind === 'parse.group') open.push(i)
    for (const span of f.sealed ?? []) seal(i, span)
  })
  return groups
}

export function parseView(
  trace: Trace,
  index: number,
  parent: Map<number, number>,
  groups: ReturnType<typeof groupsOf>,
  at: Record<number, Point>,
): ParseView {
  const frame = trace.frames[index]
  if (frame.phase !== 'Parse' || frame.why.kind === 'parse.done') return EMPTY
  const w = frame.why
  const shown = new Set(frame.nodes)
  const attached = new Set(frame.attached)

  // A tighter operator is shown at its slot a step early, so the operand it
  // takes moves under it as the decision is made.
  let preview: number | undefined
  if (w.kind === 'parse.precedence' && w.relation === 'tighter') {
    const p = parent.get(w.child)
    if (p !== undefined && !shown.has(p)) preview = p
  }
  if (preview !== undefined) shown.add(preview)

  // Nearest shown ancestor, and its child on the way down (the slot).
  const holder = (id: number) => {
    let slot = id
    let a = parent.get(id)
    while (a !== undefined && !shown.has(a)) {
      slot = a
      a = parent.get(a)
    }
    return { holder: a, slot }
  }
  const shift = new Map<number, Point>()
  const shiftOf = (id: number): Point => {
    const known = shift.get(id)
    if (known) return known
    const { holder: a, slot } = holder(id)
    let s = { x: 0, y: 0 }
    if (a !== undefined) {
      const base = shiftOf(a)
      s =
        slot === id || !at[slot] || !at[id]
          ? base
          : {
              x: base.x + at[slot].x - at[id].x,
              y: base.y + at[slot].y - at[id].y,
            }
    }
    shift.set(id, s)
    return s
  }
  for (const id of shown) shiftOf(id)

  const held: [number, number][] = []
  for (const id of shown) {
    if (attached.has(id)) continue
    const { holder: a } = holder(id)
    if (a !== undefined) held.push([a, id])
  }

  const next = trace.frames[index + 1]
  let cue: ParseView['cue']
  if (w.kind === 'parse.precedence') {
    const focus = frame.focus
    // A second `=` wins by grouping right to left, not by binding tighter.
    const tighter =
      w.incoming === '=' && w.pending === '=' ? 'right to left' : 'tighter'
    if (w.relation === 'tighter' && preview !== undefined)
      cue = { node: preview, text: tighter }
    else if (w.relation === 'tighter') {
      const p = parent.get(w.child)
      if (p !== undefined) cue = { node: p, text: tighter }
    } else if (focus !== null) {
      const pending = trace.nodes[focus]
      cue = {
        node: focus,
        text:
          pending.kind === 'unary'
            ? 'prefix first'
            : w.relation === 'equal'
              ? 'left first'
              : `${pending.label} first`,
      }
    }
  } else if (w.kind === 'parse.node' && next?.why.kind === 'parse.precedence')
    cue = { node: w.node, text: 'held' }

  // The innermost group being read, kept until its piece is attached.
  let group: ParseView['group']
  let groupStart = -1
  for (const g of groups) {
    const root = trace.frames[g.closed].focus
    if (index < g.open || root === null || g.start < groupStart) continue
    if (index > g.closed && attached.has(root)) continue
    const nodes = [...shown].filter((id) => {
      const t = trace.tokens[trace.nodes[id].token]
      return t && t.start >= g.start && t.start < g.end
    })
    group = { nodes, slot: root, closed: index >= g.closed }
    groupStart = g.start
  }
  // Where the group's piece goes, for brackets with nothing in them yet.
  if (group) shiftOf(group.slot)
  // Operators still waiting outside an open group: nothing inside it
  // competes with them.
  const inside = new Set(group?.nodes)
  const outside =
    group && !group.closed
      ? [...shown].filter((id) => {
          const n = trace.nodes[id]
          return (
            (n.kind === 'binary' || n.kind === 'unary') &&
            !inside.has(id) &&
            n.children.some((c) => !attached.has(c))
          )
        })
      : []

  return { shift, preview, held, cue, group, outside }
}
