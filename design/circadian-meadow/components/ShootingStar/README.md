# ShootingStar

A shooting star across the night sky, made by clicking the sky. A short, bright streak that cuts through and cuts out, printed in the garden's glyphs. Now and then one is a fireball, bright enough to glint on the ridges below it. A renderer rule, not a site component. It shows on home (`/`) and the poem (`/writing/poem`). Preview: `preview.html`, working streaks on the twilight and night skies (click, or wait for one), the glyph runs at three angles, and the reduced-motion still.

Stanley's ask, in his words:

> when you click the sky box, shooting stars will come through and it'll look like just a trail of glory, like very short, just passes through, cuts through the sky almost, and then cuts out. And it will even like maybe shine down on mountains a little bit if it's close. That would be kind of cool. Actually, I don't know if realistically they would shine down on mountains.

Approved: stars at night only, as recommended below. Built in `engine/meteors.ts`, with two changes found in the browser: each streak cell also lights its tile (`GLOW` 0.3 in `ascii.ts`), since the glyphs alone read as a faint scratch at the scene's 5 px cells, and the tails decay slower (`τ` 0.1 s, fireball 0.14 s).

## Units

As in Ridgeline: lengths are in scene px, the engine's own units (scene px = CSS px / 0.64, on home and the poem alike; everything here scales with `W` and `H`, so it holds at any zoom). `W` and `H` are the scene's width and height, the horizon is at `0.55 H`, and cells are 5×7 scene px. A 1440×762 window is 2250×1190 scene px; a 375×812 phone is 586×1269. `night`, `ink` and the colour fields are the current `Palette`'s. Times are real seconds (the frame's `now`), not scene time, so a streak never speeds up with the hour.

## Would it light the mountains?

Mostly no, sometimes yes. An ordinary shooting star is a grain of dust burning up 80 to 100 km up, about as bright as the brightest stars, and it lights nothing you could see. A fireball, a meteor brighter than Venus, does: the big ones light the ground and throw moving shadows for a second, and people who see one often remember the landscape flashing. They're rare, a few an hour at best for a patient watcher on a dark night.

**Recommended:** ordinary streaks leave the land alone. One click in six makes a fireball: a longer, brighter streak with a small flare at its end, and while it burns, the ridge glyphs nearest it brighten briefly toward its colour. Glyphs only, ridges only, gone within a third of a second after the streak cuts out. Subtle enough that you notice it on the second or third fireball, not the first.

## When a sky click makes a star

Today a click anywhere above the meadow sows a flower at the horizon below it (`Garden.sow`), at any hour, and after dark a few fireflies gather there.

**Recommended:** after dark, a click on the open sky makes a shooting star instead of a flower. Clicks on the ridges and the meadow still sow, at every hour, so sowing is never out of reach. By day a sky click sows as now. (Since 2026-10-30, a day sky click sends a bird instead: see Bird. Twilight, `night` 0.3 to 0.5, still sows.)

- **Open sky** is above the painted land: `y < garden.hillTop(x) - 7` (one row of slack above the crest, so a click on a peak sows rather than launching a star from the rock). Clicks below that line are the ridges' and sow as now.
- **After dark** is `night ≥ 0.5`: from about 19:45, in deep twilight once the stars are well out, to about 05:50, before dawn. Stars show from `night > 0.1`, but they're faint until about 0.5, and a meteor in a bright sunset sky reads as a scratch on the screen.
- **Why not both:** a flower springing up at the horizon under a streak splits the eye between two things at once, and the star is the point of the click. Why not by day: a meteor in a daylit sky is invisible in life, and a white streak on the day sky's pale blue-grey would barely show (under 2:1 against `day-sky-horizon`).

**Alternative:** make stars at any hour, faint by day (`0.35` strength) and full at night, and stop sowing from the sky at all. It's more discoverable, but it takes away a day interaction that works, and the day streak barely shows.

The rest of this spec assumes the recommendation.

### Click routing

In `mount.ts`'s `onClick`, the order becomes: visitors (bugs), then a flower head, then **a star if the click is on open sky after dark**, then sow. The interactive-element check and the `[data-no-sow]` check come first, unchanged, so the poem's text never makes a star. A star click never falls through to sowing, even when the rate limit (below) drops it.

Where it lives, so nothing here touches `garden.ts` or `typeset.ts`:

- `components/garden/engine/meteors.ts` (new): the radiant, spawning, each streak's cell run, and the per-frame overlay.
- `components/garden/engine/ascii.ts`: `FrameInput` gains `meteors`, the overlay. The sky branch reads it before stars and clouds, and the existing pointer-light block takes the fireball glint.
- `components/garden/mount.ts`: the routing above, keeping the last frame's palette for `night`, and clearing live streaks in `stop()`.

`garden.hillTop(x)` and `garden.horizon` are already public.

Streaks never go through the raster or the workers. They're drawn on the main thread in the sky pass that already prints the stars, so typesetting is untouched.

## Path

All the streaks in one visit fall away from a single **radiant**, as a real meteor shower's do, so a run of clicks reads as one shower and not as scratches in every direction.

```
radiant  = (W · (0.2 + 0.6 · rnd), -0.45 H)        // above the top of the scene, fixed per page load
dir      = normalise(click - radiant)
angle    = the angle of dir below horizontal, clamped to 18°..50°, keeping its left or right sense
L        = clamp(0.17 · W, 170, 380)                // ordinary; a fireball is 1.35 L
start    = click - 0.4 · L · dir
end      = click + 0.6 · L · dir
```

- **The click is on the path**, 40% along it, so the head passes under the pointer just after it appears: you click a spot and the star cuts through it.
- **Angle:** shallow to medium, always falling. A click straight under the radiant would give a vertical streak, which prints as a column of `|` and reads as rain, so the angle is clamped to at least 18° from vertical (50° below horizontal at most). Under 18° below horizontal it reads as a flat dash.
- **Length:** 380 px on a desktop (about 14% of the width across, 50 to 70 cells long), 170 px on a phone (about 30% of its width, 25 to 30 cells). Short, as asked: you see the whole streak at once and it never crosses the sky.
- **Where the path leaves the sky,** it simply stops printing: streak cells are drawn only in open sky cells, so a streak that runs down into the ridges cuts out behind them. That's the most satisfying ending, and it falls out of the rule; don't clip the path to the crest. A path that starts above the top of the scene enters from off screen.
- Behind the moon, too, a streak goes unprinted, because the moon's cells are land-like glyph cells, not open sky. In life a meteor passes in front of the moon. It's a few cells, rarely hit; not worth a flag.

## Timing

| | Ordinary | Fireball |
| --- | --- | --- |
| Run (head start to cut) | `T` = 0.28 to 0.40 s | 0.50 to 0.60 s |
| Head speed, desktop | about 950 to 1350 px/s | about 850 to 1000 px/s |
| Tail decay `τ` | 0.07 s | 0.12 s |
| End | cut: the head is gone the next frame | flare for 80 ms, then cut |
| Last tail glyph gone | about 0.2 s after the cut | about 0.35 s after the cut |
| Whole life | at most 0.6 s | at most 1.0 s |

Duration is chosen per streak at random within its range and doesn't depend on the screen, so a phone's shorter streak moves slower in px but takes the same time. The head goes at a constant speed; it doesn't ease.

## Glyphs

The streak is a run of cells along the line from `start` to `end`, built once when it spawns. Step along the line half a cell at a time on the dominant axis and keep each new cell, so the run has no gaps or doubles. For each cell store its index, `u` (how far along the path the head is when it reaches the cell, 0 to 1), and its glyph.

**Head:** the cell holding the head point prints `*`. Stars print `+` and `.`, so the head never reads as a star.

**Tail glyph per cell**, from where the line crosses the cell's centre column (`f`, 0 at the cell's top to 1 at its bottom) and which way it falls:

| `f` | Falling right | Falling left |
| --- | --- | --- |
| under 0.33 | `` ` `` | `'` |
| 0.33 to 0.66 | `-`, or `\` where steep | `-`, or `/` where steep |
| over 0.66 | `.` | `.` |

Steep is a cell slope over 0.6 (rows per column; a 50° path is 0.85 in cells, an 18° path 0.23). So a shallow streak falling right prints as a smooth staircase, `` `-.`-.`-. ``, and a steeper one as `` `\.`\. ``. Use `-` (not `_`) for the middle: `_` sits under the baseline and reads as a gap. All of these are printable ASCII and registered up front with `code()` alongside `PERIOD` and `PLUS`.

**Strength per cell**, where `t` is now and `tᵢ = start time + u · T` is when the head reached the cell:

```
A(u)  = smoothstep(0, 0.15, u) · (0.75 + 0.25 · u)       // it flares into being, brightens as it falls
B     = 0.65 + 0.35 · smoothstep(0.5, 0.9, night)         // fainter in deep twilight, full at night
head  : a = A(u_now) · B
tail  : a = A(uᵢ) · B · exp(-(t - tᵢ) / τ),   drawn while a ≥ 0.06
```

Cells ahead of the head don't print. The tail's visible length comes out of the decay: about `2.8 τ` of travel behind the head, so 240 to 340 px on a desktop, most of the streak at the moment it cuts. Then the head is gone and the tail fades back along its length from the far end, which is the "trail of glory" Stanley describes.

**The fireball's flare:** for its last 80 ms the head's four neighbours (left, right, above, below) print `·` at `0.5 a`, a small cross of light, then the head and the cross cut together.

## Colour

From palette fields only, so it follows the sky through the night:

```
head  = mix(fluff, globe, 0.4)
tail  = mix(head, cloud, 1 - exp(-(t - tᵢ) / τ))     // cools toward the sky's cloud colour as it fades
ink   = colour · ink, capped at 255                  // as the stars are
```

The sky branch mixes ink toward the row's background by `a`, as it does for stars, so a fading tail sinks into the sky rather than greying.

| Hour | `night` | Head | Tail, half faded | Reads as |
| --- | --- | --- | --- | --- |
| 19:45 | 0.52 | `#fbd2c3` | `#e9abac` | A pale rose streak over the last of the sunset, the faintest of the night (`B` 0.66) |
| 20:15 twilight | 0.60 | `#fad2cc` | `#e0a6b8` | Rose-white head, mauve tail against violet |
| 21:00 | 0.90 | `#e7e2f0` | `#aea8c1` | Near white, lilac tail |
| 22:30 night | 1 | `#e1e6fc` | `#9ea9c4` | Cold blue-white, as the stars; the classic one |
| 00:00 midnight | 1 | `#d2d9e7` | `#767c8c` | Grey-white on near black. The brightest thing in the sky, with the moon at 0.45 |
| 05:45 | 0.56 | `#ece8e5` | `#d4d0d3` | Warm white against the paling sky; the last of the night |

`tokens.json` gains no tokens: every colour is a mix of palette fields, as the stars' and ridges' are.

### Clouds and stars

A streak cell wins over a star (it replaces the `+` or `.`). Over a cloud glyph it still prints, at `a · (1 - 0.6 · shape)` with `shape` the cloud's own value at that cell, so a streak dims as it passes behind cloud. In life clouds hide meteors outright, but a click on a cloud that makes nothing reads as broken.

## Light on the land (fireballs)

While a fireball burns, ridge glyphs near its head lift toward its head colour, through the same block in `ascii.ts` that brightens glyphs near the pointer:

```
cells   : glyph cells above the horizon (y < horizon) that are MAT and not PLANT, i.e. the ridges
d       = distance from the cell's centre to the head
R       = 0.3 H
g       = G · (1 - d / R)²      for d < R
G       = 0.3 · A(u_now) · B while the head burns, 0.45 during the flare,
          then falling to 0 over 0.15 s after the cut
ink    += (head - ink) · g
```

- **Glyphs only, ridges only.** The painted backdrop is untouched (it's cached and repaints only when the glow moves), the meadow and flowers aren't lit, and the bio is well below the horizon, so text is never under it. Light lives in glyphs, as the README says.
- **Close means close:** the falloff is from the head itself, so a fireball high in the sky lights nothing; one that runs down toward the peaks lights the crests under it, most at its end. That's Stanley's "if it's close".
- **Strength:** the pointer's light after dark reaches 0.73 at its centre; this peaks at 0.45 and lasts under half a second, about a third of the pointer's at the same distance on average. If it's too quiet in the browser, the lever is `G`'s 0.3; don't go past 0.5, or a fireball reads as lightning.
- **How often:** a spawn is a fireball with chance 1 in 6, and never within 6 s of the last fireball, so a spam of clicks doesn't turn the shower into a light show.

## How many

- At most **3 streaks alive** at once. A click with three alive makes nothing, and doesn't sow.
- At least **120 ms between spawns**; a click sooner makes nothing. Together with the lives above, holding the button down and clicking fast gives a steady shower of about five a second at most, never a sheet of lines.
- Streaks don't interact. Two crossing cells take the stronger of the two.

## Reduced motion

No streak moves. A sky click after dark prints a whole streak at once, still: every cell of an ordinary path at `a = A(u) · B · (0.35 + 0.65 · u)`, so it's brightest at the head end, with the head `*` at the end. It holds for 0.8 s and then goes. No fireballs and no glint. One at a time: a new click replaces it. As for the heart, that's two frames, `draw(true)` on the click and again from a timer when it goes; the timer is cleared on the next click.

## Phone

A tap is a click: the `click` that follows a tap goes through the same routing, so tapping the night sky makes a star. A finger that drags to scrub the hour or scroll doesn't produce a click, so stars never fire mid-scrub. The sky is the whole top of a phone's screen above the ridges, so there's no hit area to enlarge. Streaks are shorter on a phone (170 px, see Path) and take the same time.

## Cost

Built once per streak: the cell run, about 50 to 90 cells. Per frame, before the row loop: for each live streak (at most 3), walk its cells whose `tᵢ ≤ t`, compute `a`, glyph and colour, and write them into a small overlay (`Float32Array` alpha, glyph code and RGB, one slot per cell), keeping the list of touched cells to clear next frame. At most a few hundred cells a frame, against the tens of thousands the sky pass already visits. The sky branch reads one array per cell. With no streak alive, the overlay is empty and the only cost is that read. The glint adds a distance check to ridge cells within `R` of a fireball's head, only while one burns. No new frames are requested: the scene already draws every frame while it's visible. When it stops (off screen, tab hidden), drop live streaks, so none hangs half-drawn when it comes back.

## States

| State | What prints |
| --- | --- |
| Burning | `*` at the head, the tail glyphs behind it fading by `τ` |
| Flaring (fireball, last 80 ms) | `*` with a cross of `·`; ridges near it lift by up to 0.45 |
| Cut | No head; the tail fades out back along the path |
| Behind the land | Nothing in land cells; the streak runs on unseen and its tail fades as usual |
| By day (`night < 0.5`) | None: the sky click sends a bird (Bird) under 0.3, sows from 0.3 |
| Reduced motion | The whole streak, still, 0.8 s |

## Constants

| Name | Value |
| --- | --- |
| After dark | `night ≥ 0.5` |
| Open sky | `y < hillTop(x) - 7` |
| Radiant | `(W (0.2 + 0.6 rnd), -0.45 H)`, per page load |
| Angle | 18° to 50° below horizontal |
| Length | `clamp(0.17 W, 170, 380)`; fireball × 1.35 |
| Click on path | 40% along |
| Run | 0.28 to 0.40 s; fireball 0.50 to 0.60 s |
| Tail decay `τ` | 0.07 s; fireball 0.12 s |
| Draw threshold | `a ≥ 0.06` |
| Steep | cell slope over 0.6 |
| Strength | `A(u) = smoothstep(0, 0.15, u) (0.75 + 0.25 u)`, `B = 0.65 + 0.35 smoothstep(0.5, 0.9, night)` |
| Colour | head `mix(fluff, globe, 0.4)`, toward `cloud` as it fades |
| Over cloud | `a (1 - 0.6 shape)` |
| Fireball | 1 in 6, at least 6 s apart; flare 80 ms |
| Glint | `R = 0.3 H`, `G` 0.3, 0.45 at the flare, out over 0.15 s |
| Limits | 3 alive, 120 ms between spawns |
| Reduced motion | still streak, 0.8 s |

## Accessibility

Decoration. The canvas stays `aria-hidden` and gets no focus stop; there's no keyboard way to make a star, as there's none to sow. The streak is brief and small: under a second, one at a time per click, never more than three, and no full-screen flash, so it's well clear of the three-flashes-a-second limit. The fireball's glint brightens a few dozen cells, not the screen. Clicks on the poem's text never reach it.

## Verify

- **Night (22:30):** a click on the open sky makes a streak that passes through the clicked point, falls away from the same side on every click, cuts out cleanly and leaves a fading tail. A click on a ridge or the meadow still sows. Hold-and-spam: never more than three streaks, never a sown flower.
- **Twilight (19:45 to 20:15) and before dawn (05:45):** streaks are fainter and warmer; at 19:30 (`night` 0.42) a sky click sows.
- **Midnight:** grey-white streak, clearly the brightest thing in the sky.
- **Fireballs:** click until one comes (longer, slower, a cross at the end); one that ends near the far ridge lifts the crest glyphs under it, and the paint doesn't change. One high in the sky lights nothing.
- **Behind the land:** a click low in the sky above a peak gives a streak that disappears behind the ridge.
- **Clouds:** a streak dims as it passes behind a cloud and doesn't vanish.
- **Desktop and 375 px wide:** about 14% of the width on desktop, about 30% on a phone; a tap makes one; a scrub doesn't.
- **The poem:** same behaviour, on home's grid; clicking the poem's text never makes a star.
- **Reduced motion:** a still streak for 0.8 s, then nothing; no glint.
- **Day:** a sky click sends a bird (Bird); no streak.
- **Cost:** a performance trace while spamming shows no new long tasks and no worker traffic from streaks.

## Notes

- I didn't look at the running scene for this spec. The numbers come from the engine (`ascii.ts`'s sky pass, `palette.ts`, `mount.ts`'s `onClick`) and the scene sizes measured for Ridgeline. Check length and the glint's strength in the browser before tuning anything else.
- Colours were computed from `components/garden/engine/palette.ts` with `paletteAt` at each hour.
- In the preview, at 2.5 times the engine's cell size, the streak reads as a head with a fine, fading line behind it, `\` runs on the steep path and a `` `-. `` staircase on the shallow one. The tail is thin, because these are light glyphs. If it's too thin in the browser, raise `τ` (a longer tail) before raising alpha: at full alpha it starts to look like a drawn line, not light.
- The preview draws on a plain two-stop sky with one ridge and a few stars; the engine's halftone screen and clouds aren't drawn. Judge shape, glyph runs, timing and colour there, and density in the browser. Its head colour is `night-fluff`, which `tokens.json` carries; `globe` isn't a token, and at night the two are within a few levels.
