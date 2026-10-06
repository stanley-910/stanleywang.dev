// The notes: each step's sentence, the slides, and the error notes. Every
// template is filled from trace data, so the same wording serves presets and
// typed programs.
// Backticks mark code spans; the page renders them as <code>.
import { readerOf } from './detail'
import { stackFrames, wordAt } from './stack-view'
import { attemptOf } from './trace'

import type {
  AstNode,
  Frame,
  Instruction,
  LexDecision,
  LvalueError,
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

// DRAFT copy: why the part of an lvalue error that isn't a place in memory
// isn't one, by what kind of expression it is.
const NOT_A_PLACE: Record<string, string> = {
  number: 'is a number: a value, with nowhere to store anything.',
  character: 'is a character: a value, with nowhere to store anything.',
  string: 'is a string literal: text fixed in the program, not a variable.',
  call: "is the value the call hands back. It isn't kept anywhere, so there's nowhere for a value to go.",
  operator:
    "is worked out on the spot and isn't kept anywhere, so there's nowhere for a value to go.",
  address:
    'is an address: a value that says where something is, not the place itself.',
  cast: 'is a converted copy of a value, not the variable it came from.',
  sizeof: 'is a number the compiler works out, not a place.',
  assignment: 'is the value that was just stored, not the place it went.',
  new: 'is a new object, not a variable that holds one.',
  value: 'is a value, not a place.',
}

/** The note on an lvalue error: the rule, why this expression breaks it,
 *  and what does count (DRAFT copy). */
function lvalueNote(lv: LvalueError): string {
  const rule =
    lv.context === 'assign'
      ? `The left side of ${code('=')} says where the value goes, so it has to be a place in memory: an **lvalue**.`
      : `${code('&')} gives where something is stored, so what it takes has to be a place in memory: an **lvalue**.`
  const why = `${code(lv.at)} ${NOT_A_PLACE[lv.kind] ?? NOT_A_PLACE.value}`
  // Through a pointer, C would take it; Mini-C's rule is stricter.
  const pointer =
    lv.through === 'deref' || (lv.through === 'index' && lv.kind !== 'string')
  const part = !lv.through
    ? ''
    : pointer
      ? ` In C, ${code(lv.outer ?? lv.whole)} would be fine, since a pointer says where to store wherever it came from. Mini-C is stricter: it only stores through a pointer kept in a variable, a field or an element, so put ${code(lv.at)} in a variable first.`
      : ` ${code(lv.whole)} is part of it, and ${lv.through === 'field' ? 'a field is only a place when its struct is one' : 'an element is only a place when its array is one'}.`
  const list = `The lvalues are a variable (${code('x')}), a field (${code('s.x')}), an array element (${code('a[i]')}), and what a pointer points to (${code('*p')}). The last three count only when what they're taken from is one too.`
  return `${rule}\n\n${why}${part}\n\n${list}`
}

/** The sentence behind a frame: what was decided and why. */
export function explain(trace: Trace, frame: Frame): string {
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
  switch (w.kind) {
    case 'ready':
      // Stanley's copy (2026-10-02). "and" added before "stepping"; the
      // "..." filled with his earlier "the often beautiful, often
      // monstrous journey".
      return (
        'This is an interactive demonstration of a **C compiler** I created ' +
        "as part of McGill's Compiler Design course.\n\nBy live-compiling code " +
        'in your browser and stepping through each stage of compilation in ' +
        'an intuitive and educational way, I hope to show how source code is ' +
        'actually translated into assembly, and the often beautiful, often ' +
        'monstrous journey that is.\n\nPlease enjoy!\n\n**Stanley**'
      )
    // Steps whose note is never shown (animated.tsx): a lexer, parser or
    // name-pass step has its class or the symbol table in the pane
    // instead (classStep), a type-pass step has no notes (typeStep), and
    // the step a program fails on gets the general error note (noteText).
    case 'token':
    case 'lex.char':
    case 'lex.error':
    case 'lex.skip':
    case 'parse.read':
    case 'parse.node':
    case 'parse.wait':
    case 'parse.precedence':
    case 'parse.group':
    case 'parse.close':
    case 'parse.error':
    case 'check.declare':
    case 'check.resolve':
    case 'check.unresolved':
    case 'check.builtin':
    case 'check.link':
    case 'check.nameError':
    case 'check.type':
    case 'check.typesDone':
    case 'check.namesDone':
      return ''
    case 'parse.done':
      return `AST is complete with ${trace.nodes.length} nodes`
    case 'check.typeError':
      return w.lvalue
        ? lvalueNote(w.lvalue)
        : w.said
          ? `${w.said} The compiler stops here.`
          : w.about !== undefined
            ? `${code(w.about)}: ${w.message}. The compiler stops here.`
            : w.node === trace.root
              ? `${w.message[0].toUpperCase()}${w.message.slice(1)}. The compiler stops here.`
              : `${code(text(trace, frame.span))}: ${w.message}. The compiler stops here.`
    case 'check.expr': {
      // (a step that checks out has no note: the type pass shows none)
      if (w.ok) return ''
      const n = node(w.node)
      const bad = w.bad == null ? undefined : node(w.bad)
      const got = bad && w.typed.find(([id]) => id === bad.id)?.[1]
      if (w.lvalue) return lvalueNote(w.lvalue)
      if (w.said) return `${w.said} The compiler stops here.`
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
    case 'check.fits': {
      // (only a failure is shown: the type pass has no notes otherwise)
      if (w.ok) return ''
      const value = src(w.value)
      if (w.rule === 'assign') {
        const target = code(trace.tokens[node(w.node).token].text)
        return `${target} is ${code(w.expected)}, but ${value} is ${code(w.type)}. The compiler stops here.`
      }
      if (w.rule === 'condition')
        return `A ${code(node(w.node).label)} condition must be ${code('int')}, but ${value} is ${code(w.type)}. The compiler stops here.`
      // A bare `return;` stands in for its own value.
      if (w.value === w.node)
        return `The function promises ${code(w.expected)}, but this ${code('return;')} hands back nothing. The compiler stops here.`
      return `The function promises ${code(w.expected)}, but ${value} is ${code(w.type)}. The compiler stops here.`
    }
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
      return dead
        ? `${line} ${run.length === 1 ? 'It' : code(dead.text ?? dead.op)} never runs: the jump before it always leaves first, so the register allocator drops it.`
        : line
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
      // DRAFT copy: the placeholder clause.
      return `Before its body, ${code(n.label)} builds a stack frame: it saves the caller's frame pointer, points ${code('$fp')} at this frame${saveRa ? ', keeps the return address' : ''}${bytes ? `, reserves ${bytes} bytes for the variables it declares` : ''}, and leaves ${code('pushRegisters')} as a placeholder for the registers it will save. None of these lines is written in your code.`
    }
    case 'emit.epilogue': {
      const n = node(w.node)
      if (w.of) return explainFrameLine(trace, n, w.of, w.from)
      const run = trace.instructions.slice(w.from, w.to + 1)
      const exits = run.some((i) => i.op === 'syscall')
      // DRAFT copy: the placeholder clause.
      const back = `restores its saved registers (${code('popRegisters')}, a placeholder for now), puts ${code('$sp')} and ${code('$fp')} back the way the caller left them`
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
      // DRAFT copy: only the counts; the Interference Graph slide before it
      // says what an edge means (Stanley, 2026-10-06).
      return `${w.nodes} nodes and ${w.edges} ${w.edges === 1 ? 'edge' : 'edges'}${w.busiest ? `; ${code(w.busiest)} has the most, ${w.degree}` : ''}.`
    // No note while nodes are set aside and popped one by one: the graph
    // shows each move, and the slides before them say the rule (Stanley,
    // 2026-10-06: the note only said again how many neighbours it had).
    // Nor on the spill candidate (When None Are Easy says why it's picked)
    // and the placeholders lit (Saving Registers, Now says why).
    case 'reg.simplify':
    case 'reg.select':
    case 'reg.spillCandidate':
      return ''
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
    // DRAFT copy (2026-10-06): the placeholders from emit, expanded.
    case 'reg.saves': {
      const fn = w.fn
      const name = code(trace.backend?.functions[fn]?.name ?? '')
      const holder = (op: string) =>
        trace.instructions.find((i) => i.fn === fn && i.op === op)
      const regs = (holder('pushRegisters')?.out ?? []).flatMap(
        (t) => /^sw (\$\w+),/.exec(t)?.[1] ?? [],
      )
      if (w.stage === 'mark') return ''
      if (regs.length === 0)
        return w.stage === 'push'
          ? `${name} ends up needing no registers to save, so ${code('pushRegisters')} becomes nothing.`
          : `With nothing saved, ${code('popRegisters')} becomes nothing too.`
      return w.stage === 'push'
        ? `${code('pushRegisters')} becomes a save for each register ${name} uses (${list(regs.map(code))}): make room for a word on the stack, then store the register in it.`
        : `${code('popRegisters')} is the same in reverse: each saved register is loaded back, last saved first, and its word given back to the stack${trace.backend?.functions[fn]?.name === 'main' ? '' : ', so the caller finds its registers as it left them'}.`
    }
    case 'reg.done': {
      if (w.fn === undefined)
        return 'Every temporary now has a physical register. Reuse kept the count small.'
      // The count ("2 real registers cover every virtual one") is cut, and
      // the spill code is the Spilling slide's (Stanley, 2026-10-06).
      return ''
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
const LEXEMES = {
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
  /** About the live-range bars, which only the real compiler's traces draw. */
  lanes?: true
  /** Part of the welcome (readme.txt), not of a phase. */
  readme?: true
  /** Code blocks under the body (before any table), one block each. */
  code?: string | string[]
  /** The code goes over the body instead, for a body that points at it. */
  codeFirst?: true
  /** A muted line last: a setting the slide points to, which the line
   * turns on (and the settings menu opens on). */
  hint?: 'detailedLexer'
  /** Set off under the body, as a Markdown `>` quote. */
  quote?: string
  /** Shown only in this example, or in every example but this one (by its
   * name in the picker). */
  onlyIn?: string
  notIn?: string
}

/** The welcome's slides after its first page: what a compiler is, before
 * the lexer's own (Stanley, 2026-10-02). */
export const README_SLIDES: Slide[] = [
  {
    // Stanley's copy (2026-10-02); "include such as" read "include".
    title: 'Background',
    readme: true,
    body:
      "Before you dive in, here's a quick primer on what a compiler is " +
      'and does:\n\nA compiler **translates** a source language to a ' +
      'target language. A source-to-assembly compiler like mine targets a ' +
      'specific **Instruction Set Architecture** (ISA), which defines the ' +
      'instructions, registers, and memory model a processor supports.' +
      '\n\nEach ISA has its own **assembly language**, a human-"readable" ' +
      'way of writing the instructions a processor can execute. Common ' +
      'ISAs include x86 (Intel) or ARM (Mac).\n\nMy compiler uses a ' +
      '**simplified subset** of C as its source and targets the **MIPS ISA**.',
  },
]

/**
 * Text-only slides that open a phase. They sit just before the phase's first
 * step (the lexer's between the welcome and the first token), so stepping
 * walks through them and playing skips them.
 */
export const PHASE_SLIDES: Partial<Record<Frame['phase'], Slide[]>> = {
  Tokens: [
    {
      // Stanley's copy (2026-10-02), untitled; "is the first phase" and
      // "character-by-character" for "is first phase" and "character by
      // character".
      title: '',
      body:
        '**Lexical analysis** is the first phase of compilation. It converts ' +
        'the raw character input of your program into **tokens**.\n\nA ' +
        '**token** is simply a sequence of characters (lexeme) alongside a ' +
        '**type**, which describes what kind of thing it is.\n\nFor ' +
        'example, `int x = 42;` becomes:',
      // As the compiler prints them (Token.toString): the category, and
      // what was read for a name or a literal.
      code: 'INT IDENTIFIER(x) ASSIGN INT_LITERAL(42) SC',
      hint: 'detailedLexer',
    },
  ],
  Parse: [
    // Stanley's copy (2026-10-02), untitled like the lexer's; "is to
    // create" read "is create", and `_abstract_` is the note's `*abstract*`.
    {
      title: '',
      body:
        "The **parser** checks the tokens from the lexer against the language's " +
        '**grammar**, a formal set of rules for what valid code looks like, ' +
        'and rejects anything out of order with a **syntax error**.',
      quote:
        "For example, try deleting the semicolon from any line. Since C's " +
        'grammar specifies that statements must end in a semicolon, it is ' +
        'caught by the parser.',
    },
    {
      title: '',
      body:
        'The other key responsibility of the parser is to create a ' +
        'representation of the program which later phases can easily walk, ' +
        'check, and translate for their purposes.\n\nTo do this, we use an ' +
        "**Abstract Syntax Tree (AST)**. It's *abstract* because it leaves " +
        'out details that only matter when code is written as linear text, ' +
        'like parentheses and semicolons. Those symbols exist to mark ' +
        'grouping and boundaries in a flat stream, but become redundant once ' +
        "the tree's hierarchy captures that structure.",
    },
    {
      // The link opens the Precedence example on its own slides, below.
      title: '',
      notIn: 'Precedence',
      body:
        'To view an interesting problem this solves, take a look at the ' +
        '[Precedence](example:Precedence) code example.',
    },
    // Only in the Precedence example, in place of the slide above.
    {
      title: 'The Problem with Precedence',
      onlyIn: 'Precedence',
      body:
        'This solves interesting problems like precedence. How do you make ' +
        "sure the code that is generated correctly PEMDAS's something like " +
        '`2 - 4 * 2`? If you just generated code left to right, you run into ' +
        'issues like `(2 - 4) * 2`. Continue to see how an AST fixes that.',
    },
    {
      title: 'The Problem with Precedence',
      onlyIn: 'Precedence',
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
  // slides open the second pass (STEP_SLIDES).
  Check: [
    {
      title: 'Semantic Analysis',
      // Stanley's copy (2026-10-06).
      body:
        'The parser guarantees the structural validity of a program. ' +
        'Statements end in semicolons, a `while` has a condition followed by ' +
        'a body, brackets are balanced. That form is what gets embedded into ' +
        "the AST. What the parser can't tell us is whether our code is " +
        'meaningful.\n\nCode is meaningful if it is well-declared and ' +
        'properly typed. Validating this is delegated to Name Analysis and ' +
        'Type Checking, each its own walk through the newly constructed AST.',
    },
    {
      title: 'Name Analysis',
      // Stanley's copy (2026-10-06); "your code is properly declared" read
      // "your code that is properly declared", "going straight" read "going
      // to straight", and a comma after `{…}`.
      body:
        'When it comes to validating that your code is properly declared, ' +
        'we want to link each variable and function usage to its declaration ' +
        'node in the AST. At each usage, we check declarations stored for the ' +
        'current scope, typically defined with `{…}`, and if we cannot find a ' +
        'declaration, we walk up scopes and their declarations using a ' +
        'symbol table until we either find it or throw an error.\n\nA ' +
        // DRAFT copy (2026-10-06): what a symbol table is (sem/Scope.java:
        // a map of names to declarations, and the scope around it).
        '**symbol table** is where the compiler keeps every name declared ' +
        'so far. Each scope gets its own table, matching each name to its ' +
        'declaration, and points to the scope around it. Walking up scopes ' +
        'is just following those pointers outward, from the innermost ' +
        '`{…}` to the global scope. For example, a use of `n` inside a ' +
        "`while` loop's body checks the loop's block first, then the " +
        "function's, then the globals.\n\nEach " +
        "time we link the usage to its declaration inside that node's " +
        'metadata so that later passes (like type checking) can inspect the ' +
        'type of a variable/function/what-have-you by going straight to the ' +
        'declaration.',
    },
  ],
  Emit: [
    // Stanley's copy (2026-10-06), from a draft he cut down; "The work"
    // read "the work".
    {
      title: 'From Tree to Instructions',
      body:
        'Now that our AST is well-declared and well-typed, we can finally ' +
        'use it for what it was built for: generating **assembly**.\n\nCode ' +
        'generation walks the tree and, for each kind of node, follows a ' +
        'rule for which MIPS instructions it becomes.',
    },
    {
      title: 'Speaking to Hardware',
      body:
        'Unlike C, assembly describes exactly what your processor does, one ' +
        'step at a time. Each line is a single **instruction** that runs ' +
        "directly on your hardware.\n\nProcessors don't do arithmetic on " +
        'variables sitting in memory. They do it in **registers**: a handful ' +
        'of storage slots built into the processor itself. Memory is large ' +
        'but slow to reach, while registers are tiny but extremely fast. So ' +
        'most of the work is moving values into registers, operating on ' +
        'them, and moving the results back out.\n\nFor example, `x = a + b;` ' +
        'becomes:\n1. load `a` from memory into a register\n2. load `b` into ' +
        'another register\n3. add them into a third\n4. store that result ' +
        'back into `x`',
    },
    {
      // Split from Speaking to Hardware at Stanley's request (2026-10-06):
      // his sentences, the virtual memory analogy and liveness.
      title: 'Infinite Registers',
      body:
        'We assume for this phase that we have an infinite ' +
        'amount of registers to work with. ' +
        // DRAFT copy (2026-10-06): the OS analogy, explained, in place of
        // "Similar to how in virtualization we assume an infinite amount of
        // address space to work with."
        'This is similar to **virtual memory** in an operating system: each ' +
        'program is written as if it had all of memory to itself, and the ' +
        'OS quietly maps those addresses onto the physical memory the ' +
        'machine actually has. Our **virtual registers** work the same way, ' +
        'standing in for real ones until they are mapped. The ' +
        'work of allocating the incremental usage of registers into a finite ' +
        'supply is left for the next pass.\n\n' +
        // Liveness, for the lanes emit draws (emit-lanes.tsx) and for
        // register allocation to build on: Stanley's first sentence
        // (2026-10-06), the rest DRAFT copy.
        "To prepare for that, we mark each virtual register's **liveness " +
        'range** with a bar beside it. A register becomes **live** when an ' +
        'instruction puts a value in it, and stays live until the last ' +
        'instruction that still uses that value. For example, in ' +
        '`x = a + b;`, the register holding `a` is live from its load until ' +
        "the add, and then it's done.",
    },
    {
      title: 'The Stack',
      body:
        'Each time a function is called, it needs room for its own ' +
        'parameters and local variables. That room comes from the ' +
        '**stack**, a region of memory that grows each time a function is ' +
        'called and shrinks each time one returns.\n\nEach call gets its own ' +
        'slice of the stack, called a **stack frame**. Two registers keep ' +
        'track of it:\n- the **stack pointer** (`$sp`) marks the current end ' +
        'of the stack\n- the **frame pointer** (`$fp`) marks where the ' +
        'current frame begins, so every local can be found at a fixed ' +
        'distance from it (e.g. `x` at `$fp - 8`)\n\nWhen `main` calls ' +
        "`square`, `square`'s frame is placed just past `main`'s, so nothing " +
        "`square` stores can land on `main`'s variables. When `square` " +
        "returns, its frame is thrown away, and `main`'s is exactly as it " +
        'was left.',
    },
    {
      title: 'Caller and Callee',
      code:
        'int square(int n) {   // callee\n  return n * n;\n}\n\n' +
        'void main() {         // caller\n  int y;\n  y = square(4);\n}',
      codeFirst: true,
      body:
        'When one function calls another, the one making the call is the ' +
        '**caller**, and the one being called is the **callee**. They need ' +
        "to agree on who does what, or they'd overwrite each other's data. " +
        'That agreement is called a **calling convention**. In mine:\n\n' +
        '1. **Caller:** pushes each argument onto the stack, reserves space ' +
        'for the return value, and jumps to the callee, saving where to come ' +
        'back to in the **return address** register (`$ra`).\n' +
        "2. **Callee:** first saves the caller's `$fp` and `$ra`, makes room " +
        "for its locals, and saves any registers it's about to use. This " +
        'setup is the **prologue**.\n' +
        '3. **Callee:** runs its body, writes its result into the reserved ' +
        'space, then puts everything back the way it found it and jumps to ' +
        '`$ra`. This cleanup is the **epilogue**.\n' +
        '4. **Caller:** reads the result off the stack and clears away the ' +
        "arguments.\n\nYou'll see each of these steps labeled in the stack " +
        'as it happens.',
    },
    {
      title: 'Saving Registers, Later',
      body:
        'Back in step 2, the callee "saves any registers it\'s about to ' +
        'use." But with infinite virtual registers, we don\'t yet know which ' +
        "real registers a function will end up using, so there's nothing " +
        'concrete to save.\n\nInstead, we leave two placeholders: ' +
        '`pushRegisters` at the end of the prologue, and `popRegisters` at ' +
        'the start of the epilogue. Once register allocation has decided ' +
        'which real registers each function uses, it replaces each ' +
        'placeholder with the actual saves and restores.',
    },
  ],
  // Stanley's dictation (2026-10-06), tidied: the opening two. The rest
  // open the steps they describe (STEP_SLIDES).
  Registers: [
    {
      title: 'Register Allocation',
      body:
        'In emit, we gave every value its own virtual register and put off ' +
        'mapping them onto real registers until now. MIPS, our target ' +
        'architecture, gives us only 18 registers to freely hand out ' +
        '(`$t0`–`$t9` and `$s0`–`$s7`). However, even a short program can ' +
        "use well past that many virtual ones. The **register allocator**'s " +
        'job is to map every virtual register to a real one without ' +
        "exceeding the processor's finite supply.",
    },
    {
      // DRAFT copy (2026-10-06): the Spilling example's cap
      // (GraphColouringRegAlloc.registerLimit).
      title: 'Only Four',
      onlyIn: 'Spilling',
      body:
        'To show what happens when the registers run out, this example ' +
        'pretends we only have {k} of them, `$t0` to `$t3`. Even a sum of ' +
        'five numbers is too much.',
    },
    {
      title: 'Liveness',
      lanes: true,
      body:
        'The liveness ranges beside the assembly are the foundation of how ' +
        'we keep down the number of real registers we use. The gist of it ' +
        'is that any two virtual registers may share a real register as ' +
        'long as they are never live at the same time, that is, their bars ' +
        'never overlap.',
    },
  ],
}

/** A slide's register count: `{k}` is how many the allocator may hand out
 * (18, or four in Spilling), `{k-1}` one fewer. */
export const withRegisterCount = (text: string, k: number) =>
  text.replaceAll('{k-1}', String(k - 1)).replaceAll('{k}', String(k))

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
      // Stanley's copy (2026-10-06); "the second example" read "the
      // second examples", and "the left side of `=` to be" read "the left
      // side of `=` has to be".
      {
        title: 'Type Checking',
        body:
          "Now let's take a look at well-typed code. Would these examples " +
          'count?',
        code: ['int x;\nx = "hello";', 'int x;\n5 = x;'],
      },
      {
        title: 'Type Checking',
        body:
          'This code is not meaningful, even though we have properly defined ' +
          'variables where we use them. The issue is typing. In both examples ' +
          'we declare `x` to be an integer, but the first time around we ' +
          'assign it to a string!\n\nContrarily, the second example ' +
          'technically is well-typed, since `5` and `x` are both integers. ' +
          'The problem is that the language (and by association, our ' +
          'compiler) expects the left side of `=` to be somewhere a value ' +
          'can be stored, and `5` is just a value. Checking for proper ' +
          '"lvalues" is also a responsibility of type checking.',
      },
    ],
  },
  // Stanley's dictation (2026-10-06), tidied; each slide opens the step
  // it describes. The interference graph's sits just before it appears.
  {
    phase: 'Registers',
    // The first interference graph: Registers opens on it (the liveness
    // sweeps are left out, regs-view.ts withoutLiveness).
    starts: (frame) => frame.why.kind === 'reg.interfere',
    slides: [
      {
        title: 'Interference Graph',
        body:
          "You'll now see these liveness ranges mapped onto an " +
          '**interference graph**. Each virtual register is a dot (a ' +
          '**node**), and two nodes are joined by a line (an **edge**), ' +
          'making them **adjacent**, if their liveness ranges overlap. That ' +
          'means they **interfere**, and therefore cannot share a register.',
      },
    ],
  },
  // Once the graph is up, before the first node is set aside.
  {
    phase: 'Registers',
    starts: (frame, previous) =>
      frame.why.kind === 'reg.simplify' &&
      previous.why.kind === 'reg.interfere',
    slides: [
      {
        title: 'Graph Colouring',
        body:
          'Fitting our virtual registers into {k} real ones now becomes a ' +
          '**graph colouring** problem: give every node one of {k} colours, ' +
          'one per real register, such that no two adjacent nodes share a ' +
          'colour.\n\nThere is no known fast way to find the best colouring ' +
          'for every graph, so compilers today use **heuristics**: rules of ' +
          "thumb that work well in practice, but don't guarantee the best " +
          'answer.',
      },
      {
        title: "Chaitin's Algorithm",
        body:
          "**Chaitin's algorithm** is one such heuristic, used by compilers " +
          'to colour the interference graph and so allocate registers. It ' +
          'works by first finding nodes with fewer edges than the number of ' +
          'real registers we have available: {k}. Even if such a node has the ' +
          'most neighbours it can, {k-1}, and they all take different colours, ' +
          'there is still one colour left over for it.\n\nSo we take this ' +
          'easy-to-colour node and set it aside, pushing it onto a **stack** ' +
          '(a pile where the last thing in is the first thing out), and ' +
          'remove it from the graph along with all of its edges. Its ' +
          'neighbours each lose an edge, which can bring them under {k} and ' +
          'make them easy too.',
      },
    ],
  },
  {
    phase: 'Registers',
    starts: (frame) => frame.why.kind === 'reg.spillCandidate',
    slides: [
      {
        // DRAFT copy, not dictated: as the slides around it.
        title: 'When None Are Easy',
        body:
          'Sometimes every node left has {k} or more edges, and there is no ' +
          'easy node to set aside. We push one onto the stack anyway, the ' +
          'one with the most edges, and mark it as a **spill candidate**: it ' +
          'might not get a colour when it comes back off.\n\nIt might still ' +
          'get lucky, though. If its neighbours end up sharing colours among ' +
          'themselves, there can be one left over for it.',
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
          'Once every node has been set aside on the stack, we pop them off, ' +
          'starting with the last one we set aside. Each node takes the ' +
          'first colour none of its neighbours already has.\n\nBy popping ' +
          'them in this reverse order, a node only comes back to the same ' +
          'neighbours it had when it was first set aside: fewer than {k} of ' +
          'them, so a colour is always free. The only exception is a spill ' +
          'candidate. If one comes back and every colour is taken, it is ' +
          '**spilled**.',
      },
    ],
  },
  // Only programs that spill reach it: at the first spill (in an 18-colour
  // attempt about to be thrown away, or Spilling's only one).
  {
    phase: 'Registers',
    starts: (frame) =>
      frame.why.kind === 'reg.spill' || frame.why.kind === 'reg.retry',
    slides: [
      {
        title: 'Spilling',
        // DRAFT copy: the register pressure sentence (Stanley asked).
        notIn: 'Spilling',
        body:
          'Spills happen when more values are live at the same moment than ' +
          'there are registers to hold them, which is called high **register ' +
          "pressure**. A spilled value doesn't get a register at all. It lives in " +
          'memory instead, in a 4-byte slot of the **data section** (memory ' +
          "set aside for the program's whole run), and is loaded into a " +
          'register right before every instruction that reads it, then ' +
          'stored back right after every instruction that writes it.\n\nBut ' +
          'those loads and stores need registers to work through too! So ' +
          'when the first attempt spills, my allocator throws that colouring ' +
          'away and starts over with 16 colours, keeping `$t8` and `$t9` ' +
          'free just for spill code.',
      },
      {
        // DRAFT copy (2026-10-06): as above, for the capped palette, which
        // never needs the second attempt.
        title: 'Spilling',
        onlyIn: 'Spilling',
        body:
          'Spills happen when more values are live at the same moment than ' +
          'there are registers to hold them, which is called high **register ' +
          "pressure**. A spilled value doesn't get a register at all. It lives in " +
          'memory instead, in a 4-byte slot of the **data section** (memory ' +
          "set aside for the program's whole run), and is loaded into a " +
          'register right before every instruction that reads it, then ' +
          'stored back right after every instruction that writes it.\n\nBut ' +
          'those loads and stores need registers to work through too! That ' +
          'is why `$t8` and `$t9` were never among the {k}: they are kept ' +
          'free just for spill code.',
      },
    ],
  },
  // Before a function's placeholders expand (regs-view.ts withSaveSteps).
  {
    phase: 'Registers',
    starts: (frame) => frame.why.kind === 'reg.saves',
    slides: [
      {
        title: 'Saving Registers, Now',
        body:
          'Back in emit, we left two placeholders, `pushRegisters` and ' +
          "`popRegisters`, because we didn't know yet which real registers " +
          'each function would use. Now that the allocator has decided, we ' +
          'can fill them in.\n\n`pushRegisters` becomes a save of each ' +
          'register the function uses, at the end of its prologue, and ' +
          '`popRegisters` restores them at the start of its epilogue. That ' +
          'way, whoever called the function gets its registers back exactly ' +
          'as it left them.',
      },
    ],
  },
]

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

// The struct a field belongs to: its fields are its children
// (ParseTrace), declared in its scope.
const structOf = (trace: Trace, node: AstNode) =>
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

const joinOr = (items: string[]) =>
  items.length > 1
    ? `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`
    : items[0]

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
