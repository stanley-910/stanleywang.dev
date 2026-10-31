# Weather

The meadow's weather: clear, rain, snow, storm, sunshower and eclipse, set from the site menu (SiteHeader) or the terminal's `meadowcontrol` event. A renderer rule, not a site component. It shows on home (`/`) and the poem (`/writing/poem`), lasts for the visit and isn't stored, so a reload is clear.

Built in `components/garden/engine/weather.ts` (colours, glyphs, particles, the eclipse), `ascii.ts` (how each cell takes them), `mount.ts` (wiring) and `lib/weather.ts` (the visit's weather). The set and its effects come from the Terminal spec's Meadow effects table; Stanley chose this set on 2026-10-31.

**Wind was cut** on 2026-11-01, at Stanley's request: it was the breeze turned up, too little change for a weather. The storm keeps its gale, gust bands and blown seed (`gale` 0.55; the band and seed code serve it), and the terminal's `wind` command still sets the breeze.

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
- **Palette changes move in steps** (24 for overcast and the storm's darkening, 60 for snow cover, 64 for the eclipse), small enough that no step reads as a tick and few enough that the cached backdrop repaints a few dozen times over a change, never every frame. Particles are capped and looped over, and move with the plant frames (40 a second, 30 when idle); only a lightning strike draws every display frame, for its second. Don't change step counts, caps or rates for a look; they're tuned for the Terminal spec's Performance budget.
- Nothing here touches the grid. The workers only see the tinted palette, posted with each frame as always.

## Effects

| Weather | What prints | Colour |
|---|---|---|
| Clear | nothing extra | |
| Rain | streaks in depth: far drops are short, slow and faint in the haze and land toward the horizon, behind the flowers; near ones are up to 9 cells long and land at the bottom. `,` head, `\|` body and `'` tail upright, or `\` with a `` ` `` tail once the wind leans them, a `.` where each lands, on a cell its own light lifts for a moment (a faint tile, fading over the splash, so the hit reads among the grass's glyphs), with two `'` droplets thrown up beside it for all but the far drops. Flowers keep the rain out: no streak, splash or lit cell prints on a petal, stem or head (`weather.wet`, checked in ascii.ts against the plant flag; the sun and moon still take it). In their place rain's air is unsteady: a push either way of 2% of the wind's range, varying along the meadow and over time (`wind.unsteady`), so the heads waver. Stanley, 2026-10-31: drops knocking the heads read as too much even when gentle. Up to 960 drops (560 read too thin by day; Stanley raised it on 2026-10-31, and the weather paint stays near 0.1 ms a frame). Wind rises a little (0.25). | drops `mix(fluff, snow, 0.5)` where the sky behind them is dark: salmon at sunset (`#f8ba9e`), blue-grey at night (`#b7c0d8`). On a pale overcast, by day, they go up to 65% toward `ground`, a touch stronger and longer, since cream on pale grey didn't show (`hill-near` didn't either: the overcast is mixed from it). Far drops sink 55% into the haze at night, 30% by day. Over the land, dark at every hour, drops, splashes and their tiles stay the pale `mix(fluff, snow, 0.5)` (far ones 45% into the haze), a little stronger than in the sky; the dark daytime drop is for the sky only. The sky goes overcast (below). |
| Snow | flakes in depth: far ones `.` in the haze, slow; middle ones `·` and `o`; the nearest are small clumps, an `@` on a lit tile with a faint `·` beside it (the very nearest with a fainter `o` below; two cells by two read too thick), with a faint `.` trail above, quicker and swaying wider. Each lies where it lands for about a second (0.8–1.6 s), still and one row deep with no trail, then melts over half a second (Stanley, 2026-10-31: snow should sit before it melts). A star is a single point and never moves, so no flake is a lone `*` or a cross. Up to 520. Over 20 s, a cap settles on the top cell of each head and stem, and the ground, grass and near ridge take a pale cover; it melts in 8 s. | flakes `snow`. Caps take SnowCap's crest colour, `snow` lightened 15% (`#f1efe8` at noon), recolouring the plant's own glyph by up to 0.8, with its tile turned toward `snow`. Cover: ground `snow-shade` 28%, grass dark `snow-shade` 35%, grass light `snow` 50%, stems `snow-shade` 20%, near ridge `snow-shade` 45%. Sky overcast at 0.7 of rain's. |
| Storm | rain, heavier, and a gale at 0.55: gust bands roll through as lit grass (toward `grass-light`, up to 0.6 under a full band), and petals and seed blow across low over the meadow, `~ , .` in `fluff`, `poppy`, `dandelion` and `lace`, up to 70. A bolt every 4–11 s, drawn fresh each time: it starts in the thickest cloud at its own distance (a near bolt out of cloud high overhead, a far one out of cloud low over the ridges, so bolt and cloud sit on one plane), never by the sun or moon, and walks down in a jagged `/ \ \|` run with the odd `-` jog, forking now and then, each fork leaning away from the channel it left. Most go to the ground; some stop in the air. Far bolts are thin, dim through cloud and stop behind the ridges and treeline; near ones are up to three cells wide and pass in front. Each strike has one to three return strokes 0.1–0.25 s apart. Between bolts, the cloud brews: every 1.5–4.5 s the cloud's own glyphs light from within, two to four quick pulses through a spread wider than tall, so the light takes the cloud's shape; sometimes a short jagged channel crawls through it. No tiles light there: on the cloud's dither they print a checkerboard. The sky's glyphs flash and fade in under a second. | each strike or flicker picks its colour between `night-fluff` 30% toward `night-cosmos-vein` (a violet blue) and `night-fluff` 75% toward `golden-globe` (a yellow white): bluer near and at night, yellower far off and while the sun is up, with a little chance either way. Its bolt, tile, cloud light and flash all take it. The site menu's lightning slider, shown under the weather in a storm and built like the hour's, sets it by hand: its track runs that violet blue, through the yellow white, to `golden-globe` itself, the warmest gold (`lightningAt`). Set, each strike stays near the chosen colour, a little warmer far off; `auto` hands it back to the hour. Like the weather, it lasts for the visit. Flash lifts sky glyphs by at most 0.45 (`FLASH`), land glyphs by a third of that. Sky overcast and darker (below). |
| Sunshower | light rain out of a clear sky: a third of rain's drops (0.35), no overcast, a breeze a touch up (0.1) and the air half as unsteady as rain's. A bow stands across the sky from the sun (or moon): six bands, a little over a cell deep each, centred at 0.7 or 0.3 of the width (whichever side the globe isn't), rising from 0.12 of the height below the horizon with a radius of 0.78 of the horizon's height, so only its arch shows above the land. `o` in the four middle bands, `:` on the two edges, softer toward its feet; the ridges, trees and flowers stand in front (flowers keep it out as they keep out rain). Glyphs only, no tiles: the tile colour is one per frame. It comes up over 4 s, after the rain, and goes in 2 s. Stanley picked it to replace wind on 2026-11-01: it works at every hour. | bands, outside to in: `day-poppy`; `day-poppy` 50% toward `day-dandelion`; `day-dandelion`; `day-rose-leaf` 40% toward `day-grass-light`; `day-sky-top` 50% toward `night-cosmos-vein`; `night-cosmos-vein`. Strength 0.9. By night a moonbow: each band 75% toward `mix(night-fluff, night-snow, 0.5)`, at half the strength. |
| Eclipse, by day | over 5 s the new moon crosses the sun from up and right; near the end the scene goes to totality's light, the stars come out (`night` 0.85) and the corona holds: a ring of `:` on lit tiles, one cell wide, on the moon's edge, and a glow fading smoothly out to 1.55 of its radius, a little longer along four streamers. The glow is light on tiles under faint `·` of the same colour, so it reads as a haze, not dots. Behind the ridges and treeline it sets like the sun. It leaves in 4 s. | see Eclipse colours |
| Eclipse, by night | Earth's shadow reddens the moon; the sky warms a little toward it (`sky-top` 25%, `haze` 20%). | `BLOOD`, below |

### Overcast

Rain and snow cloud: `mix(haze, hill-near, 0.45)`, the haze in the ridges' shadow, so pale falling marks read against it. A storm takes that 45% further toward `ground`. Sky top goes 55% of the way (85% in a storm), the horizon 35% (65%), clouds 30% (50%); the far ridge takes 20% of the new horizon and the near ridge 8%, so the range sits back in the rain.

### Eclipse colours

| Name | Derivation | Value |
|---|---|---|
| Totality's land and upper sky | halfway from `twilight-*` to `night-*`, the scene at about 20:45, for `sky-top`, `haze`, `cloud`, `hill-far`, `hill-near`, `ground`, `pine`, `grass-dark`, `grass-light`, `stem`, `snow`, `snow-shade` and the panel | `sky-top` `#161732`, `hill-far` `#2f2c4d`, `ground` `#0d0e16`, `snow` `#a291ac` |
| Totality's horizon | halfway from `golden-sky-horizon` to `sunset-sky-horizon` (the sunset an eclipse throws all round), a fifth into totality's sky top | `#b06545` |
| Flowers at totality | each flower field 45% toward totality's ground | |
| The ring, the glow and their tiles | `sunset-globe`, the sun at its most golden | `#ffc48f` |
| The globe at totality | the shooting star's head, `mix(fluff, globe, 0.4)`, at noon: `day-fluff` 60%, the day's globe 40%, a pearl white | `#ede8d6` |
| The new moon's face | `night-disc`, the darkest mark in the scene | `#0b0f17` |
| Earth's shadow on the moon | `sunset-sky-horizon` a third (35%) into `night-sky-top`: the moon lit only by the sunsets round the Earth's rim | `#8e3b2b` |

The new moon's face is a tile of its colour on every cell it covers, at the disc's strength (0.96 at totality), over the sun's glyphs, so the middle reads black. Earth's shadow fills the whole moon, since an eclipse only comes at full moon: the moon's own glyphs tinted, and `·` on a copper tile where it has none.

## States

| State | What shows |
|---|---|
| Changing | each effect eases in and out at its own rate: rain and gale 1.5 s, snow and storm 2 s, cover 20 s in and 8 s out, eclipse 5 s in and 4 s out, a sunshower's rain 1.5 s and its bow 4 s in and 2 s out (Stanley, 2026-10-31: gradual, but less waiting) |
| Reduced motion | a still state: overcast, snow lying, the eclipse at totality, a sunshower's bow. Nothing falls, blows or flashes: no drops, flakes, seed, gust bands or bolt |
| Another page | the veil covers it as it covers the scene |

## Accessibility

Decoration: the canvas stays `aria-hidden`, and the menu's weather items carry the state (SiteHeader). Lightning flashes at most three times per strike (its return strokes, 0.1 s or more apart), a strike at most once every 4 s, the cloud's flickers softer and local, and only the glyphs lift (no tile, backdrop or page flash), so it stays under the three-flashes-a-second limit and well short of a white-out. Under reduced motion there is no lightning. The bio sits below the horizon; flakes and drops cross it as the grass does, and the land behind it stays dark.

## Verify

- 13:00 and 23:00, 1440px and 375px wide: each weather from the menu, and from `meadowcontrol` (`{ kind: 'weather', value }`).
- Snow: caps read as snow on poppy and cosmos tops after 20 s, the same white as the far range's crest; melts back in 8 s.
- Storm: bolts differ each time, start in cloud away from the sun and moon, far ones stop behind the ridges; the cloud flickers between bolts; the sky settles in under a second; no flash under reduced motion.
- Rain: drops far off land at the horizon behind the flowers; near drops splash and tip the heads they hit. Snow at 23:00: the near flakes read as clumps, not stars.
- Eclipse by day: a black disc in a thin gold ring, a smooth glow beyond it, nothing sticking out of the ring; no colour step visible as it comes in; the horizon is copper all round. At 17:30 the disc and ring go behind the ridges and the treeline's pines. By night the whole moon goes copper.
- Change a keyframe in `palette.ts` and the weather's colours follow it.
- Performance: the Terminal spec's 4× CPU check holds in every weather; rain and snow leave the page drawing at the plant rate.

## Not built

- The Terminal spec's 20 s eclipse event: the eclipse holds while it's selected.
- A storm doesn't dim the sun's glyphs.
- `season`.
- A `preview.html` card.
- Snow on the far range: the rock's dark outline still shows behind the cap. An open issue, with what was tried, in SnowCap's Open questions.
