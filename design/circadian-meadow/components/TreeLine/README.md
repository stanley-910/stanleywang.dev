# TreeLine

> Approved 2026-10-30. Built in `components/garden/engine/garden.ts` (`buildForest`, `forestColors`) and `typeset.ts`. Mock: the "Meadow peaks: snow and tree line" canvas in Claude Design.

Conifers on the ridges, so the range has a forest below the rock and the eye can measure distance between the three ridges.

## Problem

The three ridges (`buildRidges`) were bare halftone silhouettes. They differed by colour and haze only, so at midday the far and middle ridges merged, and nothing in the landscape gave a sense of scale. Real ranges carry a forest up to a ragged tree line, with rock and snow above it. That banding (forest, rock, snow) is the strongest depth cue a mountain has, and the scene had none of it.

## Related

| Component     | Shared                                         | Missing                                                        |
| ------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| Grass tufts   | clumps of line glyphs with bare ground between | trees are rigid, upright and stacked by depth; they don't sway |
| Far flowers   | a bare motif with no tile, behind nearer heads | trees aren't subjects; they're a texture with an edge          |
| Land halftone | dithered fill on the painted ridge             | the forest needs a silhouette of its own: a serrated top edge  |

## Design

**Where trees grow.**

- **Middle ridge (layer 1):** a low, gently rolling band, forested along its crest, so its outline is a line of treetops. The old cliff-and-shelf profile read as a giant hump between the peaks; ridged knolls made the rows pile up on each one into a dark spiked pyramid.
- **Near ridge (layer 2):** five stands of tall spruce, at 5%, 31%, 55%, 66% and 90% of the range's width (the screen's on a wide screen; on a phone, the stretch of range it shows, so two or three stands), of 4, 3, 5, 3 and 5 trees, four and a half to ten cells tall, tallest in the middle of each stand. At up to thirteen the tallest stood too close. A stand is left out only where it would stand over the home page's bio; keeping them out of the text's whole column left none at all. The poem's text runs the full height of the scene, over the peaks too, so the poem keeps every stand. Each tree is a narrow tiered silhouette (three or more branch tiers, each flaring out then stepping in). Only stands, never a continuous row, so the flowers keep open sky behind most of them.
- **Near ridge's crest:** a low treeline runs the whole width along it, small spires (0.3 to 1 cell, two ranks) on a canopy a quarter cell up that rises up to about 1.5 cells in groves, in the front forest row's tone, easing into the ridge's colour toward the horizon so it meets the meadow without a seam. Bare, the crest ran under the forest as one smooth pale arc.
- **Far range (layer 0):** no forest. A thin band was tried; in the gaps between clearings it printed as flat-topped dark slabs standing on the middle ridge.

**Placed, not generated.** Where each row grows and where each stand stands are set by hand, as shares of the screen and range width (`FOREST_ROWS`, `SPRUCE_STANDS`). Noise-driven gaps put clumps in odd places.

**How it prints.** Forests are a painted silhouette like the ridges, with sparse glyphs over it. A first try with glyphs alone (one `^` per tree) was nearly invisible: a 7px caret in a colour close to the ridge's. Trees size to about one glyph cell per 1.25% of the screen height, or of 0.62 × the range's drawn width when that's smaller, so a stand doesn't tower over a tall phone's peaks.

| Where        | Painted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Glyphs                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------- |
| Near stands  | each tree's tiered outline in `*-pine` mixed 35% toward `*-ground`, the darkest mark on the land                                                                                                                                                                                                                                                                                                                                                                                                                            | `/` and `\` down the flanks, sparse `:` inside |
| Middle ridge | three staggered rows of low canopy, back to front, each starting lower on the slope than the one behind (0, 12% and 30% of the ridge's height). The back row runs the full width; the second covers 0–18%, 27–60% and 74–100% of it; the front 10–20%, 42–56% and 82–95% and one narrow spire per 2.6-cell slot (0.8–2, 0.9–2.3 and 1–2.6 cells tall). The back row is `*-pine` mixed 38% toward the ridge colour and 12% toward `*-haze`; the middle row 16% toward the ridge colour; the front row 14% toward `*-ground`. | sparse `^` and `                               | ` inside, none on the top row |

Each row has two ranks of spires, the second shorter (70%) and set between the first at 0.8 × the pitch, so crowns overlap and the row reads as a mass of trees, not a fence of single ones. The canopy rises by up to about a cell in groves every few trees, and only rises: groves that also dipped sank the canopy below the ridge's crest and bared it as smooth pale domes.

**The ridges under it.** The middle ridge's swell is shallow (±1% of the height, with a ±0.6% shorter roll), and the near ridge stays a low rise (1.6% ± 0.6%) under the middle crest. When the near ridge swelled to 5%, it hid the forest except for humps poking over it, and its edge read as one smooth arc.

Toward the end of a stretch, the spires drop out one by one and the canopy sinks into the ridge, so a stand thins to single trees. Don't round the band off: an earlier version lowered the whole band's top toward the ends and every short stretch read as a hedge-shaped mound.

No glyphs on the top edges: the painted silhouettes draw the serration. (Tried `^` tips along the top; they doubled the edge.)

Glyphs are the tree's colour mixed toward `*-cloud`. A tree wins its cell from the land behind it at any coverage, as plants do. The nearer ridges reset the material under them, so a forest or snow behind never shows through.

**Below it.** The near ridge's treeline meets the valley's far slope, which falls to the meadow's brow; a river comes out of the valley at the trees' foot (Horizon).

**Depth.** After the stippled tree drawing: densest and darkest nearest, sparser and paler farther back. Near stands are solid silhouettes; the middle forest is three tones with sparse marks. The haze pooled at the middle ridge's foot dissolves the forest's lower edge.

**By hour.** Trees are the darkest mark on each ridge at every hour, like `*-disc` in a flower. At sunset and twilight, with the sun behind the range, they go near silhouette. At night they sink almost to the ridge colour.

**Motion.** None. They're too far away to sway, and a still forest makes the meadow's wind read as closer.

## Tokens

New, per keyframe, in `palette.ts` and `tokens.json`:

| Token    | day       | golden    | sunset    | twilight  | night     | dawn      |
| -------- | --------- | --------- | --------- | --------- | --------- | --------- |
| `*-pine` | `#3c4744` | `#3d3a35` | `#2a1a29` | `#191322` | `#0f161d` | `#3a3f43` |

The palette's midnight keyframe takes `#06090d`. `*-pine` keeps the land's rule: little hue by day, a cool dark grey-green, never a saturated green.

## Rules it changes

- README, Legibility: "Nothing is planted on the hills" becomes "No flowers on the hills. The hills carry a forest (TreeLine) and snow (SnowCap); the farthest flowers sit on the meadow's back edge, small."
- README, The garden's glyphs: a **Trees** line. A painted serrated silhouette, darkest on its ridge, with sparse `^ |` inside and `/ \` down a near spruce's flanks.

## Accessibility

Decorative. No motion, so nothing changes under reduced motion.

## Verify

- At midday, the far and middle ridges read apart by the forest edge alone.
- The forest never prints as a solid block: gaps in the second and third rows show at 1440px and 1024px.
- 375px wide: the middle forest stays; the near stands appear only where the text leaves room.
- No near spruce prints over the bio's column.

## Open questions

- Near stands sit right behind the flowers. Flower stems now stop under where the trees start (see README, the garden's composition), but a near flower's head can still overlap a stand's base. Is that the right amount of overlap?
