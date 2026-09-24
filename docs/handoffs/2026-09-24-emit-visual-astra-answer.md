I’d **keep the tree, show virtual registers travelling between its nodes, and use a small stack column to explain storage**. The stack supports the expression story; it shouldn’t take over Emit.

This was a read-only review; nothing changed.

Emit represents **code being generated**. Label the stack **“frame layout”** and any call animation **“call preview”**. Show symbolic locations and register names, without updating variables as though the program were running.

Keep the editor left. Within the stage, give assembly roughly 55% of the width. The remaining area holds the active statement’s subtree above a 150px-wide stack column. Retain a faint ancestor path to `main`; move between subtrees without shrinking the entire tree into illegibility. On narrow screens, place this working area above assembly.

Keep the stack’s footprint stable. Brighten it during setup, addresses, loads, stores, calls, and restoration; dim it during arithmetic. Use ordinary ink for connections, inverted ink for current instructions, a brief green pulse for a newly produced register, and rust only for errors. Outlined badges mean **“address”**; filled badges mean **“value”**.

The stack should follow the actual instructions, including this compiler’s unusual gaps. For `loop`, from higher to lower addresses:

| Offset | Cell |
|---|---|
| `+4($fp)` | `return` |
| `0($fp)` | `saved FP` |
| `-4($fp)` | `unused` |
| `-8($fp)` | `i` |
| `-12($fp)` | `sum` |
| below | dashed `saved regs` |

Use arrows labelled **SP** and **FP**, plus **“lower ↓”**. The `return` slot is a recorded destination; don’t invent caller setup for `main`.

The instruction effects are precise:

- `addi $sp,$sp,-4`: SP descends one word; `sw $fp,0($sp)` fills that cell without moving either arrow.
- `addiu $fp,$sp,0`: FP joins SP and becomes the fixed offset origin.
- `addiu $sp,$sp,-12`: SP descends across the unused word and two locals. Label the locals from declaration metadata.
- `pushRegisters`: introduce a dashed region of **unknown size**. Show SP below it with `size pending`; don’t assign it a fictitious numeric offset.
- `addi v0,$fp,-8`: connect `i`’s cell to an outlined `v0` badge. Neither pointer moves. Loads and stores connect through that address.
- `popRegisters`: remove the symbolic save region. `addi $sp,$fp,4` moves SP upward; `lw $fp,0($fp)` restores the caller’s FP.

[FunCodeGen](/Users/stanley/Developer/mcgill/mini-c-compiler/src/java/gen/FunCodeGen.java:55) skips saving `$ra` for `main`, but saves it for every other function, including leaf function `twice`. `twice` also reserves an unused word below its saved `$ra`. Preserve these details. The current [prologue explanation](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/explain.ts:368) mistakenly counts the initial four-byte push as local storage; `loop` actually reserves twelve bytes after setting FP, eight belonging to locals.

For granularity, use **operation blocks within statements**. A literal and its surrounding operation can arrive together; multiplication deserves a checkpoint; an assignment’s final store deserves another. Avoid one stop per assembly instruction, but also avoid swallowing an entire nested expression in one step.

When an expression produces `v14`, its badge stays beside that node until its parent needs it. Copies of operand badges travel along the existing child edges; the parent gains its result badge. This shows register dependencies, without calculating runtime values. Keep `mult` and `mflo` together; their expanded detail can show the intermediate **LO** register.

Here is the proposed `loop` sequence. Instruction numbers refer to the current recorded assembly, starting at one.

| Frame | Instructions | What appears |
|---|---:|---|
| 1 | 1–3 | **“save frame”**: old FP enters its cell; new FP anchors there. |
| 2 | 4–5 | **“locals”**: `i` and `sum` acquire slots; the dashed save region appears. |
| 3 | 6–8 | **“store”**: `i`’s address becomes `v0`; literal `0` becomes `v1`; their paths meet at `i`. |
| 4 | 9–11 | The same compact block connects `v3` through address `v2` to `sum`. |
| 5 | 12–15 | **“test”**: `i → v4` and `3 → v6` feed `<`, producing `v7`. A loop-start anchor appears. |
| 6 | 16 | **“if zero”**: a branch connector reaches a hollow future exit anchor. |
| 7 | 17 | **“address”**: `sum`’s destination becomes outlined `v8`, held beside the assignment. |
| 8 | 18–19 | **“load”**: the existing `sum` value gets `v9`, waiting beside `+`. |
| 9 | 20–24 | `i → v11` and `2 → v13` feed `×`; its two instructions produce `v14`. |
| 10 | 25 | `v9` and `v14` travel into `+`; `v15` appears. |
| 11 | 26 | **“store”**: `v15` meets held address `v8`; the `sum` cell pulses. |
| 12 | 27–31 | `i`’s destination becomes `v16`; loaded `v17` and literal `v19` feed `+`, producing `v20`. |
| 13 | 32 | **“store”**: `v20` connects through `v16` to `i`. |
| 14 | 33 | **“repeat”**: the backward jump connects to the existing test anchor. |
| 15 | 34–37 | The exit anchor becomes solid; `sum → v21` connects to the return slot, then the epilogue target. |
| 16 | 38–42 | **“restore”**: save region disappears, pointers restore, then **“exit”** accompanies the syscall. |

Draw branch connectors in the assembly gutter. Keep literal labels in the code, with terse **“test”** and **“exit”** aliases beside them. A forward target stays hollow until emitted. These are possible control paths; don’t animate another loop iteration.

For `function call`, preserve emission order: the compiler writes `twice`, then `main`. At `jal twice`, offer a bounded **“call preview”**:

1. Keep `main` above; push argument `6`, then reserve the return slot. Caller FP stays fixed.
2. Extend `twice` below: saved FP, saved RA, unused word, dashed saves. Its FP makes `n` sit at `+8` and the return slot at `+4`.
3. Show its two loads feeding `+ → v4`; its store targets that shared return slot.
4. Restore `twice`’s saves, SP, RA, and FP in emitted order; `jr $ra` connects back after `jal`.
5. `lw v6,0($sp)` reads the result; SP rises eight bytes to release argument and return space.

The same cells remain visible across the change of frame, making caller and callee offsets understandable.

Existing fields already support much of this:

| Data | Use |
|---|---|
| `why.node/from/to`, `instructionCount`, `span` | Reveal blocks and tie source to assembly. |
| `instructions.node/fn/dest/args/labels` | Attribute instructions, connect register definitions and uses, locate labels. |
| AST children and `frame.links` | Find statement owners and declaration identity. |
| `backend.functions[].blocks` | Verify control-flow connections. |

Page-side code can parse supported instruction forms for immediates, memory operands, and jump targets: `args` contains register uses, **not complete operands**. Track symbolic addresses through registers. Treat unsupported forms as unknown.

Enrich `ParseTrace`, without changing the generator, with declaration slots `{decl, fn, offset, size, role}`, function return-slot metadata, and structured operands. This avoids guessing unused declarations’ storage from later accesses. Normalize presentation blocks into instruction ranges, input/output registers, and symbolic effects. Every pose must reconstruct from its frame for seeking and reduced motion.

Repurpose automatic declaration links: during an address operation, briefly light the declaration’s offset, then connect the use to its **stack cell**. Keep the full declaration arrow on hover. Repeating name-resolution flights adds little.

Match the editor’s monospace size and **19px row height**; assembly currently inherits 22px. Use matching gutter marks and reciprocal hover highlights, without forcing source and assembly rows to align. Put labels on separate rows.

Let active bookkeeping blocks open, then fold into **“setup”** and **“restore”**. Preserve dashed placeholders until Registers. That phase retains assembly while badges acquire physical names. At completion, expand placeholders using recorded rewritten instructions and paired save sets—the current trace lacks this expansion. Record actual output rather than guessing; this allocator also places spills in static storage, not stack slots.

Useful ideas to borrow:

- [Compiler Explorer](https://godbolt.org/): reciprocal source/assembly highlighting.
- [Python Tutor](https://pythontutor.com/visualize.html/mode): stable frame identities and reversible state.
- [Cornell instruction-selection diagrams](https://courses.cs.cornell.edu/cs412/2001SP/lectures/lec17.pdf): subtree-to-instruction groups connected by temporaries; borrow the visual relationship without implying this compiler implements tiling.

The smallest worthwhile build is the register badges and their movement, statement grouping, branch connectors, and a compact slot column for `loop`. Keep saves symbolic. Add the call preview and actual placeholder expansion afterward.

