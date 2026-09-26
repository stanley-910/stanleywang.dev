import type { Trace } from './trace'

// The type pass's side panel, under the source: the step's typing rule, in
// the notation of the slides (what is known above the line, what follows
// below it), and the expressions around the current one still waiting on
// it for their own types, innermost first (Stanley, 2026-09-26: "the
// intuitive typing rules, or at each point the type resolution stack").
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
  }
  const text = (id: number) => {
    const n = trace.nodes[id]
    const s = source.slice(n.start, n.end).replace(/\s+/g, ' ').trim()
    return s.length > 22 ? `${s.slice(0, 21)}…` : s || n.label
  }
  const parent = new Map<number, number>()
  for (const n of trace.nodes) for (const c of n.children) parent.set(c, n.id)

  let rule: {
    premises: { id: number; type: string; bad?: string }[]
    conclusion: string
    name: string
    ok: boolean
  } | null = null
  let focus: number | null = null
  if (why.kind === 'check.type') {
    focus = why.node
    rule = {
      premises: [],
      conclusion: `${text(why.node)} : ${why.type}`,
      name: trace.nodes[why.node].kind === 'declare' ? 'decl' : 'name',
      ok: true,
    }
  } else if (why.kind === 'check.expr') {
    focus = why.node
    rule = {
      premises: why.typed
        .filter(([id]) => id !== why.node)
        .map(([id, type]) => ({
          id,
          type,
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
          id: why.value,
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

  // Around the current node, out to its function: what is still waiting.
  const waiting: number[] = []
  for (let p = parent.get(focus); p !== undefined; p = parent.get(p)) {
    const kind = trace.nodes[p].kind
    if (kind === 'function' || kind === 'program') break
    waiting.push(p)
  }

  return (
    <div className="ac-types">
      <div className={`ac-rule ${rule.ok ? '' : 'bad'}`}>
        <div className="ac-rule-premises">
          {rule.premises.length ? (
            rule.premises.map((p) => (
              <span key={p.id} className={p.bad ? 'bad' : ''}>
                <code>{text(p.id)}</code> : {p.type}
                {p.bad && <small> needs {p.bad}</small>}
              </span>
            ))
          ) : (
            <span className="axiom">declared</span>
          )}
        </div>
        <div className="ac-rule-line">
          <span>{rule.name}</span>
        </div>
        <div className="ac-rule-conclusion">
          <code>{rule.conclusion}</code>
        </div>
      </div>
      {waiting.length > 0 && (
        <ol className="ac-type-stack" aria-label="Waiting for their types">
          {waiting.map((id) => (
            <li key={id} className={known.has(id) ? 'typed' : ''}>
              <code>{text(id)}</code>
              <span>{known.get(id) ?? '…'}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
