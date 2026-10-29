# SiteHeader

The top bar on every page: one row of lowercase mono words on the page colour, and the sun/moon at the end. No bar, border, background, logo or hamburger.

Built: `app/header.tsx`, `app/styles/shell.css` (`.site-header`).

## Content

`stanley  projects  film  writing  music  ☼`

- `stanley` is home. The home page has no name in its bio, so the bar carries it.
- `film` is the photos page (not "gallery").
- `music` opens a plain "soon" page until there's something to put there.
- Writing's RSS feed, GitHub and `/bin/sh` left the bar: socials live under the bio, and the feed belongs on the writing page.

## Layout

| | Desktop | Under 480px |
| --- | --- | --- |
| Type | `nav`: `--font-mono` 14px / 20px | 13px |
| Between words | `space-4` (32px) | 12px |
| Words to icon | `space-4` | pushed to the right edge |
| Padding | `space-4` top, `space-5` below | `space-3` top, `space-4` below |
| Left edge | `gutter` (20vw from 1024px, else 24px) | `gutter` |

The row sits in the page flow at the top; it doesn't stick or hide on scroll. At 375px the five words and the icon fit one row with 13px type and 12px gaps, at about 300px of the 327px between gutters.

## States

| Item | Rest | Hover | Current page |
| --- | --- | --- | --- |
| Word | `ink-muted` | `ink` | `ink`, `aria-current="page"` |
| Sun/moon | `ink-muted`, 16px, stroke 1.5 | `ink` | — |

Colour changes take `duration-quick` with `ease-calm`, and none with reduced motion. Weight never changes in the bar. A section matches its subpages: `/writing/…` keeps `writing` current.

## Sun/moon

The page theme follows the hour (`lib/circadian.ts`): light from 05:30, dark from 18:30. The icon shows the theme on screen; a click picks the other one until the hour's next switch, then the hour takes over again. An open tab switches at 05:30 and 18:30 without a reload. Ticket 2's ReadingTime turns this icon into the entry point for the time slider.

## On home

When the garden is ported, the bar sits over the scene in `scene-ink` / `scene-ink-muted`, since the scene's ground is dark at every hour.

## Accessibility

`<header>` holds a `<nav aria-label="Site">` with a list. Focus ring: `focus`, 1px, offset 3px. The icon button names the theme it switches to ("Switch to dark theme").

## Verify

Light and dark, 1440px and 375px: one row, current word in `ink`, nothing shifts on hover, tab order runs left to right ending on the icon.
