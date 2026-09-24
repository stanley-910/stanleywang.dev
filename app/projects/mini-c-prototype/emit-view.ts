// The emit phase in blocks (Astra's emit answer, 2026-09-24): instead of a
// step per AST node, a leaf's instructions (a literal, a name's load, an
// assignment's target address) join the step of the operation that uses
// them, when that operation comes next. A leaf that waits for a sibling's
// work keeps its own step, so the viewer sees it held beside its parent.
import { parentsOf } from './parse-view'

import type { Frame, Instruction, Trace } from './trace'

export type EmitPart = { node: number; from: number; to: number }

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
  frames.forEach((frame, i) => {
    const w = frame.why
    if (w.kind !== 'emit.instr') {
      out.push(frame)
      return
    }
    parts.push({ frame, part: { node: w.node, from: w.from, to: w.to } })
    const target = isTargetAddress(trace, frames, i)
    const joins = target || isLeaf(trace, w.node)
    // The operation this piece feeds: the assignment itself for a target
    // address, else the parent node.
    const owner = target ? w.node : parents.get(w.node)
    let next = i + 1
    while (
      next < frames.length &&
      frames[next].why.kind === 'emit.instr' &&
      (isLeaf(trace, (frames[next].why as { node: number }).node) ||
        isTargetAddress(trace, frames, next))
    )
      next++
    const after = frames[next]?.why
    const fed =
      after?.kind === 'emit.instr' &&
      owner !== undefined &&
      after.node === owner
    if (joins && fed) return
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

/**
 * The value each emitted node leaves behind, and whether it is an address
 * (an assignment's target, `addi vN,$fp,-8`) or a value.
 */
export function resultOf(
  instructions: Instruction[],
  part: EmitPart,
  target: boolean,
): { reg: string; address: boolean } | null {
  const run = instructions.slice(part.from, part.to + 1)
  if (target) {
    const address = run.find((ins) => ins.dest?.startsWith('v'))
    return address?.dest ? { reg: address.dest, address: true } : null
  }
  const last = [...run].reverse().find((ins) => ins.dest?.startsWith('v'))
  return last?.dest ? { reg: last.dest, address: false } : null
}
