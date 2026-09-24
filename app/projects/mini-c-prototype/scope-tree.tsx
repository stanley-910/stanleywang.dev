import type { Scopes } from './scopes'
import type { Frame, Trace } from './trace'
import type { ReactNode } from 'react'

// Name resolution's symbol table in the note card: the scopes open where the
// current name is used, each indented under the one around it and holding
// what has been declared in it so far. A function's scope sits under its
// declaration, a nested block's under a `block` line. A lookup starts in the
// innermost scope and moves outward until it finds the name, or runs out;
// each scope it looked in without finding it keeps a dashed rail. (First a
// strip along the stage's bottom, after GPT-6 Astra's check proposal,
// docs/handoffs/2026-09-24-check-visual-astra-answer.md.)
export function ScopeTree({
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
  // A declaration step shows it going into its scope.
  const at = w.kind === 'check.declare' ? w.decl : use
  const path = (from: number) => {
    const out: number[] = []
    for (let s: number | null = from; s !== null; s = scopes.scopes[s].parent)
      out.unshift(s)
    return out
  }
  if (w.kind === 'check.declare') {
    shown = path(scopes.scopeOf(w.decl))
    searched = [scopes.scopeOf(w.decl)]
    found = w.decl
  } else if (use !== undefined) {
    shown = path(scopes.scopeOf(use))
    const result = scopes.lookup(nameOf(use), use)
    searched = result.path
    found = w.kind === 'check.resolve' ? w.decl : result.decl
  } else shown = scopes.scopes.map((s) => s.id)
  const before =
    at === undefined
      ? Infinity
      : w.kind === 'check.declare'
        ? scopes.declaredAt(w.decl)
        : nodes[at].token
  const home = searched[0]
  const last = searched[searched.length - 1]
  const cue =
    use === undefined || found !== undefined
      ? undefined
      : w.kind === 'check.unresolved'
        ? 'not found'
        : w.kind === 'check.builtin'
          ? 'built-in'
          : undefined

  const scopeList = (s: number): ReactNode => {
    const scope = scopes.scopes[s]
    const decls = scope.decls.filter((d) => scopes.declaredAt(d) <= before)
    const inner = shown.filter((c) => scopes.scopes[c].parent === s)
    // A function's scope hangs off its declaration; any other opens a line.
    const owned = new Map(
      inner
        .filter((c) => decls.includes(scopes.scopes[c].node ?? -1))
        .map((c) => [scopes.scopes[c].node as number, c]),
    )
    const items = [
      ...decls.map((d) => ({ at: scopes.declaredAt(d), decl: d })),
      ...inner
        .filter((c) => !owned.has(scopes.scopes[c].node ?? -1))
        .map((c) => ({
          at: nodes[scopes.scopes[c].node ?? 0]?.token ?? Infinity,
          scope: c,
        })),
    ].sort((p, q) => p.at - q.at)
    const hit = found !== undefined && decls.includes(found)
    const passed = searched.includes(s) && !hit
    return (
      <ul
        className={`ac-scope ${passed ? 'passed' : ''} ${hit ? 'hit' : ''} ${s === home ? 'home' : ''}`}
      >
        {items.length === 0 && <li className="ac-scope-empty">–</li>}
        {items.map((item) =>
          'decl' in item ? (
            <li key={`d${item.decl}`}>
              <code
                className={
                  item.decl !== found
                    ? ''
                    : w.kind === 'check.resolve'
                      ? 'found ok'
                      : 'found'
                }
              >
                {nodes[item.decl].kind === 'function'
                  ? `${nodes[item.decl].label}()`
                  : nodes[item.decl].label}
              </code>
              {owned.has(item.decl) &&
                scopeList(owned.get(item.decl) as number)}
            </li>
          ) : (
            <li key={`s${item.scope}`}>
              <span className="ac-scope-name">
                {scopes.scopes[item.scope].label}
              </span>
              {scopeList(item.scope)}
            </li>
          ),
        )}
        {cue && s === last && (
          <li>
            {cue === 'not found' && use !== undefined ? (
              // Which name wasn't found, not just that one wasn't.
              <small className="err">
                <code>{nameOf(use)}</code> not found
              </small>
            ) : (
              <small>{cue}</small>
            )}
          </li>
        )}
      </ul>
    )
  }

  const root = shown[0] ?? 0
  return (
    <div className="ac-scopes" aria-label="Scopes">
      <span className="ac-scope-name">{scopes.scopes[root].label}</span>
      {scopeList(root)}
    </div>
  )
}
