import type { Frame, Trace } from './trace'

// Scopes as NameAnalyzer.java keeps them: one global scope (functions and
// global variables), one per function (its parameters and the declarations
// at the top of its body share it), and one per nested block. The recorded
// trace has none of this, so it is read off the AST.

export type Scope = {
  id: number
  /** The function or block node that opens it; null for the global scope. */
  node: number | null
  parent: number | null
  label: string
  /** Declarations (and, globally, functions) in source order. */
  decls: number[]
}

export type Scopes = {
  scopes: Scope[]
  /** The innermost scope a node sits in. */
  scopeOf: (node: number) => number
  /** The token from which a declaration is visible. */
  declaredAt: (decl: number) => number
  /** The declaration `name` means at `node`, and the scopes searched. */
  lookup: (name: string, node: number) => { decl?: number; path: number[] }
}

export function scopesOf(trace: Trace): Scopes {
  const nodes = trace.nodes
  const name = (id: number) => trace.tokens[nodes[id].token]?.text
  const parent = new Map<number, number>()
  for (const n of nodes) for (const c of n.children) parent.set(c, n.id)
  const root = trace.root === undefined ? undefined : nodes[trace.root]

  const scopes: Scope[] = [
    { id: 0, node: null, parent: null, label: 'global', decls: [] },
  ]
  const opened = new Map<number, number>()
  // A forward declaration (`int f(int x);`, recorded as a `declare` labelled
  // "FunDecl f") makes `f` visible from there, but NameAnalyzer ties calls
  // to the definition. So the definition stands in its place, visible from
  // the forward declaration's token.
  const visible = new Map<number, number>()
  const forward = new Map<string, number>()
  const visit = (id: number, scope: number) => {
    const n = nodes[id]
    let inner = scope
    if (n.kind === 'declare' && n.label.startsWith('FunDecl ')) {
      forward.set(name(id), n.token)
      return
    }
    if (n.kind === 'function' || n.kind === 'block') {
      if (n.kind === 'function') {
        scopes[scope].decls.push(id)
        const early = forward.get(name(id))
        if (early !== undefined) visible.set(id, early)
      }
      inner = scopes.length
      scopes.push({
        id: inner,
        node: id,
        parent: scope,
        label: n.kind === 'function' ? n.label : 'block',
        decls: [],
      })
      opened.set(id, inner)
    } else if (n.kind === 'declare') scopes[scope].decls.push(id)
    for (const c of n.children) visit(c, inner)
  }
  if (root?.kind === 'program') for (const c of root.children) visit(c, 0)
  else if (root) visit(root.id, 0)

  const scopeOf = (id: number) => {
    for (let at: number | undefined = parent.get(id); at !== undefined; ) {
      const s = opened.get(at)
      if (s !== undefined) return s
      at = parent.get(at)
    }
    return 0
  }
  // Innermost first, and only what is declared before the use: C reads top
  // down, so a later declaration of the same name doesn't count yet. A
  // function's own name is visible inside it.
  const declaredAt = (d: number) => visible.get(d) ?? nodes[d].token
  const lookup = (wanted: string, id: number) => {
    const at = nodes[id].token
    const path: number[] = []
    for (let s: number | null = scopeOf(id); s !== null; ) {
      path.push(s)
      const decl = scopes[s].decls.find(
        (d) => name(d) === wanted && declaredAt(d) <= at,
      )
      if (decl !== undefined) return { decl, path }
      s = scopes[s].parent
    }
    return { path }
  }
  return { scopes, scopeOf, declaredAt, lookup }
}

// The recorded trace resolves every name use except assignment targets: the
// tree folds `i` into its `i =` node, so the recorder has no node to point
// at. NameAnalyzer does resolve them, target before value, so each target
// gets its own step here, in source order, before the uses on its right.
export function withTargets(trace: Trace): Trace {
  if (trace.ast === undefined) return trace
  const first = trace.frames.findIndex((f) => f.phase === 'Check')
  const done = trace.frames.findIndex((f) => f.why.kind === 'check.namesDone')
  if (first < 0 || done < 0) return trace
  const { lookup } = scopesOf(trace)
  const tokenOf = (id: number) => trace.nodes[id].token
  const targets = trace.nodes.filter((n) => n.kind === 'assign')
  if (!targets.length) return trace

  const names = trace.frames.slice(first, done)
  const steps: { token: number; frame: Frame }[] = names.map((f) => ({
    token:
      'use' in f.why && typeof f.why.use === 'number'
        ? tokenOf(f.why.use)
        : Infinity,
    frame: f,
  }))
  const added: [number, number][] = []
  let unresolved = 0
  let missing: { name: string; start: number; end: number } | undefined
  for (const a of targets) {
    const text = trace.tokens[a.token].text
    const { decl } = lookup(text, a.id)
    const t = trace.tokens[a.token]
    const base = trace.frames[first]
    const param = decl !== undefined && isParam(trace, decl)
    const frame: Frame = {
      ...base,
      // ParseTrace's own titles.
      title:
        decl === undefined
          ? `No declaration for ${text}`
          : `${text} refers to its declaration ${param ? 'in the parameters' : 'above'}`,
      why:
        decl === undefined
          ? { kind: 'check.unresolved', use: a.id }
          : {
              kind: 'check.resolve',
              use: a.id,
              decl,
              where: param ? 'param' : 'above',
            },
      span: { start: t.start, end: t.end },
      focus: a.id,
    }
    if (decl === undefined) {
      unresolved++
      missing ??= { name: text, start: t.start, end: t.end }
    } else added.push([a.id, decl])
    steps.push({ token: a.token, frame })
  }
  // A target comes before the uses in its own value (`i = i + 1`).
  steps.sort((p, q) => p.token - q.token)

  // Links build up step by step, in the new order.
  const recorded = trace.frames[done].links ?? []
  const all = [...recorded, ...added]
  const linked: [number, number][] = []
  const rebuilt = steps.map(({ frame }) => {
    const w = frame.why
    if (w.kind === 'check.resolve') {
      const pair = all.find(([u]) => u === w.use)
      if (pair) linked.push(pair)
    }
    return { ...frame, links: [...linked] }
  })
  // The recorder leaves `links` out when it has none, so a program whose
  // only names are targets still carries them on.
  const later = trace.frames.slice(done).map((f, i) => {
    const out = all.length ? { ...f, links: [...all] } : f
    if (i === 0 && f.why.kind === 'check.namesDone' && unresolved) {
      const count = f.why.unresolved + unresolved
      return {
        ...out,
        title: `${count} ${count === 1 ? 'name has' : 'names have'} no declaration`,
        why: { ...f.why, unresolved: count },
      }
    }
    return out
  })
  // A missing target is a missing name, but the recorder only names the
  // uses it has nodes for; without one of those, its error is the generic
  // "Semantic analysis failed" over the whole program.
  const namedError = names.some((f) => f.why.kind === 'check.unresolved')
  const error =
    missing && trace.error && !namedError
      ? {
          message: `“${missing.name}” has no declaration.`,
          start: missing.start,
          end: missing.end,
        }
      : trace.error
  return {
    ...trace,
    ...(error ? { error } : {}),
    frames: [...trace.frames.slice(0, first), ...rebuilt, ...later],
  }
}

const isParam = (trace: Trace, decl: number) => {
  const fn = trace.nodes.find((n) => n.children.includes(decl))
  if (fn?.kind !== 'function') return false
  // Parameters come before the body's `{`.
  const body = trace.tokens.findIndex((t, i) => i > fn.token && t.text === '{')
  return trace.nodes[decl].token < body
}
