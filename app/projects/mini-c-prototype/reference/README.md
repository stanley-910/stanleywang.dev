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

## Register allocation

The allocator's working is recorded inside each `.trace.json` (see "Back end"
below). `RegAllocTrace` can still write a standalone `<name>.regalloc.json`
(`tests/showcase/regalloc.sh <name> [--k N]` in the compiler repo), but none are
stored here and the page doesn't read them.

## Animation traces

`<name>.trace.json` holds the frames the page plays for each example, from the
lexer through register allocation, plus the token list, tree nodes and
`ASTPrinter` output. The examples are recorded with the page's own bundle
(`compiler.js`, `trace(source, registers)`), as `trace.sh` would with the JVM. They are emitted by `src/test/util/ParseTrace.java` in
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
- `data`: the data section as code generation wrote it (strings, globals); the
  allocator's spill slots are each function's `labels`.
- Emit frames (`emit.prologue`, `emit.instr` with an inclusive `from`..`to`
  range, `emit.epilogue`) and Registers frames (`reg.interfere`,
  `reg.simplify`, `reg.spillCandidate`, `reg.select`, `reg.spill`, `reg.retry`,
  `reg.done`). `reg.cfg` and `reg.live` are recorded too, but the page leaves
  them out (`regs-view.ts`).

`tests/showcase/trace.sh <name>` regenerates everything; the page reads only the
trace.
