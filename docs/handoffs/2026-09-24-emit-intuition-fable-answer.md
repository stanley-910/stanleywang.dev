# Emit phase: intuitiveness review (Fable 5.1)

Verdict first. Keep the stack column, but make it a teaching device that speaks at six moments instead of a memory map that twitches on every instruction. The bigger problems are elsewhere: play holds every emit step for the same 680 ms whatever the step animates, so the badge funnelling and the call's stack moment are cut off mid-flight, and the loop tree is scaled to about 6 px labels in the emit stage, so the badge system cannot be read on the one preset that needs it. Fix pacing and tree focus first, then the stack, then the lanes.

## Basis

- **State reviewed:** the uncommitted worktree as of today. The Registers listing was restyled to the column grid while I read (`animated.tsx:2710`, `animated.css:1027`), and my captures already show it, so the handover finding below is about the jump and the empty half, not row style.
- **Captures:** the built-in browser tool could not launch Chrome, so a Playwright script drove the cached Chromium instead. Function call steps 60 to 75 and loop steps 110 to 137 at 1280×820, both slides, play at 1× from the first emit step with the counter observed, loop at 1000 and 820 wide, and `?emit=log`. Files are in the session scratchpad under `shots/`, with `SUMMARY.md` listing every frame's note and rows.
- **Frame numbers:** function call emit is steps 62 to 71, regs from 72. Loop emit is steps 112 to 133, regs from 134.
- **Measured play hold:** every emit and regs step held 684 to 704 ms at 1×, on both presets. That matches `animated.tsx:1085` to `1096`, where only lexer characters and the names-done step get a different hold.
- **Not verified:** my instruction-hover capture did not register, so hover is judged from `instructionHover` in `explain.ts:576`. Reduced motion and dark mode were not checked.

## 1. The stack: keep it, and explain it at six moments

**Why not cut.** Twenty-two of loop's 42 lines touch the frame. Without the column, every `-8`, `-12` and `4($fp)` is a magic number and the note would have to carry a picture in words. The column is the right device; today it is just unexplained and too busy.

**What is wrong today.** Cells `n +8` and `ret +4` appear on the prologue step before anything says what they are, and `ret` is a cryptic label. The five-cell prologue flashes `old $fp` and `$ra` green while the note never names them. Offsets are unsigned faint numbers with no hint that they count from `$fp`. Above all, the one moment where the column would earn its space is invisible: at step 69 the pushed `arg` and `ret` cells appear below `saved` and are gone again inside the same step, so the settled frame shows nothing of the call. Compare `function-call-play-013.png` with `function-call-f069.png`. And because `twice` is emitted before `main`, the viewer meets `n` at `+8` five steps before seeing anyone push it.

**What a viewer must come away with,** one moment each:

| Fact | Moment | What the column does | Note (DRAFT) |
|---|---|---|---|
| `$fp` is planted once and never moves; `$sp` moves. Saving the old `$fp` and `$ra` is how the caller's frame is found again. | prologue, fc 62 and 67, loop 112 | cells grow in with their rows, as now; `$fp ›` lands with `addiu $fp,$sp,0`; `saved` arrives dashed | "`twice` starts by building its frame. It saves the caller's `$fp` and plants its own: from here on every local and argument is a fixed distance from `$fp`, while `$sp` keeps moving. It also keeps `$ra`, the address to return to. `saved` is room for registers; the allocator decides how many." |
| A local lives in the frame at a fixed offset, so every use is `addi` then `lw`. | first local address, loop 113; first local load, loop 117 | the cell outlines and its offset goes ink | 113: "`i = 0` needs somewhere to put the 0: `i`'s word in the frame, 8 bytes below `$fp`. `addi v0` holds that address and `li v1` the value." 117: "`i` is loaded from the frame again: `addi` for the address, `lw` for the word. `3` needs no memory, so `li` puts it straight into `v6`." |
| The words above `$fp` are the caller's: the return slot at `+4`, arguments above it. That is why `n` is at `+8`. | fc 63 | `n` and `return` sit under a `; caller` head; `n` outlines | "`n` isn't in a register. The caller left it in the frame, above the return slot and the saved `$fp`: 8 bytes up from `$fp`. Each side of `+` loads it again, into `v0` and `v2`." |
| The result goes back through the caller's slot. | fc 65 and 70, loop 132 | `return` tints green, the one green in the phase besides writes | "The result goes into the return slot, the word just above the saved `$fp`, where the caller reserved it. Then `j` skips to the exit code." For `main`: "`main`'s caller is the system, so nobody reads this word; the exit is the system call." |
| A call is: push arguments, reserve the result, jump; the callee's frame grows right below; pop both. | fc 69 | see the ghost frame below | "A call in three parts. Before: `main` pushes the argument and reserves a word for the result. `jal twice` jumps in and `twice` builds its frame right below, so what `main` pushed is what `twice` saw as `n` and its return slot. After: `main` reads the result into `v6` and pops both words." |
| The epilogue undoes the prologue. | fc 66 and 71, loop 133 | `saved` goes, `$sp` slides up to `return`, `$fp ›` fades as the caller's comes back | "`twice` is done. It drops its frame: `$sp` goes back up to the return slot, `$ra` and the caller's `$fp` come back from where the prologue saved them, and `jr $ra` returns. The result stays in the slot for `main` to read." |

**The call ghost.** At step 69, keep today's push of `arg` and `return` below `saved`. On the `jal` row, a second frame slides in below them in muted dashed cells: `old $fp`, `$ra`, a blank word, `saved`, with a muted second `$fp ›` on its `old $fp` and a `; twice` head. The two pushed cells gain a second, muted name on their right: `n +8` and `return +4`, the exact words `twice`'s own column used. On `lw v6,0($sp)` the `return` cell outlines. On `addi $sp,$sp,8` the ghost and both cells fold away. This is Astra's call preview cut to its minimum: one frame outline, no replay of `twice`. It needs the callee's first pose, which `stackFrames` already computes per function in `stack-view.ts:41`, and it needs the step to be held long enough, which is the pacing fix in section 2.

**Cell and column changes.** Header `; frame`, since everything in it is measured from `$fp`, with `; caller` and `; twice` heads in the same comment style as `; prologue`. Rename `ret` to `return`. Signed offsets: `+8`, `+4`, `0`, `−4`. Offsets stay faint except on the touched cell, where they go ink for that step. The blank word stays blank with its offset; the prologue note says "and one spare word" once. The frame boundary line at `old $fp` is 1 px ink today and disappears under the green tint (`animated.css:1145`); with the `; caller` head it can go.

**Left out on purpose.** No values in cells, ever. No `$sp` movement inside `pushRegisters`, since the size is unknown; the dashed cell says so. No heap or static storage. No replaying `twice` inside the call.

## 2. The rest of emit, ranked by impact

1. **Play cuts every animation short.** A block's rows arrive over 0.42 s plus 0.147 s per row (`rowStagger`, `animated.tsx:1519`, applied at `2561`), and a read badge then travels for 0.63 s (`travel`, `animated.tsx:2321`). The hold is 680 ms flat. So on step 64 the two `n` badges are still sliding when step 65 starts, and on step 69 the six-row call block plus `v5`'s travel run about 1.8 s into a 0.69 s hold: `function-call-play-014.png` shows `v6` and `v5` drawn over the `twice()` label after the step has already moved on. This is the mechanical cause of "the funnelling went by too fast". Derive the hold from the same numbers: base plus rows times stagger, plus travel when any badge is spent, plus a beat when stack cells appear. The names-done step already does this kind of sum at `animated.tsx:1089`.

2. **The loop tree is unreadable in emit.** The tree gets a third of the stage (`emitTree`, `animated.tsx:1299`) and scales uniformly, text included, so at 1280 wide loop's labels are about 6 px and the badges scale with them (`width * fit`, `animated.tsx:2308`). See `loop-f120.png`: `v8` beside `sum =` is a smudge. A viewer cannot see the one thing this phase is about. Do not scale below about 0.8: pan instead. Lay the tree out at check size, translate it so the current statement's subtree is centred in the tree column, clip the rest, and fade the path up to `main`. Motion tweens the translate, so stepping reads as the camera moving down the program.

3. **The notes are tooltips, not the story.** Almost every emit note opens with the instruction text, which is already highlighted two columns to the right, and describes the instruction rather than the idea. The twin loads at step 63 read "`lw v0,0(v1)` loads `n` from its slot, and `lw v2,0(v3)` loads `n` from its slot" (`explainBlock`, `explain.ts:504`). Once hover lights the row and source, notes should say what and why: "Both sides of `+` are `n`, and each side loads it again from the frame. The compiler doesn't yet know one register could serve twice." Vary by first and later occurrence: the first load of a name explains the frame, later ones say "loads `i` again".

4. **Copy errors that mislead.** The prologue note says `twice` and `main` "reserve 4 bytes for locals" and loop "12 bytes for locals"; neither function has locals and loop has 8 bytes of them. `explain.ts:386` to `396` counts the compiler's spare word. Say "makes room for `i` and `sum`, and one spare word", or drop the byte count. The call note says the result is read "into `$sp`" (`explain.ts:543` uses the block's last dest, which is `addi $sp,$sp,8`); it should name the `lw`'s dest, `v6`. Slide 2 promises "we'll add the details back a block at a time as we go"; the page never expands the placeholders, so say instead that they stay placeholders because the allocator decides how many registers to save.

5. **The handover to regs drops everything at once.** Between step 71 and 72 the tree, the stack and the current block vanish, and the assembly jumps from the centre to the right half, leaving the left half empty (`function-call-f072.png`, `loop-f134.png`). The two phases render different elements (`animated.tsx:2622` and `2710`), so React remounts the pane and every row re-enters. Render one pane for both phases and switch its class; fade the stack column out on the first regs step and tween the pane's right edge into its space. The left half is where the CFG boxes from the Opus plan go; until then keep the tree, muted. The header also reads `; physical registers` from step 72 while every line still says `vN` (`function-call-f073.png`); switch it when the first physical name appears.

6. **Block focus inverts the wrong node.** On a block step the inverted piece is the last part's node, so step 63 inverts the second `n` and step 117 inverts `3` while the note starts with `i`. Invert every part of the block, or none and let the badges carry it.

7. **Scroll and heads.** After a long block the pane scrolls so the last row sits 40 px from the bottom (`animated.tsx:1162`), and the sticky header then hides a half row at the top (`function-call-f067.png`). Scroll the block's head comment into view instead. Also `twice_epilogue:` is followed by `; epilogue` on the next line (`function-call-f066.png`): drop the head when an epilogue label precedes it.

8. **Emit order.** `twice` is emitted before `main`, which a first-time viewer will not expect. One clause on the first prologue note: "Functions are emitted in source order, so `twice` comes first."

9. **Node hover in emit is check-phase text.** Hovering `n` gives "`n` · name reference · refers to `int n`" and nothing about its register or lines (`function-call-hover-node.png`, `nodeHover` in `explain.ts:1001`). With plain hover, a node should light its rows and its frame cell.

## 3. Register badges

**They read as one system now.** `v0` beside `n` at step 63 is the same thin box, page background and muted text as `int` beside `n` at step 61. Keep that.

**Two things still break it.** First, dashed means "not yet" everywhere else on this page: held edges, the preview piece, `unknown` types, the placeholders, `saved`. An address register is not unsettled, so dashed says the wrong thing. Second, a register badge is an absolute span outside its piece (`animated.tsx:2381`) while a type badge is a `<small>` inside it, which is why badges lag and overlap labels in play.

- **Value vs address.** Drop the dash (`animated.css:991`). An address badge only ever belongs to an assignment target, since `regBadges` calls a register an address when every read is a memory operand (`reg-badges.ts:40`). So it always sits beside an `x =` node. Let placement and the frame carry the meaning: on its step the cell it points to outlines and its offset goes ink, and the note says "`v8` is `sum`'s address". Give the address badge `--faint` text so it reads as quieter than a value while it waits.
- **Travelling.** Keep the lit state, ink text on a muted border, the same as an operator's input types. Change where the path ends. Today it ends at the parent's bottom centre and fades on top of the label (`animated.tsx:2347`, visible in `function-call-play-005.png`, where `v2` sits on the `+` box). End it at the parent's badge slot, right of the label, where the result badge will appear. Two lit inputs slide into the slot, fade, and the result appears green in the same place. That is the funnel, and the `arrive` wait at `animated.tsx:2325` already sequences it.
- **Written flash.** Keep the 0.6 s green (`ac-reg-new`). Make it the same green and timing as the stack cell's write tint, so one rule holds across the page: green means written, whether register, cell, or later a lane tag.
- **Nothing else on the badge.** No physical names: the tree is not shown in regs, the assembly text already rewrites `vN` to `$tN`, and the lane tag is the place for `v4` becoming `$t0`. Do not scale a badge below 0.8; a tiny badge means the tree is too small, which is finding 2.

## 4. Layout

Desktop, stage about 790 px and up. Lanes live inside the assembly pane as a fourth grid column, the slot the listing variant already uses for the live-set text (`animated.css:1055`), so lanes and the frame column never compete.

```
│12│ tree, panned to the      │16│ assembly ≈ 280          │lanes│16│ frame 150     │12│
│  │ current statement        │  │ ; virtual registers     │ 48  │  │ ; frame       │  │
│  │                          │  │ main:                   │     │  │ ; caller      │  │
│  │      main  (faint path)  │  │ ; prologue              │     │  │ │ return  +4 │ │  │
│  │        ┆                 │  │  1 addi  $sp,$sp,-4     │     │  │ ; main        │  │
│  │      sum =  v8           │  │  2 sw    $fp,0($sp)     │     │$fp›│ old $fp   0 │ │  │
│  │        │                 │  │ ; sum = sum + i * 2;    │     │  │ │          −4 │ │  │
│  │        +                 │  │ 17 addi  v8,$fp,-12  v8┐│     │  │ │ i        −8 │ │  │
│  │      ┌─┴─┐               │  │ 18 addi  v10,$fp,-12 v10┆│    │  │ │ sum     −12 │ │  │
│  │    sum    ×   v14        │  │ 19 lw    v9,0(v10)  v9┆ ┆│    │  │ ┆ saved       ┆ │‹$sp
│  │         ┌─┴─┐            │  │ …                    ┆ ┆ │     │  │               │  │
│  │         i   2            │  │ 26 sw    v15,0(v8)   ┘   │     │  │ (call: ghost  │  │
│  │                          │  │                          │     │  │  frame below) │  │
```

In regs the frame column fades and the pane's right edge tweens to the stage edge; the lanes recolour by `$t` register and the left column holds the CFG boxes when they exist, else the muted tree. The lanes also replace the pressure strip: active lanes per line is the pressure, and the k rule is a hairline at lane k.

Narrow, stage under about 700 px, where the tree already hides (`treeless`, `animated.css:1098`):

```
│12│ assembly ≈ 280         │lanes│16│ frame 120     │12│
│  │ (source highlight in   │ 48  │  │ pointer marks │  │
│  │  the editor is the map)│     │  │ inside cells  │  │
```

Under about 560 px the frame column hides and the lanes stay, as the Opus answer asked for the gutter. Both narrow captures confirm the current fallback is close: at 820 wide the tree is gone and assembly plus stack fit (`loop-narrow-820.png`); at 1000 wide the tree is still drawn as hairlines (`loop-narrow-1000.png`), which the pan fixes.

## 5. Order of work

Each item is buildable and checkable alone.

1. **Pacing.** Emit hold from rows, stagger and travel. `animated.tsx:1085`. Check: play function call 62 to 71 at 1×; no badge over a label at step 70.
2. **Copy fixes.** Prologue byte count, call result register, twin-load sentence, slide 2's promise. `explain.ts:386`, `543`, `504`, `764`. Check: notes at function call 62, 67, 69 and loop 112.
3. **One assembly pane across phases.** Same element and key, class switch, stack fade, right edge tween, header switch on first physical name. `animated.tsx:2622`, `2710`. Check: 71 to 72 and 133 to 134 with no row re-entry.
4. **Badge path end, solid address, min scale.** `animated.tsx:2342`, `2308`; `animated.css:991`. Check: function call 64 inputs merge at `+`'s slot; loop 120 to 125 `v8` legible.
5. **Tree pan in emit.** Centre the current statement's subtree at scale 0.8 or more, fade the rest. `animated.tsx:1299` to `1313`, `stage-layout.ts`. Check: loop 117 to 130 labels readable at 1280 and 1000.
6. **Frame column, pass one.** `; frame` header, `; caller` and function heads, `return` label, signed offsets, lit offset on touch. `stack-column.tsx`, `stack-view.ts:105` to `113`, `animated.css:1104` to `1186`. Check: function call 62 to 66, loop 112 to 116.
7. **Frame column, pass two.** The call ghost frame on `jal`, second names on the pushed cells, fold on the pop. `stack-view.ts`, `stack-column.tsx`. Check: function call 69 played and stepped.
8. **Stack notes and block focus.** The six drafts above; invert every part of a block. `explain.ts` emit cases, `animated.tsx:2187`. Check: read function call 62 to 71 and loop 112 to 133 with titles off.
9. **Scroll and heads.** Head comment scrolled into view, no `; epilogue` after an epilogue label. `animated.tsx:1162`, `541` to `567`. Check: function call 67 and 71.
10. **Lanes.** Fourth grid column, def and last read from the full instruction list, packed, neutral in emit, recoloured in regs, growing upward per sweep. New `lanes.ts`, `animated.tsx` rows, `animated.css`. Check: loop 112 to 133 peaks at four lanes; 135 to 137 grow with the sweeps.
11. **Plain hover.** Row hover lights the row and its source span; the note keeps the step text; node hover lights rows and cell. `animated.tsx:1541`, `explain.ts:576`. Check: function call 71, hover row 9 lights `n` in the editor.
12. **Narrow pass.** Frame at 120 px with in-cell pointer marks under 700, hidden under 560, lanes kept. `animated.css:1096`, `1411`. Check: 820 and 600 wide.
---

## Addendum from the capture run

- **Instruction hover.** In the capture, hovering an assembly row did not change the note, but the editor's highlight moved to the hovered row's function. So part of the agreed plain hover may already exist. Check what drives that highlight before building item 11, and confirm the note stays put by design rather than by accident.
- **Log view frame numbers differ.** With `?emit=log` the loop trace has 190 frames instead of 185, so a frame link is not comparable across the two emit views. The handoff's state table should say which view each link assumes.
- **Narrow-width papercut.** At 820×700 the site's floating bottom-left button overlaps the `SPC` key cap in the controls footer. Fold it into item 12.

Everything else in the report matches what the review used: the frame ranges, the flat 684 to 704 ms hold on every step, and no console errors or missing selectors. The full capture set, manifests and `SUMMARY.md` remain in the session scratchpad under `shots/`; nothing in the repository was touched.
