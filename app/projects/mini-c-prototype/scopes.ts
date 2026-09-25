import type { RecordedScope, Trace } from './trace'

// Scopes as NameAnalyzer.java opened them, recorded by the compiler
// (trace.scopes): one global scope (functions and global variables), one per
// function (its parameters and the declarations at the top of its body share
// it), one per nested block. Each name step says which scope it happened in
// and which scopes its lookup searched, so nothing here works them out.

export type Scope = RecordedScope

export type Scopes = {
  scopes: Scope[]
  /** The step a declaration went into its scope; -1 if it was there from the start. */
  declaredStep: (decl: number) => number
  /** A forward declaration, by the definition that joined it. */
  joins: Map<number, number>
}

export function scopesOf(trace: Trace): Scopes {
  const steps = new Map<number, number>()
  const joins = new Map<number, number>()
  trace.frames.forEach((f, i) => {
    if (f.why.kind !== 'check.declare') return
    steps.set(f.why.decl, i)
    // The definition may come first (`int g(int a) {…} int g(int a);`).
    if (f.why.joins === undefined) return
    const def = trace.nodes[f.why.decl].kind === 'function'
    joins.set(def ? f.why.decl : f.why.joins, def ? f.why.joins : f.why.decl)
  })
  return {
    scopes: trace.scopes ?? [],
    declaredStep: (decl) => steps.get(decl) ?? -1,
    joins,
  }
}
