# Horizon: the river

> Approved by Stanley 2026-11-01, after several tries. Built in `components/garden/engine/garden.ts` (`buildRiver`, `acrossAt`, `riverField`, `wet`, `riverColors`, `backdrop`, `drawLand`, `RIVER_STONES`), `typeset.ts` (the Water, Shore and Stone branches), `meadow.ts` (no grass where `wet`), `mount.ts` (the field, kept per grid and rebuild) and `rasterize.ts` (`LandMat.Water`, `Shore`, `Stone`, `RIVER_SPAN`).

A river in the far landscape: it comes in from off the left edge and crosses the meadow's back in broad bends into the middle of the forest. It's drawn in type like the rest of the land and carries the sky's light into the floor.

## What was tried, and why it failed

- **Down the meadow toward us**, in deep perspective, from a thread at the trees to a broad run at the bottom. The flowers are inches tall and close, so a river on their plane is either a trickle beside them or a hairline that appears out of the grass. Trees standing in the meadow came out smaller than the flowers.
- **Sized to the flowers.** It read as a pipe, not a river.
- **Behind the flowers, or out of the trees and off the left edge only.** With the bio's top about 116px under the horizon at 1512×860, a long run above the text flattens into a stripe along the horizon.
- **Rimmed spruce on the banks** didn't match the forest's trees.

## Course

The course is a Catmull-Rom curve through hand-placed points. Each point is a share of the width across, and a px depth below the horizon:
- It starts at the forest's middle, at 0.5 of the width.
- It runs left within the room above the bio (`clear.top − 0.04H − horizon`), dipping once.
- Past the bio's left edge it falls in a broad bend.
- It leaves past the left edge at `room + 0.17H`.

Where the text spans the screen (a phone) the same points keep it above the text.

The course is resampled every 1.5px along its length and held above the bio, banks and all, then smoothed.

Half-width is `(2 + 0.24d)` px at depth `d` below the horizon. That's the far landscape's perspective, not the flowers'. A breadth noise of 0.85 to 1.2 pools it in the bends, and each bank has its own ragged edge.

## Across the flow

The type needs to know where across the river each cell lies, `s`: from -1 to 1 bank to bank, and on out to ±`RIVER_SPAN` (1.7) at the banks' outer edge.
- `riverField` works this out per cell from the course, once per grid and rebuild. It's an Int8 grid (±127 at ±`RIVER_SPAN`, -128 off the river) passed with the style.
- The course points are filed by the 4px rows their cross-sections cover, so a lookup only checks the points near that row.
- The raster gets only the outlines of the banks and the water. As 74 strips across the flow, each carrying `s`, the river had been about 80% of the land's commands, sent every frame, which lagged phones.

Nothing roots or grows in the water or on its banks (`wet`): not flowers, not sown flowers, not grass.

## Type

- **Water:** the current is drawn as line glyphs along the flow, one every four cells across, slanted with it (`- \ | /`, with `~` alternating with `-` where it runs level). Each line is the glyph alone over the water's tile; lit tiles under the lines read as a patchwork at this grid. A thread where the water is too narrow for lines.
- **Banks:** a dark wet edge at the water, then up to two pale lines along the shore, fading out.
- **Stones** print as `o`. The gravel islet prints as bank.
- **Trees:** where it enters the forest, five spruce stand out from the treeline either side, built and coloured like the forest's own stands.

## Colour

The water mirrors the sky: the horizon's glow far off and the higher sky nearer, pulled a little toward the ground. After dark it takes the moon's colour (`globe`). The glint on the lines is the light on the water, so it's steel blue at noon, warm at sunset and moonlit silver at night.

## Checked

- 1512×860 at noon, sunset and night, at 1:1. Judge it at full resolution: half-size captures hid how coarse it looked.
- 375×812: it stays above the bio's top.
- The poem page and rain are not checked.
