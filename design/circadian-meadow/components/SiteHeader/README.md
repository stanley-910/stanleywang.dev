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

|               | Desktop                                                      | Under 480px                           |
| ------------- | ------------------------------------------------------------ | ------------------------------------- |
| Type          | `nav`: `--font-mono` 14px / 20px                             | 13px                                  |
| Between words | `space-4` (32px)                                             | 12px                                  |
| Menu          | `space-4` from the window's right edge, level with the words | at the row's end, at the right gutter |
| Padding       | `space-4` top, `space-5` below                               | `space-3` top, `space-4` below        |
| Left edge     | `gutter` (20vw from 1024px, else 24px)                       | `gutter`                              |

The row sits in the page flow at the top; it doesn't stick or hide on scroll. At 375px the five words and the icon fit one row with 13px type and 12px gaps, at about 300px of the 327px between gutters.

## States

| Item      | Rest                                      | Hover                         | Current page                                         |
| --------- | ----------------------------------------- | ----------------------------- | ---------------------------------------------------- |
| Word      | `ink-muted`                               | `ink`                         | `ink`, `aria-current="page"`                         |
| Menu dots | `ink-muted`, 16px, four 1.6px-radius dots | `ink`, the dots draw in 0.6px | open: `ink`, turned 45° into a diamond, spread 0.9px |

Colour changes take `duration-quick` with `ease-calm`, and none with reduced motion. Weight never changes in the bar. A section matches its subpages: `/writing/…` keeps `writing` current.

## Menu

Four dots in a square (`components/ui/theme-switch.tsx`). A click opens the glass popover under them: ReadingTime's slider and readout; where there's a meadow (home, the poem), a hairline and the weather as two rows of items, `clear rain snow` / `storm wind eclipse`, the one set in `ink` (`lib/weather.ts`; what each does is in Weather); then on home a hairline and the "hide text" item. Items are rows in the readout's `meta` mono, `ink-muted`, lit to `ink` on a 9% `ink` wash on hover. Opening turns the dots a quarter round into a diamond as they spread, on a slight overshoot (320ms); none with reduced motion. The page theme still follows the hour (`lib/circadian.ts`), and the menu keeps painting it while closed.

## On home

When the garden is ported, the bar sits over the scene in `scene-ink` / `scene-ink-muted`, since the scene's ground is dark at every hour.

## Accessibility

`<header>` holds a `<nav aria-label="Site">` with a list. Focus ring: `focus`, 1px, offset 3px. The menu button is named "Menu", with `aria-expanded`; the weather is a group named "Weather" whose six items are toggles with `aria-pressed`, the one set pressed; "hide text" is a toggle with `aria-pressed`.

## Verify

Light and dark, 1440px and 375px: one row, current word in `ink`, nothing shifts on hover, tab order runs left to right ending on the icon.
