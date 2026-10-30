# The plants at the display's rate while something moves them

Measured 2026-10-30. Before this change, the plants redrew 40 times a second at most. Now they
redraw on every display frame while the cursor, a scrub or the poem's scroll moves the scene. On a
120 Hz screen that's 120 a second, as long as the workers can keep up. Once the page has been still
for a second, the rate eases down to 40 over about another second. Resolution is untouched: the
grid stays at the scene's zoom, with 2×2 samples per cell, at full size.

## Where a plant frame's time goes

M4, home, `?seed=1715089390`, idle at 40 a second. Each row removes one layer from an instrumented
build:

| Drawn | Worker ms per frame | Cores |
|---|---|---|
| Everything | 18.7 | 1.32 |
| No flowers | 12.3 | 0.97 |
| No grass | 13.6 | 1.17 |
| Neither | 7.9 | 0.85 |

- **Flowers:** about 6.4 ms per frame, a third of it.
- **Grass:** about 5 ms.
- **Fixed per-frame work over the whole grid:** about 8 ms. Readback is 0.6, sampling cells 5.5,
  typesetting about 1, the land 0.4 and the globe 0.1.
- **A scrub:** about 4 ms more per frame, because the land is refilled every frame.
- **Main thread:** recording a frame takes about 1.3 ms.

So the flowers alone didn't keep the cores busy. The rate did: a frame of roughly equal thirds,
redrawn 40 to 80 times a second.

That's why the flowers don't get a rate of their own (flowers at 60, the rest at 120). They are
drawn into the same frame as the grass, and the work over the whole grid repeats whenever anything
in the frame changes. Splitting them would save about 6 ms on half the frames, or need a second
raster layer that costs about as much as it saves.

## How the rate is set (`components/garden/quality.ts`)

### While something moves the scene

The cap at full quality is the display's rate. Steps down the ladder cap it at 60, 30 and 20.

Two budgets also limit it:

- **Workers:** up to 3000 ms of worker time a second, and never more than a third of the machine's
  cores (`ACTIVE_BUDGET`).
- **Main thread:** 250 ms a second of recording (`RECORD_BUDGET`).

The rate snaps to a whole number of display frames, so the beat stays even. The beat changes only
after the budget has called for a new one for a full second (`BEAT_HOLD`). On the M4 a frame's
worker time wanders between 19 and 28 ms from second to second, probably as the workers land on
fast and slow cores. Without that hold, the beat flipped between 120 and 60 and averaged about 85.

### Once the page is calm

Calm means the cursor and any scrub have been still for a second. The beat then lengthens by one
display frame every 500 ms (`EASE_STEP`) until it reaches the calm cap. At 120 Hz that's 120, then
60, then 40. At 60 Hz it's 60, then 30.

These are unchanged:

- the calm caps: 40, 30, 20, 20;
- the 1000 ms budget;
- 30 a second after 30 s idle;
- away and hidden behaviour.

### The poem

A new hour from elsewhere (the poem's scroll, the time slider) now counts as movement, so
scrolling the poem wakes the plants too. Between plant frames, a new hour changes nothing on the
page, so it doesn't make the page draw on every display frame. Only the cursor, a wheel scrub and
a shooting star do that. A shooting star doesn't count as movement, since it's painted on the main
thread and the plants don't change.

Without workers, the page rasterises the plants itself, and its recording time (`recordMs`) is the
only measure the rate needs. It's capped by `RECORD_BUDGET`, as on any slow main thread.

## Results

Fresh Chrome with no extensions, 1440×900 at 2×, focus emulated, home with
`?seed=1715089390`, 8 s per run. "Main" is origin/main at 0afc080; "new" is this change, in its
final form.

- **Cores** is CPU across all of Chrome's processes.
- **Plants** is plant frames back from the workers per second.
- **Hour events** sends the garden a new minute every 33 ms through `setHour`, the path the poem's
  scroll takes. The production poem is behind its password, so the test runs on home, where the
  garden code is the same.

| Case | Main: cores | Main: plants | Main: page fps | New: cores | New: plants | New: page fps |
|---|---|---|---|---|---|---|
| Idle | 1.37 | 40 | 120 | 1.29 | 40 | 120 |
| Cursor moving | 1.56 | 40 | 120 | 3.95–4.34 | 108–111 | 120 |
| Scroll scrub | 1.92 | 38 | 120 | 3.28–4.77 | 64–103 | 120 |
| Hour events | 1.66 | 40 | 120 | 2.83–4.29 | 65–99 | 120 |
| 4× CPU, idle | 2.01 | 39 | 120 | 2.06 | 40 | 120 |
| 4× CPU, cursor moving | 2.28 | 39 | 115 | 2.32 | 41 | 114 |
| 4× CPU, scroll scrub | 2.46 | 32 | 72 | 2.42 | 32 | 81 |
| 4× CPU, hour events | 2.42 | 40 | 119 | 2.21 | 34 | 117 |

Ranges are separate runs of the same case.

A note on each case:

- **Idle** costs what it did.
- **The cursor moving on the M4** costs about 4 cores, up from 1.6. That's the price of 120
  plant frames a second. It lasts only while something moves, plus about 2 s.
- **A scrub or the poem's hours** cost more: these frames take 24–27 ms, because the land is
  refilled every frame. That sits on `ACTIVE_BUDGET`'s line at 120, so a run settles at 120 or at
  60, depending on how the frame times fall. Each settles for at least a second (`BEAT_HOLD`), so
  the beat doesn't judder. At 120 that's up to 4.8 cores, briefly.
- **At 4× CPU** the recording budget holds the active rate near 40. In an earlier build without
  it, the plants recorded 64 a second and the page fell to 103 fps with the cursor moving. In an
  earlier build where a new hour also drew the page on every display frame, the page fell to
  103 fps during hour events.

`Emulation.setCPUThrottlingRate` slows only the page's main thread, not the workers. So the 4×
rows test a slow main thread, not a slow machine. A slow machine's workers are caught by
`ACTIVE_BUDGET`: at a 76 ms frame they'd run 30 a second while active.

The easing after the cursor stops, measured as plant frames per second in 250 ms bins starting
0.5 s before the stop:

```
120 116 | 112 112 112 108 100 120 60 60 40 40 40 40
```

Before the second-long hold on the beat, the same run read
`120 112 | 104 72 56 64 68 124 64 60 40 ...`. The rate flipped between 120 and 60 as frame times
wandered.

## The backdrop follows the frame on screen

While scrubbing, the plant frame on screen was recorded an hour-step or two before the page drew
it. Meanwhile, the sky, the glow and the ridges were painted for the current hour, so the sun's glow
ran ahead of the land.

`Raster` now keeps the hour each frame was recorded at (`raster.hour`). The page paints the
backdrop, the clouds, the stars and the birds in that hour's palette. The CSS page colours still
follow the current hour.

A side benefit: the backdrop is repainted and uploaded to the GPU once per new plant frame during a
scrub, not on every display frame, because its key now follows the frame's hour.
