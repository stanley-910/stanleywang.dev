# HeroText

The home page's bio: plain paragraphs and a row of links, set straight on the meadow, which runs full bleed in full colour.

Provide the bio as `children` and `links` for the row under it, and optionally `hour` and `veil` (0 to 1, to show the hand-off to another page). Keep the copy exactly as written. There is no name or heading: the bio opens the page.

Placement follows the koi pond page. On the live site the left gutter is 20vw from 1024px up (`gutter` below that), the bio sits `hero-bottom` (128px) above the foot, and it runs at most `measure` (54rem) wide. The greeting is followed by a blank line; the link row sits 24px under the bio (`space-3` plus 6px), closer than that, as the bio's sign-off. The preview scales these to its frame.

Readability comes from the ground, not a box. The text sits on the scene's dark ground at every hour, so it is always `scene-ink`, even when the page theme is light. Grass near it thins to 38% within 11 cells. Flowers are never planted where their heads would land on the text; their stalks may pass behind it. Never add a panel or scrim.

"Hide text" lives in the site menu (SiteHeader), on home only. It fades all the UI out over 400ms, the bio, links and the bar's words, so the visitor can play in the meadow alone, and lifts the grass fade behind them. The menu's dots go too and come back while the pointer is near the top-right corner; the menu then offers "show text". Escape or a reload also brings everything back, and leaving home resets it. The flowers still keep clear of where the text was; the layout isn't rebuilt.

Leaving home, fade the bio out in 0.2s, then let the veil close (`veil-duration`). Coming back, lift the veil and bring the bio back 0.6s later.

`garden={false}` drops the demo scene, for use over the real canvas.
