**Emit stage: styling review**

Basis: `animated.tsx`/`animated.css` as of today, the 18–21 screenshots (old chrome, same stage), states 10/14/15 for the current parse/check look, and slides 78–83.

## What reads wrong today

- The pane is a log because it has no structure: labels sit inline (`main:  01 addi`, `label_2_while_start:  12 addi`) and push the number and op columns around, so the eye can't scan down a column.
- The "current" block is a solid inverted slab (state 18, 20). One inverted piece is the page's focus mark; five inverted rows is a wall.
- Rows fly in from the left (`x: -12`) and the whole pane slides in from the right (`x: 16`). Nothing else on the stage moves sideways for no reason.
- The tree is squeezed twice (46% width and 11/12 scale) and does little except invert one node.
- Name links fire over the tree; they belong to check.

## Layout at desktop width (~790px stage)

Source → tree → code → memory, left to right, and everything on the scene's existing 22px ruling.

```
│12│      tree ≈ 38%       │16│     asm ≈ 300px          │16│  stack ≈ 130px  │12│
│  │                       │  │ ; virtual registers      │  │ ; stack         │  │
│  │        main           │  │ main:                    │  │      ┌────────┐ │  │
│  │    ┌────┼─────┐       │  │ ; prologue               │  │      │ ret  4 │ │  │  muted (caller's)
│  │  int i  …  return     │  │  1 addi  $sp,$sp,-4      │  │ $fp ●├────────┤ │  │
│  │                       │  │  2 sw    $fp,0($sp)      │  │      │ $fp  0 │ │  │
│  │  focused node         │  │  3 addiu $fp,$sp,0       │  │      │     -4 │ │  │  faint
│  │  inverted, as now     │  │  4 addiu $sp,$sp,-12     │  │      │ i   -8 │ │  │
│  │                       │  │  5 ┆pushRegisters┆       │  │      │ sum -12│ │  │
│  │                       │  │ ; int i; int sum;        │  │ $sp ●├────────┤ │  │
│  │                       │  │▌6 addi  v0,$fp,-8   wash │  │      ┆ saved  ┆ │  │  dashed
│  │                       │  │▌7 li    v1,0             │  │      └┄┄┄┄┄┄┄┄┘ │  │
```

- Tree: `treeRoom = sceneWidth * 0.38`, drop the extra `11/12` scale (the open item already flags it). Width alone sets the fit; `.ac-piece.small` stays 11px/20px.
- Asm: `left: calc(38% + 16px)`, `right: 158px`, top 12px, as now absolute so it scrolls independently. Longest loop line (`beqz v7,label_3_while_end`, 25ch ≈ 180px) plus gutter and op column fits in 300px.
- Stack: `width: 112px` plus a 28px arrow gutter on its left, pinned top-right, never scrolls. It is on every emit frame, idle most of the time. A column that appears only on prologue/epilogue is what makes a panel look bolted on.

## Assembly pane typography

Call on point 3: **partly**. Same 12px mono and the same gutter treatment as the editor, but keep the 22px row. The scene is ruled at 22px (`background-size: 100% 22px`) and pieces are 20–22px tall; a 19px listing next to 22px rules and 22px stack cells would beat against both. The pane should read as a stage element that happens to be code, not as a second editor. The tightness Stanley wants comes from columns, not from line height.

- Row: `display: grid; grid-template-columns: 34px 7ch 1fr; line-height: var(--row)` (22px). Number right-aligned with `padding-right: 8px`, colour `--faint`, `font-variant-numeric: tabular-nums`, no zero padding (the editor gutter shows `1`, not `01`). Op left in its 7ch cell, args in the third. `white-space: pre` stays.
- Labels on their own row, spanning all columns, `--muted`, no number: `main:`, `label_2_while_start:`. Function labels weight 600 (the only bold the page uses is the step title), block labels 400.
- Block heads: a comment row in the existing `; virtual registers` style (`--muted`), spanning all columns: `; prologue`, `; epilogue`, and for each statement block its source line trimmed to ~26 chars with `…`. This is the source↔assembly tie for finished blocks, the same convention as `objdump -S`; it needs no colour and survives after the editor mark moves on. It costs about one row per source line.
- `; virtual registers` becomes `position: sticky; top: 0; background: var(--bg)` so it holds while the pane scrolls.

## States

| state | look |
|---|---|
| done | ink text, faint number. It's the product; don't mute it. |
| current block | `background: var(--wash)`; `box-shadow: inset 2px 0 var(--ink)` as a bar in the gutter; number `--ink`. Same for a one-line block, so nothing changes shape between granularities. Inversion stays for single pieces and the editor mark only. |
| placeholder (`pushRegisters`/`popRegisters`) | `--muted`, `border: 1px dashed var(--muted); padding: 0 3px`, same box as `.ac-type.unknown` and `.pending`. Dashed already means "not yet" on this page (held edges, param parens, unknown type). |
| not yet expanded block | one comment row `; prologue` with a right-aligned faint `5 lines` and `border-bottom: 1px dashed var(--line)`. Expands in place (height tween), rows revealed one 40ms after another. |
| dead | keep: faint strike-through, `never runs`. |
| hover | `--wash` with no bar; lights its node, its source span and its stack cell. |

## Stack column

- Header `; stack` in the comment style. Cells are exactly `var(--row)` tall so they sit on the scene rules; `border: 1px solid var(--line); background: var(--bg)`, stacked with collapsed borders. Top is high addresses, growth is downward, as in the slides.
- Cell text 11px: name left (`i`, `sum`, `$fp`, `$ra`, `ret`, `a`), offset right in `--faint` 10px (`-8`, `-12`, `4`). An unused slot (`-4` in loop) is an empty cell with only the faint offset. `saved` is a dashed cell until the Registers phase fills it; same dash as the placeholder row it belongs to.
- Caller's cells (above `$fp`) in `--muted` text; the current frame's in `--ink`. The frame boundary is `border-top: 1px solid var(--ink)`.
- `$fp` and `$sp` are 11px ink labels in the arrow gutter with a 1px `--muted` line ending in the existing `.ac-link-end` dot on the cell border. Reuse of the link dot ties it to the check phase's language.
- Writes vs reads: a `sw` to a slot tints the cell like `.found` (`--ok` at 32%, delayed by `--land`); a `lw`/`addi …($fp)` outlines it (`border-color: var(--ink)`). Fill = written, outline = read. The `sw v21,4($fp)` return store is the one green moment in the phase; that's enough green.
- On `pushRegisters` the `saved` cell appears dashed and `$sp` moves below it; the stack is honest about not knowing its size yet.

## Links during emit

**Off.** The declaration owns nothing new here; the slot does, and the stack column shows it. A repurposed link from a use to its cell would cross the asm pane. Gate drawing on `frame.phase === 'Check'`, hover included, so the rule is one line and the router doesn't run.

## Motion

- Drop both sideways slides. Rows enter with opacity 0→1 and y 4→0, staggered 40ms inside a block, same 0.42s ease as everything else.
- `$fp`/`$sp` tween on y with the same easing; a pushed cell grows height 0→22 with `overflow: hidden`, timed to its instruction's row appearing.
- Scroll the pane so the current block's first row is visible, not its last row 40px from the bottom (`offsetTop - 16`).
- Reduced motion: instant, as now.

## Tree

Keep it; it's the map. Optional and cheap: nodes whose block is done go `--muted` (`.emitted`), so progress reads across the tree the way consumed tokens leave the tray. Type badges stay off (they already do).

## Cut

Inline labels, the inverted slab, the two sideways slides, zero-padded numbers, the 11/12 squeeze, links in emit, and the idea of per-line `# comments` in the pane (the step panel says each thing once; the block head carries the source line).

## Do first

1. Restructure the pane: grid columns, gutter, label rows, block heads, wash-and-bar current block. CSS and markup only; no trace changes.
2. Gate links to the check phase.
3. Placeholders as dashed muted boxes.
4. Stack column with 22px cells, dot-line pointers and read/write cell states.
5. Motion cleanup: remove the slides, stagger rows, tween the pointers.
