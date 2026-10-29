# Garden performance on slower machines: what other projects do

Two questions, researched on 2026-10-29 from the source of open-source projects:

1. How do mature web graphics engines adapt quality to the device they land on?
2. Could the ASCII conversion run on the GPU instead of in CPU workers?

Where the garden stands is in [2026-10-29-garden-zoom.md](2026-10-29-garden-zoom.md). On an M4 the
page runs at 120 fps and plants redraw about 58 times a second. Worker time is about 54 ms per
raster. With the CPU slowed 4×, the last measurement, taken before the 120 Hz work, was 22 fps at
zoom 0.64. Mid-range machines haven't been measured since that change.

## Recommendation

1. **Measure first.**
   - Run the garden on one real mid-range laptop, not only Chrome's CPU throttle. It isn't clear
     whether that throttle slows the workers, and they now do most of the work.
   - Split the worker's "colour" and "kind" stages (about 16 and 15 ms) into drawing and the
     `getImageData` read-back. The fix differs depending on which one dominates.
2. **Add adaptive quality.** It's cheap and covers every device. The design is below.
3. **Move sampling and typesetting to a shader only if 1 and 2 leave slower machines short.** Keep
   the Canvas2D drawing.
4. **Don't port the drawing itself to the GPU for now.** It's several times the work for a gain
   only visible as smoother flowers on fast machines.

## 1. Adaptive quality

### What others do

**drei `PerformanceMonitor`** ([source](https://github.com/pmndrs/drei/blob/master/src/core/PerformanceMonitor.tsx))
- **Measuring:** it averages fps over 250 ms windows and keeps 10 of them.
- **Stepping:** it steps a 0–1 quality factor by 0.1 only when more than 75% of the windows agree
  it's too slow or too fast. One step therefore takes at least 2.5 s.
- **Thresholds:** they follow the refresh rate. The defaults are 40–60 fps, or 60–100 on a display
  above 100 Hz.
- **Flip-flops:** an optional limit on up-and-down flips pins a fixed level once it's reached.

**Babylon.js `SceneOptimizer`** ([source](https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Misc/sceneOptimizer.ts))
- **Checking:** every 2 s it compares fps to a target and, if fps falls short, applies the next
  priority level of cuts.
- **Order:** the cheapest-to-lose effects go first and resolution goes last.
- **Direction:** it only ever steps down.

**hls.js `FPSController`** ([source](https://github.com/video-dev/hls.js/blob/master/src/controller/fps-controller.ts))
- **Measuring:** it watches the share of dropped frames over 5 s, not raw fps, so it works the
  same at any refresh rate.
- **Stepping:** above 20% dropped, it caps quality one level lower and never lifts the cap.

**Frame-delta guards** in PlayCanvas, Pixi and Phaser
- **Limit:** each caps how much simulation time one frame can owe, at about 100 ms.
- **Garden:** we already do this. `MAX_STEPS = 6` in `mount.ts`, and any backlog past that is dropped.

**MapLibre worker count** ([source](https://github.com/maplibre/maplibre-gl-js/blob/main/src/util/worker_pool.ts), [A/B in PR #2354](https://github.com/maplibre/maplibre-gl-js/pull/2354))
- **Count:** it uses 1 worker on Chromium and Firefox, and up to 3 on Safari. Heavier workloads did
  better with 4, so the right count depends on the workload.
- **Caveat:** WebKit rounds `hardwareConcurrency` to 4 or 8, so it's only a coarse hint.

### What doesn't fit

- **`detect-gpu`** rates GPU 3D speed from benchmark tables. Our cost is CPU drawing, it can't tell
  Apple M-series chips apart in Safari, its data stopped updating in December 2025, and it fetches
  up to 155 KB.
- **Lowering device pixel ratio** mostly cheapens the final WebGL pass, which is already about
  1.6 ms.

### Design for the garden

- **Levels:** a short ladder, cut in Babylon's order, each level applying its settings together:
  1. Full quality.
  2. No cursor light and no cloud refresh.
  3. Plants redraw at most 30 times a second.
  4. Plants redraw at most 15 times a second, with fewer workers.
  5. Larger cells or zoom.

  Cell size and zoom change the look most, so they go last.
- **Signal:** drei's windowed vote, scaled to the observed refresh rate. Watch two things:
  - page frame time, the main thread;
  - plant redraws per second, the workers.

  The page can hold 120 while the workers fall behind, so neither alone is enough.
- **Pace:** step down fast and step up slowly, and pin the level after a couple of flip-flops.
- **Memory:** store the settled level in `localStorage` and start there next visit, as hls.js
  does, so a slow machine doesn't relearn it on every page load.
- **Starting point:** start one level lower with `saveData`, or with `hardwareConcurrency <= 4`.
  Reduced motion already settles the scene and stops.
- **First raster as benchmark:** its worker time is a direct measure of this machine's speed, which
  is better than guessing from the GPU name. This idea is ours; we didn't find it in another
  project.

Effort: about one to two days, mostly tuning thresholds on real machines.

## 2. ASCII conversion on the GPU

### What others do

**pmndrs postprocessing `ASCIIEffect`** ([shader](https://github.com/pmndrs/postprocessing/blob/main/src/effects/glsl/ascii.frag))
- It takes one colour sample per cell and picks a glyph from a brightness ramp in a canvas-built
  atlas.
- Our final WebGL pass already does that much. It's too simple for our sampling step.

**Acerola's ASCII shader** ([source](https://github.com/GarrettGunnell/AcerolaFX/blob/main/Shaders/AcerolaFX_ASCII.fx), ReShade HLSL)
- **Colour:** an eighth-size image supplies each cell's colour and brightness.
- **Lines:** a Sobel pass gives each pixel an edge direction. One GPU workgroup per cell then
  votes among four buckets (`| - / \`) and takes the winner.
- **Glyphs:** small images hold the edge glyphs and fill glyphs.
- This is the closest match to our stem-direction and line rules. Even here, each cell's tally is
  a plain loop.

**Ordered dither** ([Acerola's dither](https://github.com/GarrettGunnell/AcerolaFX/blob/main/Shaders/AcerolaFX_Dither.fx))
- It's an 8×8 Bayer lookup, the same as our land halftone.

**three.js `AsciiEffect`** works on the CPU the way we do now: it draws, reads the pixels back,
and picks characters in JavaScript.

### Fit with our rules

A GPU version would be two passes over textures at cell resolution:
- **Cell pass.** For each cell (about 290×130 = 38k), loop over its 35 pixels with `texelFetch`.
  Write the majority kind, petal id, average colour, slope light and a line-direction bucket.
- **Typeset pass.** Read the 3×3 neighbourhood of each cell and pick its glyph, ink, alpha, tile
  and flags.

| Rule | In a shader |
|---|---|
| Majority-vote kind | Easy |
| Petal seams (neighbour has a different petal id) | Easy |
| Stem direction | Easy: a four-bucket vote, as in Acerola |
| Land halftone (Bayer) | Easy: a lookup |
| Per-material glyph ramps | Easy: a small lookup texture |
| Motif glyphs over far heads and insects | Fine if drawn as sprites from their known positions in the final pass |
| Anything that depends on the previous cell's choice | Doesn't parallelise; avoid |
| Exact match with today's output | Not realistic; review by eye |

### Stages and cost

**Stage 0: profile.** Split drawing from `getImageData` read-back in the colour and kind stages.
Also try drawing the hidden canvases at a lower resolution per cell; their cost scales with area.

**Stage 1: keep Canvas2D drawing, move sampling and typesetting into shader passes.**
- **Saving:** most of the 20 ms of sampling and 10 ms of typesetting, and all of the read-back.
  The estimate is roughly twice as many plant redraws per second. This is an estimate, not a
  measurement.
- **Risk:** getting the canvases to the GPU. A worker's WebGL context can't share textures with the
  page's, so the canvases cross as `ImageBitmap`s and are uploaded on the main thread, about 5 MB
  each per raster. That may cost 1–2 ms per canvas in Safari or Firefox against an 8.3 ms frame at
  120 Hz. Measure that before committing.
- **Data integrity:** colour premultiplied by alpha can corrupt id data stored in a canvas's colour
  channels where alpha is below 255. Our Canvas2D canvases already risk this.

**Stage 2: draw the shapes on the GPU too**, writing colour, kind and meta at once with multiple
render targets.
- **Effort:** about three to five times stage 1. It needs path tessellation (earcut or lyon, as
  PixiJS does), gradient shaders, and antialiasing that matches.
- **Blending:** blending applies to every target at once, which would smear kind ids. Ids need
  their own unblended pass or a coverage threshold.
- **Alternatives:** a WASM rasteriser in the workers (`vello_cpu`, or Skia's CanvasKit) keeps the
  current structure. vello's WebGL2 GPU backend exists but is young.

WebGPU doesn't change the plan. Support is now broad but not universal, so a WebGL2 path would
still be needed.

## Sources

The two research passes read source code where possible. Unconfirmed points are marked above:
- the GLES blending and integer-target limits;
- iOS Low Power Mode capping animation at 30 fps;
- the Codrops article, which was blocked.

Check those before building on them.
