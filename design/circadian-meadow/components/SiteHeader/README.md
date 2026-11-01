# SiteHeader

The top bar on every page: one row of lowercase mono words on the page colour, and the site menu's four dots in the top-right corner. No bar, border, background or logo.

Built: `app/header.tsx`, `app/styles/shell.css` (`.site-header`).

## Content

`stanley  projects  film  writing  music  ☼`

- `stanley` is home. The home page has no name in its bio, so the bar carries it.
- `film` is the photos page (not "gallery").
- `music` opens a plain "soon" page until there's something to put there.
- Writing's RSS feed, GitHub and `/bin/sh` left the bar: socials live under the bio, and the feed belongs on the writing page.

## Layout

|               | Desktop                                                      | Under 480px                                   |
| ------------- | ------------------------------------------------------------ | --------------------------------------------- |
| Type          | `nav`: `--font-mono` 14px / 20px                             | none: the words fold into the SiteIndex glyph |
| Between words | `space-4` (32px)                                             | —                                             |
| Menu          | `space-4` from the window's right edge, level with the words | at the row's end, at the right gutter         |
| Padding       | `space-4` top, `space-5` below                               | `space-3` top, `space-4` below                |
| Left edge     | `gutter` (20vw from 1024px, else 24px)                       | `gutter`, where the SiteIndex glyph sits      |

The row sits in the page flow at the top; it doesn't stick or hide on scroll. Under 480px the five words crowded the menu's dots, so they fold into SiteIndex's glyph in the top-left corner, and the bar keeps its 20px line so it stays as tall.

## States

| Item      | Rest                                      | Hover                         | Current page                                         |
| --------- | ----------------------------------------- | ----------------------------- | ---------------------------------------------------- |
| Word      | `ink-muted`                               | `ink`                         | `ink`, `aria-current="page"`                         |
| Menu dots | `ink-muted`, 16px, four 1.6px-radius dots | `ink`, the dots draw in 0.6px | open: `ink`, turned 45° into a diamond, spread 0.9px |

Colour changes take `duration-quick` with `ease-calm`, and none with reduced motion. Weight never changes in the bar. A section matches its subpages: `/writing/…` keeps `writing` current.

## Menu

Four dots in a square that open the site menu: the hour, and where there's a meadow, its weather, moon and (on home) hide text. Its layout, states and spacing are in SiteMenu. The page theme still follows the hour (`lib/circadian.ts`), and the menu keeps painting it while closed.

## On home

When the garden is ported, the bar sits over the scene in `scene-ink` / `scene-ink-muted`, since the scene's ground is dark at every hour.

## Accessibility

`<header>` holds a `<nav aria-label="Site">` with a list. Focus ring: `focus`, 1px, offset 3px. The menu button is named "Menu", with `aria-expanded`; the menu's own roles and names are in SiteMenu.

## Verify

Light and dark, 1440px and 375px: one row, current word in `ink`, nothing shifts on hover, tab order runs left to right ending on the icon.
