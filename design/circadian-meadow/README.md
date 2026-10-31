# Circadian Meadow

A procedurally grown flower meadow printed in monospace glyphs, behind Stanley Wang's personal site. Its colours follow the time of day, after the Circadian Rhythm poster. The home page is the meadow, full bleed and in full colour. Every other page of the site is one plain page colour, light by day and dark by night, and leaving home dissolves the meadow into it.

## The idea in one picture

```
   home                                     any other page
┌──────────────────────────────┐          ┌──────────────────────────────┐
│░░░░░░ sky · clouds · sun ░░░░│          │                              │
│░░░░░░░ ridges · mist ░░░░░\@/│  veil →  │            page              │
│░░░░░░░░░ meadow ░░░░░░░░░░ | │  0.9s    │                              │
│░░ Currently studying … ░░░ | │  ← lift  │                              │
│░░ github / linkedin ░░░░░░░░░│          │                              │
└──────────────────────────────┘          └──────────────────────────────┘
  full bleed, full colour                  plain `page`, `ink` text
```

## Content

- The home page carries no name or heading. The bio opens the page, in Stanley's words, exactly as written, with a lowercase `github / linkedin` row under it.
- Sentence case everywhere, except the top bar's lowercase words. Control labels are one word: Time, Wind, Regrow, Hide. Hints are a single sentence in `meta` mono: "Click the meadow to sow."
- No marketing voice and no emoji. The garden is the flourish; the words stay plain.

## Colour

Two layers, kept apart.

**Page colour** is the site. `page`, `ink`, `ink-muted`, `hairline`, `control` and `focus` change with the page theme, and the theme follows the sky. It is light (`page-light`) from about 05:30 through golden hour and dark (`page-dark`) from about 18:30, as the sunset sky darkens. The switch is quick, so the page is almost never between the two. Every page but home uses these tokens: blog posts and project pages are plain `page` with `ink` text.

The hour follows the viewer's clock by default, so the site is dark at night without asking. Moving the Time slider overrides it; there is no separate light/dark switch, because the time is that switch.

**Home text** sits on the scene's ground, which is dark at every hour, so it uses `scene-ink`, `scene-ink-muted` and `scene-hairline` whatever the page theme.

**Scene colour** is the garden. Each of six keyframes (`day`, `golden`, `sunset`, `twilight`, `night`, `dawn`) has 24 tokens: `day-sky-top`, `sunset-poppy`, `night-grass-light` and so on. The scene blends between keyframes by hour: night until 4:30, dawn at 6:30, day from 9 to 16, golden hour at 17:45, sunset at 19:00, twilight at 20:09, night from 21:24.

Rules:

- The land stays neutral stone: `*-ground`, `*-hill-near`, `*-grass-dark` and `*-grass-light` carry little hue by day. Snow at sunset is the one exception: its lit flank and summits take alpenglow (`sunset-snow`). The flowers (`*-poppy`, `*-cosmos`, `*-dandelion`), the sky (`*-sky-top`, `*-sky-horizon`) and the clouds (`*-cloud`) are where colour lives.
- Sunset is the loudest moment: `sunset-sky-horizon` blood orange under `sunset-sky-top` bruised violet. Don't tame it.
- `*-disc` is the darkest mark in every flower head, in every keyframe.

## Home and the veil

> Ticket 2 (ReadingTime, spec only) proposes replacing the veil with a 150ms fade. Until it's built and approved, this section describes the prototype.

The home page is the meadow, edge to edge, in full colour. There is no mount, frame or edge fade on it.

- Leaving home, the page colour closes over the scene from the edges in: the sides and top first, the middle last, eased over `veil-duration` (0.9s). Its leading band is soft, `veil-edge` (26%) wide, so the scene dissolves rather than wipes. The bio fades out first, in 0.2s.
- The other page's content fades in once the veil has closed (0.6s delay).
- Coming home, the veil lifts the same way in reverse, and the bio returns 0.6s later, once the scene is back behind it, so it never shows light ink on a light page.
- The veil is drawn over everything: scene, flowers and seed alike.
- Because the page follows the sky, the veil never clashes: a night scene closes into a dark page and a day scene into a light one.
- With reduced motion the veil jumps to its end.

## Type

Two faces, nothing else: **Geist** (variable, 100–900) for words and **Geist Mono** (variable) for everything that is a label, a date, a link row or a glyph. No serif, no italic. On the site they load through `next/font` and are named `--font-sans` and `--font-mono`.

- Sans: `body` (15px / 24px; the home bio grows to 3vh) for prose and descriptions; `title` (18px, 500) for the flagship project's name only; `small` (13px) for hover cards; `control` (12px) for the settings panel. Headings are `body` at weight 500.
- Mono: `nav` (14px) for the top bar; `link` (13px) for quiet link rows; `meta` (12px) for dates, kinds, captions and hints, in `ink-muted`; `glyph` (500) for the garden, sized to the cell: 0.78 × cell height, with the cell `cell-width` wide and `cell-aspect` tall.
- Weight is the only emphasis: 400 for text, 500 for names and headings, 600 for a quiet link on hover. Mono for anything whose weight changes, because Geist Mono keeps every weight the same width.

## Layout

Placed like the koi pond page: a left gutter of 20vw from 1024px up (`gutter`, 24px, below that), the bio `hero-bottom` (128px) above the foot (48px when the window is under 720px tall), at most `measure` (54rem) wide. The settings panel floats top left, inset `space-3`. Everything in the flow is square (`radius-none`): panels, buttons, images, plates. Rounded corners are for things that float over something else: `radius-card` (6px) on hover cards and caption details, `radius-pill` on pills over media, `radius-hair` on slider thumbs, `radius-dot` on dots. Shadow is for floating cards only (`shadow-card`).

## The garden's glyphs

Each cell of the grid reads the material under it and prints from that material's ramp (see GlyphRamp).

- **Petals:** line glyphs along the outline, light glyphs inside over a faint colour tile. The silhouette carries the species. Outlines print paler than the petal (22% toward white by day, 55% at night), so dark night flowers keep their edge.
- **Centres:** `@` or `#` in `*-disc`.
- **Stalks, blades and wires:** the line glyph nearest the stroke's direction (`- \ | /`).
- **Clouds and hills:** ordered-dither halftone. Hills are solid ridges with a depth haze; sun- or moonlit flanks thicken into `.·:;` toward the crest and the far side goes bare. The far range is split into broad faces, each a faint tile per cell, light on one side of a hidden ridgeline and shadow on the other (SnowCap). Light lives in the cells: no painted gradients or 3D shading on the land.
- **Snow:** its own material on the far range's massifs, the palest mark on the land. Lit flank `·:;=` and shaded flank `.'`, each on a flat tile in its own colour, with a line-glyph outline along the crest (SnowCap).
- **Trees:** a painted serrated silhouette, the darkest mark on its ridge: three staggered rows on the middle ridge with sparse `^ |` inside, and tiered spruce stands on the near ridge with `/ \` down their flanks (TreeLine).
- **Sun and moon:** glyphs only, no painted disc. The moon keeps its phase, and its holes show. After dark the cells the moon fills also take a faint tile (0.2) in its colour, so it reads as a stark mark in the sky (Stanley's call on 2026-11-01); the sun stays bare halftone. Each has a glow on the backdrop, behind the ridges, that falls fastest at the disc and as (1 − s)² out to nothing, dithered so a dark sky shows no rings: the moon's faint and close (0.1, a third of the screen's diagonal), the sun's wider and warmer as it sinks. A fade that holds and then drops reads as a soft disc around it; don't go back to one. The moon's colour comes from the site menu's moon slider (SiteHeader), and warms a little toward the hills as it rises and sets. Whatever it is, the disc, its glow, the moonlit slopes and snow, and the river's glint all take it, since they all read `globe`.
- **Lace and seed heads:** a soft tile in the head's own colour with the glyphs inked against it, so a pale head holds against a pale hill.
- **Far flowers:** a bare motif with no tile, always behind nearer heads.

A plant wins a cell over the land behind it once it covers a quarter of the cell, so thin stalks survive.

## Legibility

- A flower head that should read as a flower spans at least `specimen-head` (14) cells. Smaller ones are texture, and that's fine far back.
- Compose rather than scatter: a few large feature flowers in front, beside and above the text; small ones near the horizon. Wild carrot stays rare, because at a distance an umbel prints as a block.
- Flowers grow under the trees, never up into the range: no stem tip rises past 2% of the screen height above the horizon, where the near ridge's trees start. A stem eases toward that ceiling past 60% of its room rather than stopping at it, so tall flowers still differ in height. A far flower has little room, so near the horizon it stays low, as it would in perspective. Uncapped, mid-meadow heads stood in front of the snow and the stands, and the scene above the bio read as crowded.
- Grass grows in tufts: three to seven blades fanned from one root, the outer ones leaning out and curling at the tip, with bare ground between. It prints as `\|/` clumps, a little quieter than the flowers. There is no dense foreground row.
- No flowers on the hills. The hills carry a forest (TreeLine) and snow (SnowCap); the farthest flowers sit on the meadow's back edge, small.
- Butterflies scale with the depth of the flower they visit.
- Near the text the grass thins to 38% within 11 cells. (It was 22% within 14 when the flowers grew up into the range; stopped under the tree line, they rarely stand behind the bio, so the fade is lighter.) Flowers are never planted where their heads would land on the text, judged by each flower's own grown stem and head. There is never a panel or scrim behind copy.
- Each visit grows one of a few meadows picked by hand (`GOOD_SEEDS` in garden.ts), so no visit gets a lopsided or clumped one. `?seed=` pins any meadow, for measuring or a screenshot.

## Time

- The hour shows in a small corner clock, top right, `hint` type in `ink`. It's static: no seconds.
- A horizontal scroll or trackpad swipe moves the hour, 120px per hour, and turns off "Follow my clock". On a phone a vertical swipe over the scene does the same, at 80px of finger per hour. A finger that lifts while moving flicks the hour on with iOS's deceleration (0.998 a ms): a quick flick coasts about 3 hours, a hard one at most about 8, nine tenths of it within about a second. Letting go leaves a short glide (about 1/8 s, at most ~1¼ h of drift).
- The scene defaults to the finest grid and wind 0.2 (the poem, 0.13). Gusts level off softly, so the strongest bends a cosmos about 20°, not 40°.

## Motion

- **Wind:** a base breeze plus travelling gusts. Blades turn their pale undersides as they bend, so gusts show as bright bands rolling across. Flower stems are hinged springs with heavy heads.
- **The cursor** is a wake that parts the grass, and a little light, more after dark.
- **Growth:** the garden grows in over 4.5s on first load only. Poppies go from nodding bud to cup to seed capsule; the bud prints as flower in a muted poppy red that warms as it swells, not in the stalk's grey as grass strokes, and an open cup's heart is drawn after a real poppy's: a near-black red ring of stamens flecked with gold pollen around the seed pod's small violet-grey crown, with blotches leaning to the deep red; the inside of a cup darkens toward its base and carries the blotches, while the outside is a deeper, duller red with none, so which way a poppy faces reads at a glance. Poppies turn every way: about a third away from you, showing the outside with the heart hidden, a quarter side-on, the rest toward you (drawn from each plant's seed, so the hand-picked meadows keep their layout). When nearly all faced the viewer, no outside showed to tell the inside by; one petal always sits on a cup's near side, below the heart, so a poppy facing you holds its heart in a bowl rather than on a bare lower edge; a cosmos head shades top to bottom like a dish, its petals reaching down the screen, tipped down, turned from the light or seen from underneath printing a step greyer, since a near-white petal otherwise clips to the same cream on every flap; Queen Anne's lace shades the same way, each umbellet a step greyer down the head and toward its back; on a tile of its own colour wherever petals flank it, so it never prints as grey glyphs over the red; dandelions close, then open as clocks that shed seed on the wind. While it grows in, the stems are damped near critical, so buds lift and settle without bouncing; they loosen to the wind's sway over 2s after. A flower sown by a click comes up over 2s to just open, its age running evenly so each step gets its own time: the stalk draws up, then the bud swells, lifts and opens. Its stems are damped near critical as it comes up, then loosen to the wind's sway over 2s, as the opening's do. (It used to run on into the bloom with a cubic ease and springy stems, so a poppy's nod straightened in a blink and the head whipped up from the foot of the stalk and bobbed.) Only a click sows (or calls a visitor, a bird or a star): a press that drags more than 6px through the meadow does nothing when it lets go. A click on a dandelion shakes it, and a seed clock puffs out about two fifths of its seeds at once.
- **Opening:** on a fresh load of home, the meadow shows first (once the raster workers have warmed, about 250ms in), then the top bar drops in from above (0.35s delay, 0.6s), then the bio fades up (1.1s delay, 0.7s). Coming back to home within the site skips both the opening and the growth: the text is there and the garden is grown. With reduced motion there is no opening.
- **Reduced motion:** the garden is drawn grown and still.
- **Weather:** clear, rain, snow, storm and eclipse, picked from the site menu (Weather). Falling and blown things are capped overlay glyphs; anything that recolours the scene moves in steps. Every weather colour is a mix of the palette's keyframes, never a new hex. Fog was cut.

## Iconography

There is no logo or icon set. The name, where it appears outside the home page, is plain `ink` text.

## Site pages

Every page other than home is plain `page` with `ink` text. The meadow is never a background there. These rules hold until a component in `components/` says otherwise.

- **Top bar:** SiteHeader. One row of lowercase mono words (`stanley projects film writing music`) and the sun/moon, current page in `ink`, the rest `ink-muted`. No bar, border or background.
- **Links:** LinkStyle. In prose, `ink` with a `hairline` underline; quiet rows (socials) are mono `ink-muted`, no underline, heavier on hover.
- **Experience:** ExperienceCard. Company names in the bio open a small card with the role.
- **Projects:** ProjectsPage and ProjectCard. One ledger, the compiler first.
- **Photos:** PhotoCaption, on `/film`. A pill over each photo's corner.
- **Time off home:** ReadingTime (spec only). Reading colours drift with the hour, a slider under the sun/moon, and a 150ms exit from home in place of the veil.
- **Project pages and blog posts:** one column, its text at most `measure-read` (40rem), left-aligned to the same gutter as the home bio, so moving between pages doesn't shift the reading line. Headings in `body` weight 500.
- **Code and math:** Geist Mono. Code blocks are a `hairline` rule, not a filled box; interactive code (the compiler snippet) sits on `surface`.
- **Images:** full measure, no radius, no shadow, aspect ratio reserved. Captions in `meta`.
- **The poem:** Rose. One red rose grows once at the centre of the screen as the line marked `@ rose` scrolls in. It's the poem's one feature flower.
- **Glyph accents:** a page may borrow one small piece of the garden (a single specimen, a divider of ramp glyphs), never a full scene.

Components still to design: ProjectPage, PostLayout, ProseBlock, CodeBlock, Figure, Divider. The `designer` agent owns them; see `design/README.md`.
