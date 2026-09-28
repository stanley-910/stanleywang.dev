// The type pass in smaller steps, so it shows where each type comes from
// (Stanley, 2026-09-28: "step through main, explain that main has a type
// because of the int … then draw a thing going down to the struct Point p
// declaration"). The compiler's trace types an operator's leaf operands on
// the operator's own step (`p` with `.x`, `10` with `=`); here each leaf
// gets a step of its own first, a name's pointing at its declaration. And
// each function gets a step as the pass enters it: its return type, read
// off its declaration, is what the returns in its body must match.
import type { Frame, Trace } from './trace'

const TYPED = new Set([
  'check.type',
  'check.expr',
  'check.fits',
  'check.typeError',
])

export function withTypeSteps(trace: Trace): Trace {
  // Each name's declaration, from the name pass.
  const declOf = new Map<number, number>()
  for (const f of trace.frames) {
    for (const [use, decl] of f.links ?? []) declOf.set(use, decl)
    if (f.why.kind === 'check.resolve' || f.why.kind === 'check.link')
      declOf.set(f.why.use, f.why.decl)
  }
  const functions = trace.nodes.filter((n) => n.kind === 'function')
  const entered = new Set<number>()
  const typed = new Set<number>()
  const out: Frame[] = []
  for (const frame of trace.frames) {
    const w = frame.why
    if (!TYPED.has(w.kind)) {
      out.push(frame)
      continue
    }
    const fn = functions.find(
      (f) => frame.span.start >= f.start && frame.span.end <= f.end,
    )
    if (fn && !entered.has(fn.id)) {
      entered.add(fn.id)
      const result = returnType(trace, fn.id)
      const body = trace.tokens.find((t) => t.id > fn.token && t.text === '{')
      if (result)
        out.push({
          ...frame,
          why: { kind: 'check.type', node: fn.id, type: result },
          span: {
            start: fn.start,
            end: body ? trace.tokens[body.id - 1].end : fn.end,
          },
          focus: fn.id,
        })
    }
    if (w.kind === 'check.type') typed.add(w.node)
    if ('typed' in w)
      for (const [id, type] of w.typed) {
        const n = trace.nodes[id]
        if (typed.has(id)) continue
        typed.add(id)
        if (id === w.node || n.children.length > 0) continue
        out.push({
          ...frame,
          why: { kind: 'check.type', node: id, type, decl: declOf.get(id) },
          span: { start: n.start, end: n.end },
          focus: id,
        })
      }
    out.push(frame)
  }
  return { ...trace, frames: out }
}

/** What comes before a function's name: its return type, `int`. */
export function returnType(trace: Trace, fn: number): string {
  const f = trace.nodes[fn]
  return trace.tokens
    .filter((t) => t.start >= f.start && t.id < f.token)
    .map((t) => t.text)
    .join(' ')
    .replace(/ \*/g, '*')
}
