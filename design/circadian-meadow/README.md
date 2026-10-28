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
- Sentence case everywhere. Control labels are one word: Time, Wind, Regrow, Hide. Hints are a single italic sentence: "Click the meadow to sow."
- No marketing voice and no emoji. The garden is the flourish; the words stay plain.

## Colour

Two layers, kept apart.

**Page colour** is the site. `page`, `ink`, `ink-muted`, `hairline`, `control` and `focus` change with the page theme, and the theme follows the sky. It is light (`page-light`) from about 05:30 through golden hour and dark (`page-dark`) from about 18:30, as the sunset sky darkens. The switch is quick, so the page is almost never between the two. Every page but home uses these tokens: blog posts and project pages are plain `page` with `ink` text.

The hour follows the viewer's clock by default, so the site is dark at night without asking. Moving the Time slider overrides it; there is no separate light/dark switch, because the time is that switch.

**Home text** sits on the scene's ground, which is dark at every hour, so it uses `scene-ink`, `scene-ink-muted` and `scene-hairline` whatever the page theme.

**Scene colour** is the garden. Each of six keyframes (`day`, `golden`, `sunset`, `twilight`, `night`, `dawn`) has 18 tokens: `day-sky-top`, `sunset-poppy`, `night-grass-light` and so on. The scene blends between keyframes by hour: night until 4:30, dawn at 6:30, day from 9 to 16, golden hour at 17:45, sunset at 19:00, twilight at 20:09, night from 21:24.

Rules:

- The land stays neutral stone: `*-ground`, `*-hill-near`, `*-grass-dark` and `*-grass-light` carry little hue by day. The flowers (`*-poppy`, `*-cosmos`, `*-dandelion`), the sky (`*-sky-top`, `*-sky-horizon`) and the clouds (`*-cloud`) are where colour lives.
- Sunset is the loudest moment: `sunset-sky-horizon` blood orange under `sunset-sky-top` bruised violet. Don't tame it.
- `*-disc` is the darkest mark in every flower head, in every keyframe.

## Home and the veil

The home page is the meadow, edge to edge, in full colour. There is no mount, frame or edge fade on it.

- Leaving home, the page colour closes over the scene from the edges in: the sides and top first, the middle last, eased over `veil-duration` (0.9s). Its leading band is soft, `veil-edge` (26%) wide, so the scene dissolves rather than wipes. The bio fades out first, in 0.2s.
- The other page's content fades in once the veil has closed (0.6s delay).
- Coming home, the veil lifts the same way in reverse, and the bio returns 0.6s later, once the scene is back behind it, so it never shows light ink on a light page.
- The veil is drawn over everything: scene, flowers and seed alike.
- Because the page follows the sky, the veil never clashes: a night scene closes into a dark page and a day scene into a light one.
- With reduced motion the veil jumps to its end.

## Type

- `body` (Instrument Sans 15px / 24px, growing to 3vh) for the bio; `link` (14px) for the link row; `control` (12px) for the settings panel.
- `hint` (Bodoni Moda italic 13px) for instructions and specimen captions, in `ink-muted`. It is the only use of the display face.
- `glyph` (IBM Plex Mono 500) is the garden's type. Its size follows the cell: 0.78 × cell height, with the cell `cell-width` wide and `cell-aspect` tall.

## Layout

Placed like the koi pond page: a left gutter of 20vw from 1024px up (`gutter`, 24px, below that), the bio `hero-bottom` (128px) above the foot (48px when the window is under 720px tall), at most `measure` (54rem) wide. The settings panel floats top left, inset `space-3`. Nothing is rounded (`radius-none`) except slider thumbs and dots.

## The garden's glyphs

Each cell of the grid reads the material under it and prints from that material's ramp (see GlyphRamp).

- **Petals:** line glyphs along the outline, light glyphs inside over a faint colour tile. The silhouette carries the species. Outlines print paler than the petal (22% toward white by day, 55% at night), so dark night flowers keep their edge.
- **Centres:** `@` or `#` in `*-disc`.
- **Stalks, blades and wires:** the line glyph nearest the stroke's direction (`- \ | /`).
- **Clouds and hills:** ordered-dither halftone. Hills are solid ridges with a depth haze; sun- or moonlit flanks thicken into `.·:;` toward the crest and the far side goes bare. Light lives in glyphs only: no painted gradients or 3D shading on the land.
- **Sun and moon:** glyphs only, no painted disc. The moon keeps its phase, and its holes show.
- **Lace and seed heads:** a soft tile in the head's own colour with the glyphs inked against it, so a pale head holds against a pale hill.
- **Far flowers:** a bare motif with no tile, always behind nearer heads.

A plant wins a cell over the land behind it once it covers a quarter of the cell, so thin stalks survive.

## Legibility

- A flower head that should read as a flower spans at least `specimen-head` (14) cells. Smaller ones are texture, and that's fine far back.
- Compose rather than scatter: a few large feature flowers in front, beside and above the text; small ones near the horizon. Wild carrot stays rare, because at a distance an umbel prints as a block.
- Grass grows in tufts: three to seven blades fanned from one root, the outer ones leaning out and curling at the tip, with bare ground between. It prints as `\|/` clumps, a little quieter than the flowers. There is no dense foreground row.
- Nothing is planted on the hills. The farthest flowers sit on the meadow's back edge, small.
- Butterflies scale with the depth of the flower they visit.
- Near the text the grass thins to 22% within 14 cells. Flowers are never planted where their heads would land on the text. There is never a panel or scrim behind copy.

## Time

- The hour shows in a small corner clock, top right, `hint` type in `ink`. It's static: no seconds.
- A horizontal scroll or trackpad swipe moves the hour, 120px per hour, and turns off "Follow my clock". Letting go leaves a short glide (about 1/8 s, at most ~1¼ h of drift).
- The scene defaults to the finest grid and wind 0.9.

## Motion

- **Wind:** a base breeze plus travelling gusts. Blades turn their pale undersides as they bend, so gusts show as bright bands rolling across. Flower stems are hinged springs with heavy heads.
- **The cursor** is a wake that parts the grass, and a little light, more after dark.
- **Growth:** the garden grows in over 4.5s on first load only. Poppies go from nodding bud to cup to seed capsule; dandelions close, then open as clocks that shed seed on the wind.
- **Reduced motion:** the garden is drawn grown and still.

## Iconography

There is no logo or icon set. The name, where it appears outside the home page, is plain `ink` text.

## Site pages

Every page other than home is plain `page` with `ink` text. The meadow is never a background there. These rules hold until a component in `components/` says otherwise.

- **Header:** the name in plain `ink`, `body` type, no logo. Navigation is a short row of lowercase text links in `ink-muted`, the current page in `ink`. No bar, border or background; it sits on `page`.
- **Project pages and blog posts:** one column at `measure`, left-aligned to the same 20vw gutter as the home bio, so moving between pages doesn't shift the reading line. Headings in `body` weight 500, not the display face.
- **Code and math:** monospace is IBM Plex Mono, the garden's own face. Code blocks are a `hairline` rule, not a filled box.
- **Images:** full measure, no radius, no shadow. Captions in `hint`.
- **Glyph accents:** a page may borrow one small piece of the garden (a single specimen, a divider of ramp glyphs), never a full scene.

Components still to design: SiteHeader, ProjectPage, PostLayout, ProseBlock, CodeBlock, Figure, Divider. The `designer` agent owns them; see `design/README.md`.
