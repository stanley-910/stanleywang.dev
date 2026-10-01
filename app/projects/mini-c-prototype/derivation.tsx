// The type pass as derivations, in the notation of the slides (Stanley,
// 2026-09-28: "build those type checking division like stacks … on top of
// each other"). Each node proven so far gets a rule: what is known above
// the line, what follows below it, and the rule's name at the line's end.
// A rule's premises are its children's conclusions, so a statement's
// proof is its subtree upside down, leaves on top. Parts not yet joined
// under a parent sit side by side, waiting for the bar that joins them.
// The stage draws every statement's proof under the tree (proof-stage.tsx);
// the side panel, the current rule (type-panel.tsx).
import { returnType } from './type-view'

import type { Trace } from './trace'

// Nodes that get a type, and statements that check one.
export const EXPRESSIONS = new Set([
  'binary',
  'unary',
  'expr',
  'call',
  'name',
  'number',
])
const CHECKS = new Set(['return', 'if', 'while', 'assign'])

// Something above a line: a proven part, or a fact the rule reads off the
// program (a declaration, a field, a function's return type).
type Premise =
  { kind: 'part'; id: number } | { kind: 'fact'; key: string; code: string }

type Rule = {
  premises: Premise[]
  conclusion: string
  name: string
  ok: boolean
  // The premise that doesn't fit, and what was needed there.
  bad?: { id: number; expected: string }
}

type Derivation = ReturnType<typeof derive>

// Everything the type pass has proven by step `index`.
export function derive(trace: Trace, source: string, index: number) {
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
  const why = trace.frames[index]?.why
  const focus =
    why?.kind === 'check.type' ||
    why?.kind === 'check.expr' ||
    why?.kind === 'check.fits'
      ? why.node
      : null

  const text = (id: number) => {
    const n = trace.nodes[id]
    // (an expression standing as a statement is read to its `;`)
    const s = source
      .slice(n.start, n.end)
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/;$/, '')
    // (whole: a cut expression hid what was being typed, Stanley, 2026-10-01)
    return s || n.label
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

  // A statement as far as its value: `while (i < 10)`, not its body.
  const head = (id: number) => {
    const n = trace.nodes[id]
    if (n.kind !== 'if' && n.kind !== 'while') return text(id).replace(/;$/, '')
    const cond = trace.nodes[n.children[0]]
    return source
      .slice(n.start, source.indexOf(')', cond.end) + 1)
      .replace(/\s+/g, ' ')
  }
  const header = (id: number) => {
    const n = trace.nodes[id]
    return source.slice(n.start, source.indexOf(')', n.start) + 1)
  }
  // A function's type in the stage's shorthand, `(int) → int`, as its badge
  // reads: its parameters' types (declarations before the body's `{`) and
  // what it returns.
  const signature = (fn: number, returns: string | undefined) => {
    const f = trace.nodes[fn]
    const body = trace.tokens.find((t) => t.id > f.token && t.text === '{')
    const params = f.children
      .map((c) => trace.nodes[c])
      .filter((c) => c.kind === 'declare' && (!body || c.token < body.id))
      .map((c) => c.label.slice(0, c.label.lastIndexOf(' ')).trim())
    return `(${params.join(', ')}) → ${returns ?? '?'}`
  }
  const fact = (key: string, code: string): Premise => ({
    kind: 'fact',
    key,
    code,
  })

  const rule = (id: number): Rule => {
    const n = trace.nodes[id]
    const parts = n.children
      .filter(proven)
      .map((c): Premise => ({ kind: 'part', id: c }))
    const bad = failed.get(id) ?? undefined
    const ok = !failed.has(id)
    // A function's type, read off its header.
    if (n.kind === 'function')
      return {
        premises: [fact('decl', header(id))],
        conclusion: `${n.label} : ${signature(id, known.get(id))}`,
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
          ? [
              fact(
                'returns',
                `${fn.label} : ${signature(fn.id, returnType(trace, fn.id))}`,
              ),
            ]
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
        // (the statement alone: whether it held shows in its colour, not a
        // mark after it, Stanley, 2026-10-01)
        conclusion: head(id),
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
    // (an expression that didn't type is `unknown`, as the compiler has it)
    const conclusion = `${text(id)} : ${ok ? known.get(id) : 'unknown'}`
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
    return {
      premises: [
        ...parts,
        ...(callee !== undefined && trace.nodes[callee].kind === 'function'
          ? [fact('decl', header(callee))]
          : []),
      ],
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

  // The statement a node is in: up through the expressions around it, to
  // the statement that checks them, if any. A declaration or a function
  // is its own.
  const rootOf = (id: number) => {
    let root = id
    for (
      let p = parent.get(root);
      p !== undefined &&
      (EXPRESSIONS.has(trace.nodes[p].kind) || CHECKS.has(trace.nodes[p].kind));
      p = parent.get(p)
    )
      root = p
    return root
  }
  // A statement's parts proven so far that nothing has joined yet, in
  // source order.
  const loose = (root: number) => {
    const out: number[] = []
    const gather = (id: number) => {
      const n = trace.nodes[id]
      if (!EXPRESSIONS.has(n.kind) && !CHECKS.has(n.kind) && id !== root) return
      if (proven(id)) out.push(id)
      else n.children.forEach(gather)
    }
    gather(root)
    return out
  }

  return { focus, known, parent, checks, proven, rule, rootOf, loose, text }
}

// The statements the type pass proves, in the order it gets to them, each
// with its first step; and the pass's last step, where every proof is whole.
export function proofRoots(trace: Trace, source: string) {
  let last = -1
  const first = new Map<number, number>()
  const d = derive(trace, source, 0)
  trace.frames.forEach((f, i) => {
    const w = f.why
    if (
      w.kind !== 'check.type' &&
      w.kind !== 'check.expr' &&
      w.kind !== 'check.fits'
    )
      return
    last = i
    const root = d.rootOf(w.node)
    if (!first.has(root)) first.set(root, i)
  })
  return { first, last }
}

// One part: its rule, its premises' own parts drawn above it, down to
// `limit` rules; past that, or folded by hand, only its conclusion.
export function ProofTree({
  d,
  id,
  level = 0,
  limit = Infinity,
  open,
  onToggle,
  badFor,
}: {
  d: Derivation
  id: number
  level?: number
  limit?: number
  open?: Map<number, boolean>
  onToggle?: (id: number, open: boolean) => void
  badFor?: string
}) {
  const r = d.rule(id)
  const drawn = open?.get(id) ?? level < limit
  const foldable = r.premises.some((p) => p.kind === 'part')
  const conclusion = (
    <code className={badFor ? 'bad' : ''}>
      {r.conclusion}
      {badFor && <small> needs {badFor}</small>}
    </code>
  )
  if (!drawn)
    return onToggle ? (
      <button
        type="button"
        className="ac-proof folded"
        title="Show how"
        onClick={() => onToggle(id, true)}
      >
        {conclusion}
      </button>
    ) : (
      <span className="ac-proof folded">{conclusion}</span>
    )
  return (
    <div
      className={['ac-proof', id === d.focus && 'current', !r.ok && 'bad']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="ac-proof-premises">
        {r.premises.map((p) =>
          p.kind === 'part' ? (
            <ProofTree
              key={p.id}
              d={d}
              id={p.id}
              level={level + 1}
              limit={limit}
              open={open}
              onToggle={onToggle}
              badFor={r.bad?.id === p.id ? r.bad.expected : undefined}
            />
          ) : (
            <code key={p.key} className="ac-proof-fact">
              {p.code}
            </code>
          ),
        )}
      </div>
      <div className="ac-proof-line" />
      {onToggle && foldable && level > 0 ? (
        <button
          type="button"
          className="ac-proof-name"
          title="Fold"
          onClick={() => onToggle(id, false)}
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
