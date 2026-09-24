// Sentences for the step popup and the hover cards. Every template is filled
// from trace data, so the same wording serves presets and typed programs.
// Backticks mark code spans; the page renders them as <code>.
import { instructionText } from './trace'

import type {
  AstNode,
  Frame,
  Instruction,
  Span,
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
}

const code = (s: string) => `\`${s}\``

const text = (trace: Trace, span: Span) =>
  (trace.text ?? '').slice(span.start, span.end)

const line = (trace: Trace, span: Span) =>
  (trace.text ?? '').slice(0, span.start).split('\n').length

/** What a node is, in words: "multiplication", "integer literal", ... */
export function describe(node: AstNode): string {
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
export function tokenRole(token: Token): string {
  if (token.kind === 'keyword')
    return KEYWORD_ROLES[token.text] ?? 'is a keyword with a fixed meaning'
  if (token.kind === 'name') return 'is an identifier'
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
export function explain(trace: Trace, frame: Frame): string {
  const w: Why = frame.why
  const node = (id: number) => trace.nodes[id]
  const src = (id: number) => code(text(trace, node(id)))
  switch (w.kind) {
    case 'ready':
      return 'Step through to watch the source become a tree, then instructions.'
    case 'token': {
      // The token is in the header; the body names its class above the list.
      const kind = tokenKind(trace.tokens[w.token])
      return kind[0].toUpperCase() + kind.slice(1)
    }
    case 'parse.read': {
      const t = trace.tokens[w.token]
      return `${code(t.text)} ${tokenRole(t)}. No node is built from it alone.`
    }
    case 'parse.node': {
      const n = node(w.node)
      switch (n.kind) {
        case 'number':
          return `${code(n.label)} becomes an integer literal node. A literal is complete on its own.`
        case 'name':
          return `${code(n.label)} becomes a name reference. Which declaration it means is settled later, in check.`
        case 'declare':
          return `${code(text(trace, n))} declares ${code(trace.tokens[n.token].text)}. Nothing is computed here; it only creates a name.`
        case 'return':
          return 'A return node opens. It stays dashed until its value is read.'
        case 'assign':
          return `An assignment into ${code(trace.tokens[n.token].text)} opens. It stays dashed until the value on the right is read.`
        case 'function':
          return `${code(n.label)} becomes a function node. Its parameters and body come next.`
        case 'block':
          return 'A block opens: declarations first, then statements.'
        case 'while':
          return 'A while node opens. It needs a condition and a body.'
        case 'if':
          return 'An if node opens. It needs a condition and one or two branches.'
        case 'call':
          return `A call to ${code(trace.tokens[n.token].text)} opens. Its arguments are read next.`
        case 'unary':
          return `${code(n.label)} in front of a value is negation. It needs one operand.`
        case 'program':
          return 'The program is a list of declarations, read one after another.'
        default:
          return `${code(n.label)} becomes a ${describe(n)} node.`
      }
    }
    case 'parse.take':
      return `${src(w.child)} becomes the ${roleWord[w.role] ?? w.role} of ${code(node(w.parent).label)}.`
    case 'parse.wait': {
      const op = node(w.node)
      return `${code(op.label)} takes ${src(w.child)} as its left input and now needs the right one. Until then it is dashed.`
    }
    case 'parse.precedence': {
      const child = src(w.child)
      if (w.relation === 'tighter')
        return `${code(w.incoming)} binds tighter than ${code(w.pending)}, so ${child} joins ${code(w.incoming)} first. ${code(w.pending)} keeps waiting.`
      if (w.relation === 'equal')
        return `Two ${code(w.pending)} in a row bind equally. The earlier one closes first, so grouping runs left to right.`
      return `${code(w.incoming)} binds less tightly than ${code(w.pending)}, so ${code(w.pending)} closes first. Its result becomes the left input of ${code(w.incoming)}.`
    }
    case 'parse.group':
      return w.state === 'open'
        ? 'The parenthesis opens a group. Everything inside finishes before anything outside can see it.'
        : `${code(text(trace, w.span))} is one piece now and can be an input like any literal.`
    case 'parse.close': {
      const n = node(w.node)
      const kids = n.children.map(src)
      switch (n.kind) {
        case 'binary':
          return `${code(n.label)} now holds both inputs, ${kids[0]} and ${kids[1]}. Its result is ${src(w.node)}.`
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
          return `${code(n.label)} is complete. Its body holds ${kids.length} ${kids.length === 1 ? 'item' : 'items'}.`
        case 'block':
          return `The block closes with ${kids.length} ${kids.length === 1 ? 'item' : 'items'} inside.`
        case 'while':
          return 'The loop closes over its condition and body.'
        case 'if':
          return 'The if closes over its condition and branches.'
        case 'call':
          return kids.length
            ? `The call to ${code(trace.tokens[n.token].text)} has its ${kids.length === 1 ? 'argument' : 'arguments'} ${kids.join(', ')}.`
            : `The call to ${code(trace.tokens[n.token].text)} takes no arguments.`
        case 'program':
          return 'Every declaration has been read.'
        default:
          return `${code(n.label)} closes.`
      }
    }
    case 'parse.done':
      return `The tree is complete: ${trace.nodes.length} nodes for the whole program. Nothing has run; this is only structure.`
    case 'check.resolve': {
      const use = node(w.use),
        decl = node(w.decl)
      const name = trace.tokens[use.token].text
      if (use.kind === 'call')
        return `${code(name + '()')} calls the function ${code(decl.label)} defined ${w.where}.`
      const where =
        w.where === 'param'
          ? 'in the parameters'
          : `on line ${line(trace, decl)}`
      return `This ${code(name)} refers to ${code(text(trace, decl))} ${where}.`
    }
    case 'check.unresolved': {
      const use = node(w.use)
      return `No declaration is visible for ${code(trace.tokens[use.token].text)}, so the compiler cannot say what it means. It stops here.`
    }
    case 'check.builtin': {
      const use = node(w.use)
      return `${code(trace.tokens[use.token].text + '()')} is a built-in function. No declaration in this file is needed.`
    }
    case 'check.type': {
      const n = node(w.node)
      if (n.kind === 'declare')
        return `${code(trace.tokens[n.token].text)} is declared with type ${code(w.type)}. Later uses must agree with it.`
      return w.expected
        ? `The return expression has type ${code(w.type)}, matching the function's ${code(w.expected)}.`
        : `${src(w.node)} has type ${code(w.type)}.`
    }
    case 'check.namesDone':
      return w.unresolved === 0
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
      return explainMips(trace, n, run)
    }
    case 'emit.prologue': {
      const n = node(w.node)
      const run = trace.instructions.slice(w.from, w.to + 1)
      const room = run.find((i) => /^addiu? \$sp,\$sp,-/.test(i.text ?? ''))
      const bytes = room ? Number(room.text?.split(',').pop()) * -1 : 0
      const saveRa = run.some((i) => i.text?.startsWith('sw $ra'))
      return `Before its body, ${code(n.label)} builds a stack frame: it saves the caller's frame pointer, points ${code('$fp')} at this frame${saveRa ? ', keeps the return address' : ''}${bytes ? `, and reserves ${bytes} bytes for locals` : ''}. Nothing here comes from your code.`
    }
    case 'emit.epilogue': {
      const n = node(w.node)
      const run = trace.instructions.slice(w.from, w.to + 1)
      const exits = run.some((i) => i.op === 'syscall')
      return `${code(n.label)} is done. It puts ${code('$sp')} and ${code('$fp')} back the way the caller left them, then ${exits ? 'exits with a system call' : `jumps back to the caller with ${code('jr $ra')}`}.`
    }
    case 'emit.value':
      return `${code(node(w.node).label)} already lives in ${code(w.v)} from its assignment, so no instruction is needed.`
    case 'reg.assign':
      return `${code(w.v)} gets ${code(w.r)}, which nothing else holds at this point.`
    case 'reg.reuse':
      return `${code(w.r)} is free again: ${code(w.prevV)} was read for the last time by instruction ${w.diedAt + 1}, so ${code(w.v)} can take it.`
    case 'reg.cfg': {
      const f = trace.backend?.functions[w.fn]
      if (!f) return 'Each instruction is a block in the control-flow graph.'
      if (w.back.length === 0)
        return `Each instruction is a block in the control-flow graph. ${code(f.name)} is a straight line: control only flows downwards, so every value's life is one span of lines.`
      const [from, to] = w.back[0]
      const jump = trace.instructions[f.first + from]
      return `Each instruction is a block in the control-flow graph. ${code(jump?.text ?? 'j')} on line ${f.first + from + 1} goes back to line ${f.first + to + 1}: that back edge is what makes the loop a loop, and liveness must follow it.`
    }
    case 'reg.live':
      if (w.sweep === 1)
        return `Liveness walks the instructions backwards. A register is live from the line that defines it to the last line that reads it. One pass fills ${w.changed} sets.`
      if (w.changed === 0)
        return 'A pass that changes nothing means the sets are stable. Liveness is done.'
      return `The back edge carries what the loop reads round again, so ${w.changed} sets grow on this pass. Values read at the top of the loop stay live through its body.`
    case 'reg.interfere':
      return `Two registers interfere when they are live at the same time: they cannot share a real register. ${w.nodes} virtual registers, ${w.edges} ${w.edges === 1 ? 'overlap' : 'overlaps'}${w.busiest ? `; ${code(w.busiest)} overlaps the most, with ${w.degree}` : ''}.`
    case 'reg.simplify': {
      const st = trace.backend?.functions[w.fn]?.colouring.steps[w.step]
      const k = trace.backend?.k ?? 0
      if (!st) return 'A register with few neighbours is set aside.'
      if (!st.degree)
        return `${code(st.vr)} overlaps nothing that is still in the graph, so any register will do. It is set aside on a stack.`
      return `${code(st.vr)} overlaps ${st.degree} ${st.degree === 1 ? 'other' : 'others'}, fewer than the ${k} registers available, so it is sure to get one. It is set aside on a stack and its edges come off the graph.`
    }
    case 'reg.spillCandidate': {
      const st = trace.backend?.functions[w.fn]?.colouring.steps[w.step]
      return `Every remaining register overlaps ${trace.backend?.k ?? 'k'} or more others. ${code(st?.vr ?? '')} has the most edges, so it is set aside as the one that may have to spill.`
    }
    case 'reg.select': {
      const st = trace.backend?.functions[w.fn]?.colouring.steps[w.step]
      if (!st) return 'A register comes off the stack and takes a colour.'
      const forbidden = st.forbidden ?? []
      if (forbidden.length === 0)
        return `${code(st.vr)} comes off the stack. None of its neighbours holds a register yet, so it takes the first one, ${code(st.colour ?? '')}.`
      return `${code(st.vr)} comes off the stack. Its neighbours hold ${forbidden.map(code).join(', ')}, so it takes the next free one, ${code(st.colour ?? '')}.`
    }
    case 'reg.spill': {
      const st = trace.backend?.functions[w.fn]?.colouring.steps[w.step]
      return `${code(st?.vr ?? '')} comes off the stack and finds every register taken by a neighbour. It lives in memory instead: loads and stores are added around each use.`
    }
    case 'reg.done':
      if (w.fn === undefined)
        return 'Every temporary now has a physical register. Reuse kept the count small.'
      return `${w.used} real ${w.used === 1 ? 'register' : 'registers'} cover every virtual one${w.spills ? `, with ${w.spills} spilled to the stack` : ''}. Values that never overlap share a register.`
  }
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
    case 'number':
      return `${line(first)} loads the literal ${code(n.label)} into ${code(first.dest ?? '')}, a fresh virtual register. There is no limit on these yet.`
    case 'name':
      if (ops.includes('lw'))
        return `${code(n.label)} lives in the stack frame. ${line(first)} works out its address and ${line(last)} loads the value into ${code(last.dest ?? '')}.`
      return `${line(first)} works out where ${code(n.label)} lives in the frame.`
    case 'binary': {
      const op = OP_NAMES[n.label] ?? 'the operation'
      if (ops.includes('mflo'))
        return `${line(first)} computes the ${op}. MIPS keeps the product in a special register, so ${line(last)} copies it into ${code(last.dest ?? '')}.`
      if (first.op === 'slt' || first.op === 'sltu')
        return `${line(first)} sets ${code(first.dest ?? '')} to 1 when ${code(first.args[0])} is below ${code(first.args[1])}, else 0. That value is what the loop tests.`
      return `${line(first)} does the ${op} of ${code(first.args[0])} and ${code(first.args[1])} into ${code(first.dest ?? '')}. Both inputs were computed on earlier lines: children come before parents.`
    }
    case 'assign':
      if (ops.includes('sw'))
        return `${line(last)} stores the value into ${code(name(n.label))}'s slot in the frame, at the address computed earlier.`
      return `The assignment needs the address of ${code(name(n.label))} before the value: ${line(first)} computes it, then the right-hand side is evaluated.`
    case 'return':
      return `${line(first)} writes the value into the frame's return slot, and ${line(last)} skips to the function's exit code.`
    case 'while':
      if (ops.includes('beqz'))
        return `${line(first)} leaves the loop when the condition is 0. Otherwise the body follows.`
      return `${line(first)} jumps back to the top to test the condition again.`
    default:
      return `${run.map(line).join(', ')} ${run.length === 1 ? 'is' : 'are'} emitted for ${src}.`
  }
}

/** Hover card for one emitted instruction. */
export function instructionHover(
  trace: Trace,
  ins: Instruction,
  live?: { in: string[]; out: string[] },
  registers?: Record<string, string>,
): string {
  const shown = code(instructionText(ins, registers).replace(/\s+/g, ' '))
  const from =
    ins.node === null
      ? ''
      : ` · from ${code(text(trace, trace.nodes[ins.node]).replace(/\s+/g, ' '))}`
  const def =
    ins.dest && /^v\d+$/.test(ins.dest) ? ` · defines ${code(ins.dest)}` : ''
  const uses = ins.args.filter((a) => /^v\d+$/.test(a))
  const reads = uses.length ? ` · reads ${uses.map(code).join(', ')}` : ''
  const liveText = live
    ? ` · live after: ${live.out.length ? live.out.map(code).join(' ') : 'nothing'}`
    : ''
  return `${shown}${from}${def}${reads}${liveText}`
}

/** Hover card for a node of the interference graph. */
export function registerHover(
  trace: Trace,
  fn: number,
  vr: string,
  colour?: string,
): string {
  const f = trace.backend?.functions[fn]
  const def = trace.instructions.find((i) => i.dest === vr)
  const holds =
    def && def.node !== null
      ? ` · holds ${code(text(trace, trace.nodes[def.node]).replace(/\s+/g, ' '))}`
      : ''
  const neighbours = (f?.interference.edges ?? [])
    .filter((e) => e.includes(vr))
    .map((e) => (e[0] === vr ? e[1] : e[0]))
  const overlaps = neighbours.length
    ? ` · overlaps ${neighbours.map(code).join(', ')}`
    : ' · overlaps nothing'
  return `${code(vr)}${holds}${overlaps}${colour ? ` · now ${code(colour)}` : ''}`
}

export function instructionLine(ins: Trace['instructions'][number]): string {
  return ins.dest
    ? `${ins.op} ${ins.dest}, ${ins.args.join(', ')}`
    : `${ins.op} ${ins.args.join(', ')}`
}

/**
 * Every lexeme the real Mini-C tokeniser accepts, by page token class (from
 * lexer/Token.java's Category enum in the coursework compiler).
 */
export const LEXEMES: Record<Token['kind'], string[]> = {
  keyword: [
    'int',
    'void',
    'char',
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
  symbol: [
    '=',
    '{',
    '}',
    '(',
    ')',
    '[',
    ']',
    ';',
    ',',
    '&&',
    '||',
    '==',
    '!=',
    '<',
    '>',
    '<=',
    '>=',
    '+',
    '-',
    '*',
    '/',
    '%',
    '&',
    '.',
  ],
  // No fixed list: the token's pattern, as a regex of Token.java's rule.
  name: ['[A-Za-z_][A-Za-z0-9_]*'],
  number: ['[0-9]+'],
}

/** A token's class as shown on the page; "name" reads as "identifier". */
export const tokenKind = (token: Token) =>
  token.kind === 'name' ? 'identifier' : token.kind

/** Hover card for a token that is not yet part of the tree. */
export function tokenHover(token: Token): string {
  const role =
    token.kind === 'keyword'
      ? (KEYWORD_ROLES[token.text] ?? 'a keyword with a fixed meaning').replace(
          /^is /,
          '',
        )
      : token.kind === 'number'
        ? token.text.length > 1
          ? `all ${token.text.length} digits are one number`
          : 'a single digit'
        : (SYMBOL_ROLES[token.text] ??
          (OP_NAMES[token.text]
            ? `${OP_NAMES[token.text]}, needs a value on each side`
            : 'punctuation'))
  const kind = tokenKind(token)
  return token.kind === 'name'
    ? `${code(token.text)} · ${kind}`
    : `${code(token.text)} · ${kind} · ${role}`
}

/** Hover card for a tree node, describing only what is attached so far. */
export function nodeHover(trace: Trace, frame: Frame, node: AstNode): string {
  const kids = node.children.filter((c) => frame.attached.includes(c))
  const missing = node.children.length - kids.length
  const held = kids.map((c) => code(text(trace, trace.nodes[c]))).join(', ')
  const what = `${code(node.label)} · ${describe(node)}`
  if (node.kind === 'number') return `${what} · complete`
  if (node.kind === 'name') {
    const link = (frame.links ?? []).find(([use]) => use === node.id)
    return link
      ? `${what} · refers to ${code(text(trace, trace.nodes[link[1]]))}`
      : `${what} · declaration not yet checked`
  }
  if (!node.children.length) return what
  if (missing > 0)
    return held
      ? `${what} · holds ${held} · still needs ${missing} more`
      : `${what} · waiting for ${node.children.length} ${node.children.length === 1 ? 'input' : 'inputs'}`
  return `${what} · holds ${held}`
}
