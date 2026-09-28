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
