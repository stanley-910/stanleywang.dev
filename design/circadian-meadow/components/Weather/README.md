# Weather

The meadow's weather: clear, rain, snow, storm, wind and eclipse, set from the site menu (SiteHeader) or the terminal's `meadowcontrol` event. A renderer rule, not a site component. It shows on home (`/`) and the poem (`/writing/poem`), lasts for the visit and isn't stored, so a reload is clear.

Built in `components/garden/engine/weather.ts` (colours, glyphs, particles, the eclipse), `ascii.ts` (how each cell takes them), `mount.ts` (wiring) and `lib/weather.ts` (the visit's weather). The set and its effects come from the Terminal spec's Meadow effects table; Stanley chose this set on 2026-10-31.

**Fog was cut.** It was built and removed at Stanley's request: it hid the scene, and its dither read poorly. Don't bring it back as a weather; a haze band is a palette change if it's ever wanted again.

## Related

| Component | Shared | Different |
|---|---|---|
| ShootingStar | overlay glyphs drawn on the main thread over the sky pass; a tile under the brightest glyphs; colours only from palette fields | weather overlays cover the whole scene, not the sky alone |
| SnowCap | snow's colours (`*-snow`, `*-snow-shade`), its crest colour, lit and shaded | snow on the meadow lies on plant tops and the ground, not on the far range |
| GlyphRamp, Garden | `*-disc`, the darkest mark in every flower head | the new moon's face is a solid tile of it, with no glyph showing |
| Bird | a silhouette over the sky | none of the weather is a silhouette |

## Rules

- **Colour from the palette only.** Every weather colour is a palette field of the hour, or a mix of the keyframes (`paletteAt` at a keyframe's own hour). No hex is picked by eye, and `tokens.json` gains no tokens, as with ShootingStar. When the garden's palette changes, the weather follows.
- **Cells only.** The sun and moon are glyphs, never a painted disc, and anything laid over them is cells too: glyphs and per-cell tiles, no painted gradients. The new moon's face is the one solid shape, a disc of dark tiles (Stanley's call on 2026-10-31: an eclipse should read as a black disc in a ring of light).
- **Palette changes move in steps** (24 for overcast, 12 for the storm's darkening, 60 for snow cover, 24 for the eclipse), so the cached backdrop repaints a few dozen times over a change, never every frame. Particles are capped and looped over, and move with the plant frames (40 a second, 30 when idle); only a lightning strike draws every display frame, for its second. Don't change step counts, caps or rates for a look; they're tuned for the Terminal spec's Performance budget.
- Nothing here touches the grid. The workers only see the tinted palette, posted with each frame as always.

## Effects

| Weather | What prints | Colour |
|---|---|---|
| Clear | nothing extra | |
| Rain | streaks 4–8 cells long, `,` head, `\|` body and `'` tail upright, or `\` with a `` ` `` tail once the wind leans them, a `.` where each lands; up to 560 drops. Wind rises a little (0.25). | drops `mix(fluff, snow, 0.5)`: cream by day (`#f0ecdf` at 12:00), salmon at sunset (`#f8ba9e`), blue-grey at night (`#b7c0d8`). The sky goes overcast (below). |
| Snow | flakes `· *`, the nearest with a `·` on each side; up to 520. Over a minute, a cap settles on the top cell of each head and stem, and the ground, grass and near ridge take a pale cover; it melts in 20 s. | flakes `snow`. Caps take SnowCap's crest colour, `snow` lightened 15% (`#f1efe8` at noon), recolouring the plant's own glyph by up to 0.8, with its tile turned toward `snow`. Cover: ground `snow-shade` 28%, grass dark `snow-shade` 35%, grass light `snow` 50%, stems `snow-shade` 20%, near ridge `snow-shade` 45%. Sky overcast at 0.7 of rain's. |
| Storm | rain, heavier, and a gale at 0.55. A bolt every 4–11 s: a jagged `/ \ \|` run from under the cloud to the ridges, three cells wide, its core lighting its tile; the sky's glyphs flash twice and fade in under a second. | bolt, its tile and the flash: `night-fluff` (`#e3e8ff`), the palette's coldest white. Flash lifts sky glyphs by at most 0.45 (`FLASH`), land glyphs by a third of that. Sky overcast and darker (below). |
| Wind | the wind past the slider's range (0.9 on the breeze); gust bands roll through as lit grass; petals and seed blow across low over the meadow, `~ , .`, up to 70. | grass under a band toward `grass-light` by up to 0.6, the pale undersides the README's Motion already names. Seed in `fluff`, `poppy`, `dandelion`, `lace`. |
| Eclipse, by day | over 12 s the new moon crosses the sun from up and right; near the end the scene goes to totality's light, the stars come out (`night` 0.85) and the corona holds: a solid ring of `:` on lit tiles hugging the moon's edge (to 1.1 of its radius), a glow of `·` streamers fading out to 1.6, and a diamond of `*` where the sun last showed, low on the left. Behind the ridges and treeline it sets like the sun. It leaves in 8 s. | see Eclipse colours |
| Eclipse, by night | Earth's shadow reddens the moon; the sky warms a little toward it (`sky-top` 25%, `haze` 20%). | `BLOOD`, below |

### Overcast

Rain and snow cloud: `mix(haze, hill-near, 0.45)`, the haze in the ridges' shadow, so pale falling marks read against it. A storm takes that 45% further toward `ground`. Sky top goes 55% of the way (85% in a storm), the horizon 35% (65%), clouds 30% (50%); the far ridge takes 20% of the new horizon and the near ridge 8%, so the range sits back in the rain.

### Eclipse colours

| Name | Derivation | Value |
|---|---|---|
| Totality's land and upper sky | halfway from `twilight-*` to `night-*`, the scene at about 20:45, for `sky-top`, `haze`, `cloud`, `hill-far`, `hill-near`, `ground`, `pine`, `grass-dark`, `grass-light`, `stem`, `snow`, `snow-shade` and the panel | `sky-top` `#161732`, `hill-far` `#2f2c4d`, `ground` `#0d0e16`, `snow` `#a291ac` |
| Totality's horizon | halfway from `golden-sky-horizon` to `sunset-sky-horizon` (the sunset an eclipse throws all round), a fifth into totality's sky top | `#b06545` |
| Flowers at totality | each flower field 45% toward totality's ground | |
| The ring and its tiles | `sunset-globe`, the sun at its most golden | `#ffc48f` |
| The glow beyond it | `sunset-sky-horizon`, the deepest orange in the sky | `#d4502e` |
| The diamond | the shooting star's head, `mix(fluff, globe, 0.4)`, at noon: `day-fluff` 60%, the day's globe 40%, a pearl white | `#ede8d6` |
| The new moon's face | `night-disc`, the darkest mark in the scene | `#0b0f17` |
| Earth's shadow on the moon | `sunset-sky-horizon` a third (35%) into `night-sky-top`: the moon lit only by the sunsets round the Earth's rim | `#8e3b2b` |

The new moon's face is a tile of its colour on every cell it covers, at the disc's strength (0.96 at totality), over the sun's glyphs, so the middle reads black. Earth's shadow fills the whole moon, since an eclipse only comes at full moon: the moon's own glyphs tinted, and `·` on a copper tile where it has none.

## States

| State | What shows |
|---|---|
| Changing | each effect eases in and out at its own rate: rain 3 s, snow and storm 4 s, gale 3 s, cover 60 s in and 20 s out, eclipse 12 s in and 8 s out |
| Reduced motion | a still state: overcast, snow lying, the eclipse at totality. Nothing falls, blows or flashes: no drops, flakes, seed, gust bands or bolt |
| Another page | the veil covers it as it covers the scene |

## Accessibility

Decoration: the canvas stays `aria-hidden`, and the menu's weather items carry the state (SiteHeader). Lightning flashes twice per strike, at most once every 4 s, and only the glyphs lift (no tile, backdrop or page flash), so it stays under the three-flashes-a-second limit and well short of a white-out. Under reduced motion there is no lightning. The bio sits below the horizon; flakes and drops cross it as the grass does, and the land behind it stays dark.

## Verify

- 13:00 and 23:00, 1440px and 375px wide: each weather from the menu, and from `meadowcontrol` (`{ kind: 'weather', value }`).
- Snow: caps read as snow on poppy and cosmos tops after a minute, the same white as the far range's crest; melts back in 20 s.
- Storm: a bolt reaches the ridges, the sky flashes and settles in under a second; no flash under reduced motion.
- Eclipse by day: a black disc in a gold ring, the glow and diamond beyond it; the horizon is copper all round. At 17:30 the disc and ring go behind the ridges and the treeline's pines. By night the whole moon goes copper.
- Change a keyframe in `palette.ts` and the weather's colours follow it.
- Performance: the Terminal spec's 4× CPU check holds in every weather; rain, snow and wind leave the page drawing at the plant rate.

## Not built

- The Terminal spec's 20 s eclipse event: the eclipse holds while it's selected.
- A storm doesn't dim the sun's glyphs.
- `season`.
- A `preview.html` card.
