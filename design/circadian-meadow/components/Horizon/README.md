# Horizon

> Approved 2026-11-01 (option A in `options.md`), redrawn the same day after review: the first build painted the river as a smooth ribbon a pixel or two wide, under a brow whose pale strip cut across the meadow, so it read as a road. Built in `components/garden/engine/garden.ts` (`buildRiver`, `riverColors`, `backdrop`, `drawLand`, `RIVER`, `RIVER_STONES`, `BANK_STANDS`), `typeset.ts` (the Water, Shore and Stone branches) and `rasterize.ts` (`LandMat.Water`, `Shore`, `Stone`, `RIVER_SPAN`).

A river that slips out from the foot of the trees right of centre and winds toward us across the meadow, drawn in type like the rest of the land, carrying the sky's light into the floor.

## Problem

Below the horizon the floor was one flat gradient with grass and flowers on it, and the band between the farthest flowers and the treeline read as empty.

## References

Chosen by Stanley, 2026-11-01:

- **Shape:** a river seen from above, its edges ragged with rock and gravel, its breadth swelling and narrowing, stones and a gravel bar in it.
- **Water:** a woodblock-print river, the current drawn as pale lines running with the flow over deep water.
- **Banks:** the bands a shore makes where the water has stood at other heights, following the edge.
- **Light:** water at golden hour, bright against dark land.

## Design

**Course.** A Catmull-Rom curve through hand-placed points (`RIVER`: shares of the width, and of the height below the horizon). It rises at the trees' foot at 0.72 of the width, meanders in the distance with its bends flattened by perspective, makes an S over the meadow's middle, and sweeps down past the bio's left side and out at the left edge. Smoothed after placing, so no stretch kinks.

- **Breadth.** Half-width `(2 + 0.25d + 0.0018d²)` px at depth `d` below the horizon: a thread in the distance, opening up fast as it nears. A breadth noise of 0.8 to 1.25 pools it in the bends. Each bank has its own ragged edge, a broad and a fine fbm, ±15% and ±8%. Flat water seen from here shows half its breadth downward.
- **Around the bio.** Over the bio the course is pressed up toward the horizon, bends and all, by the share that keeps it above the bio's top minus 2.5% of the height; past the bio's left side it falls freely. Any point still too low is held. On a phone (the bio leaves under 10% of the width) the whole course is pressed and held, and stays a winding thread above the text. On the poem (`keepClearColumn`) it isn't held.

**Strips across the flow.** The river is built as strips across it: 48 over the water, bank to bank, and 12 over each bank. Each carries in its meta light where across the river it lies, `s`, from -1 to 1 bank to bank and on out to ±`RIVER_SPAN` (1.7) at the banks' outer edge. The banks reach out 0.6 of the water's half-width plus half a cell. Each layer is laid down whole first, then its strips: strips thinner than a raster pixel, stacked on nothing, wore the material id down until the water read as spruce.

**Water (`LandMat.Water`).** The type reads `s` and its gradient across neighbouring cells. The flow runs across that gradient, which gives each line glyph its slant (`- \ | /`, `~` alternating with `-` where it runs level).

- **Lines.** Where the water spans enough cells, a line of current every 3 cells across, drawn where the stripe count steps between a cell and its neighbour across the flow, so each runs unbroken and one cell wide. A slight wobble lets them drift and braid. Line cells take the glint as their glyph and a lit tile, `mix(body, glint, 0.3 to 0.5)`, brightest mid-stream.
- **Thread.** Too narrow for lines: one run of current along it in the glint, with fixed `=` flecks.
- **Open water.** The body's tile at 0.85 (0.55 on cells the water only partly covers), a shade darker within 0.2 of the banks, with rare `.` flecks.

**Banks (`LandMat.Shore`).** A dark wet edge at the water (tile 0.6, at 0.7 of the bank's colour, sparse `,`), then up to three pale lines following the shore in the flow's slant, `mix(bank, mix(haze, cloud, 0.5), 0.4)`, fading out into the meadow.

**Stones and the bar.** Six stones in the water (`RIVER_STONES`, along the course and across it), printed `o`. A gravel islet in the last wide bend, printed as bank.

**Bank spruce.** Five small stands along the banks (`BANK_STANDS`), out past the bank's bands, the near ridge's tiered spruce at `(1.4 + 0.05d)` cells tall, in the near spruce's colour and material. A tree on the near bank stands in front of the water. Stands over the bio are left out.

**Colour.** The water mirrors the sky. As far below the horizon as it lies, it shows the sky as far above, so the far reach carries the horizon's glow and the near water the higher sky: `mix(sky-horizon, sky-top, 0.15 + 1.6d / horizon)`, pulled toward `ground` by 0.12 far to 0.3 near. After dark it mixes toward `mix(haze, globe, 0.3)` by `(0.3 + 0.3 × moonlight) × night`. The glint the lines carry is the light on the water, `mix(mix(sky-horizon, globe, 0.55 + 0.3 × night), white, 0.15)`. The banks are the meadow's floor a shade toward `grass-dark`.

| Hour | Reads as |
| --- | --- |
| Noon | steel-blue water with pale lines of current, the one cool mark on the floor |
| Sunset | warm gold, the horizon's glow brought into the meadow |
| Night | a moonlit silver thread across the dark floor |
| Rain | storm grey, through the weather's palette |

**Painting.** The backdrop holds only a soft wash: the banks at 0.5 and the water at 0.65, with the bank spruce. The type draws the edges, current and stones over it. Painted once into the cached backdrop and the still land raster. It repaints only on palette or globe steps.

**Motion.** None. The land is still.

## Rules

- The water never runs behind the bio text.
- The river stays one of the brightest marks on the floor at every hour.

## Tokens

None new. Every colour is a mix of existing palette keys: `*-sky-top`, `*-sky-horizon`, `*-haze`, `*-hill-near`, `*-grass-dark`, `*-ground`, `*-globe`, `*-cloud`.

## Accessibility

Decorative. No motion, so nothing changes under reduced motion. Pressing the river above the bio keeps the bright water from sitting behind the copy.

## Verify

- Noon, sunset (18:15), night (23:00) and rain, at 1440×900: the water is built of cells, lines of current run with the flow where it's wide, the banks show a dark wet edge.
- At 375×812 the water stays above the bio's top.

Checked from canvas captures at all of the above on 2026-11-01. Not checked: the poem page.
