'use client'

import { useLayoutEffect, useRef, useState } from 'react'

import { returnType } from './type-view'

import type { Frame, Trace } from './trace'

// The type pass's side panel, under the source: the current statement's
// derivation, in the notation of the slides, grown one rule per step
// (Stanley, 2026-09-28: "build those type checking division like stacks …
// on top of each other"). Each node proven so far gets a rule: what is
// known above the line, what follows below it, and the rule's name at the
// line's end. A rule's premises are its children's conclusions, so the
// proof is the statement's subtree upside down, leaves on top. Parts not
// yet joined under a parent sit side by side, waiting for the bar that
// joins them. Under it, the expressions still waiting on the current one.
// Nodes that get a type, and statements that check one.
const EXPRESSIONS = new Set([
  'binary',
  'unary',
  'expr',
  'call',
  'name',
  'number',
])
const CHECKS = new Set(['return', 'if', 'while', 'assign'])

// How many rules deep a part is drawn before its premises fold into their
// conclusions, at most. When that is too wide for the panel, the parts
// the step isn't in fold first, down to their conclusions, then the one
// it is in, down to its last rule; past that the parts wrap to a second
// row, and a part still too wide scrolls sideways.
const DEPTH = 4

// Whether a step has a rule to show (or the pass's closing line).
export const hasTypeRule = (why: Frame['why'] | undefined) =>
  why?.kind === 'check.type' ||
  why?.kind === 'check.expr' ||
  why?.kind === 'check.fits' ||
  why?.kind === 'check.typesDone'

// Something above a line: a proven part, or a fact the rule reads off the
// program (a declaration, a field, a function's return type).
type Premise =
  | { kind: 'part'; id: number }
  | { kind: 'fact'; key: string; code: string }

type Rule = {
  premises: Premise[]
  conclusion: string
  name: string
  ok: boolean
  // The premise that doesn't fit, and what was needed there.
  bad?: { id: number; expected: string }
}

export function TypePanel({
  trace,
  source,
  index,
}: {
  trace: Trace
  source: string
  index: number
}) {
  // Parts the reader opened or folded by hand, until the statement changes.
  const [toggled, setToggled] = useState<{
    root: number
    open: Map<number, boolean>
  }>({ root: -1, open: new Map() })
  // How far the parts are cut back to fit, 0 for not at all (reset each
  // step and each time the reader opens or folds one).
  const [squeeze, setSqueeze] = useState({ index, toggled, by: 0 })
  const proofRef = useRef<HTMLDivElement>(null)
  const by =
    squeeze.index === index && squeeze.toggled === toggled ? squeeze.by : 0
  useLayoutEffect(() => {
    const box = proofRef.current
    if (!box) return
    if (box.scrollWidth > box.clientWidth + 1 && by < DEPTH * 2 - 1)
      setSqueeze({ index, toggled, by: by + 1 })
  }, [index, toggled, by])

  const why = trace.frames[index]?.why
  if (!why) return null
  if (why.kind === 'check.typesDone')
    return <p className="ac-type-done">every expression has a type</p>

  // Every type known by this step, the statements checked, the failures,
  // and each name's declaration.
  const known = new Map<number, string>()
  const checked = new Map<number, boolean>()
  const failed = new Map<number, { id: number; expected: string } | null>()
  const declOf = new Map<number, number>()
  for (const f of trace.frames.slice(0, index + 1)) {
    const w = f.why
    for (const [use, decl] of f.links ?? []) declOf.set(use, decl)
    if (w.kind === 'check.type') known.set(w.node, w.type)
    if (
      w.kind === 'check.expr' ||
      w.kind === 'check.fits' ||
      w.kind === 'check.typeError'
    )
      for (const [id, type] of w.typed) known.set(id, type)
    if (w.kind === 'check.expr') {
      known.set(w.node, w.type)
      if (!w.ok)
        failed.set(
          w.node,
          w.bad != null ? { id: w.bad, expected: w.expected ?? '?' } : null,
        )
    }
    if (w.kind === 'check.fits') {
      checked.set(w.node, w.ok)
      if (!w.ok) failed.set(w.node, { id: w.value, expected: w.expected })
    }
  }
  const text = (id: number) => {
    const n = trace.nodes[id]
    const s = source.slice(n.start, n.end).replace(/\s+/g, ' ').trim()
    return s.length > 22 ? `${s.slice(0, 21)}…` : s || n.label
  }
  const parent = new Map<number, number>()
  for (const n of trace.nodes) for (const c of n.children) parent.set(c, n.id)
  // An assignment checks its value too, whether it is its own kind of node
  // or a binary `=`.
  const checks = (id: number) =>
    CHECKS.has(trace.nodes[id].kind) || trace.nodes[id].label === '='
  // A statement is proven once it is checked, an expression once typed.
  const proven = (id: number) =>
    CHECKS.has(trace.nodes[id].kind) ? checked.has(id) : known.has(id)

  const focus =
    why.kind === 'check.type' ||
    why.kind === 'check.expr' ||
    why.kind === 'check.fits'
      ? why.node
      : null
  if (focus === null) return null

  // A statement as far as its value: `while (i < 10)`, not its body.
  const head = (id: number) => {
    const n = trace.nodes[id]
    if (n.kind !== 'if' && n.kind !== 'while') return text(id).replace(/;$/, '')
    const cond = trace.nodes[n.children[0]]
    return source
      .slice(n.start, source.indexOf(')', cond.end) + 1)
      .replace(/\s+/g, ' ')
  }
  const rule = (id: number): Rule => {
    const n = trace.nodes[id]
    const fact = (key: string, code: string): Premise => ({
      kind: 'fact',
      key,
      code,
    })
    const parts = n.children
      .filter(proven)
      .map((c): Premise => ({ kind: 'part', id: c }))
    const bad = failed.get(id) ?? undefined
    const ok = !failed.has(id)
    // A function's return type, read off its header.
    if (n.kind === 'function')
      return {
        premises: [
          fact('decl', source.slice(n.start, source.indexOf(')', n.start) + 1)),
        ],
        conclusion: `${n.label} returns ${known.get(id)}`,
        name: 'Fun',
        ok,
      }
    // A declaration gives its name the declared type.
    if (n.kind === 'declare')
      return {
        premises: [fact('decl', text(id).replace(/;$/, ''))],
        conclusion: `${n.label.slice(n.label.lastIndexOf(' ') + 1)} : ${known.get(id)}`,
        name: 'Decl',
        ok,
      }
    // A statement: its value fits what it needs.
    if (CHECKS.has(n.kind)) {
      const fn = trace.nodes.find(
        (f) => f.kind === 'function' && f.start <= n.start && n.end <= f.end,
      )
      const needs =
        n.kind === 'return' && fn
          ? [fact('returns', `${fn.label} returns ${returnType(trace, fn.id)}`)]
          : n.kind === 'assign'
            ? [
                fact(
                  'target',
                  `${n.label.replace(/ =$/, '')} : ${known.get(id) ?? '?'}`,
                ),
              ]
            : []
      return {
        premises: [...parts, ...needs],
        conclusion: `${head(id)} ${ok ? 'ok' : '✗'}`,
        name:
          n.kind === 'return'
            ? 'Return'
            : n.kind === 'assign'
              ? 'Assign'
              : n.kind === 'if'
                ? 'If'
                : 'While',
        ok,
        bad,
      }
    }
    const conclusion = `${text(id)} : ${ok ? known.get(id) : '✗'}`
    // A name has the type of the declaration it was linked to.
    if (n.kind === 'name') {
      const decl = declOf.get(id)
      return {
        premises:
          decl !== undefined
            ? [fact('decl', text(decl).replace(/;$/, ''))]
            : [],
        conclusion,
        name: 'Var',
        ok,
      }
    }
    if (n.kind === 'number')
      return { premises: [], conclusion, name: 'Const', ok }
    // A field has the type its struct gives it.
    if (n.kind === 'expr' && n.label.startsWith('.')) {
      const struct = known.get(n.children[0])?.match(/^struct (\w+)/)?.[1]
      return {
        premises: [
          ...parts,
          ...(struct && ok
            ? [
                fact(
                  'field',
                  `${n.label.slice(1)} : ${known.get(id)} ∈ ${struct}`,
                ),
              ]
            : []),
        ],
        conclusion,
        name: 'Field',
        ok,
        bad,
      }
    }
    // A call to a function of the program's own: its header says what it
    // takes and returns.
    const callee = n.kind === 'call' ? declOf.get(id) : undefined
    const header =
      callee !== undefined && trace.nodes[callee].kind === 'function'
        ? [
            fact(
              'decl',
              source.slice(
                trace.nodes[callee].start,
                source.indexOf(')', trace.nodes[callee].start) + 1,
              ),
            ),
          ]
        : []
    return {
      premises: [...parts, ...header],
      conclusion,
      name:
        n.label === '='
          ? 'Assign'
          : n.kind === 'call'
            ? 'Call'
            : n.kind === 'binary'
              ? n.label
              : n.label === '*'
                ? 'Deref'
                : n.label === '&'
                  ? 'Addr'
                  : n.label.startsWith('(')
                    ? 'Cast'
                    : n.label,
      ok,
      bad,
    }
  }

  // The statement the step is in: up from the current node through the
  // expressions around it, to the statement that checks them, if any.
  let root = focus
  for (
    let p = parent.get(root);
    p !== undefined &&
    (EXPRESSIONS.has(trace.nodes[p].kind) || CHECKS.has(trace.nodes[p].kind));
    p = parent.get(p)
  )
    root = p
  // Its parts proven so far that nothing has joined yet, in source order.
  const loose: number[] = []
  const gather = (id: number) => {
    const n = trace.nodes[id]
    if (!EXPRESSIONS.has(n.kind) && !CHECKS.has(n.kind) && id !== root) return
    if (proven(id)) loose.push(id)
    else n.children.forEach(gather)
  }
  gather(root)
  if (!loose.includes(focus)) loose.push(focus)

  // Whether a part has the step's node in it.
  const holds = (id: number): boolean =>
    id === focus || trace.nodes[id].children.some(holds)

  const open = toggled.root === root ? toggled.open : new Map()
  const toggle = (id: number, now: boolean) => {
    const next = new Map(open)
    next.set(id, !now)
    setToggled({ root, open: next })
  }

  // One part: its rule, its premises' own parts drawn above it, down to
  // the depth that fits; a folded part shows only its conclusion.
  const draw = (id: number, level: number, limit: number, badFor?: string) => {
    const r = rule(id)
    const drawn = open.get(id) ?? level < limit
    const foldable = r.premises.some((p) => p.kind === 'part')
    const conclusion = (
      <code className={badFor ? 'bad' : ''}>
        {r.conclusion}
        {badFor && <small> needs {badFor}</small>}
      </code>
    )
    if (!drawn)
      return (
        <button
          key={id}
          type="button"
          className="ac-proof folded"
          title="Show how"
          onClick={() => toggle(id, false)}
        >
          {conclusion}
        </button>
      )
    return (
      <div
        key={id}
        className={['ac-proof', id === focus && 'current', !r.ok && 'bad']
          .filter(Boolean)
          .join(' ')}
      >
        <div className="ac-proof-premises">
          {r.premises.map((p) =>
            p.kind === 'part' ? (
              draw(
                p.id,
                level + 1,
                limit,
                r.bad?.id === p.id ? r.bad.expected : undefined,
              )
            ) : (
              <code key={p.key} className="ac-proof-fact">
                {p.code}
              </code>
            ),
          )}
        </div>
        <div className="ac-proof-line" />
        {foldable && level > 0 ? (
          <button
            type="button"
            className="ac-proof-name"
            title="Fold"
            onClick={() => toggle(id, true)}
          >
            {r.name}
          </button>
        ) : (
          <span className="ac-proof-name">{r.name}</span>
        )}
        <div className="ac-proof-conclusion">{conclusion}</div>
      </div>
    )
  }

  // What is waiting on it: the expressions around it, each typed once its
  // parts are, then the statement that checks the value, if it does. A
  // statement has no type, and a block checks nothing, so the list stops
  // there.
  const waiting: number[] = []
  let p = parent.get(focus)
  while (
    p !== undefined &&
    EXPRESSIONS.has(trace.nodes[p].kind) &&
    !checks(p)
  ) {
    waiting.push(p)
    p = parent.get(p)
  }
  if (p !== undefined && checks(p) && !proven(p)) waiting.push(p)
  const state = (id: number) =>
    !checks(id) ? (known.get(id) ?? '?') : 'to check'

  return (
    <div className="ac-types">
      <div className="ac-proofs" ref={proofRef}>
        <div
          className={
            by >= DEPTH * 2 - 1 ? 'ac-proof-forest wrap' : 'ac-proof-forest'
          }
        >
          {loose.map((id) =>
            draw(
              id,
              0,
              holds(id)
                ? Math.max(1, DEPTH - Math.max(0, by - DEPTH))
                : Math.max(0, DEPTH - by),
            ),
          )}
        </div>
      </div>
      {waiting.length > 0 && (
        <div>
          <span className="ac-type-caption">waiting</span>
          {/* Innermost first: ? until an expression has its type. */}
          <ol className="ac-type-stack" aria-label="Waiting for their types">
            {waiting.map((id) => (
              <li key={id}>
                <code>{text(id)}</code>
                <span>{state(id)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
