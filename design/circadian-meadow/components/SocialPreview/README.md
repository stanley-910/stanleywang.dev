# SocialPreview

The site's link-preview image: a 1200×630 PNG shown when `stanleywang.dev` is pasted into iMessage, Slack, LinkedIn, Raycast and the like. Stanley's name and domain sit top left on the dark page colour, and his last year of GitHub contributions runs along the bottom as a strip of garden glyphs, one glyph per day.

Status: spec only, not built or mocked. To build: `app/opengraph-image.tsx` with `ImageResponse` from `next/og`. Data: `getContributionCalendar()` in `lib/github.ts`, which already exists.

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

## Fallback

When `getContributionCalendar()` returns `null` (GitHub down, rate-limited, or its markup changed), the name and domain stay exactly where they are. In place of the graph, two rows of grass tufts sit in the graph's bottom two rows (y 514 and 540, same 20×26 cells, from x 64):

```
  \ | /        \ | /       \ | /        \ | /        
   \|/   \|/    \|/  \|/    \|/   \|/    \|/   \|/   
```

Each row is exactly 53 characters, spaces included, read left to right into the 53 columns. `|` is `#9d9b94` (`ink-muted`, the lit centre blade) and `\` and `/` are `#6a6964` (`hairline`, the blades leaning out), in Geist Mono 500, 20px. These are the README's tufts: blades fanned from one root, bare ground between.

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

- Colour: `page-dark`, `ink` (dark), `ink-muted` (dark), `hairline` (dark), `sunset-haze`, `sunset-poppy`, `sunset-dandelion`, `sunset-fluff`.
- Type: Geist 500 (heading role), Geist Mono 400 (`meta`/`link` role), Geist Mono 500 (`glyph`).
- Space: `space-1` (8px, name to domain), `space-5` (64px, the image's gutter and foot).
- Cell: `cell-aspect` (1.32, rounded to 20×26).

No new tokens. The image's sizes (56px, 30px, 20×26 cells) live in this spec only, because nothing else renders at a preview's scale.

## Don't

- No GitHub green, no squares, no rounded cells.
- No logo, avatar, sun/moon icon, tagline or contribution count.
- No month or weekday labels, no legend ("Less … More").
- No sky, hills or flowers: one strip of glyphs, not a scene.
- No light variant.

## Verify

- Render `/opengraph-image` locally with live data and with `getContributionCalendar` forced to `null`. Both look finished; the fallback reads as grass, not data.
- Every level 0 to 4 appears in a test render (stub the data if Stanley's year lacks one), and each step is distinguishable at 300px wide (the image at a quarter size), the size iMessage and Slack thumbnails reach.
- The right edge steps down to today's weekday; a 54-week response shows 53 columns.
- Text renders in Geist and Geist Mono, not Satori's fallback face: check the `g` and the `@`.
- Paste the deployed URL into iMessage, Slack and LinkedIn (LinkedIn's Post Inspector refreshes its cache) in both their light and dark modes. Nothing is cropped and the name and graph read in both.
