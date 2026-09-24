import type { Frame, Token, Trace } from './trace'

// The compiler's parse steps in the order its parser takes them. The
// recorded trace is replayed from the finished AST, so a shadow of
// Parser.java's recursive descent re-reads the tokens and says when each
// node is read, compared and built (replayParse, below).

// Parser.java's binding powers. `=` is right-associative: its right side is
// parsed one level lower, so another `=` can still join it.
const PRECEDENCE: { level: number; ops: string[] }[] = [
  { level: 7, ops: ['*', '/', '%'] },
  { level: 6, ops: ['+', '-'] },
  { level: 5, ops: ['<', '>', '<=', '>='] },
  { level: 4, ops: ['==', '!='] },
  { level: 3, ops: ['&&'] },
  { level: 2, ops: ['||'] },
  { level: 1, ops: ['='] },
]
const LEVEL: Record<string, number> = Object.fromEntries(
  PRECEDENCE.flatMap((row) => row.ops.map((op) => [op, row.level])),
)
// Prefix operators and casts parse their operand at 8, above every infix
// level, so the operand is a single value.
const PREFIX_LIMIT = 8

type Event =
  // parseDeclarations starts: the program node opens here
  | { t: 'declarations' }
  | { t: 'consume'; token: number }
  // an operator's level (null: not an operator) against parseExpr's limit
  | {
      t: 'compare'
      token: number
      op: string
      level: number | null
      limit: number
      deeper: boolean
    }
  | { t: 'build'; token: number; kind: string }
  // a parenthesised group (not a cast), by its `(` and `)` tokens
  | { t: 'groupOpen'; token: number }
  | { t: 'groupClose'; open: number; close: number }

const CATEGORY: Record<string, string> = {
  '=': 'ASSIGN',
  '{': 'LBRA',
  '}': 'RBRA',
  '(': 'LPAR',
  ')': 'RPAR',
  '[': 'LSBR',
  ']': 'RSBR',
  ';': 'SC',
  ',': 'COMMA',
  int: 'INT',
  void: 'VOID',
  char: 'CHAR',
  if: 'IF',
  else: 'ELSE',
  while: 'WHILE',
  return: 'RETURN',
  struct: 'STRUCT',
  sizeof: 'SIZEOF',
  continue: 'CONTINUE',
  break: 'BREAK',
  class: 'CLASS',
  extends: 'EXTENDS',
  new: 'NEW',
  '#include': 'INCLUDE',
  '&&': 'LOGAND',
  '||': 'LOGOR',
  '==': 'EQ',
  '!=': 'NE',
  '<': 'LT',
  '>': 'GT',
  '<=': 'LE',
  '>=': 'GE',
  '+': 'PLUS',
  '-': 'MINUS',
  '*': 'ASTERISK',
  '/': 'DIV',
  '%': 'REM',
  '&': 'AND',
  '.': 'DOT',
}
const category = (t: Token | undefined) =>
  !t
    ? 'EOF'
    : t.kind === 'name'
      ? 'IDENTIFIER'
      : t.kind === 'number'
        ? t.text[0] === "'"
          ? 'CHAR_LITERAL'
          : t.text[0] === '"'
            ? 'STRING_LITERAL'
            : 'INT_LITERAL'
        : (CATEGORY[t.text] ?? 'INVALID')

class Stop extends Error {}

// Parser.java, one function per grammar rule, recording instead of building.
function shadow(tokens: Token[]): Event[] {
  const events: Event[] = []
  let i = 0
  const accept = (...cats: string[]) => cats.includes(category(tokens[i]))
  const next = () => {
    if (i < tokens.length) events.push({ t: 'consume', token: i++ })
  }
  const expect = (...cats: string[]) => {
    if (!accept(...cats)) throw new Stop()
    const at = i
    next()
    return at
  }
  const build = (token: number, kind: string) =>
    events.push({ t: 'build', token, kind })
  // Each grammar rule is wrapped in its Parser.java name, so the two read
  // side by side; only the start of the declarations is recorded.
  const call = <T>(_rule: string, body: () => T): T => body()
  const acceptType = () => accept('INT', 'CHAR', 'VOID', 'STRUCT', 'CLASS')
  const canStartExp = () =>
    accept(
      'PLUS',
      'MINUS',
      'INT_LITERAL',
      'CHAR_LITERAL',
      'STRING_LITERAL',
      'ASTERISK',
      'AND',
      'SIZEOF',
      'LPAR',
      'IDENTIFIER',
    )

  // Expressions report just enough shape for the statement around them.
  type Shape = 'assign' | 'var' | 'other'

  const parseStarRep = (): void =>
    call('parseStarRep', () => {
      if (!accept('ASTERISK')) return
      next()
      parseStarRep()
    })
  const parseType = () =>
    call('parseType', () => {
      if (accept('STRUCT', 'CLASS')) {
        next()
        expect('IDENTIFIER')
      } else expect('INT', 'CHAR', 'VOID')
      parseStarRep()
    })
  const parseArrIdxRep = () =>
    call('parseArrIdxRep', () => {
      while (accept('LSBR')) {
        next()
        expect('INT_LITERAL')
        expect('RSBR')
      }
    })
  const parseVarDecl = () =>
    call('parseVarDecl', () => {
      parseType()
      const name = expect('IDENTIFIER')
      parseArrIdxRep()
      build(name, 'declare')
      expect('SC')
    })
  const parseParams = () =>
    call('parseParams', () => {
      if (!acceptType()) return
      const param = () => {
        parseType()
        build(expect('IDENTIFIER'), 'declare')
        parseArrIdxRep()
      }
      param()
      while (accept('COMMA')) {
        next()
        param()
      }
    })
  const parseArgList = () =>
    call('parseArgList', () => {
      if (!canStartExp()) return
      parseExpr(0)
      while (accept('COMMA')) {
        next()
        parseExpr(0)
      }
    })
  const parseLiteral = () =>
    call('parseLiteral', () => {
      build(expect('INT_LITERAL', 'CHAR_LITERAL', 'STRING_LITERAL'), 'number')
    })
  const parsePrefix = (): Shape | null =>
    call('parsePrefix', (): Shape | null => {
      if (accept('IDENTIFIER')) {
        const id = expect('IDENTIFIER')
        if (accept('LPAR')) {
          expect('LPAR')
          parseArgList()
          expect('RPAR')
          build(id, 'call')
          return 'other'
        }
        build(id, 'name')
        return 'var'
      }
      if (accept('INT_LITERAL', 'STRING_LITERAL', 'CHAR_LITERAL')) {
        parseLiteral()
        return 'other'
      }
      if (accept('LPAR')) {
        next()
        if (acceptType()) {
          parseType()
          expect('RPAR')
          parseExpr(PREFIX_LIMIT)
          return 'other'
        }
        const open = i - 1
        events.push({ t: 'groupOpen', token: open })
        const inner = parseExpr(0)
        const close = expect('RPAR')
        events.push({ t: 'groupClose', open, close })
        return inner
      }
      if (accept('MINUS', 'PLUS', 'ASTERISK', 'AND')) {
        const tok = i
        const op = tokens[i].text
        next()
        parseExpr(PREFIX_LIMIT)
        build(tok, op === '-' || op === '+' ? 'unary' : 'expr')
        return 'other'
      }
      if (accept('SIZEOF')) {
        const tok = i
        next()
        expect('LPAR')
        parseType()
        expect('RPAR')
        build(tok, 'expr')
        return 'other'
      }
      if (accept('NEW')) {
        const tok = i
        next()
        expect('CLASS')
        expect('IDENTIFIER')
        expect('LPAR')
        expect('RPAR')
        build(tok, 'expr')
        return 'other'
      }
      return null
    })
  const parsePostfix = () =>
    call('parsePostfix', () => {
      const tok = i
      if (accept('LSBR')) {
        next()
        parseExpr(0)
        expect('RSBR')
      } else {
        next()
        expect('IDENTIFIER')
        if (accept('LPAR')) {
          next()
          parseArgList()
          expect('RPAR')
        }
      }
      build(tok, 'expr')
    })
  // The Pratt loop: take a value, then keep taking operators that bind
  // tighter than `limit`; the first one that doesn't ends this call.
  const parseExpr = (limit: number): Shape =>
    call('parseExpr', (): Shape => {
      let shape = parsePrefix()
      if (shape === null) throw new Stop()
      while (accept('LSBR', 'DOT')) {
        parsePostfix()
        shape = 'other'
      }
      for (;;) {
        const t = tokens[i]
        const level = t ? LEVEL[t.text] : undefined
        if (!t || level === undefined || category(t) === 'INVALID') {
          events.push({
            t: 'compare',
            token: t ? i : tokens.length - 1,
            op: t?.text ?? '',
            level: null,
            limit,
            deeper: false,
          })
          return shape
        }
        const deeper = level > limit
        events.push({
          t: 'compare',
          token: i,
          op: t.text,
          level,
          limit,
          deeper,
        })
        if (!deeper) return shape
        const assign = t.text === '='
        const op = i
        next()
        parseExpr(assign ? level - 1 : level)
        build(op, 'binary')
        shape = assign && shape === 'var' ? 'assign' : 'other'
      }
    })

  const parseStatement = (): void =>
    call('parseStatement', () => {
      if (accept('LBRA')) parseBlock()
      else if (accept('WHILE'))
        call('parseWhileLoop', () => {
          const tok = expect('WHILE')
          expect('LPAR')
          parseExpr(0)
          expect('RPAR')
          parseStatement()
          build(tok, 'while')
        })
      else if (accept('IF'))
        call('parseIfStmt', () => {
          const tok = expect('IF')
          expect('LPAR')
          parseExpr(0)
          expect('RPAR')
          parseStatement()
          if (accept('ELSE')) {
            next()
            parseStatement()
          }
          build(tok, 'if')
        })
      else if (accept('RETURN'))
        call('parseReturn', () => {
          const tok = expect('RETURN')
          if (canStartExp()) parseExpr(0)
          expect('SC')
          build(tok, 'return')
        })
      else if (accept('CONTINUE', 'BREAK')) {
        const fn = accept('BREAK') ? 'parseBreak' : 'parseContinue'
        call(fn, () => {
          const tok = expect('CONTINUE', 'BREAK')
          expect('SC')
          build(tok, 'statement')
        })
      } else if (canStartExp()) {
        const start = i
        const shape = parseExpr(0)
        expect('SC')
        build(start, shape === 'assign' ? 'assign' : 'statement')
      } else throw new Stop()
    })
  const parseBlock = (): void =>
    call('parseBlock', () => {
      const open = expect('LBRA')
      call('parseVarDeclStar', () => {
        while (acceptType()) parseVarDecl()
      })
      call('parseStatementStar', () => {
        while (
          accept('LBRA', 'WHILE', 'IF', 'RETURN', 'CONTINUE', 'BREAK') ||
          canStartExp()
        )
          parseStatement()
      })
      expect('RBRA')
      build(open, 'block')
    })
  const parseTypePrefixDecl = () =>
    call('parseTypePrefixDecl', () => {
      const id = expect('IDENTIFIER')
      if (accept('LPAR')) {
        expect('LPAR')
        parseParams()
        expect('RPAR')
        if (!accept('SC')) {
          parseBlock()
          build(id, 'function')
        } else {
          expect('SC')
          build(id, 'declare')
        }
      } else {
        parseArrIdxRep()
        expect('SC')
        build(id, 'declare')
      }
    })
  const parseClassBody = () =>
    call('parseClassBody', () => {
      expect('LBRA')
      while (acceptType()) {
        parseType()
        const id = expect('IDENTIFIER')
        if (accept('LPAR')) {
          expect('LPAR')
          parseParams()
          expect('RPAR')
          parseBlock()
          build(id, 'function')
        } else {
          parseArrIdxRep()
          expect('SC')
          build(id, 'declare')
        }
      }
      expect('RBRA')
    })
  const parseIncludes = (): void =>
    call('parseIncludes', () => {
      if (!accept('INCLUDE')) return
      next()
      expect('STRING_LITERAL')
      parseIncludes()
    })

  try {
    call('parseProgram', () => {
      parseIncludes()
      call('parseDeclarations', () => {
        events.push({ t: 'declarations' })
        while (accept('STRUCT', 'INT', 'CHAR', 'VOID', 'CLASS')) {
          if (accept('STRUCT', 'CLASS')) {
            const kw = category(tokens[i])
            next()
            const id = expect('IDENTIFIER')
            if (kw === 'STRUCT' && accept('LBRA')) {
              next()
              do parseVarDecl()
              while (acceptType())
              expect('RBRA')
              expect('SC')
              build(id, 'declare')
            } else if (kw === 'CLASS' && accept('EXTENDS', 'LBRA')) {
              if (accept('EXTENDS')) {
                next()
                expect('IDENTIFIER')
              }
              parseClassBody()
              build(id, 'declare')
            } else {
              parseStarRep()
              parseTypePrefixDecl()
            }
          } else {
            parseType()
            parseTypePrefixDecl()
          }
        }
      })
      build(0, 'program')
    })
  } catch (error) {
    // A parse error: the recorded steps stop there too.
    if (!(error instanceof Stop)) throw error
  }
  return events
}

// The compiler's own parse steps come from ParseTrace, which replays the
// finished AST token by token and decides what an incoming operator closes
// from node ends that are still growing. It gets chains wrong: in
// `4 - n + 2 * 3 - n` the last `-` "binds tighter than ×" and closes before
// `×` and `+` do. So for compiler traces the parse steps are rebuilt here
// from the shadow parser's own order, with the recorded tree's nodes; the
// titles and step kinds are ParseTrace's. Undefined when the shadow can't
// follow the program.
function replayParse(trace: Trace): Frame[] | undefined {
  const events = shadow(trace.tokens)
  if (!events.some((e) => e.t === 'build' && e.kind === 'program')) return
  const nodes = trace.nodes
  const tokens = trace.tokens
  const root = trace.root === undefined ? undefined : nodes[trace.root]
  const glyph = (op: string) => (op === '*' ? '×' : op)
  // The recorded tree widened each group's nodes to its brackets; until the
  // `)` is read, a node inside stops at the bracket's inner edge.
  const groups = events.flatMap((e) =>
    e.t === 'groupClose' ? [{ open: e.open, close: e.close }] : [],
  )
  const closedGroups = new Set<number>()
  // Peeled a bracket pair at a time: `((4 + 2))` has two.
  const spanOf = (id: number) => {
    let { start, end } = nodes[id]
    for (let peeled = true; peeled; ) {
      peeled = false
      for (const g of groups) {
        if (closedGroups.has(g.open)) continue
        if (start !== tokens[g.open].start || end !== tokens[g.close].end)
          continue
        start = tokens[g.open + 1].start
        end = tokens[g.close - 1].end
        peeled = true
      }
    }
    return { start, end }
  }
  // The node a group holds: the one whose span is the group's, give or take
  // the brackets around it. None for `(x) = 1`, whose target isn't a node.
  const source = trace.text ?? ''
  const bracketsOnly = (from: number, to: number, bracket: string) =>
    source
      .slice(from, to)
      .replace(/\s/g, '')
      .split('')
      .every((c) => c === bracket)
  const groupNode = new Map<number, number>()
  for (const g of groups) {
    const start = tokens[g.open].start
    const end = tokens[g.close].end
    // Nodes come parent first, so the last match is the innermost.
    const inner = nodes
      .filter(
        (n) =>
          n.start <= start &&
          n.end >= end &&
          bracketsOnly(n.start, start, '(') &&
          bracketsOnly(end, n.end, ')'),
      )
      .pop()
    if (inner) groupNode.set(g.open, inner.id)
  }
  const text = (id: number) => {
    const { start, end } = spanOf(id)
    return source.slice(start, end)
  }
  const parentOf = new Map<number, number>()
  for (const n of nodes) for (const c of n.children) parentOf.set(c, n.id)
  // Nodes appear as their token is read; an assignment statement, anchored
  // at its target, appears with its `=`, when the parser knows what it is.
  const shownAt = new Map<number, number[]>()
  const builtAs = new Map<string, number>()
  for (const n of nodes) {
    builtAs.set(`${n.token}:${n.kind}`, n.id)
    // The program opens with parseDeclarations, not with a token.
    if (n.kind === 'program') continue
    const at =
      n.kind === 'assign'
        ? tokens.findIndex((t, i) => i > n.token && t.text === '=')
        : n.token
    shownAt.set(at, [...(shownAt.get(at) ?? []), n.id])
  }
  const binaryAt = (token: number) => {
    const id = builtAs.get(`${token}:binary`)
    return id === undefined ? undefined : nodes[id]
  }

  const frames: Frame[] = []
  const consumed: number[] = []
  const visible: number[] = []
  const attached: number[] = []
  const pending: number[] = []
  const push = (
    title: string,
    span: { start: number; end: number },
    focus: number | null,
    why: Frame['why'],
  ) =>
    frames.push({
      phase: 'Parse',
      title,
      why,
      span: { start: span.start, end: span.end },
      tokenCount: tokens.length,
      consumed: [...consumed],
      nodes: [...visible],
      attached: [...attached],
      focus,
      instructionCount: 0,
      allocationCount: 0,
    })
  const attach = (id: number) => {
    if (!attached.includes(id)) attached.push(id)
  }
  // A finished node joins its parent once the parent is on screen; an
  // operator takes its inputs itself.
  const attachIfReady = (id: number) => {
    const parent = parentOf.get(id)
    if (
      parent !== undefined &&
      visible.includes(parent) &&
      nodes[parent].kind !== 'binary' &&
      nodes[parent].kind !== 'unary'
    )
      attach(id)
  }
  const show = (id: number, title: string) => {
    visible.push(id)
    push(title, spanOf(id), id, { kind: 'parse.node', node: id })
  }
  const close = (id: number) => {
    const p = nodes[id]
    pending.splice(pending.indexOf(id), 1)
    const kids = p.children
    if (p.kind === 'binary') attach(kids[1])
    else kids.forEach(attach)
    const first = kids[0] === undefined ? '' : text(kids[0])
    const title =
      p.kind === 'binary' || p.kind === 'unary'
        ? `${p.label} closes over ${text(id)}`
        : p.kind === 'assign'
          ? `${p.label} takes ${text(kids[kids.length - 1])}`
          : p.kind === 'return'
            ? kids.length
              ? `return takes ${first}`
              : 'return closes'
            : p.kind === 'while'
              ? 'while closes over its condition and body'
              : p.kind === 'if'
                ? 'if closes over its branches'
                : p.kind === 'block'
                  ? 'The block closes'
                  : p.kind === 'call'
                    ? `${p.label.replace('()', '')} has its ${kids.length} ${kids.length === 1 ? 'argument' : 'arguments'}`
                    : p.kind === 'function'
                      ? `Function ${p.label} is complete`
                      : p.kind === 'program'
                        ? 'All declarations read'
                        : `${p.label} closes`
    push(title, spanOf(id), id, { kind: 'parse.close', node: id })
    attachIfReady(id)
  }
  const open = (id: number, title: string) => {
    show(id, title)
    pending.push(id)
  }
  const opening: Record<string, (n: (typeof nodes)[number]) => string> = {
    unary: (n) => `${n.label} waits for its operand`,
    assign: (n) => `Assign into ${tokens[n.token].text}: read the value`,
    return: () => 'return: read the value',
    while: () => 'while: read the condition, then the body',
    if: () => 'if: read the condition, then the branches',
    block: () => 'A block: declarations, then statements',
    call: (n) => `Call ${tokens[n.token].text}: read the arguments`,
    function: (n) => `Function ${n.label}: parameters, then the body`,
  }

  events.forEach((e, at) => {
    if (e.t === 'declarations') {
      if (root?.kind === 'program') {
        visible.push(root.id)
        push('A program: one declaration after another', root, root.id, {
          kind: 'parse.node',
          node: root.id,
        })
        pending.push(root.id)
      }
    } else if (e.t === 'consume') {
      consumed.push(e.token)
      for (const id of shownAt.get(e.token) ?? []) {
        const n = nodes[id]
        if (n.kind === 'binary') {
          // An operator arrives holding its left input.
          const left = n.children[0]
          visible.push(id)
          attach(left)
          push(
            `${n.label} takes ${text(left)} as its left side and waits for the right`,
            { start: spanOf(id).start, end: tokens[e.token].end },
            id,
            { kind: 'parse.wait', node: id, child: left },
          )
          pending.push(id)
        } else if (n.kind === 'number' || n.kind === 'name') {
          show(
            id,
            `Read ${n.label} as a ${n.kind === 'number' ? 'literal' : 'name'}`,
          )
          attachIfReady(id)
        } else if (n.kind === 'declare') {
          const type = n.label.slice(0, n.label.lastIndexOf(' '))
          show(id, `Declare ${tokens[n.token].text} as ${type}`)
          attachIfReady(id)
        } else open(id, opening[n.kind]?.(n) ?? `Read ${n.label}`)
      }
    } else if (e.t === 'groupOpen') {
      if (!groupNode.has(e.token)) return
      const t = tokens[e.token]
      push(
        'A group: everything inside closes before anything outside',
        t,
        null,
        {
          kind: 'parse.group',
          span: { start: t.start, end: t.end },
          state: 'open',
        },
      )
    } else if (e.t === 'groupClose') {
      closedGroups.add(e.open)
      if (!groupNode.has(e.open)) return
      // The `)` seals the group on the step that finished what is inside
      // it (Stanley: a step of its own only repeated that one).
      const last = frames[frames.length - 1]
      const span = { start: tokens[e.open].start, end: tokens[e.close].end }
      last.consumed = [...consumed]
      last.sealed = [...(last.sealed ?? []), span]
      last.span = span
    } else if (e.t === 'compare') {
      if (e.level === null) return
      const incoming = glyph(e.op)
      const left = binaryAt(e.token)?.children[0]
      if (e.deeper) {
        // Tighter than the operator waiting on its left: say so.
        const holder = pending[pending.length - 1]
        const h = holder === undefined ? undefined : nodes[holder]
        const n = binaryAt(e.token)
        if (!h || !n || left === undefined) return
        if (h.kind !== 'binary' && h.kind !== 'unary') return
        // Inside a group, an argument or an index the limit starts over, so
        // the operator waiting outside isn't competing: nothing to decide.
        const level =
          h.kind === 'unary'
            ? PREFIX_LIMIT
            : LEVEL[h.label === '×' ? '*' : h.label] - (h.label === '=' ? 1 : 0)
        if (e.limit < level) return
        push(
          incoming === '=' && h.label === '='
            ? `= groups right to left, so ${text(left)} goes to the new = first`
            : `${incoming} binds tighter than ${h.label}, so ${text(left)} goes to ${incoming} first`,
          tokens[e.token],
          n.id,
          {
            kind: 'parse.precedence',
            pending: h.label,
            incoming,
            relation: 'tighter',
            child: left,
          },
        )
        return
      }
      // Not tighter: the operator this call was reading for closes next.
      const next = events.slice(at + 1).find((x) => x.t === 'build')
      const id =
        next?.t === 'build'
          ? builtAs.get(`${next.token}:${next.kind}`)
          : undefined
      if (id === undefined || !pending.includes(id)) return
      const p = nodes[id]
      // Equal means the same level between two infix operators (+ and -
      // are equal); a prefix operator always closes first.
      const same =
        p.kind === 'binary' &&
        LEVEL[p.label === '×' ? '*' : p.label] ===
          LEVEL[incoming === '×' ? '*' : incoming]
      push(
        !same
          ? `${incoming} binds no tighter than ${p.label}, so ${p.label} closes first`
          : p.label === incoming
            ? `Another ${incoming}: the one already waiting closes first, left to right`
            : `${incoming} binds as tightly as ${p.label}, so ${p.label} closes first, left to right`,
        tokens[e.token],
        id,
        {
          kind: 'parse.precedence',
          pending: p.label,
          incoming,
          relation: same ? 'equal' : 'looser',
          child: left ?? id,
        },
      )
    } else if (e.t === 'build') {
      // The parser builds an assignment statement at its first token, which
      // is `(` in `(x) = 1`; the tree anchors it at the target.
      const id =
        e.kind === 'assign'
          ? pending.findLast((p) => nodes[p].kind === 'assign')
          : builtAs.get(`${e.token}:${e.kind}`)
      if (id !== undefined && pending.includes(id)) close(id)
    }
  })
  // Every node on screen and closed, or the rebuild missed something and the
  // recorded steps stay.
  if (visible.length !== nodes.length || pending.length) return
  if (root) {
    push(`Tree complete: ${nodes.length} nodes`, root, root.id, {
      kind: 'parse.done',
      root: root.id,
    })
  }
  return frames
}

// A compiler trace carries the real compiler's AST printout.
const recorded = (trace: Trace) => trace.ast !== undefined

// Swaps a trace's parse steps for `parse`, keeping the other phases.
const withParse = (trace: Trace, parse: Frame[]) => {
  const first = trace.frames.findIndex((f) => f.phase === 'Parse')
  const count = trace.frames.filter((f) => f.phase === 'Parse').length
  if (first < 0) return trace
  const frames = [...trace.frames]
  frames.splice(first, count, ...parse)
  return { ...trace, frames }
}

/** A compiler trace with its parse steps rebuilt in the parser's order. */
export function replayedParse(trace: Trace): Trace {
  if (!recorded(trace) || !trace.frames.some((f) => f.phase === 'Parse'))
    return trace
  const parse = replayParse(trace)
  return parse ? withParse(trace, parse) : trace
}
