# Prompt: redesign the Registers phase for teaching

## Context

`/projects/mini-c-prototype` is an animated walkthrough of a small C compiler
(lexer → parser → semantics → types → emit → regs). Audience: portfolio
visitors, many of them engineers who have never written a compiler. Each
frame shows one step on a stage, plus a short note under the code editor.

Earlier phases now show their decisions on the stage instead of narrating
them. Read these for the style the page has settled on:

- `docs/handoffs/2026-09-24-compiler-showcase-live-markup.md`: "Decisions
  so far", "Register badges", "Registers phase: the allocator's stack",
  "Emit: live-range lanes and row hover", "Emit: register focus".
- `docs/handoffs/2026-09-24-emit-visual-astra-answer.md` (your emit answer,
  which proposed an order for Registers work).
- `docs/handoffs/2026-09-24-liveness-opus-answer.md` and
  `docs/handoffs/2026-09-24-regalloc-pressure-opus-answer.md`.
- `docs/handoffs/2026-09-24-emit-intuition-fable-answer.md` (a pacing and
  copy review of emit).

Code: `app/projects/mini-c-prototype/animated.tsx` (stage),
`animated.css`, `explain.ts` (notes; search `reg.`), `trace.ts` (the
`reg.*` steps), `lanes.ts` and `emit-lanes.tsx` (emit's live-range lanes).

## What the Registers phase does today

Screenshots (1280x720, light mode) are attached in this order:

1. loop · cfg (134)
2. loop · liveness sweep 1 (135)
3. loop · liveness fixed point (137)
4. loop · interference graph (138)
5. loop · simplify, early (141)
6. loop · simplify, late (155)
7. loop · select, first pop (162)
8. loop · select, late (179)
9. loop · done (184)
10. function call · interference (75)
11. function call · simplify (79)
12. function call · select (85)
13. function call · summary (86)

Frames per step: one CFG frame, one frame per liveness sweep, one
interference frame, then one frame per simplify push and one per select
pop. The loop has 23 virtual registers, so 46 of its 51 Registers frames
are push/pop, each with a near-identical sentence ("v16 overlaps 4 others,
fewer than the 18 registers available, so it is sure to get one. It is set
aside on a stack and its edges come off the graph."). With 18 registers
nothing is ever at risk, so the stack teaches nothing that is visible.

Known problems:

- The stage is empty during CFG and liveness; the facts are a text column.
- The interference graph is a ring of 23 labels with long crossing edges.
- The note repeats itself for dozens of frames.
- Nothing ties it back to emit, although emit now draws each virtual
  register's live range as a lane beside the assembly (screenshot-less; see
  the handoff). Two lanes that overlap in rows are exactly an interference
  edge.

## What the author wants

A review of the best styling and the most intuitive teaching design for
this phase. Keep it lean: not too much information on screen, no caption
slop. The note should be one short sentence, or absent when the stage says
it. Prefer showing over narrating, as the earlier phases do.

## Please answer

1. What should a visitor understand when they leave this phase? At most
   three ideas, ranked.
2. The frame plan for the loop and for function call: which steps to keep,
   merge or skip (e.g. batch the easy pushes; slow down only where a choice
   matters), with a frame table (frame, stage, note ≤ 1 sentence). Say
   whether a smaller k (the "k=3 spill mode") should be the default for the
   teaching run, and what the viewer sees when something spills.
3. The stage layout: what replaces the ring (e.g. the emit lanes turned
   into the interference graph, a lanes-with-colours view, a smaller
   graph), where the allocator's stack sits, and what the listing column
   shows. Reuse existing pieces (lanes, type-style badges, the tree) where
   they fit.
4. Styling: colours for physical registers, spill, the current step; what
   to fade. Match the page (monospace, thin `--line` borders, muted text,
   ink for the current thing, green `--ok` for success, red for errors).
5. The three changes with the best payoff for effort, in order.

Be concrete: name components, CSS classes and step kinds where you can.
Mark anything you would cut. Short answer preferred over a long one.
