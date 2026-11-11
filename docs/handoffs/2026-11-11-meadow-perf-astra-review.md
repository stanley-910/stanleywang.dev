# Astra's cross-review of the meadow perf plan

GPT-6 Astra through codex, high effort, read-only, 2026-11-11. Reviews the first draft of
[docs/perf/2026-11-11-meadow-perf-plan.md](../perf/2026-11-11-meadow-perf-plan.md); the plan has since been revised to its verdicts.

## Prompt

```text
You are cross-reviewing a performance plan before anything is implemented. Read-only: do not edit files, do not run builds or servers.

Read docs/perf/2026-11-11-meadow-perf-plan.md (the plan), then the code it cites under components/garden/ (engine/rasterize.ts, engine/raster.ts, engine/ascii.ts, engine/gl.ts, engine/garden.ts, engine/meadow.ts, engine/typeset.ts, mount.ts, quality.ts) and the earlier notes docs/perf/2026-10-30-cpu-budget.md and 2026-10-30-active-rate.md. The hard rule is that the rendered output (cells, glyphs, colours, frame rates, resolution) must stay bit-identical; only speed may change.

Review adversarially and answer, with file:line evidence:
1. Correctness of each item A1-A8, C1-C5: is it truly output-preserving? Name every input or side effect the plan missed that would make a cache or memo stale or wrong. In particular:
   - C2 (memoising sampleRow per cell by comparing the previous frame's colour/kind/meta pixels as 32-bit words): is the cell's output a pure function of exactly those twelve pixels plus the meta box and constants? Check sampleRow's use of md inside `box` only, getImageData un-premultiply determinism, what stampHeads and the Typesetter mutate, canvas resize, the probe path, and whether keeping three previous readbacks is a memory or GC problem.
   - A2 (caching land commands and relief): list every input drawLand, the river, slopes/slopeLight and relief read (hour, palette, moon/sun position, weather, snow cover, lightning, size, seed, regrow, zoom, probe) and say what the cache key must contain.
   - A7 (integer land colours): does replay's rgba() really truncate so the pixels are identical, including gradients and alpha?
   - C1 (row-dirty compositing): list every per-cell dependency in AsciiRenderer.render that the dirty test must cover (dim boxes, palette, time-driven stars, cloud ticks, pointer active/inactive transitions, veil, backdrop key, meteors, birds, weather, flash, storm glow, disc, glint, atlas reset, resize).
   - C4: any way the intro or the warm-up count changes behaviour.
2. For each item give your own estimate of the gain (ms per plant frame, ms per drawn frame, cores, or KB) and say whether the plan's estimate is too high, too low or about right, and why. Then give your own expected totals for: worker ms per plant frame, main-thread ms per plant frame, cores idle and cursor-moving, and fps at 4x main-thread slowdown.
3. What the plan missed: any larger output-preserving win in these files (for example in getImageData/fill cost, the typesetter, texture uploads in gl.ts, the rAF loop in mount.ts, quality.ts budgets).
4. Ordering and the verification gate in Step 0: is it sufficient to prove bit-identical output? What would you add?

Be concrete and terse. End with a verdict per item: KEEP, FIX (say how), or DROP.
```

## Answer

**Do not approve the plan unchanged.** C2 is fundamentally sound; A2, A3, A6 and C1 need tighter dependency rules. C4 changes startup behaviour. The estimates are plausible targets, not supported totals.

Read-only review completed; no edits, builds or servers.

There is also a contract conflict: the plan requires identical rates but targets 101→120 fps. Faster `frameMs` and `recordMs` also change the plant cadence through [quality.ts:185](../../components/garden/quality.ts:185). The verdicts below mean **identical output for identical jobs and event schedules**. Literal wall-clock frame identity is not established by this plan.

**1. Correctness**

**A1 — Lazy `mats` clearing is safe.** Clear inside the existing first-seen-kind branch when `k === Land`, before voting. Land material is read only when the winning kind is Land, which necessarily encountered that branch. Do not clear only on the first *valid meta pixel*: a land cell with no valid meta still needs eight zero votes. [rasterize.ts:460](../../components/garden/engine/rasterize.ts:460), [rasterize.ts:552](../../components/garden/engine/rasterize.ts:552).

**A2 — Cache the complete land state, not an approximate palette/hour key.**

Required dependencies:

- **Exact scene hour**, including fractional scrub hours. Sun/moon position, facing, low-angle light, rim light, snow geometry and mist alpha change even when palette RGB does not. `slopes` additionally reads ridge geometry, layer, reach, facing, shade reach and scene height. [garden.ts:1355](../../components/garden/engine/garden.ts:1355), [garden.ts:1410](../../components/garden/engine/garden.ts:1410), [garden.ts:2167](../../components/garden/engine/garden.ts:2167).
- **Exact effective palette values**: `night`, `moonlight`, `globe`, `hillFar`, `hillNear`, `skyTop`, `skyHorizon`, `ground`, `pine`, `haze`, `snow`, `snowShade`, `grassDark`. Comparing the whole palette is simpler and conservative. Neither object identity nor integer RGB is sufficient.
- **Weather transitions, snow cover and moon tone** enter through that effective palette. Lightning flash/glow do **not** directly enter `drawLand` or relief; they are compositor effects. Weather’s storm tint and eclipse tint do enter the palette. Moon **phase** changes the globe/backdrop, not these land calculations. [mount.ts:173](../../components/garden/mount.ts:173), [weather.ts:368](../../components/garden/engine/weather.ts:368).
- **Scene width, height, horizon and geometry generation**: ridges, snowline, summits, faces, forest, scrub, spruce, river/banks/islet/stones/trees and their bounds. Resize and regrow rebuild these. The user’s plant seed is not a direct land input: land and river use `LAND_SEED`. A generation increment on rebuild is safer than treating seed as the key. Zoom matters through scene dimensions/grid. [garden.ts:353](../../components/garden/engine/garden.ts:353), [garden.ts:694](../../components/garden/engine/garden.ts:694).
- **Relief additionally needs `cols, rows, cw, ch`**, and must cache all three outputs: field, light colour and strength. River-field caching also needs cell dimensions, not merely cell count and river version. [garden.ts:1821](../../components/garden/engine/garden.ts:1821), [garden.ts:999](../../components/garden/engine/garden.ts:999).
- **Recording side effects:** append at the current command offset, reconstruct `still`, and union cached **scene-space** meta bounds with the current globe/plants’ bounds. Preserve raster opacity, or explicitly enforce its current land-entry invariant of 1. Do not reuse the previous frame’s final meta box. Probe must continue exposing the current relief field. [raster.ts:326](../../components/garden/engine/raster.ts:326), [raster.ts:453](../../components/garden/engine/raster.ts:453), [mount.ts:1021](../../components/garden/mount.ts:1021).

Use separate keys for land commands, relief and river field; they have different dependencies.

**A3 — Safe with explicit ownership and per-worker versions.** `relief` is mutated in place, palettes are recreated, and sprites are cleared/rebuilt each recording. Identity checks therefore fail in both directions. Sprite equality includes order, position, pose, look colours, kind, span, facing, size, fade and `under`; send removal-to-empty too. Include relief colour/strength, hill, horizon and grid metadata. Bootstrap every worker and the local fallback independently; retain each job’s palette/hour snapshot when replies arrive out of order. [raster.ts:229](../../components/garden/engine/raster.ts:229), [raster.ts:460](../../components/garden/engine/raster.ts:460). The approximately 454 KB relief-plus-river claim is correct at this grid.

**A4 — Safe if arithmetic and ordering stay exact.** Use reusable double-precision scratch, and compute table entries with the original expressions. Preserve `s*s`, power evaluation, point accumulation, the final `px/py/a` used by seed heads, bucket insertion order and blade/plant interleaving. A `Float32Array` point/power table or reassociated multiplication can change commands. [meadow.ts:184](../../components/garden/engine/meadow.ts:184).

**A5 — Safe for lattice-hash reuse.** Key hashes by integer lattice coordinates and octave seed, including the second sample at `ny + .25`; preserve interpolation and octave accumulation order and the final Float32 stores. Do not cache interpolated noise merely by lattice cell: fractional coordinates drift. Bound the cache. Comparing aggregate “sums” is insufficient. [math.ts:47](../../components/garden/engine/math.ts:47), [ascii.ts:444](../../components/garden/engine/ascii.ts:444).

**A6 — Partly underspecified.** Cache wind’s time-only factors, then apply current strength. Strength can change between steps; `base()` is also called from weather painting. Initialise the cache for time zero. Petal ruffle noise depends on **actual signed width `w`**, not just seed/petal/sample index; tip samples also depend on notch and tip width. Cache only invariant noise terms, or use complete bounded keys. [wind.ts:48](../../components/garden/engine/wind.ts:48), [bloom.ts:109](../../components/garden/engine/bloom.ts:109), [bloom.ts:155](../../components/garden/engine/bloom.ts:155).

**A7 — RGB canonicalisation is exact; the claimed refill reduction is weak.** Replay really uses `r|0`, including gradient-stop RGB. Therefore `Math.fround(v)|0` preserves the existing Float32-storage-then-truncation sequence. Preserve **alpha, gradient offsets/endpoints, geometry and meta** unchanged. Mist alpha is fractional; integer endpoint colours do not make interpolated gradient pixels integer or hour-independent. [rasterize.ts:116](../../components/garden/engine/rasterize.ts:116), [rasterize.ts:300](../../components/garden/engine/rasterize.ts:300), [garden.ts:2303](../../components/garden/engine/garden.ts:2303).

The still cache compares **every command number**, so moving geometry or changing mist alpha defeats reuse. Ordinary clock time changes by minutes, not twice per second; scrubbing changes geometry continuously. [rasterize.ts:193](../../components/garden/engine/rasterize.ts:193), [mount.ts:129](../../components/garden/mount.ts:129).

**A8 — Safe.** Direct indexing must preserve command offsets. Precompute glyph codes **after the existing registration order**, identically in workers and main thread: `code()` mutates the shared glyph registry. [rasterize.ts:264](../../components/garden/engine/rasterize.ts:264), [typeset.ts:28](../../components/garden/engine/typeset.ts:28).

**C2 — Yes, raw sampling is a pure per-cell function, with qualifications.**

- It reads four colour pixels, four kind pixels, and **up to four** meta pixels. Meta is compactly indexed inside `box`, and used only for Petal/Land/Fluff. Outside-box coordinates must be excluded before indexing; a naïve full-image meta index can alias another pixel. Include `md === null`, dimensions/stride and cell coordinates in cache validity. [rasterize.ts:417](../../components/garden/engine/rasterize.ts:417).
- There are no neighbour, palette, hour, head or sprite inputs to this stage. Scratch state is reset before relevant reads. Preserve fresh-output defaults: empty cells set only `lit=.5`, and RGB can remain unwritten when the norm is zero.
- Compare **actual returned RGBA bytes**, including alpha. Un-premultiplication is lossy, but its reproducibility is not required for correctness: differing readbacks cause misses; identical bytes supply identical sampler inputs. Do not reconstruct or compare premultiplied colours instead.
- Save raw `kinds` before typesetting. `stampHeads` clears sampled Petal/Disc kinds; the other five sampled arrays are not mutated by Typesetter. Typesetting still runs completely because it depends on neighbours, style, heads and sprites. Probe currently returns **post-stamp** kinds; retain that behaviour. [typeset.ts:414](../../components/garden/engine/typeset.ts:414), [typeset.ts:1087](../../components/garden/engine/typeset.ts:1087), [rasterize.ts:236](../../components/garden/engine/rasterize.ts:236).
- Invalidate on resize/grid remapping, including equal-area reshapes. Each worker compares against its **own** previous job, potentially several plant frames older. Changing the global meta box invalidates everything under this proposal.
- Memory is material, not prohibitive: at 90,816 cells, three full readbacks occupy **4.36 MB**, and raw cells **2.09 MB**: up to **6.45 MB cache state per worker**, approximately 25.8 MB across four workers, before current-frame buffers and existing scratch. Meta cropping reduces this. Retain readbacks without copying them, keep one history only, and discard old sizes. New `getImageData` allocations remain; retaining them longer can increase GC pressure.
- “4.9% of output cells changed” does not establish a 95.1% raw-pixel hit rate. Sampling/quantisation can hide pixel changes.

**C1 — The dirty predicate is incomplete.** It must cover:

- All six material arrays/version; grid, cell dimensions, horizon and DPR.
- `dim`/`dimPlant`, including **removed** dim boxes and scroll/font-layout changes.
- Palette values used for row backgrounds, cloud RGB, ink, night/star eligibility, pointer glow, snow and grass.
- Star **candidates**, including currently subthreshold/invisible stars that can twinkle into visibility.
- Exact cloud refresh state: `cloudTick`, `cloudAt`, row modulo, time and current MAT occupancy. Preserve `skyEdge` and cloud caches, which weather subsequently reads.
- Pointer old/new position **and active transitions**, including leave, blur, touch release and entering the terminal. Radius is 120 **scene** pixels.
- Backdrop key/palette/horizon, page colour, veil value/key and transitions into/out of full clear.
- Meteor glyph/alpha/RGB and glint; bird glyph/alpha/tile/colour; weather precipitation/wet/tile data, persistent snow cover, gale bands, flash colour/intensity, storm glow and eclipse disc/skyline.
- **Previous as well as current effects**: the first frame after a bird, meteor, flash or weather effect ends must erase its old pixels.
- Atlas growth/font reset, canvas resize and WebGL context restoration. These can require GPU redraw/reupload even when CPU texture bytes match.

These dependencies are directly in [ascii.ts:204](../../components/garden/engine/ascii.ts:204), [ascii.ts:299](../../components/garden/engine/ascii.ts:299), [ascii.ts:511](../../components/garden/engine/ascii.ts:511) and [gl.ts:134](../../components/garden/engine/gl.ts:134).

Cloud rows are interleaved, not one contiguous band. Taking their minimum/maximum row uploads almost the entire sky. At night, star rows also cover much of it. Separate “compose dirty rows”, “upload changed bytes” and “draw framebuffer”; they are not interchangeable.

**C3 — Safe only with a buffer ownership protocol.** Never transfer the currently displayed material back with the next job: `ascii.render` still reads it while that job runs. Recycle only superseded/dropped results; handle out-of-order replies, resize and fallback.

Restore fresh-zero semantics for all Cells/Material outputs on skipped branches. Do **not** indiscriminately clear existing Typesetter scratch: it already retains some inactive colour bytes, and the proposed all-byte gate includes them. For example, head stamps set zero tile alpha without rewriting `stampTileCol`, which is subsequently copied. [typeset.ts:421](../../components/garden/engine/typeset.ts:421), [typeset.ts:473](../../components/garden/engine/typeset.ts:473), [typeset.ts:1149](../../components/garden/engine/typeset.ts:1149).

**C4 — Not behaviour-preserving as written.**

- `submit(false)` still rasterises locally until `ready`; changing only `draw(true)` does nothing. [raster.ts:487](../../components/garden/engine/raster.ts:487).
- The extra bootstrap reply counts toward `WARM_REPLIES=3`, advancing growth and `playIntro`. Merely changing the count does not preserve elapsed timing or worker assignment.
- Growth pauses while cold, but weather/time-driven overlays do not all pause. The first visible scene can differ.
- The first resize is not universally unseen: reduced motion, returning navigation and non-home scenes bypass the fresh-home hiding.
- The “5 s fallback” is conditional on **all workers being busy**; one unanswered bootstrap job with other workers idle does not activate it. The separate intro fallback reveals content after **3 s**.

Evidence: [raster.ts:272](../../components/garden/engine/raster.ts:272), [mount.ts:686](../../components/garden/mount.ts:686), [intro.ts:11](../../components/garden/intro.ts:11). Treat this as a separate startup-behaviour change.

**C5 — Scene-safe only with a genuinely eager shell.** Preserve power-button CSS/font variables, day/night subscription, `data-avoid`, hidden-UI behaviour, keyboard filtering, focus, opening-time clock/boot state, close animation and persistent history/position/size. Delaying the whole component changes those. Cold opening before prefetch completes also adds visible latency; bytes deferred are not necessarily bytes eliminated. [terminal.tsx:489](../../components/terminal/terminal.tsx:489), [terminal.tsx:566](../../components/terminal/terminal.tsx:566), [terminal.tsx:1312](../../components/terminal/terminal.tsx:1312).

**2. Expected totals**

My estimates below are engineering ranges, not new measurements. The plan combines different dates, dimensions and loads; its moving worker measurement is 34 ms versus the older quiet 18.7 ms, not a simple 30% uplift.

| Measure | My expectation after corrected changes |
|---|---|
| Worker, quiet M4, stable hour | **15–17 ms/plant frame**; scrubs worse |
| Main recording, using the plan’s 3.4 ms baseline | **2.1–2.6 ms/plant frame** |
| Same recording, assuming its claimed 30% load uplift | Approximately **1.6–2.0 ms** quiet |
| All-Chrome idle, matched 30–40 plant fps | Approximately **0.9–1.3 cores** |
| Cursor moving, matched approximately 120 plant fps | Approximately **3.4–3.8 cores** |
| Page fps at 4× main-thread slowdown | **110–120**, clear-weather cursor case; 115–120 is plausible, not assured |

Do not add all item savings independently: A1 overlaps C2; A5 overlaps C1; C2 retention can offset C3’s GC benefit. At 120 plant fps there are few reused plant frames for C1. With adaptive budgets enabled, cheaper frames may increase throughput and consume the saved cores. The earlier notes already demonstrate this feedback. [2026-10-30-active-rate.md:104](../../docs/perf/2026-10-30-active-rate.md:104).

**3. Missed opportunities**

- **Exact homogeneous-cell sampling fast paths.** Uniform land is a better target than sky, which already has an alpha fast path. Preserve original arithmetic/meta voting. Potentially **1–3 ms/plant frame**, overlapping C2 but useful during cache misses.
- **Typesetter invariants:** precompute grid-dependent dither/hash values, row backgrounds and palette-wide river/grass colours. Later, reuse unchanged land typesetting with complete neighbour invalidation: snow scans eight rows upward; heads inspect a 7×5 neighbourhood. Potential **0.2–0.8 ms/frame**, not the full sampler saving. [typeset.ts:731](../../components/garden/engine/typeset.ts:731), [typeset.ts:1242](../../components/garden/engine/typeset.ts:1242).
- **Separate texture-upload dirtiness from C1.** Even a full CPU composition can compare packed rows and upload only changed ranges, including on new plant frames. This is easier to validate than dependency-based composition skipping. Current textures already use `texSubImage2D`; there is no per-frame storage-allocation win left. [gl.ts:299](../../components/garden/engine/gl.ts:299).
- **Avoid redundant full clears before the full-size still-layer `copy`**, preserving context state. Also stop cloning/resending the unchanged still command block, and cache hill/peak by geometry/grid. These are bounded wins, probably tenths of a millisecond.
- **Distinguish readback copy from deferred fills.** C2 saves neither replay nor fills nor readbacks. Shrinking readback alone cannot claim the whole 36% stage. GPU-backed canvases previously increased total CPU despite faster workers. [2026-10-30-cpu-budget.md:80](../../docs/perf/2026-10-30-cpu-budget.md:80).
- **rAF bookkeeping:** reuse unchanged effective palettes and avoid repeated colour calculations before the existing fresh-frame early return. Do not stop simulation/rAF wholesale: it advances springs, weather, glide, measurement cadence and quality votes. Lower budgets/caps save substantially more CPU but violate the requested rate contract. [mount.ts:327](../../components/garden/mount.ts:327).

**4. Ordering and gate**

Step 0 is necessary but insufficient:

1. Replay deterministic **sequences**, with fixed clocks, randomness, input events, worker assignment/reply order and quality decisions. Two independent live runs are not equivalent inputs.
2. Use independent old/new rasterisers, Typesetters and compositors with identical histories. Shared mutable cells or caches invalidate the oracle.
3. Compare raw readbacks, **pre-stamp cells**, post-stamp probe cells, all Material arrays and complete Style/job metadata. Compare actual backing bytes, not float sums.
4. A7 intentionally changes command bytes. Give it a semantic-command comparison plus exact raster-output comparison; otherwise Step 0 rejects the intended change.
5. Add final framebuffer comparison, backdrop, atlas and veil verification. Matching `inkData/tileData` cannot catch wrong upload offsets, missing uploads or context restoration.
6. Exercise cache hits, invalidations and **disappearance transitions**: dusk/dawn, midnight, moon tone/phase, weather fade/settling, flash end, sprite/head thresholds, dim-box removal, pointer leave, resize including equal cell counts, DPR/zoom, regrow, font arrival, reduced motion, navigation and worker failure.
7. Measure memory/GC and p95/p99 frame times after warm-up, separately from correctness instrumentation. One reduced-motion screenshot and 1,000 unspecified frames do not prove animated equivalence.

Order: gate → A1/A4/A5/A8 → corrected A2 → A3 → corrected A6/A7 → C2 → C3 → upload-only optimisation → C1. Keep C4 outside this exactness effort; C5 is independent. The claim that C1 is the only stale-output risk is false.

| Item | My gain estimate | Plan estimate | Verdict |
|---|---:|---|---|
| A1 | **0.1–0.3 ms/worker plant frame** | Likely high: most occupied cells are land and still clear | **KEEP** |
| A2 | **0.5–0.8 ms/main plant frame** on hits | About right; little during scrubs | **FIX** — complete keys and recording side effects |
| A3 | **0.15–0.35 ms/main plant frame**, ~454 KB avoided on hits | Bytes right; time optimistic | **FIX** — per-worker versions and immutable job snapshots |
| A4 | **0.1–0.25 ms/main plant frame** | About right | **KEEP** |
| A5 | **0.2–0.5 ms/cloud-refresh frame**, ~4–10 ms/s | Somewhat high | **KEEP** |
| A6 | **0.02–0.06 ms/simulation step**, plus small draw saving | Wrong unit; depends on steps/plant frame | **FIX** — time-only wind factors and complete petal-noise inputs |
| A7 | Usually **0–0.01 ms amortised/plant frame** on a stable clock; up to one refill per actual hit | Frequency/gain overstated | **KEEP** — RGB only; revise benefit claim |
| A8 | **0.1–0.25 ms/worker plant frame** | Slightly high | **KEEP** |
| C1 | **0.3–0.8 ms/eligible reused drawn frame** unthrottled; roughly 1.2–3.2 ms at 4× | Optimistic, especially at night | **FIX** — full dependency/transition tracking and GPU invalidation |
| C2 | **1.5–3 ms/worker plant frame** net on stable scenes | Plausible upper bound, not established | **FIX** — compact-meta indexing, raw snapshot ownership, resize and memory accounting |
| C3 | **0.1–0.4 ms/worker plant frame**; ~3.09 MB allocation avoided | Bytes right; time somewhat high | **FIX** — recycle superseded buffers and preserve zero/history semantics |
| C4 | Potential **100–200 ms once**, no steady-state gain | “Most of 256 ms” unproven | **DROP** under the strict behaviour contract |
| C5 | Approximately **8–16 KB gzip deferred**; no steady-state gain | Plausible, unverified | **FIX** — preserve eager shell/state and test cold opening |