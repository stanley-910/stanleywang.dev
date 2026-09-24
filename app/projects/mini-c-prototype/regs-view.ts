// The Registers phase in stops (Astra's regs review, 2026-09-24): the
// allocator's routine moves run together and play stops where a choice
// shows. Simplify keeps its first push, as the worked example, and batches
// the rest. Select stops at each pop that takes a register no one has had
// yet, with the pops that reused one before it; the last pop keeps a stop
// of its own. Spill steps always stop. A merged frame is the run's last
// step, so the stage settles exactly as it did; `from` is where it began.
import type { Frame, Trace } from './trace'

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
  const used = new Map<number, Set<string>>()
  trace.frames.forEach((frame, i) => {
    const w = frame.why
    const next = trace.frames[i + 1]?.why
    if (w.kind === 'reg.simplify') {
      const f = backend.functions[w.fn]
      const firstPush = f.colouring.steps.findIndex((s) => s.op === 'simplify')
      run.push(frame)
      // The first push stands alone; the rest end at the last push.
      if (
        w.step === firstPush ||
        next?.kind !== 'reg.simplify' ||
        next.fn !== w.fn
      )
        flush()
      return
    }
    if (w.kind === 'reg.select') {
      const f = backend.functions[w.fn]
      const colour = f.colouring.steps[w.step]?.colour ?? ''
      const taken = used.get(w.fn) ?? new Set<string>()
      used.set(w.fn, taken)
      const fresh = !taken.has(colour)
      taken.add(colour)
      run.push(frame)
      if (fresh || next?.kind !== 'reg.select' || next.fn !== w.fn) flush()
      return
    }
    flush()
    out.push(frame)
  })
  flush()
  return { ...trace, frames: out }
}
