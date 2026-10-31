# ReadingTime

**Status: spec only (Ticket 2). Build after the garden port.**

Off home, the page takes its colours from the hour, live or set by the visitor, and a visitor can slide the time on any page. Leaving home is near-instant. Three parts: the slider, the hour→colour mapping, and the timing.

## 1. The slider: in the site menu

The slider is the first thing in the SiteHeader's menu (four dots in the top-right corner); the menu's items follow it below a hairline. The diagram below predates that and shows the old sun/moon.

```
stanley  projects  film  writing  music  ☾            ← click / Enter / Space
                                   ┌───────────────────────────────┐
                                   │ ▁▁▂▃▅▆▇▇▆▅▃▂▁▁ track = the day │  the TimeDial track (horizon gradient)
                                   │ ───────────●─────────────────  │
                                   │ 21:40  night            now   │  readout (meta, tabular), phase, reset
                                   └───────────────────────────────┘
```

- **Opens** under the icon as a popover (`surface`, hairline at 45%, `radius-card`, `shadow-card`, padding `space-2`, 16rem wide; full width between gutters under 480px). It fades in with the ExperienceCard's motion.
- **The track** is TimeDial's: the day's horizon from night through dawn, day, golden hour, sunset and twilight, 00:00 to 24:00. The thumb is `radius-hair`.
- **Readout:** `HH:MM` in `meta` mono, tabular figures, `ink`; the phase name beside it in `meta` `ink-muted` (no italic). `now` is a `link-quiet` word that returns to the visitor's clock; it shows only while the hour is set by hand.
- **Keyboard:** the slider is a native range input. Arrows move 15 minutes, Page Up/Down an hour, Home/End midnight. Escape closes and returns focus to the icon. The icon gets `aria-expanded`.
- **Scroll:** while it's open, a scroll or sideways swipe inside the popover moves the hour, 20px per quarter hour; outside it the page scrolls as usual.
- **One click toggle is gone.** Today's click-to-flip (until the next switch) becomes "open the slider". A quick flip is a drag to the other half of the day.
- **State:** a set hour lives in `sessionStorage` (`hour-override`) and doesn't advance: a visitor at "21:40" stays at night while reading. A new visit follows the clock again. Home reads the same key, so coming home shows the scene at that hour; the garden's own scroll-to-scrub writes it too.

## 2. Hour → reading colours

Two families, each drifting through the day in OKLab. The page never blends between the families: a light page stays light until the switch, so ink never meets a page of its own lightness.

| Keyframe | Hour        | `page`    | `ink`     | `ink-muted` | `hairline` (3:1) | ink    | muted |
| -------- | ----------- | --------- | --------- | ----------- | ---------------- | ------ | ----- |
| dawn     | 06:30       | `#e7e5e3` | `#26262a` | `#615f63`   | `#838184`        | 12.0:1 | 5.0:1 |
| day      | 09:00–16:00 | `#ebeae6` | `#252522` | `#63625e`   | `#868580`        | 12.8:1 | 5.1:1 |
| golden   | 17:45       | `#ece5da` | `#2a251f` | `#665e55`   | `#888077`        | 12.1:1 | 5.1:1 |
| sunset   | 19:00       | `#1c1619` | `#ebe1da` | `#a1958f`   | `#6d6361`        | 13.9:1 | 6.1:1 |
| twilight | 20:09       | `#15131c` | `#e5e0ea` | `#9a94a3`   | `#66616e`        | 14.2:1 | 6.3:1 |
| night    | 21:24–04:30 | `#10151d` | `#dde2ea` | `#8f97a3`   | `#5d646f`        | 14.1:1 | 6.2:1 |

- **Light family** (05:30–18:30): dawn → day → golden. Before 06:30 it holds dawn; after 17:45 it holds golden.
- **Dark family** (18:30–05:30): sunset → twilight → night. Before 19:00 it holds sunset; from 04:30 it holds night.
- **Night is the deepest blue**, `#10151d`: the night sky's top (`night-sky-top` `#0d1424`) lifted just enough to read on, with ink cooled to match.
- Interpolated at quarter steps between neighbours, every pair stays at 12:1 or better for ink and 5:1 or better for muted (`contrast.py` here prints them all). The hue shifts are small on purpose: the page should feel the time, not show it.
- `surface` is a step lighter than `page` in both families, as today; `caption-*` don't change.
- The current `page-light` / `page-dark` stay as the day and a neutral fallback for the no-JS first paint.

Implementation note: one function `readingColours(hour)` returns the five values; a client effect writes them as CSS variables on `<html>` once a minute (live) or on input (slider), plus `data-theme` for the family so `dark:` classes and next-themes consumers keep working.

## 3. Timing

**Within a family**, colours follow the hour continuously. Live, they change once a minute, too slowly to see; on the slider, they follow the thumb with no transition.

**At the family switch** (05:30 and 18:30, or the slider crossing them), never crossfade page and ink together. A naive crossfade drops to 1.1:1 at its midpoint; stepping the ink at the midpoint still dips to 3.9:1. Instead:

1. The reading column's text fades to 0 over 90ms (`ease-calm`).
2. Page, ink and every token swap in one frame.
3. The text fades back in over 120ms.

No frame shows text below the family's own contrast. The page background itself doesn't animate. On the slider the same dip runs as the thumb crosses the line. With reduced motion, everything swaps in one frame with no fade.

**Leaving home** replaces the veil's 0.9s edges-first close and 0.6s content delay:

| Step                                                                                           | Time                                    |
| ---------------------------------------------------------------------------------------------- | --------------------------------------- |
| Click on a nav word                                                                            | 0                                       |
| The bio and bar's home styling fade, and a `page`-coloured layer fades in over the scene       | 0–150ms (`duration-leave`), `ease-calm` |
| The new route renders under the layer; its content is visible at once (no fade-in, no stagger) | as soon as it's ready                   |
| The garden's animation loop stops while it's hidden                                            | at 150ms                                |

If the new route is ready before 150ms, the layer cuts short. The route-change progress bar goes; at this speed it only flickers.

**Coming home:** the scene draws its first frame at the set hour from the grown state (no regrowth), and the bio fades in over 150ms. With reduced motion, no fades at all.

## Tokens to add when built

`reading-{dawn,day,golden,sunset,twilight,night}-{page,ink,ink-muted,hairline}` from the table, `duration-leave` (150ms, in tokens.json already, marked proposed). `veil-duration` and `veil-edge` retire.

## Verify (when built)

Slide 00:00→24:00 on a long post at 1440px and 375px: text never drops below the family minimum (sample the computed colours each step), the dip runs once at each switch, and home shows the slid hour. Leave home 10 times: under 200ms to the new page's first frame on a mid-range laptop.

## Open

- Does the hour keep running after a visitor sets it? Recommended no (it's a reading choice); the alternative is "set offset from now".
- The light `hairline` token (`#8f8e89`) is 2.7:1 on `page-light`. The table's `#868580` fixes it; held until this ships, since it changes every border on the site at once.

## The thumb

A 10px circle filled with the track's colour at that hour, ringed all the way round in 1.25px `ink-muted`, on a 4px track; it grows 15% on hover and keyboard focus. It supersedes section 1's ink bar. `track-bump.md` records the bead-and-hump design that was built and then dropped for this.
