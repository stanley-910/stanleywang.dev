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

export function findReference(source: string): Reference | undefined {
  const key = source.replace(/\s+$/, '')
  return REFERENCES.find((r) => r.source === key)
}
