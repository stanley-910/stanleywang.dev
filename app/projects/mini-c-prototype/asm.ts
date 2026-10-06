// A line of assembly as the compiler writes it (`addu v4,v0,v2`,
// `lw $t0,4($fp)`): its opcode, its operands, and the virtual registers it
// names. A virtual register is `v` and a number; the machine's own `$v0`
// is not one.

/** The opcode and the operands as written (`''` when there are none). */
export const splitLine = (text: string): [op: string, operands: string] => {
  const [op, operands = ''] = text.split(/\s+(.*)/)
  return [op, operands]
}

/** Whether a register's name is a virtual register's. */
export const isVirtual = (name: string) => /^v\d+$/.test(name)

/** A virtual register in a line, captured: splitting a line by it keeps
 * each register as its own part. */
export const VIRTUAL_IN_LINE = /(?<!\$)\b(v\d+)\b/

/** Every virtual register a line names, in order. */
export const virtualsIn = (text: string) => text.match(/(?<!\$)\bv\d+\b/g) ?? []

/** A line with each virtual register renamed. */
export const renameVirtuals = (text: string, name: (v: string) => string) =>
  text.replace(/(?<!\$)\bv\d+\b/g, name)
