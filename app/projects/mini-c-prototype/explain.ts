// Sentences for the step popup and the hover cards. Every template is filled
// from trace data, so the same wording serves presets and typed programs.
// Backticks mark code spans; the page renders them as <code>.
import { readerOf } from './detail'
import { stackFrames, wordAt } from './stack-view'
import { attemptOf } from './trace'

import type {
  AstNode,
  Frame,
  Instruction,
  LexDecision,
  Span,
  Tag,
  Token,
  Trace,
  Why,
} from './trace'

const OP_NAMES: Record<string, string> = {
  '+': 'addition',
  '-': 'subtraction',
  '×': 'multiplication',
  '*': 'multiplication',
  '/': 'division',
  '%': 'remainder',
  '<': 'less-than',
  '>': 'greater-than',
  '<=': 'less-or-equal',
  '>=': 'greater-or-equal',
  '==': 'equality',
  '!=': 'inequality',
  '&&': 'logical and',
  '||': 'logical or',
}

const KEYWORD_ROLES: Record<string, string> = {
  int: 'is a type: it says what kind of value follows',
  char: 'is a type: it says what kind of value follows',
  void: 'is a type: it says nothing is returned',
  return: 'hands a value back and ends the function',
  while: 'repeats its body while the condition holds',
  if: 'picks a branch by testing a condition',
  else: 'names the branch taken when the test fails',
  struct: 'introduces a record type',
  sizeof: 'asks for the size of a type',
}

const SYMBOL_ROLES: Record<string, string> = {
  ';': 'ends this statement',
  ',': 'separates items in a list',
  '(': 'opens a group, a parameter list, or an argument list',
  ')': 'closes a group or a list',
  '{': 'opens a body',
  '}': 'closes a body',
  '=': 'stores the value on the right into the name on the left',
  '&': 'takes the address of what follows',
  // DRAFT copy: the lexer can't tell which yet; the parser decides.
  '*': 'multiplies the values either side of it or, in front of a pointer, reads what it points at',
}

// A backtick inside (a string literal's) would end the code span early, so
// it shows as the look-alike ˋ instead.
const code = (s: string) => `\`${s.replace(/`/g, 'ˋ')}\``
/** "a", "a and b", "a, b, and c" */
const list = (items: string[]) =>
  items.length < 3
    ? items.join(' and ')
    : `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`

// DRAFT copy. A line with nothing more specific to say: the instruction
// and what it does to its operands, decoded from its text alone (Stanley,
// 2026-09-25: "this goes into this", addressing through a pointer or at an
// offset).
const ARITH: Record<string, string> = {
  add: '+',
  addu: '+',
  addi: '+',
  addiu: '+',
  sub: '−',
  subu: '−',
  mul: '×',
  and: 'AND',
  andi: 'AND',
  or: 'OR',
  ori: 'OR',
  xor: 'XOR',
  xori: 'XOR',
  nor: 'NOR',
}
const WIDTH: Record<string, string> = {
  lw: 'word',
  sw: 'word',
  lb: 'byte',
  lbu: 'byte',
  sb: 'byte',
  lh: 'half-word',
  lhu: 'half-word',
  sh: 'half-word',
}
/** A stack word's name in a sentence: `x`, `twice`'s `n`. */
function called(name: string) {
  const m = /^(\w+): (.*)$/.exec(name)
  if (m)
    return m[2] === 'return'
      ? `${code(m[1])}'s return slot`
      : `${code(m[1])}'s ${code(m[2])}`
  if (name === 'return') return 'the return slot'
  if (name === "caller's $fp") return `the caller's ${code('$fp')}`
  if (name.startsWith('saved ')) return `the saved ${code(name.slice(6))}`
  return code(name)
}

/** A place a tag names, as `called` takes it: `pair.right`, `twice: n`,
 * `return`. */
function placeName(
  p: Tag['of'] | Tag['to'] | undefined,
  t: Tag,
): string | undefined {
  if (!p) return undefined
  if (p === 'return') return 'return'
  if (p === 'result') return `${t.call}: return`
  return t.call ? `${t.call}: ${p.text}` : p.text
}

/** What a line's tag names (CodeGen.tag): the word it loads or stores,
 * the address it forms, the words it reserves. */
function named(ins: Instruction): {
  touch?: string
  address?: string
  reserve?: string
} {
  const t = ins.tag
  if (!t) return {}
  if (t.role === 'load') return { touch: placeName(t.of, t) }
  if (t.role === 'store') return { touch: placeName(t.into, t) }
  if (t.role === 'save' || t.role === 'restore')
    return { touch: t.reg === 'fp' ? "caller's $fp" : '$ra' }
  if (t.role === 'addr' && t.through !== 'param')
    return { address: placeName(t.of, t) }
  if (t.role === 'reserve' && t.for === 'arg')
    return { reserve: `${t.call}: ${t.param?.text}` }
  if (t.role === 'reserve' && t.for === 'result')
    return { reserve: `${t.call}: return` }
  return {}
}

// DRAFT copy. The byte loop CodeGen.emitStructCopy writes for a struct
// assignment, argument or return, line by line.
function copyNote(ins: Instruction, t: Tag): string {
  const c = code
  const [op, rest = ''] = (ins.text ?? ins.op).split(/\s+(.*)/)
  const a = rest.split(',').map((x) => x.trim())
  const from = placeName(t.from ?? undefined, { role: t.role })
  const to = placeName(t.to ?? undefined, { role: t.role })
  const end = t.reverse ? 'last' : 'first'
  switch (t.role) {
    case 'copy.from':
      return `A struct is copied a byte at a time. ${c(a[0])} starts at the ${end} byte of ${from ? called(from) : 'the source'}.`
    case 'copy.to':
      return `${c(a[0])} starts at the ${end} byte of ${to ? called(to) : 'the destination'}.`
    case 'copy.count':
      return `${c(a[0])} counts the bytes still to copy: ${t.bytes}.`
    case 'copy.test':
      return `${c(op)} leaves the loop once none are left.`
    case 'copy.load':
      return `${c(op)} reads one byte of ${from ? called(from) : 'the source'} into ${c(a[0])}.`
    case 'copy.store':
      return `${c(op)} writes it into ${to ? called(to) : 'the destination'}.`
    case 'copy.step':
      return `${c(a[0])} moves one byte ${t.reverse ? 'down' : 'up'}.`
    case 'copy.countdown':
      return 'One byte fewer to go.'
    default:
      return `${c(op)} goes back for the next byte.`
  }
}

function operandNote(ins: Instruction): string {
  const t = ins.text ?? ins.op
  const [op, rest = ''] = t.split(/\s+(.*)/)
  const a = rest.split(',').map((x) => x.trim())
  const c = code
  if (ins.tag?.role.startsWith('copy.')) return copyNote(ins, ins.tag)
  // The word it loads or stores and the address it forms, as codegen
  // tagged the line.
  const known = named(ins)
  // `k(base)`: through a pointer, or at an offset from one.
  const at = (m: string) => {
    const [, k = '0', base = m] = /^(-?\d+)\((.+)\)$/.exec(m) ?? []
    const n = Number(k)
    const where =
      n === 0
        ? `the ${WIDTH[op]} ${c(base)} points at`
        : `the ${WIDTH[op]} ${Math.abs(n)} bytes ${n < 0 ? 'below' : 'above'} where ${c(base)} points`
    return known?.touch ? `${where}, ${called(known.touch)}` : where
  }
  if (op in WIDTH && op.startsWith('l'))
    return known?.touch
      ? `${c(op)} loads ${at(a[1])}, into ${c(a[0])}.`
      : `${c(op)} loads ${at(a[1])} into ${c(a[0])}.`
  if (op in WIDTH)
    return `${c(op)} stores ${op === 'sb' ? `the low byte of ${c(a[0])}` : c(a[0])} into ${at(a[1])}.`
  if (op in ARITH) {
    const of = known?.address ? `the address of ${called(known.address)}` : ''
    if (/^-?\d+$/.test(a[2] ?? '') && Number(a[2]) === 0 && ARITH[op] === '+')
      return `${c(op)} copies ${c(a[1])} into ${c(a[0])}${of ? `: ${of}` : ''}.`
    if (a[1] === '$fp' || a[1] === '$sp') {
      const n = Number(a[2])
      return `${c(op)}: ${c(a[0])} = ${c(a[1])} ${n < 0 ? '−' : '+'} ${Math.abs(n)}, ${of || `an address ${Math.abs(n)} bytes ${n < 0 ? 'below' : 'above'} ${c(a[1])}`}.`
    }
    return `${c(op)}: ${c(a[1])} ${ARITH[op]} ${c(a[2])} goes into ${c(a[0])}${of ? `, ${of}` : ''}.`
  }
  if (op === 'slt' || op === 'sltu' || op === 'slti' || op === 'sltiu')
    return `${c(op)}: ${c(a[0])} becomes 1 (true) if ${c(a[1])} < ${c(a[2])}, else 0 (false).`
  if (op === 'sll' || op === 'srl' || op === 'sra')
    return `${c(op)}: ${c(a[1])} shifted ${op === 'sll' ? 'left' : 'right'} by ${a[2]} goes into ${c(a[0])}.`
  if (op === 'mult')
    return `${c(op)}: ${c(a[0])} × ${c(a[1])} goes into the special register ${c('lo')}.`
  if (op === 'div')
    return `${c(op)}: ${c(a[0])} ÷ ${c(a[1])}; the quotient goes into ${c('lo')}, the remainder into ${c('hi')}.`
  if (op === 'mflo' || op === 'mfhi')
    return `${c(op)} copies ${c(op.slice(2))} into ${c(a[0])}.`
  if (op === 'li') return `${c(op)}: ${c(a[1])} goes into ${c(a[0])}.`
  if (op === 'la')
    return `${c(op)}: the address of ${c(a[1])}, a global, goes into ${c(a[0])}.`
  if (op === 'move') return `${c(op)} copies ${c(a[1])} into ${c(a[0])}.`
  if (op === 'beqz' || op === 'bnez')
    return `${c(op)} jumps to ${c(a[1])} if ${c(a[0])} is ${op === 'beqz' ? '' : 'not '}0.`
  if (op === 'beq' || op === 'bne')
    return `${c(op)} jumps to ${c(a[2])} if ${c(a[0])} ${op === 'beq' ? '=' : '≠'} ${c(a[1])}.`
  if (op === 'j') return `${c(op)} jumps to ${c(a[0])}.`
  if (op === 'jal')
    return `${c(op)} calls ${c(a[0])}, keeping the way back in ${c('$ra')}.`
  if (op === 'jr') return `${c(op)} jumps to the address in ${c(a[0])}.`
  if (op === 'syscall')
    return `${c(op)} asks the system for the service numbered in ${c('$v0')}.`
  return `${c(t)}.`
}

const text = (trace: Trace, span: Span) =>
  (trace.text ?? '').slice(span.start, span.end)

const line = (trace: Trace, span: Span) =>
  (trace.text ?? '').slice(0, span.start).split('\n').length

/** What a node is, in words: "multiplication", "integer literal", ... */
function describe(node: AstNode): string {
  switch (node.kind) {
    case 'binary':
      return OP_NAMES[node.label] ?? 'operator'
    case 'unary':
      return 'negation'
    case 'number':
      return 'integer literal'
    case 'name':
      return 'name reference'
    case 'declare':
      return 'declaration'
    case 'assign':
      return 'assignment'
    case 'return':
      return 'return statement'
    case 'function':
      return 'function'
    case 'block':
      return 'block'
    case 'while':
      return 'while loop'
    case 'if':
      return 'if statement'
    case 'call':
      return 'call'
    case 'program':
      return 'program'
    case 'statement':
      return 'statement'
    default:
      return 'expression'
  }
}

/** What a token does, as a predicate: "`;` ends this statement". */
function tokenRole(token: Token): string {
  if (token.kind === 'keyword')
    return KEYWORD_ROLES[token.text] ?? 'is a keyword with a fixed meaning'
  if (token.kind === 'name') return 'is an identifier'
  // DRAFT copy. (The compiler files every literal under one kind.)
  if (token.kind === 'number' && token.text.startsWith('"'))
    return 'is one string literal: everything between the quotes, spaces too, is part of it'
  if (token.kind === 'number' && token.text.startsWith("'"))
    return 'is one character literal'
  if (token.kind === 'number')
    return token.text.length > 1
      ? `is one integer token: all ${token.text.length} digits belong to the same number`
      : 'is an integer token'
  if (SYMBOL_ROLES[token.text]) return SYMBOL_ROLES[token.text]
  if (OP_NAMES[token.text])
    return `is the ${OP_NAMES[token.text]} operator. It needs a value on each side`
  return 'is punctuation'
}

const roleWord: Record<string, string> = {
  left: 'left input',
  right: 'right input',
  operand: 'operand',
  condition: 'condition',
  body: 'body',
  argument: 'argument',
  statement: 'statement',
  value: 'value',
}

/** The sentence behind a frame: what was decided and why. */
export function explain(trace: Trace, frame: Frame, titled = true): string {
  const said = explainStep(trace, frame, titled)
  // A group seals on the step that finished it.
  return frame.sealed?.length
    ? `${said} The ${code(')')} closes the group, so it goes on as one piece.`
    : said
}

function explainStep(trace: Trace, frame: Frame, titled: boolean): string {
  const w: Why = frame.why
  const node = (id: number) => trace.nodes[id]
  // (an expression standing as a statement is read to its `;`; quoted as
  // an expression, it goes without)
  const src = (id: number) => {
    const n = node(id)
    const said = text(trace, n)
    return code(
      nodeKind(n).cls === 'expression' ? said.replace(/;$/, '') : said,
    )
  }
  // An expression where a statement goes is the statement itself (the
  // tracer reads it to its `;`), as `print_i(x);` or `p.x = 1;` are.
  const standsAlone = (n: AstNode) => {
    const p = trace.nodes.find((q) => q.children.includes(n.id))
    return (
      nodeKind(n).cls === 'expression' &&
      (p?.kind === 'block' ||
        ((p?.kind === 'while' || p?.kind === 'if') &&
          p.children.indexOf(n.id) > 0))
    )
  }
  // DRAFT copy.
  const statementToo = `Where a statement goes, an expression and its ${code(';')} make an expression statement, so this node is the statement too.`
  switch (w.kind) {
    case 'ready':
      // Stanley's copy (2026-09-27); "MIPs" read MIPS, and the "…" after it
      // a full stop. DRAFT copy: the bracket he left, naming the bundle.
      return (
        'Welcome to an interactive demonstration of the compiler I wrote for ' +
        'a subset of the C programming language! It follows the traces of ' +
        'the real compiler, running right here in your browser, so every ' +
        'step you see is true to the actual process of how your code would ' +
        'be compiled into a target assembly language. In this case, we are ' +
        'targeting MIPS. Feel free to try out your own C code or edit the ' +
        'examples!\n\n– Stanley'
      )
    case 'token': {
      // With step titles the token is in the header and the body names its
      // class above the list; without, the body names both.
      const token = trace.tokens[w.token]
      const kind = tokenKind(token)
      return titled
        ? kind[0].toUpperCase() + kind.slice(1)
        : `${code(token.text)} is ${article(kind)}`
    }
    case 'lex.char':
      return readStep(trace, w)
    case 'lex.error': {
      // The tokeniser's own message, in the page's words.
      const r = trace.tokens[w.token].reads?.[w.read]
      const message = r && 'error' in r ? r.error : ''
      return compilerError(message, trace.text ?? '')?.message ?? message
    }
    case 'lex.skip':
      return w.comment
        ? 'Comments only matter to people. The lexer skips them, along with the whitespace around them.'
        : 'Whitespace only separates tokens, so the lexer skips it without making a token.'
    case 'parse.read': {
      const t = trace.tokens[w.token]
      return `${code(t.text)} ${tokenRole(t)}. No node is built from it alone.`
    }
    case 'parse.node': {
      // DRAFT, on Stanley's template: what the token started as, the one
      // piece of structure that decides it, and what it becomes. The kind
      // named at the end is the one lit in the list under the note.
      const n = node(w.node)
      const tok = trace.tokens[n.token]
      const parent = trace.nodes.find((p) => p.children.includes(n.id))
      switch (n.kind) {
        case 'number':
          // DRAFT copy for the string and character literals.
          return n.label.startsWith('"')
            ? `${code(n.label)} started as a string literal, and a string is already a whole value, so it becomes a string expression.`
            : n.label.startsWith("'")
              ? `${code(n.label)} started as a character literal, and a character is already a whole value, so it becomes a character expression.`
              : `${code(n.label)} started as a number, and a number is already a whole value, so it becomes a number expression.`
        case 'name':
          return `${code(n.label)} started as an identifier, and with no ${code('(')} after it, it names a value, so it becomes a name expression.`
        case 'declare': {
          // DRAFT copy
          if (parent && structOf(trace, n))
            return `${code(n.label)} (a type, then an identifier) inside ${code(parent.label)} becomes a field declaration.`
          const where =
            parent?.kind === 'function'
              ? `in ${code(parent.label)}'s parameter list`
              : parent?.kind === 'program'
                ? 'outside any function'
                : 'at the top of a block'
          return nodeKind(n).kind === 'variable'
            ? `${code(n.label)} (a type, then an identifier) ${where} becomes a variable declaration.`
            : `${code(n.label)} becomes a ${nodeKind(n).kind} declaration.`
        }
        case 'return':
          return `${code('return')} started as a keyword, and at the start of a statement it opens a return statement.`
        case 'assign':
          return `${code(tok.text)} started as an identifier, but the ${code('=')} after it makes it the target of an assignment expression.`
        case 'function':
          // syntax_grammar.txt: `type IDENT "(" params ")"` begins fundecl or
          // fundef; the block after `)` makes it a FunDef, a `;` a FunDecl.
          // The type before the name slides into the node (animated.tsx
          // `absorbed`): it is kept there as the return type.
          const type = trace.tokens
            .filter((t) => t.start >= n.start && t.id < n.token)
            .map((t) => t.text)
            .join(' ')
          return `${code(n.label)} started as an identifier, but a type and a name followed by ${code('(')} begin a function, and the block after its ${code(')')} makes it a function definition.${type ? ` ${code(type)} goes inside it as the return type.` : ''}`
        case 'block':
          return parent?.kind === 'function'
            ? `${code('{')} started as a delimiter, and after ${code(parent.label)}'s parameters it opens the body, a block statement.`
            : `${code('{')} started as a delimiter, and where a statement goes it opens a block statement.`
        case 'while':
          return `${code('while')} started as a keyword, and at the start of a statement it opens a while statement.`
        case 'if':
          return `${code('if')} started as a keyword, and at the start of a statement it opens an if statement.`
        case 'call':
          return `${code(tok.text)} started as an identifier, but the ${code('(')} after it makes it a call expression.${standsAlone(n) ? ` ${statementToo}` : ''}`
        case 'unary':
          return `${code(n.label)} started as an operator, but with no value before it, it applies to what follows: an operator expression.`
        case 'program':
          return `${code('global')} holds the top-level declarations, read one after another.`
        case 'statement':
          // DRAFT copy. Only a statement the parser gave up on before its
          // expression keeps a node of its own, labelled `expr`; the note
          // quotes what there is of it.
          if (n.label === 'expr')
            return `${code(text(trace, n))} doesn't start with a keyword, so it's an expression statement: an expression, then ${code(';')}.`
        // falls through
        default: {
          // DRAFT copy: named by its kind in the list under the note
          // (`.` becomes a method call expression).
          const { cls, kind } = nodeKind(n)
          return kind && (cls === 'expression' || cls === 'statement')
            ? `${code(n.label)} becomes ${article(`${kind} ${cls}`)}.`
            : `${code(n.label)} becomes ${article(describe(n))} node.`
        }
      }
    }
    case 'parse.take':
      return `${src(w.child)} becomes the ${roleWord[w.role] ?? w.role} of ${code(node(w.parent).label)}.`
    case 'parse.wait': {
      const op = node(w.node)
      // DRAFT, on the parse.node template.
      return `${code(op.label)} started as an operator, and with ${src(w.child)} before it, it becomes an operator expression that waits, dashed, for its right side.${standsAlone(op) ? ` ${statementToo}` : ''}`
    }
    case 'parse.precedence': {
      const child = src(w.child)
      // `a = b = c`: the second `=` wins because `=` groups right to left
      // (its right side is read one level lower), not because it is tighter.
      if (w.relation === 'tighter' && w.incoming === '=' && w.pending === '=')
        return `Another ${code('=')}: assignment groups right to left, so ${child} joins the new ${code('=')} first. The earlier ${code('=')} keeps waiting for the result.`
      if (w.relation === 'tighter')
        return `${code(w.incoming)} binds tighter than ${code(w.pending)}, so ${child} joins ${code(w.incoming)} first. ${code(w.pending)} keeps waiting.`
      if (w.relation === 'equal')
        return w.pending === w.incoming
          ? `Two ${code(w.pending)} in a row bind equally. The earlier one closes first, so grouping runs left to right.`
          : `${code(w.incoming)} binds as tightly as ${code(w.pending)}. The earlier one closes first, so grouping runs left to right.`
      return `${code(w.incoming)} binds less tightly than ${code(w.pending)}, so ${code(w.pending)} closes first. Its result becomes the left input of ${code(w.incoming)}.`
    }
    case 'parse.group':
      return 'The parenthesis opens a group. Everything inside finishes before anything outside can see it.'
    case 'parse.close': {
      const n = node(w.node)
      const kids = n.children.map(src)
      switch (n.kind) {
        case 'binary':
          // DRAFT copy for the statement's `;`.
          return standsAlone(n)
            ? `${code(n.label)} now holds both inputs, ${kids[0]} and ${kids[1]}, and the ${code(';')} after them ends the statement.`
            : `${code(n.label)} now holds both inputs, ${kids[0]} and ${kids[1]}. Its result is ${src(w.node)}.`
        case 'unary':
          return `${code(n.label)} now holds its operand ${kids[0]}.`
        case 'return':
          return kids.length
            ? `${code('return')} takes ${kids[0]} as the value to hand back.`
            : `${code('return')} hands nothing back.`
        case 'assign':
          return `The assignment takes ${kids[kids.length - 1]}. It will be stored into ${code(trace.tokens[n.token].text)}.`
        case 'declare':
          return `${code(text(trace, n))} is complete.`
        case 'function':
          return `${code(n.label)} is complete.`
        case 'block':
          return 'The block closes.'
        case 'while':
          return 'The loop closes over its condition and body.'
        case 'if':
          return 'The if closes over its condition and branches.'
        case 'call': {
          const said = kids.length
            ? `The call to ${code(trace.tokens[n.token].text)} has its ${kids.length === 1 ? 'argument' : 'arguments'} ${kids.join(', ')}.`
            : `The call to ${code(trace.tokens[n.token].text)} takes no arguments.`
          // DRAFT copy.
          return standsAlone(n)
            ? `${said} The ${code(';')} after it ends the statement.`
            : said
        }
        case 'program':
          return 'Every declaration has been read.'
        default:
          return `${code(n.label)} closes.`
      }
    }
    case 'parse.done':
      return `AST is complete with ${trace.nodes.length} nodes`
    case 'parse.error': {
      // DRAFT copy
      const found =
        w.token === null
          ? 'the end of the program'
          : code(trace.tokens[w.token].text)
      return w.expected.length
        ? `The parser expected ${joinOr(w.expected.map(categoryText))} here but found ${found}, so it stops.`
        : `The parser stops at ${found}.`
    }
    case 'check.declare': {
      const decl = node(w.decl)
      const name = trace.tokens[decl.token].text
      // A forward declaration is a function too.
      const fn = decl.kind === 'function' || decl.label.startsWith('FunDecl ')
      // DRAFT copy: a definition joining its forward declaration, a
      // declaration of a built-in, and a declaration hiding one around it.
      if (w.builtin)
        return `${code(name)} is already a built-in function; this declaration matches it.`
      if (w.joins !== undefined && decl.kind !== 'function')
        return `The declaration of ${code(name)} matches its definition on line ${line(trace, node(w.joins))}: still one function.`
      if (w.joins !== undefined)
        return `The definition of ${code(name)} joins its declaration on line ${line(trace, node(w.joins))}: one function, now with a body.`
      const hidden = w.shadows === undefined ? undefined : node(w.shadows)
      const hides = !hidden
        ? ''
        : ` From here on it hides ${
            hidden.kind === 'function' || hidden.label.startsWith('FunDecl ')
              ? `the function ${code(trace.tokens[hidden.token].text)}`
              : code(text(trace, hidden))
          } on line ${line(trace, hidden)}.`
      if (fn)
        return `The function ${code(name)} goes in ${w.scope}, so calls anywhere below it can find it.${hides}`
      // DRAFT copy
      if (isClassDecl(decl.label))
        return `The class ${code(name)} goes in ${w.scope}.${hides}`
      if (w.where === 'param')
        return `The parameter ${code(decl.label)} goes in ${w.scope}.${hides}`
      return `${code(text(trace, decl))} puts ${code(name)} in ${w.scope}.${hides}`
    }
    case 'check.resolve': {
      const use = node(w.use),
        decl = node(w.decl)
      const name = trace.tokens[use.token].text
      // DRAFT copy: a call that finds only a forward declaration.
      if (w.deferred)
        return `${code(name + '()')} finds the declaration of ${code(name)} on line ${line(trace, decl)}. Its definition comes later, so the call is tied to it once the whole file is read.`
      if (use.kind === 'call')
        return `${code(name + '()')} calls the function ${code(decl.label)} defined ${w.where}.`
      const where =
        w.where === 'param'
          ? 'in the parameters'
          : `on line ${line(trace, decl)}`
      // An assignment's target, resolved before its value.
      const which = use.kind === 'assign' ? 'The target' : 'This'
      return `${which} ${code(name)} refers to ${code(text(trace, decl))} ${where}.`
    }
    case 'check.unresolved': {
      const use = node(w.use)
      const name = trace.tokens[use.token].text
      // DRAFT copy: the name is there, but not a variable or not a function.
      if (w.found !== undefined && use.kind === 'call')
        return `${code(name)} here names ${code(text(trace, node(w.found)))} on line ${line(trace, node(w.found))}, which is not a function, so the compiler cannot call it. It stops here.`
      if (w.found !== undefined && node(w.found).kind === 'function')
        return `${code(name)} here names the function ${code(name)}, not a variable, so the compiler cannot read it. It stops here.`
      return `No declaration is visible for ${code(name)}, so the compiler cannot say what it means. It stops here.`
    }
    case 'check.builtin': {
      const use = node(w.use)
      return `${code(trace.tokens[use.token].text + '()')} is a built-in function. No declaration in this file is needed.`
    }
    // DRAFT copy, the next three.
    case 'check.link': {
      const name = trace.tokens[node(w.use).token].text
      return `Now that the whole file has been read, ${code(name + '()')} is tied to the definition of ${code(name)} on line ${line(trace, node(w.decl))}.`
    }
    case 'check.nameError':
      return `The name pass reports: ${w.message}. Compilation stops after this pass.`
    // What the error is about: a type, else what it spans (a name, a
    // statement), or with nothing to point at the whole program, unquoted.
    case 'check.typeError':
      return w.about !== undefined
        ? `${code(w.about)}: ${w.message}. The compiler stops here.`
        : w.node === trace.root
          ? `${w.message[0].toUpperCase()}${w.message.slice(1)}. The compiler stops here.`
          : `${code(text(trace, frame.span))}: ${w.message}. The compiler stops here.`
    case 'check.type': {
      const n = node(w.node)
      const owner = structOf(trace, n)
      // DRAFT copy
      if (owner) {
        const name = trace.tokens[n.token].text
        const struct = owner.label.replace(/ \{ \}$/, '')
        return `${code(struct)}'s field ${code(name)} is declared ${code(w.type)}, so any ${code(`.${name}`)} on a ${code(struct)} has that type.`
      }
      if (n.kind === 'declare')
        return `${code(trace.tokens[n.token].text)} is declared with type ${code(w.type)}. Later uses must agree with it.`
      // DRAFT copy: the steps type-view.ts adds.
      if (n.kind === 'function')
        return `${code(n.label)} is declared to return ${code(w.type)}, so every ${code('return')} in its body has to hand back ${/^[aeiou]/.test(w.type) ? 'an' : 'a'} ${code(w.type)}.`
      if (w.decl !== undefined)
        return `${src(w.node)} was declared as ${code(text(trace, node(w.decl)).replace(/;$/, ''))}, so it has type ${code(w.type)}.`
      if (n.kind === 'number')
        return `${src(w.node)} is a ${n.label.startsWith("'") ? 'character' : n.label.startsWith('"') ? 'string' : 'number'} literal, so it has type ${code(w.type)}.`
      return w.expected
        ? `The return expression has type ${code(w.type)}, matching the function's ${code(w.expected)}.`
        : `${src(w.node)} has type ${code(w.type)}.`
    }
    case 'check.expr': {
      const n = node(w.node)
      if (!w.ok) {
        const bad = w.bad == null ? undefined : node(w.bad)
        const got = bad && w.typed.find(([id]) => id === bad.id)?.[1]
        if (!bad || !w.expected)
          return w.message
            ? `${src(w.node)} doesn't type-check: ${w.message}. The compiler stops here.` // DRAFT copy
            : `${src(w.node)} doesn't type-check, so the compiler stops here.`
        if (n.kind === 'call')
          return `${code(n.label)} needs ${code(w.expected)} here, but ${src(bad.id)} is ${code(got ?? '?')}. The compiler stops here.`
        return ['==', '!='].includes(n.label)
          ? `${code(n.label)} needs both sides to have the same type, but ${src(bad.id)} is ${code(got ?? '?')}, not ${code(w.expected)}. The compiler stops here.`
          : `${code(n.label)} needs ${code(w.expected)} on both sides, but ${src(bad.id)} is ${code(got ?? '?')}. The compiler stops here.`
      }
      if (n.kind === 'call')
        return n.children.length
          ? `The ${n.children.length === 1 ? 'argument matches' : 'arguments match'} the parameters, so ${src(w.node)} has the function's return type, ${code(w.type)}.`
          : `${src(w.node)} has the function's return type, ${code(w.type)}.`
      // DRAFT copy
      if (n.label === '=') {
        const [target, value] = n.children
        return `The target ${src(target)} and the value ${src(value)} are both ${code(w.type)}, so the assignment fits, and ${src(w.node)} has type ${code(w.type)}.`
      }
      if (n.label.startsWith('.') && n.children.length === 1) {
        const of =
          w.typed.find(([id]) => id === n.children[0])?.[1] ??
          typeOf(trace, n.children[0])
        return `${code(n.label.slice(1))} is a field of ${code(of ?? 'the struct')}, declared ${code(w.type)}, so ${src(w.node)} has type ${code(w.type)}.`
      }
      if (n.kind === 'binary' || n.kind === 'unary') {
        const sides = n.kind === 'unary' ? 'Its operand is' : 'Both sides are'
        return ['<', '>', '<=', '>=', '==', '!=', '&&', '||'].includes(n.label)
          ? `${sides} ${code('int')}, so ${src(w.node)} checks out. A comparison gives ${code('int')}: 1 for true, 0 for false.`
          : `${sides} ${code('int')}, so ${src(w.node)} is ${code(w.type)} too.`
      }
      return `${src(w.node)} has type ${code(w.type)}.`
    }
    case 'check.fits': {
      const value = src(w.value)
      if (w.rule === 'assign') {
        const target = code(trace.tokens[node(w.node).token].text)
        return w.ok
          ? `${target} is ${code(w.expected)} and ${value} is ${code(w.type)}, so the assignment fits.`
          : `${target} is ${code(w.expected)}, but ${value} is ${code(w.type)}. The compiler stops here.`
      }
      if (w.rule === 'condition') {
        const what = code(node(w.node).label)
        return w.ok
          ? `The condition ${value} is ${code('int')}, as ${what} needs.`
          : `A ${what} condition must be ${code('int')}, but ${value} is ${code(w.type)}. The compiler stops here.`
      }
      // A bare `return;` stands in for its own value.
      if (w.value === w.node)
        return w.ok
          ? `${code('return;')} hands back nothing, as a ${code('void')} function should.`
          : `The function promises ${code(w.expected)}, but this ${code('return;')} hands back nothing. The compiler stops here.`
      return w.ok
        ? `The return value ${value} is ${code(w.type)}, matching what the function promises.`
        : `The function promises ${code(w.expected)}, but ${value} is ${code(w.type)}. The compiler stops here.`
    }
    case 'check.typesDone':
      return 'Every expression has a type, and each one fits where it is used. The tree is ready for code generation.'
    case 'check.namesDone':
      return w.unresolved === 0 && w.errors
        ? // DRAFT copy
          `Every name has a declaration, but the name pass found ${w.errors === 1 ? 'an error' : `${w.errors} errors`}, so compilation stops.`
        : w.unresolved === 0
          ? 'Every name has a declaration. Each use is now tied to the place it was declared.'
          : `${w.unresolved} ${w.unresolved === 1 ? 'name has' : 'names have'} no declaration, so compilation stops.`
    case 'emit.instr': {
      const n = node(w.node)
      const run = trace.instructions.slice(w.from, w.to + 1)
      if (run[0]?.text === undefined) {
        // toy three-address code
        const ins = run[0]
        const shown = code(instructionLine(ins))
        switch (ins.op) {
          case 'li':
            return `${shown} places the literal ${code(n.label)} in temporary ${code(ins.dest ?? '')}. Temporaries are unlimited at this stage.`
          case 'return':
            return `${shown} hands back ${code(ins.args[0])}. Children were emitted first, so the value already exists.`
          default:
            return `${shown} computes ${describe(n)} of ${code(ins.args[0])} and ${code(ins.args[1])} into ${code(ins.dest ?? '')}. Both inputs were emitted before this line.`
        }
      }
      const dead = run.find((i) => i.dead)
      const line = w.of
        ? explainLine(trace, n, w.of, w.from)
        : w.parts && w.parts.length > 1
          ? explainBlock(trace, w.parts)
          : explainMips(trace, n, run)
      // DRAFT: the first virtual register opens the live-range lanes.
      const firstDef = trace.instructions.findIndex((i) =>
        /^v\d+$/.test(i.dest ?? ''),
      )
      const said =
        firstDef >= w.from && firstDef <= w.to
          ? `From here on, every value gets a virtual register, and the lanes on the right track its life: live from the line that writes it to the last line that reads it. ${line}`
          : line
      return dead
        ? `${said} ${run.length === 1 ? 'It' : code(dead.text ?? dead.op)} never runs: the jump before it always leaves first, so the register allocator drops it.`
        : said
    }
    case 'emit.prologue': {
      const n = node(w.node)
      if (w.of) return explainFrameLine(trace, n, w.of, w.from)
      const run = trace.instructions.slice(w.from, w.to + 1)
      // Space for locals is the last move of $sp after $fp is set; the
      // earlier ones make room for the saved $fp and $ra.
      const setFp = run.findIndex((i) => i.text === 'addiu $fp,$sp,0')
      const room = run
        .slice(setFp + 1)
        .filter((i) => /^addiu? \$sp,\$sp,-/.test(i.text ?? ''))
        .pop()
      const bytes =
        room && !run[run.indexOf(room) + 1]?.text?.startsWith('sw $ra')
          ? Number(room.text?.split(',').pop()) * -1
          : 0
      const saveRa = run.some((i) => i.text?.startsWith('sw $ra'))
      // (pushRegisters isn't shown in emit: register allocation adds it,
      // Stanley, 2026-10-01; emit-view.ts withoutPlaceholders)
      return `Before its body, ${code(n.label)} builds a stack frame: it saves the caller's frame pointer, points ${code('$fp')} at this frame${saveRa ? ', keeps the return address' : ''}${bytes ? `, and reserves ${bytes} bytes for the variables it declares` : ''}. None of these lines is written in your code.`
    }
    case 'emit.epilogue': {
      const n = node(w.node)
      if (w.of) return explainFrameLine(trace, n, w.of, w.from)
      const run = trace.instructions.slice(w.from, w.to + 1)
      const exits = run.some((i) => i.op === 'syscall')
      // (nor popRegisters: see the prologue)
      const back = `puts ${code('$sp')} and ${code('$fp')} back the way the caller left them`
      return `${code(n.label)} is done. It ${back}, and ${exits ? 'exits with a system call' : `jumps back to the caller with ${code('jr $ra')}`}.`
    }
    case 'emit.value':
      return `${code(node(w.node).label)} already lives in ${code(w.v)} from its assignment, so no instruction is needed.`
    case 'reg.assign':
      return `${code(w.v)} gets ${code(w.r)}, which nothing else holds at this point.`
    case 'reg.reuse':
      return `${code(w.r)} is free again: ${code(w.prevV)} was read for the last time by instruction ${w.diedAt + 1}, so ${code(w.v)} can take it.`
    // Left out of the page (regs-view.ts withoutLiveness): the bars from
    // emit already show what the sweeps work out.
    case 'reg.cfg':
    case 'reg.live':
      return ''
    case 'reg.interfere':
      return `Two registers interfere when they are live at the same time: they cannot share a real register. ${w.nodes} virtual registers, ${w.edges} ${w.edges === 1 ? 'overlap' : 'overlaps'}${w.busiest ? `; ${code(w.busiest)} overlaps the most, with ${w.degree}` : ''}.`
    case 'reg.simplify': {
      const f = trace.backend?.functions[w.fn]
      const st = f && attemptOf(f, w).steps[w.step]
      const k = f ? attemptOf(f, w).palette.length : 0
      if (!st) return 'A register with few neighbours is set aside.'
      const n = pushNumber(attemptOf(f, w).steps, w.step)
      if (!st.degree)
        return `${code(st.vr)} overlaps nothing still in the graph, so any register will do. It is set aside as ${n}.`
      return `${code(st.vr)} overlaps ${st.degree} ${st.degree === 1 ? 'other' : 'others'} still in the graph, fewer than the ${k} registers available, so it is sure to get one. It is set aside as ${n}, and its edges come off the graph.`
    }
    case 'reg.spillCandidate': {
      const f = trace.backend?.functions[w.fn]
      const st = f && attemptOf(f, w).steps[w.step]
      return `Every remaining register overlaps ${f ? attemptOf(f, w).palette.length : 'k'} or more others. ${code(st?.vr ?? '')} has the most edges, so it is set aside${f ? ` as ${pushNumber(attemptOf(f, w).steps, w.step)}` : ''}, the one that may have to spill.`
    }
    case 'reg.select': {
      const f = trace.backend?.functions[w.fn]
      const st = f && attemptOf(f, w).steps[w.step]
      if (!st) return 'A register comes off the stack and takes a colour.'
      const forbidden = st.forbidden ?? []
      const steps = attemptOf(f, w).steps
      const pushed = steps.findIndex(
        (p) =>
          p.vr === st.vr && (p.op === 'simplify' || p.op === 'spillCandidate'),
      )
      const first = !steps.slice(0, w.step).some((p) => p.op === 'select')
      const back = first
        ? `${code(st.vr)}, set aside last, comes back first.`
        : `${code(st.vr)}${pushed >= 0 ? ` (${pushNumber(steps, pushed)})` : ''} comes back.`
      if (forbidden.length === 0)
        return `${back} None of its neighbours holds a register yet, so it takes the first one, ${code(st.colour ?? '')}.`
      return `${back} Its neighbours hold ${forbidden.map(code).join(', ')}, so it takes the next free one, ${code(st.colour ?? '')}.`
    }
    case 'reg.spill': {
      const f = trace.backend?.functions[w.fn]
      const st = f && attemptOf(f, w).steps[w.step]
      // DRAFT copy: a spill in the 18-colour attempt only ends that attempt.
      if (w.abandoned)
        return `${code(st?.vr ?? '')} comes back and finds all ${f ? attemptOf(f, w).palette.length : 18} registers taken by its neighbours. Spill code needs registers of its own to load and store through, so once this pass ends the allocator starts over with ${f?.colouring.palette.length ?? 16}.`
      // DRAFT copy: the label sentence.
      const label = st && f?.colouring.labels[st.vr]
      return `${code(st?.vr ?? '')} comes back and finds every register taken by a neighbour. It lives in memory instead: loads and stores are added around each use.${label ? ` Its word in ${code('.data')} is ${code(label)}.` : ''}`
    }
    // DRAFT copy
    case 'reg.retry':
      return `With all 18 registers, ${w.spills} ${w.spills === 1 ? 'value finds' : 'values find'} none free. A spilled value is loaded into a register before each read and stored from one after each write, so the allocator colours the graph again with ${w.k}, keeping ${code('$t8')} and ${code('$t9')} for that spill code.`
    case 'reg.done': {
      if (w.fn === undefined)
        return 'Every temporary now has a physical register. Reuse kept the count small.'
      // DRAFT copy: what the rewrite turns the placeholders and spills into.
      const fn = w.fn
      const saves = trace.instructions.some(
        (i) => i.fn === fn && i.op === 'pushRegisters' && i.out?.length,
      )
      const rewrite = [
        ...(saves
          ? [
              `${code('pushRegisters')} and ${code('popRegisters')} become saves and restores of the registers in use`,
            ]
          : []),
        ...(w.spills
          ? [
              `each spilled value is loaded through ${code('$t8')} or ${code('$t9')} before a read and stored after a write`,
            ]
          : []),
      ]
      return `${w.used} real ${w.used === 1 ? 'register covers' : 'registers cover'} every virtual one${w.spills ? `, with ${w.spills} spilled to memory` : ''}. Values that never overlap share a register.${rewrite.length ? ` In the code, ${rewrite.join(', and ')}.` : ''}`
    }
  }
}

/**
 * One sentence for a block of emit steps (emit-view.ts): a clause per node,
 * in the order the instructions come.
 */
function explainBlock(
  trace: Trace,
  parts: { node: number; from: number; to: number }[],
): string {
  const line = (i: Instruction) => code(i.text ?? '')
  const name = (label: string) => label.replace(/\s*=$/, '')
  const clauses = parts.map((p, k) => {
    const n = trace.nodes[p.node]
    const run = trace.instructions.slice(p.from, p.to + 1)
    const first = run[0],
      last = run[run.length - 1]
    const ops = run.map((i) => i.op)
    if (ops.includes('jal'))
      return `${line(run.find((i) => i.op === 'jal') as Instruction)} calls ${code(trace.tokens[n.token].text)}, and ${code(last.dest ?? '')} reads its result`
    switch (n.kind) {
      case 'number':
        return `${line(first)} loads ${code(n.label)}`
      case 'name':
        return ops.includes('lw')
          ? `${line(last)} loads ${code(n.label)} from its slot`
          : `${line(first)} finds ${code(n.label)}'s slot`
      case 'binary': {
        const op = OP_NAMES[n.label] ?? 'operation'
        if (ops.includes('mflo'))
          return `${line(first)} and ${line(last)} do the ${op} into ${code(last.dest ?? '')}`
        if (first.op === 'slt' || first.op === 'sltu')
          return `${line(first)} compares them into ${code(first.dest ?? '')}`
        return `${line(first)} does the ${op} into ${code(first.dest ?? '')}`
      }
      case 'assign':
        return ops.includes('sw') && k > 0
          ? `${line(last)} stores it in ${code(name(n.label))}`
          : `${line(first)} finds ${code(name(n.label))}'s slot`
      case 'return':
        return `${line(first)} writes the return value and ${line(last)} jumps to the exit`
      default:
        return `${run.map(line).join(', ')} ${run.length === 1 ? 'is' : 'are'} emitted for ${code(text(trace, n).replace(/\s+/g, ' '))}`
    }
  })
  const listed =
    clauses.length > 1
      ? `${clauses.slice(0, -1).join(', ')}, and ${clauses[clauses.length - 1]}`
      : clauses[0]
  return `${listed[0].toUpperCase()}${listed.slice(1)}.`
}

// What the word a load reads holds, when it is an address a line stored
// there (stack-view.ts): `p`'s `&x`, by the name of the word, `x`.
function heldAddress(trace: Trace, at: number) {
  const frame = stackFrames(trace).find((f) => f.first <= at && at <= f.last)
  const read = frame?.touches.find((t) => t.at === at && t.kind === 'read')
  const h =
    read &&
    frame?.holds.find((h) => h.addr === read.addr && h.from < at && at <= h.to)
  return (h && frame && wordAt(frame, h.of, at)?.label) || undefined
}

// Line by line (emit-view.ts), DRAFT copy: a short sentence per line of a
// node's run, saying what the line is for rather than repeating it.
function explainLine(
  trace: Trace,
  n: AstNode,
  of: { from: number; to: number },
  at: number,
): string {
  const run = trace.instructions.slice(of.from, of.to + 1)
  const k = at - of.from
  const ins = run[k]
  if (ins.tag?.role.startsWith('copy.')) return copyNote(ins, ins.tag)
  const jal = run.findIndex((i) => i.tag?.role === 'call')
  if (jal >= 0) {
    const callee = code(trace.tokens[n.token].text)
    const tag = ins.tag
    const known = named(ins)
    if (k === jal)
      return `${code('jal')} jumps into ${callee} and keeps the way back in ${code('$ra')}.`
    if (tag?.role.startsWith('copy.')) return copyNote(ins, tag)
    if (tag?.role === 'load' || (tag?.role === 'addr' && tag.of === 'result'))
      return `Back from ${callee}, the result is read into ${code(ins.dest ?? '')}.`
    if (tag?.role === 'release')
      return 'What the call pushed comes off the stack.'
    if (tag?.role === 'store')
      return known.touch
        ? `The argument ${code(ins.args[0] ?? '')} goes into it: ${called(known.touch)}.`
        : `The argument ${code(ins.args[0] ?? '')} goes into it.`
    if (tag?.role === 'reserve' && tag.for === 'result')
      return 'A word for the result, which the function writes before it returns.'
    if (tag?.role === 'reserve' && known.reserve)
      return `A word on the stack for ${called(known.reserve)}.`
    return operandNote(ins)
  }
  switch (n.kind) {
    case 'name': {
      // Only a local's own word has a sentence of its own.
      if (
        !(ins.op === 'lw' && /^lw\s+v\d+,0\(v\d+\)$/.test(ins.text ?? '')) &&
        !/^addiu?\s+v\d+,\$fp,-?\d+$/.test(ins.text ?? '')
      )
        return operandNote(ins)
      if (ins.op === 'lw') {
        const base = /\((v\d+)\)/.exec(ins.text ?? '')?.[1] ?? ''
        const holds = heldAddress(trace, at)
        return `Load the word at ${code(base)}, offset 0, so ${code(n.label)} itself${holds ? `, the address of ${code(holds)},` : ''} into ${code(ins.dest ?? '')}.`
      }
      const offset = Number(/,(-?\d+)$/.exec(ins.text ?? '')?.[1] ?? 0)
      // A name loaded again in the same function: the compiler reloads it
      // on every use.
      const again = trace.instructions
        .slice(0, of.from)
        .some(
          (i) =>
            i.fn === ins.fn &&
            i.op === 'lw' &&
            i.node !== null &&
            trace.nodes[i.node].kind === 'name' &&
            trace.nodes[i.node].label === n.label,
        )
      const where = `${Math.abs(offset)} bytes ${offset < 0 ? 'below' : 'above'} ${code('$fp')}`
      if (again)
        return `${code(ins.dest ?? '')} points at ${code(n.label)}'s word again: the compiler loads a name each time it is used, even twice in a row.`
      return `${code(ins.dest ?? '')} points at ${code(n.label)}'s word, ${where}. That offset was fixed when the prologue laid out the frame.`
    }
    case 'binary':
      if (ins.op === 'mult')
        return `MIPS puts a product in a special register, ${code('lo')}.`
      if (ins.op === 'mflo')
        return `${code('mflo')} copies it into ${code(ins.dest ?? '')}.`
      break
    case 'return':
      if (ins.tag?.role === 'jump.epilogue')
        return "Then a jump to the function's exit code."
      if (ins.tag?.role === 'store')
        return "The value goes into the frame's return slot, where the caller reads it."
      break
  }
  // The first line of a kind with its own story tells it; everything
  // else says what the line does to its operands.
  return k === 0 && TOLD.has(n.kind)
    ? explainMips(trace, n, run)
    : operandNote(ins)
}
const TOLD = new Set(['number', 'name', 'binary', 'assign', 'return', 'while'])

// Line by line, DRAFT copy: one line of a prologue or epilogue.
function explainFrameLine(
  trace: Trace,
  n: AstNode,
  of: { from: number; to: number },
  at: number,
): string {
  const run = trace.instructions.slice(of.from, of.to + 1)
  const k = at - of.from
  const t = run[k].text ?? run[k].op
  const fn = code(n.label)
  // What codegen said the line is for (FunCodeGen's tags).
  const tag = run[k].tag
  const is = (role: Tag['role'], what?: string) =>
    tag?.role === role &&
    (what === undefined || tag.for === what || tag.reg === what)
  // GraphColouringRegAlloc expands both once registers are allocated.
  if (is('push-registers')) {
    // Stanley's copy (2026-09-28), with "helper function" as a placeholder
    // instruction: it isn't a call. Which registers, and how many, waits
    // for the allocator (Stanley, 2026-10-01; stack-view.ts drawnSaved).
    return `Here we use a placeholder, ${code('pushRegisters')}, which expands during register allocation: it makes room on the stack for every physical register ${fn} will use, and saves each one there.`
  }
  if (is('pop-registers'))
    return `${code('popRegisters')} is the same placeholder in reverse: during register allocation it expands into loads that bring back each saved physical register and give its room on the stack back.`
  if (is('save', 'fp'))
    return `The caller's frame pointer goes in that word. Whoever called ${fn} expects its own frame back, so the epilogue restores ${code('$fp')} from here.`
  if (is('set-fp'))
    return `${code('$fp')} now marks this frame. Everything in it sits a fixed distance from ${code('$fp')}, while ${code('$sp')} keeps moving.`
  if (is('save', 'ra'))
    return `${code('$ra')}, the address to return to, is saved.`
  if (is('restore', 'ra')) return 'The return address comes back.'
  if (is('restore', 'fp')) return "The caller's frame pointer comes back."
  if (is('return')) return `${code('jr $ra')} returns to the caller.`
  if (is('syscall.code'))
    return `${fn} has no caller to return to. System call 10 ends the program.`
  if (is('syscall')) return 'The program ends.'
  if (is('release', 'frame'))
    return `${code('$sp')} goes back to where the caller left it.`
  if (is('reserve', 'fp'))
    return `${fn} starts by building its stack frame. First it allocates a word (4 bytes) for its caller's frame pointer.`
  if (is('reserve', 'ra')) return 'A word for the return address.'
  if (!is('reserve', 'locals')) return operandNote(run[k])
  // The last move of $sp makes room for the locals, where the compiler
  // put them (trace.layout, from MemAllocCodeGen).
  const words = -Number(t.split(',').pop()) / 4
  const layout = trace.layout?.functions.find((f) => f.name === n.label)
  const locals = (layout?.locals ?? []).map((l) =>
    l.size === 4 ? code(l.name) : `${code(l.name)} (${l.size} bytes)`,
  )
  const used = (layout?.locals ?? []).reduce(
    (sum, l) => sum + Math.ceil(l.size / 4),
    0,
  )
  // The compiler lays out locals below a word it keeps for `$ra`
  // (MemAllocCodeGen). Other functions push `$ra` into it; `main` never
  // saves `$ra`, so there that word stays empty.
  const spare = words - used
  const savedRa = run.some((i) => i.tag?.role === 'save' && i.tag.reg === 'ra')
  const room = locals.length ? `Room for ${list(locals)}` : ''
  if (spare !== 1 || savedRa) return room ? `${room}.` : `${fn} has no locals.`
  return room
    ? `${room}. The word at ${code('-4')} stays empty: other functions keep ${code('$ra')}, the address to jump back to, there, but ${fn} ends with a system call instead of returning, so it never saves it.`
    : `One word, left empty: other functions keep ${code('$ra')}, the address to jump back to, there, but ${fn} ends with a system call instead of returning.`
}

/** Sentence for one run of real MIPS from one node. */
function explainMips(trace: Trace, n: AstNode, run: Instruction[]): string {
  const src = code(text(trace, n).replace(/\s+/g, ' '))
  const line = (i: Instruction) => code(i.text ?? '')
  const first = run[0],
    last = run[run.length - 1]
  const name = (label: string) => label.replace(/\s*=$/, '')
  const ops = run.map((i) => i.op)
  if (ops.includes('jal')) {
    const jal = run.find((i) => i.op === 'jal')
    return `The call: the arguments are pushed on the stack, ${line(jal as Instruction)} jumps into the function, and the result is read back from the stack into ${code(last.dest ?? '')} once it returns.`
  }
  switch (n.kind) {
    case 'number': {
      // Said once per function: every value gets a register of its own.
      const earlier = trace.instructions
        .slice(0, trace.instructions.indexOf(first))
        .some(
          (i) =>
            i.fn === first.fn && i.op === 'li' && /^v\d+$/.test(i.dest ?? ''),
        )
      return earlier
        ? `The literal ${code(n.label)} goes into ${code(first.dest ?? '')}.`
        : `The literal ${code(n.label)} goes into ${code(first.dest ?? '')}, a fresh virtual register. There is no limit on these yet.`
    }
    case 'name':
      if (!/^addiu?\s+v\d+,\$fp,-?\d+$/.test(first.text ?? ''))
        return operandNote(first)
      if (ops.includes('lw'))
        return `${code(n.label)} lives in the stack frame. ${line(first)} works out its address and ${line(last)} loads the value into ${code(last.dest ?? '')}.`
      return `${line(first)} works out where ${code(n.label)} lives in the frame.`
    case 'binary': {
      const op = OP_NAMES[n.label]
      // A plain operation on two registers; anything else (address
      // arithmetic, a load, a copy) says what the line itself does.
      if (!op || !/^\w+\s+v\d+,v\d+,v\d+$/.test(first.text ?? ''))
        return operandNote(first)
      if (ops.includes('mflo'))
        return `${line(first)} computes the ${op}. MIPS keeps the product in a special register, so ${line(last)} copies it into ${code(last.dest ?? '')}.`
      if (first.op === 'slt' || first.op === 'sltu')
        return `${code(first.dest ?? '')} becomes 1 (true) if ${code(first.args[0])} < ${code(first.args[1])}, else 0 (false): the condition the loop tests next.`
      return `The ${op} of ${code(first.args[0])} and ${code(first.args[1])} goes into ${code(first.dest ?? '')}. Both sides were computed on the lines above: children come before parents.`
    }
    case 'assign':
      if (/^sw\s+v\d+,0\(v\d+\)$/.test(last.text ?? '')) {
        const value = /^sw\s+(v\d+)/.exec(last.text ?? '')?.[1] ?? ''
        const at = /\((v\d+)\)/.exec(last.text ?? '')?.[1] ?? ''
        return `The value in ${code(value)} is stored in ${code(name(n.label))}'s word, the one ${code(at)} points at.`
      }
      if (!/^addiu?\s+v\d+,\$fp,-?\d+$/.test(first.text ?? ''))
        return operandNote(first)
      return `${code(first.dest ?? '')} points at ${code(name(n.label))}'s word first, so the value has somewhere to go once the right-hand side is worked out.`
    case 'return':
      if (first.tag?.role !== 'store') return operandNote(first)
      return `${line(first)} writes the value into the frame's return slot, and ${line(last)} skips to the function's exit code.`
    case 'while':
      if (ops.includes('beqz'))
        return `${code('beqz')} leaves the loop when the condition is 0. Otherwise the body follows.`
      return `${code('j')} goes back to the top to test the condition again.`
    default:
      return run.length === 1
        ? operandNote(first)
        : `${run.map(line).join(', ')} are emitted for ${src}.`
  }
}

function instructionLine(ins: Trace['instructions'][number]): string {
  return ins.dest
    ? `${ins.op} ${ins.dest}, ${ins.args.join(', ')}`
    : `${ins.op} ${ins.args.join(', ')}`
}

/**
 * Every lexeme the real Mini-C tokeniser accepts, by page token class. The
 * classes follow the groups in lexer/Token.java's Category enum (coursework
 * compiler); `.` (its own "struct member access" group there) sits with the
 * operators. The lexer itself gives each lexeme its own category (PLUS, SC,
 * ...), so these groups are for reading, not something it outputs.
 */
export const LEXEMES = {
  type: ['int', 'void', 'char'],
  keyword: [
    'if',
    'else',
    'while',
    'return',
    'struct',
    'sizeof',
    'continue',
    'break',
    'class',
    'extends',
    'new',
    '#include',
  ],
  operator: ['+', '-', '*', '/', '%', '&', '.'],
  comparison: ['==', '!=', '<', '>', '<=', '>='],
  logical: ['&&', '||'],
  delimiter: ['{', '}', '(', ')', '[', ']', ';', ','],
  assign: ['='],
  // No fixed list: the token's pattern, as a regex of Token.java's rule.
  identifier: ['[A-Za-z_][A-Za-z0-9_]*'],
  number: ['[0-9]+'],
  // (the compiler files these under the number kind; tokenKind splits them)
  string: [String.raw`"(\\.|[^"\\])*"`],
  character: [String.raw`'(\\.|[^'\\])'`],
} satisfies Record<string, string[]>

export type TokenClass = keyof typeof LEXEMES

export type Slide = {
  title: string
  body: string
  /** Pairs shown as a small table under the body. */
  table?: [string, string][]
  /** The table's column headings; lexeme and category by default. */
  head?: [string, string]
  /** About the live-range bars, which only the real compiler's traces draw. */
  lanes?: true
}

/**
 * Text-only slides that open a phase. They sit just before the phase's first
 * step (the lexer's between the welcome and the first token), so stepping
 * walks through them and playing skips them.
 */
export const PHASE_SLIDES: Partial<Record<Frame['phase'], Slide[]>> = {
  Tokens: [
    {
      title: 'Where do we start?',
      body:
        'Before anything else, the compiler scans through the source code, ' +
        'character by character, and outputs a stream of **tokens**. Each ' +
        'token consists of the lexeme plus the syntactic category it belongs to:',
      table: [
        ['int', 'type'],
        ['return', 'keyword'],
        ['x', 'identifier'],
      ],
    },
  ],
  Parse: [
    {
      title: 'Toking (Abstract Syntax) Trees',
      body:
        "Great. Now what? As you can imagine, this isn't enough to output " +
        'machine code. To get us one step closer, the **Parser** takes the ' +
        'stream of tokens and transforms into a form that later passes of ' +
        'the compiler can easily walk through with the meaning of the ' +
        'program encoded into the structure of the tree itself!',
    },
    {
      title: 'The Problem with Precedence',
      body:
        'This solves interesting problems like precedence. How do you make ' +
        "sure the code that is generated correctly PEMDAS's something like " +
        '`2 - 4 * 2`? If you just generated code left to right, you run into ' +
        'issues like `(2 - 4) * 2`. Continue to see how an AST fixes that.',
    },
    {
      title: 'The Problem with Precedence',
      // Stanley's aside; the parenthetical, "infix" and the last clause are
      // filled in at his request.
      body:
        'Aside: My IRL implementation uses a handwritten recursive-descent ' +
        'parser (meaning each rule of the grammar is its own function, ' +
        'which calls the functions for the rules inside it), but when ' +
        'dealing with infix expressions, I shift to a ' +
        '[Pratt parser](https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html) ' +
        'implementation, which uses a *precedence table* to give each ' +
        'operator a binding power, so tighter operators like `*` end up ' +
        'deeper in the tree than looser ones like `+`, and get computed first.',
    },
  ],
  // The real SemanticAnalyzer runs NameAnalyzer, then TypeAnalyzer; the type
  // slide opens the second pass (STEP_SLIDES).
  Check: [
    {
      title: 'Correct Grammar, Wrong Program',
      // Stanley's copy; "out" read "our", and the list follows the real
      // pass order at his request.
      body:
        "Now that we've made our AST, how do we know it actually represents " +
        'a well-formed program? Just because it adheres structurally to ' +
        'proper grammar, it could still be meaningless (`x = "hello" * true;`, ' +
        "calling a function that doesn't exist, `break` outside a loop). This " +
        'phase will check for well-formed programs by conducting semantic ' +
        'analysis, name resolution and scoping, and type analysis.',
    },
    {
      title: 'Semantic Analysis',
      body:
        "Semantic analysis finds everything the grammar can't express, and " +
        'it enriches the AST with the information later phases need.',
    },
    {
      title: 'Name Resolution and Scoping',
      body:
        'First pass: the compiler walks the tree with a **symbol table**, ' +
        'opening a new scope for each function and block. Each declaration ' +
        'goes into the current scope, and each use of a name is linked to the ' +
        'nearest declaration it can see. A name with no declaration, or one ' +
        'declared twice in the same scope, is an error.',
    },
  ],
  // Draft copy, for Stanley to rewrite.
  Emit: [
    {
      title: 'Code Generation',
      body:
        'The tree is checked, so the compiler can finally write code. It ' +
        'walks the tree one last time and emits **MIPS assembly** for each ' +
        'node: an expression leaves its value in a register, and a statement ' +
        'strings those together with loads, stores and jumps.',
    },
    {
      title: 'Skipping the Fine Print',
      body:
        'Real assembly carries a lot of bookkeeping, so we sweep over it for ' +
        'now. Every value gets a fresh **virtual register**, as if the ' +
        'machine had as many as we like, and saving and restoring registers ' +
        "around a function is left as two placeholders. We'll add the " +
        'details back a block at a time as we go, and the register allocator ' +
        'fills in the rest next.',
      head: ['written', 'stands for'],
      table: [
        ['v0, v1, …', 'a virtual register'],
        ['pushRegisters', 'save registers in use'],
        ['popRegisters', 'restore them'],
      ],
    },
  ],
  // Draft copy, for Stanley to rewrite. The graph colouring and Chaitin
  // slides open their steps (STEP_SLIDES); the liveness slides
  // follow the Opus liveness answer (docs/handoffs, 2026-09-24).
  Registers: [
    {
      title: 'Register Allocation',
      body:
        'The code so far uses a fresh virtual register for every value, and ' +
        'even a short loop runs into the dozens. The machine has 18 we can ' +
        'hand out (`$t0`–`$t9` and `$s0`–`$s7`). The **register allocator** ' +
        'maps each virtual register onto a real one. Two values can share a ' +
        "register as long as they're never needed at the same time; when " +
        "they can't all fit, some are **spilled** to memory, which costs a " +
        'load or store every time they are used.',
    },
    {
      title: 'Liveness',
      lanes: true,
      // DRAFT copy (2026-09-28): the sweeps that work liveness out are
      // skipped, so this points at the bars emit already drew.
      body:
        "A value is **live** from where it's written to the last place it's " +
        'read: the bars beside the code are those lives. Two values can ' +
        'share a register only if their bars never overlap.',
    },
  ],
}

/**
 * Slides that open a pass partway through a phase. Each sits on the frame
 * before the first one `starts` picks, and only if there is one: a program
 * that fails name resolution never reaches the type slide.
 */
export const STEP_SLIDES: {
  phase: Frame['phase']
  starts: (frame: Frame, previous: Frame) => boolean
  slides: Slide[]
}[] = [
  {
    phase: 'Check',
    starts: (frame, previous) =>
      [
        'check.type',
        'check.expr',
        'check.fits',
        'check.typeError',
        'check.typesDone',
      ].includes(frame.why.kind) && previous.why.kind === 'check.namesDone',
    slides: [
      {
        title: 'Type Analysis',
        body:
          'Second pass: with every name linked to its declaration, the ' +
          "compiler works out each expression's type from the bottom up and " +
          "checks it fits where it's used: `*` needs `int` operands, a call's " +
          "arguments must match the function's parameters, and `return` must " +
          "match the function's return type. It also catches `break` and " +
          '`continue` outside a loop.',
      },
    ],
  },
  {
    phase: 'Registers',
    // The first interference graph: Registers opens on it (the liveness
    // sweeps are left out, regs-view.ts withoutLiveness).
    starts: (frame) => frame.why.kind === 'reg.interfere',
    slides: [
      {
        title: 'Graph Colouring',
        body:
          'Two values that are live at the same time **interfere**: they ' +
          "can't share a register. Draw each virtual register as a node and " +
          'join every pair that interferes, and allocation becomes a ' +
          'colouring puzzle: give each node one of 18 colours so that no two ' +
          'joined nodes match. Finding the fewest colours is NP-hard, so ' +
          'compilers use a fast heuristic instead.',
      },
    ],
  },
  {
    phase: 'Registers',
    starts: (frame, previous) =>
      frame.why.kind === 'reg.simplify' &&
      previous.why.kind === 'reg.interfere',
    slides: [
      {
        title: 'Set Aside the Easy Ones',
        body:
          'This is **Chaitin’s** heuristic. A node with fewer than 18 ' +
          'neighbours can always be coloured later: even if every neighbour ' +
          'gets a different register, one of the 18 is left for it. So the ' +
          'allocator sets it aside and takes its edges out of the graph, ' +
          'which lowers its neighbours’ counts and makes more of them easy. ' +
          'Each node set aside is numbered by when it went: the numbers are ' +
          'its place on a stack.',
      },
    ],
  },
  {
    phase: 'Registers',
    starts: (frame) => frame.why.kind === 'reg.spillCandidate',
    slides: [
      {
        title: 'When None Is Easy',
        body:
          'Sometimes every node left has 18 or more neighbours. The ' +
          'allocator sets one aside anyway, the one with the most edges, ' +
          'as a **spill candidate**. It may still get a register: if its ' +
          'neighbours end up sharing a few, one is left over (Briggs’s ' +
          'optimistic twist on Chaitin).',
      },
    ],
  },
  {
    phase: 'Registers',
    starts: (frame) => frame.why.kind === 'reg.select',
    slides: [
      {
        title: 'Colour in Reverse',
        body:
          'Now the stack comes back off, highest number first, and each ' +
          "node takes the first register its neighbours aren't using. " +
          'Reversing is what keeps the promise: a node comes back to the ' +
          'same neighbours it had when it was set aside, fewer than 18, so ' +
          'a register is always free. A spill candidate is the one ' +
          'exception, and a candidate that finds none is **spilled** to ' +
          'memory.',
      },
    ],
  },
  {
    phase: 'Registers',
    starts: (frame) => frame.why.kind === 'reg.done',
    slides: [
      {
        title: 'Why It Pays Off',
        body:
          'Registers are the fastest storage the processor has; memory is ' +
          'many times slower. By letting values that are never live together ' +
          'share a register, dozens of virtual registers fit in a handful of ' +
          'real ones, so the program keeps its working values out of memory. ' +
          'The placeholders expand too: `pushRegisters` becomes one save for ' +
          'each real register in use, not all 18.',
      },
    ],
  },
  // DRAFT copy: only programs whose 18-colour attempt spills reach it.
  {
    phase: 'Registers',
    starts: (frame) => frame.why.kind === 'reg.retry',
    slides: [
      {
        title: 'Spilling',
        body:
          'A spilled value lives in a word of memory in `.data`. Before a ' +
          'line reads it, the allocator loads it into a register; after a ' +
          'line writes it, it stores it back. Those loads and stores need ' +
          'registers of their own, so when the first attempt spills, the ' +
          'allocator throws that colouring away and starts over with 16 ' +
          'colours, keeping `$t8` and `$t9` free for spill code.',
      },
    ],
  },
]

/** The type a node was given, as the frames record it. */
const typeOf = (trace: Trace, id: number): string | undefined => {
  for (const f of trace.frames) {
    const w = f.why
    if (w.kind === 'check.type' && w.node === id) return w.type
    if ('typed' in w) {
      const t = w.typed.find(([n]) => n === id)
      if (t) return t[1]
    }
  }
  return undefined
}

/** A register's place on the allocator's stack: pushes up to its step. */
const pushNumber = (steps: readonly { op: string }[], step: number): number =>
  steps
    .slice(0, step + 1)
    .filter((s) => s.op === 'simplify' || s.op === 'spillCandidate').length

/** A token's class as shown on the page; "name" reads as "identifier". */
export const tokenKind = (token: Token): TokenClass => {
  if (token.kind === 'name') return 'identifier'
  if (token.kind === 'number')
    return token.text.startsWith('"')
      ? 'string'
      : token.text.startsWith("'")
        ? 'character'
        : 'number'
  if (token.kind === 'keyword')
    return LEXEMES.type.includes(token.text) ? 'type' : 'keyword'
  if (token.kind !== 'symbol') return token.kind
  const group = (Object.keys(LEXEMES) as TokenClass[]).find((c) =>
    LEXEMES[c].includes(token.text),
  )
  return group ?? 'operator'
}

/** The lexemes in a token's page class. */
export const lexemesOf = (token: Token) => LEXEMES[tokenKind(token)]

// A node's card, as a token's: its class in the grammar, opening to the
// kinds in that class (the compiler's Decl, Stmt and Expr subclasses, in
// its src/java/ast).
export const NODE_KINDS = {
  global: ['global'],
  declaration: [
    'variable',
    'field',
    'function',
    'prototype',
    'struct',
    'class',
  ],
  statement: [
    'block',
    'while',
    'if',
    'return',
    'continue',
    'break',
    'expression',
  ],
  expression: [
    'number',
    'character',
    'string',
    'name',
    'call',
    'operator',
    'assignment',
    'index',
    'field',
    'value at',
    'address of',
    'sizeof',
    'cast',
    'new',
    'method call',
  ],
}
type NodeClass = keyof typeof NODE_KINDS

// ParseTrace.java names what it collapses by class (older traces also a
// struct or class, `StructTypeDecl s`; now `struct s { }`, `class C { }`):
// `FunDecl f`, `ArrayAccess`, `FieldAccess .x`, and so on.
const DECL_KINDS: Record<string, string> = {
  StructTypeDecl: 'struct',
  FunDecl: 'prototype',
  ClassDecl: 'class',
}
const EXPR_KINDS: Record<string, string> = {
  ArrayAccess: 'index',
  FieldAccess: 'field',
  ValueAt: 'value at',
  AddressOf: 'address of',
  SizeOf: 'sizeof',
  Typecast: 'cast',
  NewInstance: 'new',
  new: 'new',
  InstanceFunCall: 'method call',
}

/** A class's declaration: `class C { }`, or `ClassDecl C` in older traces. */
export const isClassDecl = (label: string) =>
  label.startsWith('ClassDecl ') ||
  (label.startsWith('class ') && label.endsWith(' { }'))

/** A node's class and its kind within it. */
// A struct's fields are its children (ParseTrace), declared in its scope.
export const structOf = (trace: Trace, node: AstNode) =>
  node.kind === 'declare'
    ? trace.nodes.find(
        (p) =>
          p.kind === 'declare' &&
          p.label.startsWith('struct ') &&
          p.label.endsWith(' { }') &&
          p.children.includes(node.id),
      )
    : undefined

/** What a node is; with the trace, a struct's field is told from a variable. */
export function nodeKind(
  node: AstNode,
  trace?: Trace,
): { cls: NodeClass; kind?: string } {
  if (trace && structOf(trace, node))
    return { cls: 'declaration', kind: 'field' }
  switch (node.kind) {
    case 'program':
      return { cls: 'global', kind: 'global' }
    case 'function':
      return { cls: 'declaration', kind: 'function' }
    case 'declare':
      return {
        cls: 'declaration',
        // (`struct Point { }` is the type; `struct Point p`, a variable)
        kind: isClassDecl(node.label)
          ? 'class'
          : node.label.endsWith(' { }')
            ? 'struct'
            : (DECL_KINDS[node.label.split(' ')[0]] ?? 'variable'),
      }
    case 'block':
    case 'while':
    case 'if':
    case 'return':
      return { cls: 'statement', kind: node.kind }
    case 'statement':
      return {
        cls: 'statement',
        kind: node.label === 'expr' ? 'expression' : node.label,
      }
    case 'number':
      return {
        cls: 'expression',
        kind: node.label.startsWith("'")
          ? 'character'
          : node.label.startsWith('"')
            ? 'string'
            : 'number',
      }
    case 'name':
      return { cls: 'expression', kind: 'name' }
    case 'call':
      return { cls: 'expression', kind: 'call' }
    case 'assign':
      return { cls: 'expression', kind: 'assignment' }
    case 'binary':
      return {
        cls: 'expression',
        kind: node.label === '=' ? 'assignment' : 'operator',
      }
    case 'unary':
      return { cls: 'expression', kind: 'operator' }
    default:
      return {
        cls: 'expression',
        // (ParseTrace labels these as C writes them: `*p`, `&x`, `(char*)`,
        // `.x`, `[]`, `new`, `.` over a method call; older traces by class,
        // `ValueAt`)
        kind:
          node.label === '*'
            ? 'value at'
            : node.label === '&'
              ? 'address of'
              : node.label === '[]'
                ? 'index'
                : node.label.startsWith('(')
                  ? 'cast'
                  : node.label === '.'
                    ? 'method call'
                    : node.label.startsWith('.')
                      ? 'field'
                      : EXPR_KINDS[node.label.split(' ')[0]],
      }
  }
}

type Match = 'exact' | 'prefix' | 'none'

/**
 * How the characters read so far sit against each class's lexemes. While a
 * token is still being read, everything it could become is a possible match
 * (`prefix`): the lexemes that start with what was read, and identifier or
 * number while the tokeniser is reading a word or a number (`reader`, its
 * recorded decision on the token's first character). With `final`, on the
 * step that settles the token, only the class it became is `exact`.
 */
const PATTERN_READERS = {
  identifier: 'word',
  number: 'number',
  string: 'string',
  character: 'char',
} satisfies Partial<Record<TokenClass, LexDecision>>

export function matchTable(
  read: string,
  reader?: LexDecision,
  final?: TokenClass,
) {
  return (Object.keys(LEXEMES) as TokenClass[]).map((cls) => {
    // identifiers, numbers and literals list a pattern, not lexemes: they
    // match while the tokeniser reads with that reader
    const rule = cls in PATTERN_READERS
    const lexemes = LEXEMES[cls].map((text) => {
      const whole = rule
        ? reader === PATTERN_READERS[cls as keyof typeof PATTERN_READERS]
        : text === read
      const match: Match =
        final !== undefined
          ? cls === final && whole
            ? 'exact'
            : 'none'
          : whole || (!rule && text.startsWith(read))
            ? 'prefix'
            : 'none'
      return { text, match }
    })
    const match: Match = lexemes.some((l) => l.match === 'exact')
      ? 'exact'
      : lexemes.some((l) => l.match === 'prefix')
        ? 'prefix'
        : 'none'
    return { cls, rule, lexemes, match }
  })
}

const article = (cls: string) => (/^[aeiou]/.test(cls) ? 'an ' : 'a ') + cls
const joinOr = (items: string[]) =>
  items.length > 1
    ? `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`
    : items[0]

const NEXT_NAMES: Record<string, string> = {
  ' ': 'a space',
  '\n': 'a newline',
  '\t': 'a tab',
  '': 'the end of the file',
}

// The tokeniser's decisions that settle a token: after them it is complete.
const SETTLES: ReadonlySet<LexDecision> = new Set([
  'single',
  'second',
  'close',
  'end',
  'unterminated',
  'invalid',
])

/**
 * Where a detailed-lexer step stands: the characters read so far, the kind
 * of token the tokeniser set out to read, what it decided at this character
 * and, on the step that settles the token, the class it became.
 */
export function lexState(trace: Trace, w: Extract<Why, { kind: 'lex.char' }>) {
  const token = trace.tokens[w.token]
  const r = token.reads?.[w.read]
  const does = r && 'does' in r ? r.does : undefined
  const look = !!(r && 'does' in r && r.look)
  const text = trace.text ?? ''
  return {
    token,
    read: text.slice(token.start, look ? w.at : w.at + 1),
    char: text[w.at] ?? '',
    reader: readerOf(token),
    does,
    look,
    final: does && SETTLES.has(does) ? tokenKind(token) : undefined,
  }
}

function readStep(trace: Trace, w: Extract<Why, { kind: 'lex.char' }>) {
  const { token, read, char, reader, does, look, final } = lexState(trace, w)
  const next = NEXT_NAMES[char] ?? code(char)
  const literal = reader === 'char' ? 'character' : 'string'
  // DRAFT copy: every sentence here but the `end` case's and the two at the
  // bottom, which the span-replayed steps already had.
  switch (does) {
    case 'end': {
      let text = `The next character, ${next}, can't extend ${code(read)}, so the token ends here as ${article(final ?? 'token')}.`
      if (reader === 'word' && final !== 'identifier')
        text += ` Words on the ${final} list win over identifiers.`
      return text
    }
    case 'single':
    case 'second':
      return `Nothing longer starts with ${code(read)}, so the token ends here as ${article(final ?? 'token')}${does === 'single' ? ', without a look at the next character' : ''}.`
    case 'string':
    case 'char':
      return `${code(char)} opens a ${literal}: everything up to the closing ${code(char)} belongs to it.`
    case 'escape':
      return 'A backslash starts an escape: the character after it says which one.'
    case 'escaped':
      return `${code('\\' + char)} is an escape Mini-C knows, and stands for one character.`
    case 'bad escape':
      return `${code('\\' + char)} is not an escape Mini-C knows.`
    case 'bad char':
      return `This character can't appear inside a ${literal}.`
    case 'close':
      return `The closing ${code(char)} ends the ${literal}.`
    case 'unterminated':
      // DRAFT copy (the file's end)
      return `The ${trace.text !== undefined && token.end >= trace.text.length ? 'file' : 'line'} ends before the closing ${code(token.text[0])}, so the ${literal} is never closed.`
    case 'invalid': {
      if (!look) return `${code(char)} can't begin any Mini-C token.`
      const longer = Object.values(LEXEMES)
        .flat()
        .filter((l: string) => l !== read && l.startsWith(read))
      return `${code(read)} only begins ${joinOr(longer.map(code))}, and the next character, ${next}, doesn't finish it.`
    }
  }
  if (does === 'continue' && (reader === 'string' || reader === 'char'))
    return `${code(char)} is inside the ${literal}, so it is taken as it is.`
  const fits = matchTable(read, reader)
    .filter((r) => r.match !== 'none')
    .map((r) =>
      r.rule
        ? article(r.cls)
        : `${r.cls} ${r.lexemes
            .filter((l) => l.match !== 'none')
            .map((l) => code(l.text))
            .join(', ')}`,
    )
  const text =
    fits.length > 0
      ? `${code(read)} could still become ${joinOr(fits)}.`
      : `${code(read)} is not in any table yet; it is part of ${article(tokenKind(token))}.`
  return does === 'slash'
    ? `${text} A second \`/\` or a \`*\` would start a comment instead.` // DRAFT copy
    : text
}

// The real lexer and parser print their errors rather than record them
// ("Parsing error: expected (SC|COMMA) found (ASSIGN) at 2:9"); browser/
// BrowserTrace.java hands that log back. Read its first error as a sentence,
// pointing at the token it names.
const CATEGORY_TEXT: Record<string, string> = {
  IDENTIFIER: 'a name',
  INT_LITERAL: 'a number',
  CHAR_LITERAL: 'a character',
  STRING_LITERAL: 'a string',
  EOF: 'the end of the program',
  ASSIGN: '`=`',
  LBRA: '`{`',
  RBRA: '`}`',
  LPAR: '`(`',
  RPAR: '`)`',
  LSBR: '`[`',
  RSBR: '`]`',
  SC: '`;`',
  COMMA: '`,`',
  INCLUDE: '`#include`',
  LOGAND: '`&&`',
  LOGOR: '`||`',
  EQ: '`==`',
  NE: '`!=`',
  LT: '`<`',
  GT: '`>`',
  LE: '`<=`',
  GE: '`>=`',
  PLUS: '`+`',
  MINUS: '`-`',
  ASTERISK: '`*`',
  DIV: '`/`',
  REM: '`%`',
  AND: '`&`',
  DOT: '`.`',
  INVALID: 'an unknown character',
}
// Keywords and types print as their own word: INT is `int`.
const categoryText = (cat: string) =>
  CATEGORY_TEXT[cat] ?? (/^[A-Z]+$/.test(cat) ? code(cat.toLowerCase()) : cat)

export function compilerError(
  log: string,
  source: string,
): (Span & { message: string }) | undefined {
  const line = log
    .split('\n')
    .find((l) => /^(Lexing|Parsing) error:/.test(l))
    ?.trim()
  if (!line) return undefined
  const at = /at (\d+):(\d+)/.exec(line)
  const row = at ? Number(at[1]) : undefined
  const lineStart =
    row === undefined
      ? 0
      : source
          .split('\n')
          .slice(0, row - 1)
          .join('\n').length + (row > 1 ? 1 : 0)
  const where = row === undefined ? '' : ` on line ${row}`
  // Columns are 1-based, but tolerate 0-based, as ParseTrace does.
  const spanOf = (text: string) => {
    if (!at) return { start: 0, end: source.length }
    const col = Number(at[2])
    const start = [col - 1, col]
      .map((c) => lineStart + c)
      .find((s) => text !== '' && source.startsWith(text, s))
    if (start === undefined) {
      const s = Math.min(source.length, lineStart + Math.max(0, col - 1))
      return { start: s, end: Math.min(source.length, s + 1) }
    }
    return { start, end: start + text.length }
  }
  const parse =
    /^Parsing error: expected \((.*)\) found \((\w+)(?:\((.*)\))?\)/.exec(line)
  if (parse) {
    const [, expected, cat, data] = parse
    const found =
      cat === 'EOF'
        ? 'the end of the program'
        : data !== undefined
          ? code(data)
          : categoryText(cat)
    const text =
      cat === 'EOF'
        ? ''
        : (data ?? CATEGORY_TEXT[cat]?.replace(/`/g, '') ?? cat.toLowerCase())
    const span =
      cat === 'EOF'
        ? { start: source.length, end: source.length }
        : spanOf(text)
    return {
      ...span,
      message: `Expected ${joinOr(expected.split('|').map(categoryText))} but found ${found}${where}.`,
    }
  }
  const unknown = /^Lexing error: unrecognised character \((.)\)/.exec(line)
  if (unknown)
    return {
      ...spanOf(unknown[1]),
      message: `${code(unknown[1])} isn't a character Mini-C knows${where}.`,
    }
  // Anything else: the compiler's own words, without the prefix or position.
  const rest = line
    .replace(/^(Lexing|Parsing) error:\s*/, '')
    .replace(/\s*(at\s*)?\d+:\d+$/, '')
  return {
    ...spanOf(''),
    message: `${rest.charAt(0).toUpperCase()}${rest.slice(1)}${where}.`,
  }
}
