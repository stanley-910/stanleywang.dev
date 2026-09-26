# Emit phase: structure and Stanley's review (2026-09-25)

Screenshots for this review:
`~/.claude/projects/-Users-stanley-Developer-portfolios-stanley-wang/handoffs/compiler-emit-feedback-2026-09-25/`
(named by the image number and what they show, 159 to 172).

## Design rule

Stanley: "at each point, I want to be able to see the corresponding things
that are happening and why they're happening to the stack, to the AST, the
information flowing through it, to the liveness, etc."

So every emit step answers the same four questions, each in its own place,
and the note says why in a sentence or two:

| Panel | Shows on the step |
|---|---|
| Line | the instruction, lit, in the assembly |
| AST | the node that emitted it; registers it reads travel in, the one it writes appears beside it |
| Stack | `$fp` and `$sp`; a register that holds an address points at its word; a word written shows what went in, then its value |
| Liveness | each virtual register's lane, from the line that writes it to its last read |
| Note | what the line does and why, in plain terms, grounded in the compiler's source |

Nothing moves unless the line changes it. A hover shows where a register is
used (rows, lane, nodes), without replaying its life.

## Per line

| Line kind | Stack | AST | Liveness | Note (DRAFT) |
|---|---|---|---|---|
| `addi $sp,$sp,-4` (first) | a word appears under the caller's | function node | none | "`main` starts by building its stack frame. First it allocates a word (4 bytes) for its caller's frame pointer." |
| `sw $fp,0($sp)` | that word gets `caller's $fp` | function | none | why the caller's `$fp` is saved: the callee must hand the caller its frame back, so it restores `$fp` in the epilogue |
| `addiu $fp,$sp,0` | `$fp ›` lands | function | none | `$fp` marks this frame; offsets count from it |
| `addiu $sp,$sp,-N` | local words appear, labelled | function | none | room for the locals; `main` leaves `-4` empty because it never returns with `jr $ra` |
| `pushRegisters` | dashed `saved` word | function | none | the compiler's placeholder: after allocation, one `sw` per physical register the function uses |
| `addi vN,$fp,off` | `‹ vN` points at the word | name or assignment target | lane starts | "`vN` points at `x`'s word, `off` bytes from `$fp`." |
| `lw vM,0(vN)` | the word is read (outlined) | name | `vM` starts, `vN` ends | "Load the word at `vN` (offset 0, so `x` itself) into `vM`." |
| `li vN,k` | none | literal | lane starts | the constant goes straight into a register |
| `sw vM,0(vN)` | the word shows `vM`, then its value on the next step | assignment | both end | the value is stored in `x`'s word |
| `slt vD,vA,vB` | none | comparison | `vD` starts | "1 (true) if `vA` < `vB`, else 0 (false)" |
| `beqz vD,…` / `j …` | none | while | `vD` ends | where control goes and why |
| `jal f` and the call sequence | caller pushes argument and result words | call | per register | as in Fable's call plan |
| epilogue | words go, pointers return | function | none | why `$fp` and `$ra` come back |

## Stanley's notes (2026-09-25, verbatim)

1. "word, it allocates 4 bytes (word size) for it's caller's frame pointer"
2. "stepping back should have smooth unanimations for states as well, right now its kinda janky. i'm expecting to step back a lot so it should be performant and nice"
3. "would we be better off using caller's $fp instead of old?"
4. "are we the caller or are we main? if we are the caller than just use 'our' frame pointer, and explain why we need to reassign or fp back here, is it for convention to cleanup by caller callee convention?"
5. "should have some notation that the right column is address memory byte offset or explain that more clean"
6. "Make room for `main` declarations, since nothing is explicitly "calling" `main` we don't save the $ra, where the caller would collect the return value from (is this accurate?)"
7. "we should explain push registers better, is it shorthand for what?"
8. "in this state need a card and a column above it to explain that we are going to start keeping track of verlapping Liveness of registers, defined as when a register is in use or something"
9. "I think stack should be draggable and movable, it can be placed on top of anything within the entire simulation"
10. "whats teh diff between dashed v0 and solid v1 outlines here?"
11. "at state 6, we should illustrate how v0 addr -> is POINTING at i's address maybe to the right of the stack itself?"
12. "at state 8 we should show that in the stack  at i -8, : v1, next frame should transform that v1 to a 0."
13. "also emit agent is dead, you can disregard"
14. "again at this state, show that v5 points to i address"
15. "change this text to be more clear something like, point v5 reg to i's address, the nteh next state, load the word at that address with offset of 0 bytes, aka just i's address into v4,"
16. "and then in the slt then state, state 0 / 1 true or false values so we underestand its a conditional."

Register hover: "remove the state replay in the graph and just keep the kind
of A to B animation. In fact, we might not even need that, we might just need
to see where it's utilized. Or the path in which it's utilized. You don't
need the kind of ball going from top to down animation."

## Answers to the questions

- **3, 4. Whose `$fp`.** `main` is the callee here: the startup code calls
  it. The word holds its caller's frame pointer, so "caller's `$fp`" is the
  clearer label. `$fp` is saved by the callee (FunCodeGen's prologue) and
  restored in the epilogue so the caller gets its own frame back; `main`
  exits with a system call, so for `main` it's only the uniform prologue.
- **6. `$ra`.** `$ra` holds the return address (where to jump back to), not
  the return value. The return value goes in the caller's return slot at
  `+4`. `main` never saves `$ra` because it ends with `syscall` 10 instead
  of `jr $ra` (FunCodeGen skips the `$ra` push for `main`). Its `-4` word
  stays empty because MemAllocCodeGen always lays locals out below a word
  kept for `$ra`.
- **7. `pushRegisters`.** Not a MIPS shorthand: the compiler's own
  placeholder (`Instruction.Nullary.pushRegisters`). After allocation,
  GraphColouringRegAlloc replaces it with `addiu $sp,$sp,-4; sw $tN,0($sp)`
  for each physical register the function uses; `popRegisters` becomes the
  matching `lw`/`addiu` pairs in reverse.
- **10. Dashed versus solid badge.** Dashed marks a register that holds an
  address (`v0` = where `i` lives), solid one that holds a value (`v1` = 0).
  The dash is now an arrow (`v0 →`) that pairs with the pointer into the
  stack (11).

## Built (2026-09-25, uncommitted)

- 1, 4, 6, 7, 15, 16: prologue, locals, `pushRegisters`, load/store and
  `slt` notes rewritten (DRAFT) in `explainFrameLine`, `explainLine` and
  `explainMips`.
- 3: the saved word reads `caller's $fp` (`stack-view.ts`).
- 5: the stack header reads `; stack … bytes from $fp`.
- 8: the first line that writes a virtual register opens with a sentence
  on live ranges, and the lanes get a `; live` column head.
- 9, revised: the stack docks in the note card under the step's sentence
  (captions run three lines at most), wider and in 12px. Dragged about 5px
  it pops out into a floating copy that follows the pointer
  (`useDragControls`), keeps its place across steps, and docks again when
  dropped on the note card. Its header reads `stack … $fp offset`. The
  stage no longer places it (`stackAt` removed); phones show it docked.
- `twice`'s unused word: FunCodeGen pushed `$ra` itself, then reserved
  MemAllocCodeGen's whole layout, which also counts the `$ra` word, so one
  word was reserved twice. Fixed in the compiler (Stanley's go-ahead,
  2026-09-25): FunCodeGen reserves `fpOffset + 4` for functions other than
  `main`. The full suite passed headless (492 passed, 49 skipped; the
  uncommitted `e17` typo in RewritePassTests left out). `compiler.js` was
  rebuilt from the working tree, and `reference/function-call.trace.json`
  was regenerated with `util.ParseTrace`. The other presets weren't
  regenerated: the current ParseTrace/RegAllocTrace colour their registers
  differently (loop's `$t0`/`$t1` swap), which would change the regs phase
  already reviewed.
- 10: address badges on the tree read `v0 →` (no dash).
- 11, 14: a register holding a word's address points at it from the right
  of the stack (`‹ v0`) from the line that sets it to its last read
  (`StackPointer` in `stack-view.ts`).
- 12: a word shows what was stored in it: `i = v1` on the storing line,
  then `i = 0` when the value is a known constant (`StackWrite`).
- Register hover: no replay, no travelling badge, no h/l stepping. The
  register's rows, uses, lane and badge stay lit, the nodes that write and
  read it are outlined, and the note says where it is written and read.
- 2: stepping back settles to the earlier state with plain tweens. No
  stagger, badge travel, walk or link redraw, and no badge fade-in again
  (`back` in `animated.tsx`).
- The type pass's tree never goes past the stage's left edge. It slides
  left only as far as that edge; anything still past the right edge stays
  there, and the stage scrolls sideways (`typedOver`, `.ac-scene.scroll-x`,
  on only while something overflows, and it snaps back after). On desktop
  that's loop's last type steps; on a phone, most of the type pass.

### Round 2 (2026-09-25)

- A hovered assembly line brightens its line number instead of drawing an
  outline across the row and lanes. A focused register no longer replaces
  the note with "`v7` is written on line … and read on line …".
- The stack keeps room on the right for the most registers that ever point
  at one word together (`--room`, per function), so `‹ v8 v10` is no longer
  cut off by the note card.
- Emit's tree keeps its size when it's wider than its column; the stage
  scrolls sideways under the assembly, which stays pinned (`.ac-pin-track`,
  `.ac-pin`, sticky), and a step whose node is out of view scrolls it in.
- Generic lines get a terse note decoded from the instruction: its name and
  what it does to its operands (`operandNote` in `explain.ts`; Stanley:
  "this goes into this", addressing through a pointer or at an offset).
  Node-kind notes fall back to it when the line isn't the shape they
  describe. Astra's 61-program corpus had 318 malformed notes ("The the
  operation of `$fp` and `undefined`"); it now has none.
- The browser sweep over Astra's 61 programs (run from Claude's shell,
  since Chromium couldn't start in Astra's sandbox) found and fixed: a
  crash on source over 1,200 characters (`buildTrace` returned no frames;
  the ready frame now comes first), duplicate badge keys when a register
  is written twice (`&&`/`||`; keyed by write line now), and long names
  overflowing their stack word (ellipsis, full name on hover). Still open:
  a 64-int array draws 68 rows in the note card, and `$fp`'s marker can sit
  beside a word already released in the epilogue (Astra F11).
- Stack review by GPT-6 Astra (xhigh): report, scenarios and scripts in
  `~/.claude/projects/-Users-stanley-Developer-portfolios-stanley-wang/handoffs/compiler-stack-review-2026-09-25/`. Summary: fine
  for scalar locals; wrong or missing for structs, arrays, pointer chains,
  byte loads, globals and calls, because the stack infers storage from
  instruction text. Its recommendation is to export the frame layout
  (MemAllocCodeGen offsets, field offsets, array strides) and typed memory
  effects in the trace, then render object groups and a call stack of
  frames.

Not built yet: the call ghost frame, the regs-phase layout on phones, and a
cast rule in the page's shadow parser (ParseTrace handles casts now; the
page needs `compiler.js` rebuilt to use it).

### Round 3: the stack from the compiler's layout (2026-09-25)

Stanley approved Astra's ranks 1–5 ("go ahead"). Built, uncommitted:

- `ParseTrace.layoutJson` (compiler repo, `src/test/util/ParseTrace.java`)
  writes `layout` into every trace: struct fields with byte offsets,
  globals by label, and per function the return slot, parameters and
  locals (nested blocks included) with their `$fp` offsets, sizes and
  types, read off the AST after MemAllocCodeGen has run. `Layout` in
  `trace.ts`. `compiler.js` is rebuilt, so custom programs get it.
- The five saved presets got only the `layout` field added. Their
  instructions match a fresh compile exactly; their register colouring
  doesn't (this build colours loop and function call differently), so the
  reviewed regs frames were left alone.
- `stack-view.ts` is rewritten. Words and names come from the layout
  (`pair.left`, `cells[3]`, `s.a, s.b`, unused locals and parameters
  included); the assembly only says what happens to them. Each virtual
  register's value (constant, address, unknown) is followed through the
  lines, so `**pp = 7` reaches `x`, `cells[i]` resolves when `i` is known,
  and a loaded pointer keeps its target. Control flow joins merge what each
  path left (`11 or 22` after an `if/else`, `?` when unknown), loop heads
  forget what the loop writes, and lines no path reaches change nothing.
  The byte-copy loop of a struct copy is recognised and copies the values.
  `sb`/`lb` touch their word; chars show as `'A'`.
- Calls: argument and result words are named from the callee's layout
  while the call holds them (`twice: n`, `twice: return`); a slot reused
  by a later call gets its new owner and starts empty. On the `jal` line
  the callee's frame shows dashed under `$sp` (caller's `$fp`, `$ra`,
  locals, saved registers). After the call the result is `?`, and locals
  whose address was passed on are forgotten.
- `pushRegisters` reserves one word per register the allocator gives the
  function (`saved $t0`, …), as GraphColouringRegAlloc expands it, so
  offsets below it are real.
- Arrays over six words fold their middle into one row
  (`large[2…62]`), keeping the first two, the last and any word a line
  touches: the 64-int array is 8 rows. Globals a function uses sit under
  the stack after a `.data` gap. Address formation is no longer drawn as a
  read. Epilogue words stay (dashed, "released") until the restore that
  reads them.
- Notes name the word: "`sw` stores `v5` into the word `v4` points at,
  `pair.right`", "`addiu`: `v3` + `4` goes into `v4`, the address of
  `pair.right`", "The argument `v8` goes into it: `f`'s `a`". The locals
  line counts from the layout ("Room for `cells` (16 bytes) and `i`"), and
  `pushRegisters` says which registers it will save.

Checked: all 61 scenarios through the page's pipeline with the new bundle
(every touched word and live pointer has a row, no malformed note); in
the browser, the function-call `jal` step and a custom struct copy plus
`**pp` program.

Open: values are what the code computes when every input is known; a
real runtime trace (Astra rank 8) would be needed for recursion or loop
iterations. Callee frames at a call are a preview, not a nested
simulation.

### Round 4: compiler tags instead of inference (2026-09-25)

Stanley: the stack should show how the caller and callee build and
allocate the frame, not the values the program computes, and that
knowledge already lives in the compiler. Built, uncommitted:

- Compiler worktree `~/worktrees/mini-c-compiler/2026-09-25_emit-tags`
  (branch `emit-tags`, from `master` plus the uncommitted work from the
  main checkout). Record-only hooks, null in normal compilation:
  - `CodeGen.tagObserver` / `tag(role, facts…)`: every emit site says what
    its line is for (`reserve`/`save`/`set-fp`/`restore`/`release` in the
    prologue and epilogue, `addr`/`load`/`store` with the expression,
    `reserve for arg` with the callee's parameter, `call`, result
    `load`/`addr`, `copy.*` for each line of `emitStructCopy`, which gained
    an overload naming what is copied into what).
  - `GraphColouringRegAlloc.rewriteObserver`: what each instruction became
    (pushRegisters as its pushes, spill loads and stores).
  - `ParseTrace` writes both per instruction (`tag`, `out`). An expression
    becomes its place: declaration node, byte offset when static
    (`pair.right`, `cells[2]`), or `through` a pointer (`*p`, `q[i]`).
  - Suite, headless with the shim: 492 passed, same as before the hooks.
- `compiler.js` rebuilt with `MINI_C=<that worktree> build.sh`. The
  default `MINI_C` is still the main checkout, which has no hooks: rebuild
  from the worktree until they land there.
- The six presets are regenerated from the worktree. Instructions are
  unchanged; precedence, parentheses, local-variable and loop now show the
  current compiler's register colouring.
- `stack-view.ts` no longer simulates values. `$sp`/`$fp` move as the
  lines say; a register holds an address from the line tagged as forming
  it; loads, stores and copies touch the words their tags name (a whole
  object when the offset isn't static, nothing through a pointer);
  argument and result words are owned from the `reserve` tags; saved
  registers come from the allocator's own expansion. The stack cell shows
  the stored register (`← v5`) on its store line only.
- Notes read tags: frame lines, call runs, struct copies (new DRAFT copy,
  one sentence per line of the byte loop), struct returns.
- A struct result is copied out after the call's words come off the
  stack: for `a = make(3)` the caller pops (`addi $sp,$sp,12`), then
  byte-copies from below `$sp`. Not a bug here: nothing runs in between
  that could write there (MARS has no asynchronous interrupts on), and
  when the result goes straight into another call's argument
  (`sum(make(5))`) the new argument slot overlaps it, which is why that
  copy runs high to low (`emitStructCopy`'s `reverse`). The stack shows
  the popped words dashed until the loop ends.
- Committed on `emit-tags`: `853c0e8` (the main checkout's uncommitted
  work, as it was) and `7f78379` (the hooks). `RewritePassTests`' `e17`
  typo is left uncommitted in the worktree.

Checked: 61 scenarios plus the presets and a struct/pointer program
through the bundle and the page's pipeline (every memory and frame line
tagged, every known-place access on a row, every reserved argument and
result owned, saved registers equal the allocator's output, no malformed
note); in the browser, function-call, loop (emit and regs) and the
struct/pointer program, no console errors.

Open: the regs view still shows `pushRegisters` as a placeholder; `out`
could show the real pushes and spill code there.
