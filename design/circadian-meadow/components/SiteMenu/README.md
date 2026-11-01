# SiteMenu

The site menu: four dots in the top bar's top-right corner that open a glass panel of settings. It holds the hour, and where there's a meadow, the meadow's weather and moon, and on home, hide text. SiteIndex is its sibling in the other corner on a phone. The two panels share the same glass, the same place on a phone, the same text column and the same 44px rows under a finger.

Built: `components/ui/theme-switch.tsx`, `components/ui/time-control.css`. Shown from `app/header.tsx`. The hour slider's behaviour (track, readout, keys, scroll, state) is ReadingTime §1; what each weather does is in Weather.

> Respaced on 2026-11-01 from Stanley's phone screenshot: "the rest of the menu is … very slopped". The hour group was the part he liked, and it sets the rhythm for everything under it. Built ahead of a Claude Design mock; its look still needs his call.

## Content

```
┌────────────────────────────────────────┐
│ ━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━ │  hour
│ 1:00 pm day                        now │
├────────────────────────────────────────┤
│ clear   rain    snow    storm  eclipse │  weather
│                                        │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●━ │  lightning, in a storm only
│ blue lightning                    auto │
│                                        │
│ ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │  moon
│ silver moon                       auto │
│                                        │
│ hide text                              │  home only
└────────────────────────────────────────┘
```

- **Time** (every page): the hour slider and its readout.
- **Meadow** (home and the poem, `MEADOWS` in `theme-switch.tsx`): the five weathers on one line, `clear rain snow storm eclipse`; in a storm, the lightning slider; the moon slider; on home, "hide text" (or "show text" while hidden).
- Every slider is a **dial**: a track, then a readout of value and name in `ink` (`1:00 pm day`, `blue lightning`, `silver moon`), and at the right, when it's been set by hand, the word that hands it back (`now`, `auto`).
- Everything is lowercase `meta` mono. No headings or labels: the words name themselves.

## Layout

One column of text, `--inset` (12px) in from each side of the panel, the same column as SiteIndex's text (its 6px padding plus its rows' 6px). Each target reaches out past its text into the margin around it, so a 44px finger target never moves the layout.

| Measure                        | Mouse (`pointer: fine`)         | Finger (`pointer: coarse`)       |
| ------------------------------ | ------------------------------- | -------------------------------- |
| Panel width                    | 18rem (288px)                   | between the gutters (≤ 480px)    |
| `--inset`: text column         | 12px                            | 12px                             |
| `--pad`: section, above, below | 12px                            | `space-3` (18px)                 |
| `--gap`: control to control    | `space-3` (18px)                | `space-4` (32px)                 |
| Track to its readout           | 10px                            | 10px                             |
| `--reach`: item target         | 6px past the text (28px tall)   | 14px past the text (44px tall)   |
| Slider target                  | 12px                            | 44px (16px past the 12px box)    |
| `now` / `auto` target          | 6px past the word               | 14px above and below, 12px aside |
| Menu dots target               | 44px (14px round the 16px dots) | 44px                             |

- The hierarchy reads by distance: a track and its readout (10px) are closer than two controls (`--gap`), and two controls are closer than two sections (`--pad`, hairline, `--pad`). Under a finger the steps open just enough that no two 44px targets overlap.
- **Sections** are split by a full-width hairline, `ink` at 14%, edge to edge of the panel.
- **Weather** is one line, `justify-content: space-between`: `clear` starts at the column's left edge and `eclipse` ends at its right, level with `now` and the tracks' ends. Under a finger each word's target is at least 44px wide. It holds on one line down to a 320px phone.
- **Hide text** closes the meadow section, `--gap` under the moon's readout, as an item in the weathers' style. It does not get a section of its own: a lone word between a hairline and the panel's foot read as orphaned.
- Desktop: under the dots, `space-2` below and to the right. Under 480px: `position: fixed`, 52px from the top, between the gutters, where SiteIndex opens.

## Tokens

- Glass: `--glass` at `--glass-tint` (72%) under an 18px blur with 1.3 saturation, 1px border of `ink` at 18%, `radius-card`. `--glass` is `page-light` by day and `page-dark` by night (`tokens.css`), not the drifting page colour (dawn's is a mid grey). On home the bar takes the sky's ink and glass (`garden.css`).
- Text: `text-meta` / `leading-meta`, `font-mono`, all in `ink`: the panel sets `--ink-muted` to `ink`, so names, items and `now` / `auto` (`link-quiet`) take it too. Over a bright or busy photo, muted ink on glass fell to about 1:1; in `ink` on the 72% glass it holds at least 4.9:1 with plain white or black behind at any hour (measured on `/photos` with the photos swapped for plain fills, 2026-11-01). The weather set is underlined (1px, 4px offset) rather than told apart by ink.
- Hover (mouse only, `hover: hover`), press and keyboard focus lay `ink` at 9% under an item, with `radius-hair`, as on SiteIndex's rows. Focus ring: `focus`, 1px, offset 0 on items, 3px on sliders and the dots.
- Tracks: the hour's runs the horizon's colour through the day (`paletteAt`); lightning's and the moon's come from `lightningAt` and `moonAt`. Thumbs are 10px circles in the track's colour at the value, ringed in `ink-muted`.
- Spacing: `space-3`, `space-4` and the menu's own 12px inset (shared with SiteIndex). The 10px track-to-readout step is the hour group as built; it stays because the track's 12px box already holds 4px under the line.
- Motion: unrolls from the top (`duration-card`, `ease-calm`, rising 4px; a clip, not a fade, since a blur under a fading layer isn't drawn until the fade ends). The dots turn a quarter round into a diamond as they spread, on a 320ms overshoot. Nothing moves with reduced motion.

No new colours or tokens.

## States

| Part    | Rest                  | Hover / press / focus         | Set                                    |
| ------- | --------------------- | ----------------------------- | -------------------------------------- |
| Dots    | `ink-muted`           | `ink`; the dots draw in 0.6px | open: `ink`, a diamond, spread 0.9px   |
| Weather | `ink`                 | `ink` on the 9% wash          | the one set underlined, `aria-pressed` |
| Dial    | `now` / `auto` hidden | thumb grows 15%               | set by hand: `now` / `auto` shows      |
| Hide    | "hide text", `ink`    | `ink` on the 9% wash          | hides the UI and closes the menu       |

## Behaviour

- Opening it closes SiteIndex, and opening SiteIndex closes it (`lib/menus.ts`).
- It closes on Escape (focus back to the dots) or a click or tap outside.
- While it's open, a scroll or swipe inside it moves the hour, 20px per quarter hour (ReadingTime). The meadow doesn't scrub under it (`mount.ts` skips `.time-control-pop`).
- The weather, lightning and moon last for the visit. Hide text lasts while home is shown; Escape or hovering the corner brings the text back.

## Accessibility

- The dots are a button named "Menu" with `aria-expanded`.
- Sliders are native ranges named "Hour", "Lightning colour" and "Moon colour", with value text (`1:00 pm, day`; the colour's name). Arrows step; Page Up/Down move the hour by one.
- The weather is a group named "Weather" of five toggles with `aria-pressed`. "hide text" is a toggle with `aria-pressed`.
- Tab order follows the column: hour, `now`, the weathers, lightning, `auto`, moon, `auto`, hide text.

## Verify

- Phone 390×844 (WebKit and Chromium) and desktop 1512×860: home by day and at night, the poem, and `/writing` in light and dark. The weather holds one line; its ends line up with the track's ends.
- Every target is 44px under a finger: `document.elementFromPoint` 20px above and below each item's centre still lands on it, and nothing else does.
- In a storm the lightning dial slots in between the weather and the moon at `--gap`, and nothing else moves.
- Keyboard: open with Enter, Tab through in the order above, focus rings show, Escape closes and returns focus to the dots.
