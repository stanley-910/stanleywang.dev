# SnowCap

> Approved 2026-10-30. Built in `components/garden/engine/garden.ts` (`buildSnowline`, `snowCap`, `drawSnow`, `buildFaces`, `relief`, and `backdrop` in snow weather) and `typeset.ts`. Mock: the "Meadow peaks: snow and tree line" canvas in Claude Design.

Snow on the far range's high tops, printed as its own material so it reads as snow and not as paler rock. Below it, the rock is split into broad lit and shaded faces.

## Problem

The old `drawSnow` filled everything above one ragged height as plain land in a creamier colour. So:

- It printed with the rock's halftone (` .·:`), only a little denser. At midday it read as haze on the peak, not snow.
- Its lower edge was a near-level line cut across every peak, so the caps looked trimmed rather than settled.
- It ignored slope: steep faces held as much snow as ledges, and the lit and shaded flanks looked the same.
- Its colour only greyed at night. It did nothing at sunset, which is the moment the mountains should be loudest.

## Related

| Component | Shared | Missing |
|---|---|---|
| Land halftone (GlyphRamp, `land`) | ordered dither, slope light | snow needs to be the brightest mark on the range, not a denser dot |
| Lace and seed heads | soft tile in the material's own colour, glyphs inked over it | the tile idea carries over; the shape and ramp don't |
| Slope light (`SLOPE_LIT`) | lit flank thickens toward the crest | snow has a shaded flank too, which should stay snow, just blue |

## Design

**The range, composed.** The far range is drawn by hand, not generated (`FAR_RANGE`): about two dozen points, each a share of the range's width and a height as a share of the screen height above the horizon, joined in straight runs so the peaks stay pointed, with a little ridged noise (about 1% of the height) to roughen the crest. Two snowy massifs (`SNOW_PEAKS`): the main summit a little left of a third of the way across, 27% of the height up, and a second at 85%, 21.5% up, with a low saddle between at 58% (`SADDLE`). The sun and moon cross the sky from the left and set into that saddle; on a narrow screen they also come up out of a valley. It is the range the old generator showed at 80% browser zoom, fitted into the window at 100%; the cell grid and the flowers are unchanged.

- The range is never drawn narrower than 0.9 screen heights. A screen wider than that shows all of it. A narrower one (a phone, or a portrait tablet) shows a stretch: the notch left of the main summit (`DAWN`, at 22.5%) a tenth of the way in, where the sun and moon come up, and on a phone the saddle about four fifths across, where they set. The summit sits about a quarter of the way in. The near spruce stands follow the same stretch. A fixed 900px stretch first squeezed the peaks sideways into spikes on a phone. Because it was in scene px, the poem, then drawn at a finer zoom than home, also showed a different, narrower-peaked stretch than home on the same phone. As a share of the screen, the stretch holds at any zoom; the poem now shares home's grid anyway.

**Where snow lies.** On the two snowy massifs only.

- The snowline is measured from each massif's summit, its highest point within 40px of where it's placed: snow covers the top quarter of its height, with a gentle wobble (about ±10px). Measuring from a sliding local maximum instead let the cap's outline creep down the whole flank as a thin grey line; don't.
- The cap runs out from the summit each way until the ridge has dropped clear of the line, so it ends where the mountain does. A fixed window cut it off in a vertical edge on tall screens.
- Peaks below `SNOW_MIN` (8% of the screen height above the horizon) stay bare.
- Snow holds on slopes gentler than about 60° as seen on a 1440 × 900 screen, measured in the range's own units so a phone, which magnifies its stretch of range, keeps the same cap. Measured in screen pixels, the phone's peaks were 2.4× steeper and the cap broke into vertical stripes. Steeper points print as rock, so cliffs show dark ribs through the white.
- The lower edge dithers into the rock where the cap only partly covers a cell, never a hard line. No streaks below the snowline: tried as vertical couloir fingers, they hung off the cap like drips.

**How it prints.** The material channel already holds eight kinds, its full three bits, so snow and forest ride under `Kind.Land` with a material id in the meta layer (`LandMat`). Snow is drawn after the rock and its slope light.

| Part | Glyphs | Colour | Tile |
|---|---|---|---|
| Crest outline (first snow cell under the sky) | line glyph nearest the slope: `/ \`, `^` at a summit, `_` on a ledge | `*-snow` lightened 15% | none |
| Lit flank | `SNOW` ramp `·:;=`, densest just under the crest | `*-snow` | `*-snow` at 35% |
| Shaded flank | `.'` sparse, dithered | `*-snow-shade` | `*-snow-shade` at 30% |

The lit flank faces the sun or moon. The split between the flanks runs down from the summit on a diagonal (0.8px across per px down), leaning away from the light, the way a ridge parts a peak's two faces. Split column by column, the edge fell straight down from the summit and the change read as abrupt. With the sun low behind the range (golden hour and sunset), only a rim along the crest is lit and the rest is shade, as the rock does.

Every change in the light eases; none switches. As the sun sinks the lit flank narrows into the crest rim, and as its light goes (17:45–18:30) the rim thins to nothing, so the cap is all shade before the moon's lit flank grows back in. As the sun or moon passes over a summit, the split's lean eases through upright. A first version switched at one moment, and at 18:30 the cap jumped from a thin rim to a full lit flank with nothing yet lighting it.

**Faces.** The far range's terrain, after the halftone mountain photo: the rock is split into broad lit and shaded faces, shaded the way the snow's two flanks are, so the mountain reads as folded planes rather than one flat shape.

- Hidden ridgelines set the faces, placed by hand with the range (`RIDGELINES`): ten, each naming the peak it runs down from, which way, how far (half to 85% of the peak's height) and its lean (0.65–0.9px across per px down). Each summit sends one down each side; the shoulders send one down their own outer flank. They run in 5px steps with a small wobble and branch once, steeper, a little under halfway down. Detecting them from the jagged ridge first gave about thirty near-vertical ridgelines side by side, and the faces printed as stripes, a pattern rather than terrain.
- The ridgelines are never drawn. Within 80px of one, rock cells on the light's side get a light tile (the light colour at up to 8% by day, 2.5% at night). The other side gets a soft shadow only 36px wide: a `*-ground` tile at up to 8%. Tiles only: nudging the dithered slope glyphs as well printed them in vertical streaks. Both ease to nothing at their outer edge. At night a 5% lit tile showed every cell's edge as a stair step down the flank, so it's halved. A 10–20% shadow across the full 80px read as a thick dark line; keep it light. With a floor, each face stopped in a hard edge and read as a slab.
- Faces ease in over the 30px below the snowline and never touch the cap. At full strength from the first rock cell, a ridge's shadow notched up into the cap's ragged lower edge.
- With the sun behind the range (golden hour, sunset), or as the light fades, every face eases to the shaded side: the range goes to silhouette. A face's turn toward the light also eases over 150px as the light crosses its ridgeline, rather than flipping.
- Light lives in the cells: the faces are tiles and glyph density, never a gradient painted on the silhouette.
- Rejected: drawing the ridgelines as one-cell `| / \` lines with lit dots beside them (too thin to read as terrain), random dark dots from a noise height field (read as specks), and faces by glyph density alone (smooth, but the planes disappear).

**By hour.**

- Day: near white, shade a clear blue-grey. The brightest thing on the land.
- Golden: cream, shade lavender.
- Sunset: alpenglow. The lit rim and the summits go salmon (`sunset-snow`), the shade violet. This is the one place the land is allowed real colour, and only for the half hour the sky is loudest.
- Twilight: dusty pink fading into the violet sky.
- Night: moonlit grey-blue, still the palest land, never brighter than the moon. In the dead of night (the palette's midnight keyframe) it sinks to `#56627a`, shade `#1c2433`.
- Dawn: pink-grey, cooler than sunset.

## Tokens

New, per keyframe, in `palette.ts` and `tokens.json`:

| Token | day | golden | sunset | twilight | night | dawn |
|---|---|---|---|---|---|---|
| `*-snow` | `#eeece4` | `#f4dcb6` | `#f09a7c` | `#b98aa8` | `#8a98b0` | `#e6d4d6` |
| `*-snow-shade` | `#a5b2c0` | `#8f8399` | `#6a4a78` | `#3e2e58` | `#2c3950` | `#8c92a8` |

By day the far range's rock is a step darker than before (about `#72818b`, was `#81909a`): it takes 38% of `day-sky-horizon` instead of 50%, and 8% of `day-ground`, so the snow and the lit faces stand out. Other hours are unchanged.

## Rules it changes

- README, The garden's glyphs: a **Snow** line. Snow is its own material, the palest mark on the land, lit and shaded in glyphs and a flat tile, never a painted gradient.
- README, The garden's glyphs, hills: the far range's faces are a faint tile per cell, light or shadow, as well as glyph density.
- README, Colour: the land stays neutral stone, except snow at sunset, which takes alpenglow.

## Snow on the meadow

The snow weather (Weather) lays snow on the meadow in the same colours: a cap on the top cell of each head and stem in this spec's crest colour (`*-snow` lightened 15%), its tile turned toward `*-snow`, and a cover on the ground and near ridge mixed toward `*-snow-shade`, with the grass's light toward `*-snow`.

The far range's caps keep their cells, shape and colours, but while snow lies the backdrop also paints the cap's two flank polygons (`snowCap`, shared with `drawSnow`) under them: the shaded flank in `*-snow-shade`, the lit one in `*-snow`, at 85% of the snow lying. Without it, the rock's smooth painted silhouette showed through the stepped, part-covered snow cells as a dark outline behind the white. At 85% a little rock tints the paint, so the cap's glyphs still print on it. In clear weather nothing is painted, and the caps are cells only, as before.

## Accessibility

Decorative, like the rest of the scene. No text sits over the range, so contrast doesn't apply. With reduced motion nothing changes; snow doesn't move.

## Verify

- Day, golden, sunset, night: the caps read as snow at 1440px and 1024px wide.
- Snow never prints over the moon or sun glyphs, and stays behind the middle ridge's trees.
- The snowline and faces are built once per layout; only the lit side follows the light.
- In snow weather, no dark ridge outline shows behind the cap at noon or at night, on a wide screen or a phone; the painted cap repaints only when the backdrop does.

## Open questions

None. (Resolved: the phone shows the main summit, now that the range is composed and a narrow screen shows the stretch around it.)
