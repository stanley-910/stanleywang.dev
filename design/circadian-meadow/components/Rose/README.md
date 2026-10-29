# Rose

One red rose, one stem, one head. It grows once, at the centre of the screen, on the poem page (`app/writing/poem`) when the line marked `@ rose` in the poem's plaintext scrolls in. It is the poem's only feature flower. It is a garden species (`components/garden/engine/plants.ts`), not a site component. Read it with GlyphSpecimen (size, outline, centre, stalk) and Garden/poppy-folds.md (one glyph per flap, one line per fold).

## As built

The rose shipped in `plants.ts` (`Rose`) keeps this spec's colours, sepals, thorns, compound leaves and ring-by-ring opening, and differs where checking it on a phone at night called for it:

- **Placement:** the head comes to rest about 0.64 H down, in the gap between the stanzas, where Stanley placed it, not 0.45 H. Stem `0.38 H`, head radius `0.15 ×` stem length, so about 32 cells across on a phone.
- **Leaves, sepals, stem and thorns print as bodies** (`Kind.Petal` with a fixed back-facing meta), not `Kind.Foliage` and `Kind.Stem`. As foliage and stalk they printed as faint grass at night and the rose read as a floating head. Their green is `roseLeaf` lifted toward `[112, 150, 92]`, more so after dark.
- **Rings:** three (outer 5, middle 5, inner 4), opening outer first over 7.5–13 s, with a dark heart disc and a spiral stroke in place of the core ring. Growth takes 13 s in all.
- **Trigger:** `poem.tsx` calls `rose(0.5)` from `mountGarden`'s `onReady` once the line's top enters the screen; flowers already near the centre fade out. A regrow (a big resize) loses it, and the next scroll grows it again.

## Problem and related species

The meadow's species are texture and small features. The poem needs one flower that reads as a rose from across a phone after dark. Poppy is the closest: it has a cup, folds and a bud with sepals. It doesn't fit as it is: four petals, a black eye, it nods, and it folds shut at night. Cosmos opens flat and Dandelion is a disc. The rose is a new `Plant` subclass, `Rose`, with `species: 'rose'`. It reuses `drawPetals`, `disc`, `Stem` and the typesetter, and adds no new material kinds.

## Placement and size

All lengths are in scene px. `W` and `H` are the scene's width and height (phone: 390×844 CSS px → about 609×1319 scene px, a 122-column grid of 5×7 cells).

- **Root:** `x = W / 2`, `z = 1` (nearest, no haze), at `floor(1)`, just under the bottom edge.
- **Head radius** `R = min(0.165 W, 0.085 H)`. On a phone that is 100 px: the head spans **40 cells and about 29 rows** (`feature-head`). On a 1440×900 desktop it is 119 px, or 48 cells. Never below 30 cells.
- **Stem** `length = 0.52 H`, so the stem tip sits at about 0.50 H and the head's visual centre at about 0.45 H. That is just above the horizon (0.55 H), so the head stands against the sky and the ridges, not on the horizon's brightest band.
- It isn't part of `regrow`, `maxPlants`, sowing or the life cycle (no shedding, seed or wither). After dark it is always the hero (`dim = 0`). It draws after the z=1 meadow strip, so grass never covers its stalk.

## Silhouette

The head is built in head space around `axis = headAxis(tip, facing)`, with `facing` going from 0.5 (side-on bud) to 1.05 (open, three-quarter toward the viewer, so you see into the cup and the swirl). Four `drawPetals` rings go into one depth list and are flushed together. Each ring starts half a petal spacing from the one outside it, so petals overlap like a rose's. Use ring seeds `s, s+5, s+10, s+15`: the petal-id formula, `(seed·7 + k) % 10 + 1`, then gives each pair of neighbouring rings different ids, so folds print between rings.

| Ring | Count | Length | Half-width `w(u)` | Cup `cup(u)` closed → open | Front colour |
|---|---|---|---|---|---|
| Outer guard | 5 | 1.0 R | `0.62R · sin(min(1, 1.05u)·π/2)` | `lerp(1.40, 0.55, o) − 0.45·o·u²` (the base cups, the tips roll back) | `rose` |
| Middle | 5 | 0.78 R | `0.50R · sin(min(1, 1.1u)·π/2)` | `lerp(1.45, 0.95, o)` | `mix(rose, roseDeep, 0.2)` |
| Inner | 4 | 0.55 R | `0.38R · sin(min(1, 1.1u)·π/2)` | `lerp(1.50, 1.25, o)` | `mix(rose, roseDeep, 0.45)` |
| Core bud | 3 | 0.34 R | `0.30R · sin(u·π/2)` | 1.52, always closed | `mix(rose, roseDeep, 0.7)` |

Every ring has `back = mix(front, roseDeep, 0.55)`, `crinkle` 0.08 (0.04 on the core), no notch and no blotch, and `hazeAmount` 0. `o` is that ring's open phase (below).

- **Heart, in place of a seed disc:** a `disc()` of radius `max(0.07R, 1.6·minLine)`, lifted `0.30R` along the axis, in `Kind.Disc`. Its colour is `mix(roseDeep, disc, 0.5)`, so its L is under .25 at every hour and it prints as the eye. Over it goes the **swirl**: one `Kind.Disc` stroke in the same colour, width `max(0.5, 0.03R)`. It is an Archimedean spiral of 1.25 turns, radius 0.06R to 0.28R, sinking from 0.30R to 0.20R lift, projected with `project()`. Push both with depth `+Infinity` once the outer ring's `o > 0.6`. Before that, sort them like the poppy's centre so the closed cup hides them.
- **Sepals:** 5, from a sixth `drawPetals` call with `kind: Kind.Foliage`. Length 0.55R, half-width `0.09R·(1 − 0.7u)` (tapered), crinkle 0.15 (feathery), colour `mix(roseLeaf, stem, 0.3)`. Cup goes from 1.45 (wrapped over the bud) to −0.45 (folded back under the head). While closed, draw them after the petals. From `sepal > 0.3` on, draw them before the petals, so they show only as the spikes below the head. Foliage has no tile, and drawn over petals it punches holes (poppy-folds).
- **Leaves:** two compound leaves on petioles, a new `drawLeaf` style, `'pinnate'`. Leaf A sits at joint 5 of 12, `side −1`, angle 0.9, petiole 0.5R, with 5 leaflets (a terminal and two pairs). Leaf B sits at joint 8, `side +1`, angle 0.8, petiole 0.38R, with 3 leaflets. The terminal leaflet is 0.42R long and the laterals 0.34R. Each leaflet is an ovate blade, max half-width 0.4 × its length, with a saw edge of 7 teeth a side, depth 0.18 × half-width (N = 14 midrib steps, alternating `1 / 0.82`). They are filled in `Kind.Foliage`, colour `roseLeaf`.
- **Thorns:** 3, at joints 3, 6 and 9 on alternating sides. Each is a hooked stroke 0.07R long (about 1.5 cells) leaving the stem at 0.9 rad and curving 0.3 rad toward the ground. `Kind.Stem`, width `minLine`, colour `mix(stem, roseDeep, 0.35)`. A thorn shows only once the stem has grown past its joint.
- **Stem:** `Stem(12)`, stiffness 1.6, drag 1, `headMass` 0.12 open (0.06 as a bud), `headDrag` 0.35. It is drawn at width `max(2.2, 0.04R)`, colour `stem`, and leans `±0.04` with a rest curve of `0.25·(1 − open)` toward `side` (a slight bud nod, gone once it opens).

## Growth

Rose time `t` starts at the trigger and runs for `duration-rose` (10 s). `ss(a, b)` is `smoothstep(a, b, t)`.

| Phase | When (s) | What moves |
|---|---|---|
| Stem rises | 0 – 3.2 | `growth = 0.06 + 0.94·ss(0, 3.2)`. The closed bud rides the tip from the start, `budScale` 0.25 → 0.45. |
| Leaves unfurl | 1.4 – 4.2 | Leaf A first, then leaf B 0.6 s later. Each grows its petiole, then its leaflets: width × `grow²`, so they open after they lengthen. |
| Bud | 2.4 – 3.8 | Closed, sepals wrapped. `budScale` → 0.6, `facing` holds 0.5. From 3.0 a red seam shows between the sepals (a `Kind.Petal` sliver, alpha `ss(3.0, 3.8)`), as on the poppy. |
| Sepals part | 3.6 – 5.6 | `sepal = ss(3.6, 5.6)`: cup 1.45 → −0.45, the sepals splay and turn down. |
| Petals open | 5.0 – 9.8 | Ring by ring, outward: inner `o = ss(5.0, 7.5)`, middle `ss(5.8, 8.6)`, outer `ss(6.6, 9.8)`. The core never opens. Head `R × lerp(0.6, 1, ss(5.0, 9.8))`, `facing` `lerp(0.5, 1.05, ss(5.0, 9.8))`. |
| Settle | 9.8 – 12.8 | Damping eases from `SETTLED` (0.9) to `SWAY` (0.35) over 3 s. Hold the stem at 0.9 for the whole growth, so it rises and opens without a bounce. |

After that it sways in the wind like the others, heavy-headed. At the poem's wind (0.6) the head's centre should drift no more than 0.03 W. If it drifts more, raise the stiffness and keep the damping. It stays open at night: no `night` fold, unlike the poppy and cosmos. It never sheds.

- **Trigger:** once per visit, when the line's centre first rises above 80% of the viewport height. Expose it as `garden.growRose()`; `poem.tsx` calls it. A reload or a scroll that lands past the line shows it grown with no growth. Scrolling back up doesn't regrow it.
- **The gap:** put an `@ gap` after the line, tall enough that the head's box plus 14 cells of padding (about 45 CSS px a side on a phone) is clear of text while the line stands above it: at least 75svh. Later lines scroll over the rose, and the existing text fade (`dimPlant`) steps it back. There is never a scrim.
- **Reduced motion:** it appears fully open at the trigger and is drawn still.

## Colour

New scene tokens: `*-rose` (outer petals), `*-rose-deep` (inner petals, backs, and the heart mixed with `*-disc`) and `*-rose-leaf` (leaflets and sepals). They are in `tokens.json`, and palette.ts gets `rose`, `roseDeep` and `roseLeaf`. Unlike `*-poppy`, which turns violet at night, these stay crimson at every hour. They step down a little after dark, because the typesetter multiplies tiles by `ink` (1.1 at night, 1.25 at midnight) and undoes the bloom shading. Sunset's rose is cooler and darker than `sunset-sky-horizon`, so it stands off the blood-orange instead of melting into it.

| Keyframe | `rose` | `rose-deep` | `rose-leaf` |
|---|---|---|---|
| day | `#b3243a` | `#5e1220` | `#56664a` |
| golden | `#bc2633` | `#66141e` | `#5f5e43` |
| sunset (DUSK) | `#c41e3a` | `#6a1024` | `#4a4536` |
| twilight | `#cc2840` | `#5c0f26` | `#3a4240` |
| night | `#a8263c` | `#4e1424` | `#34443a` |
| midnight (palette.ts only) | `#a82238` | `#521222` | `#263529` |
| dawn | `#a8303e` | `#581620` | `#56644e` |

palette.ts has a MIDNIGHT keyframe that tokens.json doesn't, and the poem ends at 0:00, so set it too. `harness/tokens.css` is already out of step with tokens.json (its poppies differ). It doesn't need these tokens until a preview card exists.

## Glyphs

All through the existing typesetter. No new ramps are needed.

| Part | Kind | Glyph | Ink / tile |
|---|---|---|---|
| Head outline | Petal | `- \ \| /` along the rim | Existing rim rule: 70% toward the contrasting ink, half as far after dark, so the edge prints paler than the petal. |
| Petal flaps | Petal | `FOLD` by light: `.` `:` `=`, `#` for a back. One lighter after dark. | Ink 70% toward `ground`. The tile is the ring's colour, un-shaded at night. |
| Folds between petals and rings | Petal | `- \ \| /` on the lit side | 85% toward `ground`. On the core and inner rings these curved folds are the swirl's outer turns. |
| Heart and swirl | Disc | `@` where covered over 60%, else `#` (a curl of `#` round an `@`) | The eye rule: ink 50% toward `ground`, tile in its own colour. It is the darkest mark in the head. |
| Sepals | Foliage | `\ \| /` along their run | No tile. Only beyond the petals once parted. |
| Leaflets | Foliage | Edges along the run. Interiors take the `FOLIAGE` ramp ` .,':;!\|`. The teeth show as a ragged `,'` edge. | No tile. |
| Stem and thorns | Stem | `\|` up the stalk. Thorns as one `/` or `\` off it. | The existing night lift toward the moonlit haze. |

Add `rose` to `MOTIFS` in typeset.ts so the `Head['species']` type holds: tiny `(@)` / `ldl`, small `' .-. '` + `'((@))'` / `' lll '` + `'lpdpl'`. It never prints at that size, but `r.heads.push` with `species: 'rose'` keeps far motifs off its cells.

## Verify

- **Phone, 390×844, at 18:50, 20:10, 21:30 and 23:55:** the head spans 38–42 cells, and a stranger would call it a red rose at arm's length. It shows the reflexed outer petals, the cupped middle, the `@`/`#` swirl at the heart and the sepal spikes under it. It's red, not pink or violet, at 23:55, and not the brightest glare on screen.
- **Desktop, 1440×900:** the head is 48 cells or fewer, centred, and its stem is a continuous `|` from the bottom edge.
- **Cell dumps** (as in poppy-folds) at 12:00 and 00:15: each flap is one fill glyph, folds are single lines, and nothing in the heart prints `O` (that would mean its L went over .25).
- **Growth:** the stem rises without overshoot, the leaves open after they lengthen, and the sepals splay and turn down before any petal moves. Rings open inner first and outer last. The settle into the sway has no visible kick at 9.8 s.
- **Trigger:** it fires once; reload past the line shows it grown; scrolling up and down doesn't regrow it; with reduced motion it appears open and still.
- **Text:** while the line stands above the gap, no poem text is within 14 cells of the head. When later lines cross it, the rose steps back behind them and they stay legible.
- `npx tsc --noEmit` and `npx eslint` are clean on plants.ts, palette.ts and typeset.ts.
