# Ridgeline

The mountains behind the meadow: how the sun and moon light them, the snow on the far range, and a line of conifers along the middle ridge. A renderer rule, not a site component. It lives in `components/garden/engine/garden.ts` (`buildRidges`, `backdrop`, `drawLand`, `drawSnow`, `slopes`) and the Land case in `typeset.ts`, and it shows on home (`/`) and the poem (`/writing/poem`). Preview: `preview.html`, the painted layer before and after, at dawn, noon, dusk and night, desktop and 375 px wide.

Stanley's asks:

- "the snowy mountain caps don't look so snowy."
- A tree line, to add depth to the background.
- The sun's and the moon's light should fall on the mountains properly.

Not yet approved. One decision needs Stanley's call first (Light, below): it changes a README rule.

## Units

Lengths are in scene px, the engine's own units. The scene is laid out at 64% zoom (`SCENE_ZOOM` in `mount.ts`), so scene px = CSS px / 0.64. A 1440×762 window is 2250×1190 scene px; a 375×812 phone is 586×1269. `W` and `H` are the scene's width and height; the horizon is at `0.55 H`. Cells are 5×7 scene px at the finest grid (3.2×4.5 CSS px), so one row is about `0.0059 H` on a desktop and `0.0055 H` on a phone. `RIDGE_STEP` is 6. Heights "above the horizon" are `horizon - y`.

## What's wrong now

Checked in a browser at 1440×762 at 07:00, 08:00, 12:00, 16:30, 18:54, 22:00 and 03:00, and by recomputing `buildRidges` for six seeds.

**Snow.**

1. **The paint has no snow.** `backdrop()` fills the far range in one colour. Snow exists only in the glyph layer, where `drawSnow` fills `Kind.Land` and the typesetter prints it as `.·:;` at alpha 0.6 or less. Those glyphs cover perhaps 15 to 25% of a 5×7 cell, so even cream ink lifts the cell by under a tenth. Every far-ridge glyph above the horizon is already mixed 28% toward `cloud`, so snow glyphs look like any other far-ridge glyph. At noon the massif's top is a slightly busier halftone; at dusk and at night there's nothing.
2. **The snowline is one absolute line, too high.** `horizon - 0.215 H` sits at the far ridge's 95th percentile: across seeds 1, 2, 3 and 7 the far ridge's median height is 0.12 H, its 85th percentile 0.175 H, its top 0.23 to 0.26 H. Only the massif gets past it, by 0.03 to 0.045 H (four or five rows), and only across about 200 px. Seed 2 has no snow in a 1440-wide window at all. The massif sits 700 to 1100 px into each 1500 px stretch, so a phone usually has no snow either.
3. **Night removes what's left.** The cream mix shrinks to 34% (`0.85 * (1 - 0.6 night)`) and the light meta to 0.6, so there's nothing at night.
4. **Haze isn't the cause.** The far veil is 0 at the crest, and the mist band only reaches `horizon - 0.08 H`. The cap is pale because its colour starts from the hazed ridge colour, `mix(hillFar, skyHorizon, 0.5)`, not because a veil sits on top of it.

**Light.**

5. **The lit side faces the right way.** `slopes()` lights a slope that runs down toward the globe's x. The sun crosses from `0.12 W` (morning, left, east) to `0.62 W` (18:30, left of centre), and the moon takes the same path through the night. At 08:00 the massif's left flank is the lit one, at 16:30 its right, at 03:00 (moon at `0.49 W`) its right. Peaks to the right of a low sun light their left flank. With the sun behind the range in depth, that's right: the crest catches a rim on the side toward the sun.
6. **It doesn't show.** Light is in glyphs only: four strips at most `0.05 H` under the crest, a little denser and at alpha `0.45 + 0.25 sl`. In the 08:00, 16:30 and 03:00 screenshots you can't tell the lit flank from the shaded one without knowing where to look. The paint under the glyphs is one flat colour per ridge.
7. **The light doesn't fall off with distance** from the globe: a peak at the far edge is lit as strongly as one beside the sun. The `clear` rule, which drops the lighting within `1.5 R` of the globe so a lit slope doesn't read as the globe showing through the hill, works and stays.

## Light

### The decision for Stanley

The README says: "Light lives in glyphs only: no painted gradients or 3D shading on the land." That rule came after the banded 3D shading was dropped (direction.md, Oct 29). At a 5×7 cell the glyphs can't carry light alone (point 6), and snow can't be lit or shaded without it.

**Recommended:** paint each mountainside as one flat plane, a lit tone or a shaded tone, like the Circadian Rhythm poster's mountains, and keep the glyph strips on top for texture at the crest. There are still no gradients and no banding: one tone per mountainside, with a hard edge where one face meets the next. The README line becomes: "Light on the land is one flat plane per mountainside in the paint, lit or shaded, with denser glyphs toward a lit crest. No painted gradients or banding."

**Alternative:** glyphs only, made stronger: denser strips, alpha up to 0.85, ink further toward the light colour. That's cheaper, but at this cell size it reads as noise over the ridge rather than a lit face, and snow would stay a texture rather than a material.

The rest of this section assumes the recommendation.

### Faces

Build faces on a smoothed ridge so a whole mountainside goes one way:

1. `sm[i]` = the ridge averaged over ±12 samples (±72 px).
2. `face[i]` = the existing `face()` rule from `slopes()`, unchanged (window 6, the `clear` rule, the "light well above" rule), read on `sm`: 1 lit, −1 shaded, 0 flat.
3. A run shorter than 10 samples (60 px) takes the face of the run to its left, so creases don't flicker into stripes.
4. Each run `[i, j]` shares its end sample with the next run, so planes tile with no gap.

A run's sides lean away from the light as they go down, 0.2 px across per px down: `sideX(k, y) = k·STEP + 0.2 (y - ridge[k]) · sign(k·STEP - cx)`. The plane is the polygon along the crest from `i` to `j`, then down the two side lines to the horizon, clipped to the ridge's own path.

### Plane tones

Built from the values `garden.ts` already computes: `light` and `lightCol` from `slopeLight`, `rim` (`sunLook.low` while the sun is up, else 0), `back` from `backlight`, `colors` from `ridgeColors`.

```
k      = clamp(light / 0.6, 0, 1)                        // plane strength
fall   = 0.55 + 0.45 · exp(-((xMid - cx) / (0.5 · max(W, 1400)))²)   // falloff from the globe; xMid = run centre
front  = 1 - rim                                          // a sun behind the range lights rims, not faces
pitch  = |sm[j] - sm[i]| / ((j - i) · STEP)
a      = k · fall · front · layerAmt · smoothstep(0.08, 0.35, pitch)
layerAmt: far 1, mid 0.5, near 0 (the near ridge stays one colour)

lit   = mix(colors[layer], lightCol, 0.16 · a)
shade = mix(colors[layer], ground,   0.22 · a)
flat  = colors[layer]
```

The pitch term keeps rolling ground from showing as planes: a gentle side barely turns from the light. Planes are painted after the ridge fill and before its haze veil, so the veil fades them toward the foot as it does the ridge.

What it gives (`k`, then what you see):

| Hour | Light | `k` | `front` | Reads as |
| --- | --- | --- | --- | --- |
| 06:40 | sun low at `0.15 W` | 0.91 | 0.19 | Rock mostly backlit, faint planes; snow faces toward the sun go warm (below) |
| 09:00–16:00 | sun high | 0.57 | ≈1 | Faces toward the sun a step lighter; faces away a step darker where the sun is lower than twice their pitch |
| 17:45 | sun low at `0.59 W` | 0.9 | 0.2 | As dawn, from the other side; the existing rim strips carry the crest |
| 18:55 | sun gone | 0 | — | No planes; ridges are the dusk silhouettes |
| 22:30 | moon, `moonlight` 1 | 0.7 | 1 | Moonlit faces a cool step lighter (`globe`), the far sides near `ground` |
| 00:00–01:30 | moon, `moonlight` 0.45 | 0.32 | 1 | Faint; the dead of night stays dark |

### Glyph layer

`drawLand` fills each far and mid ridge with the same plane polygons and colours (`Kind.Land`, light meta 0.5) after its base fill, so the halftone's ink colour follows the planes. Share one builder between `backdrop` and `drawLand`; it returns `[Shape, Rgb, face][]`. Then, unchanged in shape, the four crest strips; changed:

- Their strength `s` is multiplied by the run's `fall`.
- In `typeset.ts`'s Land case, lit-strip alpha goes from `0.45 + 0.25 sl` to `0.5 + 0.35 sl`.

The strips stay the only light on the near ridge.

## Snow

Snow is a material on the far range: painted in the backdrop as flat shapes, split by the same faces as the rock, and printed again in the glyph layer as a brighter, denser halftone. Only the far range carries snow; the middle ridge is wooded and the near ridge is meadow.

### Where it lies: a snowline per peak

```
top[i]  = the highest far-ridge height (above the horizon) within ±20 samples (±120 px), then
          averaged over ±10 samples, so the line doesn't step as a new summit comes into reach
cap[i]  = min(0.06 H, 0.7 · (top[i] - 0.15 H))           // how far down from its summit a peak is white
          no snow where cap[i] < 0.008 H (about 1.4 rows)
rag[i]  = 0.2 · cap · fbm1(x / 9,  seed + 404, 2)                          // ragged edge
tongue  = 0.9 · cap · max(0, (fbm1(x / 20, seed + 505, 2) - 0.3) / 0.7)^1.5 // streaks down gullies
line[i] = horizon - top[i] + cap + rag + tongue            // y of the snowline
snow where far[i] < line[i]
```

The tallest summits carry the deepest caps and lesser ones get small caps, and a summit under 0.15 H carries none. Tongues run 20 to 40 px wide and up to nine tenths of the cap's depth again below it, so snow runs down in streaks instead of ending on a level line. Measured across six seeds: snow covers about 20% of the far range's length overall (18 to 22%), 5 to 29% of a 1440-wide window, and 7 to 38% of a 375-wide one, with the deepest cap 8 to 12 rows. Seed 1 (the default) gives 27% on desktop and 38% on a phone. The same rule does it all; a phone no longer depends on catching the massif.

Within each face run, every stretch under the snowline is one shape: the crest from `i` to `j`, then back along `line`. Where the stretch meets the run's end, its side follows the run's leaning side line (`sideX` at `line`), so snow splits where the rock does.

### Colour

```
base   = mix(cloud, skyHorizon, 0.25)
paint  = mix(base, colors[0], 0.3 + 0.4 · back)          // the far layer's haze, and the backlit sun
lit    = mix(paint, lightCol, 0.35 · k · fall · (1 - 0.6 · back))
shade  = mix(paint, skyTop,   0.25 · k · fall)            // snow in shadow goes toward the sky's blue
flat   = paint
```

`cloud` already follows the sky (cream by day, amber at golden hour, coral at sunset, mauve at twilight, slate at night, near-black at midnight), so snow follows it without new tokens. Snow's lit face is not multiplied by `front`: a low sun still warms snow turned toward it at dawn and golden hour, while the rock under it has gone to silhouette.

What it gives at each hour, with `fall` = 1 (computed from `palette.ts`):

| Hour | Rock | Snow, shaded | Snow, lit |
| --- | --- | --- | --- |
| 06:40 dawn | `#5c5d64`, backlit | `#797982` | `#978783`, warm, on sun-facing flanks |
| 12:00 day | `#81919b` | `#aab4b5` | `#c4c5ba` |
| 18:55 dusk | `#984343` | `#d87659` coral, one tone (sun gone) | the same |
| 20:15 twilight | `#61305d` | `#985681` mauve | `#a05d88` |
| 22:30 night | `#212e44` | `#36445d` | `#66738c` |
| 00:00 midnight | `#090e18` | `#101521` | `#222835` |

Night stays dark: moonlit snow is the brightest land at 22:30, about the moon glow's own value, and at midnight it's a shade off the rock. At dusk the snow is the brightest land, coral against the blood-orange sky. That's the afterglow on real peaks after sundown, and it keeps the sunset loud. If it's too much, the lever is the `0.3` in `paint`: 0.5 brings dusk snow down to a dull rose.

### Haze

The far veil is painted after the snow, as for the rock, so snow sits under the same haze: none at the crest, more toward the foot (rarely reached, since caps are at most 0.06 H deep). The 0.3 mix toward `colors[0]` in `paint` is the snow's aerial perspective. Don't add a separate veil.

### Glyph layer

`drawSnow` builds the same face-split shapes and fills them as `Kind.Land` with the colours above. To print snow brighter than rock without a new kind (the eight kinds already fill the RGB corners in `rasterize.ts`), mark snow with the Land meta's `back` flag, which Land doesn't use today: `{ id: 0, light, back: true }`. `rasterize.ts` already averages the flag into `back[i]` for Land cells. In the Land case in `typeset.ts`, when `back[i]` is set:

- Ink mixes toward `cloud` by 0.1, not 0.28, so the glyphs keep the snow's own colour.
- The dither threshold is scaled by 0.8 (`d > bayer · 0.88`), so more snow cells print.
- Alpha is 0.75 on lit snow (`sl > 0.05`) and 0.55 otherwise.
- Shaded snow never goes bare: skip the `-sl > bayer → g = 0` rule.

Light meta per face: lit `0.5 + 0.5 · (0.4 + 0.5 · k · fall)`, flat 0.6, shaded 0.45.

## Tree line

A line of conifers along the middle ridge: spruce and fir spires, dark and quiet, between the bare, snowy far range and the open near meadow. It's the depth cue Stanley asked for: three distinct grounds, rock and snow, woods, meadow. The trees are smaller than the flowers by an order of magnitude, so they read as far away.

### Where

- **On the middle ridge only.** Its crest sits 0.05 to 0.16 H above the horizon, below every snow cap, and its cliff and shelf give the woods somewhere to stop. Not the near ridge: it's 0.02 to 0.044 H high, right behind the flowers and level with the bio's top edge, and trees there would be noise behind the text. Not the far range: it's above the tree line, which is the point of the snow.
- **Wooded stretches:** `woods(x) = fbm1(x / 140, seed·13 + 606, 3)`. Wooded where `woods > -0.1`, which covers about 65% of the ridge's length in clumps 100 to 400 px long with clearings between them.
- **No trees on the cliff:** skip where `|mid[i+2] - mid[i-2]| / 24 > 0.9` (about 2% of the ridge). The cliff stays bare rock.
- Fixed in x like the ridges: slot positions come from `hash(slot, …, seed)` in scene px, so a resize reveals more trees and never moves one. Heights scale with `H` like the ridges.

### Silhouette

Spires, one slot every 5 scene px (one cell width):

```
x      = slot·5 + (hash(slot, 1, seed) - 0.5) · 3
dens   = smoothstep(-0.1, 0.15, woods(x))
skip if woods(x) < -0.25, or on the cliff, or hash(slot, 2, seed) > 0.12 + 0.83 · dens
clump  = 0.6 + 0.4 · clamp((fbm1(x / 45, seed·13 + 707, 2) + 1) / 2, 0, 1)
h      = H · (0.007 + 0.011 · hash(slot, 3, seed)^1.5) · clump      // 0.004–0.018 H
w      = 0.36 · h                                                     // narrow, about 3:1
root   = mid(x) + 0.2 · h                                             // sunk into the slope
spire  = triangle (x - w/2, root), (x, root - h), (x + w/2, root)
```

- **Scale:** 5 to 21 scene px tall on a desktop (most under 12), so 1 to 3 rows, and 2 to 8 px wide. That's 3 to 15% of the middle ridge's height above the horizon, and about a tenth of a near feature flower's head.
- **Character:** varied heights (the `^1.5` keeps most small with a few tall ones poking up), clumps of taller trees where `clump` is high, and stragglers thinning out at the edges of each wood (`dens`), with single trees out in the clearings where `woods` is between −0.25 and −0.1. Spires overlap into a serrated canopy where the wood is dense and stand apart where it's thin.
- **The wood's body:** under the crest, a band in the forest colour, `0.025 H + 0.01 H · fbm1(x / 60, seed·13 + 808, 2)` deep (0.015 to 0.035 H), tapering to nothing over 10 samples at each end of a wooded run. The band's ragged lower edge is where the woods give way to pasture. Nothing ends in a vertical edge.

### Colour and haze

```
wood   = mix(hillNear, grassDark, 0.4)
forest = mix(colors[1], wood, 0.35 + 0.15 · back)
```

Tied to the middle ridge's own colour, so it carries that layer's haze and backlight and only steps toward the darker, slightly less blue wood: about 10% darker by day (`#5c676d` against the ridge's `#67757e`), near black against a dusk sky, and barely visible at night. Paint order is ridge fill, then the wood's body and spires, then the middle ridge's planes (at half strength, clipped to the ridge, so the spires above the crest stay one flat tone), then the middle veil, which hazes the foot of the woods as it does the ridge.

| Hour | Woods read as |
| --- | --- |
| Day | A soft, slightly darker serration on the middle ridge, hazed. The quietest the woods get. |
| Golden hour, sunset | A dark comb of spires against the glowing far range, and the clearest depth step of the day. The rim strips (below) catch the tips. |
| Twilight | Dark violet silhouette. |
| Night | Within a shade of the ridge. No moonlit tips, no lights. |

### Glyph layer

Fill the body and spires as `Kind.Land` in `forest`, light meta 0.5. Dark woods print a sparse halftone; the silhouette lives in the paint. Two changes:

- **Rims at sunset:** run `slopes()` for the middle ridge on the canopy line, not the bare crest: `canopy[i]` = the smaller y of `mid[i]` and every spire tip within that sample's 6 px. Against a low sun the rim strips then trace the treetops.
- No `^` or other tree glyph. At 1 to 3 rows a spire is texture, and a drawn tree glyph would compete with the flowers.

Plants still win a cell over the land at a quarter coverage, so stalks and heads in front of the woods are untouched. The middle ridge sits above the horizon and the bio sits below it, so the woods never run behind the text. On the poem, the rose's head is at 0.6 H, below the horizon too.

## Draw order

Backdrop:

1. Glow.
2. Far ridge fill, far planes, snow, far veil.
3. Middle ridge fill, the wood's body and spires, middle planes, middle veil.
4. Near ridge fill.
5. Floor, mist. Both unchanged.

`drawLand`, inside `beginStill`/`endStill` as now:

1. Far ridge: fill, planes, strips, snow.
2. Middle ridge: fill, woods, planes, strips on the canopy.
3. Near ridge: fill, strips.
4. Floor, mist. Both unchanged.

`touchMeta` must cover the spires' tops: `top` is the smaller of the crest and the canopy.

## Constants

| Name | Value | Where |
| --- | --- | --- |
| Face smoothing | ±12 samples | faces |
| Shortest face run | 10 samples | faces |
| Side lean | 0.2 px across per px down, away from the light | planes, snow |
| Plane amounts | lit 0.16, shade 0.22; far 1, mid 0.5, near 0 | planes |
| Pitch ramp | smoothstep(0.08, 0.35) | planes |
| Falloff | `0.55 + 0.45 · exp(-(dx / (0.5 · max(W, 1400)))²)` | planes, strips, snow |
| Lit strip alpha | `0.5 + 0.35 sl` | typeset |
| Snow summit reach | ±20 samples, smoothed ±10 | snow |
| Snowline | cap `min(0.06 H, 0.7 (top - 0.15 H))`, none under 0.008 H | snow |
| Rag, tongue | 0.2 cap at x/9; 0.9 cap at x/20 above 0.3 | snow |
| Snow glyphs | cloud mix 0.1, threshold × 0.8, alpha 0.75 / 0.55 | typeset |
| Woods | `fbm1(x/140) > -0.1`, stragglers to −0.25 | trees |
| Spire | slot 5 px, h 0.007–0.018 H × clump, w 0.36 h, sunk 0.2 h | trees |
| Wood body | 0.015–0.035 H, tapered over 10 samples | trees |
| Forest colour | `mix(colors[1], mix(hillNear, grassDark, 0.4), 0.35 + 0.15 back)` | trees |

`tokens.json` gains no tokens: every colour is a mix of palette fields, as the ridges' are.

## Cost

The backdrop already repaints only when the glow moves (`backdropKey`), and `drawLand` is inside `beginStill`. The spires are one path of about W/5 triangles (450 on a 2250-px scene), and the faces and snowline are a few passes over the ridge arrays when the hour or size changes. Build the face runs and the snowline once per hour change and reuse them in both layers.

## Verify

- **Snow:** caps on several peaks at 1440×762 and at 375×812 (seed 1, and after Regrow), white by day, warm on sun-facing flanks at dawn and golden hour, coral after sunset, blue-grey under the moon, near invisible at midnight. Tongues run down from the caps and the line never steps.
- **Light:** at 08:00 the faces toward the sun (left) are lighter and the far sides darker. At 15:00 it's the same from the right of the sun. At 22:30 the faces toward the moon are lighter. No plane is narrower than about 60 px, and none shows on rolling ground.
- **Woods:** a quiet serration on the middle ridge by day, a dark comb against the sunset with rim-lit tips, and gone into the ridge at night. Nothing behind the bio. Flower stalks and heads in front are untouched. A resize reveals more trees and moves none.
- Both themes: the scene follows the hour, so scrub through a whole day on home and scroll the whole poem.
- Desktop and 375 px wide. Keyboard focus is unaffected; the canvas stays `aria-hidden`.
- Reduced motion: unchanged. Nothing here moves.

## Notes

- The sun's path ends at `0.62 W`, so the sun sets left of centre, never at the right edge. That's outside this spec. It's why peaks right of the setting sun light their left flank: correct for a sun behind the range, but if Stanley wants "dusk in the west" to mean the right side of the screen, the path needs moving, and this spec's faces follow it without change.
- The preview paints with a two-stop sky and a stand-in disc for the globe. The engine's halftone sky, clouds and glyphs aren't drawn, so judge colour and shape there, and density in the browser.
- The dev overlay in the running server showed "Raster worker silent for 1000ms; drawing on the main thread" after rapid hour changes. That's unrelated to this spec, but it obscured screenshots.
