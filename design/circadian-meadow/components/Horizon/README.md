# Horizon

> Approved 2026-11-01 (option A in `options.md`). Built in `components/garden/engine/garden.ts` (`buildValley`, `valleyColors`, `backdrop`, `drawLand`, `RIVER`), `typeset.ts` (the Water branch) and `rasterize.ts` (`LandMat.Water`). No Claude Design mock; chosen from text sketches.

The land between the meadow's farthest flowers and the near ridge's treeline: a brow, a hidden valley behind it, and a river that comes out of the valley toward us and carries the sky's colour into the meadow.

## Problem

Below the horizon the floor was one flat gradient (`*-hill-near` toward `*-ground`) with grass and flowers on it. The farthest flowers root about 7% of the height below the horizon, so the band between them and the treeline had nothing in it and read as empty.

## Related

| Component | Shared | Missing |
| --- | --- | --- |
| TreeLine | hand-placed, not generated; painted silhouette with sparse glyphs | the treeline ends at the horizon; nothing led the eye from it down to the flowers |
| SnowCap | its own land material with a flat tile and its own ramp | snow stays the palest mark on the land; water sits under it |
| Land halftone (GlyphRamp, `land`) | lit strips thicken `.·:;` toward a crest | the brow needed a crest of its own, below the horizon |

## Design

**Brow.** The near meadow rises to a rolling line at the horizon plus 2.8% of the height (±0.7%, fbm), and dips 1.2% where the river crosses it. Behind it the ground drops out of sight.

**Far slope.** Between the horizon and the brow, the valley's far side climbs to the trees, a step paler than the near ridge and hazed: `mix(mix(nearRidge, hill-far, 0.25), haze, 0.2)`, printed as Rock. `nearRidge` is the near ridge's colour (`ridgeColors(p)[2]`). The existing horizon mist lies over it.

**Under the brow.** A shade of `mix(hill-near, grass-dark, 0.4)` that fades out by the river's lowest point. When the sun or moon lights the slopes, three lit strips under the crest (2%, 1.2% and 0.6% of the height) thicken the halftone toward it, as on the ridges.

**River.** A Catmull-Rom curve through hand-placed points (`RIVER`, as shares of the width and of the height below the horizon). It rises at the trees' foot at 0.66 of the width, meanders toward us with bends that widen, runs down past the bio's left side and leaves at the left edge, up to 17% of the height below the horizon.

- Half-width is (0.6 + 0.22 × depth) px, times a breadth noise of 0.75 to 1.25, squashed to 0.45 vertically, because it's flat water seen from above.
- Banks: `mix(ground, grass-dark, 0.5)`, a 0.6px rim.
- Placement around text: wherever it would run behind the bio, it's held above the bio's top minus 2.5% of the height. When the bio leaves less than 10% of the width to its left (a phone), the river is held there entirely and stays a winding thread along the valley. On the poem (`keepClearColumn`) it isn't held.

**Colour.** The river follows the sky. A vertical gradient from the far end, `mix(mix(sky-horizon, haze, 0.3), ground, 0.3)`, to the near end, `mix(mix(sky-horizon, sky-top, 0.4), ground, 0.35)`, so nearer water reflects higher sky. After dark both ends mix toward a sheen, `mix(haze, globe, 0.25)`, by 0.3 × night × moonlight, so it stays a faint moonlit thread instead of vanishing. The pull toward `ground` keeps it darker than snow at every hour.

| Hour | Reads as |
| --- | --- |
| Noon | a pale grey-blue thread, the one cool mark on the floor |
| Sunset | warm orange-tan, the horizon's colour brought into the meadow |
| Night | near ground, a faint sheen where the moon lights it |
| Rain | storm grey, with the weather's palette mix |

**Glyphs.** Water is its own land material (`LandMat.Water = 5`).

| Where | Glyph | Alpha |
| --- | --- | --- |
| Within 3.5% of the height of the horizon | `-` | 0.55 |
| Nearer | `~`, with fixed `=` glints where the Bayer value is under 0.1, and blank cells where it's over 0.7 | 0.7 |

Each cell has a flat tile in the water's own colour at 0.3. Glyphs are the water's colour mixed 30% toward `*-cloud`.

**Painting.** Painted once into the cached backdrop and the still land raster. It repaints only on palette or globe steps.

**Motion.** None. The land is still; the glints are fixed.

## Rules

- No flowers on the far slope. Flowers stay on the brow and in front of it.
- The river never runs behind the bio text.
- Snow stays the palest mark on the land; the water sits a step under it.

## Tokens

None new. Every colour is a mix of existing palette keys: `*-sky-top`, `*-sky-horizon`, `*-haze`, `*-hill-far`, `*-hill-near`, `*-grass-dark`, `*-ground`, `*-globe`, `*-cloud`.

## Accessibility

Decorative. No motion, so nothing changes under reduced motion. Holding the river above the bio keeps a bright band from sitting behind the copy.

## Verify

- Noon, sunset (18.2) and night (23), at 1440×900 and 375×812: the band between the flowers and the treeline has a brow, a far slope and the river.
- The river never prints behind the bio. On a phone it stays a thread along the valley.
- Water is darker than the snow caps at every hour.
- Rain and snow recolour it through the palette, with no new hex.
- No flower roots on the far slope.

Checked by screenshot at all of the above on 2026-11-01.
