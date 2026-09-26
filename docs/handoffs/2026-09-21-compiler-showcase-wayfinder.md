# Compiler showcase — handoff for charting the wayfinder map

## Goal of the next session

Chart a **wayfinder map** (the `/wayfinder` skill, "Chart the map" mode) for turning the
Mini-C compiler prototype into a real project page on Stanley's portfolio. The
previous session ended with the user invoking `/wayfinder` and `/handoff` together
with no arguments; charting needs a live grilling session with Stanley, so it was
deferred to this session rather than faked. Do **not** start resolving tickets in the
same session that charts the map.

The loose idea, in Stanley's words across the last two sessions: a "fun, intuitive,
understandable demo of what is happening" in his compiler, "dense, compact, and
sleek", mono-based, "it should feel like a compiler", while still belonging to the
existing site (retro terminal plus classy serif). Reference tone: the Commit Mono
website (black, mono, numbered nav, keyboard-key footer).

## Current state (2026-09-21)

Repository: `/Users/stanley/Developer/portfolios/stanley-wang`, branch `note-component`
(two committed Note-component commits ahead of `main`, unrelated to this work).

**Everything for the prototype is untracked and uncommitted**:

```text
?? app/projects/mini-c-prototype/
?? components/PrototypeSwitcher.tsx
?? app/projects/odd-one-out/        <- NOT ours; appeared mid-session, untouched
```

No commit, push, or deploy has been authorised. The route 404s in production
(`page.tsx` guards on `NODE_ENV`), so it is safe as-is. Preview:
`http://127.0.0.1:3107/projects/mini-c-prototype?variant=D` via
`npm run dev -- --hostname 127.0.0.1 --port 3107` (a server may already be on that port;
check with `lsof -iTCP:3107 -sTCP:LISTEN`).

**Read first**: `app/projects/mini-c-prototype/NOTES.md`, sections
"Revision D — animated teaching compiler" and "Revision D2 — dense mono restyle and
real-compiler reference". Earlier sections describe superseded A/B/C variants.

### What was done last session (D2)

- `animated.tsx` / `animated.css` rewritten: dense mono layout, line-number gutter,
  numbered phase nav, inverted focus states, Commit-Mono-style key bar
  (space/J/K/R/1–5/E/-/+, Escape leaves editor). Same trace mechanism underneath.
- `trace.ts` gained `toSExpression` and `prettySExpression`; the toy grammar now
  rejects declaration initialisers (`int x = 4;`) because real Mini-C does.
- `reference/` added: for each of the four presets, the **real Java compiler's**
  `.ast` (ASTPrinter), `.sem.txt`, `.dot` + `.svg` (DotPrinter), and `.asm`
  (graph-colouring allocator) where semantic analysis passes. `reference/README.md`
  lists exact commands; `reference.ts` embeds `.ast`/`.sem` for the UI's comparison
  panel. All four toy trees match the real compiler byte for byte;
  `node app/projects/mini-c-prototype/check-trace.cjs` asserts this.
- Verified: trace checks, targeted ESLint, `tsc --noEmit`, Playwright captures at
  1280/390 in light/dark with no console errors and no horizontal overflow. No
  production build was run.

## The decision the map is really about

The toy engine in `trace.ts` (about 500 lines of TypeScript) is **not** Stanley's
compiler and cannot show the parts worth showing. The real compiler lives at
`/Users/stanley/Developer/mcgill/mini-c-compiler` (Java 21, Ant, McGill COMP 520,
about 10.7k LOC plus 14.4k LOC of JUnit tests). Its pipeline: hand-written lexer,
recursive-descent + Pratt parser, sealed AST, name analysis then type analysis,
MIPS32 codegen through a typed assembly IR, naive allocator plus a Chaitin
graph-colouring allocator (per-instruction CFG, fixed-point liveness,
adjacency-matrix interference graph, optimistic 18-colour then 16 + spill).
Runs on MARS 4.5 (`description/part3/Mars4_5.jar`). Part 5 (classes, vtables) is
half done: front end complete, codegen absent, four checkpoint tests `@Disabled`.
That repo also has three uncommitted modified files on `master`; leave them alone.

Existing dumpable IRs that make a showcase cheap: `ast/ASTPrinter` (s-expr),
`ast/DotPrinter`, `regalloc/CFGPrinter`, `regalloc/IGPrinter` (all Graphviz DOT),
`AssemblyProgram`/`Instruction.toString()`. `BasicBlock` keeps previous-iteration
liveness sets; `InterferenceGraph` exposes colouring map and spill set publicly.
The test base `src/test/util/CodegenTestBase.java` has a `CompileOptions` record
with `emit*Dot` flags where an `emitJson` flag would slot in. `MainX.java` and
`build.xml` must not be modified (automarker replaces them); new drivers can live
in `src/test/` or as a separate class.

Previously recommended, not yet decided by Stanley: **precomputed JSON traces** from
the Java compiler over five or six fixed programs, committed to the portfolio, with
the stage animating those frames. No backend. Alternatives were keep-the-toy and a
live Go/Java service. Good showcase inputs in the compiler's `tests/`: `fibonacci.c`
(has a golden AST dump), `parser/count_to_n.c` (13-line loop, readable CFG),
`sortLinkedList.c`, `tictactoe.c`, `oop/class_virtual_dispatch.c` (once codegen exists).

### Constraints that shape the destination

- The course README says the code must stay private and never be shared; there is
  no licence. Publishing generated artifacts (dumps, DOT, asm) for Stanley's own test
  programs is a different act from publishing `src/java`, but Stanley flagged
  publication permission as unresolved and it still is. Do not copy compiler source
  into the portfolio.
- Do not impose a compiler-specific template on other future project showcases
  (music, visual art).
- Keep the site's shell: white / zinc-950, `--font-serif` (Charter) for headings,
  `--font-mono` (Berkeley Mono) for everything else. No coloured washes.
- Follow the repo's `AGENTS.md` (Context7 before framework changes, state side
  effects before edits, `npm` not `yarn`, lint is not run in build).

### Fog worth writing into "Not yet specified" (starting points, not tickets)

- Which stages the final page animates (tokens → AST → sem → codegen → CFG/liveness →
  colouring?) and whether the CFG/IG views are readable at portfolio size.
- Whether live editing survives, or the page becomes a curated example picker.
- Shape of the JSON trace format and where the emitter lives in the Java repo.
- Whether the demo stops at part 4 or waits for part 5 OOP codegen.
- How this page is listed in `PROJECTS` in `app/data.ts` and whether the A/B/C
  variants and `PrototypeSwitcher` get deleted.
- Publication permission for coursework-derived artifacts.

## Tooling notes

- Screenshots: Playwright installed in the session scratch dir wanted Chromium
  1243; only 1208/1217 are cached under `~/Library/Caches/ms-playwright/`. Launch
  with an explicit `executablePath` to
  `chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`.
  The Chrome DevTools MCP is present but no stable Chrome is installed.
- Graphviz `dot` is at `/opt/homebrew/bin/dot`. Java runtime is 25; `ant build` in the
  compiler repo works and puts classes in `bin/`.
- Do not run `npm run build` while the dev server shares `.next`; stale `.next`
  artifacts have caused misleading failures in this repo before.
- Commit messages must carry no AI attribution trailers; a global `commit-msg` hook
  rejects them.

## Suggested skills

- `/wayfinder` — the actual task: name the destination, map the frontier
  breadth-first, create the map and first tickets. Needs an issue tracker; run
  `/forge` first if none is configured (fall back to local markdown otherwise).
- `/grill-with-docs` — wayfinder's charting steps are two grilling sessions; one
  question at a time, with Stanley answering.
- `/prototype` (`~/dotfiles/agents/.agents/skills/prototype/SKILL.md`) — only if a
  ticket later asks "how should it look"; do not regenerate three layouts by rote.
- Context7 (`mcp__context7__*`) — before any Next.js / Motion / MDX change, per
  repo `AGENTS.md`.
- `/handoff` — at the end of the charting session.

## Prior handoff

`/Users/stanley/.codex/handoffs/2026-09-20-compiler-showcase-prototype.md` covers
the D revision, the Fable design review, and boundaries; this document supersedes its
"resume here" section but not its review history.
