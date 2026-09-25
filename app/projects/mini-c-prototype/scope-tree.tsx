import { AnimatePresence, motion } from 'motion/react'

import { nodeKind } from './explain'

import type { Scopes } from './scopes'
import type { Frame, Trace } from './trace'
import type { ReactNode } from 'react'

// Name resolution's symbol table, in the note card under the source while
// the name pass runs (the card's header says what it is): the scopes open where the current name is used, each indented
// under the one around it. The scope the name is in has the bold, bright
// rail and name; the ones around it are dimmer. An empty scope only gets a
// row when it is that one. A lookup moves outward from there; each scope it
// looked in without finding the name keeps a dashed rail. Rows slide in and
// out rather than jump, so the eye keeps its place between steps.
export function ScopeTree({
  trace,
  scopes,
  frame,
  step,
  duration,
}: {
  trace: Trace
  scopes: Scopes
  frame: Frame
  /** The frame's index: declarations made by then are listed. */
  step: number
  duration: number
}) {
  const row = {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto' },
    exit: { opacity: 0, height: 0 },
    transition: { duration, ease: [0.22, 1, 0.36, 1] as const },
  }
  const w = frame.why
  const use =
    w.kind === 'check.resolve' ||
    w.kind === 'check.unresolved' ||
    w.kind === 'check.builtin' ||
    w.kind === 'check.link'
      ? w.use
      : undefined
  const nodes = trace.nodes
  const list = scopes.scopes
  const nameOf = (id: number) => trace.tokens[nodes[id].token]?.text ?? ''
  // What a declaration makes, beside it: var, function or struct.
  const declKind = (id: number) => {
    const kind = nodeKind(nodes[id]).kind
    return kind === 'variable'
      ? 'var'
      : kind === 'prototype'
        ? 'function'
        : (kind ?? '')
  }
  if (!list.length) return null

  // The scope the step happened in, as the compiler recorded it. A step in
  // one shows the scopes around it; the pass's last step shows them all.
  const home =
    w.kind === 'check.declare' ||
    w.kind === 'check.nameError' ||
    w.kind === 'check.resolve' ||
    w.kind === 'check.unresolved' ||
    w.kind === 'check.builtin' ||
    w.kind === 'check.link'
      ? w.inScope
      : undefined
  const path = (from: number) => {
    const out: number[] = []
    for (let s: number | null = from; s !== null; s = list[s].parent)
      out.unshift(s)
    return out
  }
  let shown = home === undefined ? list.map((s) => s.id) : path(home)
  // A declaration goes into its own scope; a lookup moves outward.
  const searched =
    w.kind === 'check.declare'
      ? home === undefined
        ? []
        : [home]
      : w.kind === 'check.resolve' ||
          w.kind === 'check.unresolved' ||
          w.kind === 'check.builtin' ||
          w.kind === 'check.link'
        ? (w.searched ?? [])
        : []
  const foundAt =
    w.kind === 'check.declare' ||
    w.kind === 'check.resolve' ||
    w.kind === 'check.link'
      ? w.decl
      : w.kind === 'check.unresolved'
        ? w.found
        : undefined
  // Declarations made by this step. A forward declaration gives way to the
  // definition that joined it: one symbol, one row.
  const made = (d: number) => scopes.declaredStep(d) <= step
  const joined = new Map(
    [...scopes.joins]
      .filter(([def]) => made(def))
      .map(([def, fwd]) => [fwd, def]),
  )
  // A declaration that gave way is found as its definition's row.
  const found =
    foundAt === undefined ? undefined : (joined.get(foundAt) ?? foundAt)
  const visibleDecls = new Map(
    shown.map((s) => [
      s,
      list[s].decls.filter((d) => made(d) && !joined.has(d)),
    ]),
  )
  shown = shown.filter(
    (s) => s === home || (visibleDecls.get(s)?.length ?? 0) > 0,
  )
  const parentOf = (s: number) => {
    let p = list[s].parent
    while (p !== null && !shown.includes(p)) p = list[p].parent
    return p
  }
  const here = (s: number) => (s === home ? 'here' : '')
  const last =
    w.kind === 'check.nameError'
      ? (home ?? shown[0])
      : [...searched].reverse().find((s) => shown.includes(s))
  const cue =
    w.kind === 'check.nameError'
      ? w.message
      : use === undefined || found !== undefined
        ? undefined
        : w.kind === 'check.unresolved'
          ? 'not found'
          : w.kind === 'check.builtin'
            ? 'built-in'
            : undefined

  const scopeList = (s: number): ReactNode => {
    const decls = visibleDecls.get(s) ?? []
    const inner = shown.filter((c) => parentOf(c) === s)
    // A function's scope hangs off its declaration; any other opens a line.
    const owned = new Map(
      inner
        .filter((c) => decls.includes(list[c].node ?? -1))
        .map((c) => [list[c].node as number, c]),
    )
    // In source order.
    const items = [
      ...decls.map((d) => ({ at: nodes[d].token, decl: d })),
      ...inner
        .filter((c) => !owned.has(list[c].node ?? -1))
        .map((c) => ({
          at: nodes[list[c].node ?? 0]?.token ?? Infinity,
          scope: c,
        })),
    ].sort((p, q) => p.at - q.at)
    const hit = found !== undefined && decls.includes(found)
    const passed = searched.includes(s) && !hit
    return (
      <ul
        className={`ac-scope ${passed ? 'passed' : ''} ${hit ? 'hit' : ''} ${s === home ? 'home' : ''}`}
      >
        <AnimatePresence>
          {items.length === 0 && (
            <motion.li key="empty" className="ac-scope-empty" {...row}>
              empty
            </motion.li>
          )}
          {items.map((item) =>
            'decl' in item ? (
              <motion.li key={`d${item.decl}`} {...row}>
                <code
                  className={`${
                    item.decl !== found
                      ? ''
                      : w.kind === 'check.resolve' || w.kind === 'check.link'
                        ? 'found ok'
                        : 'found'
                  } ${owned.has(item.decl) ? here(owned.get(item.decl) as number) : ''}`}
                >
                  {nodes[item.decl].kind === 'function' ||
                  nodes[item.decl].label.startsWith('FunDecl ')
                    ? `${nameOf(item.decl)}()`
                    : nodes[item.decl].label}
                </code>
                <span className="ac-scope-kind">{declKind(item.decl)}</span>
                {owned.has(item.decl) &&
                  scopeList(owned.get(item.decl) as number)}
              </motion.li>
            ) : (
              <motion.li key={`s${item.scope}`} {...row}>
                <span className={`ac-scope-name ${here(item.scope)}`}>
                  {list[item.scope].label}
                </span>
                {scopeList(item.scope)}
              </motion.li>
            ),
          )}
          {cue && s === last && (
            <motion.li key="cue" {...row}>
              {cue === 'not found' && use !== undefined ? (
                // Which name wasn't found, not just that one wasn't.
                <small className="err">
                  <code>{nameOf(use)}</code> not found
                </small>
              ) : w.kind === 'check.nameError' ? (
                <small className="err">{cue}</small>
              ) : (
                <small>{cue}</small>
              )}
            </motion.li>
          )}
        </AnimatePresence>
      </ul>
    )
  }

  const root = shown[0] ?? 0
  return (
    <div className="ac-scopes" role="region" aria-label="Scopes">
      <span className={`ac-scope-name ${here(root)}`}>{list[root].label}</span>
      {scopeList(root)}
    </div>
  )
}
