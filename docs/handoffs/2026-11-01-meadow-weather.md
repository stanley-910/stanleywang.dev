# Handoff: home-meadow weather (2026-10-31 → 2026-11-01)

A review packet for whoever picks up or challenges this work. It covers what was asked, what was built, what was tried and thrown out (and why), the evidence, the friction, and what is still open. The session that wrote it can be messaged for anything not here.

- **Worktree / branch:** `/Users/stanley/worktrees/stanley-wang/happy-matsumoto-e7bc00`, branch `happy-matsumoto-e7bc00`. Every change is also pushed straight to `main` (Stanley authorized it).
- **Started by:** the "design system" session `local_68a39272-141b-40ea-9cbe-07fbbddb6513`, from the Terminal README's "Meadow effects" and "Performance" sections.
- **Head at handoff:** `18604ec revert(garden): no sunshower; the meadow keeps five weathers`. Tree is clean.
- **Interrupted mid-task:** "bring flower planting time back down, make it snappier" (see Open items 1).

## 1. What exists now

Five weathers: `clear rain snow storm eclipse` (`lib/weather.ts` `WEATHERS`). They're set from the site menu (the four-dot corner menu, between the time readout and "hide text") or from the window event `meadowcontrol` `{ kind: 'weather', value }` (the floating terminal sends these). Weather lasts for the visit and is never stored.

| Weather | What it draws |
|---|---|
| clear | Nothing. Every overlay is reset and the palette is untouched. |
| rain | Up to 960 streaks in depth (`z = rand^1.1`). Far drops are short and hazed, and they land toward the horizon. Near drops are long. Over the land they're pale, so they show by day, and each landing makes a splash dot that lights its cell briefly. Flowers keep the rain out (no overlay on PLANT cells that are wet). The air wavers ±4% (`wind.unsteady`). |
| snow | Flakes in depth. Far flakes are hazed dots, mid ones are `o`, and near ones are a slim lit `@` core with a faint `·` beside it. A flake rests 0.8–1.6 s where it lands, then melts over 0.5 s. Cover builds caps on plant tops. |
| storm | Rain plus a 0.55 gale. Bolts are procedural: each is a recursive channel with forks, comes from a cloud at its own distance, and stops behind the ridges when far. There are up to three return strokes. Cloud flickers ("brewing") light the cloud's own shape. The colour goes from cool blue to gold by hour and distance, or follows the menu's lightning slider when one is set. |
| eclipse | By day: a black disc with a one-cell gold ring and a smooth glow. It sets behind the ridges and trees (garden skyline), comes in over 5 s, goes out over 4 s, and the palette moves in 64 steps. By night: a lunar eclipse with a warm copper sky. |

**Code map**

- `components/garden/engine/weather.ts`: the engine. The `Weather` class holds `set`, `step`, `tint(palette, sun)` and `paint(now, palette, wind, view)`. Its per-cell overlays are `alpha`, `glyph`, `rgb`, `tile` and `wet`, with a `touched` list to reset them. It also holds the lightning (`strike`, `flicker`, `channel`, `crawl`, `cloudSpot`) and `lightningAt(t)`.
- `components/garden/engine/ascii.ts`: applies the overlays in the per-cell loop, along with the eclipse disc and ring masked by the skyline, the storm glow on cloud glyphs, the flash, and snow caps. `setDimBoxes` holds the fade behind `[data-avoid]` elements (`light` boxes: floor 0.75, pad 4 cells; bio: floor 0.38, pad 11 cells).
- `components/garden/mount.ts`: wires it up. `sceneAt = h => weather.tint(paletteAt(h), sunAt(h))` is used everywhere a palette was. It also runs `weather.step` in the frame, `wind.strength = breeze + weather.gale` and the `meadowcontrol` handler. `quality.calm` is false only while a strike flashes.
- `components/garden/engine/garden.ts`: `globe(p)`, `sunAt(hour)` and the `skyline` sampler.
- `lib/weather.ts`: a `useSyncExternalStore` store for the weather and the lightning tone.
- `components/ui/theme-switch.tsx` + `time-control.css`: the menu's weather row and, during a storm, the lightning slider. Also the 12-hour readout and the popover's clip-path reveal.
- `app/header.tsx` + `components/garden/garden.css`: nav words have `data-avoid="light"` and a `--glass` text-shadow halo.
- Docs: `design/circadian-meadow/components/Weather/README.md` (authoritative), plus the SiteHeader, ReadingTime, ShootingStar and SnowCap READMEs and the root design README.

## 2. Timeline of Stanley's asks and what happened

His words are quoted where the wording matters.

1. **Build the weather** (brief from the design-system session): rain, snow, fog, wind and clear, plus the menu row "below the time, above the hide text". Shipped `ccfe5a0`.
2. **"the fog is unfortunately a bit bad… you can not really see anything"**: fog was cut. A storm with lightning and an eclipse "with a distinguished color pallete" were added. Shipped `efdd5aa`.
3. **Process instruction:** a design-agent pass first, then "a Fable 5.1 extra high review… keep optimization in mind", then apply the review and push. Done; the review findings are in the notes folder's `weather.md`.
4. **The menu blur arrives late on first open; switch to a 12-hour clock.** I couldn't reproduce the delay in Chrome traces (blur present by +33 ms) or in WebKit. I changed the reveal from an opacity fade to a clip-path inset, so the blurred layer is never semi-transparent, and switched the readout to `9:24 pm`.
5. **The eclipse, over several rounds:**
   - "a little funky": it was drawn over the land.
   - "should look more like this with black in the middle" (a reference photo).
   - "too thick of a outline… afterglow shouldn't be so spotty… doesn't need the portruding… colors change tick… by tick… sun going over the moon should be faster".
   - "same with the other weather changes. yes still gradual, but less waiting".

   Result: `d0990b5` and `61ae4de`.
6. **"push weather changes… so my other agents can have it"**: pushed to main. I told the terminal-design session where the hand-over note is.
7. **The perf session's requests:** weather moves at the plant rate and only a strike draws every display frame (`d40c933`); 24 grey steps.
8. **Lightning variety:** he asked for "full size frames… far close, different patterns… branch… different lengths". He'd seen a stem "spawn… right in front of the moon, from nothing", and wanted "brewing of lightning within the clouds". This became procedural bolts, cloud-sourced starts kept away from the globe, and flickers (`f018563`). The frames are in `weather-shots/lightning/`.
9. **Rain depth:** "see it behind the flowers, further on the horizon, little ascii splashes (subtle) would hit flowers and tilt petals or hit the ground". Became the depth model plus splashes plus flower taps (`f018563`).
10. **Snow:** "don't just look like the stars in the night sky… feel actually closer". Near flakes became clumps (`f018563`), and were later slimmed (see 18).
11. **Storm planes:** "the lightning strikes in front of the mountains… but the clouds its generated from seem to be coming from near us"; "bluer or yellower lightning" by weather and time. Fixed so a bolt comes from cloud at its own distance, with colour set by hour and distance (`dd1a71e`).
12. **"yellow lightning I think would still look pretty at night, maybe make it a toggle"**: I first built a gold toggle (`5b481a1`). Stanley called it badly designed, and it was replaced by a slider "from our cool blue lightning to our warmest yellow" in the same style as the time slider (`72761b3`).
13. **Peak snow** (relayed by the design session): "the top doesn't have" snow. My crest-tile attempt `798f48d` "is not working for me. You can still clearly see the outline of the actual mountain", so I reverted it in `f7939e2`. I forwarded the images, and the design session owns the real fix: paint the cap into the cached backdrop (the `paint-the-snow-cap-into` session).
14. **Rain on flowers:** "too much on the flowers… 5-10% of this. gentle hits" (`1a23e91`). Then: "like the dots on the grass… don't like the dots on the flowers, remove them… make flowers impermeable… 1-2% extra wind in both left and right directions". That became `b62fbbe`: the taps are removed, flowers stay dry, and the air wavers.
15. **Daytime rain / "Raise the cap"**: rain was raised to 960 drops (`b6010d2`). For "what about them hitting the ground?", drops are pale over the land and splashes light their cell (`130b45e`).
16. **The nav cutout**, the hardest back-and-forth (see §4.1). It went from a dim box, to per-word boxes, to a glyph halo ("too un readable"), to a halo plus a light fade, which landed as "we need an inbetween" (`888ad47` → `dcbd42d`).
17. **Snow:** "sit for a second before melting" (`888ad47`); "a little less thick" (`042addf`).
18. **"just wind is kinda a bad weather setting… Remove it"**: wind was removed as a weather. The storm keeps its gale, and the terminal's `wind` command still sets the breeze (`842af32`).
19. **The sunshower** (my suggestion as a replacement for wind). It went from "rainbow a bit dull… put out more?", to "more vibrant?", to "too much… brighter, but not this colorful… the ASCII makes it seem like it's a Lego block", to pastel, and finally to "nah just get rid of this one entirely, just leave the five". Fully reverted in `18604ec`; the README records it was tried and cut.
20. **Side task:** "what stripe hook?" / "Disable it". A Stripe plugin hook kept firing on stray mentions of the word in the turn. I turned off `stripe@claude-plugins-official` in `~/dotfiles/claude/.claude/settings.json` (the real file behind the `~/.claude` symlink). That change is uncommitted in the dotfiles repo.
21. **"bring flower planting time back down, make it snappier"**: interrupted before any edit (Open items 1).

## 3. Evidence

**Screenshots.** They're in `/Users/stanley/Library/Application Support/Claude/side-session-notes/local_68a39272-141b-40ea-9cbe-07fbbddb6513/weather-shots/` (outside the repo, 1280×800 @2x):

- First pass: `clear`, `rain`, `snow`, `storm-strike`, `eclipse*`, `menu*`, `snow-reduced-motion`.
- `lightning/`: strikes 1–6 near and far, and flickers.
- Rain: `rain-depth-night`, `rain-day-v2..v4`, `rain-day-960`, `rain-ground-day*`, `rain-flowers-dry`.
- Snow: `snow-depth-night`, `snow-clumps-*`, `snow-rest`, `snow-thin`.
- Nav: `nav-cutout` (the problem), `nav-per-word*`, `nav-light-eclipse*` and `nav-light-rain*` (the final in-between).
- `menu-lightning-auto/gold*`.
- `peak-snow/` (the failed crest) and `sunshower-1300` (cut).

**Performance.** Measured in a DevTools page at 1280×800 @2x with 4× CPU throttling, first pass:

| | clear | rain | snow | storm | wind | eclipse |
|---|---|---|---|---|---|---|
| fps | 119 | 118 | 119 | 117 | 118 | 120 |

- Render per draw was 3.9–5.0 ms and didn't change with the weather. Weather paint was ≤ 0.53 ms (the eclipse corona).
- After `d40c933`, particles move on plant frames (about 40/s), and only a strike's flash draws every display frame.
- I haven't re-measured since rain went to 960 drops. The perf session asked for no benchmarks while the machine is busy.

**Reduced motion** (checked on the first pass): the storm has no flash or particles, the eclipse is a still state with its corona, and snow lies at once. I haven't re-checked it after the later lightning, rain and snow changes.

**Checks.** `npx tsc --noEmit -p .` and eslint pass at `18604ec`. There's no test suite for the garden; all verification is visual.

## 4. Challenges, and where judgement calls were made

### 4.1 Nav text protection vs. the eclipse
The meadow fades behind `[data-avoid]` elements so the text reads. One box over the whole nav row cut a visible dark rectangle out of the eclipse's glow (`nav-cutout.png`). Tight boxes per word still notched it beside "meadow". A pure text-shadow halo had no notch, but Stanley found it hard to read over rain clouds. The landed compromise is the halo plus a *light* fade per word: floor 0.75 instead of the bio's 0.38, padded over 4 cells instead of 11. This is a taste call and the most likely thing to be revisited. The numbers are in `ascii.ts` (`b.light ? cw*4 : wide`, `b.light ? 0.75 : 0.38`).

### 4.2 ASCII limits on colour
Large saturated areas read as "Lego blocks" because each tiled cell is a solid square. The sunshower died on this, and the eclipse ring was thinned for the same reason. The working rule: colour lives in glyphs, tiles stay faint or only one cell wide, and every colour is a mix of palette keyframes, never a new hex.

### 4.3 Cells are tiny (about 3 CSS px)
Single-cell effects vanish. Rain needed multi-cell streaks, a higher count and pale colours over the land. Splashes needed a lit tile. Snow went from invisible dots, to clumps that looked like stars, to clumps that were "too thick", and ended as a slim core plus one dot.

### 4.4 Engine gotchas I hit (worth knowing before touching ascii.ts)
- Every ground cell is `MAT`, so snow caps key on `PLANT`. The sun and moon are `MAT|PLANT` (Fluff), so masking "not land" by `MAT` hid the sun; the eclipse uses the garden skyline instead.
- A cell with no glyph never writes its tile. The black disc needed an invisible `DOT` glyph in the disc's colour.
- A `Float32Array` value compared to a double needs `Math.fround`, or the corona tile never matched.
- The forest, scrub and spruce exist only in the cached backdrop, with no cells. That's why the peak-snow fix belongs in the backdrop painter.
- The backdrop repaints only when `bgKey` changes, so every palette tint is stepped (grey 24, storm 24, cover 60, eclipse 64) to keep repaints rare. No per-frame backdrop or CSS writes.
- Perf rule from the brief: quality logic may change *rates* only, never resolution. I raised caps only with Stanley's OK.

### 4.5 Coordination
- The design session re-derived my colours from palette keyframes. It and I shared `.next` in one worktree, which caused 404s, so we ran dev servers one at a time.
- The terminal branch had its own `meadowcontrol` handler, and I merged it into one `onControl` in `mount.ts`.
- Peak snow is owned by the design session, not me.

### 4.6 Things I proposed that Stanley rejected
- Fog: ineffective.
- A gold-lightning toggle: replaced by a slider.
- Flower taps from rain: too much, then removed.
- My peak crest tile: still showed the outline.
- Wind as a weather: "kinda bad".
- The sunshower: cut.

Pattern: he judges at full size, on the live page, and prefers subtle effects that stay in the ASCII idiom over vivid ones.

## 5. Tooling friction (reusable)

- **The Browser pane being hidden throttles rAF**, so timings and animation there are wrong. I used the chrome-devtools MCP in an isolated page for traces and screenshots.
- **Test in my own tab, never Stanley's preview tab.** `preview_start "compiler-showcase"` (port 3107) opens a "seed" tab, which I close at once and then drive `http://127.0.0.1:3107/?seed=7` from DevTools. Force the hour with sessionStorage `hour-override` (via initScript), and set the weather by dispatching `meadowcontrol`. Clear the override and stop the server afterwards.
- **Fast Refresh keeps stale engine instances.** Reload the page after editing the engine.
- **Pushes to main get rejected often**, because other sessions push too. The fix: ccd `sync_with_base_branch`, then tsc, then `git push origin HEAD:refs/heads/happy-matsumoto-e7bc00 HEAD:main`.
- **`~/.claude/settings.json` is a symlink.** `sed -i` on it fails, so edit the real path in `~/dotfiles`.
- **Prettier reflows files.** An exact-string edit made from a stale read fails, so re-read before editing.
- **The Stripe plugin hook fired on any mention of the word "Stripe"**, including the skills list. I disabled the plugin (see §2.20).

## 6. Open items

1. **Flower planting speed (interrupted).** `RUSH` in `components/garden/engine/plants.ts:56` sets how long a click-sown flower takes to reach just open.
   - It went 2.5 → 3 (`80c74fd`, the "graceful" rework: even age, damped near critical) → 2 (`5f070a1`).
   - Stanley now wants it snappier still.
   - Suggested change: `RUSH` 2 → about 1.2. Keep the even age and critical damping that fixed the whip-and-bob.
   - `garden.ts:579` schedules visitors at `RUSH + 1`, so that follows automatically.
   - The design README says "comes up over 2s"; update it to match.
   - Nothing is edited yet.
2. **Peak snow cap:** owned by the `paint-the-snow-cap-into` session.
3. **Unverified:**
   - Reduced motion after the later weather changes.
   - Frame time at 960 drops plus storm on a slow machine.
   - Safari for the menu's clip-path reveal and the nav halo.
4. **Not done:** `season` from the original brief; Stanley's optimization pass ("I'll do an optimization change later").
5. **Design calls still open** (from the design session): the lunar eclipse's full copper fill vs. tinting only; `DISC_TILE` 0.7; the bolt tile 0.7; no `preview.html` card for Weather.
6. **Dotfiles:** the Stripe-disable edit is uncommitted in `~/dotfiles`.
