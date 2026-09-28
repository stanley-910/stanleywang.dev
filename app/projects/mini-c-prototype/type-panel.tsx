import type { Frame, Trace } from './trace'

// The type pass's side panel, under the source: the step's typing rule, in
// the notation of the slides (what is known above the line, what follows
// below it), and the expressions around the current one still waiting on
// it for their own types, innermost first (Stanley, 2026-09-26: "the
// intuitive typing rules, or at each point the type resolution stack").
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
  // Every type known by this step.
  const known = new Map<number, string>()
  // Statements that check a value (a return, a condition): whether it fit.
  const checked = new Map<number, boolean>()
  for (const f of trace.frames.slice(0, index + 1)) {
    const w = f.why
    if (w.kind === 'check.type') known.set(w.node, w.type)
    if (
      w.kind === 'check.expr' ||
      w.kind === 'check.fits' ||
      w.kind === 'check.typeError'
    )
      for (const [id, type] of w.typed) known.set(id, type)
    if (w.kind === 'check.expr') known.set(w.node, w.type)
    if (w.kind === 'check.fits') checked.set(w.node, w.ok)
  }
  const text = (id: number) => {
    const n = trace.nodes[id]
    const s = source.slice(n.start, n.end).replace(/\s+/g, ' ').trim()
    return s.length > 22 ? `${s.slice(0, 21)}…` : s || n.label
  }
  const parent = new Map<number, number>()
  for (const n of trace.nodes) for (const c of n.children) parent.set(c, n.id)

  // A premise: code, and the type it has (none for a declaration, which
  // is where the type comes from).
  type Premise = { key: string; code: string; type?: string; bad?: string }
  let rule: {
    premises: Premise[]
    conclusion: string
    name: string
    ok: boolean
  } | null = null
  let focus: number | null = null
  if (why.kind === 'check.type') {
    focus = why.node
    const n = trace.nodes[why.node]
    // A declaration gives its name the declared type; a name or literal
    // has its type outright (nothing above the line).
    const declared = n.kind === 'declare'
    const name = declared ? n.label.slice(n.label.lastIndexOf(' ') + 1) : ''
    // A function's return type, read off its header; a name's, off the
    // declaration it was linked to (type-view.ts).
    const header =
      n.kind === 'function'
        ? source.slice(n.start, source.indexOf(')', n.start) + 1)
        : undefined
    rule = header
      ? {
          premises: [{ key: 'decl', code: header }],
          conclusion: `${n.label} returns ${why.type}`,
          name: 'fun',
          ok: true,
        }
      : {
          premises: declared
            ? [{ key: 'decl', code: text(why.node).replace(/;$/, '') }]
            : why.decl !== undefined
              ? [{ key: 'decl', code: text(why.decl).replace(/;$/, '') }]
              : [],
          conclusion: `${declared ? name : text(why.node)} : ${why.type}`,
          name: declared
            ? 'decl'
            : n.kind === 'number'
              ? 'literal'
              : why.decl !== undefined
                ? 'var'
                : 'name',
          ok: true,
        }
  } else if (why.kind === 'check.expr') {
    focus = why.node
    rule = {
      // Its operands, each with the type it has by now (some were typed
      // on steps of their own).
      premises: trace.nodes[why.node].children
        .filter((id) => known.has(id))
        .map((id) => ({
          key: String(id),
          code: text(id),
          type: known.get(id),
          bad: id === why.bad ? (why.expected ?? undefined) : undefined,
        })),
      conclusion: why.ok
        ? `${text(why.node)} : ${why.type}`
        : `${text(why.node)} : ✗`,
      name: trace.nodes[why.node].label,
      ok: why.ok,
    }
  } else if (why.kind === 'check.fits') {
    focus = why.node
    rule = {
      premises: [
        {
          key: String(why.value),
          code: text(why.value),
          type: why.type,
          bad: why.ok ? undefined : why.expected,
        },
      ],
      conclusion: why.ok
        ? `${why.rule} fits ${why.expected}`
        : `${why.rule} needs ${why.expected}`,
      name: why.rule,
      ok: why.ok,
    }
  } else if (why.kind === 'check.typesDone') {
    return <p className="ac-type-done">every expression has a type</p>
  }
  if (!rule || focus === null) return null

  // What is waiting on it: the expressions around it, each typed once its
  // parts are, then the statement that checks the value, if it does. A
  // statement has no type, and a block checks nothing, so the list stops
  // there.
  // An assignment checks its value too, whether it is its own kind of node
  // or a binary `=`.
  const checks = (id: number) =>
    CHECKS.has(trace.nodes[id].kind) || trace.nodes[id].label === '='
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
  if (p !== undefined && checks(p)) waiting.push(p)
  const state = (id: number) =>
    !checks(id)
      ? (known.get(id) ?? '?')
      : checked.has(id)
        ? checked.get(id)
          ? 'ok'
          : 'fails'
        : 'to check'

  return (
    <div className="ac-types">
      <div className={`ac-rule ${rule.ok ? '' : 'bad'}`}>
        <div className="ac-rule-premises">
          {rule.premises.map((p) => (
            <span key={p.key} className={p.bad ? 'bad' : ''}>
              <code>{p.code}</code>
              {p.type && <> : {p.type}</>}
              {p.bad && <small> needs {p.bad}</small>}
            </span>
          ))}
        </div>
        <div className="ac-rule-line">
          <span>{rule.name}</span>
        </div>
        <div className="ac-rule-conclusion">
          <code>{rule.conclusion}</code>
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
