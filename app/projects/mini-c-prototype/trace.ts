// Original, bounded teaching compiler. It never executes source or calls private coursework code.
export type Span = { start: number; end: number }
export type Token = Span & {
  id: number
  text: string
  kind: 'keyword' | 'name' | 'number' | 'symbol'
}
export type AstNode = Span & {
  id: number
  label: string
  kind:
    | 'function'
    | 'declare'
    | 'assign'
    | 'return'
    | 'binary'
    | 'number'
    | 'name'
    // kinds only the compiler-emitted traces produce (reference/*.trace.json)
    | 'program'
    | 'block'
    | 'while'
    | 'if'
    | 'call'
    | 'unary'
    | 'statement'
    | 'expr'
  children: number[]
  token: number
}
export type Instruction = {
  op: string
  dest?: string | null
  args: string[]
  node: number | null
  // compiler-emitted traces: the real MIPS line on virtual registers, the
  // function it belongs to, and any labels that precede it
  text?: string
  fn?: number
  labels?: string[]
}
// The real allocator's working, recorded per function by the compiler's
// test utility: one CFG block per instruction, liveness sweep by sweep,
// the interference graph, and the simplify/select order.
export type Backend = {
  k: number
  palette: string[]
  functions: {
    name: string
    node: number | null
    first: number
    blocks: {
      id: number
      labels: string[]
      text: string
      def: string | null
      uses: string[]
      succ: number[]
    }[]
    liveness: (
      | {
          sweep: number
          changes: { block: number; in: string[]; out: string[] }[]
        }
      | {
          sweep: 'final'
          deadDefs: number[]
          blocks: { block: number; in: string[]; out: string[] }[]
        }
    )[]
    interference: {
      nodes: string[]
      edges: [string, string][]
      degree: Record<string, number>
    }
    colouring: {
      steps: {
        op: 'simplify' | 'spillCandidate' | 'select' | 'spill'
        vr: string
        degree?: number
        forbidden?: string[]
        colour?: string
      }[]
      result: Record<string, string>
      spills: string[]
    }
  }[]
}
// The decision behind a frame, as facts rather than prose. explain.ts turns
// these into sentences, so wording lives in one place and works for any
// source text. Ids refer to trace.tokens / trace.nodes / trace.instructions.
export type Why =
  | { kind: 'ready' }
  | { kind: 'token'; token: number }
  // Detailed lexer mode (detail.ts): one character of a token read, `next`
  // set on its last one; whitespace or a comment skipped between tokens.
  | { kind: 'lex.char'; token: number; at: number; next?: string }
  | { kind: 'lex.skip'; start: number; end: number; comment: boolean }
  | { kind: 'parse.read'; token: number }
  | { kind: 'parse.node'; node: number }
  | { kind: 'parse.take'; parent: number; role: string; child: number }
  // an operator read its left input and now needs the right one
  | { kind: 'parse.wait'; node: number; child: number }
  | {
      kind: 'parse.precedence'
      pending: string
      incoming: string
      relation: 'tighter' | 'equal' | 'looser'
      child: number
    }
  | { kind: 'parse.group'; span: Span; state: 'open' | 'closed' }
  | { kind: 'parse.close'; node: number }
  | { kind: 'parse.done'; root: number }
  | { kind: 'check.resolve'; use: number; decl: number; where: string }
  | { kind: 'check.unresolved'; use: number }
  | { kind: 'check.builtin'; use: number }
  | { kind: 'check.type'; node: number; type: string; expected?: string }
  | { kind: 'check.namesDone'; unresolved: number }
  // instructions from..to (inclusive) came from one node
  | { kind: 'emit.instr'; node: number; from: number; to: number }
  | { kind: 'emit.prologue'; node: number; from: number; to: number }
  | { kind: 'emit.epilogue'; node: number; from: number; to: number }
  | { kind: 'emit.value'; node: number; v: string }
  // toy allocator (typed programs)
  | { kind: 'reg.assign'; v: string; r: string }
  | { kind: 'reg.reuse'; v: string; r: string; diedAt: number; prevV: string }
  // real allocator (presets); fn and step index into trace.backend
  | { kind: 'reg.cfg'; fn: number; blocks: number; back: [number, number][] }
  | { kind: 'reg.live'; fn: number; sweep: number; changed: number }
  | {
      kind: 'reg.interfere'
      fn: number
      nodes: number
      edges: number
      busiest: string
      degree: number
    }
  | { kind: 'reg.simplify'; fn: number; step: number; at: number | null }
  | { kind: 'reg.spillCandidate'; fn: number; step: number; at: number | null }
  | { kind: 'reg.select'; fn: number; step: number; at: number | null }
  | { kind: 'reg.spill'; fn: number; step: number; at: number | null }
  | { kind: 'reg.done'; fn?: number; used?: number; spills?: number }

export type Frame = {
  phase: 'Tokens' | 'Parse' | 'Check' | 'Emit' | 'Registers'
  title: string
  why: Why
  span: Span
  tokenCount: number
  consumed: number[]
  nodes: number[]
  attached: number[]
  focus: number | null
  instructionCount: number
  allocationCount: number
  // Check phase, compiler traces only: [use node, declaration node]
  links?: [number, number][]
}
export type Trace = {
  tokens: Token[]
  nodes: AstNode[]
  frames: Frame[]
  instructions: Instruction[]
  registers: Record<string, string>
  error?: Span & { message: string }
  root?: number
  // set only on compiler-emitted traces: the real ASTPrinter output and
  // the semantic analyser's lines, so the reference panel needs no toy
  text?: string
  ast?: string
  sem?: string[]
  backend?: Backend
}
class CompileError extends Error {
  constructor(
    message: string,
    public span: Span,
  ) {
    super(message)
  }
}
export function buildTrace(source: string): Trace {
  const result: Trace = {
    text: source,
    tokens: [],
    nodes: [],
    frames: [],
    instructions: [],
    registers: {},
  }
  let consumed: number[] = [],
    visible: number[] = [],
    attached: number[] = []
  const push = (
    phase: Frame['phase'],
    title: string,
    span: Span,
    why: Why,
    focus: number | null = null,
  ) =>
    result.frames.push({
      phase,
      title,
      why,
      span,
      focus,
      tokenCount: result.tokens.length,
      consumed: [...consumed],
      nodes: [...visible],
      attached: [...attached],
      instructionCount: result.instructions.length,
      allocationCount: 0,
    })
  try {
    if (source.length > 1200)
      throw new CompileError('Keep this sketch under 1,200 characters.', {
        start: 0,
        end: source.length,
      })
    push(
      'Tokens',
      'Press play. Follow the source into a tree.',
      { start: 0, end: 0 },
      { kind: 'ready' },
    )
    for (let offset = 0; offset < source.length; ) {
      if (/\s/.test(source[offset])) {
        offset++
        continue
      }
      if (source.slice(offset, offset + 2) === '//') {
        const end = source.indexOf('\n', offset)
        offset = end < 0 ? source.length : end
        continue
      }
      const text = source
        .slice(offset)
        .match(/^(?:[A-Za-z_][A-Za-z_0-9]*|\d+|[(){};+*\-=])/)?.[0]
      if (!text)
        throw new CompileError(
          `“${source[offset]}” is outside this sketch’s arithmetic subset.`,
          { start: offset, end: offset + 1 },
        )
      if (result.tokens.length >= 90)
        throw new CompileError(
          'Use at most 90 tokens so the tree stays readable.',
          { start: offset, end: offset + text.length },
        )
      const kind = ['int', 'return'].includes(text)
        ? 'keyword'
        : /^\d/.test(text)
          ? 'number'
          : /^[A-Za-z_]/.test(text)
            ? 'name'
            : 'symbol'
      const token: Token = {
        id: result.tokens.length,
        text,
        kind,
        start: offset,
        end: offset + text.length,
      }
      result.tokens.push(token)
      push(
        'Tokens',
        `${kind === 'symbol' ? 'Symbol' : kind === 'name' ? 'Identifier' : kind === 'keyword' ? 'Keyword' : 'Integer'}  ·  ${text}`,
        token,
        { kind: 'token', token: token.id },
      )
      offset += text.length
    }
    let cursor = 0
    const peek = () => result.tokens[cursor]
    // silent: the token becomes a node in the very next frame, so a
    // separate "read" frame would only repeat it
    const take = (expected?: string, silent = false): Token => {
      const t = peek()
      if (!t || (expected && t.text !== expected))
        throw new CompileError(
          `Expected ${expected ? `“${expected}”` : 'an expression'}${t ? `, found “${t.text}”` : ' at the end'}.`,
          t || { start: source.length, end: source.length },
        )
      cursor++
      consumed = [...consumed, t.id]
      if (!silent)
        push('Parse', `Read ${t.text}`, t, { kind: 'parse.read', token: t.id })
      return t
    }
    const add = (
      kind: AstNode['kind'],
      label: string,
      token: Token,
      children: number[] = [],
      span: Span = token,
      title?: string,
      why?: Why,
    ) => {
      const node: AstNode = {
        id: result.nodes.length,
        kind,
        label,
        token: token.id,
        children,
        start: span.start,
        end: span.end,
      }
      result.nodes.push(node)
      visible = [...visible, node.id]
      attached = [...attached, ...children]
      push(
        'Parse',
        title ??
          (children.length
            ? `Build ${label} from ${children.length} ${children.length === 1 ? 'child' : 'children'}`
            : `Make ${label} a ${kind === 'number' ? 'literal' : 'name'} node`),
        span,
        why ??
          (children.length
            ? { kind: 'parse.close', node: node.id }
            : { kind: 'parse.node', node: node.id }),
        node.id,
      )
      return node.id
    }
    const primary = (): number => {
      const t = peek()
      if (t?.text === '(') {
        take('(')
        push(
          'Parse',
          'A group: everything inside closes before anything outside',
          t,
          { kind: 'parse.group', span: t, state: 'open' },
        )
        const id = expression(0)
        const close = take(')')
        result.nodes[id].start = t.start
        result.nodes[id].end = close.end
        push(
          'Parse',
          `The group is one piece now: ${text(id)}`,
          close,
          { kind: 'parse.group', span: result.nodes[id], state: 'closed' },
          id,
        )
        return id
      }
      if (!t || !['number', 'name'].includes(t.kind))
        throw new CompileError(
          'Expected a number, a local name, or a parenthesized expression.',
          t || { start: source.length, end: source.length },
        )
      take(undefined, true)
      return add(t.kind === 'number' ? 'number' : 'name', t.text, t)
    }
    // Same shape as the real parser: one expression function with a limit,
    // and a table saying how tightly each operator binds. Numbers stay
    // internal; captions say "tighter" or "no tighter".
    const binding: Record<string, number> = { '*': 7, '+': 6, '-': 6 }
    const glyph = (op: string) => (op === '*' ? '×' : op)
    const text = (id: number) =>
      source.slice(result.nodes[id].start, result.nodes[id].end)
    const expression = (limit: number, holder?: string): number => {
      let left = primary()
      for (;;) {
        const t = peek()
        const prec = t ? binding[t.text] : undefined
        if (!t || prec === undefined) break
        if (prec <= limit) {
          // Only reached with an operator waiting on the left, so holder is set.
          push(
            'Parse',
            glyph(t.text) === holder
              ? `Another ${holder}: the one already waiting closes first, left to right`
              : `${glyph(t.text)} binds no tighter than ${holder}, so ${holder} closes first`,
            t,
            {
              kind: 'parse.precedence',
              pending: holder ?? '',
              incoming: glyph(t.text),
              relation: glyph(t.text) === holder ? 'equal' : 'looser',
              child: left,
            },
          )
          break
        }
        if (holder)
          push(
            'Parse',
            `${glyph(t.text)} binds tighter than ${holder}, so ${text(left)} goes to ${glyph(t.text)} first`,
            t,
            {
              kind: 'parse.precedence',
              pending: holder,
              incoming: glyph(t.text),
              relation: 'tighter',
              child: left,
            },
          )
        const op = take(undefined, true)
        const label = glyph(op.text)
        const id = add(
          'binary',
          label,
          op,
          [left],
          { start: result.nodes[left].start, end: op.end },
          `${label} takes ${text(left)} as its left side and waits for the right`,
          { kind: 'parse.wait', node: result.nodes.length, child: left },
        )
        const right = expression(prec, label)
        result.nodes[id].children = [left, right]
        result.nodes[id].end = result.nodes[right].end
        attached = [...attached, right]
        push(
          'Parse',
          `${label} closes over ${text(id)}`,
          result.nodes[id],
          { kind: 'parse.close', node: id },
          id,
        )
        left = id
      }
      return left
    }
    // Parents appear when the parser enters them and wait (dashed) until each
    // child completes, the same order the real compiler's ParseTrace records.
    take('int')
    const main = take('main', true)
    const statements: number[] = []
    result.root = add(
      'function',
      'main',
      main,
      statements,
      { start: main.start, end: main.end },
      'Function main: parameters, then the body',
      { kind: 'parse.node', node: result.nodes.length },
    )
    take('(')
    take(')')
    take('{')
    // A statement node opens empty, takes its value, then joins main.
    const statement = (
      kind: 'return' | 'assign',
      label: string,
      token: Token,
      title: string,
      done: (value: string) => string,
    ) => {
      const id = add(
        kind,
        label,
        token,
        [],
        { start: token.start, end: token.end },
        title,
        { kind: 'parse.node', node: result.nodes.length },
      )
      statements.push(id)
      const child = expression(0)
      const end = take(';').end
      result.nodes[id].children = [child]
      result.nodes[id].end = end
      attached = [...attached, child]
      push(
        'Parse',
        done(text(child)),
        { start: token.start, end },
        { kind: 'parse.close', node: id },
        id,
      )
      attached = [...attached, id]
    }
    while (peek() && peek().text !== '}') {
      const t = peek()
      if (t.text === 'int') {
        take(undefined, true)
        const name = take(undefined, true)
        if (name.kind !== 'name')
          throw new CompileError('Expected a local variable name.', name)
        if (peek()?.text === '=')
          throw new CompileError(
            'Mini-C declarations take no initializer. Assign on the next line.',
            peek(),
          )
        const end = take(';').end
        const id = add(
          'declare',
          `int ${name.text}`,
          name,
          [],
          { start: t.start, end },
          `Declare ${name.text} as int`,
          { kind: 'parse.node', node: result.nodes.length },
        )
        statements.push(id)
        attached = [...attached, id]
      } else if (t.text === 'return') {
        take(undefined, true)
        statement(
          'return',
          'return',
          t,
          'return: read the value',
          (v) => `return takes ${v}`,
        )
      } else if (t.kind === 'name') {
        const name = take(undefined, true)
        take('=')
        statement(
          'assign',
          `${name.text} =`,
          name,
          `Assign into ${name.text}: read the value`,
          (v) => `${name.text} = takes ${v}`,
        )
      } else
        throw new CompileError(
          'Use int declarations, assignments, and one final return. Loops and calls are not in this sketch yet.',
          t,
        )
    }
    const close = take('}')
    if (peek())
      throw new CompileError(
        'This sketch accepts one int main() function.',
        peek(),
      )
    if (
      !statements.length ||
      result.nodes[statements[statements.length - 1]].kind !== 'return' ||
      statements.filter((id) => result.nodes[id].kind === 'return').length !== 1
    )
      throw new CompileError(
        'End main with exactly one return statement.',
        close,
      )
    if (result.nodes.length > 32)
      throw new CompileError(
        'Keep the tree under 32 nodes for this animated sketch.',
        main,
      )
    result.nodes[result.root].end = source.length
    push(
      'Parse',
      'Function main is complete',
      { start: 0, end: source.length },
      { kind: 'parse.close', node: result.root },
      result.root,
    )
    push(
      'Parse',
      `Tree complete: ${result.nodes.length} nodes`,
      { start: 0, end: source.length },
      { kind: 'parse.done', root: result.root },
      result.root,
    )
    const declared = new Map<string, number>(),
      initialized = new Set<string>()
    const checkExpr = (id: number): void => {
      const n = result.nodes[id]
      if (n.kind === 'name') {
        const decl = declared.get(n.label)
        if (decl === undefined || !initialized.has(n.label)) {
          push(
            'Check',
            `No ${decl === undefined ? 'declaration' : 'value yet'} for ${n.label}`,
            n,
            { kind: 'check.unresolved', use: id },
            id,
          )
          throw new CompileError(
            decl !== undefined
              ? `“${n.label}” is read before it has a value.`
              : `“${n.label}” has no declaration.`,
            n,
          )
        }
        push(
          'Check',
          `${n.label} refers to its declaration above`,
          n,
          { kind: 'check.resolve', use: id, decl, where: 'above' },
          id,
        )
      }
      n.children.forEach(checkExpr)
    }
    for (const id of statements) {
      const n = result.nodes[id],
        name = result.tokens[n.token].text
      if (n.kind === 'declare') {
        if (declared.has(name))
          throw new CompileError(`“${name}” is already declared.`, n)
        declared.set(name, id)
        push(
          'Check',
          `${name} is declared here as int`,
          n,
          { kind: 'check.type', node: id, type: 'int' },
          id,
        )
      } else {
        const decl = declared.get(name)
        if (n.kind === 'assign' && decl === undefined)
          throw new CompileError(`Declare “${name}” before assigning it.`, n)
        n.children.forEach(checkExpr)
        if (n.kind === 'assign' && decl !== undefined) {
          initialized.add(name)
          push(
            'Check',
            `${name} refers to its declaration above`,
            n,
            { kind: 'check.resolve', use: id, decl, where: 'above' },
            id,
          )
        } else
          push(
            'Check',
            'Return expression has type int',
            n,
            { kind: 'check.type', node: id, type: 'int', expected: 'int' },
            id,
          )
      }
    }
    push(
      'Check',
      'Every name has a declaration',
      { start: 0, end: source.length },
      { kind: 'check.namesDone', unresolved: 0 },
      result.root,
    )
    const locals = new Map<string, string>()
    let nextRegister = 0
    const emit = (
      op: string,
      args: string[],
      node: AstNode,
      hasDest = true,
    ) => {
      const dest = hasDest ? `v${nextRegister++}` : undefined
      result.instructions.push({ op, args, dest, node: node.id })
      push(
        'Emit',
        hasDest ? `${node.label} → ${dest}` : 'Return the computed value',
        node,
        {
          kind: 'emit.instr',
          node: node.id,
          from: result.instructions.length - 1,
          to: result.instructions.length - 1,
        },
        node.id,
      )
      return dest || ''
    }
    const generate = (id: number): string => {
      const n = result.nodes[id]
      if (n.kind === 'number') return emit('li', [n.label], n)
      if (n.kind === 'name') {
        push(
          'Emit',
          `${n.label} already lives in ${locals.get(n.label)}`,
          n,
          { kind: 'emit.value', node: id, v: locals.get(n.label) || '' },
          id,
        )
        return locals.get(n.label) || ''
      }
      const args = n.children.map(generate)
      return emit(
        n.label === '×' ? 'mul' : n.label === '+' ? 'add' : 'sub',
        args,
        n,
      )
    }
    for (const id of statements) {
      const n = result.nodes[id]
      if (n.children.length) {
        const value = generate(n.children[0])
        if (n.kind === 'return') emit('return', [value], n, false)
        else locals.set(result.tokens[n.token].text, value)
      }
    }
    const lastUse: Record<string, number> = {}
    result.instructions.forEach((ins, i) => {
      if (ins.dest) lastUse[ins.dest] = i
      ins.args.filter((a) => /^v\d+$/.test(a)).forEach((a) => (lastUse[a] = i))
    })
    const occupied = new Map<string, number>()
    result.instructions.forEach((ins, i) => {
      // Three-address pseudo instructions read operands before writing the destination.
      const freed: [string, number][] = []
      for (const [v, r] of occupied)
        if (lastUse[v] <= i) {
          occupied.delete(v)
          freed.push([v, r])
        }
      let why: Why = { kind: 'reg.done' }
      if (ins.dest) {
        let r = 0
        while ([...occupied.values()].includes(r)) r++
        occupied.set(ins.dest, r)
        result.registers[ins.dest] = `r${r}`
        const prev = freed.find(([, freedR]) => freedR === r)
        why = prev
          ? {
              kind: 'reg.reuse',
              v: ins.dest,
              r: `r${r}`,
              diedAt: lastUse[prev[0]],
              prevV: prev[0],
            }
          : { kind: 'reg.assign', v: ins.dest, r: `r${r}` }
      }
      const n = result.nodes[ins.node ?? 0]
      push(
        'Registers',
        ins.dest
          ? `${ins.dest} → ${result.registers[ins.dest]} · reuse storage when a value dies`
          : 'Virtual names are now physical registers',
        n,
        why,
        n.id,
      )
      result.frames[result.frames.length - 1].allocationCount = i + 1
    })
  } catch (error) {
    if (error instanceof CompileError)
      result.error = { message: error.message, ...error.span }
    else throw error
  }
  return result
}
export function instructionText(
  instruction: Instruction,
  registers?: Record<string, string>,
) {
  const map = (v: string) => registers?.[v] || v
  if (instruction.text !== undefined) {
    // real MIPS line: "li v0,4" → "li $t0,4" once v0 has a register
    const [op, rest = ''] = instruction.text.split(/\s+(.*)/)
    return `${op.padEnd(7)}${rest.replace(/\bv\d+\b/g, map)}`
  }
  return `${instruction.op.padEnd(7)}${[...(instruction.dest ? [instruction.dest] : []), ...instruction.args].map(map).join(', ')}`
}

/** Registers coloured by the real allocator up to and including step `step` of function `fn`. */
export function colouredUpTo(
  backend: Backend,
  fn: number,
  step: number,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (let f = 0; f <= fn && f < backend.functions.length; f++) {
    const steps = backend.functions[f].colouring.steps
    const limit = f === fn ? Math.min(step, steps.length - 1) : steps.length - 1
    for (let i = 0; i <= limit; i++) {
      const s = steps[i]
      if (s.op === 'select' && s.colour) out[s.vr] = s.colour
    }
  }
  return out
}

/** Live-in/live-out per instruction id after `sweep` sweeps of function `fn`. */
export function liveAfterSweep(
  backend: Backend,
  fn: number,
  sweep: number,
): Record<number, { in: string[]; out: string[] }> {
  const f = backend.functions[fn]
  const out: Record<number, { in: string[]; out: string[] }> = {}
  for (const sw of f.liveness) {
    if (typeof sw.sweep !== 'number' || sw.sweep > sweep) continue
    for (const c of sw.changes)
      out[f.first + c.block] = { in: c.in, out: c.out }
  }
  return out
}
/**
 * Lays the tree out in pixels. Each subtree gets a slot as wide as its widest
 * row, so labels at any depth never overlap; parents sit over their children.
 * `x` is the slot centre from 0 to `width`, `y` the depth.
 */
export function treePositions(
  trace: Trace,
  labelWidth: (node: AstNode) => number,
  gap = 14,
): {
  at: Record<number, { x: number; y: number }>
  width: number
  depth: number
} {
  const at: Record<number, { x: number; y: number }> = {}
  const span: Record<number, number> = {}
  let depth = 0
  const measure = (id: number): number => {
    const n = trace.nodes[id]
    const kids = n.children.reduce((sum, c) => sum + measure(c), 0)
    span[id] = Math.max(labelWidth(n) + gap, kids)
    return span[id]
  }
  const place = (id: number, left: number, level: number) => {
    const n = trace.nodes[id]
    depth = Math.max(depth, level)
    at[id] = { x: left + span[id] / 2, y: level }
    const kids = n.children.reduce((sum, c) => sum + span[c], 0)
    let x = left + (span[id] - kids) / 2
    for (const c of n.children) {
      place(c, x, level + 1)
      x += span[c]
    }
  }
  const childIds = new Set(trace.nodes.flatMap((n) => n.children))
  const roots =
    trace.root === undefined
      ? trace.nodes.filter((n) => !childIds.has(n.id)).map((n) => n.id)
      : [trace.root]
  let width = 0
  for (const id of roots) {
    measure(id)
    place(id, width, 0)
    width += span[id]
  }
  return { at, width: Math.max(1, width), depth }
}

const OPS: Record<string, string> = {
  '+': 'ADD',
  '-': 'SUB',
  '×': 'MUL',
  '*': 'MUL',
  '/': 'DIV',
  '%': 'MOD',
  '<': 'LT',
  '>': 'GT',
  '<=': 'LE',
  '>=': 'GE',
  '==': 'EQ',
  '!=': 'NE',
  '&&': 'AND',
  '||': 'OR',
}

// The tree as ASTPrinter would print it at this frame: a child prints as soon
// as it is on screen, even while its parent is still waiting to close, and
// anything not yet read is an ellipsis. Works for toy and compiler traces.
export function partialSExpression(trace: Trace, frame: Frame): string {
  if (trace.root === undefined) return '…'
  const text = (n: AstNode) => (trace.text ?? '').slice(n.start, n.end)
  const typed = (label: string) => {
    const at = label.indexOf(' ')
    return [label.slice(0, at).toUpperCase(), label.slice(at + 1)]
  }
  const child = (n: AstNode, i: number): string => {
    const id = n.children[i]
    return id !== undefined && frame.nodes.includes(id) ? print(id) : '…'
  }
  const all = (n: AstNode, from = 0) =>
    n.children.slice(from).map((_, i) => child(n, i + from))
  const print = (id: number): string => {
    const n = trace.nodes[id]
    switch (n.kind) {
      case 'program':
        return `Program(${all(n).join(',')})`
      case 'function': {
        const params = n.children.filter((c) => {
          const p = trace.nodes[c]
          return p.kind === 'declare' && !text(p).endsWith(';')
        })
        const [type] = typed(
          trace.text
            ? trace.text.slice(n.start, n.start + 4).trim() + ' '
            : 'int ',
        )
        const head = [type, n.label, ...params.map((c) => print(c))]
        const body = n.children
          .filter((c) => !params.includes(c))
          .map((c) => (frame.nodes.includes(c) ? print(c) : '…'))
        return `FunDef(${head.join(',')},Block(${body.join(',')}))`
      }
      case 'declare': {
        const [type, name] = typed(n.label)
        return `VarDecl(${type},${name})`
      }
      case 'assign':
        return `ExprStmt(Assign(VarExpr(${n.label.replace(' =', '')}),${child(n, 0)}))`
      case 'return':
        return n.children.length ? `Return(${child(n, 0)})` : 'Return()'
      case 'binary':
        return n.label === '='
          ? `Assign(${child(n, 0)},${child(n, 1)})`
          : `BinOp(${child(n, 0)},${OPS[n.label] ?? n.label},${child(n, 1)})`
      case 'unary':
        return n.label === '-'
          ? `BinOp(IntLiteral(0),SUB,${child(n, 0)})`
          : `${n.label}(${child(n, 0)})`
      case 'number':
        return n.label.startsWith("'")
          ? `ChrLiteral(${n.label.slice(1, -1)})`
          : n.label.startsWith('"')
            ? `StrLiteral(${n.label.slice(1, -1)})`
            : `IntLiteral(${n.label})`
      case 'name':
        return `VarExpr(${n.label})`
      case 'while':
        return `While(${child(n, 0)},${child(n, 1)})`
      case 'if':
        return `If(${all(n).join(',')})`
      case 'block':
        return `Block(${all(n).join(',')})`
      case 'call':
        return `FunCallExpr(${[n.label.replace('()', ''), ...all(n)].join(',')})`
      case 'statement':
        return `ExprStmt(${child(n, 0)})`
      default:
        return `${n.label}(${all(n).join(',')})`
    }
  }
  const root = trace.nodes[trace.root]
  if (!frame.nodes.includes(root.id)) return '…'
  const out = print(root.id)
  return root.kind === 'function' ? `Program(${out})` : out
}

// Renders the sketch's tree in the real compiler's ASTPrinter notation so the
// two can be compared as plain strings.
export function toSExpression(trace: Trace): string | undefined {
  if (trace.root === undefined) return undefined
  const ops: Record<string, string> = { '+': 'ADD', '-': 'SUB', '×': 'MUL' }
  const expr = (id: number): string => {
    const n = trace.nodes[id]
    if (n.kind === 'number') return `IntLiteral(${n.label})`
    if (n.kind === 'name') return `VarExpr(${n.label})`
    return `BinOp(${expr(n.children[0])},${ops[n.label]},${expr(n.children[1])})`
  }
  const stmt = (id: number): string => {
    const n = trace.nodes[id],
      name = trace.tokens[n.token].text
    if (n.kind === 'declare') return `VarDecl(INT,${name})`
    if (n.kind === 'assign')
      return `ExprStmt(Assign(VarExpr(${name}),${expr(n.children[0])}))`
    return `Return(${expr(n.children[0])})`
  }
  const body = trace.nodes[trace.root].children.map(stmt).join(',')
  return `Program(FunDef(INT,main,Block(${body})))`
}
// Indents an s-expression one node per line when it has nested children.
export function prettySExpression(text: string): string {
  type Node = { name: string; args: Node[] }
  let i = 0
  const parse = (): Node => {
    let name = ''
    while (i < text.length && !'(),'.includes(text[i])) name += text[i++]
    const node: Node = { name, args: [] }
    if (text[i] === '(') {
      i++
      while (text[i] !== ')') {
        node.args.push(parse())
        if (text[i] === ',') i++
      }
      i++
    }
    return node
  }
  const print = (n: Node, depth: number): string => {
    const pad = ' '.repeat(depth)
    if (!n.args.length) return pad + n.name
    if (n.args.every((a) => !a.args.length))
      return `${pad}${n.name}(${n.args.map((a) => a.name).join(', ')})`
    return `${pad}${n.name}(\n${n.args.map((a) => print(a, depth + 1)).join(',\n')}\n${pad})`
  }
  return print(parse(), 0)
}
