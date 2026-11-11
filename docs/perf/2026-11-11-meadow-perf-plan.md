# Plan: a faster meadow with the same picture

Drafted 2026-11-11 on `meadow-perf-optimization-ef6030` (a9953a4), then revised to GPT-6 Astra's
cross-review ([handoff](../handoffs/2026-11-11-meadow-perf-astra-review.md)). Nothing here is
implemented yet. Follows [2026-10-30-cpu-budget.md](2026-10-30-cpu-budget.md) and
[2026-10-30-active-rate.md](2026-10-30-active-rate.md).

## The rule

**Identical output for identical jobs and events.** Given the same recorded frame, the workers
return the same bytes; given the same inputs, the compositor uploads the same bytes; resolution,
caps and budgets in `quality.ts` are untouched. An item lands only if it passes the gate in step 0,
or doesn't touch the scene at all (fonts, bundles).

Two things this rule can't promise, and shouldn't:

- **A slow machine draws more frames.** That's the point. At 4× the page goes from about 101 fps
  toward 120.
- **Where the plant rate is held by a budget, cheaper frames become more plant frames, not idle
  cores.** `quality.ts:185` fits the rate to `frameMs` and `recordMs`. On a loaded or slower machine
  the cursor-moving rate would rise toward the display's rate (smoother sway, same cap). Cores fall
  only where the cap already binds: idle at 40, and a quiet M4 at 120.

## What was measured

Production build, Chrome 157 (visible, not headless), 1512×860 at 2×, `?seed=1715089390`, Apple M4,
120 Hz, about 22:10 scene time. The machine was shared with three audit agents (load 7–14), so
worker times here run above the quiet-machine 18.7 ms of 10-30; treat them as this session's
baseline only. A probe wrapped `requestAnimationFrame`, `Worker` and WebGL, and Chrome traces gave
per-function time on every thread.

| Case | Page fps | Plant frames/s | Worker ms per plant frame | Main-thread rAF work |
|---|---|---|---|---|
| Idle | 120 | 30–38 | 25–27 | 130–155 ms/s |
| Cursor moving | 120 | 60 | 34 | 327 ms/s (2.7 ms a frame) |
| Main thread 4× slower, idle | 110 | 30 | 22 | 513 ms/s, worst frame 22 ms |
| Main thread 4× slower, cursor moving | 101 | 29 | 24 | 869 ms/s (8.6 ms a frame) |

Where the time goes:

- **Workers** (two busy at idle, four while the cursor moves). Per thread: cell sampling
  (`sampleRow`) 36%, `getImageData` 36% (where Chrome runs the deferred canvas fills, plus the
  copy), typesetting 7%, per-frame array allocation 4%, GC 3%, replay 2%.
- **The grid is mostly still.** 473×192 = 90,816 cells: 51% land, 38% empty sky, 11% plants and
  grass. Between two frames 700 ms apart, 4.9% of cells' outputs changed. Every land cell takes the
  full sampling path on every frame.
- **Main thread, cursor moving** (trace, share of busy time): `ascii.render` 28% (about 1.5–1.8 ms
  per drawn frame; all 90k cells recomputed, two 363 KB textures uploaded), `garden.draw` 17%
  (about 2.3 ms per plant frame, the land 0.57 ms of it), `submit` 6% (0.7 ms per plant frame,
  nearly all `postMessage`), `relief` 3% (0.4 ms per plant frame), simulation 5%.
- **A slow main thread is what drops frames.** At 4× the page spends 8.6 ms of each 8.3 ms frame
  in rAF while the cursor moves. The workers aren't the limit there.
- **Load.** 17 font files are preloaded on home (464 KB); 8 are variants nothing uses (269 KB) and
  5 belong to the closed terminal (86 KB). One 256 ms long task at mount. LCP 2.3 s on localhost is
  the intro holding the text back, by design.
- **The live hour moves once a minute** (`mount.ts:129`), so the land layer and anything cached
  against it miss about once a minute on the clock, and on every frame of a scrub.

## Step 0: the gate (before any change)

1. **Recorded sequences, not live runs.** Capture jobs (commands, box, style, heads, sprites) with a
   fixed clock, seed and input script, then replay the same sequence through old and new code. Two
   live runs aren't the same input.
2. **Independent old and new instances.** Separate rasterisers, typesetters and compositors with
   the same history, so a shared cache can't make them agree.
3. **Compare bytes at every stage:** raw readbacks, cells before `stampHeads`, cells after (what
   `?probe` returns), every `material` array, `inkData` and `tileData`, and the final framebuffer
   (`readPixels`), which is the only thing that catches a wrong upload offset or a missed upload.
4. **Cover hits, misses and disappearances:** dusk, dawn and midnight, moon tone, each weather
   fading in and out, a flash ending, a bird and a meteor leaving, a dim box removed, the pointer
   leaving, resize (including one with the same cell count), DPR and zoom, regrow, the font
   arriving, reduced motion, navigation away and back, and a worker failing.
5. **Then performance:** the same probe and seed, idle, moving and at 4×, on a quiet machine, with
   p95 and p99 frame gaps, worker memory and GC, measured without the checking code.

## Step 1: small exact changes

| # | Change | Where | My estimate | Astra's estimate | Note |
|---|---|---|---|---|---|
| A1 | Clear the land votes when land first shows in a cell, not with `fill(0)` on every cell | `rasterize.ts:443` | 0.6–0.8 ms per plant frame in the worker (Node benchmark) | 0.1–0.3 ms | Clear in the first-seen branch for `Kind.Land`, not on the first valid meta pixel |
| A2 | Cache the land's commands, the relief and the river field while their inputs hold | `garden.ts:1736`, `mount.ts:355` | 0.6–0.9 ms per plant frame on the main thread | 0.5–0.8 ms | Keys below |
| A3 (dropped, see below) | Send relief, river, palette and sprites to a worker only when their bytes change | `raster.ts:460–496` | 0.3–0.5 ms per plant frame, 454 KB less cloned | 0.15–0.35 ms | Rules below |
| A4 | Grass drawn without per-blade arrays and closures | `meadow.ts:184–217` | 0.15–0.25 ms per plant frame | 0.1–0.25 ms | Double-precision scratch, original expressions and order; no `Float32Array` tables |
| A5 | The cloud refresh reuses lattice hashes shared by neighbouring cells | `ascii.ts:444–454` | 0.6 ms per refresh frame, 20 a second | 0.2–0.5 ms | Cache hashes by lattice point and octave seed only, never interpolated noise; bounded |
| A6 | The wind's time-only factors once per step; petal noise memoised | `wind.ts:48`, `bloom.ts:109,155` | 0.02–0.06 ms per step | same | Strength applied after the cache; the petal key is the signed width, notch and tip width |
| A8 | Replay reads commands by index, not `subarray`; glyph codes looked up once | `rasterize.ts:264`, `typeset.ts:28` | 0.2–0.35 ms per plant frame | 0.1–0.25 ms | Build the code tables after the existing registration, in the same order |
| B1 | Import `geist/font/pixel/line` and `geist/font/serif/square` | `app/layout.tsx:7–8` | 269 KB fewer preloaded bytes, 17 preloads to 9 | — | Same files, variables and fallbacks |
| B2 | Terminal fonts not preloaded; loaded on pointer-enter or focus of the power button, and at idle | `terminal.tsx:51–65` | 86 KB more | — | A first open before the load shows the fallback briefly |
| B3 | `AUTO_TOP` and `lightningAt` moved out of `engine/weather.ts` | `theme-switch.tsx:8` | about 15 KB gz on every non-home route | — | |

**A2's keys**, one per cache since their inputs differ:

- **Land commands:** the exact scene hour (fractions too: sun and moon position, facing, rim light,
  snow line and mist alpha move while the palette's colours don't), every palette value by value
  (weather, snow cover and moon tone arrive through it), scene width, height and horizon, and a
  geometry generation bumped on resize and regrow.
- **Relief:** the same, plus `cols`, `rows`, `cw` and `ch`. All three outputs are cached: the
  field, the light's colour and its strength. `?probe` keeps reading the current field.
- **River field:** the river's version plus `cols`, `rows`, `cw` and `ch`, not the cell count.
- **On a hit:** the block is appended at the current offset, `still` is rebuilt from it, and the
  land's own scene-space meta bounds are unioned with this frame's globe and plants. The previous
  frame's box is never reused.

**A3's rules:** compare by value, since the relief is edited in place and palettes and sprites are
rebuilt each frame. Keep a version per worker and for the main-thread fallback. Send an emptied
sprite list too. Each job keeps its own palette and hour for replies that arrive out of order.

## Step 2: the structural changes

**C2. Sample only the cells whose pixels changed (worker, M).** Each worker keeps its previous
job's three readbacks and its cells as they were before `stampHeads`. For each cell it compares the
four colour and four kind pixels as 32-bit words, and the meta pixels that fall inside the box,
against that job. If they all match, it copies the previous cell's six outputs; otherwise it
samples as now. It's a memo of `sampleRow` on its exact inputs.

- **Valid only when** width, height, `cols`, `rows` and the meta box are all unchanged and `md` is
  present in both. Anything else samples every cell.
- **Meta is indexed inside its box**, with the same in-box test `sampleRow` makes, never as a full
  image.
- **The typesetter still runs in full**; it reads neighbours, heads and sprites.
- **Memory:** 6.5 MB of history per worker (4.4 readbacks, 2.1 cells), about 26 MB across four.
  One history only, dropped on resize.
- **Estimate:** mine is 2.5–3.5 ms per plant frame; Astra's is 1.5–3 ms, on the grounds that 4.9% of
  outputs changing doesn't prove 95% of pixels are unchanged. The hit rate gets measured first, with
  a counter, before the memo is written.
- **If the hit rate disappoints:** an exact fast path for cells whose four subsamples are one kind
  (uniform land), keeping the original arithmetic. Astra puts it at 1–3 ms, overlapping C2.

**C3. Reuse the cells and typeset arrays (worker, S–M).** About 3.1 MB a frame per worker stops
being allocated. Only superseded or dropped results go back to a worker, never the material on
screen. Every branch that relied on a fresh zeroed array writes its zeros. The typesetter's own
scratch is left as it is (some of its stale bytes are copied out today, and the gate compares
them). Astra: 0.1–0.4 ms.

**C6. Upload only the texture rows whose bytes changed (main thread, S–M).** New from the review.
The full compose still runs; each row of `inkData` and `tileData` is compared with what was last
uploaded and only changed runs go to `texSubImage2D`. Nothing to get wrong about dependencies. A
frame with no changed rows and no backdrop, veil or atlas change skips the draw. It must redraw in
full after a resize, an atlas reset or a restored context.

**C1. Compose only the rows that changed between plant frames (main thread, L, last).** Built on
C6. A row is recomposed when any of these changed for it since it was last composed; otherwise the
full pass runs:

- the plant frame (all six material arrays), the grid, cell size, horizon or DPR;
- `dim` or `dimPlant`, including a box removed;
- any palette value;
- a star candidate in the row at night, visible or not yet;
- the cloud state: `cloudTick`, `cloudAt` and the row's turn. `skyEdge` and the cloud caches stay
  as the weather expects them;
- the pointer's old or new position within 120 scene pixels, and its active state, including leave,
  blur, touch release and entering the terminal;
- the backdrop key, page colour or veil;
- a meteor, glint, bird, precipitation, snow cover, gale band, flash, storm glow or eclipse disc,
  now or on the previous frame, so the frame after one ends clears it.

Cloud rows are interleaved, so dirty rows are uploaded as runs, not one band. Estimate at 4× with
the cursor moving: mine was 8.6 to about 5.5–6 ms a frame; Astra's is 1.2–3.2 ms saved per reused
frame, so 110–120 fps, weaker at night when stars dirty most of the sky.

**C5. The terminal's window loads on demand (S–M).** The power button, its styles and font
variables, the day and night subscription, `data-avoid`, the key handler, focus and the saved
history, position and size stay in the eager shell. The window is prefetched at idle and on hover.
About 8–16 KB gz less to hydrate before the meadow mounts. A cold first open has to be tested.

## Expected totals

| Measure | Now | My estimate | Astra's estimate |
|---|---|---|---|
| Worker time per plant frame, quiet M4, steady hour | about 19 ms | 14–15 ms | 15–17 ms |
| Main-thread recording per plant frame | about 3.4 ms | 1.7–2.1 ms | 2.1–2.6 ms |
| Cores, idle, at the same 30–40 plant frames/s | 1.0–1.5 | 0.8–1.2 | 0.9–1.3 |
| Cores, cursor moving at 120 plant frames/s | about 4 | 3.1–3.3 | 3.4–3.8 |
| Page fps, main thread 4× slower, cursor moving | 101 | 115–120 | 110–120 |
| Fonts preloaded on home | 464 KB, 17 files | about 110 KB | — |

Plan on Astra's column. The items overlap (A1 with C2, A5 with C1, C2's kept buffers against C3's
GC saving), so they don't add up one by one. None of these is a measurement of the change; step 0's
run replaces them.

## Order

Gate → A1, A4, A5, A8 → A2 → A3 → A6 → B1–B3 → C2 (hit-rate counter first) → C3 → C6 → C1 → C5.
One commit each, measured after each group. Stop when the 4× case holds 120 and idle sits under a
core.

## Step 1 as landed, 2026-11-11

Landed: the gate, A1, A2, A4, A5, A6 (the wind's factors and the petal's cup; the petal-noise memo
wasn't worth its key), A8, B1, B2, B3. Local commits cfde805 to 16f42d4, not pushed.

**The gate** (`scripts/meadow-gate`): the real engine, transpiled and run in Chrome through a
fixed sequence with a seeded `Math.random` and a fixed clock: 500 frames in 29 segments (night,
noon, the pointer arriving and leaving, sunset and dawn scrubs, midnight, moon tone, each weather
in, held and out, regrow, resize, hours stepping while the day's palette holds, and 48 frames sent
to real workers in bursts of one to four). Each frame hashes what was recorded, the cells, the
type, the composed ink and tile bytes, and on three frames a segment the framebuffer. The baseline
was recorded from a9953a4's engine, twice, identically. Every change above gives the same 500
rows. A deliberately broken land-cache key (the hour left out) is caught.

To run it: `node scripts/meadow-gate/build.cjs`, start `meadow-gate` from `.claude/launch.json`,
open `http://127.0.0.1:3212/gate.html` in a visible Chrome, save `await __gate.run()` to
`scripts/meadow-gate/.out/run.json`, then `node scripts/meadow-gate/compare.cjs`.

What it doesn't cover: `mount.ts`'s own wiring (the scenario copies its draw), Safari and Firefox,
and pre-stamp cells or raw readbacks, which C2 will need added.

**Measured**, production builds of a9953a4 and 16f42d4 side by side, same Chrome, 1512×860 at 2×,
`?seed=1715089390`, 8 s a case, machine at load 4–6. Two runs each at 1×, one at 4×.

| Case | Before | After |
|---|---|---|
| Idle: main-thread rAF work per display frame | 1.13, 1.12 ms | 0.92, 0.85 ms |
| Cursor moving at 60 plant frames/s: the same | 2.25, 2.32 ms | 1.90 ms |
| Cursor moving: plant frames/s | 60, 64 | 60, 110 |
| 4× main thread, idle: page fps, plant frames/s | 113, 30 | 120, 39 |
| 4× main thread, idle: frame gap p95, worst frame | 16.4, 19.7 ms | 9.8, 14.0 ms |
| 4× main thread, cursor moving: page fps, plant frames/s | 102.5, 34 | 111.8, 56 |
| 4× main thread, cursor moving: frame gap p95, p99 | 16.2, 20.1 ms | 12.7, 15.3 ms |
| Worker ms per plant frame, idle | 25.8, 22.1 | 22.6, 21.8 |
| Cores, all of Chrome, idle | 1.75, 1.51 | 1.47, 1.48 |
| Cores, cursor moving | 2.75, 2.71 at 60 | 2.38 at 60; 4.56 at 110 |
| Font files preloaded on home | 17 | 4 |

- **Recording a plant frame costs about 0.55 ms less**, from about 1.5 to about 0.93 ms (worked out
  from the rAF totals at two plant rates), in line with the estimates for A2 and A4.
- **The cursor-moving rate is no longer held at 60.** `RECORD_BUDGET` was what held it: recording
  had grown past 2.1 ms with the river and the relief. Under it again, the plants reach the
  display's rate on this machine as [2026-10-30-active-rate.md](2026-10-30-active-rate.md)
  intended, and that costs the cores it did then (about 4.5 while the cursor moves). This is the
  budget doing what it was set to do, but it is more CPU in that case than yesterday's build.
- **The worker changes (A1, A8) are within the noise** here, under a millisecond a frame, as Astra
  estimated and not as the Node benchmark suggested.
- **A slow main thread** keeps 120 fps idle and gets about nine more frames a second with the
  cursor moving, while drawing 60% more plant frames. C6 and C1 are what would take it the rest of
  the way.

**A3 dropped.** Posting the relief and the river with a job measured 0.05 ms in Chrome, against
0.05–0.2 ms to compare them by value first. The 0.65 ms `postMessage` in the trace was mostly the
probe's own wrapper. Not worth a per-worker protocol.

## Dropped after review

- **A7, integer land colours.** Exact, but worthless: the clock moves the land once a minute, not
  twice a second as the audit assumed, and a scrub moves its geometry anyway.
- **C4, the first unseen frame on a worker.** Would cut a 100–200 ms task at mount, once. But
  `submit` rasterises locally until the first result is in (`raster.ts:487`), the extra reply would
  count toward the three that start the grow-in and the intro, and the first frame isn't unseen
  with reduced motion or on a return to home. It changes how the opening plays, so it's Stanley's
  call as a change of its own, not part of this.

## Left out, because the picture or the feel would change

- Fewer plant frames a second, a coarser grid, or 2×1 subsamples (all tried or rejected before).
- The cursor's light in the shader: 8-bit textures would round it a level differently.
- Merging same-style fills, or drawing the land straight into the frame: antialiased edges blend
  in a different order.
- Caching a plant's shapes while it "hasn't moved": wind and ageing move every plant every frame.
- GPU canvases in the workers (measured worse on 10-30).
- The intro's timing, which is what LCP reads.
- The glass blur on open menus: it redraws with the canvas, and any fix changes its look.

## Not yet examined

The canvas fills themselves (about a third of worker time, inside `getImageData`) have no exact
saving in this plan. Whether the land's typesetting can be reused needs its neighbour reach mapped
first: snow scans eight rows up and heads read a 7×5 neighbourhood (`typeset.ts:731,1242`). Astra
puts that at 0.2–0.8 ms a frame.
