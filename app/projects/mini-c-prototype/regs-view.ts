import type { Trace } from './trace'

// Registers opens on the interference graph. The CFG and the liveness
// sweeps are left out: the bars beside the code already show each value's
// life from emit on, and the sweeps only confirmed them (Stanley,
// 2026-09-28: "we can fully just skip it").
export function withoutLiveness(trace: Trace): Trace {
  return {
    ...trace,
    frames: trace.frames.filter(
      (f) => f.why.kind !== 'reg.cfg' && f.why.kind !== 'reg.live',
    ),
  }
}

// pushRegisters and popRegisters wait for the registers to be known, so
// each function's rewrite leaves them as placeholders, and three steps
// after it expand them: both lit first, so the viewer sees what is about
// to change, then the saves, then the restores (Stanley, 2026-10-06).
export function withSaveSteps(trace: Trace): Trace {
  const frames = trace.frames.flatMap((frame) => {
    const w = frame.why
    if (w.kind !== 'reg.done' || w.fn === undefined) return [frame]
    const fn = w.fn
    const held = trace.instructions.some(
      (i) => i.fn === fn && i.op === 'pushRegisters' && i.out !== undefined,
    )
    if (!held) return [frame]
    const name = trace.backend?.functions[fn]?.name ?? ''
    return [
      frame,
      ...(['mark', 'push', 'pop'] as const).map((stage) => ({
        ...frame,
        title: `${name}: ${stage === 'pop' ? 'restoring' : 'saving'} registers`,
        why: { kind: 'reg.saves' as const, fn, stage },
      })),
    ]
  })
  return { ...trace, frames }
}
