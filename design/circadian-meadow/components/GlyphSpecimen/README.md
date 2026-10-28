# GlyphSpecimen

One flower printed as type over a small full-bleed scene, swaying in the wind: the reference for how a flower must read in glyphs.

Provide `species` (`poppy`, `cosmos`, `lace`, `dandelion`), and optionally `stage="bud"`, `hour` (0 to 24, default 15), `wind` (0 to 2.5), `cell` and `height`. It sizes to its container's width. The scene behind it runs edge to edge in that hour's colours, as on the home page.

A flower reads only when all four of these hold. The full-garden renderer must meet them too:

- **Size.** The head spans at least `specimen-head` (14) cells. Below that it is a coloured smudge: keep far plants as texture and give the foreground a few heads at specimen size.
- **Outline.** Petal and leaf edges print line glyphs (`- \ | /`) along the contour, not density glyphs. The silhouette carries the species. Interiors stay light, and the colour comes from a faint tile behind.
- **Centre.** Every open head has a `disc` mark printed `@` or `#`, the darkest thing in it. A poppy without its black centre reads as a red blob.
- **Stalk.** A continuous `stem` line from ground to head, printed in line glyphs. Grass in front never hides it.

Petal outlines print paler than the petal, more so at night, so a violet night poppy keeps its edge on a dark ground.

Do: use it on project pages and as the loading state. Don't: put body text over it, or shrink it below 200px tall.
