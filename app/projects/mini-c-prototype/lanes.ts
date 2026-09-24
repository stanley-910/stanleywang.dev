import type { Instruction } from './trace'

// A virtual register's live range in emit: from the line that writes it to
// the last line that reads it, in a column beside the assembly.
export type Lane = {
  fn: number | undefined
  vr: string
  def: number
  last: number
  reads: number[]
  column: number
}

const VIRTUAL = /^v\d+$/

// Columns are packed over the whole program, so a lane keeps its column as
// rows arrive; a column is reused only once the lane before it has ended
// (not on the same line, where one would seem to run into the other).
export function lanesOf(instructions: Instruction[]) {
  const byKey = new Map<string, Lane>()
  instructions.forEach((ins, i) => {
    for (const a of ins.args) {
      const lane = byKey.get(`${ins.fn}:${a}`)
      if (lane) {
        lane.last = i
        lane.reads.push(i)
      }
    }
    if (ins.dest && VIRTUAL.test(ins.dest)) {
      const key = `${ins.fn}:${ins.dest}`
      if (!byKey.has(key))
        byKey.set(key, {
          fn: ins.fn,
          vr: ins.dest,
          def: i,
          last: i,
          reads: [],
          column: 0,
        })
    }
  })
  const lanes = [...byKey.values()].sort((a, b) => a.def - b.def)
  const ends: number[] = []
  for (const lane of lanes) {
    let column = ends.findIndex((end) => end < lane.def)
    if (column < 0) column = ends.length
    ends[column] = lane.last
    lane.column = column
  }
  return { lanes, columns: ends.length }
}

// The registers a line writes or reads, for lighting their lanes.
export function registersOf(ins: Instruction | undefined) {
  if (!ins) return []
  return [ins.dest, ...ins.args].filter(
    (r): r is string => !!r && VIRTUAL.test(r),
  )
}
