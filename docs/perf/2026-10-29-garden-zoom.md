# Garden performance, and what an 80% zoom costs

Measured 2026-10-29 on `meadow-site` (after 8a9b45d), production build, Chrome 156,
1440×900 CSS at 2× density (canvas 2880×1800), Apple M4, display at 120 Hz. "4× CPU" is
DevTools throttling of the page's main thread, standing in for a mid-range laptop. It does not
throttle the raster workers, so the 4× worker figures are optimistic.

`zoom` is the scene zoom in `components/garden/mount.ts` (`SCENE_ZOOM`). Today it's 0.8.
The 80% Stanley wants, the same as pressing Cmd-minus twice, is 0.8 × 0.8 = 0.64. That gives
1.56× the cells and raster pixels and 1.25× the plants. The device pixels stay the same.

## Numbers

| | zoom 0.8, M4 | zoom 0.64, M4 | zoom 0.8, 4× CPU | zoom 0.64, 4× CPU |
|---|---|---|---|---|
| Cells (cols × rows) | 90,450 | 141,876 | 90,450 | 141,876 |
| Raster px | 900×402 | 1126×504 | 900×402 | 1126×504 |
| Plants | 49 | 57 | 49 | 57 |
| Page fps | 99 | 53 | 19 | 14 |
| Plant frames/s (worker replies) | 45 | 24 | 19 | 13 |
| `ascii.render` per frame, mean | 8.5 ms | 16.5 ms | 41 ms | 57 ms |
| of which `ascii.sample` (only on a new raster) | 3.9 ms | 8.0 ms | 15 ms | 23 ms |
| `garden.draw` (recording) | 2.0 ms | 3.1 ms | 7.3 ms | 8.9 ms |
| `garden.step` (simulation) | 0.3 ms | 0.4 ms | 0.9 ms | 1.1 ms |
| Worker round trip | 42 ms | 79 ms | 44 ms | 99 ms |

The CPU profile at zoom 0.8 on the M4 (11 s) shows two things:

- The main thread is 93% busy. Most of that is `render` and `sample`, followed by the
  per-cell helpers `render` calls (`petal`, `lineAt`, `petalSeam`, `headCells`). Garbage
  collection is about 3%.
- In each worker, about 68% of the time is `getImageData`. A frame takes 3.1 ms to replay
  about 1,290 fills, 675 strokes and 2 gradients. Then it takes 8.6 ms to read back the colour
  canvas, 8.0 ms for the material canvas and 2.6 ms for the meta box. An empty readback costs
  0.6 ms, so the readback time is Skia rasterising the deferred paths, not the copy. Every
  path is rasterised twice, once into colour and once into material.

## What's slow, in order

1. **The full per-cell pass runs on every display frame.** `AsciiRenderer.render` re-classifies
   every cell on every rAF. That covers glyph, ink, tile, petal seams and line direction, at
   120 Hz on a ProMotion display. The raster it reads changes only 24–45 times a second. Only
   the clouds, star twinkle and the light near the cursor change between rasters. This is
   most of the main thread.
2. **The main thread is congested, which slows the workers.** A worker's ~22 ms of work comes
   back after 42–79 ms, because replies wait behind `render`. Plant motion is capped by that
   wait, not by the workers.
3. **The worker rasterises every path twice.** It fills the colour canvas and the material
   canvas separately, and readback forces both to rasterise. The work scales with raster area,
   which is what grows when zooming out.
4. **`sample` runs on the main thread.** It walks the full colour, material and meta arrays
   (about 1.4 MB each at 0.64) to vote each cell. The worker already holds those pixels.

## Recommendation

Fix 1 and 4, then make the zoom change. Doing the zoom first makes a slow page 1.5× slower.

1. **Split `render` into two passes** (biggest win, moderate change). Classify cells only when
   a new raster arrives, or when the palette, size or dim boxes change. Cache glyph, ink and
   tile per cell. Each display frame, run only a cheap pass over the cells that animate: sky
   rows with clouds or stars, and the circle of light around the cursor. Expect `render` to
   drop to about 1–3 ms on frames with no new raster.
2. **Cap the loop at 60 Hz.** It's a few lines, and on a 120 Hz display it halves the
   main-thread work right away. The garden's motion gains nothing from 120 Hz.
3. **Move `sample` into the worker.** It would post per-cell coverage, kind, colour and meta
   instead of full-resolution pixels. That's smaller transfers, and about 4–8 ms off the main
   thread per raster.
4. **Use more workers.** Use `min(4, hardwareConcurrency - 1)` instead of 2. Once the main
   thread is free this raises plant frames/s. It's cheap to try.
5. **Later, if it's still needed:**
   - Cache the land, ridges and snow, which are big, mostly still shapes, as a bitmap per
     palette.
   - Adapt to slow machines: raise the cell size or lower the raster rate when frame time
     stays above budget.

Rough expectation, not measured: with 1–3 done, zoom 0.64 on the M4 runs near 60 fps
throughout. On a 4× CPU it runs about 30–45 fps, with plants at 20–30 frames/s.

## After the fixes

These were built on 2026-10-29: 60 Hz cap (60f9f3d), plant and land cells worked out once per
raster (c35a59c), cells reduced in the workers with up to four of them (f77f6c2), and hover no
longer stirring the plants (758197c). Same machine and method as above.

| | zoom 0.8, M4 | zoom 0.64, M4 | zoom 0.8, 4× CPU | zoom 0.64, 4× CPU |
|---|---|---|---|---|
| Page fps | 60 (was 99 at 120 Hz) | 60 (was 53) | 33 (was 19) | 22 (was 14) |
| Plant frames/s | 60 (was 45) | 51 (was 24) | 33 (was 19) | 22 (was 13) |
| `ascii.render` mean | 4.5 ms | 6.8 ms | 21 ms | 34 ms |
| Main-thread load | ~38% (was 93%) | ~55% | saturated | saturated |

The default is now 0.64 on screens 768 px and wider, and 0.8 on phones (`mount.ts`). On a
slower machine, 0.64 now runs a little faster than 0.8 did before these changes.

What's left for slower machines: every new raster still re-classifies every plant and land
cell on the main thread, about 34 ms at 0.64 with the CPU slowed 4×. The next step is to do that
classification in the workers too. It's mostly pure, given the cells, the palette and the head
stamps. The catch is that glyph codes are registered at runtime, so the worker and the page
need to agree on them.

## Method

The production build was served from a scratch copy with a `?zoom=` override and timing
hooks (not committed). Per-method timings came from wrapping prototype methods for 8 s after
the garden had grown. The CPU profile came from a DevTools trace. The worker split came from
timestamps posted back with each reply.
