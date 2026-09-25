// Generated from the real Mini-C compiler (Java, McGill COMP 520 coursework) on 2026-09-21.
// See reference/README.md for the exact commands. Only artifacts are stored here, never compiler source.
import functionCallTrace from './reference/function-call.trace.json'
import localVariableTrace from './reference/local-variable.trace.json'
import loopTrace from './reference/loop.trace.json'
import parenthesesTrace from './reference/parentheses.trace.json'
import precedenceTrace from './reference/precedence.trace.json'
import unresolvedNameTrace from './reference/unresolved-name.trace.json'

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

export const REFERENCES: Reference[] = [
  entry('Precedence', 'precedence', precedenceTrace),
  entry('Parentheses', 'parentheses', parenthesesTrace),
  entry('Local variable', 'local-variable', localVariableTrace),
  entry('Loop', 'loop', loopTrace),
  entry('Function call', 'function-call', functionCallTrace),
  entry('Unresolved name', 'unresolved-name', unresolvedNameTrace),
]

// Mini-C lexemes, coarse but enough to tell a whitespace-only edit from a real
// one: "i+1" and "i + 1" split the same, "int x" and "intx" do not.
const LEXEME = /[A-Za-z_#][A-Za-z0-9_]*|\d+|&&|\|\||[<>=!]=|\S/g
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
    tokens: trace.tokens.map(move),
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
    error: trace.error && move(trace.error),
  }
}

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
