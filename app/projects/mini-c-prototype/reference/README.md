# Reference outputs from the real compiler

Artifacts only. Each example on the page is a `.c` program and the
`.trace.json` the compiler in `~/Developer/mcgill/mini-c-compiler` writes for it;
`../reference.ts` lists them. No compiler source is copied here.

The `parentheses` and `local-variable` examples, every `.asm` and every
`.regalloc.json` were deleted on 2026-09-28, and the older `.ast`, `.sem.txt`,
`.dot` and `.svg` outputs with their `DotDump.java` driver on 2026-09-29:
nothing read them. A trace's `ast` field still holds the `ASTPrinter`
s-expression, which `../check-trace.cjs` compares with the toy's tree.

Grammar note found while generating these: real Mini-C rejects initializers in
declarations (`int x = 4;` fails with `expected (SC) found (ASSIGN)`). The sketch
was changed to reject them too.

## Register allocation traces

`RegAllocTrace` can write `<name>.regalloc.json` (no longer stored here), recording the graph-colouring allocator step by step for each
program that passes semantic analysis: per function, the CFG (one block per
instruction), every liveness sweep, the interference graph, and the simplify/select
colouring order. `loop.k2.regalloc.json` is the same program with the palette capped
at two registers so two virtual registers spill. Regenerate from the compiler repo:

    tests/showcase/regalloc.sh <name> [--k N]      # writes tests/showcase/out/<name>.regalloc.json

The dumper (`src/test/util/RegAllocTrace.java`) re-implements the liveness and
colouring loops to record them and asserts its results equal the allocator's own
before writing anything.

## Animation traces

`<name>.trace.json` holds the frames variant D plays for each preset: Tokens, Parse
and Check phases, plus the token list, tree nodes and `ASTPrinter` output. They are emitted by `src/test/util/ParseTrace.java` in
the compiler repo, which does not instrument the parser: it derives the frames from
the token stream and the AST's token anchors, so the tree shape is the parser's own.

    tests/showcase/trace.sh <name>      # writes tests/showcase/out/<name>.trace.json

`spilling.trace.json` is compiled with the allocator's palette capped at four
registers (`GraphColouringRegAlloc.registerLimit`), so a five-term sum spills:
`trace.sh spilling --registers 4`, or `trace(source, 4)` in `compiler.js`. The
page compiles that example with the same cap (`reference.ts`, `registers`).

`reference.ts` imports these directly; `source` and `ast` for each preset come
from the JSON, so regenerating the trace regenerates the preset.

Each frame also carries `why`: the decision behind the frame as ids and facts
(`{"kind": "parse.wait", "node": 2, "child": 3}`), matching the `Why` union in
`trace.ts`. The page turns these into sentences in `explain.ts`.

Each token also carries `reads`: every character the tokeniser read on its way to
it (the whitespace and comments before it, its own characters, the one it looked at
to see where it ends) and any error it reported, with what it decided at each, as
`Tokeniser.readObserver` hears them. The detailed lexer mode plays these (`detail.ts`).

## Back end in the same trace (2026-09-22)

`<name>.trace.json` now continues past Check for every program that passes
semantic analysis. `ParseTrace` runs the real code generator with an inert
observer hook (`gen.CodeGen.visitObserver`, null in normal builds) so each
emitted MIPS instruction is tied to the AST node whose visit produced it, then
records the graph-colouring allocator with the same recorders `RegAllocTrace`
uses. The JSON gains:

- `instructions`: the real MIPS lines on virtual registers, in order, each with
  `node`, `fn`, `dest`, `args`, and any preceding `labels`.
- `backend`: per function, the CFG blocks, liveness sweep by sweep, the
  interference graph, and the simplify/select steps, checked against the
  allocator's own result before writing.
- `registers`: the final virtual-to-physical map.
- Emit frames (`emit.prologue`, `emit.instr` with an inclusive `from`..`to`
  range, `emit.epilogue`) and Registers frames (`reg.cfg`, `reg.live`,
  `reg.interfere`, `reg.simplify`, `reg.select`, `reg.spill`, `reg.done`).

`tests/showcase/trace.sh <name>` regenerates everything; the page reads only the
trace.
