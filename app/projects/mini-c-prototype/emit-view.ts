// The emit phase in blocks (Astra's emit answer, 2026-09-24): instead of a
// step per AST node, the pieces an operation uses (a literal, a name's load,
// an assignment's target address) arrive together in one step when they
// come one after another. The operation keeps a step of its own, where their
// registers travel up into it (Stanley: the funnelling went by too fast when
// it shared their step). A piece that waits for a sibling's work keeps its
// own step, so the viewer sees it held beside its parent.
import { parentsOf } from './parse-view'

import type { Frame, Trace } from './trace'

type EmitPart = { node: number; from: number; to: number }

const isLeaf = (trace: Trace, id: number) => {
  const kind = trace.nodes[id].kind
  return kind === 'number' || kind === 'name'
}

// An assignment's first step computes its target's address; its store
// comes after the value.
const isTargetAddress = (trace: Trace, frames: Frame[], i: number) => {
  const w = frames[i].why
  if (w.kind !== 'emit.instr' || trace.nodes[w.node].kind !== 'assign')
    return false
  return frames
    .slice(i + 1)
    .some((f) => f.why.kind === 'emit.instr' && f.why.node === w.node)
}

export function withEmitBlocks(trace: Trace): Trace {
  const parents = parentsOf(trace)
  const frames = trace.frames
  const out: Frame[] = []
  let parts: { frame: Frame; part: EmitPart }[] = []
  // The operation a piece feeds: the assignment itself for a target
  // address, else the parent node; not a piece, undefined.
  const ownerOf = (at: number) => {
    const why = frames[at]?.why
    if (why?.kind !== 'emit.instr') return undefined
    if (isTargetAddress(trace, frames, at)) return why.node
    return isLeaf(trace, why.node) ? parents.get(why.node) : undefined
  }
  frames.forEach((frame, i) => {
    const w = frame.why
    if (w.kind !== 'emit.instr') {
      out.push(frame)
      return
    }
    parts.push({ frame, part: { node: w.node, from: w.from, to: w.to } })
    // Pieces join while the next one feeds the same operation.
    const owner = ownerOf(i)
    if (owner !== undefined && ownerOf(i + 1) === owner) return
    const first = parts[0].part
    out.push({
      ...frame,
      title: parts.map((p) => p.frame.title).join('  ·  '),
      why: { ...w, from: first.from, parts: parts.map((p) => p.part) },
    })
    parts = []
  })
  return { ...trace, frames: out }
}

// Emit leaves out pushRegisters and popRegisters: which registers a
// function saves isn't known until register allocation, which adds them
// (Stanley, 2026-10-01). Their own steps go; a step whose run includes one
// (a whole prologue, in blocks) keeps it, and the listing hides its row.
export const isPlaceholder = (op: string) =>
  op === 'pushRegisters' || op === 'popRegisters'
export function withoutPlaceholders(trace: Trace): Trace {
  const frames = trace.frames.filter((frame) => {
    const w = frame.why
    return !(
      (w.kind === 'emit.instr' ||
        w.kind === 'emit.prologue' ||
        w.kind === 'emit.epilogue') &&
      w.from === w.to &&
      isPlaceholder(trace.instructions[w.from]?.op ?? '')
    )
  })
  return { ...trace, frames }
}

// Line by line (the default): a step per instruction. A node's run of
// several lines, and a function's prologue and epilogue, split into one
// step per line; each keeps the whole run in `of`, so the note can say
// where in it the line falls.
export function withEmitLines(trace: Trace): Trace {
  const frames = trace.frames.flatMap((frame) => {
    const w = frame.why
    if (
      (w.kind !== 'emit.instr' &&
        w.kind !== 'emit.prologue' &&
        w.kind !== 'emit.epilogue') ||
      w.from >= w.to
    )
      return [frame]
    return Array.from({ length: w.to - w.from + 1 }, (_, k) => ({
      ...frame,
      instructionCount: frame.instructionCount - (w.to - w.from - k),
      why: {
        ...w,
        from: w.from + k,
        to: w.from + k,
        of: { from: w.from, to: w.to },
      },
    }))
  })
  return { ...trace, frames }
}
