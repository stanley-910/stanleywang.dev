# MeadowVisitors

A ladybug and a bumblebee, a pair of friends, printed as sprite figures in the garden engine, plus the small heart they make when they kiss. They replace the butterfly on the poem page (`app/writing/poem`): clicking a flower sends the pair there, and tapping either one in flight makes them kiss. Home keeps its butterflies and moths.

Engine: `components/garden/engine/typeset.ts` (`INSECTS`, `stampSprites`). Preview: `preview.html`, every figure at each size on the night meadow ground and the day sky, coloured per role, plus the pair flying, kissing and perched.

Approved without review: Stanley pre-approved this work and asked that it ship without his call, so each decision below carries its reason and can be overruled.

## Figures

Side view, facing right. Butterflies are drawn from above because they're symmetric; these two have to face each other to kiss, and a bumblebee is only recognisable side-on (banded abdomen, wings over the back, head at the front). The ladybug's spots still show on its dome from the side.

Each set follows the existing `Figures` shape and pose order: `[0]` and `[1]` are the two wing-beat frames, `[2]` is perched. The heart has a single pose. The last row sits on the sprite's position, centred on it with `row.length >> 1`, as in `stampSprites`. The overview is for reading; the TypeScript below is exact.

```
ladybug big                     ladybug mid
fly 1     fly 2     perched     fly 1   fly 2   perched
\/o'.      /o'.      ,o'.       \o.     /o.     ,o.
 (o.o:    ~(o.o:     (o.o:      (o.:    ~o.:    (o.:
  ' '     / ' '       '''

bee big                         bee mid
fly 1     fly 2     perched     fly 1   fly 2   perched
  \|/      -=-     .__,         \|/    -=-    .__
 ,%'%/    ,%'%/    ,%'%/       (%.o   (%.o   (%.o
(%..%o   (%..%o   (%..%o

The bee is as wide as the ladybug at each size (6 cells big, 4 mid): at 7 it read bigger.
Cells with no tile of their own (glassy wings, rims, legs) print over the cell's own tile, so a
figure over a flower never cuts holes in its petals.

heart big   heart mid   heart small
 ,. ,.      ('v')       <3
('...:)      \:/
  \./         v
   v
```
```

Paste into `INSECTS` in place of the stand-ins:

```ts
  ladybug: {
    big: [
      { rows: ['\\/o\'. ', ' (o.o:', '  \' \' '], mask: ['grswr ', ' ssssp', '  b b '] },
      { rows: [' /o\'. ', '~(o.o:', '/ \' \' '], mask: [' rswr ', 'gssssp', 'g b b '] },
      { rows: [' ,o\'. ', ' (o.o:', '  \'\'\' '], mask: [' rswr ', ' ssssp', '  bbb '] },
    ],
    mid: [
      { rows: ['\\o. ', '(o.:'], mask: ['gsr ', 'sssp'] },
      { rows: ['/o. ', '~o.:'], mask: ['rsr ', 'gssp'] },
      { rows: [',o. ', '(o.:'], mask: ['rsr ', 'sssp'] },
    ],
    small: [
      { rows: ['o'], mask: ['s'] },
      { rows: [':'], mask: ['s'] },
      { rows: ['o'], mask: ['s'] },
    ],
  },
  bee: {
    big: [
      { rows: ['  \\|/ ', ' ,%\'%/', '(%..%o'], mask: ['  ggg ', ' rwpwb', 'ewppwp'] },
      { rows: ['  -=- ', ' ,%\'%/', '(%..%o'], mask: ['  ggg ', ' rwpwb', 'ewppwp'] },
      { rows: [' .__, ', ' ,%\'%/', '(%..%o'], mask: [' gggg ', ' rwpwb', 'ewppwp'] },
    ],
    mid: [
      { rows: [' \\|/', '(%.o'], mask: [' ggg', 'ewpp'] },
      { rows: [' -=-', '(%.o'], mask: [' ggg', 'ewpp'] },
      { rows: [' .__', '(%.o'], mask: [' ggg', 'ewpp'] },
    ],
    small: [
      { rows: ['='], mask: ['s'] },
      { rows: ['#'], mask: ['s'] },
      { rows: ['='], mask: ['s'] },
    ],
  },
  heart: {
    big: [{ rows: [' ,. ,. ', '(\'...:)', '  \\./  ', '   v   '], mask: [' ww ww ', 'wswwwww', '  www  ', '   w   '] }],
    mid: [{ rows: ['(\'v\')', ' \\:/ ', '  v  '], mask: ['wsrww', ' www ', '  w  '] }],
    small: [{ rows: ['<3'], mask: ['ww'] }],
  },
```

What each figure is doing:

- **Ladybug** (big 6 wide in flight, 5 cells of body; mid 4; small 1). A red dome two rows high, its top row narrower and rounded off by rim glyphs (`,` `.`), with black spots (`o`, `.`) and a glint (`'`) on the shell. The head is one black cell with white cheek marks (`:`). Legs are dark ticks under the dome. In flight the back of the elytron lifts (`/` in red) and the hindwing beats up (`\`) and down (`~` over `/`), pale and glassy. The perched big figure carries a leading blank column so it is 6 wide like the flight frames: the dome and head stay in the same cells on landing, facing either way.
- **Bumblebee** (big 7, mid 5, small 1). Buff-tailed bumblebee, tail to head: buff tail (`(`), black, golden band, black thorax, golden collar, black head (`o` for the eye) with an antenna (`/`). Golden cells carry pale `%` fuzz; black cells carry buff `.` and `'` hairs, so the bands read as fur, not paint. The body is two rows, rounded at the tail's top corner. Perched, the wings lie folded along the back (`.__,`); in flight they flicker between up (`\|/`) and back (`-=-`) over the thorax, which reads as a buzz at speed.
- **Heart**: the canonical pixel heart (two lobes over a point), 7 x 4 and 5 x 3, rose tile with darker rose strokes and one pale highlight (`'`) on the left lobe. The mid heart's cleft is a bare rim `v`, so the scene shows through between the lobes. Small is `<3` over a rose tile. The heart never mirrors.

The ladybug reads smaller and rounder than the bee at every size: 4 body cells to the bee's 7 at big, 3 to 5 at mid, and a two-row dome against a long banded body.

### Glyph rules these follow

- Printable ASCII only; no `·` was needed. Every glyph is registered by the existing up-front loop over `INSECTS` (rows and mirrored rows), so workers and page number them the same.
- **No space under a role.** `code(' ')` is 0, which the typesetter reads as "no stamp", so a space in a masked cell drops the tile too. Every masked cell has a glyph; a cell meant to be "just colour" uses `.` instead.
- Each figure's rows are one width; masks match their rows character for character. `preview.html` checks both and logs an error if a figure breaks either rule.

## Roles

The five existing roles, unchanged, plus two new ones. Both are defined from look colours and the `ink` that `inkAt` already returns (dark ground ink on bright skies by day, cream otherwise).

| Role | Tile | Ink | Used for |
| --- | --- | --- | --- |
| `w` | base | `mix(edge, base, 0.35)` | Ladybug shell glint; bee golden fuzz; heart body |
| `s` | base | pattern | Ladybug shell and spots; heart highlight; small sprites |
| `p` | pattern | edge | Ladybug head with cheek marks; bee black bands and head |
| `e` | edge | pattern | Bee's buff tail |
| `b` | none | `mix(body, ink, 0.2)` | Legs, the bee's antenna |
| `g` **new** | none | `mix(edge, ink, 0.7)` | Glassy wings: ladybug hindwings, bee wings |
| `r` **new** | none | `mix(base, ink, 0.2)` | Rim: the body colour with no tile, to round off a corner (dome top, lifted elytron, bee's tail corner, heart's cleft) |

In code, after the existing five:

```ts
        g: [null, mix(edge, ink, 0.7)],
        r: [null, mix(base, ink, 0.2)],
```

Why two new roles:

- `g`: wings are transparent. Every existing role either tiles or inks dark (`b`), and a dark wing vanishes on the night meadow. With `edge` pale on both bugs, `g` prints near-white at night and a smoky grey by day. I tried 0.3 and 0.55 toward `ink`; both left day wings invisible against the sky. 0.7 holds by day, and at night `ink` is cream anyway, so it barely changes there.
- `r`: tiles are square, so a figure that's all tiles reads as a block. The first pass had a ladybug that read as a red box on a black box and a bee that read as a barcode. A rim glyph in the body's own colour with no tile lets the top corners curve off the way the butterflies' `(` `)` margins do. It's mixed 20% toward `ink` like `b`, so it holds on both grounds.

A role I tried and dropped: `k`, a black tile with dull ink for the bee's black bands. `p` with a buff `edge` does the same job (buff hairs on black), so it wasn't worth a third new role.

## Mirror map

Facing left, each row is reversed and these glyphs swap: `(` `)`, `[` `]`, `{` `}`, `<` `>`, `/` `\`, `b` `d`, `p` `q`. Everything these figures use besides those (`o . : ' , % = - ~ _ | v #`) maps to itself.

One change to the engine's `MIRROR`: **drop the `` ` `` / `'` pair.** These figures use `'` for the glint, the bee's hairs and the legs, and none of them has a `` ` ``. With the pair in, a left-facing ladybug's legs and glint would turn into slanted backticks. Butterflies and moths never mirror, so nothing else depends on it.

## Looks

RGB, by day. These are the sprites' own colours, like the butterfly species, not scene tokens.

| | base | pattern | edge | body |
| --- | --- | --- | --- | --- |
| Ladybug | `[204, 38, 30]` red elytra | `[22, 18, 18]` spots, head | `[246, 240, 228]` cheek marks, wing | `[26, 22, 22]` legs |
| Bumblebee | `[238, 178, 40]` golden bands | `[30, 26, 22]` black bands, head | `[226, 206, 156]` buff tail, hairs, wing | `[30, 26, 22]` legs, antenna |
| Heart | `[214, 48, 86]` rose | `[255, 205, 214]` highlight | `[140, 24, 58]` deep rose strokes | `[140, 24, 58]` |

**After dark, all three are muted toward the palette's haze, like the moths: `mix(c, p.haze, 0.25 * p.night)`** for each of the four colours. They are scaled by `p.night` rather than switched, because the poem runs the scene through a whole day while the pair stays on screen, and a sudden colour change would read as a different pair. Muted, the ladybug is still clearly red and the bee gold on the night meadow, and they sit with the quieted night flowers (README: "night flowers don't glow"). The heart stays rose on both grounds: muted, its tile is 3.0:1 against `night-ground`; by day it is 2.1:1 against `day-sky-horizon` and golden hour's horizon, and the rose against blue-grey sky does the rest. I first had a lighter rose (`[226, 64, 96]`), 3.4:1 at night but only 1.8:1 against the day sky; this one trades a little night contrast for day.

## Sizes

Same rule as the butterflies, through the engine's `sized()`: big when the span fits most of the big figure, then mid, then small.

**Choose the size once for the pair, by the bee's widths, and pass it to both.** `sized()` per kind would put a 6-wide ladybug at big while the 7-wide bee drops to mid at the same depth, and the friends would print at different scales. The heart takes **one class below the pair**: mid over a big pair, small (`<3`) over a mid or small pair. The heart is the size of the bee at the same class, which is too loud for a peck; a step down reads as cute. The big heart is used only for the beat (below).

## Motion

For the implementer; within the README's motion rules (calm, the garden is still under reduced motion).

- **Wing beat.** Bee: swap frames every ~40 ms (about 25 swaps a second), so `\|/` and `-=-` flicker into a buzz. Ladybug: every ~80 ms (12 a second), slower and visibly beating, like a heavier flyer. Both beat continuously in flight; neither glides. Butterflies cycle 3 poses at 8 Hz for comparison.
- **Facing.** Each bug faces its horizontal velocity (orbit plus travel). Flip only when |vx| passes a small threshold and hold a facing at least 150 ms, so they don't flicker at the ends of an orbit.
- **Flying together.** The two orbit a shared centre that travels to the clicked flower at the butterflies' cruise speed (120 to 320 px/s, by distance). The orbit is an ellipse, wider than tall because cells are tall: big rx 4 cells, ry 2 rows; mid rx 3, ry 1.5; small rx 1.5, ry 1. One lap about every 1.6 s, opposite each other on it. At these radii the figures never overlap side by side; when they pass above and below, the one on the near half of the orbit draws last. The centre bobs gently with the ladybug's beat, a row at most.
- **The kiss** (tap either bug in flight). Hit area: the figure's cells plus one cell of padding, at least 24 px (44 px on touch). Then:
  1. Both break off and fly to their midpoint, 0.4 s.
  2. One tight lap around each other, rx 3 cells, ry 1 row, 0.8 s.
  3. They meet facing each other, heads in neighbouring cells. The bee's head is on its bottom row and the ladybug's on its middle row, so **the ladybug hovers one row lower than the bee** to bring their heads level. Wings keep beating (the ladybug slows to every 160 ms). Hold 0.6 s. There is no separate kiss pose: the touch of the two heads, the stillness after the lap and the heart carry it.
  4. The heart appears centred over the meeting point, its bottom row one row above the bee's top row. It beats once: the pair's class for 120 ms, then one class down. It rises one row every 0.4 s for 1.2 s (three rows), holding full strength for the first 0.6 s and fading out over the rest. If the engine has no per-sprite alpha, fade by stepping down instead: drop to `<3` for the last 0.3 s, then gone.
  5. They lift off together, pick the orbit back up and carry on to their flower.
  Taps during a kiss or while the heart shows do nothing.
- **On the flower.** The bee lands on the head's centre (where butterflies perch, `head.y - r * 0.35`) facing the ladybug. The ladybug lands on the rim, `0.5 * r` to one side and one row lower, facing the bee, with one cell between their heads. Perched, the bee flicks its wings (flight frame `[0]` for one frame) every 2 to 4 s; the ladybug now and then shuffles a cell along the rim. They stay a few seconds, hop to a few nearby flowers on their own, and stay on the last until the next click, which lifts them both to the new flower. There is only ever one pair: a click while they're on the way redirects them.

  As built, the ladybug sits a cell from the bee's head rather than `0.5 * r` out: on the big front flowers half the radius put them a dozen cells apart, which didn't read as a pair. If their flower fades under them they lift off and hop to a nearby one.
- **Reduced motion.** No flight. A click puts the pair perched on the flower at once. A tap on either shows the heart (one class down, still, no beat or rise) for 1.2 s, then removes it.

## States

| State | Ladybug | Bee | Heart |
| --- | --- | --- | --- |
| Flying | `[0]`/`[1]` every 80 ms | `[0]`/`[1]` every 40 ms | none |
| Kissing | `[0]`/`[1]` every 160 ms, facing the bee, one row lower | `[0]`/`[1]` every 40 ms, facing the ladybug | beat, rise, fade |
| Perched | `[2]`, on the rim | `[2]`, on the centre, flicks | none |
| Reduced motion | `[2]` | `[2]` | still, 1.2 s on tap |

## Accessibility

The pair is decoration on the poem page; it carries no meaning the text doesn't. Keep the canvas `aria-hidden` as the garden is, and add no focus stop for the bugs. Clicks and taps on them never block selecting or scrolling the poem's text.

## Verify

- Day and night (scroll the poem through the hours): both bugs read as a ladybug and a bumblebee at big, mid and small; wings show by day; the heart reads on the night meadow and against the bright sky.
- Desktop and 375 px wide: the pair sizes together (never a big ladybug beside a mid bee); taps land on small figures.
- Facing left: no backticks in the ladybug's legs or glint; the perched ladybug doesn't jump a column on landing.
- The kiss: heads level and touching, heart centred above, no overlap between the two figures.
- Reduced motion: no flight, the heart is still.
- Home: butterflies and moths unchanged.

## Notes

- `design/circadian-meadow/harness/tokens.css` is stale against `tokens.json` (e.g. `--day-sky-horizon` is `#7d8789` there, `#a3afb2` in `tokens.json`), so the preview's day sky renders greyer than the live scene. Contrast figures in this spec are against the `tokens.json` values. Day wings (`g`) come out at 3.1:1 (bee) and 2.7:1 (ladybug) against `day-sky-horizon`.
- `tokens.json` gains no tokens: sprite looks are engine data, like the butterfly species.
