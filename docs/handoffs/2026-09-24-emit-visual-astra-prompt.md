# Prompt: make the emit (code generation) phase visible

## Context

`/projects/mini-c-prototype` is an animated walkthrough of a small C compiler
(tokens → parse → check → emit → regs). Audience: portfolio visitors, many of
them engineers who have never written a compiler. Each frame shows one step on
a stage (the AST, drawn as a tree) plus a short note under the code editor.

Parse and check now show their decisions on the stage instead of narrating
them (Pratt precedence in the tree; name links landing on declarations; type
badges beside nodes). See `docs/handoffs/2026-09-24-parse-visual-astra-answer.md`,
`docs/handoffs/2026-09-24-check-visual-astra-answer.md`, and the "Type pass"
section of `docs/handoffs/2026-09-24-compiler-showcase-live-markup.md`.

Emit has not had that treatment. Today: the tree shrinks to the left half, an
assembly pane fills the right half, and each frame appends one AST node's
instructions (`emit.instr {node, from, to}`), highlighting them and the node.
The loop preset has 27 emit frames: one `emit.prologue` ("main: frame set up,
5 instructions"), ~25 `emit.instr`, one `emit.epilogue`. It reads as a log.

The code is the real compiler's output on **virtual registers** (`v0`, `v1`,
…) with two placeholder pseudo-instructions, `pushRegisters` and
`popRegisters`, that the next phase (register allocation) expands into real
saves and restores. A new two-slide intro (`PHASE_SLIDES.Emit` in
`explain.ts`, draft copy) tells the viewer we sweep over assembly bookkeeping
for now and add it back "a block at a time as we go".

## What the author is thinking (not decided)

1. **A stack visualizer.** During a call the stack pointer and frame pointer
   move: the prologue pushes `$fp`, sets `$fp = $sp`, pushes `$ra`, reserves
   locals, pushes saved registers; the epilogue undoes it. The author imagines
   a small call-stack column with `SP` and `FP` arrows sliding as the
   instructions run, like the attached lecture slides (call stack with caller
   frame: arguments, return value; callee frame: frame pointer, return address,
   local variables, saved registers). Locals would get their slots, e.g.
   `i` at `-8($fp)`, `sum` at `-12($fp)`. The slides are reference, not a spec.
2. **Blocks, not single lines.** "Add it in blocks as we go": maybe one step
   per statement (its instructions arrive together), then details are expanded
   later. `pushRegisters`/`popRegisters` stay placeholders until regalloc.
3. **Assembly styling.** Make the assembly pane one-to-one with the code
   editor: same font size, same tighter line spacing. The author is not sure.
4. **Links during emit.** Name links (use → declaration, drawn in the check
   phase) still shoot out during emit whenever an identifier node is focused.
   Is that a leftover to hide, or useful (the declaration is where the stack
   slot, `-8($fp)`, comes from)?

## Read these (read-only; do not edit anything)

Working directory: `/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase`

- `app/projects/mini-c-prototype/animated.tsx`: page and stage. Look for
  `late`, `ac-asm`, `shownInstructions`, `currentRange`, `emit.`, and the
  `frame.links` drawing (search "Only the step's own binding").
- `app/projects/mini-c-prototype/animated.css`: `.ac-asm`, `.ac-ins`, and the
  editor styles (`.ac-editor`, `--row`).
- `app/projects/mini-c-prototype/trace.ts`: frame model (`emit.*` kinds,
  `instructions`, `backend`).
- `app/projects/mini-c-prototype/explain.ts`: notes per frame and the Emit
  slides.
- `app/projects/mini-c-prototype/reference/*.trace.json`: recorded traces for
  the six presets (loop, local variable, function call, precedence,
  parentheses, unresolved name). Look at their Emit frames and
  `instructions`. `function call` has a caller and a callee.
- The real compiler's code generator (read-only; the author will not patch
  it, though the trace recorder `src/test/util/ParseTrace.java` can record
  more): `~/Developer/mcgill/mini-c-compiler/src/java/gen/*.java`
  (`FunCodeGen`, `StmtCodeGen`, `ExprValCodeGen`, `ExprAddrCodeGen`,
  `MemAllocCodeGen`), and `src/java/regalloc/` for how the placeholders expand.
- Attached images: six lecture slides (call stack recap, callee-save
  convention, prologue/epilogue, callee and caller assembly examples, heap /
  stack / static storage), then screenshots 18–21 of the current emit stage
  (a day old; the canvas has since grown, the emit stage looks the same).

## Questions

1. Propose a concrete emit stage, frame by frame: what the viewer sees
   (layout, motion, labels, colour) and which frame fields drive it. Should
   the tree stay, shrink, or give way? Where does a stack column go, and does
   it earn its space on every frame or only on prologue/epilogue/loads/stores?
2. The stack visualizer: which cells, which arrows (`SP`, `FP`), what moves on
   which instruction, how locals get labelled with their offsets, how a call
   (the `function call` preset) shows caller and callee frames. What data does
   the trace need, and what can be derived page-side from the instruction
   text (`addi $sp,$sp,-4`, `sw $fp,0($sp)`, `addi v0,$fp,-8`)? Keep it
   honest to what this compiler actually emits, including its placeholders.
3. Granularity: one step per instruction, per AST node, or per statement
   ("blocks")? How should nested expressions show that a value lands in a
   virtual register and is consumed by its parent (e.g. `sum + i * 2`)? How
   do labels and jumps for `while` read (`beqz … label_3_while_end`,
   `j label_2_while_start`)?
4. How to present the "sweep over the fine print, add it back in blocks"
   idea on screen: e.g. collapsed prologue/epilogue blocks that expand later,
   `pushRegisters`/`popRegisters` drawn as visibly unexpanded placeholders
   that regalloc opens up. What is the handoff into the Registers phase?
5. Assembly pane styling: match the code editor exactly, or not? Should the
   source line and its assembly be visibly tied (hover, colour, gutter)?
6. Links to declarations during emit: hide, keep, or repurpose (e.g. land on
   the declaration and show its stack offset)?
7. Walk through the `loop` preset frame by frame in your design, in plain
   words, and sketch the `function call` preset's call and return.
8. Name good prior art (Compiler Explorer, Python Tutor, textbooks, course
   visualizers) and the specific idea worth borrowing from each.
9. What is the smallest version worth building first?

Keep the answer concrete and under ~1500 words. Plain language. On-stage
labels and cues must be terse (one or two words).
