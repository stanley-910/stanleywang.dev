# SiteIndex

The top bar on a phone, and the site menu's sibling (SiteMenu). Under 480px the five words crowded the site menu's dots, so they fold into a glyph in the top-left corner. It opens an index of the site in the site menu's glass. Desktop keeps the row of words (SiteHeader).

Built: `components/ui/site-index.tsx`, `components/ui/site-index.css`. Shown from `app/header.tsx`, inside the bar's `<nav aria-label="Site">`.

> Built ahead of a Claude Design mock, from Stanley's ask on 2026-11-01. Tightened the same day from his phone: "it kinda feels too spread out and tall. I don't like the difference between the | and · dot entries. I think just the index pages should be listed." He kept the fonts, the dotted leaders and the counts.

## Content

```
×                                        ::

  ·  meadow
  ·  projects · · · · · · · · · · · · · 10
  ·  photos · · · · · · · · · · · · · · 4
  @  writing  · · · · · · · · · · · · · 4
  ·  music  · · · · · · · · · · · · · soon
```

- Only the sections: the bar's five words, in its order and in lowercase. No projects or posts under them.
- To the right of each section, in `meta` mono: how many projects, photos and posts (`BLOG_POSTS` and `EXPERIENCE_POSTS`; the poem is not counted) there are, and `soon` for music. A dotted leader of `·` runs out to it, as in a book's index.
- Each section's mark is a `·`. The current section's mark is a flower centre, `@`.

## Layout

| Part  | Spec                                                                                                                                                                                                                                                                                    |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Glyph | 16px, at the left gutter, in the bar's 20px line, so the bar keeps its height. Its tap target is 44px.                                                                                                                                                                                  |
| Panel | `position: fixed`, 52px from the top, between the gutters: where the site menu opens on a phone. Over a short screen it scrolls itself.                                                                                                                                                 |
| Rows  | Mark column `space-3` wide; name; leader (at least `space-2`); count. Back to back, 44px tall under a coarse pointer (the least a finger's target can be without two overlapping), else 28px like the menu's items. Inset half the menu's 12px. Five rows: about 232px open on a phone. |
| Type  | Sections in `small` (13px) mono; marks, leaders and counts in `meta` (12px) mono.                                                                                                                                                                                                       |

## Tokens

The site menu's glass, exactly as in `time-control.css`: `--glass` (or `page`) at 28% under an 18px blur with 1.3 saturation, a 1px border of `ink` at 18%, `radius-card`. Rows: `ink-muted`, the current one `ink`; hover and press lay `ink` at 9% under the row, as on the menu's items; focus ring `focus`, 1px. Marks and leaders: `ink` at 35%. Motion: `duration-card`, `duration-quick`, `ease-calm`, and the dots' 320ms overshoot. No new colours.

On home the bar takes the sky's ink and glass (`garden.css`), and so does the panel.

## States

| State   | Glyph                                                                                                     | Panel                                                                                                                                                                                                                                                                                     |
| ------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rest    | Three ragged lines in `ink-muted`, like the start of a page of text                                       | hidden                                                                                                                                                                                                                                                                                    |
| Hover   | `ink`; the lines even out                                                                                 | —                                                                                                                                                                                                                                                                                         |
| Open    | `ink`; the outer lines cross into a close mark and the middle one drops, with the dots' overshoot (320ms) | Unrolls from the glyph's corner (`duration-card`). Rows come in one after another, 26ms apart. Each row's words bloom in through the garden's petal ramp (`.':-=+*x#%`), and the current mark through the flower centre's ramp to `@`. Leaders print out to the right. About 0.6s in all. |
| Closing | back to rest                                                                                              | Rolls back into the corner (`duration-quick`).                                                                                                                                                                                                                                            |

With reduced motion the panel opens and closes at once, and the words are there from the start.

## Behaviour

- Opening it closes the site menu, and opening the site menu closes it (`lib/menus.ts`), by tap or by keyboard.
- It closes on Escape, on a tap outside, when focus leaves it, on following a link, on a new page, and when the window grows past 480px.
- Hide text fades the glyph with the rest of the bar's nav, makes it inert, and closes the panel.
- The panel takes its own touches, so a swipe on it doesn't scrub the meadow's hour (`data-own-scroll`).

## Accessibility

- The glyph is a button named "Index", with `aria-expanded` and `aria-controls="site-index"`.
- Opening moves focus to the first link. Closing hands focus back to the glyph, unless it has already gone somewhere else.
- The links sit in an ordered list inside the bar's `nav`. The current section carries `aria-current="page"`.
- While words bloom, screen readers get the real words; the glyphs are `aria-hidden`.
