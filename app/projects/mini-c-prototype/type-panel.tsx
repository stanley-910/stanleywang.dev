'use client'

import { derive, EXPRESSIONS, ProofTree } from './derivation'

import type { Frame, Trace } from './trace'

// The type pass's side panel, under the source: the step's rule, its
// premises folded to their conclusions (the whole proof grows on the
// stage, under the tree: proof-stage.tsx), then what is still waiting on
// the current node.

// Whether a step has a rule to show (or the pass's closing line).
export const hasTypeRule = (why: Frame['why'] | undefined) =>
  why?.kind === 'check.type' ||
  why?.kind === 'check.expr' ||
  why?.kind === 'check.fits' ||
  why?.kind === 'check.typesDone'

export function TypePanel({
  trace,
  source,
  index,
}: {
  trace: Trace
  source: string
  index: number
}) {
  const why = trace.frames[index]?.why
  if (!why) return null
  if (why.kind === 'check.typesDone')
    return <p className="ac-type-done">every expression has a type</p>
  const d = derive(trace, source, index)
  const focus = d.focus
  if (focus === null) return null

  // What is waiting on it: the expressions around it, each typed once its
  // parts are, then the statement that checks the value, if it does. A
  // statement has no type, and a block checks nothing, so the list stops
  // there.
  const waiting: number[] = []
  let p = d.parent.get(focus)
  while (
    p !== undefined &&
    EXPRESSIONS.has(trace.nodes[p].kind) &&
    !d.checks(p)
  ) {
    waiting.push(p)
    p = d.parent.get(p)
  }
  if (p !== undefined && d.checks(p) && !d.proven(p)) waiting.push(p)
  const state = (id: number) =>
    !d.checks(id) ? (d.known.get(id) ?? '?') : 'to check'

  return (
    <div className="ac-types">
      <div className="ac-proofs">
        <div className="ac-proof-forest">
          <ProofTree d={d} id={focus} limit={1} />
        </div>
      </div>
      {waiting.length > 0 && (
        <div>
          <span className="ac-type-caption">waiting</span>
          {/* Innermost first: ? until an expression has its type. */}
          <ol className="ac-type-stack" aria-label="Waiting for their types">
            {waiting.map((id) => (
              <li key={id}>
                <code>{d.text(id)}</code>
                <span>{state(id)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
