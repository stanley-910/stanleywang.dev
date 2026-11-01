# SiteMenu

The site menu: four dots in the top bar's top-right corner that open a glass panel of settings. It holds the hour, and where there's a meadow, the meadow's weather and moon, and on home, hide text. SiteIndex is its sibling in the other corner on a phone. The two panels share the same glass, the same place on a phone, the same text column and the same 44px rows under a finger.

Built: `components/ui/theme-switch.tsx`, `components/ui/time-control.css`. Shown from `app/header.tsx`. The hour slider's behaviour (track, readout, keys, scroll, state) is ReadingTime §1; what each weather does is in Weather.

> Respaced on 2026-11-01 from Stanley's phone screenshot: "the rest of the menu is … very slopped". The hour group was the part he liked, and it sets the rhythm for everything under it. Built ahead of a Claude Design mock; its look still needs his call.
>
> The weather's words became glyphs the same day, at his ask: "clear is just like a sunny day or sun. Rain is like you can almost see a little frame of little droplets … Snow is similar, maybe just a snowflake that crystallizes a little bit. Storm, maybe a lightning bolt." Eclipse was left to us (see Weather glyphs). Also built ahead of a mock.

## Content

```
┌────────────────────────────────────────┐
│ ━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━ │  hour
│ 1:00 pm day                        now │
├────────────────────────────────────────┤
│ ☼        ⁄⁄       ✻        ϟ         ◎ │  weather, as glyphs
│ clear weather                          │
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
- **Meadow** (home and the poem, `MEADOWS` in `theme-switch.tsx`): the five weathers as glyphs on one line, sun, rain, snowflake, bolt, eclipse, with a readout under them, `clear weather`; in a storm, the lightning slider; the moon slider; on home, "hide text" (or "show text" while hidden).
- Every slider is a **dial**: a track, then a readout of value and name in `ink` (`1:00 pm day`, `blue lightning`, `silver moon`), and at the right, when it's been set by hand, the word that hands it back (`now`, `auto`).
- The weather row is built like a dial: the glyphs stand where a track would, and the readout under them gives the weather set, value and `weather` in `ink`. While a mouse rests on a glyph, the readout names that one instead, its value in `ink-muted` until it's picked.
- Everything is lowercase `meta` mono. No headings or labels: the words name themselves.

## Layout

One column of text, `--inset` (12px) in from each side of the panel, the same column as SiteIndex's text (its 6px padding plus its rows' 6px). Each target reaches out past its text into the margin around it, so a 44px finger target never moves the layout.

| Measure                         | Mouse (`pointer: fine`)         | Finger (`pointer: coarse`)       |
| ------------------------------- | ------------------------------- | -------------------------------- |
| Panel width                     | 18rem (288px)                   | between the gutters (≤ 480px)    |
| `--inset`: text column          | 12px                            | 12px                             |
| `--pad`: section, above, below  | 12px                            | `space-3` (18px)                 |
| `--gap`: control to control     | `space-3` (18px)                | `space-4` (32px)                 |
| Track to its readout            | 10px                            | 10px                             |
| `--reach`: item target          | 6px past the text (28px tall)   | 14px past the text (44px tall)   |
| Slider target                   | 12px                            | 44px (16px past the 12px box)    |
| `now` / `auto` target           | 6px past the word               | 14px above and below, 12px aside |
| Menu dots target                | 44px (14px round the 16px dots) | 44px                             |
| Weather glyph target            | 28px (6px round the 16px glyph) | 44px (14px round the glyph)      |
| Weather glyphs to their readout | 10px                            | 10px                             |

- The hierarchy reads by distance: a track and its readout (10px) are closer than two controls (`--gap`), and two controls are closer than two sections (`--pad`, hairline, `--pad`). Under a finger the steps open just enough that no two 44px targets overlap.
- **Sections** are split by a full-width hairline, `ink` at 14%, edge to edge of the panel.
- **Weather** is one line of 16px glyphs, `justify-content: space-between`: the sun starts at the column's left edge and the eclipse ends at its right, level with `now` and the tracks' ends. Each target reaches past its glyph into the margin, so the glyph, not the target, sits on the column's edge. The readout under it holds no control (`pointer-events: none`), so a finger's 44px over it still lands on the glyph. It holds on one line down to a 320px phone.
- **Hide text** closes the meadow section, `--gap` under the moon's readout, as an item in the weathers' style. It does not get a section of its own: a lone word between a hairline and the panel's foot read as orphaned.
- Desktop: under the dots, `space-2` below and to the right. Under 480px: `position: fixed`, 52px from the top, between the gutters, where SiteIndex opens.

## Tokens

- Glass: `--glass` (or the hour's `page`) at `--glass-tint` (44%) under an 18px blur with 1.3 saturation, 1px border of `ink` at 18%, `radius-card`. On home the bar takes the sky's ink and glass (`garden.css`).
- Halo: every glyph in the panel carries a text-shadow in the glass's colour (1px, 2px, and 4px at 60%), as the top bar's words do on home, so text keeps its own ground over a bright or busy photo while the glass stays light.
- Text: `text-meta` / `leading-meta`, `font-mono`, all in `ink`: the panel sets `--ink-muted` to `ink`, so names, items and `now` / `auto` (`link-quiet`) take it too. Over a bright or busy photo, muted ink on the old 28% glass fell to about 1:1 (measured on `/photos` with the photos swapped for plain fills, 2026-11-01). Full `ink` on the 44% glass with its halo holds at least 5.4:1 per glyph with plain white or black behind at any hour; the glass alone, 1.9:1 (`tokens.json`, `glass-tint`). The weather set is underlined (1px, 4px offset) rather than told apart by ink.
- Hover (mouse only, `hover: hover`), press and keyboard focus lay `ink` at 9% under an item, with `radius-hair`, as on SiteIndex's rows. Focus ring: `focus`, 1px, offset 0 on items, 3px on sliders and the dots.
- Tracks: the hour's runs the horizon's colour through the day (`paletteAt`); lightning's and the moon's come from `lightningAt` and `moonAt`. Thumbs are 10px circles in the track's colour at the value, ringed in `ink-muted`.
- Spacing: `space-3`, `space-4` and the menu's own 12px inset (shared with SiteIndex). The 10px track-to-readout step is the hour group as built; it stays because the track's 12px box already holds 4px under the line.
- Motion: unrolls from the top (`duration-card`, `ease-calm`, rising 4px; a clip, not a fade, since a blur under a fading layer isn't drawn until the fade ends). The dots turn a quarter round into a diamond as they spread, on a 320ms overshoot. Nothing moves with reduced motion.

No new colours or tokens. The weather glyphs take `ink` / `ink-muted` through `currentColor` and nothing else.

## Weather glyphs

Built: `components/ui/weather-row.tsx`, `components/ui/weather-row.css`. They're drawn in the family of the menu dots, SiteIndex's glyph and the terminal's power glyph: a 16px viewBox, a 1.5 stroke with round caps and joins, no fill except where a pose fills a disc, and moves on the dots' 320ms `cubic-bezier(0.34, 1.56, 0.64, 1)` overshoot.

| Weather | Rest                                                                                                                                          | Hover (mouse)                                                                                                                                  | Set                                                     | Tap (touch, once)               |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------- |
| clear   | A sun: an open disc (r 2.5) and eight short rays (r 5 to 6.25)                                                                                | The rays turn a step (45°) and reach out 8%, on the overshoot; they turn back on leaving                                                       | The disc fills, as the power key drops to a dot when on | The rays turn a step            |
| rain    | Five short drops (3 down, 1.125 across) in two staggered rows                                                                                 | They fall out of the box's bottom right and the same drops come in at its top left, round and round (1.2s a round, linear); the box clips them | Ink                                                     | One round, 0.9s                 |
| snow    | Six arms (r 6)                                                                                                                                | A V grows out of each arm (scaled from 0 at the arm), one arm after the next, 30ms apart: it crystallizes                                      | Stays crystallized                                      | Crystallizes (the set pose)     |
| storm   | A bolt: three strokes zig-zagging down                                                                                                        | It strikes: drawn top to bottom in the first 40% of 560ms, then a flicker (opacity 0.25, 1, 0.5, 1)                                            | Ink                                                     | The strike                      |
| eclipse | Two rings (r 4.25), the moon's over the sun's, 1.5px down-left and up-right; the sun shows only outside the moon, with a gap at each crossing | The moon slides over the sun, the sun's arc closes away into its last point, top right, and a bead comes up there: a diamond ring              | Stays a diamond ring                                    | The diamond ring (the set pose) |

- **Why a diamond ring for eclipse.** A corona of beads all round the ring read as a second sun beside clear. The diamond ring is an eclipse's own moment, it can't be confused with the sun, and it comes out of the motion: the sun's last sliver is where the bead appears.
- **Set poses** follow the power glyph: a settled "on" shape where the glyph has one (clear, snow, eclipse). Rain and storm are set by ink alone; their motion is their weather and doesn't hold still as a pose.
- **Hover** is for `(hover: hover)` only: a phone keeps `:hover` on what was last tapped. Rain and storm run from a `data-hover` the component sets on `pointerenter`, not `:hover`, so on leaving, a round of rain or a strike already under way finishes (`data-settle`, cleared on the next `animationiteration` or `animationend`) rather than snapping back.
- **Touch** (`hover: none`): tapping a glyph sets `data-play` on it for one run of its one-shot. Snow and eclipse need none: their set pose comes in on the same spring.
- **Reduced motion:** every transition and animation sits under `prefers-reduced-motion: no-preference`. With reduced motion the set poses still show, at once, and nothing moves.
- **WebKit:** no CSS `d: path()` anywhere (WebKit can't animate it). Everything is transforms (`transform-box: fill-box` where a part scales about itself), `stroke-dasharray` / `stroke-dashoffset` with `pathLength`, and `opacity` / `fill-opacity`.
- **The eclipse's arc closes on `ease-calm`, not the overshoot.** An overshoot would take its dash below zero, and a negative dash draws the whole ring for a frame.

## States

| Part    | Rest                                            | Hover / press / focus                                                                       | Set                                                   |
| ------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Dots    | `ink-muted`                                     | `ink`; the dots draw in 0.6px                                                               | open: `ink`, a diamond, spread 0.9px                  |
| Weather | glyph in `ink-muted`; readout names the one set | `ink` on the 9% wash; the glyph moves (Weather glyphs); the readout names it in `ink-muted` | the one set in `ink`, in its set pose, `aria-pressed` |
| Dial    | `now` / `auto` hidden                           | thumb grows 15%                                                                             | set by hand: `now` / `auto` shows                     |
| Hide    | "hide text", `ink`                              | `ink` on the 9% wash                                                                        | hides the UI and closes the menu                      |

## Behaviour

- Opening it closes SiteIndex, and opening SiteIndex closes it (`lib/menus.ts`).
- It closes on Escape (focus back to the dots) or a click or tap outside.
- While it's open, a scroll or swipe inside it moves the hour, 20px per quarter hour (ReadingTime). The meadow doesn't scrub under it (`mount.ts` skips `.time-control-pop`).
- The weather, lightning and moon last for the visit. Hide text lasts while home is shown; Escape or hovering the corner brings the text back.

## Accessibility

- The dots are a button named "Menu" with `aria-expanded`.
- Sliders are native ranges named "Hour", "Lightning colour" and "Moon colour", with value text (`1:00 pm, day`; the colour's name). Arrows step; Page Up/Down move the hour by one.
- The weather is a group named "Weather" of five toggles with `aria-pressed`, each named by `aria-label` with its weather (`clear`, `rain`, `snow`, `storm`, `eclipse`); the glyphs are `aria-hidden`. "hide text" is a toggle with `aria-pressed`.
- Tab order follows the column: hour, `now`, the weathers, lightning, `auto`, moon, `auto`, hide text.

## Verify

- Phone 390×844 (WebKit and Chromium) and desktop 1512×860: home by day and at night, the poem, and `/writing` in light and dark. The weather holds one line; its ends line up with the track's ends.
- Every target is 44px under a finger: `document.elementFromPoint` 20px above and below each item's centre still lands on it, and nothing else does.
- In a storm the lightning dial slots in between the weather and the moon at `--gap`, and nothing else moves.
- The weather glyphs at 4× in each pose, by day and at night: one weight and size across the five, the one set clearly in `ink`.
- Each hover animation in WebKit and Chromium (step the glyph's `getAnimations()` by `currentTime` to capture frames). A round of rain finishes after the mouse leaves. On a phone, a tap plays the one-shot once. With reduced motion, `getAnimations()` on a hovered glyph is empty.
- Keyboard: open with Enter, Tab through in the order above, focus rings show, Escape closes and returns focus to the dots.
