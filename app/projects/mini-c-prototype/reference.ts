// Generated from the real Mini-C compiler (Java, McGill COMP 520 coursework) on 2026-09-21.
// See reference/README.md for the exact commands. Only artifacts are stored here, never compiler source.
import breakContinueTrace from './reference/break-continue.trace.json'
import classesTrace from './reference/classes.trace.json'
import fibonacciTrace from './reference/fibonacci.trace.json'
import functionCallTrace from './reference/function-call.trace.json'
import loopTrace from './reference/loop.trace.json'
import missingSemicolonTrace from './reference/missing-semicolon.trace.json'
import pointerTrace from './reference/pointer.trace.json'
import precedenceTrace from './reference/precedence.trace.json'
import shadowingTrace from './reference/shadowing.trace.json'
import structFieldsTrace from './reference/struct-fields.trace.json'
import unresolvedNameTrace from './reference/unresolved-name.trace.json'
import wrongTypeTrace from './reference/wrong-type.trace.json'

import type { Trace } from './trace'

export type Reference = {
  name: string
  file: string
  source: string
  ast: string
  sem: string[]
  // Frames emitted by the compiler itself (util.ParseTrace); the animation
  // plays these instead of the toy recorder when the source matches.
  trace: Trace
}

// The JSON is written by ParseTrace in exactly the Trace shape; the cast only
// narrows the string unions (phase, kind) that JSON cannot express.
const asTrace = (json: unknown) => json as Trace

const entry = (name: string, file: string, json: unknown): Reference => {
  const trace = asTrace(json)
  return {
    name,
    file,
    source: (trace.text ?? '').replace(/\s+$/, ''),
    ast: trace.ast ?? '',
    sem: trace.sem ?? [],
    trace,
  }
}

// Programs first, simplest to showiest; then the errors, one per phase
// they stop in, and classes, which the code generator can't compile. The new ones are trimmed from the compiler's own
// tests (docs/handoffs/2026-09-28-example-candidates.md; lineup with GPT-6
// Astra, 2026-09-28-example-lineup-astra-answer.md). Traces recorded with
// the page's compiler bundle, as trace.sh would with the JVM.
export const REFERENCES: Reference[] = [
  entry('Precedence', 'precedence', precedenceTrace),
  entry('Function call', 'function-call', functionCallTrace),
  entry('Loop', 'loop', loopTrace),
  entry('Shadowing', 'shadowing', shadowingTrace),
  entry('Fibonacci', 'fibonacci', fibonacciTrace),
  entry('Break and continue', 'break-continue', breakContinueTrace),
  entry('Pointer', 'pointer', pointerTrace),
  entry('Struct fields', 'struct-fields', structFieldsTrace),
  entry('Missing semicolon', 'missing-semicolon', missingSemicolonTrace),
  entry('Unresolved name', 'unresolved-name', unresolvedNameTrace),
  entry('Wrong type', 'wrong-type', wrongTypeTrace),
  entry('Classes', 'classes', classesTrace),
]
// Where the errors start in the picker (a rule above them).
export const FIRST_ERROR = REFERENCES.findIndex((r) => r.trace.error)

// Mini-C lexemes, coarse but enough to tell a whitespace-only edit from a real
// one: "i+1" and "i + 1" split the same, "int x" and "intx" do not. A string
// or character literal is one lexeme, spaces and all: `" "` and `"  "` are
// different programs.
const LEXEME =
  /"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|[A-Za-z_#][A-Za-z0-9_]*|\d+|&&|\|\||[<>=!]=|\S/g
const lexemes = (text: string) => text.match(LEXEME) ?? []

// Offsets of the non-whitespace characters, in order.
const solid = (text: string) => {
  const at: number[] = []
  for (let i = 0; i < text.length; i++) if (!/\s/.test(text[i])) at.push(i)
  return at
}

// The same trace, its spans moved from the recorded text onto `source`, which
// differs from it only in whitespace.
function reflow(trace: Trace, from: string, source: string): Trace {
  const a = solid(from)
  const b = solid(source)
  const index = new Map(a.map((offset, i) => [offset, i]))
  const move = <T extends { start: number; end: number }>(span: T): T => {
    if (span.end <= span.start) {
      const i = index.get(span.start)
      const at = i === undefined ? source.length : b[i]
      return { ...span, start: at, end: at }
    }
    const first = index.get(span.start)
    const last = index.get(span.end - 1)
    if (first === undefined || last === undefined) return span
    return { ...span, start: b[first], end: b[last] + 1 }
  }
  return {
    ...trace,
    text: source,
    // A look just past its token stays just past it, at whatever follows
    // the token now. Other reads land on the same non-whitespace character,
    // or the same place inside their token (a space in a string);
    // whitespace between tokens gets no step, so its reads are dropped.
    tokens: trace.tokens.map((token) => {
      const moved = move(token)
      if (!token.reads) return moved
      const reads = token.reads.flatMap((r) => {
        if ('look' in r && r.look && r.at === token.end)
          return [{ ...r, at: moved.end }]
        const i = index.get(r.at)
        if (i !== undefined) return [{ ...r, at: b[i] }]
        if (r.at >= token.start && r.at < token.end)
          return [{ ...r, at: moved.start + r.at - token.start }]
        return []
      })
      return { ...moved, reads }
    }),
    nodes: trace.nodes.map(move),
    frames: trace.frames.map((frame) => ({
      ...frame,
      span: move(frame.span),
      why:
        'span' in frame.why && frame.why.span
          ? { ...frame.why, span: move(frame.why.span) }
          : frame.why,
      sealed: frame.sealed?.map(move),
    })) as Trace['frames'],
    error: trace.error && online(move(trace.error), source),
  }
}

// A recorded error names its line ("… on line 4"); moved, it names the
// line it moved to.
const online = <T extends { start: number; message: string }>(
  error: T,
  source: string,
): T => ({
  ...error,
  message: error.message.replace(
    /on line \d+/,
    `on line ${source.slice(0, error.start).split('\n').length}`,
  ),
})

/** The preset `source` is, ignoring whitespace, with spans moved to match. */
export function findReference(source: string): Reference | undefined {
  const key = source.replace(/\s+$/, '')
  const exact = REFERENCES.find((r) => r.source === key)
  if (exact) return exact
  const words = lexemes(key).join('\u0000')
  const same = REFERENCES.find(
    (r) => lexemes(r.source).join('\u0000') === words,
  )
  return (
    same && {
      ...same,
      source: key,
      trace: reflow(same.trace, same.source, key),
    }
  )
}
