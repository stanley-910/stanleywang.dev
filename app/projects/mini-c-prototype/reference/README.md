# Reference outputs from the real compiler

Artifacts only. Generated on 2026-09-20 (regenerated 2026-09-21 with two programs added) from the Java Mini-C compiler in
`~/Developer/mcgill/mini-c-compiler` (built with `ant build`, Java 25 runtime).
No compiler source is copied here; `DotDump.java` is a 15-line scratch driver
that only calls the compiler's public `Tokeniser`, `Parser`, and `DotPrinter`.

Programs (the six examples shown on the site's prototype variants):

| File | Source | Notes |
| --- | --- | --- |
| `precedence.c` | animated preset | `4 + 2 * 3` |
| `parentheses.c` | animated preset | `(4 + 2) * 3` |
| `local-variable.c` | animated preset / fixtures "Arithmetic" | declare, assign, return |
| `unresolved-name.c` | animated preset / fixtures "Semantic error" | sem fails on purpose (4 errors) |
| `loop.c` | fixtures "Loop" | `while` with two locals; readable CFG |
| `function-call.c` | fixtures "Function call" | two functions, one call |

Regenerate everything at once with the staged driver kept in the compiler repo
at `src/test/util/StagedRun.java` (outside the ant build, so compile it once):

```sh
cd ~/Developer/mcgill/mini-c-compiler
ant build && javac -cp bin -d bin/test src/test/util/StagedRun.java
for n in precedence parentheses local-variable unresolved-name loop function-call; do
  java -cp bin:bin/test util.StagedRun "$R/$n.c" "$R" --no-pause --sem
  java -cp bin Main4 -sem "$R/$n.c" > "$R/$n.sem.txt"
  java -cp bin Main4 -gen colour "$R/$n.c" "$R/$n.asm"   # skip when sem fails
done
```

Per-file equivalents, for each `<name>.c`:

| File | Command (run from the compiler repo, `bin/` on classpath) |
| --- | --- |
| `<name>.ast` | `java -cp bin Main4 -ast <name>.c <name>.ast` (ASTPrinter s-expression) |
| `<name>.sem.txt` | `java -cp bin Main4 -sem <name>.c` (stdout) |
| `<name>.dot` | `java -cp bin:<dir with DotDump.class> DotDump <name>.c <name>.dot` |
| `<name>.svg` | `dot -Tsvg <name>.dot -o <name>.svg` |
| `<name>.asm` | `java -cp bin Main4 -gen colour <name>.c <name>.asm` (graph-colouring allocator) |

`unresolved-name` has no `.asm` because semantic analysis fails, which is the point of that preset.

`../reference.ts` embeds the `.ast` and `.sem.txt` contents so the UI can diff
the sketch's tree against the real one. Regenerate it with the node one-liner in
the session that produced it, or by hand, whenever a preset changes.

Grammar note found while generating these: real Mini-C rejects initializers in
declarations (`int x = 4;` fails with `expected (SC) found (ASSIGN)`). The sketch
was changed to reject them too.

## Register allocation traces

`<name>.regalloc.json` records the graph-colouring allocator step by step for each
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
and Check phases, plus the token list, tree nodes, `ASTPrinter` output and the
semantic analyser's lines. They are emitted by `src/test/util/ParseTrace.java` in
the compiler repo, which does not instrument the parser: it derives the frames from
the token stream and the AST's token anchors, so the tree shape is the parser's own.

    tests/showcase/trace.sh <name>      # writes tests/showcase/out/<name>.trace.json

`reference.ts` imports these directly; `source`, `ast` and `sem` for each preset come
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

`tests/showcase/trace.sh <name>` regenerates everything; the separate
`.regalloc.json` files stay as standalone artifacts but the page reads only the
trace.
