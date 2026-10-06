import type { Trace } from './trace'

// The emit phase line by line: a step per instruction. A node's run of
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
