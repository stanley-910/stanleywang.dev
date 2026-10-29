# ReadingTime: the bead and the hump (proposal)

**Status: approved and built (Oct 29), in `components/ui/hour-track.tsx`. One change from below: any set step of a quarter hour or more opens the hump, since on the 226px popover track a step is ~2px, too slow to cross the speed threshold.** Stanley approved a rise in the track in place of the thumb, then asked for it to lean into its motion, then for it to rest as a small circle that only becomes the hump while it moves, with a smaller hump. Mock: https://claude.ai/artifact/GxLsHTER5mmrTtLxCDYWZ5 (interactive: drag, scroll or press keys; the Inspect tweak "slow" runs every timing 6× slower so the morph can be studied).

Replaces the slider's thumb (the 6×18px `ink` bar in `components/ui/time-control.css`). At rest the hour is a small **bead** threaded on the band. When the hour moves, the bead opens into a **hump** in the band's top edge, which leans toward the motion. When the hour stops, the hump closes back into the bead. It is one shape throughout: the band's outline, which the bead and the hump both deform.

## Shapes

All sizes are CSS px, the same at desktop and 375px. The track box is 30px tall; the band runs y 18–22.

```
 at rest: bead             moving: hump, leaning →
        ╭─╮                          ╭─╮
 ▁▁▁▁▁▁(   )▁▁▁▁▁▁▁        ▁▁▁▁▁▁▁▁▁╱   ╲▁▁▁▁
 ▔▔▔▔▔▔(   )▔▔▔▔▔▔▔        ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
        ╰─╯
       |10|                     |<--28-->|
```

- **Band:** 4px tall, the existing horizon gradient (`TRACK` in `theme-switch.tsx`), square ends.
- **Bead:** a 10px circle (r 5) centred on the band (y 20), so it stands 3px proud of each edge. 11px (r 5.5) on hover and keyboard focus.
- **Hump:** 28px wide at the foot and 6px above the band's top edge (was 36×9). Its top sits at y 12, the bead's at y 15: about the same height, with the bead centred on the band and the hump resting on it. A raised cosine; only the top edge moves, and the bottom edge stays straight.
- **Fill:** both are the band itself, so they show the gradient's colour at that hour. No `ink` fill: the colour is the reading.
- **Rim:** 1.25px `ink`. Around the bead it's a full outline (the top and bottom arcs; between them the band carries the edge). On the hump it runs along the top edge and fades to nothing at the feet, and the bottom arc fades out as the bead opens. The rim is what meets contrast (`ink` on `page`, 12:1 or better), since the band alone is about 1.9:1 by day on the light popover and nearly invisible at night on the dark one.
- **Mapping:** hours map onto the thumb's travel: x = 14 + (hour / 24) × (width − 28). The gradient's stops use the same mapping, so the colour under the bead is that hour's colour. The 14px past each end holds midnight black.

## The morph

**Method: interpolating height fields.** The band's outline is two edges, top(x) and bottom(x), sampled across the track. Each state is a pair of edges:

- bead: top = min(18, 20 − √(r² − dx²)), bottom = max(22, 20 + √(r² − dx²)) within r of the hour, otherwise 18 and 22;
- hump: top = 18 − 6 · hump(x), bottom = 22, where hump(x) is the leaned raised cosine (below).

The drawn edges are `lerp(bead, hump, m)`, with m running from 0 (bead) to 1 (hump). Halfway, the crest is 13.5px up, the bottom arc is half drawn back into the band, and the sides have spread. There's no cross-fade or swap of elements, so it reads as one thing changing shape. The rim's ends interpolate the same way, from the bead's seams (where its outline meets the band edges, ±4.6px) to the hump's feet. Its end-fade opacity is `1 − m`, as is the bottom arc's.

**When it opens:** m heads for 1 whenever the drawn peak moves faster than 20px/s or a drag is held, and for 0 once it has been still for 180ms. The hold keeps the gaps between wheel events and pauses mid-drag from flickering it shut.

**Timings** (critically damped eases, no overshoot):

| What | Time constant | Settles in about |
| --- | --- | --- |
| Bead → hump | 50ms | 150ms |
| Hold after the last motion | 180ms | |
| Hump → bead | 80ms | 240ms |
| Position glide (keys, wheel, track click) | 45ms | 150ms |
| Lean in / out | 60ms / 90ms | 250ms after stopping |
| Bead radius (hover, focus, open) | 40ms | 120ms |

**Keyboard steps and track clicks** expand it briefly, without special-casing. A step glides the peak about 8px (a quarter hour on desktop), which is fast enough to open the hump. It holds for 180ms and closes. One arrow press is a quick swell and settle of about half a second; holding an arrow keeps it open. A Page Up/Down or a track click travels further and leans harder.

## Lean (kept from revision 2, scaled to the smaller hump)

- **Driven by** the drawn peak's speed in px/s, measured each frame and smoothed (50ms). `lean = tanh(speed / 600px/s)`, from −1 to 1; tanh caps it.
- **At full lean:** the crest moves 3px toward the motion, the leading half-width goes from 14px to 12px, and the trailing half-width grows from 14px to 22px. Height doesn't change.
- **Only the hump leans.** The lean scales the hump term, which is multiplied by m, so the bead is always round, and a hump closing as it slows straightens as it shrinks.
- **Gradient and rim** follow the leaned edge for free (one clip path, one rim path); the colour under each x stays that hour's.

## Reduced motion

Always the bead: m and lean stay 0, the position jumps instead of gliding, and the radius doesn't animate. Nothing runs between inputs.

## Build

Yes, it keeps the native range input as the invisible hit target.

- `<input type="range">` (0–24, step 0.25, `aria-label="Hour"`, `aria-valuetext="21:40, night"`) fills the 30px track box. Its track is transparent; its thumb is a transparent 28×30px box with `cursor: grab`. So the hit area is the hump's width even while the bead shows only 10px, and a grab anywhere near the bead takes the thumb rather than jumping. The browser keeps arrows, Home/End, the slider role and the value; Page Up/Down and the wheel stay as today.
- Under it, inside the box, sits one `aria-hidden` drawing:
  - a `div` the box's size with `background: var(--track)` and `clip-path: path(...)`, built in JS from the two edges, sampled every 0.25px within the shape's span and every 1px elsewhere (about 450 points at desktop);
  - an `aria-hidden` inline SVG with `pointer-events: none` and two rim paths, top and bottom, in `currentColor` (`ink`). The top rim uses a horizontal `linearGradient` whose end stops take `stop-opacity: 1 − m`.
- One `requestAnimationFrame` loop owns position, speed, m, lean and radius per slider. It runs only while any of them is changing or the hold is open, and stops at rest. A `ResizeObserver` on the box covers the 375px popover.
- The morph is JS path interpolation; CSS can't do it. A CSS `d:` or `clip-path` transition only interpolates between paths with the same commands, and the lean and the drag position change every frame anyway.
- **Focus:** `:focus-visible` on the input draws the system ring around the track (1px `focus`, offset 3px), and the bead grows to r 5.5.
- **Touch:** under `(pointer: coarse)` the input grows to 44px tall, with a negative vertical margin so the layout doesn't move.

## Tokens

None new. Uses `ink`, `page`, `focus`, `ease-calm` (the popover fade), `radius-card`, `space-1`, `space-2`. The sizes and timings above are component constants, as the thumb's 6×18 is today.

## Verify

Light and dark popover, 1440px and 375px:
- The bead is visible at 00:00, 06:45, 12:00 and 18:45.
- Tab shows the ring, and the bead grows.
- One arrow press swells and settles in about half a second.
- A steady scroll holds the hump open and leans it.
- A drag follows the pointer 1:1, and the hump closes about 400ms after release.
- VoiceOver reads "Hour, 21:40, night, slider".
- With reduced motion it's a bead that jumps.
