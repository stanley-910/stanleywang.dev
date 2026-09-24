import type { Scopes } from './scopes'
import type { Frame, Trace } from './trace'

// Name resolution's symbol table along the bottom of the stage: the scopes
// open where the current name is used, outermost first, each holding what
// has been declared in it so far. A lookup starts in the innermost card and
// moves outward until it finds the name, or runs out (GPT-6 Astra's check
// proposal, docs/handoffs/2026-09-24-check-visual-astra-answer.md).
export function ScopeStrip({
  trace,
  scopes,
  frame,
}: {
  trace: Trace
  scopes: Scopes
  frame: Frame
}) {
  const w = frame.why
  const use =
    w.kind === 'check.resolve' ||
    w.kind === 'check.unresolved' ||
    w.kind === 'check.builtin'
      ? w.use
      : undefined
  const nodes = trace.nodes
  const nameOf = (id: number) => trace.tokens[nodes[id].token]?.text ?? ''

  // A use shows the scopes around it; the pass's last step shows them all.
  let shown: number[]
  let searched: number[] = []
  let found: number | undefined
  if (use !== undefined) {
    shown = []
    for (let s: number | null = scopes.scopeOf(use); s !== null; ) {
      shown.unshift(s)
      s = scopes.scopes[s].parent
    }
    const result = scopes.lookup(nameOf(use), use)
    searched = result.path
    found = w.kind === 'check.resolve' ? w.decl : result.decl
  } else shown = scopes.scopes.map((s) => s.id)
  const before = use === undefined ? Infinity : nodes[use].token
  const depth = (s: number) => {
    let d = 0
    for (
      let p = scopes.scopes[s].parent;
      p !== null;
      p = scopes.scopes[p].parent
    )
      d++
    return d
  }
  const home = searched[0]
  const last = searched[searched.length - 1]

  return (
    <ol className="ac-scopes" aria-label="Scopes">
      {shown.map((s) => {
        const scope = scopes.scopes[s]
        const decls = scope.decls
          .filter((d) => scopes.declaredAt(d) <= before)
          .sort((p, q) => scopes.declaredAt(p) - scopes.declaredAt(q))
        const hit = found !== undefined && decls.includes(found)
        const passed = searched.includes(s) && !hit
        const cue =
          use === undefined
            ? undefined
            : hit
              ? s === home
                ? undefined
                : 'outer'
              : w.kind === 'check.unresolved' && s === last
                ? 'not found'
                : w.kind === 'check.builtin' && s === last
                  ? 'built-in'
                  : undefined
        return (
          <li
            key={s}
            className={`ac-scope ${passed ? 'passed' : ''} ${hit ? 'hit' : ''} ${s === home ? 'home' : ''}`}
            style={{
              marginLeft: use === undefined ? depth(s) * 12 : undefined,
            }}
          >
            <span className="ac-scope-name">{scope.label}</span>
            {decls.length === 0 && <span className="ac-scope-empty">–</span>}
            {decls.map((d) => (
              <code key={d} className={d === found ? 'found' : ''}>
                {nodes[d].kind === 'function'
                  ? `${nodes[d].label}()`
                  : nodes[d].label}
              </code>
            ))}
            {cue && (
              <small className={cue === 'not found' ? 'err' : ''}>{cue}</small>
            )}
          </li>
        )
      })}
    </ol>
  )
}
