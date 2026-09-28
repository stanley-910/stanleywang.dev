// The Registers phase in stops (Astra's regs review, 2026-09-24): the
// allocator's routine moves run together and play stops where a choice
// shows. Simplify keeps its first push, as the worked example, and batches
// the rest. Select stops at each pop that takes a register no one has had
// yet, with the pops that reused one before it; the last pop keeps a stop
// of its own. Spill steps always stop. A merged frame is the run's last
// step, so the stage settles exactly as it did; `from` is where it began.
// A run never crosses from the abandoned 18-colour attempt into the retry.
import { attemptOf } from './trace'

import type { Frame, Trace } from './trace'

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

export function withRegisterStops(trace: Trace): Trace {
  const backend = trace.backend
  if (!backend) return trace
  const out: Frame[] = []
  let run: Frame[] = []
  const flush = () => {
    const last = run[run.length - 1]
    if (!last) return
    const first = run[0].why
    const w = last.why
    if (
      (w.kind === 'reg.simplify' || w.kind === 'reg.select') &&
      run.length > 1
    )
      out.push({
        ...last,
        why: { ...w, from: 'step' in first ? first.step : w.step },
      })
    else out.push(last)
    run = []
  }
  const used = new Map<string, Set<string>>()
  trace.frames.forEach((frame, i) => {
    const w = frame.why
    const next = trace.frames[i + 1]?.why
    if (w.kind === 'reg.simplify') {
      const f = backend.functions[w.fn]
      const firstPush = attemptOf(f, w).steps.findIndex(
        (s) => s.op === 'simplify',
      )
      run.push(frame)
      // The first push stands alone; the rest end at the last push.
      if (
        w.step === firstPush ||
        next?.kind !== 'reg.simplify' ||
        next.fn !== w.fn ||
        next.abandoned !== w.abandoned
      )
        flush()
      return
    }
    if (w.kind === 'reg.select') {
      const f = backend.functions[w.fn]
      const colour = attemptOf(f, w).steps[w.step]?.colour ?? ''
      const key = `${w.fn}:${w.abandoned ?? ''}`
      const taken = used.get(key) ?? new Set<string>()
      used.set(key, taken)
      const fresh = !taken.has(colour)
      taken.add(colour)
      run.push(frame)
      if (
        fresh ||
        next?.kind !== 'reg.select' ||
        next.fn !== w.fn ||
        next.abandoned !== w.abandoned
      )
        flush()
      return
    }
    flush()
    out.push(frame)
  })
  flush()
  return { ...trace, frames: out }
}
