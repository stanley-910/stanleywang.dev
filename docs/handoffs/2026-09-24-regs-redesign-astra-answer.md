**Keep emit’s lanes as the main picture; use a small graph to explain the current allocation decision.** The stack should show ordering, while the lanes show why reuse is possible.

The visitor should leave with three ideas, ranked:

1. **Many temporary names can share a few physical registers.**
2. **Values needed simultaneously must get different registers.**
3. **When registers run out, storing and reloading a value adds work.**

Graph colouring and the simplify stack are supporting mechanisms.

One correction matters: **lanes touching the same instruction row do not necessarily interfere.** In `twice`, `addu v4,v0,v2` finishes reading `v2` before writing `v4`; both receive `$t0`. Current [lane packing](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/lanes.ts:42) deliberately separates these endpoints. Use recorded live-in/live-out sets and interference edges for conflicts and pressure.

Keep **18 registers as the default**, with a visible **“try 3 registers”** action at the result. First establish reuse, then demonstrate shortage. The smaller run should retain a discreet `3 available · normally 18` label.

These are proposed local frame numbers; “—” means no note.

| Loop frame | Stage / step treatment | Note |
|---|---|---|
| 1 | Keep `reg.cfg`: five compact blocks; draw body → test last. | “Liveness follows jumps as well as adjacent instructions.” |
| 2 | Keep first `reg.live`: grow lanes backwards, spotlighting `v9`, rows 25 → 19. | “Keep this value until its last read.” |
| 3 | Merge sweeps 2–3: extend only dashed `$fp` through rows 28–33, then show `stable`. | “Here, only `$fp` stays live around the back edge.” |
| 4 | `reg.interfere`: spotlight row 22 and its four live values; their badges form a four-node graph. | “These four values need different registers.” |
| 5 | Batch through the first meaningful simplify, `v11`: show its three neighbours and push it after `v5`. | “Three neighbours cannot occupy all 18 registers, so this one can wait.” |
| 6 | Batch remaining `reg.simplify`: stack fills in recorded order; graph ghosts remain. | — |
| 7 | First two `reg.select`: pop `v19`, then `v8`; both acquire `$t0`, with their disjoint lanes highlighted. | “These values never overlap, so they share `$t0`.” |
| 8 | Batch selects through `v9`: neighbours block `$t0` and `$t1`; choose `$t2`. | “Overlapping values already occupy the first two registers.” |
| 9 | Batch through `v11`: three blocked choices; choose `$t3`. | “This value needs a fourth register.” |
| 10 | Finish remaining pop and `reg.done`: coloured lanes; `23 temporaries → 4 registers`. | — |

| Function-call frame | Stage / step treatment | Note |
|---|---|---|
| 1 | Merge `twice` CFG and liveness sweeps; keep assembly and grow its lanes backwards. | “Each value stays live until its last read.” |
| 2 | `reg.interfere`: show `v0—v3` and `v0—v2`; keep the two isolated values quiet. | “The first `n` must survive while the second is loaded.” |
| 3 | Batch all five simplify pushes into the small stack. | — |
| 4 | Pop `v3 → $t0`, then `v0 → $t1`; show the blocked `$t0` choice. | “These two values overlap.” |
| 5 | Batch remaining pops and `twice` completion; spotlight row 12’s read/write boundary and `5 → 2`. | “The result can reuse an input’s register after reading it.” |
| 6 | Batch `main`’s analysis and allocation; show disjoint `v5`, `v6` lanes sharing `$t0`. | “`main` needs only one register for its temporaries.” |

For the optional three-register loop, reuse frames 1–4, then:

| Frame | Stage | Note |
|---|---|---|
| P1 | Batch easy pushes; pause on `reg.spillCandidate`, with `v8` marked `maybe`. | “Set this value aside; it may need memory.” |
| P2 | Continue recorded pushes/pops; pause on actual `reg.spill`, with all three choices blocked. | “No register is free for `v8`.” |
| P3 | New `reg.rewrite`: connect inserted store/reload instructions to `v8: .space 4` in a small `.data` box. | “Saving and reloading the address adds memory traffic.” |
| P4 | Complete listing; `3 registers · 1 spill`. | — |

The [pressure review](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/docs/handoffs/2026-09-24-regalloc-pressure-opus-answer.md) reports `v8` spilling at k=3. Record that run and its rewritten instructions before exposing this mode; the current backend data does not contain the rewrite.

For layout:

- **Keep one assembly pane mounted across Emit and Registers**, including `EmitLanes`, row positions and hover links. Header: `virtual registers` → `assigning registers` → `physical registers`.
- **Replace `graphPoint()`’s ring with a compact `InterferenceFocus` component.** Show the current value and its neighbours; for the pressure checkpoint, show the four-value clique. Preserve positions during pushes and pops. Degrees must count the full remaining graph.
- **Keep `.ac-pile-box` beside that graph**, labelled `allocation stack`. Show the top six entries and a collapsed count below; expand on inspection. Preserve `.ac-pile` movement and recorded order.
- **Keep lanes visible during simplify.** Removing a graph node does not end its lifetime. During selection, add physical-name badges and colour the corresponding lanes.
- Reuse `.ac-reg`/type-badge styling. **Cut the full AST from allocation’s default view**; source highlighting supplies context. On narrow screens, place the compact decision view above the listing.

Styling should stay restrained:

- Physical registers: muted blue, violet, teal and slate; thin borders, page-background badges, explicit `$tN` labels.
- Current value: inverted `--ink`; current instruction: existing wash and gutter bar.
- Successful assignment: brief `--ok` pulse, then its register colour.
- Spill candidate: dashed muted outline; actual spill: dashed rust outline plus `memory`. Reserve `--err` for errors.
- Fade unrelated edges and values; keep the current value, conflicting neighbours and relevant lanes legible. **Cut saturated node fills and the ruled background beneath graphs.**

The three best changes for effort, in order:

1. **Compress the timeline.** Add a presentation grouper, analogous to `emit-view.ts`, preserving raw step ranges and exact settled states; shorten `explain.ts` notes. Cut repeated push/pop stops and mandatory algorithm slides.
2. **Carry `EmitLanes` into Registers.** Show sweep growth and allocation colours; distinguish reads from writes within a row. Hold frames until their animation finishes.
3. **Replace the ring with the focused graph and compact stack.** Reuse `.ac-vr`, `.ac-pile`, and existing badges; defer spill mode until its added instructions can be shown.

