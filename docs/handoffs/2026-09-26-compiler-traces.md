# Compiler showcase: every phase from the compiler's own record (2026-09-26)

Follows `2026-09-25-emit-structure.md` (Round 4: emit tags). Merged to `main`
in `037b6d0` ("Merge branch 'compiler-showcase'"); the page is still dev-only
(production serves a 404 with `noindex`).

## What landed

Five agents instrumented the rest of the compiler with record-only static
observers (null in normal compilation), and the page now plays what the
compiler recorded instead of rebuilding it:

| Phase | Compiler hook | Page |
|---|---|---|
| Lexer | `Tokeniser.readObserver`: every character taken or looked at, and why | detailed lexer plays the reads |
| Parser | `Parser.observer`: rules, tokens, precedence decisions, nodes, groups, errors | `parse-replay.ts` (820 lines) deleted |
| Check | `BaseSemanticAnalyzer.stepObserver`: scopes, declares, lookups, types, fits | check phase and scope panel play the steps |
| Regs | `GraphColouringRegAlloc.stepObserver`: liveness sweeps, both colouring attempts, spills | regs shows the 16-colour retry and the real saves |
| Order | allocation no longer depends on identity hashes | presets match the browser bundle exactly |

Bug fixes on the way: tokens at the end of a file without a newline, `**/`
closing a comment, `!`/`|`/`#include` errors naming the right character,
`int a[x];` and too-large literals as parse errors instead of crashes,
declaration labels as C types (`struct p* q`, `int[3] a`), empty programs,
and the naive allocator's order.

Compiler repo: everything is on `showcase-traces` (and `emit-tags`,
fast-forwarded to it) in `~/worktrees/mini-c-compiler/`. **Not pushed**: the
remote is the course GitLab, and `master` has uncommitted work.

Rebuild the bundle: `MINI_C=~/worktrees/mini-c-compiler/2026-09-25_showcase-traces sh app/projects/mini-c-prototype/browser/build.sh`.

## Checks at merge

- Compiler suite (headless, shimmed): 548 found, 499 passed, 0 failed, 49 skipped.
- Presets identical to the bundle's output; audit of 61 scenarios, parse
  audit (532 programs), check-note audit (2,174 frames): no problems.
- tsc, eslint, `check:mini-c`, `next build` clean; browser pass over every phase.

## Open

- Struct declarations don't appear in the check phase: NameAnalyzer never
  declares them (TypeAnalyzer does). Show them as a type-pass step? (Stanley)
- ParseTrace throws on instance method calls ("no token for FunCallExpr"),
  e.g. `tests/oop/class_new_instance.c`.
- `int a[x];` shows `int[0] a` in the partial tree (the size it carries on with).
- An unterminated literal at the end of the file still says "The line ends".
- New sentences from the agents are marked `// DRAFT copy`.
- Before the page goes public: input and trace size limits, the stack view's
  per-element array expansion, JSON escaping of control characters, and
  program text inside explanation markup. A site safety audit (GPT-6 Astra)
  is saved outside the repo in the Claude project handoffs folder.
- `reference/*.asm` and `*.regalloc.json` are stale; nothing reads them.
