# What one open tab costs, and capping it

Measured 2026-10-30 on this branch against its parent (e080a64), production builds, Chrome 156, a
fresh profile per run (no saved quality level, no DevTools throttle), 1440×900 at 2×, Apple M4,
display at 120 Hz, after midnight scene time. Follows
[2026-10-29-adaptive-quality.md](2026-10-29-adaptive-quality.md).

## The problem

The page held 120 fps, but one idle tab of the home page kept about four cores busy and spun the
fans. Frame rate was never the issue; work per second was.

- **The plants weren't capped at full quality.** Workers returned 60–80 plant frames a second.
- **Each plant frame costs about 40 ms of CPU** across the page, the workers and the GPU process.
  In the worker, on a quiet machine: replay 3, colour fill 7, kind fill 6, cell sampling 7–8,
  typesetting 4 ms. On a loaded machine every stage ran about 3× slower.
- **The page drew every display frame** even when only the clouds and star twinkle had moved.
- **A visible tab in a window that isn't in use** (another app in front) cost the same as one being
  watched.

## What changed

All in `quality.ts` and `mount.ts`, as amended by the second pass below:

1. **Full quality caps the plants at 40 a second**, snapped to a whole number of display frames:
   every third frame at 120 Hz (40), every other at 60 (30). The ladder is now 40, 30, 20, and 20
   with the page at half rate.
2. **Calm pages draw only when a plant frame arrives.** When the cursor hasn't moved for a second,
   there's no scrub or glide and no shooting star is out, the page records every frame under the
   cap but draws only when a new plant frame has come back. Moving the cursor brings back every
   display frame at once, so the cursor's light stays smooth.
3. **Away, the meadow slows down.** When the window isn't the one in use and nothing is moving the
   cursor or wheel over it, the plants redraw 12 times a second and the page draws at 30. The
   quality vote ignores this time, but the display rate is still measured and kept.
4. **The saved level moved to `garden-quality-2`**, since the levels mean something new. Levels
   saved under the old ladder, including ones learnt under DevTools throttling, are dropped.

## Results

Cores busy across all of Chrome's processes, averaged over 8–10 s. The other agents' load varied
between runs, so compare rows taken together rather than across the table.

| Case | Before | After |
|---|---|---|
| Home, idle | 4.1–4.7 | 1.7–2.5 |
| Home, cursor moving | 4.1–4.7 | 2.0–2.7 |
| Home, window not in use | 4.1 | 0.7–0.85 |
| Poem, idle | 4.1 | 2.5 |
| Poem, scrolling | 4.0–4.2 | 2.1–2.4 |

| Home, after | Page draws/s | Plant frames/s | Round trip |
|---|---|---|---|
| Idle | 40 | 40 | 27–31 ms (was 43) |
| Cursor moving | 120 | 37–40 | 35 ms |
| Window not in use | 30 | 10–12 | 23 ms |

The page's rAF ran at 120 throughout. The longest frame gap stayed at 9.4 ms in most runs. Both
builds showed a rare 16.6 ms gap under load.

## Ruled out

- **GPU canvases in the workers** (`willReadFrequently: false`). Worker time per plant frame fell
  from 67 to 48 ms, but the GPU process took on more than that, and the total went from 2.3 to 4.7
  cores. Reverted.

## Method

The workers were timed per stage with temporary hooks, now removed. A probe script wrapped
`requestAnimationFrame`, `Worker` and WebGL's `drawArrays` to count main-thread time, plant frames
and page draws. Each run launched a fresh, visible Chrome over the DevTools protocol with focus
emulated, and summed CPU time for its processes from `ps`. Headless Chrome isn't usable for this:
its raster workers stall and the page falls back to drawing on the main thread. The app's own
browser pane is throttled when its window isn't on screen.

The machine was shared with other agents throughout, and load averages ran 6–42 on 10 cores. A
repeat on an idle machine, and a real mid-range laptop, are still to do.

## Second pass, the same night

Measured on a quieter machine (load 4–7) against the first pass, same build method, the meadow
pinned with `?seed=1715089390`.

1. **The plants keep within a budget of worker time.** Each worker reply carries its time on the
   frame; `quality.ts` keeps the plants to about one core of it (`PLANT_BUDGET`), down to 20 a
   second. On an M4 that's still 40; a laptop whose frames take 50 ms or more gets 20, and the next
   visit takes the coarse grid. The budget's beat has a margin so a frame time near a step doesn't
   flip it.
2. **After 10 s with no cursor or scrub the plants slow to 30 a second.**
3. **V8 was compiling `sampleCells` about 1,300 times a second.** A trace showed V8's compilers
   busy about 0.3 cores on an idle tab. `sampleCells`, one long loop nest run a few times a second
   per worker, was compiled partway through each run and dropped when its inner loop ended
   ("exit from OSR'd inner loop"). Called once a row instead, it's compiled whole in the first
   frame. The same treatment, as a closure, for the typesetter, `ascii.render` and `relief` made
   things worse (+0.55 cores for the typesetter alone) and was dropped; they had a tenth of the
   recompiles.
4. **The poem's scroll stopped restyling the page every frame.** It handed the page a new hour
   each display frame, for about 1.5 s after a scroll stopped, and each one rewrote the root's
   colour variables. Now the page hears the hour to the minute, the loop stops at rest, and
   `applyColours` skips colours it has already written. A set hour no longer counts as lively.
5. **The poem uses home's grid** ([2026-10-30-rose-inset.md](2026-10-30-rose-inset.md)).
6. **WebGL asks for the low-power GPU**, which keeps two-GPU laptops on the integrated one.

| Cores busy, all of Chrome | First pass | Second pass |
|---|---|---|
| Home, idle | 1.42 | 1.01–1.02 |
| Home, cursor moving | 1.74–1.75 | 1.49–1.50 |
| Poem, idle | 1.47–1.48 | 1.05–1.09 |
| Home, 4× CPU | 1.87–1.90 | 1.75 |

Page fps stayed at 120 in every run (119 at 4× CPU).

A per-process split of the second pass, idle: renderer 0.95 (workers about 0.45, page main thread
0.1, the rest V8's compilers and GC), GPU process 0.03.

### Tried and not landed

- **Two samples across a cell and one down** (`SS` 2×2 to 2×1): a plant frame's round trip fell
  from 20.5 to 16 ms, about 0.25 cores while the cursor moves. The grass thins visibly and loses
  some of its slanted strokes, so it's left for Stanley to judge.
- **Drawing at 60 while the cursor moves**, on a 120 Hz display: about 0.15 cores, for a choppier
  light around the cursor. Not done.

## Next, if it isn't enough

- **Cell sampling in the worker** (7–8 ms a frame) could take a fast path for cells whose four
  subsamples are all one kind.
- **The poem's finer grid** cost about 52 ms a plant frame against 27 on home. The poem now uses
  home's grid ([2026-10-30-rose-inset.md](2026-10-30-rose-inset.md)).
- **Fill canvases at one sample per cell** would quarter the fills, at the cost of thin stems.
