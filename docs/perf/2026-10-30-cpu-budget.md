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

All in `quality.ts` and `mount.ts`:

1. **Full quality caps the plants at 40 a second**, every third frame at 120 Hz and every other at
   60. The ladder is now 40, 30, 20, and 20 with the page at half rate. The coarse-grid check now
   looks for 90% of the finest cap instead of a fixed 45 a second, which a cap of 40 could never
   reach.
2. **Calm pages draw on the plants' beat.** When the cursor hasn't moved for a second, there's no
   scrub or glide, the hour hasn't been set elsewhere and no shooting star is out, the page draws
   only on the frames the plants can change. Moving the cursor brings back every display frame at once, so the cursor's light
   stays smooth.
3. **Away, the meadow slows down.** When the window loses focus, the plants redraw 12 times a
   second and the page draws at 30. The quality vote ignores this time, but the display rate is
   still measured.
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

## Next, if it isn't enough

- **Cell sampling in the worker** (7–8 ms a frame) could take a fast path for cells whose four
  subsamples are all one kind.
- **The poem's finer grid** costs about 52 ms a plant frame against 27 on home; it could
  draw at a lower cap.
- **Fill canvases at one sample per cell** would quarter the fills, at the cost of thin stems.
