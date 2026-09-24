// The emit phase's stack column (Astra's and Fable's emit answers,
// 2026-09-24): one function's frame, worked out from the instructions the
// compiler wrote, word by word. Addresses are bytes from where `$sp` stood
// when the function was entered, so the caller's words (return slot,
// arguments) sit at 0 and above and this frame's below.
import type { Instruction, Trace } from './trace'

export type StackPose = {
  sp: number
  /** null before `$fp` is set up, and once the caller's is restored. */
  fp: number | null
  /** Words in use below the caller's, top down. */
  low: number
  /** The `pushRegisters` placeholder's word, until `popRegisters`. */
  saved: number | null
}

export type StackTouch = { at: number; addr: number; kind: 'read' | 'write' }

export type StackFrame = {
  fn: number
  first: number
  last: number
  /** Pose after each instruction, from `first` (poses[0] is at entry). */
  poses: StackPose[]
  labels: Map<number, string>
  touches: StackTouch[]
  /** Highest word shown: the caller's return slot or last argument. */
  top: number
}

const imm = (s: string) => Number(s)
const nameOf = (trace: Trace, node: number | null) => {
  if (node === null) return undefined
  const n = trace.nodes[node]
  if (n.kind === 'name') return n.label
  if (n.kind === 'assign') return n.label.replace(/\s*=$/, '')
  return undefined
}

export function stackFrames(trace: Trace): StackFrame[] {
  const out: StackFrame[] = []
  const ins = trace.instructions
  let start = 0
  while (start < ins.length) {
    const fn = ins[start].fn
    if (fn === undefined || ins[start].text === undefined) return []
    let end = start
    while (end + 1 < ins.length && ins[end + 1].fn === fn) end++
    out.push(simulate(trace, ins, fn, start, end))
    start = end + 1
  }
  return out
}

function simulate(
  trace: Trace,
  ins: Instruction[],
  fn: number,
  first: number,
  last: number,
): StackFrame {
  let pose: StackPose = { sp: 0, fp: null, low: 0, saved: null }
  const poses: StackPose[] = [pose]
  const labels = new Map<number, string>()
  const touches: StackTouch[] = []
  // Virtual registers holding a stack address, from `addi vN,$fp,-8`.
  const address = new Map<string, number>()
  let top = 0
  for (let at = first; at <= last; at++) {
    const i = ins[at]
    const text = i.text ?? ''
    const [op, rest = ''] = text.split(/\s+(.*)/)
    const a = rest.split(',')
    const next = { ...pose }
    const base = (reg: string) =>
      reg === '$sp'
        ? pose.sp
        : reg === '$fp'
          ? pose.fp
          : (address.get(reg) ?? null)
    // `off(reg)` operands
    const memory = (operand: string) => {
      const m = /^(-?\d+)\((\$?\w+)\)$/.exec(operand)
      if (!m) return null
      const b = base(m[2])
      return b === null ? null : b + imm(m[1])
    }
    if ((op === 'addi' || op === 'addiu') && a[0] === '$sp') {
      const from = a[1] === '$fp' ? pose.fp : pose.sp
      if (from !== null) next.sp = from + imm(a[2])
    } else if (op === 'addiu' && a[0] === '$fp' && a[1] === '$sp') {
      next.fp = pose.sp
    } else if ((op === 'addi' || op === 'addiu') && a[1] === '$fp') {
      const addr = pose.fp === null ? null : pose.fp + imm(a[2])
      if (addr !== null) {
        address.set(a[0], addr)
        const name = nameOf(trace, i.node)
        if (name && !labels.has(addr)) labels.set(addr, name)
        touches.push({ at, addr, kind: 'read' })
      }
    } else if (op === 'sw' || op === 'lw') {
      const addr = memory(a[1])
      if (addr !== null) {
        touches.push({ at, addr, kind: op === 'sw' ? 'write' : 'read' })
        if (op === 'sw' && a[0] === '$fp') labels.set(addr, 'old $fp')
        else if (op === 'sw' && a[0] === '$ra') labels.set(addr, '$ra')
        else if (addr >= 0 && op === 'sw' && a[1].endsWith('($fp)'))
          labels.set(addr, 'return')
        else if (op === 'sw' && a[1] === '0($sp)' && !labels.has(addr))
          labels.set(addr, 'arg')
        else if (op === 'lw' && a[1] === '0($sp)' && !labels.has(addr))
          labels.set(addr, 'return')
        // The caller's frame pointer is back: this frame is gone.
        if (op === 'lw' && a[0] === '$fp') next.fp = null
      }
    } else if (op === 'pushRegisters') {
      next.saved = pose.sp - 4
      next.sp = pose.sp - 4
    } else if (op === 'popRegisters') {
      if (pose.saved !== null) next.sp = pose.saved + 4
      next.saved = null
    }
    next.low = Math.min(pose.low, next.sp)
    for (const addr of labels.keys()) top = Math.max(top, addr)
    pose = next
    poses.push(pose)
  }
  return { fn, first, last, poses, labels, touches, top }
}
