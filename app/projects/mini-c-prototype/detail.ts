import type { Frame, Trace } from './trace'

// Detailed lexer mode: before each token step, one step per character read
// and one per comment skipped (plain whitespace gets no step). The compiler reads a whole
// token at a time, so these are replayed from the token spans, like the parse
// steps are. `origin` maps each frame back to its index in the plain trace
// (null for the inserted ones), so toggling the mode keeps the place.
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
      // Whitespace is passed over without a step; a comment gets one.
      const gap = source.slice(read, token.start)
      const comment = /\/[/*]/.test(gap)
      if (comment) {
        add(
          { kind: 'lex.skip', start: read, end: token.start, comment },
          'Skipping a comment',
          read,
          token.start,
        )
      }
      for (let at = token.start; at < token.end; at++) {
        const last = at === token.end - 1
        add(
          {
            kind: 'lex.char',
            token: token.id,
            at,
            ...(last ? { next: source[token.end] ?? '' } : {}),
          },
          `Reading \`${token.text.slice(0, at - token.start + 1)}\``,
          token.start,
          at + 1,
        )
      }
      read = token.end
    }
    frames.push(frame)
    origin.push(i)
  })
  return { trace: { ...trace, frames }, origin }
}
