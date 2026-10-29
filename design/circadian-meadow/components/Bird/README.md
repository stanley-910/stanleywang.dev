# Bird

> Proposed 2026-10-30, from Stanley's idea of the same day. Built in `components/garden/engine/birds.ts`, wired in `mount.ts` and `ascii.ts`. First pass seen by Stanley the same day; he asked for clicks to send birds, a finer look, and for birds to pass in front of the sun. All three are in.

The day's counterpart to the night's shooting stars. Now and then by day a small bird crosses the sky: it comes in from one side, flies across at about one height with a few wingbeats and a glide, and leaves by the other side. A click on the open sky by day sends one through the clicked point. A renderer rule, not a site component. It shows wherever the garden runs (home `/`, the poem `/writing/poem`).

## Problem

After dark the sky does something: stars twinkle, and a click makes a shooting star. By day the sky only drifts. Clouds move a pixel or two a second, and nothing in it is alive, so the upper half of the screen reads as a backdrop. The meadow has butterflies; the sky has nothing at its scale. One small moving thing up there makes the day sky feel inhabited without competing with the flowers.

## Related

| Component | Shared | Missing |
|---|---|---|
| ShootingStar | a sky overlay drawn on the main thread in the sky pass, never rasterised; an overlay array per cell; a click on open sky makes one; cleared in `stop()` | a star is a light glyph gone in under a second; a bird is a dark silhouette that takes several seconds and also comes on its own |
| MeadowVisitors (butterflies) | a small living figure in glyphs with a wingbeat | butterflies wander the meadow and are tapped; a bird holds a straight course in open sky and isn't a target |
| Clouds | drift across the sky | clouds are halftone, lit and slow; the bird is a crisp dark mark |

## Design

Units as in ShootingStar: lengths in scene px (scene px = CSS px / 0.64 on home), cells 5×7 scene px, `W` and `H` the scene's size, horizon at `0.55 H`. Times are real seconds, not scene time, so a bird never speeds up while the hour is scrubbed.

### When one comes

- **On its own:** the first bird of a visit comes 6 to 16 s after the scene starts by day, then one every 25 to 60 s. Rare enough to be a find, often enough that someone who stays a minute sees one.
- **On a click:** by day, a click on open sky (`y < hillTop(x) − 7`, as for stars) sends a bird instead of sowing a flower, mirroring the night. It fades in over 0.4 s a tenth of the width behind the clicked point, so it passes through the click within about a second, then flies on and off the wider side of the screen. Clicks on the ridges and the meadow still sow at every hour.
- A click never falls through to sowing, even when the limits below drop it.

On a phone a tap is a click, so a tap on the sky sends one.

Tried and dropped: a cursor resting on the sky for 1.2 s calling a bird. Stanley expected the click, as at night, and a bird that turns up because you held still reads as chance, not as an answer.

### Hours

By day is `night < 0.3`: from about 06:45 to about 19:00, so golden hour and sunset get birds too, when a dark silhouette against a bright warm sky looks best. Twilight, `night` 0.3 to 0.5, has neither birds nor stars; a sky click there sows. A bird already flying when the hour is scrubbed past dusk finishes its crossing; none new comes.

### Path and height

- **Straight across,** left or right at random on its own; a clicked one heads for the wider side. One that flies in starts a wingspan off the edge, and every bird is dropped once a wingspan past the far edge, so it leaves rather than vanishing.
- **Height:** a band from `0.14 H` (under the header) down to the lower of `0.3 H` and three rows above the highest ridge on screen (the least `hillTop`). Uniform in the band, or the click's height clamped into it. So it always flies over open sky, never in front of the range.
- **About level:** the height drifts by at most ±0.6 of a row over the crossing (one slow sine). On screen it holds its row, with the odd step.
- **The sun:** a bird that crosses the sun's disc is drawn in front of it, as in life. (The sun is typeset as `Fluff`, which carries the plant flag, so the overlay can't skip plant cells; the band keeps it clear of real plants.) It's drawn over clouds too: birds fly under cloud.

### Speed

`v = clamp(W / 8, 110, 280)` scene px/s, ±12% per bird. A 1440 px wide desktop (2250 scene px) crosses in about 8 s; a 1000 px window in about 7 s; a 375 px phone (586 scene px) in about 5.5 s. Steady: it doesn't ease in or out.

### Silhouette and wingbeat

A distant bird, as people draw one: a body cell and a wing either side, traced at the wings' current angle.

- **Wingspan** `S = clamp(0.012 W, 16, 28)` scene px: 5 cells across on a desktop, 3 on a phone.
- **Body:** one cell, `v` with the wings up or level, `^` with them down.
- **Wings:** each a straight line from the body to its tip at angle `θ` above horizontal (negative is down), a glyph per column by ShootingStar's rule: steep cells (over 0.6 rows per column) print `/` or `\`, shallow ones `` ` `` / `'` high in the cell, `-` mid, `.` low. With the wings up the tips step a row above the body; down, a row below.
- **Wingbeat:** it flaps, then glides, as a crow or a gull does at a distance: 2 to 4 whole beats at 3 a second, `θ = 0.15 + 0.65 sin(2π · 3 t)` rad, then a glide of 0.6 to 1.2 s with the wings held at `θ = 0.45`, a V whose tips sit a row up. Each bird starts at a random point in its cycle.
- **Sometimes a pair:** one bird in four brings a second, 2.5 wingspans behind and a row lower, a third of a beat out of step.

### Colour and weight

A silhouette, not a light: `mix(pine, ground, 0.7)` at full strength, mixed toward the sky behind it as the sky's other glyphs are. It isn't boosted by `ink` (that's for light glyphs) and the cursor's light doesn't lift it. The glyphs carry the shape. Only the body shades its tile, at 0.1: a first pass shaded every cell (body 0.7, wings 0.55) and the bird printed as a row of solid blocks, coarser than anything else in the sky. It sits under the text fade (`dim`) like the rest of the sky.

### How many

On its own: at most 2 alive (one pair), and only when none is flying. Clicks: up to 3 alive, at least 0.5 s apart.

### Reduced motion

No birds. On its own a bird is ambient decoration nobody asked for, and a still one would read as a stuck glyph. A sky click by day sows a flower, as before.

### Where it lives

- `components/garden/engine/birds.ts` (new): the schedule, clicked birds, each bird's course and wingbeat, and the per-frame overlay (`alpha`, `glyph`, `tile`, one `col`), as `meteors.ts` keeps its own.
- `components/garden/engine/ascii.ts`: `FrameInput` gains `birds`. A bird cell overrides whatever is in the sky rows: open sky, cloud, star, halftone dot or the sun's glyphs.
- `components/garden/mount.ts`: keeps the highest ridge from the hill array it already fills, calls the birds each frame by day, routes a day sky click to them, and clears them in `stop()`.

Not in the raster or workers; nothing in `garden.ts` or `typeset.ts` changes.

### Constants

| Name | Value |
|---|---|
| By day | `night < 0.3` |
| First bird | 6 to 16 s after the scene starts |
| Gap | 25 to 60 s |
| Click | open sky by day; fades in over 0.4 s, `0.1 W` behind the click |
| Band | `0.14 H` to `min(0.3 H, highest ridge − 3 rows)` |
| Speed | `clamp(W / 8, 110, 280)` px/s, ±12% |
| Wingspan | `clamp(0.012 W, 16, 28)` px |
| Wingbeat | 3 Hz, `θ = 0.15 + 0.65 sin`, 2 to 4 beats; glide 0.6 to 1.2 s at 0.45 |
| Drift | ±0.6 row over the crossing |
| Pair | 1 in 4, 2.5 spans behind, a row lower |
| Colour | `mix(pine, ground, 0.7)`, strength 1, body tile 0.1 |
| Limits | 2 alive on its own; 3 from clicks, 0.5 s apart |
| Reduced motion | none; a day sky click sows |

## Tokens

None new. The colour is a mix of existing palette fields (`*-pine`, `*-ground`), as ShootingStar's is.

## Accessibility

Decoration. The canvas stays `aria-hidden` and gets no focus stop; there's no keyboard way to send a bird, as there's none to sow or make a star. The bird is small, slow and dark; it never flashes, and it flies only in the sky band, never over the bio or controls. Under `prefers-reduced-motion` none fly.

## Verify

- **Midday (12:00), 1000×620:** within about 16 s a bird crosses at one height, flapping and gliding, and leaves the screen. It never crosses the ridges, and it passes in front of the sun.
- **Click:** a click on the day sky sends a bird through the clicked point within a second; a click on a ridge or the meadow sows. Spam: never more than three.
- **Phone, 375 wide:** the same, three cells across, about 5.5 s to cross; a tap on the sky sends one.
- **Golden hour and dusk:** birds still come and read as black on the warm sky. Twilight: a sky click sows. Night: stars, no birds.
- **Reduced motion:** none, ever; a day sky click sows.
- **Hidden tab or scrolled away:** none hangs half drawn when it comes back.

## Open questions

- **Should it shy from the cursor?** A bird that climbs a row when the cursor comes within a couple of wingspans would be a small delight, but it invites chasing and turns decoration into a game.
- **Flocks:** a loose V of five at golden hour, rarely? Charming, but a second thing to tune; held back until the single bird is right.
- **Twilight gap:** between `night` 0.3 and 0.5 a sky click still sows. Fine as a hand-over between day and night, or should one of the two reach across it?
