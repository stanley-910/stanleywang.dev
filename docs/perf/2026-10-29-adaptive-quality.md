# The opening, big windows, and adaptive quality

Measured 2026-10-29 on `meadow-site`, production build, Chrome, Apple M4, display at 120 Hz, at
about 17:50 scene time. This follows the plan in
[2026-10-29-adaptive-and-gpu-research.md](2026-10-29-adaptive-and-gpu-research.md).

## Method

The build was served from a scratch copy with timing hooks, which aren't committed:
- **Page:** each frame's time and main-thread work.
- **Worker stages:** the time each stage takes.
- **Fill vs read-back:** a 1×1 `getImageData` forces a canvas to fill, so a full read after it
  times only the copy.

Chrome's CPU throttle slows only the page's main thread; worker stage times were the same with
and without it. To stand in for a slower machine, the workers were also slowed: each one spins
for twice its own run time, making it 3× slower.

## What the measurements showed

**Worker time is the fills, not the read-back.** At 1440×900:

| Stage | ms |
|---|---|
| Replaying the commands | 3.2 |
| Filling the colour canvas | 5.3 |
| Filling the kind canvas | 5.3 |
| Reading back the meta box | 1.4 |
| Copying the colour pixels | 0.3 |
| Copying the kind pixels | 0.3 |
| Sampling cells | 5.2 |
| Typesetting | 4.2 |

Read-back is cheap once a canvas is filled, so drawing at a lower resolution per cell is the lever
there, not a GPU read-back path.

**The main thread's biggest cost is recording the plants.** With the CPU slowed 4×:
- `garden.draw` takes 6.6 ms per raster: plants 5.0 ms, grass 1.1 ms, land 0.4 ms.
- Per plant, a dandelion costs 0.21 ms, a cosmos 0.17 ms and a poppy 0.04 ms.
- `ascii.render` takes 3.4 ms a frame, and the simulation under 1 ms.

Fast workers ask for a new recording nearly every frame, so this cost follows the plant rate.

**The stutter in the opening came from cold workers.**
- A worker's first replies take 90–210 ms while its code compiles, against 20–40 ms once warm.
- The page also drew two rasters synchronously on load: one from `resize()` and one when the
  ResizeObserver fired its first callback at the same size.

So the first quarter-second of growth came in jumps, just as the meadow faded in. At 1800×1125 and
1.6× density, about 80% browser zoom, the first 250 ms showed 2 plant frames.

**Big windows** cost the workers in proportion to their cells:

| Window | Cells | Page fps | Plant frames/s | Worker round trip |
|---|---|---|---|---|
| 1440×900 | 90k | 120 | ~95 | 26 ms |
| 2560×1440 | 258k | 120 | 42 | 87 ms |
| 3440×1440, before the budget | 345k | — | — | — |
| 3440×1440, with the budget | 271k | 120 | 33 | 100 ms |

**Worker cost changes with the hour.** At 18:12 scene time, with the sunset lighting the ridges, a
raster took about 47 ms on the M4 (fills 19 ms, sampling 11 ms), against 26 ms at 17:50. The lit
slopes add fills, so the plants redraw about 65 times a second at sunset instead of 95.

## What changed

1. **The opening waits for warm workers** (`mount.ts`, `raster.ts`).
   - The meadow stays hidden and the grow-in's clock stays at zero until the workers have sent back
     three frames.
   - The cold frames are spent on the bare meadow, out of sight.
   - The reveal starts about 250 ms after load, and the plants grow at the workers' warm pace from
     the first visible frame.
   - A resize at an unchanged size now does nothing, which removes the second synchronous raster.
2. **Cell budget** (`mount.ts`). The grid lays out at most 270k cells, a 27-inch 1440p window at
   zoom 0.64. A bigger window zooms the scene in instead, so its cost stops growing with its area.
3. **Adaptive quality** (`quality.ts`).
   - **Measuring:** a vote over ten 250 ms windows, as in drei.
   - **Display rate:** taken from a low percentile of frame gaps, snapped to a common rate, so a
     page that is behind from its first frame still sees 120 Hz. It's the highest of the last
     1.5 s, shorter than a vote, so a display dropping to 60 Hz to save power is followed before
     the page counts as behind. Votes cast against an old rate are dropped.
   - **Not counted:** windows while the page does work of its own: a scrub, a new hour from the
     time slider or the poem's scroll restyling the page, or a resize laying out the scene.
   - **Levels:**
     1. Full quality.
     2. Plants redraw at most 60 times a second.
     3. Plants redraw at most 30 times a second.
     4. As 3, and the page draws at half rate above 90 Hz.
   - **Pace:** a step down needs 8 of the last 10 windows behind. A step up needs 10 s with no
     window behind and frame work under half a frame. After two steps back up that failed within
     10 s, the level is pinned for the visit.
   - **Grid:** if the plants average under 20 redraws a second, well below the cap, the next visit
     zooms the scene 1.25× coarser. 45 a second at a cap above that clears it.
   - **Memory:** the level and grid are kept in `localStorage` (`garden-quality`), as in hls.js.
   - **Starting point:** with no saved level, a machine with four or fewer cores, or with
     `saveData`, starts at level 2.

## Results

| Case | Before | After |
|---|---|---|
| M4, 1440×900 | 120 fps, plants ~105/s | 120 fps, plants ~94/s, stays at full quality |
| Main thread 4× slower, 1440×900 | ~80 fps, plants ~80/s | settles at level 2: 105–110 fps, plants 55–57/s |
| Main thread and workers 3× slower, 2560×1440, first visit | 75–90 fps, plants 11–17/s | steps to level 4, flags the coarse grid |
| Same, second visit | — | 165k cells instead of 258k: 105–116 fps, plants 16–20/s |
| Fast machine starting from a saved level 3 | — | back to full quality in about 22 s |
| Opening at 80% browser zoom | 2 plant frames in the first 250 ms, then ~100/s | hidden until warm, then ~92/s from the first visible frame |

These are simulated slow machines. A real mid-range laptop is still the test that counts,
especially its workers and its GPU.

## Not done

- **Cheaper plant recording.** Dandelions and cosmos cost 4–5× a poppy to record. Caching each
  plant's shapes between frames when it hasn't moved would cut the main thread's biggest cost.
  It's worth doing if a real slow machine still struggles at level 2.
- **Smaller fill canvases.** Filling at one sample per cell instead of two would quarter the
  fills, at the price of thinner stems surviving less often.

## 2026-10-30: the coarse grid is gone

Stanley found the far flowers blurred and hadn't asked for a lower resolution. Once the coarse grid
was also triggered by slow worker frames (0113b52), a busy machine (the perf runs shared it with
other agents at load 6–42) could save it, and every later visit drew the whole scene 1.25× coarser
until one proved fast. Small, distant flowers lose the most. A slow machine now only gets fewer
plant redraws a second (the ladder and the worker budget); the grid stays at `SCENE_ZOOM`. The
storage key moved to `garden-quality-3`, so a saved coarse grid is dropped.
