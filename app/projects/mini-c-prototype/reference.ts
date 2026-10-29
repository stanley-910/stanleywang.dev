// Generated from the real Mini-C compiler (Java, McGill COMP 520 coursework) on 2026-09-21.
// See reference/README.md for the exact commands. Only artifacts are stored here, never compiler source.
import helloWorldTrace from './reference/hello-world.trace.json'
import presets from './reference/presets.json'

import type { Trace } from './trace'

/** An example, before its trace loads (reference/presets.json). */
export type Preset = {
  name: string
  file: string
  source: string
  /** The register allocator's palette capped at this many, to show it
   * running out (GraphColouringRegAlloc.registerLimit); all 18 if unset. */
  registers?: number
  /** Whether the compiler stops at an error. */
  error: boolean
}

// The JSON is written by ParseTrace in exactly the Trace shape; the cast only
// narrows the string unions (phase, kind) that JSON cannot express.
const asTrace = (json: unknown) => json as Trace

// Programs first, simplest to showiest; then the errors, one per phase
// they stop in, and classes, which the code generator can't compile. The
// lineup and where each trace came from are in reference/presets.cjs,
// which writes presets.json from the traces.
export const PRESETS: Preset[] = presets
// Where the errors start in the picker (a rule above them).
export const FIRST_ERROR = PRESETS.findIndex((p) => p.error)

// The traces are most of the page's script, so only the one it opens on
// ships with it; the rest load when they're asked for (the picker opened,
// an example linked), each in its own chunk.
const traces = new Map<string, Trace>([
  ['hello-world', asTrace(helloWorldTrace)],
])
const LOAD: Record<string, () => Promise<{ default: unknown }>> = {
  precedence: () => import('./reference/precedence.trace.json'),
  'function-call': () => import('./reference/function-call.trace.json'),
  loop: () => import('./reference/loop.trace.json'),
  shadowing: () => import('./reference/shadowing.trace.json'),
  fibonacci: () => import('./reference/fibonacci.trace.json'),
  'break-continue': () => import('./reference/break-continue.trace.json'),
  pointer: () => import('./reference/pointer.trace.json'),
  'struct-fields': () => import('./reference/struct-fields.trace.json'),
  spilling: () => import('./reference/spilling.trace.json'),
  'missing-semicolon': () => import('./reference/missing-semicolon.trace.json'),
  'unresolved-name': () => import('./reference/unresolved-name.trace.json'),
  'wrong-type': () => import('./reference/wrong-type.trace.json'),
  classes: () => import('./reference/classes.trace.json'),
}
const loading = new Map<string, Promise<Trace>>()
const listeners = new Set<() => void>()
let loaded = 0

/** For useSyncExternalStore: changes whenever another trace arrives. */
export const tracesLoaded = () => loaded
export const onTraceLoaded = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Loads an example's recorded trace (at once if it's here already). */
export function loadTrace(file: string): Promise<Trace> {
  const have = traces.get(file)
  if (have) return Promise.resolve(have)
  const load = LOAD[file]
  if (!load) return Promise.reject(new Error(`no trace for ${file}`))
  let pending = loading.get(file)
  if (!pending) {
    pending = load().then(
      (module) => {
        const trace = asTrace(module.default)
        traces.set(file, trace)
        loaded++
        for (const listener of listeners) listener()
        return trace
      },
      (error: Error) => {
        // (a later ask tries again: a dropped connection isn't for good)
        loading.delete(file)
        throw error
      },
    )
    loading.set(file, pending)
  }
  return pending
}

/** Starts loading every example's trace, as the picker opens. */
export function prefetchTraces() {
  for (const file of Object.keys(LOAD))
    loadTrace(file).catch((error: Error) =>
      console.warn('example trace:', error.message),
    )
}

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

/** The example `source` is, ignoring whitespace, with its source. */
export function findPreset(source: string): Preset | undefined {
  const key = source.replace(/\s+$/, '')
  const exact = PRESETS.find((p) => p.source === key)
  if (exact) return exact
  const words = lexemes(key).join('\u0000')
  const same = PRESETS.find((p) => lexemes(p.source).join('\u0000') === words)
  return same && { ...same, source: key }
}

// Traces moved onto a whitespace edit of their example, per findPreset
// result, so a render can ask again for free.
const moved = new WeakMap<Preset, Trace>()

/** `preset`'s recorded trace, its spans moved onto `preset.source`;
 * undefined until it has loaded (loadTrace). */
export function presetTrace(preset: Preset): Trace | undefined {
  const trace = traces.get(preset.file)
  if (!trace) return undefined
  const text = (trace.text ?? '').replace(/\s+$/, '')
  if (text === preset.source) return trace
  let out = moved.get(preset)
  if (!out) moved.set(preset, (out = reflow(trace, text, preset.source)))
  return out
}
