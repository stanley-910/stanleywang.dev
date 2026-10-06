// Register badges on the emit tree (Astra's emit answer, 2026-09-24): the
// virtual register a node leaves behind waits beside it until the node that
// needs it is emitted, then travels to that node. An outlined badge holds an
// address (an assignment's target, `addi v8,$fp,-12`), a filled one a value.
// A register used only inside its own node's run of instructions (a name's
// address, loaded from on the next line) never gets a badge.
import { isVirtual } from './asm'

import type { Instruction } from './trace'

type RegBadge = {
  reg: string
  // The node that made it, where it waits.
  node: number
  // The instruction that writes it, and the first one outside its run that
  // reads it (Infinity if none does).
  def: number
  use: number
  // The node that reads it, or null if none does.
  to: number | null
  address: boolean
}

export function regBadges(instructions: Instruction[]): RegBadge[] {
  // Each instruction's run: the stretch of neighbours from the same node.
  const run: number[] = []
  instructions.forEach((ins, i) => {
    run[i] = i > 0 && instructions[i - 1].node === ins.node ? run[i - 1] : i
  })
  const badges: RegBadge[] = []
  instructions.forEach((ins, def) => {
    const reg = ins.dest
    if (!reg || !isVirtual(reg) || ins.node === null) return
    const reads = instructions
      .map((other, i) => ({ other, i }))
      .filter(({ other, i }) => i > def && other.args.includes(reg))
    const outside = reads.find(({ i }) => run[i] !== run[def])
    if (reads.length && !outside) return
    // Compiler-emitted lines show an address as a memory operand, `0(v8)`.
    const address =
      reads.length > 0 &&
      reads.every(({ other }) => other.text?.includes(`(${reg})`))
    badges.push({
      reg,
      node: ins.node,
      def,
      use: outside?.i ?? Infinity,
      to: outside ? outside.other.node : null,
      address,
    })
  })
  return badges
}

type BadgePose = RegBadge & {
  // held: waiting beside its node; new: written this step; spent: read this
  // step, so it travels to the node that reads it and is gone after.
  state: 'held' | 'new' | 'spent' | 'new spent'
}

/**
 * The badges on a step, from how many instructions are out and which ones
 * the step adds (`range`), so any step can be opened directly.
 */
export function badgesAt(
  badges: RegBadge[],
  count: number,
  range: [number, number] | null,
): BadgePose[] {
  const inRange = (i: number) =>
    range !== null && i >= range[0] && i <= range[1]
  return badges.flatMap((b): BadgePose[] => {
    if (b.def >= count) return []
    const fresh = inRange(b.def)
    if (b.use < count) {
      if (!inRange(b.use)) return []
      return [{ ...b, state: fresh ? 'new spent' : 'spent' }]
    }
    return [{ ...b, state: fresh ? 'new' : 'held' }]
  })
}
