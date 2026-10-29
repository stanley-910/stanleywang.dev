# Poppy folds

How a poppy's petal folds, its cup, and its loose petals print in the garden's glyphs. A renderer rule, not a site component: it lives in `components/garden/engine/ascii.ts` (the per-cell printer), `particles.ts` (loose petals) and `raster.ts` (the petal markers). Read with GlyphSpecimen, which sets the four things a flower needs to read at all (size, outline, centre, stalk); this spec adds the fifth, the folds, and fixes what Stanley saw in the loose pieces and the centres.

## The problem

When a poppy faces the viewer, its four petals print as one orange blob with a darker half. The flaps can't be told apart and there is no cup to see into. Three more things Stanley asked about are the same subject:

- Loose petals: "i still don't understand what these orange petals that look kinda invisible are meant to be? are they petals?" They are the petals that float off a shedding poppy, shown after they land.
- Sepals: "what are these things that float down from the sky? that lie between the two white flowers". Two sepals drop when a poppy opens.
- A cosmos at night: "whats this middle black part of the flower? same bug?"

What the cells showed, on a 31-cell poppy facing the viewer (facing 0.95, the most a poppy turns) at 12:00:

- **Light is one value per petal**, set in `bloom.ts`, but the fill glyph was picked per cell from an eleven-step ramp with a ±0.17 dither. Each flap printed as a checker of three or four glyphs (`'-:=` on a shaded flap, `-+-*=` on a half-lit one). The rule also flipped at the horizon: dark ink above it (dense = shade), cream ink below (dense = light), so one head straddling the horizon printed by two rules.
- **Light shaded the tile twice.** `bloom.ts` shades the raster colour by 0.62..1.17, and since 40c6078 `ascii.ts` shaded the tile by light again. The flaps had plenty of tile contrast (L .25 against L .56) and still merged, because at this facing two flaps sit in shade and two in light and each pair matches. At midnight the double shading turned the poppy maroon: #722837 (L .22) and #411420 where the palette says #f55574.
- **The fold between two flaps was a few scattered `|`.** Seams printed only on cells covered 70% or more, from four neighbours, as `|` or `-` only, on the darker side; and a cell split evenly between two petals got no petal id, which broke the line. Those `|` sat in a field of the same `|-` glyphs as the fill.
- **The centre was a 5×4 block of `@`.** Ring, blotch and stigma all came under the dark-eye threshold (L < .35), so the pale green stigma (L .35) printed like the black stamens, on one grey tile.
- **Loose petals had no tile**: `'.'.'` specks and a `+` edge in the petal's own colour (ink L .2) on dark ground. Landed, they were a 3×3 speck for 9 seconds.
- **Sepals** were a `Kind.Foliage` ellipse two cells across, printed `\|//`: a tuft of grass falling out of the sky.
- **The dark-eye test caught things that aren't eyes.** At the NIGHT keyframe (22:00) a cosmos's inner disc, yellow dimmed by haze and night, measured L .38–.40 at z .3, within .03 of the threshold; hazier heads cross it and print `@` on a tile lifted toward the haze, slate at 22:00 and black at midnight. A poppy's seed capsule (L .2–.3) crossed it too and printed a 3×2 `@@` slate block beside whatever flower stood next to it.

## The rules

One tone per flap, one line per fold, ink darker than the tile. Light lives in the glyphs; the tile is the petal's colour.

### A flower head

| Part | Glyph | Ink | Tile |
|---|---|---|---|
| Front flap, lit (light ≥ .6) | `.` | petal colour, 70% toward `ground` | petal colour, 70–85% |
| Front flap, half-lit (.3–.6) | `:` | same | same |
| Front flap, turned from the light (< .3) | `=` | same | same |
| Back flap (its back toward the viewer) | `#` | same | same (the raster already uses the darker back colour) |
| Fold between two flaps | `- \ \| /` along the fold | petal colour, 85% toward `ground` | the flap's tile, unchanged |
| Rim | `- \ \| /` along the outline | as now: 70% toward the ink that contrasts with what's behind (`ground` on a bright sky, cream otherwise), half as far after dark | 0.7 × the flap's tile |
| Blotch and stamens (the eye: L < .25) | `@` where the cell is over 60% covered, else `#` | own colour, 50% toward `ground` | own colour, lifted 40% toward `haze` by day and not at all at night, 75% |
| Stigma (L ≥ .25, touching petal) | `O` / `o` | own colour × 0.7 | own colour, 75% |

Across the day:

- **Day.** The tile keeps the light `bloom.ts` gave the petal (×0.62..1.17), so the flaps differ a little in colour as well as in glyph. Poppy #c95a32 prints as tiles from #994728 (L .34) to #dc663c (L .49); ink L .25–.33; fold ink L .14.
- **Dusk (17:30).** The same, warmer: #a3411a to #ea5e27, ink L .25–.32.
- **Midnight.** Poppies fold for the night (drawn open 0.2), so a head is a tight cup, the near wall facing out and the far wall's inside showing. The tile un-does the bloom shading (×1/(0.62 + 0.55·light), by `night`), so the tile is the palette's poppy, #f55574 before `dim`, and the flower stays the brightest thing in the scene. Glyphs step one lighter: `.` `.` `:` `=` for lit, half-lit, shaded, back, so the ink doesn't dull the flap. The eye's tile stays its own near-black: `*-disc` is the darkest mark in every head, and at night so is the ground around it.

The fold rule in detail:

- The fold prints on the **lighter** flap's cells only, so it is one cell wide and the dark line sits where it shows. Equal light goes by petal id.
- Its direction follows the run of the boundary: the direction from the cell to the darker flap's cells among its eight neighbours, turned a right angle, snapped to `- \ | /`. A head facing the viewer has radial folds, so most print as `/` and `\`.
- Only on cells covered 50% or more, with a neighbour covered 50% or more, on heads with 26 or more petal cells in the 7×5 window around the cell (about 8 cells across and up). Smaller heads keep their rim and fill only, as before.
- A cell split between two petals goes to the one with more of it (it used to get no id and break the line).
- No dither on fills. A flap is one glyph.

Why the glyph bands are coarse: with cells 5×7 scene px, a flap is 30–120 cells. Three fill glyphs plus one for the back are enough to tell flaps apart and leave the fold lines as the only lines inside the head. More steps bring the checker back.

### Loose pieces

| Piece | Glyph | Ink | Tile |
|---|---|---|---|
| Petal in the air | rim `- \ \| /`, inside `.` | rim 70% toward the contrasting ink; inside 50% toward `ground` | petal colour, 35%, so a flower it crosses still shows |
| Petal on the ground | the same | the same | petal colour, 70%: a body, like the flaps on the flower |
| Sepal | not spawned | | |

- A falling petal is the shape it has now: an ellipse that turns broadside and edge-on as it tumbles, `s = 0.7 × size`. With the thin tile and a line rim it reads as a petal shape in the air, not specks.
- A landed petal lies down: `rx = s`, `ry = 0.38 s`, tilted at most ±0.25 rad, so it's a wide flat lozenge, 3 rows tall for a near poppy. It lies for 9 s and fades over 3 s, as now. (If Stanley wants petals to collect under a shedding poppy, lengthen the lie to 20 s; nothing else changes.)
- Both are `Kind.Fluff` with a marker in the meta layer: `LOOSE_PETAL` (light 0, back) in the air, `LANDED_PETAL` (light 1, back) on the ground. The printer reads `back` as "loose petal" and `lit > .5` as "landed". Lace and dandelion fluff (`FLOWER_FLUFF`, light 1, not back) are untouched.
- Sepals: two grey-green chips two cells across can't read as anything but a bit of grass at this grid. Decided (Stanley, 2026-10-29): they're gone; the poppy no longer spawns them and the `sepal` particle type is removed. The bud still splits its two sepal halves on the head in `drawBud`, which is where the botany shows.

### Other centres

The eye test moves from L < .35 to L < .25. Every `*-disc` colour is at or under L .04, so the poppy's stamens, blotch and ring stay eyes. A cosmos centre dimmed by haze and night (L .3–.45) prints `O`/`o` on its own yellow-grey tile, and a seed capsule (L .2–.3) no longer prints as an eye when it isn't next to petals.

## What I tried and saw

Method: a test poppy planted at z .9 facing 0.95, cell dumps of glyph, kind, petal id, light, tile colour and alpha, ink colour, at 12:00, 17:30 and 00:15, in a 1024×768 window (grid 256×138, cell 5×7 scene px). Screenshots are too coarse to show cells, so they served only to check the whole scene.

- Before: see the dumps below. The 31-cell head printed as two checkered dark flaps, two dense light flaps and a block of `@`. The one fold cue was a column of `|` inside the same glyphs.
- After the first pass (ink 50% toward ground): three flat flaps with continuous `|` and `/` folds and the stigma showing as `O`. The ink sat at L .30 on a tile of L .34, too close to read as ink on the tile once the tile's 70% alpha is counted. Moved the fill ink to 70% toward ground and the fold ink to 85%.
- Day tile shading: dropping `ascii.ts`'s second shading leaves the tile range at L .34–.49 instead of .25–.56; the flaps still read, because the glyph now carries the difference. Kept `bloom.ts`'s shading by day so the tile isn't dead flat.
- Midnight: un-doing the bloom shading in the tile put the poppy back at #d04964 (near outside) and #932c46 (far inside) from #722837 and #411420. In the midnight screenshot the poppies went from maroon to pink-red; the cosmos stayed lavender. The un-shading is prototyped in `ascii.ts` because it's one line there; the proper home is `bloom.ts`, where `shade(base, 0.62 + 0.55 * light)` should narrow toward 1 as `night` rises. Same picture either way.
- Side-on (facing 0.3) and a 17-cell head (z .5) at noon: the cup prints with `::::` on the near wall, `####` on the far wall's back, `....` on the lit flap and `--\`, `/\\` folds between; the smaller head keeps its folds too. The `####` back wall is the heaviest part of a side-on cup; if that reads too dark, the back glyph can drop to `=` with nothing else changing.
- Loose petals: a falling petal at age 2.5 s printed as an outlined lozenge over a 35% tile with a flower head showing through it; the landed one as a 15-cell-wide, 3-row lozenge on the floor.
- Cosmos at night: at 00:15 (MIDNIGHT keyframe, dandelion #ffd36a) centres are far above the old threshold; at 22:00 (NIGHT, #a9a77a) the inner disc of a cosmos at z .3 measured L .38–.40, within .03–.05 of it. The black patch Stanley saw is either a hazier cosmos crossing that line or a poppy capsule beside the cosmos, which did cross it in my cells. The lower threshold clears both.

## Before and after, one poppy facing the viewer

Same test poppy at each hour: 31 cells across at noon and dusk, 20 at midnight (folded). Glyph grids; `·` is land halftone around the head.

### 12:00

Before:
```
| · · / =*=+=*=+--:=|*=+=*=--\\  -|-/ 
 · ·  /·\:=-+:=--':'|:=-+:=-+:=   |  |
  |/·/.  +-*-|:=:-:=-+-*=+-*=+-  |·: |
 .|./  . .||-'-'-'-'=-+-+-+-+-/. | . |
    / : ./-=:=:=:=:=:*=+=*=+=/; ;|  | 
 . / .  -':'-':'-':'-:=-+:=-+%/%|| .|.
  .|  |=:-:=:-:=:-:|-+-*=+-@@@@@ /  | 
 .|. .|'-'-'-'-'-'-@--+--*@%@%@/|.  /.
  |    \\=:=:=:=:@@=:@@@%@@@@@@ |  |  
 | . . . ':'-':@@@@:@@@%@%@%@/;.|. | .
 |     |  \\--@@@@:@@@@@@@@@@/: | /!\/
|  .   |   .  |*%#%x@@@%@%@%/.  |/|+!\
|           /@#@#@#@#@#@#-@|;  | | ; |
 . . . . :::|------\@#@#@#%/:::| . . -
```
After:
```
| · · / ::::::/--====|:::\---\\  -|-/ 
 · ·  /·\:::/--======|:::::::::   |  |
  |/·/.  :/--=======:|:::::::::  |·: |
 .|./  . .|:========:|::::::::/. | . |
    / : ./==========:|:::::::/; ;|  | 
 . / .  ============:/:::::::./.|| .|.
  .|  |=============/|:::::./... /  | 
 .|. .|============@=\:::./..../|.  /.
  |    \\========@@==@@@--/.... |  |  
 | . . . ======@@@@:@@@....../;.|. | .
 |     |  \\--@@@@:/@@@....../: | /!\/
|  .   |   .  |..\--@@@---\./.  |/|+!\
|           /.............-|;  | | ; |
 . . . . :::|------\---..../:::| . . -
```

| flap | light | before: tile, ink | after: tile, ink, glyph |
|---|---|---|---|
| left (7) | .26 | #74351e L .25, #c1937f L .61, `'-:=` checker | #994728 L .34, #553d33 L .26, `=` |
| right (8) | .42 | #8f4226 L .32, #bc8973 L .57, `-+-*=` checker | #a84e2d L .37, #533b30 L .25, `:` |
| bottom (9) | .98 | #f77746 L .56, #d59b83 L .65, `@%@` | #dc663c L .49, #6a4f43 L .33, `.` |
| inner (6) | .83 | #cf633b L .47, `@#@#` | #c35f39 L .45, `.` |
| eye | | #68655d L .39 tile, `@` block | same tile, `@` with `O` for the stigma where it lands on a cell |

### 17:30

Before:
```
. . · ·|:=:=:=:=.:.:|=:=---\\ : |::|
|.   .  +-+-+:|-:'-'--+-+-+-+-\ /· |
| . . . .\:=|-.:.:.|:=:=-=:=-=-|. .|
:\        |--'-'-'-|+-+-+-+-+-/|   |
. . . . //.:.:.:.:.|:=:=:=:=-|;|.  |
      /':'-':'-':'-|+-+-+-+|@@@|  |;
  .   ':.:.:.:.:.:.|-=:=-=%@%@/   |O
       \-'-'-'-'-@@'+-+|@@@@@/|   | 
. . . . .:.:.:.@@@-:@@#@%@%@%|| /|. 
  |      \\-:@@@@|-@@@@@@@@@!/|| |::
```
After:
```
 · . .|:::::/--=====|::::::::| :::  |
| ·|.  \::/--=======/:::::::::  :;/ |
|\ | . .\--========||::::::::: . '+;|
    \    |==========\:::::::|:;  '\;|
 . . . //===========|:::::::..|. ;'| 
      /=============|:::::--..   |'|'
 .   |============@=|::://..||   | |'
      \=========@@==@@.//.../|   | | 
 . . .  ======@@@@=@@@-/.... ||| | | 
     |   \\-=@@@@=|@@....../| |;|  | 
```
Tiles after: #a3411a (L .33), #b5471c (.36), #ea5e27 (.47); ink L .25–.32.

### 00:15 (folded, 20 cells; not the hero, so `dim` .28 applies)

Before:
```
  \...'.'-\/   /  /.'| '|'
    \\.....---.-/-.-/   |'
      \.'.'.'.'.'.+-\  /  
  |-'\'-.........+...-\\\ 
    \:=:--=:'.':x.'.'.'.'.
     \\--='-:=--:.......-.
     | .-|':+-=:+-=--/=/ -
     /   @@#x@@@@-\-'|\-:|
```
After:
```
::::::::::---\---/----::\\
\-\:-:::::::::::.:::::::::
     \-\:::::::.:/------:/
  //-==-----------=-==----
 |---==============-=|    
  |  \\======-@@@##       
  |   |\-\@@--@@#         
      |   ##.@##|         
```
Near outside of the cup: before #722837 (L .22), after #d04964 (L .41), `:`. Far inside (back): before #411420 (L .12), after #932c46 (L .27), `=`. Eye tile #120a10, no lift.

### Loose petals, 12:00

Before, falling (age 6–9 s), no tile:
```
      +++'| \\|   
   +.'.'.'.'+|\|! 
  '.'.'.'.'.'.||||
. ''.'.'.'.'.'+!||
   +'.'.'.'.'*  |;
```
After, falling (age 2.5 s, broadside), tile 35%:
```
      |/--\    /   
 . .  /....\ .|. . 
    :/......| |/\; 
 . . |.....|/|.... 
     |.....|-+=:.. 
 . . \.....|\|../. 
     |\..../|  |   
```
After, landed (age 22 s), tile 70%:
```
.-\-/-----\\\;   !|
.............-\; /|
-//--\\-....--/; . 
   /   /\--/;;     
```

## Prototype

Uncommitted on `meadow-site`, in `~/worktrees/stanley-wang/2026-10-29_meadow-site`. The dev server at :3110 shows it.

- `components/garden/engine/ascii.ts`: `FOLD` glyph bands; `petalSeam` rewritten (lighter side, eight neighbours, `- \ | /`); `edgeOf` generalises `petalEdge` and serves loose petals through `looseCov`; the `Kind.Petal` case prints fill by band in dark ink, folds in darker ink, and un-does the bloom shading of the tile by `night`; the `Kind.Disc` eye threshold is .25 and its haze lift fades with `night`; the `Kind.Fluff` loose-petal branch prints rim, `.` fill and a 35% / 70% tile; split cells take the plurality petal id.
- `components/garden/engine/particles.ts`: landed petals lie flat (`rx = s`, `ry = 0.38 s`, small tilt) and carry `LANDED_PETAL`; the `sepal` particle type is removed, along with its spawn in `plants.ts`.
- `components/garden/engine/raster.ts`: `LANDED_PETAL` marker.

Checked: `npx tsc --noEmit` clean, `npx eslint` clean on the three files. Not checked: the GlyphSpecimen cards and the far-head motifs (untouched code paths), and a real shedding cycle at the wind's new strength.

Once approved, the README's "Petals" bullet under The garden's glyphs gains: "Folds between petals print as one line glyph on the lit side; each flap is one fill glyph by its light."
