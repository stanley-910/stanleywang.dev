import type { Frame, LexDecision, Token, Trace } from './trace'

// Reads that pass between tokens: they get no step of their own.
const BETWEEN: ReadonlySet<LexDecision> = new Set([
  'space',
  'comment',
  'comment end',
])

/**
 * The step a token's read gets in the detailed lexer, or none: whitespace
 * and comments are skipped as one step before the token (see detailTrace).
 */
function stepOf(token: Token, n: number): 'char' | 'error' | undefined {
  const reads = token.reads ?? []
  const r = reads[n]
  if (!('does' in r)) return 'error'
  if (r.at < token.start || BETWEEN.has(r.does)) return undefined
  return 'char'
}

/** The kind of token the tokeniser set out to read: its first own read. */
export function readerOf(token: Token): LexDecision | undefined {
  const reads = token.reads ?? []
  const n = reads.findIndex((_, i) => stepOf(token, i) === 'char')
  const r = reads[n]
  return r && 'does' in r ? r.does : undefined
}

// Detailed lexer mode: before each token step, one step per character the
// tokeniser read for it, as it recorded them (Tokeniser.readObserver): each
// character taken, the one it only looked at to see where the token ends,
// and any error it reported. The whitespace and comments before a token get
// one step if there is a comment among them (plain whitespace gets none).
// The teaching compiler gives its tokens reads in the same words; a trace
// without reads gets no extra steps. `origin` maps each frame back to its index in the plain trace (null
// for the inserted ones), so toggling the mode keeps the place.
export function detailTrace(
  trace: Trace,
  source: string,
): { trace: Trace; origin: (number | null)[] } {
  const frames: Frame[] = []
  const origin: (number | null)[] = []
  let read = 0
  trace.frames.forEach((frame, i) => {
    if (frame.phase === 'Tokens' && frame.why.kind === 'token') {
      const token = trace.tokens[frame.why.token]
      const reads = token.reads ?? []
      const before = frames[frames.length - 1] ?? frame
      const add = (
        why: Frame['why'],
        title: string,
        start: number,
        end: number,
      ) => {
        frames.push({ ...before, why, title, span: { start, end } })
        origin.push(null)
      }
      // Every comment takes a second `/` or a `*` as "comment".
      if (
        reads.some(
          (r) => r.at < token.start && 'does' in r && r.does === 'comment',
        )
      )
        add(
          { kind: 'lex.skip', start: read, end: token.start, comment: true },
          'Skipping a comment',
          read,
          token.start,
        )
      // A comment that never closes is the token itself: one skip step
      // over what the tokeniser read of it.
      const open = reads.filter(
        (r) => r.at >= token.start && 'does' in r && r.does === 'comment',
      )
      reads.forEach((r, n) => {
        const step = stepOf(token, n)
        if (step === 'error') {
          add(
            { kind: 'lex.error', token: token.id, read: n },
            'Lexing error', // DRAFT copy
            ...errorSpan(token, n, source),
          )
        } else if (step === 'char' && 'does' in r) {
          add(
            { kind: 'lex.char', token: token.id, read: n, at: r.at },
            r.look
              ? `Looking past \`${source.slice(token.start, r.at)}\`` // DRAFT copy
              : `Reading \`${source.slice(token.start, r.at + 1)}\``,
            token.start,
            r.at + 1,
          )
        } else if (r === open[0]) {
          const end = open[open.length - 1].at + 1
          add(
            { kind: 'lex.skip', start: token.start, end, comment: true },
            'Skipping a comment',
            token.start,
            end,
          )
        }
      })
      read = token.end
    }
    frames.push(frame)
    origin.push(i)
  })
  return { trace: { ...trace, frames }, origin }
}

/**
 * What an error step marks: the character the tokeniser reported it at, or
 * what it read of the token when that says more: a string left open at a
 * newline, or an error reported at the token's start once it had read on
 * (`'ab'`, `!x`, a comment that never closes).
 */
function errorSpan(token: Token, n: number, source: string): [number, number] {
  const reads = token.reads ?? []
  const at = reads[n].at
  if (source[at] === '\n' && at > token.start) return [token.start, at]
  const last = reads
    .slice(0, n)
    .filter((r) => 'does' in r && r.at > token.start)
    .pop()
  if (at === token.start && last)
    return [token.start, source[last.at] === '\n' ? last.at : last.at + 1]
  return [at, Math.min(at + 1, source.length)]
}
