# Prompt: show precedence in the tree, not in a table

## Context

`/projects/mini-c-prototype` is an animated walkthrough of a small C compiler
(tokens → parse → check → emit → regs). The parse phase grows the AST one step
per frame, with a one-line note under the editor ("× waits: it binds tighter
than +").

We added a "detailed" parser mode that shows the recursive-descent call stack
(`parseDeclarations`, `parseExpr(6)`, ...) and a precedence table with a limit
row. Feedback from the author: nobody watching will know what `parseDeclarations`
means or be able to read the table. It's unintelligible to the audience
(portfolio visitors, some non-compiler engineers).

What we want instead: make the Pratt/precedence decisions visible **in the tree
itself**. For example, in `a + b * c`, show that after `b` the parser sees `*`,
and `b` is pulled down under `*` because `*` binds tighter, rather than
being attached to `+`. "x waits to bind tighter" should be something you can
see, not read.

## Read these (read-only; do not edit anything)

Working directory: `/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase`

- `app/projects/mini-c-prototype/animated.tsx`: page and tree rendering (look for the parse view, `ParseState`, node/edge layout, `attached`/`consumed`)
- `app/projects/mini-c-prototype/animated.css`: styles
- `app/projects/mini-c-prototype/trace.ts`: frame model (`nodes`, `attached`, `consumed`, `focus`, `why`, `stack`, `compare`)
- `app/projects/mini-c-prototype/parse-detail.ts`: shadow parser that emits call/compare/build events; `replayParse`
- `app/projects/mini-c-prototype/explain.ts`: note sentences per frame
- `app/projects/mini-c-prototype/detail.ts`: the detailed *lexer* mode, which works well; use it as a tone reference
- `docs/handoffs/2026-09-24-compiler-showcase-live-markup.md`: decisions so far

The real compiler (read-only, don't propose changes to it):

- `~/Developer/mcgill/mini-c-compiler/src/java/parser/Parser.java`: recursive descent + Pratt `parseExpr(precLimit)`
- `~/Developer/mcgill/mini-c-compiler/description/part1/grammar/pratt_parser_grammar.txt`
- `~/Developer/mcgill/mini-c-compiler/src/test/util/ParseTrace.java`: how recorded parse steps are derived

## Questions

1. Propose 2–3 concrete in-tree visual treatments that show, frame by frame:
   - an operand that is "held" because the next operator might bind tighter;
   - an operator winning (tighter) vs losing (looser/equal, left-assoc) the operand;
   - a subtree closing and attaching up;
   - parentheses resetting precedence;
   - right-assoc `=`.
   For each, describe what the viewer sees (positions, motion, line style, labels),
   and which existing frame fields drive it. Say what new data, if any, is needed.
2. Which one would you pick, and why? What's the smallest version worth building?
3. What should happen to the call stack and precedence table: delete, hide
   behind something, or reduce to one visual cue?
4. Walk through `4 - n + 2 * 3 - n` and `-x * (2 + y) - f(1)` frame by frame in
   your chosen design, in plain words.
5. Name any good prior art (visualizers, papers, blog posts on Pratt parsing)
   and the specific idea worth borrowing from each.

Keep the answer concrete and under ~1500 words. Plain language. Note labels
must be terse.
