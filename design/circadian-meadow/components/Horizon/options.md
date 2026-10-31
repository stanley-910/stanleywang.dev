# Horizon: options

> Chosen: A, 2026-11-01. Built as specified in `README.md`, which supersedes the colours and glyphs below where they differ.
>
> Sketches, 2026-10-31. The problem: below the horizon the floor is one flat gradient (`hillNear` toward `ground`), so the band between the farthest flowers (about 7% of the height below the horizon) and the near ridge's treeline reads as empty.

All three keep the far range, snow caps, middle forest and near spruce as they are. Rows 1 to 6 are the same in each; the change is below the horizon line (row 7).

## A. Valley and river

```
            _.=;;=._                         _.;=:._
       ..·:;;;;;;;;;:·..     .·:.     ..·:;;;;;;;;;;;:·..
 ..·:;;;;;;;;;;;;;;;;;;;;:·.:;;;;;:..:;;;;;;;;;;;;;;;;;;;;;;:·..
^^.^^^.^^.^^^^.^^.^^^.^^^^.^^.^^^^.^^^.^^.^^^^.^^^.^^.^^^^.^^.^^
 /\  ^^.^^.^^^. /\  /\ .^^^.^^^.^^.^^^.^^. /\/\ .^^^.^^.^^^. /\
/||\ ,.,^,.,.^,/||\/||\,.^,.,^,.,.^,.,^,.,/||||\,.^,.,^,.,.^/||\
 .    .     .    .     .    .     .   -~-  .    .     .    .        far slope, hazed
   .     .     .    .     .    .     ~=~     .     .    .     .
·:;;;:·.  .·:;;;;;:·..·:;;;:·.  .·:;~=~·..·:;;;;:·.   .·:;;;;:·.    brow, lit crest
;;;;;;;;;:·:;;;;;;;;;;;;;;;;;;;;;;;~~=~~;;;;;;;;;;;;;;;;;;;;;;;;;
::::::::::::::::::::::::::::~~=~~=~~::::::::::::::::::::::::::::
~~=~~=~~=~~=~~=~~=~~=~~=~~~=~~:::.:\|/::.::.:::.:.::.::.::.:.:::
~~=~~~=~~=~~=~~~=~~=~~~ \|/  \|/    (@)  \|/  \|/  (*)  \|/
=~~=~~=~~~=~~ \|/   |   \|/   |     |    \|/   |    |   \|/
```

The meadow rises to a low brow, falls into a hidden valley, and the far slope climbs hazily to the treeline. A river slips out through a notch in the brow and winds forward to the left edge, widening toward us. At noon it is a pale grey-blue thread, the one cool mark on the floor; at sunset it carries the blood-orange horizon into the meadow; at night it goes almost to ground, lit only where the moon falls.

## B. Valley only

```
            _.=;;=._                         _.;=:._
       ..·:;;;;;;;;;:·..     .·:.     ..·:;;;;;;;;;;;:·..
 ..·:;;;;;;;;;;;;;;;;;;;;:·.:;;;;;:..:;;;;;;;;;;;;;;;;;;;;;;:·..
^^.^^^.^^.^^^^.^^.^^^.^^^^.^^.^^^^.^^^.^^.^^^^.^^^.^^.^^^^.^^.^^
 /\  ^^.^^.^^^. /\  /\ .^^^.^^^.^^.^^^.^^. /\/\ .^^^.^^.^^^. /\
/||\ ,.,^,.,.^,/||\/||\,.^,.,^,.,.^,.,^,.,/||||\,.^,.,^,.,.^/||\
 .    .     .    .     .    .     .    .     .    .     .    .      far slope, hazed
   .     .     .    .     .    .     .     .     .     .     .
        ..·:;;;;:·..               ..·:;;;;;;:·..                  first swell
·:;;;:·:;;;;;;;;;;;;;;:·..   ..·:;;;;;;;;;;;;;;;;;;;:·..·:;;;:·.    brow, lit crests
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
.:.\|/.::.::.:.::\|/.::.:.::.:(@)::.:.::\|/:.::.::.(*).::.:\|/:.
\|/    \|/   |  \|/    \|/     |   \|/   |   \|/    |   \|/   |
```

Two or three broad swells make a rolling brow; behind it the ground drops out of sight and a paler, hazier slope rises to the trees. At noon the brow's lit crests separate it from the far slope by halftone density alone, which is subtle; at sunset, backlit, the brow goes dark against a glowing slope and reads well; at night the two nearly merge.

## C. More grass

```
            _.=;;=._                         _.;=:._
       ..·:;;;;;;;;;:·..     .·:.     ..·:;;;;;;;;;;;:·..
 ..·:;;;;;;;;;;;;;;;;;;;;:·.:;;;;;:..:;;;;;;;;;;;;;;;;;;;;;;:·..
^^.^^^.^^.^^^^.^^.^^^.^^^^.^^.^^^^.^^^.^^.^^^^.^^^.^^.^^^^.^^.^^
 /\  ^^.^^.^^^. /\  /\ .^^^.^^^.^^.^^^.^^. /\/\ .^^^.^^.^^^. /\
/||\ ,.,^,.,.^,/||\/||\,.^,.,^,.,.^,.,^,.,/||||\,.^,.,^,.,.^/||\
,',.,'.,,',.,'.,,',.,'.,,',.,'.,,',.,'.,,',.,'.,,',.,'.,,',.,'.,    far grass, texture
',.',,'.',,.',,'.,',.',,'.',,.',,'.,',.',,'.',,.',,'.,',.',,'.',
,|,.,||,.,|,.,|/,.,||,.,|,.,||,.,|,.,||,.,|,.,||,.,|,.,||,.,|,.,
.|/.\|.\|/.,|/.\|/.\|.,\|/.\|/.,\|.\|/.\|/.,|/.\|/.\|.,\|/.\|/.     tussocks
\|/\|/.\|//\|/\|/.\|/\\|/.\|/\|/.\|/\|/.\|/\|/.\|/\|/.\|/\|/.\|/
\\|//.\|/\|/\\|//.\|/(@)\|//.\|/\|/\\|//.\|/(*)\|//.\|/\|/\\|//.
 \|/    \|/   |  \|/    \|/     |   \|/   |   \|/    |   \|/   |
 \|/   \|/  \|/   |   \|/    \|/  |   \|/   \|/   |   \|/   \|/
```

No new landform: the grass carries back to the treeline, shrinking to `,'` texture at the far edge, with tussocks every few cells. At noon it fills the band, but as more of the same grey-green it fixes "empty" without adding a place; at sunset it goes dark and flat; at night it is mostly invisible. It also runs against the README's rule that grass grows in tufts with bare ground between and no dense row.

## Recommendation

A, with one change: the river reaches the left edge above the bio, no lower than about 12% of the height below the horizon, so a bright band never sits behind the copy. It is the only option that gives the floor a subject and puts the sky's colour, which changes with the hour and weather, into the meadow; B is its fallback if the river proves too loud.

## A: surfaces, colours and glyphs

Mixes are by palette key, so every keyframe and weather mix carries through. `nearRidge` is `ridgeColors(p)[2]`, today `mix(mix(hillNear, ground, 0.2), ground, 0.6 * back)`.

| Surface | Colour | Glyphs |
| --- | --- | --- |
| Far slope (valley's far side, horizon down to the brow) | `mix(mix(nearRidge, hillFar, 0.25), haze, 0.2)`, under the existing horizon mist | sparse `.` on the lit side only; bare in shade |
| Brow (near meadow's crest) | top: `mix(hillNear, grassDark, 0.4)`, the current floor top, then the existing gradient down to `ground` | halftone `.·:;`, densest at the crest, thinning to `.` toward us; no glyphs on the crest edge itself, the colour step draws it |
| River, far reach (in the notch) | `mix(mix(skyHorizon, haze, 0.3), ground, 0.2)` | `-`, one cell wide |
| River, near reach (to the left edge) | `mix(mix(skyHorizon, skyTop, 0.4), ground, 0.2)`, so nearer water mirrors higher sky | `~` across the body, `=` sparse on the lit side as static glints |
| River banks | `mix(ground, grassDark, 0.5)`, one cell each side | none: a painted edge, like the ridges |

The 20% pull toward `ground` keeps water darker than `snow` at every hour, so snow stays the palest mark on the land. Water needs its own material in the land raster (a Water kind with the `- ~ =` ramp), painted once with the backdrop. Grass blades may root on the banks but never in the water; flowers stay on the brow and in front of it, never on the far slope.

Open for the spec: the river's path is hand-placed as shares of the range width (like `SPRUCE_STANDS`), and on a phone it may need to exit at the left edge sooner.
