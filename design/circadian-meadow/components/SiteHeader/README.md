# SiteHeader

The top bar on every page: one row of lowercase mono words on the page colour, and the site menu's four dots in the top-right corner. No bar, border, background or logo.

Built: `app/header.tsx`, `app/styles/shell.css` (`.site-header`). Dropdowns: `components/ui/nav-drop.tsx`, `components/ui/nav-drop.css`, `lib/directories.ts`.

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

The row sits in the page flow at the top; it doesn't stick or hide on scroll. It stacks above the page under it (`z-index: 35`, below the terminal's 40 and the photo viewer's top layer), so its panels open over home's text, photo captions and hover cards. Under 480px the five words crowded the menu's dots, so they fold into SiteIndex's glyph in the top-left corner, and the bar keeps its 20px line so it stays as tall.

## States

| Item      | Rest                                      | Hover                         | Current page                                         |
| --------- | ----------------------------------------- | ----------------------------- | ---------------------------------------------------- |
| Word      | `ink-muted`                               | `ink`; open, `ink`            | `ink`, `aria-current="page"`                         |
| Menu dots | `ink-muted`, 16px, four 1.6px-radius dots | `ink`, the dots draw in 0.6px | open: `ink`, turned 45° into a diamond, spread 0.9px |

Colour changes take `duration-quick` with `ease-calm`, and none with reduced motion. Weight never changes in the bar. A section matches its subpages: `/writing/…` keeps `writing` current.

## Dropdowns

With a mouse (`(hover: hover) and (pointer: fine)`), `projects`, `writing` and `photos` each drop down what's in them, in SiteIndex's rows and glass without their mark (Stanley, 2026-11-02): the name, a dotted leader, and its meta in `meta` mono. Text only; no photo loads for it. Built from Stanley's ask on 2026-11-01, ahead of a mock: "in a similar way to how the menu bar unfurls".

```
   projects
┌─────────────────────────────────────────┐
│ Portal · · · · · · · · agentic commerce │
│ Mini Compiler · · · · · · · · · systems │
│   …                                     │
└─────────────────────────────────────────┘
```

| Word     | Rows (`lib/directories.ts`)                                                                                                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| projects | every project in the page's order, to its place on `/projects`; meta: its category, lowercase                                      |
| writing  | every post (`BLOG_POSTS`, `EXPERIENCE_POSTS`) newest first; meta: how long ago, "3 weeks ago". The poem is not listed.             |
| photos   | each place in the wall's order; meta: its year, and `n photos` when more than one. All open `/photos`, which has no place anchors. |

- **Place:** under the word, `space-2` below its line less 4px, its names in line with the word (both half insets hang out to the left). As wide as its longest row, 16rem to 26rem; a longer name ends in an ellipsis. Rows are 28px (the mouse's height).
- **Open:** after the pointer rests on the word 140ms, or at once when another dropdown is already open, so moving along the words switches. Keyboard focus on the word (`:focus-visible`) opens it too. A strip under the word bridges the gap to the rows.
- **Close:** 260ms after the pointer leaves word and rows; Escape (focus back to the word); a click outside; focus leaving; following a row or the word; a new page. Opening it closes the site menu and the other dropdowns, and opening the site menu closes it (`lib/menus.ts`).
- **Motion:** SiteIndex's: unrolls from its top-left corner (`duration-card`), rows come in 26ms apart and bloom through the petal ramp, leaders print out; rolls back (`duration-quick`). With reduced motion it opens and closes at once.
- **Hide text** makes the nav inert and hidden, and closes it.
- **Touch** keeps the plain words: no dropdown is rendered and the word carries no `aria-expanded`.

Accessibility: a disclosure, not an ARIA menu. The word stays a link to its page, with `aria-expanded` and `aria-controls`; the rows are a labelled list of links. Tab moves word to word, so the bar stays five stops long; ArrowDown opens it and moves into and down the rows, ArrowUp goes back up and from the first row to the word.

## Menu

Four dots in a square that open the site menu: the hour, and where there's a meadow, its weather, moon and (on home) hide text. Its layout, states and spacing are in SiteMenu. The page theme still follows the hour (`lib/circadian.ts`), and the menu keeps painting it while closed.

## On home

When the garden is ported, the bar sits over the scene in `scene-ink` / `scene-ink-muted`, since the scene's ground is dark at every hour.

## Accessibility

`<header>` holds a `<nav aria-label="Site">` with a list. Focus ring: `focus`, 1px, offset 3px. The menu button is named "Menu", with `aria-expanded`; the menu's own roles and names are in SiteMenu.

## Verify

Light and dark, 1440px and 375px: one row, current word in `ink`, nothing shifts on hover, tab order runs left to right ending on the icon.
