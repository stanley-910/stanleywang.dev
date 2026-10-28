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
