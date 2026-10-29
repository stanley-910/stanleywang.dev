# The rose on a finer grid, the poem on home's

Draft, 2026-10-30. Not built: step 0 put the poem at the edge of the rule, and Stanley judged
the rose on home's grid good enough, so the poem now uses home's 0.64 and the inset is shelved.

## Step 0, measured

2026-10-30, production build with a `?zoom=` and `?rose=` override (not committed), 1440×900 at
2×, the rose grown, 8 s windows, fresh profile per run, two runs each, interleaved. Includes the
plant cap from `2026-10-30-cpu-budget.md`. The machine had other agents on it (load 4–8).

| | 0.5, M4 | 0.64, M4 | 0.5, 4× CPU | 0.64, 4× CPU |
|---|---|---|---|---|
| Page fps | 120, 120 | 120, 120 | 105, 100 | 117, 119 |
| Plant frames/s | 39, 40 | 40, 40 | 26, 33 | 39, 40 |
| Main thread, ms per s | 190, 197 | 130, 145 | 534, 652 | 529, 496 |
| Raster round trip | 50, 43 ms | 24, 26 ms | 48, 41 ms | 34, 30 ms |
| Cores busy, all of Chrome | 2.5, 2.5 | 1.8, 1.9 | 2.3, 2.6 | 2.8, 2.5 |

At 4× CPU, 0.5 kept its page fps but its plants fell to 26 a second in one run, under the rule's
30, and that run stepped quality down a level. 0.64 held both in every run. Its raster round trip
is about half of 0.5's, and on the M4 it costs about 0.6 cores less. That's a narrow fail under
the rule, so the inset was in scope. Stanley looked at the rose at 0.64 and judged it fine, which
makes the cheaper fix the whole fix.


## Problem

The poem draws its whole scene at zoom 0.5 (`ZOOM` in `app/writing/poem/poem.tsx`, since c24d1d2), against home's 0.64, so the rose prints its petals as separate lobes and its stem and leaf stalks thinner. The finer grid costs the whole screen, not just the rose: about 1.64× the cells.

| 1440×900 | Cell (CSS px) | Grid | Cells |
|---|---|---|---|
| Home, zoom 0.64 | 3.2 × 4.48 | 450 × 201 | 90k |
| Poem, zoom 0.5 | 2.5 × 3.5 | 576 × 258 | 149k |

Almost all of those extra cells are sky and grass. The rose's head, the only thing that needs them, is about 3% of the screen.

The poem is written for one reader, on their laptop. If that laptop is slow, the page only adapts within the visit by redrawing the plants less often (`quality.ts`); a coarser grid waits for the next visit. For a page read once, the first visit is the one that matters.

## Proposal

Draw the poem on home's grid, as home does, and lay a small second grid over the rose alone, at the poem's current fineness. Everything else on the page costs what it does on home; the rose looks as it does today.

Build it only if step 0 shows the finer grid is a real risk.

## 0. Measure first

Before any of this, measure the poem as it is against the poem at 0.64, using the method in `2026-10-29-garden-zoom.md`. That means a production build, 1440×900 at 2×, the rose grown, and 8 s windows. Take both the M4 as is and DevTools at 4× CPU, standing in for a mid-range laptop.

| Record | Why |
|---|---|
| Page fps | the page's own smoothness: wind, sky, the text fade |
| Plant frames/s | how often the rose and meadow move |
| `ascii.render` mean, worker time per raster | where the cost goes |

**Build the inset if, at 4× CPU, the poem at 0.5 falls below 45 page fps or 30 plant frames/s, and 0.64 holds above them.** If both hold, the risk is theoretical and the poem keeps its grid. If both fail, the inset alone won't save the page, and the fix is elsewhere (see the perf doc's "what's left").

## How it works

### The patch

- **Where:** a rectangle around the rose's head, sepals and upper leaves, padded a cell or two. It's recomputed each frame from the rose's stem tip and head radius `R`, so it follows the rose as it sways and grows. The stem below the leaves stays on the main grid. It prints as one `|` line, which the finer grid barely changes.
- **Grid:** cells 0.78× the main grid's (0.5 / 0.64), so the rose's head spans the same cells as today: about 51 on a phone, 61 at 1440×900. The patch's corner snaps to a main cell, so the two grids share an edge.
- **Size:** about 2.6R square. At 1440×900 that's about 80 × 57 cells, 4.5k, or 5% of the main grid's, on a raster of about 160 × 114 px.

### Recording and rasterising

- `Garden.draw` already draws the rose separately, after the meadow (`garden.ts`, "The rose goes over the grass in front of it"). The raster marks that range of commands, `rose: [from, to)`, as it marks the land's `still` range.
- The main job is unchanged and still includes the rose, so the main grid prints the rose exactly as now. That's the fallback.
- The same worker, in the same job, then replays only the rose's commands onto a small canvas, at the patch's origin and the finer scale. It samples them into cells and sets them in type with the frame's `Style`. Its reply carries both grids, so the patch never lags the frame it belongs to.

### Composing

- **The main grid, cut out under the rose.** Before the main grid goes to the GPU, any main cell where the rose wins the cell (its coverage at least half) is emptied: no glyph, no tile. The rose isn't printed twice, and the grass behind it doesn't show through.
- **The patch, over it.** The patch prints only its rose cells, on its own canvas laid over the scene. That canvas is the patch's size, moved with a CSS transform, with `pointer-events: none`. It has its own compositor (WebGL2, or Canvas 2D as now) and its own glyph atlas at the smaller cell size.
- **The same light and fades.** Each patch cell takes the main renderer's per-cell modulation at its centre, sampled from the main arrays: `dimPlant` (later lines stepping the rose back), the veil, and the light around the cursor. The rose fades and lights the same on both grids.
- **The seam.** Since only rose cells cross over, the change in fineness falls on the rose's own outline, not on a rectangle through the meadow. Where a main cell is emptied but the patch has no rose in part of it, the backdrop shows through. That's the same sky or ground that sits behind every empty cell, so no hole should show.

### Falling back

The patch is additive. If it's off, slow, or its canvas can't be made, the main grid's rose shows as it does now on home's grid. That's the rose the Rose spec was first written for (40 cells across on a phone), so the fallback is still a rose.

The patch also stays off on a visit that `quality.ts` has already moved to the coarse grid (`quality.coarse`), so a machine that struggled before doesn't take on a second grid.

## Cost, expected

- **Main grid:** home's, about 90k cells at 1440×900, down from 149k.
- **Patch:** about 4.5k more cells to typeset and draw, and one small extra replay and readback in the worker (one rose's commands, about 18k raster px).
- **Main thread:** one extra small draw call per frame and a per-cell cutout over the patch's rectangle.

So the poem should come out at about (0.5 / 0.64)² ≈ 0.6× its cost today, about home's plus 5%. The perf doc's numbers suggest the per-cell work tracks the cell count, but step 0 should confirm it.

## Rejected

- **A bigger rose on home's grid.** A head 1.28× wider gets the same cells, but the rose takes a quarter more of the poem's composition, and the gap the poem leaves for it (Rose spec, "The gap") would have to grow to match.
- **A finer grid inside one compositor.** The GPU pass draws one uniform grid of instanced cells. Mixing cell sizes there means a second instance buffer and atlas in the same pass. It's no cheaper than a second small canvas, and it's harder to fall back from.
- **Switching the grid mid-visit when the machine falls behind.** The whole scene would visibly re-lay itself while being read.

## Steps

1. Measure (step 0), and decide.
2. Mark the rose's command range in `Raster`; add the patch job and reply to the worker (`rasterize.ts`, `raster.worker.ts`).
3. Add a small `InsetRenderer` beside `AsciiRenderer`, sharing its atlas and modulation code, with its own canvas and compositor.
4. Cut out the main grid under the rose; place the patch over it in `mount.ts`. Only the poem asks for it (`mountGarden({ rose inset })`), and the poem goes back to 0.64.
5. Measure again, as in step 0. Then check the rose against the Rose spec's Verify list on both grids.

## Verify

- **Side by side, phone 390×844 and desktop 1440×900, at 18:50, 21:30 and 23:55:** the rose with the patch reads the same as the rose at zoom 0.5 today, with separate petal lobes, sepal spikes, and thin stalks under the head. Use screenshots or cell dumps of the head.
- **No visible seam:** where the stem enters the patch, and around the head's outline, at rest and while it sways in a gust.
- **Later lines** scroll over the rose and step it back by the same amount on both grids.
- **The cursor's light** crosses from the meadow onto the rose without a jump.
- **The fallback:** with the patch disabled, the page shows today's home-grid rose and nothing breaks.
- **Step 0's numbers** at 4× CPU: the poem is within 10% of home's.

## Open questions

- Does the reader's laptop make step 0 moot? A recent Apple Silicon MacBook very likely runs today's poem smoothly. An older Intel or budget Windows laptop is where this pays.
- Should the patch also cover the lower leaves, if their stalks read noticeably thicker on the main grid? That costs about twice the patch area, still small.
