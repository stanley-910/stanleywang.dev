# Poppy click growth: handoff

## The problem

When you click the meadow, a flower is sown and grows to just open in `RUSH` seconds (1.2s).
Stanley has rejected every version of the **poppy's** grow-in so far. The cosmos, lace and
dandelion are acceptable; Stanley said the cosmos was the one "still good" when the others
were stiff. Only click growth is in scope. The page-load and regrow intro is not: Stanley
had a change to it reverted (11eaf8d) and wants it left alone.

His latest complaint, against e47ffc8, which is what is on main now:

> I still don't like kind of how it starts super drooped up. It kind of feels like it's
> actually like literally like scaling or something at me … it should be like the stem first,
> like it feels like it comes out of the ground, drooped, which I don't like.

What he wants, put together from his messages: **the stem comes out of the ground first**,
not a little hooked poppy that scales up. The poppy then bends down ("goes down") and comes
up ("sprouts up"). The two should run together as one smooth motion, with no stops or pauses.
It should feel quick: he asked for "snappier" before 1.2s. It must stay alive in the wind.
It must not be stiff, held still, or settle "into a locked position".

## Every version so far and his verdict

| Commit | What the click growth did | Stanley's verdict |
|---|---|---|
| before 80c74fd | `RUSH` 2.5s with a cubic ease-out on age, running on to `bloomAge()` (into the bloom). The stems used `LIVELY` damping 0.2. | The starting session asked for "graceful": the head whipped up from the foot of the stalk and bobbed. |
| 80c74fd | Age ran linearly to `openAge()` over `RUSH` 3s. Stems were held near critical damping (`SETTLED` 0.9, `calm = 1`) during the growth and for 2s after. | "so slow and stiff… they droop and rise at the same time… stays completely still… like getting let back into a locked position rather than recoiling back into the wind." |
| (RUSH 3 → 2) | Same, faster. | Still too slow, as above. |
| 5d25dc7 | On the first frame, stem angles snap to the rest curve (born already hooked). Stems use `LIFT` damping 0.5 during the growth. Nothing is held still afterwards. | He asked for it faster. |
| 309943d | `RUSH` 1.2s. | "shouldn't spend so much time in its down state… sprouting into its down state, then slowing down… comes out of the ground fast, but slows… to bulge out and then flicker up. Should be a lot more seamless… goes down and then sprouts up, synchronized." |
| e47ffc8 (now) | Sown poppies get their own timeline, set by the growth's progress `u` (0 to 1) instead of age (see below). | "starts super drooped… feels like scaling at me… should be the stem first." |

Clips of each recent version, plus a 0.125s frame tile of e47ffc8, are in
`~/.claude/projects/-Users-stanley-Developer-portfolios-stanley-wang/handoffs/poppy-click-growth/clips/`.

## How it works (code map)

All of this is in `components/garden/engine/`.

### Growth constants (`plants.ts:57-65`)

- `RUSH` is 1.2s.
- `SWAY` is 0.35, the damping in the wind.
- `SETTLED` is 0.9, used only by the load intro.
- `LIFT` is 0.5, the damping during click growth.
- `LOOSEN` is 2s.

### `Plant.hurry()`, `sowing`, `update()` (`plants.ts:156-180`)

- `hurry()` sets `rush = {from: age, to: openAge(), t: 0}`.
- Each frame, `t` goes up by `dt / RUSH` and `age = lerp(from, to, t)`, so age runs linearly.
- The `sowing` getter returns `t`, or `null` when the plant isn't being sown.
- On the first rush frame, after `live()` sets the rest curve, every stem's `ang` is copied from `rest` (`s.ang.set(s.rest)`). **The plant is born already bent into its full hook.**

### Poppy growth stages (`Poppy.phase()`, `plants.ts:401`)

On its normal life clock (G ≈ 8–12s):

- `growth = 0.12 + 0.88·easeOut(t/G)`, a cubic curve that is fast first.
- `nod = 1 − smoothstep(G+8, G+14)`, the hook.
- `bud = lerp(0.35, 1, smoothstep(0, G+10))`.
- `open = smoothstep(G+14, G+20)`.
- `openAge = G+20`.

When sown, set by `u`:

- `growth = 0.12 + 0.88·smoothstep(0, 0.6, u)`.
- `nod = 1 − smoothstep(0.35, 0.8, u)`.
- `bud = lerp(0.35, 1, smoothstep(0, 0.55, u))`.
- `open = smoothstep(0.55, 1, u)`.
- At `u = 1` this matches the normal timeline at `G+20`, so there is no jump when the growth ends.

### Applying the stages (`Poppy.live()`, `plants.ts:430`)

- `s.growth = ph.growth`.
- `s.setCurve(side · 2.75 · nod, 0.55, side · 0.04)` bends the top 45% of the stalk by up to 2.75 rad, a full hook.
- Head mass and drag follow `bud` and `open`.

### Drawing (`Poppy.draw`, about `plants.ts:500-530`; `drawBud`, about `:686`)

- The bud is drawn at size `H · ph.bud`, where `H = this.head` is the full-flower head size (about 12–15% of the stalk's full length × 1.6).
- The bud colour and the red seam showing through use `this.age` against `G`, not `u`.

### The stem (`stem.ts`)

- `Stem.layout()`: every segment is `length · growth / n` long. **Growth scales the whole stalk evenly**; the stalk does not extend from the tip.
- `setCurve` spreads the bend over the top part of the stalk.
- `step()` is a hinged angular spring per joint, pushed by wind, head weight and the cursor. The damping ratio is set per stem each frame.

### Sowing (`garden.ts:610`)

`sow()` calls `add(pickSpecies(), x, z)` and then `plant.hurry()`. The species is a weighted random pick.

## Why it looks like "scaling at me" (unverified)

This is how I read it; I have not tested it.

1. **Born hooked.** At `u = 0`, `nod` is 1, and the first-frame snap puts the full 2.75 rad hook in at once. A tiny stalk 12% long already carries the whole hook.
2. **Uniform scaling.** `Stem.layout` stretches every segment by `growth`, and `setCurve` keeps the hook at a fixed share of the stalk. So the hook-and-bud shape grows as a scaled-up copy of itself. Nothing comes out of the ground and lengthens.
3. **The bud is big from the start.** It begins at 35% of full head size while the stalk is 12% of full length. Next to the stalk it is huge, so it reads as a whole small poppy appearing and zooming toward you.
4. **Growth starts at 0.12, not 0.**

## Directions to try

These are suggestions, not decided.

- **Stem first.** Grow the stalk from the base: fill the lower segments to full length first, so the tip moves upward. Do this only for sown plants (pass a flag, or add a separate growth mode on `Stem`), so the load intro and the other species don't change. Start the sown stalk near 0.
- **The hook forms as it grows, not before.** Drop the first-frame snap for poppies, or snap to straight. Ramp `nod` in from 0 as the stalk grows, so the bud tips over as it gets heavy, then let it go. That gives "goes down then sprouts up" as one motion. Stanley said "synchronized": the droop and the lift should overlap smoothly, not happen as separate steps.
- **Tie bud size to stalk length** early on (for example `bud ∝ growth`) so it doesn't appear at 35% size.
- **Keep the stems in the wind** (`LIFT` or `SWAY`). Don't hold them still.
- **Judge it at speed.** Look at a GIF at the real speed, not a frame tile. Stanley's complaints are about feel.

## Constraints

- **Don't change these.** Leave alone:
  - The page-load and regrow intro (`SETTLED`/`calm` belong to it).
  - The cosmos, lace and dandelion growth.
  - The hand-picked `GOOD_SEEDS` layouts. Never use `this.rng()` for anything new; use `hash(seed, k)`.
- **Palette colours only.** No new hex values in the plant code.
- **Performance.** Don't raise the cost per frame. Quality settings only change rates, never resolution.
- **Commits and publishing.**
  - No AI attribution in commits.
  - Merge `origin/main`, then `git push origin HEAD:main`. Stanley has authorized pushing to main.
  - Update the Growth bullet in `design/circadian-meadow/README.md`. It records each version and why it changed.
- **Showing results.** Show Stanley GIFs and single screenshots, not tiled frame strips.
  - Test in your own headless browser, never in his preview tab.
  - He judges the garden at full resolution, at his 1512×860 viewport. The clips above were 1280×800, cropped.
- **Personal photos.** Never view `public/images/film` or the /photos page.

## Test rig

Copies are in `~/.claude/projects/-Users-stanley-Developer-portfolios-stanley-wang/handoffs/poppy-click-growth/rig/`. They use `playwright-core` with the Chromium in the ms-playwright cache. Run `npm i` in that folder first.

1. **Start a dev server** in the background on port 3191:

   ```bash
   npx next dev -p 3191 > dev.log 2>&1 &
   ```

2. **Force poppies while testing.** Temporarily change `garden.ts` `sow()` to `this.add('poppy', x, z)`. Afterwards, `git checkout components/garden/engine/garden.ts`.

3. **Record.** `node growvid.mjs <out-dir> [hour]` opens `/?seed=1349393922`, freezes the clock at 10:30 (or `hour`), seeds `Math.random`, and waits 8s. It then clicks at y=790 for x = 900, 1150, 1000, 760, 1080, 4.5s apart, and records a webm. The first click lands at about 8.1s in the video.

4. **Cut a GIF** (the crop is for the first click):

   ```bash
   ffmpeg -ss 8.1 -t 3 -i <video>.webm -vf "crop=300:420:780:380,fps=15,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse" out.gif
   ```

   For a frame tile you check yourself, add `tile=8x2` with `fps=8`.

5. **Other scripts.**
   - `still.mjs` takes a reduced-motion still.
   - `night.mjs` is the same at 21:30.
   - `sowbig.mjs` takes screenshots after sowing.

6. **Clean up.** `pkill -f "next dev -p 3191"` when done.

**zsh gotchas:**

- `ls` is eza, so use `command ls`.
- A `$var` holding several words isn't split; use `${=var}`.
- ImageMagick `montage` has no font here, so use ffmpeg `tile`.

## Other changes from the same session (for context)

All of these are on main.

- **Poppy heart and cup** (9351fac, 41cdb7b, 2ad1543, a08c994):
  - A dark stamen ring with pollen around the pod crown.
  - The inside throat darkens.
  - The outside is a duller red.
  - `turn` varies which way each poppy faces.
  - There is always a petal on the near side.
- **Cosmos and lace underside shading** (a08c994, 85edaf1). `PetalSpec.underside` and `throat` are in `bloom.ts`.
- **Lace dark floret** (1bc1e33). It is plum, not red.
- **Lace head** (06cf8ac, 0540924): umbellets packed in a full disc, each a separate tuft.
- **Night lace** stepped down to `#a3a9c0` (7aa10f9). Night cosmos stays at `#a9b1cf`; Stanley liked it.
- **Earlier typeset tweak:** a dark Disc cell keeps its own tile when at least 2 petals border it. It used to need 3.
