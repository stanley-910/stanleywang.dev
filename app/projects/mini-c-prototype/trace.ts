import { isVirtual, renameVirtuals, splitLine } from './asm'
// Original, bounded teaching compiler. It never executes source or calls private coursework code.
export type Span = { start: number; end: number }
export type Token = Span & {
  id: number
  text: string
  kind: 'keyword' | 'name' | 'number' | 'symbol'
  // compiler-emitted traces: what the tokeniser read on its way to this
  // token, in order (Tokeniser.readObserver): the whitespace and comments
  // before it, its own characters, and the one it looked at to see where
  // it ends
  reads?: LexRead[]
}
// One character the tokeniser read, at a source offset: taken, or only
// looked at (`look`), and what for (Tokeniser.ReadObserver lists the
// words); or an error it reported there.
export type LexRead =
  { at: number; does: LexDecision; look?: true } | { at: number; error: string }
export type LexDecision =
  // taken: between tokens, then the first character of a token
  | 'space'
  | 'single'
  | 'word'
  | 'number'
  | 'include'
  | 'string'
  | 'char'
  | 'pair'
  | 'slash'
  | 'invalid'
  // taken: the rest of a token or a comment
  | 'continue'
  | 'escape'
  | 'escaped'
  | 'bad escape'
  | 'bad char'
  | 'close'
  | 'second'
  | 'comment'
  | 'comment end'
  // looked at (also 'invalid'): the token ends before it
  | 'end'
  | 'unterminated'
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
  // no path reaches it (the jump after a `return` inside `if` or `while`),
  // so the allocator's control-flow graph leaves it out
  dead?: boolean
  // what codegen said the line is for, and what the register allocator
  // turned it into (pushRegisters as its pushes, spill loads and stores)
  tag?: Tag
  out?: string[]
}
// Storage an expression names (ParseTrace.placeJson): its declaration's
// node and the byte offset in it where both are known at compile time.
// `through` is set instead when it is reached through a pointer.
export type Place = {
  text: string
  var: number | null
  off: number | null
  size: number
  through?: string | null
}
// CodeGen.tag, recorded by ParseTrace: a role and facts about the line.
export type Tag = {
  role:
    | 'reserve' // `for`: fp, ra, locals, arg (`param`), result
    | 'save' // `reg`: fp, ra
    | 'set-fp'
    | 'push-registers'
    | 'pop-registers'
    | 'release' // `for`: frame, call
    | 'restore' // `reg`: fp, ra
    | 'return'
    | 'addr' // `of`: the address of a place
    | 'load' // `of`
    | 'store' // `into`
    | 'index.size'
    | 'index.scale'
    | 'call'
    | 'jump.epilogue'
    | 'syscall.arg'
    | 'syscall.code'
    | 'syscall'
    | 'syscall.result'
    | `copy.${'from' | 'to' | 'count' | 'test' | 'load' | 'store' | 'step' | 'countdown' | 'loop'}`
  for?: string
  reg?: string
  of?: Place | 'return' | 'result'
  into?: Place | 'return'
  param?: Place
  call?: string
  fun?: string
  through?: string
  offset?: number
  size?: number
  // struct copies: into what, from what, how many bytes, high to low
  to?: Place | 'return' | null
  from?: Place | null
  bytes?: number
  reverse?: boolean
}
// One colouring attempt (GraphColouringRegAlloc.color) as the allocator
// ran it: its palette, the simplify/select order, and for the attempt the
// code uses, each spilled register's word in `.data`.
type Colouring = {
  palette: string[]
  steps: {
    op: 'simplify' | 'spillCandidate' | 'select' | 'spill'
    vr: string
    degree?: number
    forbidden?: string[]
    colour?: string
  }[]
  result: Record<string, string>
  spills: string[]
  labels: Record<string, string>
}
// The real allocator's working, recorded per function through its step
// observer: one CFG block per instruction, liveness sweep by sweep, the
// interference graph, and the colouring. When 18 colours spill, the
// allocator starts over with 16 (keeping $t8 and $t9 for spill code):
// `abandoned` is the first attempt, `colouring` the one the code uses.
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
          // `added`: every register that became live on the line this
          // sweep, `$fp` and `$sp` included (in/out keep virtual ones)
          changes: {
            block: number
            in: string[]
            out: string[]
            added: string[]
          }[]
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
    colouring: Colouring
    abandoned?: Colouring
  }[]
}
// The decision behind a frame, as facts rather than prose. explain.ts turns
// these into sentences, so wording lives in one place and works for any
// source text. Ids refer to trace.tokens / trace.nodes / trace.instructions.
/** An lvalue error, taken apart (ParseTrace lvalueJson): `=`'s target or
 *  `&`'s operand, the whole of it, the part that isn't a place in memory and
 *  what kind of expression that is, and what reaches it (a field, an index or
 *  a `*`), if anything. */
export type LvalueError = {
  context: 'assign' | 'address'
  whole: string
  at: string
  kind: string
  through: 'field' | 'index' | 'deref' | null
  outer: string | null
  wholeNode: number | null
  atNode: number | null
}

export type Why =
  | { kind: 'ready' }
  | { kind: 'token'; token: number }
  // Detailed lexer mode (detail.ts): one of the tokeniser's reads for a
  // token (trace.tokens[token].reads[read], at `at`), an error it reported,
  // or whitespace or a comment skipped between tokens.
  | { kind: 'lex.char'; token: number; read: number; at: number }
  | { kind: 'lex.error'; token: number; read: number }
  | { kind: 'lex.skip'; start: number; end: number; comment: boolean }
  | { kind: 'parse.read'; token: number }
  | { kind: 'parse.node'; node: number }
  // an operator read its left input and now needs the right one
  | { kind: 'parse.wait'; node: number; child: number }
  | {
      kind: 'parse.precedence'
      pending: string
      incoming: string
      relation: 'tighter' | 'equal' | 'looser'
      child: number
    }
  // a parenthesis opens a group; the step that finishes it seals it (Frame.sealed)
  | { kind: 'parse.group'; span: Span }
  | { kind: 'parse.close'; node: number }
  | { kind: 'parse.done'; root: number }
  // the parser's first error: what it expected (token categories, empty for
  // a freeform error) and the token it found, null at the end of the source
  | { kind: 'parse.error'; token: number | null; expected: string[] }
  // Name pass, compiler traces: NameAnalyzer's own steps, in its order.
  // `inScope` is the scope (trace.scopes) the step happened in; a lookup's
  // `searched` lists the scopes it looked in, innermost first, ending with
  // the one it found the name in.
  | {
      kind: 'check.declare'
      decl: number
      where: 'global' | 'param' | 'local'
      /** "the global scope", "main's scope", "the block's scope". */
      scope: string
      inScope?: number
      /** A declaration of the same name in a scope around it, now hidden. */
      shadows?: number
      /** A function's definition joining its forward declaration, or the other way round. */
      joins?: number
      /** A declaration of a built-in function, joining it. */
      builtin?: boolean
    }
  | {
      kind: 'check.resolve'
      use: number
      decl: number
      where: string
      inScope?: number
      searched?: number[]
      /** Scopes out from the use's own. */
      up?: number
      /** A call that found only a forward declaration; see check.link. */
      deferred?: boolean
    }
  | {
      kind: 'check.unresolved'
      use: number
      inScope?: number
      searched?: number[]
      /** The declaration found instead, of the wrong kind (a variable called). */
      found?: number
    }
  | {
      kind: 'check.builtin'
      use: number
      inScope?: number
      searched?: number[]
    }
  // After the whole program, a call that found a forward declaration is
  // tied to the function's definition.
  | {
      kind: 'check.link'
      use: number
      decl: number
      inScope?: number
      searched?: number[]
    }
  // Any other error either pass reported, in the analyser's words.
  | { kind: 'check.nameError'; node: number; message: string; inScope?: number }
  | {
      kind: 'check.typeError'
      node: number
      message: string
      typed: [number, string][]
      /** The type the error is about, which has no node or place of its own. */
      about?: string
      /** The whole error in words, where the tracer explains it (an lvalue). */
      said?: string
      lvalue?: LvalueError
    }
  // (`decl`: a name's declaration, where its type comes from; type-view.ts)
  | {
      kind: 'check.type'
      node: number
      type: string
      expected?: string
      decl?: number
    }
  // Type pass, compiler traces: an operator or call gets its type from its
  // operands. `typed` lists the nodes whose types this step shows (leaf
  // operands, then the node); on a failure, `bad` is the operand that
  // doesn't fit and `expected` what was needed there.
  | {
      kind: 'check.expr'
      node: number
      type: string
      typed: [number, string][]
      ok: boolean
      bad?: number | null
      expected?: string | null
      /** TypeAnalyzer's words, on a failure no operand explains. */
      message?: string | null
      /** The whole error in words, where the tracer explains it (an lvalue). */
      said?: string
      lvalue?: LvalueError
    }
  // A statement checks a value against what it needs: an assignment's
  // target, a condition (int), or the function's return type.
  | {
      kind: 'check.fits'
      node: number
      value: number
      rule: 'assign' | 'condition' | 'return'
      type: string
      expected: string
      ok: boolean
      typed: [number, string][]
    }
  | { kind: 'check.typesDone' }
  | { kind: 'check.namesDone'; unresolved: number; errors?: number }
  // instructions from..to (inclusive) came from one node
  | {
      kind: 'emit.instr'
      node: number
      from: number
      to: number
      // Line by line (emit-view.ts): the node's whole run, this line in it.
      of?: { from: number; to: number }
    }
  | {
      kind: 'emit.prologue'
      node: number
      from: number
      to: number
      of?: { from: number; to: number }
    }
  | {
      kind: 'emit.epilogue'
      node: number
      from: number
      to: number
      of?: { from: number; to: number }
    }
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
  // `abandoned`: a step of the 18-colour attempt the allocator threw away.
  | {
      kind: 'reg.simplify'
      fn: number
      step: number
      at: number | null
      abandoned?: true
    }
  | {
      kind: 'reg.spillCandidate'
      fn: number
      step: number
      at: number | null
      abandoned?: true
    }
  | {
      kind: 'reg.select'
      fn: number
      step: number
      at: number | null
      abandoned?: true
    }
  | {
      kind: 'reg.spill'
      fn: number
      step: number
      at: number | null
      abandoned?: true
    }
  // 18 colours spilled `spills` registers: colour again with `k`.
  | { kind: 'reg.retry'; fn: number; spills: number; k: number }
  | { kind: 'reg.done'; fn?: number; used?: number; spills?: number }
  // After a function's rewrite (regs-view.ts withSaveSteps): its
  // placeholders lit, then pushRegisters expanded, then popRegisters.
  | { kind: 'reg.saves'; fn: number; stage: 'mark' | 'push' | 'pop' }

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
  // Parse: groups whose `)` this step reads. A group seals on the step that
  // finished what is inside it, not on a step of its own.
  sealed?: Span[]
}
export type Trace = {
  tokens: Token[]
  nodes: AstNode[]
  frames: Frame[]
  instructions: Instruction[]
  registers: Record<string, string>
  error?: Span & { message: string }
  root?: number
  // set only on compiler-emitted traces; `ast` is the real ASTPrinter
  // output, which check-trace.cjs compares with the toy's tree
  text?: string
  ast?: string
  backend?: Backend
  layout?: Layout
  /** The data section as code generation wrote it (globals, strings), a
   * line each as the compiler prints them; spill slots come later
   * (Colouring.labels). */
  data?: string[]
  scopes?: RecordedScope[]
}
// A scope NameAnalyzer opened (ParseTrace.scopesJson): the global scope,
// one per function (its parameters and the declarations at the top of its
// body share it), one per nested block, and one per struct or class.
export type RecordedScope = {
  id: number
  /** The function or block node that opens it; null for the global scope. */
  node: number | null
  parent: number | null
  kind: 'global' | 'function' | 'block' | 'struct' | 'class'
  label: string
  /** Declarations, in the order they went in. */
  decls: number[]
  /** Built-in functions, which have no node. */
  builtins?: string[]
}
// The storage MemAllocCodeGen gave each declaration (ParseTrace's
// layoutJson): the emit phase's stack draws these words.
export type CType =
  | { k: 'int' | 'char' | 'void' | 'other' }
  | { k: 'ptr'; to: CType }
  | { k: 'array'; of: CType; n: number }
  | { k: 'struct'; name: string }
export type Storage = {
  name: string
  node: number | null
  size: number
  type: CType
  /** Bytes from `$fp`: parameters above it, locals below. */
  off?: number
  /** Globals: the `.data` label. */
  label?: string
}
export type Layout = {
  structs: Record<
    string,
    {
      size: number
      fields: { name: string; off: number; size: number; type: CType }[]
    }
  >
  globals: Storage[]
  functions: {
    name: string
    node: number | null
    return: { off: number; size: number; type: CType } | null
    params: Storage[]
    locals: Storage[]
  }[]
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
    push(
      'Tokens',
      'Press play. Follow the source into a tree.',
      { start: 0, end: 0 },
      { kind: 'ready' },
    )
    // After the first frame, so the page always has one to show.
    if (source.length > 1200)
      throw new CompileError('Keep this sketch under 1,200 characters.', {
        start: 0,
        end: source.length,
      })
    // What it read on the way to each token, in the real tokeniser's words
    // (Token.reads), so the detailed lexer plays these tokens too.
    let reads: LexRead[] = []
    for (let offset = 0; offset < source.length;) {
      if (/\s/.test(source[offset])) {
        reads.push({ at: offset, does: 'space' })
        offset++
        continue
      }
      if (source.slice(offset, offset + 2) === '//') {
        const end = source.indexOf('\n', offset)
        reads.push({ at: offset, does: 'slash' })
        for (let at = offset + 1; at < (end < 0 ? source.length : end); at++)
          reads.push({ at, does: 'comment' })
        if (end >= 0) reads.push({ at: end, does: 'end', look: true })
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
      const end = offset + text.length
      const first: LexDecision =
        kind === 'number'
          ? 'number'
          : kind !== 'symbol'
            ? 'word'
            : text === '='
              ? 'pair'
              : 'single'
      reads.push({ at: offset, does: first })
      for (let at = offset + 1; at < end; at++)
        reads.push({ at, does: 'continue' })
      if (first !== 'single' && end < source.length)
        reads.push({ at: end, does: 'end', look: true })
      const token: Token = {
        id: result.tokens.length,
        text,
        kind,
        start: offset,
        end,
        reads,
      }
      reads = []
      result.tokens.push(token)
      push(
        'Tokens',
        `${kind === 'symbol' ? 'Symbol' : kind === 'name' ? 'Identifier' : kind === 'keyword' ? 'Keyword' : 'Integer'}  ·  ${text}`,
        token,
        { kind: 'token', token: token.id },
      )
      offset = end
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
          { kind: 'parse.group', span: t },
        )
        const id = expression(0)
        const close = take(')')
        result.nodes[id].start = t.start
        result.nodes[id].end = close.end
        const last = result.frames[result.frames.length - 1]
        const span = { start: t.start, end: close.end }
        last.consumed = [...consumed]
        last.sealed = [...(last.sealed ?? []), span]
        last.span = span
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
          // + and - bind equally, so either closes a waiting one.
          const equal = binding[holder === '×' ? '*' : (holder ?? '')] === prec
          push(
            'Parse',
            !equal
              ? `${glyph(t.text)} binds no tighter than ${holder}, so ${holder} closes first`
              : glyph(t.text) === holder
                ? `Another ${holder}: the one already waiting closes first, left to right`
                : `${glyph(t.text)} binds as tightly as ${holder}, so ${holder} closes first, left to right`,
            t,
            {
              kind: 'parse.precedence',
              pending: holder ?? '',
              incoming: glyph(t.text),
              relation: equal ? 'equal' : 'looser',
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
    // The sketch has one function, so two scopes: the global one with
    // `main` in it, and main's.
    const mainScope: RecordedScope = {
      id: 1,
      node: result.root,
      parent: 0,
      kind: 'function',
      label: 'main',
      decls: [],
    }
    result.scopes = [
      {
        id: 0,
        node: null,
        parent: null,
        kind: 'global',
        label: 'global',
        decls: [result.root],
      },
      mainScope,
    ]
    const checkExpr = (id: number): void => {
      const n = result.nodes[id]
      if (n.kind === 'name') {
        const decl = declared.get(n.label)
        if (decl === undefined || !initialized.has(n.label)) {
          push(
            'Check',
            `No ${decl === undefined ? 'declaration' : 'value yet'} for ${n.label}`,
            n,
            // Read before it has a value: found, but not usable yet.
            decl === undefined
              ? {
                  kind: 'check.unresolved',
                  use: id,
                  inScope: 1,
                  searched: [1, 0],
                }
              : {
                  kind: 'check.unresolved',
                  use: id,
                  inScope: 1,
                  searched: [1],
                  found: decl,
                },
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
          {
            kind: 'check.resolve',
            use: id,
            decl,
            where: 'above',
            inScope: 1,
            searched: [1],
          },
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
        mainScope.decls.push(id)
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
            {
              kind: 'check.resolve',
              use: id,
              decl,
              where: 'above',
              inScope: 1,
              searched: [1],
            },
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
      ins.args.filter(isVirtual).forEach((a) => (lastUse[a] = i))
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
    // real MIPS line: "li v0,4" → "li $t0,4" once v0 has a register; a
    // machine register spelled alike (`$v0`) stays as it is
    const [op, rest] = splitLine(instruction.text)
    return `${op.padEnd(7)}${renameVirtuals(rest, map)}`
  }
  return `${instruction.op.padEnd(7)}${[...(instruction.dest ? [instruction.dest] : []), ...instruction.args].map(map).join(', ')}`
}

/**
 * What the allocator wrote for an instruction (its `out`), with the lines
 * it added marked: all of pushRegisters' saves and popRegisters' restores,
 * and around a spilled register's line its loads (`la` then `lw`, before)
 * and its store (`la` then `sw`, after).
 */
export function rewritten(
  ins: Instruction,
): { text: string; added: boolean }[] | undefined {
  const out = ins.out
  if (!out) return undefined
  if (ins.op === 'pushRegisters' || ins.op === 'popRegisters')
    return out.map((text) => ({ text, added: true }))
  let line = 0
  while (
    line + 1 < out.length &&
    out[line].startsWith('la ') &&
    out[line + 1].startsWith('lw ')
  )
    line += 2
  return out.map((text, i) => ({ text, added: i !== line }))
}

/** The colouring attempt a Registers frame's step belongs to. */
export function attemptOf(
  f: Backend['functions'][number],
  why: Why,
): Colouring {
  return 'abandoned' in why && why.abandoned && f.abandoned
    ? f.abandoned
    : f.colouring
}

/**
 * Registers coloured by the real allocator up to and including step `step`
 * of function `fn`, in the abandoned attempt if `abandoned`.
 */
export function colouredUpTo(
  backend: Backend,
  fn: number,
  step: number,
  abandoned?: true,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (let f = 0; f <= fn && f < backend.functions.length; f++) {
    const { colouring, abandoned: first } = backend.functions[f]
    const steps = (f === fn && abandoned && first ? first : colouring).steps
    const limit = f === fn ? Math.min(step, steps.length - 1) : steps.length - 1
    for (let i = 0; i <= limit; i++) {
      const s = steps[i]
      if (s.op === 'select' && s.colour) out[s.vr] = s.colour
    }
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
  levels: number
} {
  // A tidy tree (Reingold–Tilford, with labels as wide as they are): each
  // subtree is laid out alone, its siblings are pushed right until no row of
  // one comes within `gap` of the other's, and a parent sits midway between
  // its first and last child. Unary chains stay vertical and binary branches
  // mirror, with no clamping (GPT-6 Astra's review,
  // docs/handoffs/2026-09-24-tree-drawing-astra-answer.md).
  type Shape = {
    // x of every node relative to the subtree's root
    x: Map<number, number>
    // leftmost and rightmost label edge on each row below the root, root first
    left: number[]
    right: number[]
    rows: Map<number, number>
  }
  // Places shapes left to right, packed by their rows; returns each offset.
  const pack = (shapes: Shape[]) => {
    const left: number[] = []
    const right: number[] = []
    const offsets = shapes.map((shape) => {
      let offset = 0
      if (right.length)
        shape.left.forEach((l, d) => {
          if (d < right.length) offset = Math.max(offset, right[d] + gap - l)
        })
      shape.left.forEach((l, d) => {
        if (d >= left.length) left[d] = l + offset
        right[d] = shape.right[d] + offset
      })
      return offset
    })
    return { offsets, left, right }
  }
  const layout = (id: number): Shape => {
    const n = trace.nodes[id]
    const half = labelWidth(n) / 2
    const shape: Shape = {
      x: new Map([[id, 0]]),
      left: [-half],
      right: [half],
      rows: new Map([[id, 0]]),
    }
    if (!n.children.length) return shape
    const kids = n.children.map(layout)
    const { offsets, left, right } = pack(kids)
    const mid = (offsets[0] + offsets[offsets.length - 1]) / 2
    kids.forEach((kid, i) => {
      for (const [k, x] of kid.x) shape.x.set(k, x + offsets[i] - mid)
      for (const [k, d] of kid.rows) shape.rows.set(k, d + 1)
    })
    left.forEach((l, d) => {
      shape.left[d + 1] = l - mid
      shape.right[d + 1] = right[d] - mid
    })
    return shape
  }
  const childIds = new Set(trace.nodes.flatMap((n) => n.children))
  const roots =
    trace.root === undefined
      ? trace.nodes.filter((n) => !childIds.has(n.id)).map((n) => n.id)
      : [trace.root]
  const shapes = roots.map(layout)
  const { offsets } = pack(shapes)
  const at: Record<number, { x: number; y: number }> = {}
  let lo = Infinity,
    hi = -Infinity,
    depth = 0
  shapes.forEach((shape, i) => {
    for (const [id, x] of shape.x) {
      const row = shape.rows.get(id) ?? 0
      at[id] = { x: x + offsets[i], y: row }
      depth = Math.max(depth, row)
      const half = labelWidth(trace.nodes[id]) / 2
      lo = Math.min(lo, at[id].x - half)
      hi = Math.max(hi, at[id].x + half)
    }
  })
  if (lo === Infinity) return { at, width: 1, depth: 0, levels: 0 }
  for (const id in at) at[id].x += gap / 2 - lo
  const width = hi - lo + gap
  // A row gap grows with the most edges one parent in the row above sends to
  // one side, since those leave at nearly the same angle and blur together.
  // Two children keep the base gap; the growth stops at 1.6x, however many.
  const rowGap = Array.from({ length: depth }, () => 1)
  for (const n of trace.nodes) {
    const p = at[n.id]
    if (!p || p.y >= depth) continue
    const left = n.children.filter((c) => at[c].x < p.x - 1).length
    const right = n.children.filter((c) => at[c].x > p.x + 1).length
    const side = Math.max(left, right)
    rowGap[p.y] = Math.max(rowGap[p.y], 1 + Math.min(0.6, (side - 1) * 0.2))
  }
  const rowY = [0]
  for (const g of rowGap) rowY.push(rowY[rowY.length - 1] + g)
  for (const id in at) at[id].y = rowY[at[id].y]
  return { at, width: Math.max(1, width), depth: rowY[depth], levels: depth }
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
