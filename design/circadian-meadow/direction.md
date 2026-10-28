# Direction and open questions

Where the work stands and what to explore next. Written for whoever picks this up in Claude Design.

## Keep

- The time and wind settings, and how the scene recolours through the day: the flower and sky colours at sunset and at night especially.
- The sunset as it is now: bloody, orange, violet, warm.
- The dithered clouds.
- The bio placed like the koi pond page, with no name above it.

## Changed after the first prototype

- Green-tinted ground and grass read too dark and too green. The land is now neutral stone, so flowers and sky stand out.
- A dense foreground row of grass made the bottom busy. Grass is now sparse.
- A dimmed box behind the text made the bio look cut out of the grass. It is gone; grass just thins near the text and no flower heads land on it.
- The site's other pages (blog, projects) are one plain page colour that follows the sky, light by day and dark from sunset, so at night everything is dark.
- Two attempts put that page colour around the home scene as a mount: first a fixed light one around a night scene, then a long soft fade at every edge. Both were rejected. The home page is now full bleed and full colour, and the page colour only arrives as a veil when leaving home.
- The hour follows the viewer's clock by default; the Time slider overrides it and doubles as the light/dark control.
- Night poppies were hard to read. They got paler outlines; the fill was later quieted (`night-poppy` #7a68a4) so night flowers don't glow.

## Changed on feat/butterflies (Oct 29)

- The sun and moon are glyphs only; a painted moon and village lights were tried and rejected.
- Hills dropped their banded 3D shading for glyph slope light, and the meadow blends into them.
- Flowers stay off the hills. Butterflies scale with depth. Lace and dandelion heads got a body tile so they stop vanishing.
- Grass grows in tufts. The corner clock and scroll-to-scrub with a glide were added.

## Still open

0. **Porting the site.** The header, project pages and blog posts move onto this system next. Rules are in the README's Site pages section; components are not designed yet.
1. **Flowers that read as flowers.** At a full-window grid a cell is about 6px, and heads near the horizon are still smudges. The specimen rules (size, outline, dark centre, stalk) work at GlyphSpecimen scale. The question is how to get there in the full scene: fewer and larger heads, a coarser grid, or hand-tuned glyph shapes per species.
2. **The veil.** Today it is a soft smoothstep from the edges in. A dithered veil, in the system's own halftone, or one that sinks the flowers first, is worth trying. It also needs wiring to real route changes on the site.
3. **The switch at dusk.** The page flips from light to dark around 18:30. Whether that should follow the sky or the site's own theme toggle is open.

## Reference

The References group holds Stanley's mood references (the Circadian Rhythm poster, grass, cloud and lily dither studies, an ASCII figure, a word-flower) and a poppy motion clip with frames. Plant studies holds photographs of real growth stages. Prototype holds frames from the working prototype.

## Decisions for review (site shell, Oct 29 overnight)

Made without Stanley, so each can be overruled. Branch `site-shell-f8ae5a`, worktree `~/worktrees/stanley-wang/site-shell-f8ae5a`. Format: what was done; the alternatives; why. **Bold** marks the ones worth a look first.

### Ticket 1: type and shell

1. **Geist and Geist Mono via `next/font/google`**, exposed as `--font-sans` / `--font-mono` (`app/styles/tokens.css`). Alternatives: the `geist` npm package; self-hosted files in `public/fonts`. next/font self-hosts at build with no new dependency and no layout shift.
2. **Every serif, script and Berkeley Mono alias now points at Geist** (`--font-serif`, `--font-script`, …). Unported pages lose their serif headings and italics in one move instead of page by page. Alternative: strip the `font-serif`/`italic` classes from every page now, a much larger diff across pages other sessions are porting. `animated.css` still loads its own Berkeley Mono Prose for the compiler's notes; the compiler port decides that.
3. The italic display `hint` becomes `meta`: Geist Mono 12px, `ink-muted`, upright. Alternatives: Geist italic (still italic), or Geist at 13px muted. Mono matches the bar and dates, so the page has one voice for small print.
4. **The garden's glyph face moves to Geist Mono when it's ported** (one mono, as asked). Alternative: keep IBM Plex Mono as a garden-only exception, since glyph shapes and widths were tuned on Plex. Check the flower specimens at port time; if heads read worse, that's the reason to keep Plex.
5. **The theme follows the hour** (light 05:30–18:30, `lib/circadian.ts`), set by a head script before paint. **The sun/moon flips it until the next switch**, then the hour takes over again. Alternatives: a manual choice that persists forever (fights the hour), or no toggle until the slider exists. Ticket 2 replaces the flip with the slider.
6. next-themes stays and is fed by that script (it writes `theme` to storage before next-themes reads it), with `attribute={['class','data-theme']}`. Alternative: replace next-themes with a small provider, which means editing `useTheme` callers, including the compiler, mid-port.
7. The random background art (plum/circuit) is gone from the layout. Alternative: keep it off writing pages only, as before. The system says plain `page` everywhere off home.
8. **Page shell: content sits at the gutter with the same padding on both sides**; pages limit their own width (`measure`, `measure-read`, `.prose`). Alternative: an asymmetric shell (gutter left, `measure-read` max), which is closer to the system but would knock the compiler's full-width stage (`left: 50%` breakout) off-centre. Revisit after the compiler port.
9. **The home word in the bar is `stanley`.** Alternatives: `home`, `~`, the full name set apart on the left (the old header), or no home item (the reference uses its site's name). Lowercase and short, and the home bio carries no name, so the bar does.
10. **The photos page is `film`** (`/film`). Alternatives: `photos`, `frames` (half-frame pun, fits digital too), `prints`. Picked for the Pen EE-3 and Portra; rename if digital work lands there.
11. **Left the bar: Spotify now-playing, the RSS icon, GitHub and `/bin/sh`.** The API routes stay. Recommended: now-playing moves to `/music`, and RSS to the writing page. Alternative: keep now-playing under the name, as before.
12. The bar is static at the top: no hide-on-scroll, no sticky. Alternative: sticky on long posts. Static is simplest and cheapest; the old one ran a scroll listener.
13. At 375px the bar stays one row (13px, 12px gaps, about 300 of 327px). Alternatives: let it wrap, or a menu button. A hamburger for five words isn't minimal. If a sixth item comes, drop `stanley` on phones first.
14. In-prose links keep a hairline underline that darkens on hover. Alternative: no underline with a colour change; but the link is `ink` like its sentence, so colour alone can't mark it.
15. **Socials are mono, `ink-muted`, no underline, weight 400→600 on hover, slash separators.** Mono so the weight change never shifts the row. Alternative: sans with a hidden bold copy reserving width, more markup for the same effect.
16. **The hover card is rounded (6px) with a soft shadow**, against the README's "no rounded boxes" and the critique rule "no cards with shadows". Your reference asked for it. It's limited to floating cards (`radius-card`, `shadow-card`); everything in the flow stays square.
17. The card's footer is "open site ↗" from your reference, despite the no-arrow-suffix rule. A "case study" link joins it for BETA.
18. **The card shows the full description from `data.ts`, not one line.** Alternatives: clamp to one line, or show only the team ("Commerce & Identity."). Clamping hides your words; the cards run 2–4 lines.
19. Dates read "Summer 2026" as in `data.ts`, not "May–Aug 2026" as in the reference. Give me months and the card shows `start–end`.
20. **Logos are a letter mark (E, A, B) for now.** Fetching favicons is a download I didn't make unasked. Add a `logo` path per role.
21. Touch: the first tap on a company name opens the card and the second opens the site. Alternative: on touch the name is a plain link with no card.
22. Autodesk's card links where the bio links (Flow PT's page), not `data.ts`'s Media & Entertainment URL.
23. **Caption pill: title (or place), then film and year. Pressing it opens all known details above it.** Alternatives: everything visible at all times (busy on a photo), or details on hover (none on touch). Fields: place, date, camera, lens, film, ISO (digital only), shutter, aperture.
24. Caption colours stay dark in both themes (`caption-*`), because they sit on the photo, not the page.
25. **No photo files were copied.** `/film` shows two hatched placeholders at the scans' 1463×2075 shape, with real metadata from `mdls`/`exiftool`: Oct 9, 2026, ISO 400, D.Zuiko 28mm f/3.5. **Both scans carry GPS coordinates; strip them on export.** Alt text is a stand-in ("Tokyo, on Portra 400."); please write real alt text and titles.

### Ticket 3: projects

26. **One ledger: meta left (10rem), glimpse and words right. Mini Compiler leads with its plate across the measure; text-only projects share the grid at the end.** Alternatives: keep data order (Portal first); give every project a full-width plate (a long scroll of screenshots); index numbers (01, 02…) in the left column (a portfolio cliché).
27. Kept your link marks (Pip, Reggie's sprite, globe, YouTube, GitHub) on tokens. Alternative: mono words (`site`, `source`, `video`), quieter but they lose Pip and Reggie.
28. Dropped the blur-in stagger and the `cd ..` home link on `/projects`. The bar goes home, and blur filters on load cost paint time.
29. Plates are flat: a hairline at 45%, `surface` behind letterboxed shots, no radius or ring. Images lazy-load; the Datamines video plays only on screen.
30. A "what's interesting" line per project is specced (`note`), not added: it needs your words.

### Ticket 2: time off home (spec only)

31. **The slider opens from the sun/moon** as a small popover with TimeDial's track, an `HH:MM` readout and `now`. Alternatives: a slider always visible in the bar (busy), or in the footer (far from the icon that means time).
32. **A set hour is frozen and lives in `sessionStorage`**; a new visit follows the clock. Alternative: a running offset from now.
33. **Reading colours drift within two families (light dawn→day→golden, dark sunset→twilight→night), and never blend across them.** Night is `#10151d`, the deepest blue. Every in-between step keeps ink at 12:1 or better and muted at 5:1 or better (`components/ReadingTime/contrast.py`).
34. **At the light/dark switch the text dips out for about 200ms and the colours swap at the trough**, because a crossfade drops to 1.1:1. Alternative: an instant hard swap (fine, but abrupt mid-sentence).
35. **Leaving home: a 150ms page-colour fade, with the new content shown at once**, replacing the 0.9s veil and its 0.6s delay. The route progress bar goes too.

### Found along the way

36. **The light `hairline` (`#8f8e89`) is 2.7:1 on `page-light`**; tokens.json said it met 3:1. Dark is 3.1:1. `#868580` reaches 3.1:1. Held for Ticket 2 because it changes every border at once.
37. The home page beyond the bio (the writing list, experience list, stars and ASCII art) is untouched: the garden port replaces it. The footer only moved to tokens; it still re-renders every second for its clock.
38. Mocks are the `preview.html` cards in each component folder, plus screenshots of the built pages checked in a browser tab, not Claude Design artifacts. The folder is ready for `/design-sync` when you want it.
39. Friction: this worktree was cut from `02aff63`, before the design system landed, and `origin/main` doesn't have it yet (local `main` does), so the app's "sync with base" saw nothing to merge. I fast-forwarded the branch to local `main` (71975f2).
