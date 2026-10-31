# Horizon: the river

> Approved by Stanley 2026-11-01, after several tries. Built in `components/garden/engine/garden.ts` (`buildRiver`, `acrossAt`, `riverField`, `wet`, `riverColors`, `backdrop`, `drawLand`, `RIVER_STONES`), `typeset.ts` (the Water, Shore and Stone branches), `meadow.ts` (no grass where `wet`), `mount.ts` (the field, kept per grid and rebuild) and `rasterize.ts` (`LandMat.Water`, `Shore`, `Stone`, `RIVER_SPAN`).

A river in the far landscape: it comes in from off the left edge and crosses the meadow's back in broad bends into the middle of the forest. It's drawn in type like the rest of the land and carries the sky's light into the floor.

## What was tried, and why it failed

- **Down the meadow toward us**, in deep perspective, from a thread at the trees to a broad run at the bottom. The flowers are inches tall and close, so a river on their plane is either a trickle beside them or a hairline that appears out of the grass. Trees standing in the meadow came out smaller than the flowers.
- **Sized to the flowers.** It read as a pipe, not a river.
- **Behind the flowers, or out of the trees and off the left edge only.** With the bio's top about 116px under the horizon at 1512×860, a long run above the text flattens into a stripe along the horizon.
- **Rimmed spruce on the banks** didn't match the forest's trees.
- **Laid out around the bio.** Browser zoom changes the CSS viewport, so the bio's box moves relative to the scene. A course fitted to the room above it changed with zoom: sharp and kinked at 100%, closer at 90%.

## Course

The course is laid out like the mountains and trees, so it looks the same at any zoom and on any screen. It ignores the bio.
- Each point is a share of the range across (`rangeX`) and a depth below the horizon in units of `U = min(H, 0.62 × rangeWidth)`, the unit the trees use.
- It's a Catmull-Rom curve: from the forest's middle (0.52 of the range) it runs left, bends down toward us, levels, and leaves past the left edge at `0.17U`. One broad S.
- A phone shows the middle of the range, so it sees the last bend, as it sees the middle of the mountains.

The course is resampled every 1.5px along its length, then smoothed.

Half-width is `(0.0015U + 0.24d)` px at depth `d` below the horizon. That's the far landscape's perspective, not the flowers'. A breadth noise of 0.85 to 1.2 pools it in the bends, and each bank has its own ragged edge.

## Across the flow

The type needs to know where across the river each cell lies, `s`: from -1 to 1 bank to bank, and on out to ±`RIVER_SPAN` (1.7) at the banks' outer edge.
- `riverField` works this out per cell from the course, once per grid and rebuild. It's an Int8 grid (±127 at ±`RIVER_SPAN`, -128 off the river) passed with the style.
- The course points are filed by the 4px rows their cross-sections cover, so a lookup only checks the points near that row.
- The raster gets only the outlines of the banks and the water. As 74 strips across the flow, each carrying `s`, the river had been about 80% of the land's commands, sent every frame, which lagged phones.

Nothing roots or grows in the water or on its banks (`wet`): not flowers, not sown flowers, not grass.

Nothing roots beside or past it either (`dry`). The flowers are inches tall and close, so one rooted beside the river shrinks it to a ditch. `shoreline` keeps, per 8px of width, the river's near bank spread 0.06H either side plus 0.05H; nothing roots above that row. A click beside or past the river sows at that row, so the river always lies on a plane beyond the flowers. Their heads can still rise across it, as near flowers would.

## Type

- **Water:** the current is drawn as line glyphs along the flow, one every four cells across, slanted with it (`- \ | /`, with `~` alternating with `-` where it runs level). Each line is the glyph alone over the water's tile; lit tiles under the lines read as a patchwork at this grid. A thread where the water is too narrow for lines.
- **Banks:** a dark wet edge at the water, then up to two pale lines along the shore, fading out.
- **Stones** print as `o`. The gravel islet prints as bank.
- **Trees:** where it enters the forest, five spruce stand out from the treeline either side, built and coloured like the forest's own stands.

## Colour

The water mirrors the sky: the horizon's glow far off and the higher sky nearer, pulled a little toward the ground. After dark it takes the moon's colour (`globe`). The glint on the lines is the light on the water, so it's steel blue at noon, warm at sunset and moonlit silver at night.

## Checked

- 1512×860 at noon, sunset and night, at 1:1. Judge it at full resolution: half-size captures hid how coarse it looked.
- The same shape in proportion at 1512×860 (100%), 1680×956 (90%) and 2560×1440. On a 375×812 phone, the middle of the range shows.
- The poem page and rain are not checked.
