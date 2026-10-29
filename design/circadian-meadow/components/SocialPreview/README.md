# SocialPreview

The site's link-preview image: a 1200×630 PNG shown when `stanleywang.dev` is pasted into iMessage, Slack, LinkedIn, Raycast and the like. Stanley's name and domain sit top left on the dark page colour, and his last year of GitHub contributions runs along the bottom as a strip of garden glyphs, one glyph per day. Two garden flowers grow out of it on the right.

Built: `app/opengraph-image.tsx` with `ImageResponse` from `next/og`. Data: `getContributionCalendar()` in `lib/github.ts`, which already exists.

## Problem

The site has no preview image, so a pasted link shows a bare title card ("stanleywang.dev", "By Stanley Wang"). Stanley wants the preview to carry his real contribution graph, like daoho.dev's, but in this system's language rather than GitHub green.

## Related components

| Component | Shared | Why it isn't enough |
| --- | --- | --- |
| GlyphRamp | The glyph vocabulary, sparse to dense | A reference table, not data. The preview borrows its density order |
| HeroText | The home page's text on a dark ground | Lives over the live scene and has no name; the preview needs one |
| Cover | The system's own title card | Describes the design system, not the site; uses older type tokens |
| SiteHeader | The name as plain text, no logo | One row of nav, not an image |

The README allows a page to "borrow one small piece of the garden, … a divider of ramp glyphs, never a full scene". The graph is that piece: a strip of glyphs, no sky, hills or flowers.

## Constraints from the renderer

`ImageResponse` renders with Satori. It supports flexbox only (no CSS grid), no CSS variables, and fonts only as TTF, OTF or WOFF (not WOFF2). It does not read variable-font axes, so each weight needs its own static file. Every value below is therefore literal: resolved hex, px and font files. The token each value comes from is named next to it, so a token change can be carried here by hand.

## Theme: dark, fixed

The image can't follow the viewer's theme, so it is always the dark page with sunset flowers.

- The link opens the home page, and the home page is dark at every hour: its text sits on the scene's dark ground. A dark preview matches what the click lands on.
- The dark page begins at sunset (about 18:30), and sunset is the system's loudest moment ("Don't tame it"). Sunset's flower colours are the one set that belongs to both the dark page and the scene.
- Warm glyphs on a near-black ground hold their contrast when the image is shrunk to a 300px thumbnail. A light image would also melt into white chat bubbles and light-mode Slack.

## Content

Two lines of text, nothing else: no logo, avatar, tagline, labels, count or legend.

| Line | Text | Source |
| --- | --- | --- |
| Name | `Stanley Wang` | `metadata.description` ("By Stanley Wang") and SiteHeader's rule that the name is plain `ink` text |
| Domain | `stanleywang.dev` | `metadata.title`, `WEBSITE_URL` in `lib/constants.ts` |

The graph has no month or weekday labels and no contribution total. Its shape (seven rows, a year wide, a stepped right edge) says what it is.

## Layout

Canvas 1200×630. Everything is left-aligned to x = 64, the image's gutter (`space-5`, 64px), as the site aligns everything to one gutter.

```
0                                                              1200
┌──────────────────────────────────────────────────────────────┐ 0
│                                                              │
│  Stanley Wang                          y 64, 56/64 Geist 500 │
│  stanleywang.dev                       y 136, 30/36 Mono 400 │
│                                                              │
│                                                              │
│  · · : · + · · · # · · : · · @ · · : · + · · · · · · : · ·   │ y 384
│  · : · · · + · · · · # · · · : · · · + · · · @ · · · · : ·   │
│  ·   (7 rows × 53 weeks, 20×26 cells, 1060×182)          ·   │
│  · · · : · · · + · · · · · · · : · · · # · · · · · · + ·     │ y 566
│                                                              │
└──────────────────────────────────────────────────────────────┘ 630
```

| Part | x | y (top) | Size | Notes |
| --- | --- | --- | --- | --- |
| Canvas | 0 | 0 | 1200×630 | Fill `#1b1b19` (`page-dark`) |
| Name | 64 | 64 | 56px / 64px line | Ends about y 128 |
| Domain | 64 | 136 | 30px / 36px line | 8px (`space-1`) under the name's line box |
| Graph | 64 | 384 | 1060×182 | 53 columns × 20px, 7 rows × 26px; bottom edge y 566, 64px above the foot |

The right margin is 76px (1200 − 64 − 1060): the graph is aligned to the gutter, not centred. The band between the domain and the graph (y 172 to 384) stays empty. Nothing sits within 64px of any edge, which also clears Twitter/X's 2:1 crop of `summary_large_image` (about 15px off the top and bottom).

## Type

| Part | Family | Weight | Size / line | Colour | File |
| --- | --- | --- | --- | --- | --- |
| Name | Geist | 500 | 56px / 64px | `#e4e2da` (`ink`, dark) | `public/fonts/geist/Geist-Medium.ttf` |
| Domain | Geist Mono | 400 | 30px / 36px | `#9d9b94` (`ink-muted`, dark) | `public/fonts/geist/GeistMono-Regular.ttf` |
| Graph glyphs | Geist Mono | 500 | 20px, in a 26px line | per level, below | `public/fonts/geist/GeistMono-Medium.ttf` |

Letter spacing 0 everywhere. Sentence case as written; the domain stays lowercase.

These sizes sit above the site's type scale (`title` is 18px) on purpose: a preview is seen at a quarter to half its size, so 56px reads as about 14 to 28px. The roles still follow the system: the name is a heading (sans, weight 500, never a display face), the domain is a quiet mono line in `ink-muted`, and the glyphs use the `glyph` style's weight (500) and its rule that the glyph is 0.78 × the cell height (0.78 × 26 ≈ 20px).

### Font files

The repo has no Geist font files: the site loads Geist through `next/font/google`, which serves WOFF2 and can't be passed to Satori. Add three static instances (no variable files):

- `public/fonts/geist/Geist-Medium.ttf`
- `public/fonts/geist/GeistMono-Regular.ttf`
- `public/fonts/geist/GeistMono-Medium.ttf`

They come from Vercel's Geist release (github.com/vercel/geist-font, SIL OFL 1.1), under the static TTF folders; Google Fonts' Geist and Geist Mono downloads carry the same files under `static/`. `public/fonts/` is where the site already keeps Berkeley Mono. Downloading them needs Stanley's go-ahead; add the licence file next to them.

Read them in the route with `readFile(join(process.cwd(), 'public/fonts/geist/…'))` and pass each to `ImageResponse` as `{ name: 'Geist' | 'Geist Mono', data, weight: 500 | 400, style: 'normal' }`. Use the Node.js runtime (the default for `opengraph-image`).

Not chosen: fetching the fonts from the Google Fonts CSS API at render time, with `text=` to subset (the Next.js docs' `loadGoogleFont` pattern). It needs no committed files, but if Google is unreachable the whole image fails, fallback included.

## The graph

Each day is one cell, 20px wide by 26px tall (the garden's `cell-aspect`, 1.32, rounded to whole pixels), with one glyph centred in it. Columns are weeks, oldest on the left; rows are days, Sunday at the top, as GitHub draws it and as `lib/github.ts` returns it.

Glyphs, not squares: the garden is drawn in type, and a field of glyphs is the system's own way of showing density. Squares would make this GitHub's graph in other colours.

### Levels

The glyph thickens and the colour warms with each level, so the steps still read when the glyphs are too small to make out. The glyphs follow GlyphRamp's order (land's `·`, then the petal ramp). The colours are sunset's: the land stays stone and colour lives in the flowers, so a day with no contributions is bare ground and active days bloom.

| Level | GitHub | Glyph | Colour | Token | Contrast on `#1b1b19` |
| --- | --- | --- | --- | --- | --- |
| 0 | none | `·` U+00B7 | `#6a6964` | `hairline` (dark) | 3.1:1 |
| 1 | first quartile | `:` | `#b35a4e` | `sunset-haze` | 3.7:1 |
| 2 | second quartile | `+` | `#ff5a36` | `sunset-poppy` | 5.6:1 |
| 3 | third quartile | `#` | `#ffb04a` | `sunset-dandelion` | 9.5:1 |
| 4 | fourth quartile | `@` | `#ffd9bf` | `sunset-fluff` | 13.1:1 |
| none (`null`) | outside the year | nothing | — | — | — |

Luminance rises at every step (0.14, 0.17, 0.29, 0.53, 0.75). Levels 0 and 1 are close in luminance; they differ in hue (grey against rose) and in glyph (one dot against two), and level 0's single dot covers far less of its cell.

Level 0 uses `·`, not `.`, so the dot sits in the middle of its cell like the other glyphs, not on the baseline.

The image never shows a flower head, so the garden rule that `*-disc` is the darkest mark in a head doesn't apply to `@` here.

### Data rules

- Use the last 53 columns of `weeks`. GitHub sometimes returns 54 when the year starts on a Saturday; drop the oldest.
- A `null` day (before the year starts, or after today in the last column) draws an empty cell of the same size, so the columns stay aligned and the right edge steps down to today.
- A year with no contributions draws all level 0. That is the real data and gets no special treatment.
- `total` is not shown.

### Build notes (Satori)

Outer `div`: `display: flex; flexDirection: row`, at `position: absolute; left: 64; top: 384`. One `div` per week: `display: flex; flexDirection: column`. One `div` per day: `display: flex; width: 20; height: 26; alignItems: center; justifyContent: center; fontFamily: 'Geist Mono'; fontWeight: 500; fontSize: 20; lineHeight: '26px'; color: <level colour>`. No gaps: the pitch is the cell. That is 371 cells, well within Satori's limits.

## Flowers

Two flowers grow out of the graph: a poppy and a cosmos, on the right, their heads in the empty band above the graph and their stalks running down through it between two columns of days, as stalks pass between things in the meadow. Added at Stanley's request, 2026-10-29. Checked in a mock drawn over the live render; the flowers aren't built yet.

### Source

The heads are the garden's own far-flower motifs, copied character for character, not new drawings. They come from `MOTIFS` in `src/ascii.ts` of the garden (`~/worktrees/ascii-garden/2026-10-29_butterflies/`, same in `~/Developer/sides/ascii-garden/`): `poppy.small` and `cosmos.small`. Each has a mask: `l` outline, `p` petal, `d` centre.

The colours follow the garden's motif stamping rule (`stampHeads`) for the sunset keyframe (`DUSK` in `src/palette.ts`, `night` 0.3) on a dark ground, where ink is cream `#fffaf0`:

- Outline `l`: the petal mixed 42.5% toward cream (`0.5 × (1 − 0.5 × night)`).
- Petal `p`: the petal mixed 15% toward cream.
- Centre `d`: the disc colour, or for a dark disc, the disc mixed halfway to the ground.
- Stalk: `stem` as is.

One deliberate departure: the garden's dark poppy centre (`#1a0f16`) is 1.1:1 on `#1b1b19` and disappears. The centre prints in `sunset-poppy-deep` `#7d1f2a` instead. It's still the darkest mark in the head, as the README requires, and it reads as a dark eye between the brighter petals.

### Art and colours

Poppy (`poppy.small`), 5 wide × 2 rows:

```
 .-. 
(*@*)
```

| Row | Characters | Mask | Colours |
| --- | --- | --- | --- |
| 1 | ` .-. ` | ` lll ` | `.` `-` `.` in `#ff9e85` |
| 2 | `(*@*)` | `lpdpl` | `(` `)` `#ff9e85`, `*` `*` `#ff7252`, `@` `#7d1f2a` |

Cosmos (`cosmos.small`), 3 wide × 3 rows:

```
\|/
-o-
/|\
```

| Row | Characters | Mask | Colours |
| --- | --- | --- | --- |
| 1 | `\|/` | `ppp` | all `#f8caba` |
| 2 | `-o-` | `pdp` | `-` `-` `#f8caba`, `o` `#ffb04a` |
| 3 | `/\|\` | `ppp` | all `#f8caba` |

(In the tables `\|` is an escaped `|`: the rows are `\|/` and `/|\`.)

Stalks: `|` in `#9a6c50` (`sunset-stem`).

| Colour | Where it comes from | Contrast on `#1b1b19` |
| --- | --- | --- |
| `#ff9e85` | `sunset-poppy` 42.5% to cream | 8.6:1 |
| `#ff7252` | `sunset-poppy` 15% to cream | 6.4:1 |
| `#7d1f2a` | `sunset-poppy-deep` (see above) | 1.7:1, on purpose |
| `#f8caba` | `sunset-cosmos` 15% to cream | 11.6:1 |
| `#ffb04a` | `sunset-dandelion` (the cosmos disc is the dandelion colour in the garden) | 9.5:1 |
| `#9a6c50` | `sunset-stem` | 3.8:1 |

### Grid and positions

Flower glyphs use the graph's cell, 20×26, Geist Mono 500, 20px, centred in the cell, with one exception: **stalk `|` glyphs are 26px** (same 26px line), so each one fills its cell's height and the stalk prints as one unbroken line (the README's stalk rule). At 20px they leave a gap at every row.

The flowers sit on a grid **offset half a cell (10px) to the right** of the graph's columns. Flower column `k` starts at `x = 74 + 20k`, so its centre is the boundary between graph columns `k` and `k + 1`. A stalk running down through the graph lands in the 8px gap between two columns of day glyphs and never covers a day.

Rows use the graph's 26px pitch: `y = 384 − 26n` above the graph, `384 + 26n` inside it.

| Part | Columns `k` (left x) | Rows (top y) |
| --- | --- | --- |
| Poppy row 1 ` .-. ` | 39 to 43 (854, 874, 894, 914, 934) | 202 |
| Poppy row 2 `(*@*)` | 39 to 43 | 228 |
| Poppy stalk | 41 (894) | 254, 280, 306, 332, 358, then 384 to 540 inside the graph: 12 cells |
| Cosmos rows 1 to 3 | 46 to 48 (994, 1014, 1034) | 280, 306, 332 |
| Cosmos stalk | 47 (1014) | 358, then 384 to 540: 8 cells |

The poppy's `@` is over the boundary between graph columns 41 and 42, and the cosmos `o` between 47 and 48. Both stalks end with the graph's bottom row (bottom edge y 566). The heads never overlap a day cell: the poppy is the taller of the two, with its head's top at y 202, 30px under the domain's line and far to its right. Space characters in a motif draw nothing (no cell).

Draw the flowers after the graph, each glyph as an absolutely positioned `div` (`display: flex`, 20×26, centred, `position: absolute`, the left and top above). That is 10 head glyphs and 20 stalk glyphs.

### How much

Two flowers, no more. No leaves, buds, grass or butterflies around them. They take the right fifth of the image, which balances the name on the left and leaves the left four fifths of the graph untouched.

Not chosen: rooting the stalks at the graph's top row instead (stalks stop at y 384). It keeps every column of days clear, but the flowers look set on top of the graph rather than grown out of it, and Stanley leaned toward growing out of it. If a render with real data reads busy where a stalk passes a level 3 or 4 day, switch to this by ending both stalks at y 358; nothing else changes.

### In the fallback

The fallback gets the same two flowers, rooted in the grass tufts instead of passing through the graph. With no graph to pass through, 12-cell stalks over empty ground look like stilts, so the flowers drop and sit on the main grid (not offset), each stalk running into a tuft's centre blade:

| Part | Columns (left x) | Rows (top y) |
| --- | --- | --- |
| Poppy row 1 ` .-. ` | 40 to 44 (864, 884, 904, 924, 944) | 384 |
| Poppy row 2 `(*@*)` | 40 to 44 | 410 |
| Poppy stalk | 42 (904) | 436, 462, 488, then the tuft's `\|` at 514 and 540 |
| Cosmos rows 1 to 3 | 47 to 49 (1004, 1024, 1044) | 410, 436, 462 |
| Cosmos stalk | 48 (1024) | 488, 514, then the tuft's `\|` at 540 |

Columns here are graph columns (`x = 64 + 20c`). Same glyphs, colours and 26px stalk size as above.

## Fallback

When `getContributionCalendar()` returns `null` (GitHub down, rate-limited, or its markup changed), the name and domain stay exactly where they are. In place of the graph, two rows of grass tufts sit in the graph's bottom two rows (y 514 and 540, same 20×26 cells, from x 64):

```
  \ | /        \ | /       \ | /        \ | /        
   \|/   \|/    \|/  \|/    \|/   \|/    \|/   \|/   
```

Each row is exactly 53 characters, spaces included, read left to right into the 53 columns. `|` is `#9d9b94` (`ink-muted`, the lit centre blade) and `\` and `/` are `#6a6964` (`hairline`, the blades leaning out), in Geist Mono 500, 20px. These are the README's tufts: blades fanned from one root, bare ground between. The two flowers grow from the tufts at columns 42 and 48 (see Flowers, In the fallback).

The fallback is a fixed pattern, never generated: it uses no warm colour and doesn't fill seven rows, so it can't be mistaken for contribution data. It is never all-level-0 dots, which would claim a year without a single commit.

## Caching

Render at most once a day: `export const revalidate = 86400` in the route, and fetch the calendar with `{ next: { revalidate: 86400 } }`. (`lib/github.ts` passes no cache option today; changing that is part of the build, not this spec.) A fallback render is replaced at the next revalidation. Link scrapers cache previews for days on their own, so a fresher image buys nothing.

## Metadata

In `app/opengraph-image.tsx`:

- `export const size = { width: 1200, height: 630 }`
- `export const contentType = 'image/png'`
- `export const alt = 'Stanley Wang, stanleywang.dev'`

Next.js adds `og:image`, its width, height and alt from these. For Twitter/X, add `app/twitter-image.tsx` re-exporting the same image and constants. If `metadata` in `app/layout.tsx` has no `metadataBase`, set it to `WEBSITE_URL` so the image URL is absolute.

## Accessibility

The image is decorative to most readers; `alt` carries the name and domain. The graph has no text alternative in the image, and doesn't need one: it's a picture of activity, not information a reader acts on. Text contrast is 13.3:1 (name) and 6.2:1 (domain). Every active level is 3.7:1 or better, and the steps differ in glyph as well as colour, so they hold for colour-blind viewers.

## Tokens used

- Colour: `page-dark`, `ink` (dark), `ink-muted` (dark), `hairline` (dark), `sunset-haze`, `sunset-poppy`, `sunset-dandelion`, `sunset-fluff`; for the flowers, `sunset-poppy-deep`, `sunset-cosmos`, `sunset-stem`, and `sunset-poppy` and `sunset-cosmos` mixed toward cream by the garden's motif rule.
- Type: Geist 500 (heading role), Geist Mono 400 (`meta`/`link` role), Geist Mono 500 (`glyph`).
- Space: `space-1` (8px, name to domain), `space-5` (64px, the image's gutter and foot).
- Cell: `cell-aspect` (1.32, rounded to 20×26).

No new tokens. The image's sizes (56px, 30px, 20×26 cells) live in this spec only, because nothing else renders at a preview's scale.

## Don't

- No GitHub green, no squares, no rounded cells.
- No logo, avatar, sun/moon icon, tagline or contribution count.
- No month or weekday labels, no legend ("Less … More").
- No sky or hills, and no flowers beyond the two in Flowers: one strip of glyphs, not a scene.
- No flower glyph on a day cell: stalks run between columns, heads stay above the graph.
- No light variant.

## Verify

- Render `/opengraph-image` locally with live data and with `getContributionCalendar` forced to `null`. Both look finished; the fallback reads as grass, not data.
- Every level 0 to 4 appears in a test render (stub the data if Stanley's year lacks one), and each step is distinguishable at 300px wide (the image at a quarter size), the size iMessage and Slack thumbnails reach.
- Flowers: each stalk is one unbroken line from head to the graph's bottom row, in the gap between columns, touching no day glyph. At 300px wide the poppy still shows a dark centre.
- The right edge steps down to today's weekday; a 54-week response shows 53 columns.
- Text renders in Geist and Geist Mono, not Satori's fallback face: check the `g` and the `@`.
- Paste the deployed URL into iMessage, Slack and LinkedIn (LinkedIn's Post Inspector refreshes its cache) in both their light and dark modes. Nothing is cropped and the name and graph read in both.
