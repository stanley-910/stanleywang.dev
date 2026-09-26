# Claude 5.1 Fable design review

Code-based review, not a screenshot review. Prompt supplied the initial animated implementation; some findings had been corrected by live checks while review ran.

No screenshot, so everything below is inferred from the source. Items 1–2 rest on documented Motion/DOM behaviour (high confidence); contrast ratios and glyph widths are computed from the hex/px values in the CSS (approximate, not visually verified).

### 1. Nodes and edges don't share a coordinate system (`.ac-piece`, `.ac-edges`)

Three independent causes; the first is the worst.

- `.ac-piece` centers via stylesheet `transform: translate(-50%,-50%)`, but the `motion.button` animates `scale`, so Motion writes `transform` inline on every render (`scale(0.75)` on mount → `none` at rest). The CSS centering is dead from first paint: each piece's *top-left* corner sits on `(p.x, p.y)` while `.ac-edges` draws beziers to the assumed center ±14px. Fix: `transformTemplate={(_, t) => \`translate(-50%,-50%) ${t}\`}` on the piece, or `style={{ translate: '-50% -50%' }}` (CSS `translate` composes with `transform`; Motion never touches it).
- `.ac-edges` has `viewBox="0 0 680 480"` with default `preserveAspectRatio` (uniform, letterboxed) while pieces use `left/top` percentages (non-uniform). They agree only when `.ac-scene` is exactly 680:480. `min-height: 400px` (360/300 at breakpoints) wins whenever the stage is narrower than ~567px — the 620–750px band and every phone. At 375px that's a ~29px vertical letterbox: edges miss nodes by up to that much. Fix: `preserveAspectRatio="none"` on the svg and `vectorEffect="non-scaling-stroke"` on each `motion.path`.
- `initial={{ left: tokenPoint.x - 55, top: tokenPoint.y }}` is px, `animate` is `%`. Motion resolves that by measuring (one forced layout per piece, up to 90), and the px origin is in design units that don't match the rendered box anyway. Use `%` for both and do the fly-in with `x: -55 → 0`.
- `.ac-piece` has no `transition`, so `.focused` border/background snap while position tweens. Add `transition: background-color .2s, border-color .2s, box-shadow .2s`.

### 2. Source auto-scroll hijacks the page (effect on `activeSpan.start`)

`mark.scrollIntoView()` scrolls *every* scrollable ancestor, including the document. `block:'nearest'` is quiet only while the mark is on screen — but the transport sits ~80px under a ~720px card, so on a 13" laptop the editor's first lines are off-screen exactly when someone is using the transport. Then every frame (430–720ms) and every node hover yanks the page. Scroll only the `pre` (it's the `offsetParent` because it's `position:absolute`):

```ts
const pre = sourceRef.current, m = pre?.querySelector('mark')
if (pre && m && (m.offsetTop < pre.scrollTop || m.offsetTop > pre.scrollTop + pre.clientHeight - 30))
  pre.scrollTop = m.offsetTop - pre.clientHeight / 2
```

### 3. The tray and the instruction column break on inputs beyond the four presets

- `.ac-piece.token > span { max-width: 40px; text-overflow: ellipsis }` at 12px mono (~7.2px/char) truncates any token ≥6 chars: `return` renders as `retu…` in the *Tokens* phase of a tokenizer demo, and the "Unresolved name" preset's `missing` too. At ≤620px (`max-width: 21px`) even `main` is cut. Drop the clamps and pack tokens by width (`x += text.length*7.5 + 22`, wrap at ~640 design units) instead of the fixed 12×54 grid.
- The tray grows down 40/row from y=35; the tree band starts at y=210. From 5 rows (49 tokens, well under the 90 cap) unconsumed tokens sit on nodes during Parse. Fix in the view, not `trace.ts`: in `point()` shift/compress the tree's y-range below the tray's last row.
- `.ac-instructions` rows are 32px (12px × 2lh + 8px padding) in a ~600px desktop scene: ~16 fit, the 32-node cap allows ~31, and `.ac-scene-wrap { overflow:hidden }` silently clips the rest — including the `.current` row. Give `.ac-instructions` `max-height: calc(100% - 50px); overflow-y: auto` and scroll `.current` into view the same manual way as #2.

### 4. The narrative is the quietest text on the page (`.ac-operation`, `--ac-muted`, `.ac-transport`)

Frame titles ("Build + from 2 children", "v0 → r0 · reuse storage when a value dies") are the teaching payload and render at 11px in `--ac-muted`. Computed: `#778179` on `#f6f6f1` ≈ 3.7:1, on `#fcfcfa` ≈ 3.9:1; error `#c97956` on light ≈ 3.1:1 — all under 4.5:1 (dark mode ≈ 6:1, fine). Suggest: title span 13px `var(--ac-ink)`, dot/counter stay muted; light `--ac-muted` ≈ `#5f6a62` (~5.2:1); add `--ac-error` ≈ `#9a4b2b` light / `#c97956` dark, and tokenize `.ac-error-mark`'s hardcoded `#f5c9b6/#602c19` (currently a peach block inside the dark editor). Raise the type floor: the 9px labels (`.ac-code-label`, `.ac-phases span`, `.ac-instruction > span`, `.ac-piece small`) → 10px, the 7–8px mobile sizes → ≥9px.

Also: `.ac-transport` is `margin:auto; max-width:740px` under the full 1160px card, so the scrubber is centered on editor+stage while the counter it drives lives in `.ac-stage`. Move it into `.ac-stage` under `.ac-operation`, or make `.ac-operation` the transport row. `.ac-transport input { height: 3px }` on a native range sizes the thumb to the box in Chromium — drop the height, or `appearance:none` and style the track/thumb pseudo-elements. `role="status"` re-announces every 430ms during playback; set `aria-live="off"` while `playing`.

### 5. Editor mode switching uses the wrong overlay pattern (`.ac-source`, `.ac-source-footer button`)

The textarea (z 2) covers the pre (z 1); any click flips `editing`, unmounts the highlighted `pre`, and repaints the textarea in ink — so the trace blinks out on every click, taps on mobile open the keyboard, and simply Tabbing through the page pauses playback (`onFocus → setPlaying(false)`). "Edit source ↗" duplicates a click that already works. Use the standard overlay: pre on top (`z-index:2; pointer-events:none`, always mounted, `aria-hidden`), textarea beneath with `color:transparent; -webkit-text-fill-color:transparent` at all times, `onScroll` syncing `pre.scrollTop/scrollLeft`. Selection and caret show through, the mark stays visible, `editing` only drives the footer label, `onFocus` needn't pause (`update()` already does), and the footer button with its global `document.querySelector` goes away. It also removes the duplicate accessible source ("Highlighted source" + "Edit C source").

### 6. Heading disclosure and copy (`.ac-heading details`, shortcut text, frame 0)

- `details[open]` expands in flow inside a `flex-end` heading: the h1 drops and the workspace shifts ~130px. The `z-index:3` suggests an overlay was intended. Wrap the two `<p>` in a div `position:absolute; right:0; top:calc(100% + 8px); width:310px` with the pane/border styles (`details` is already `position:relative`).
- "arrows: compare layouts" — no arrow handler exists (only Space/j/k). Bind ←/→ to `move(∓1)` or delete the phrase. `j`=prev, `k`=next inverts the j-down/k-up convention; swap.
- First-step nudges are tripled: frame-0 title "Press play. Follow the source into a tree." (in `buildTrace` — coordinate with the primary), `.ac-invitation` "Follow the first token ▶", and the transport ▶. Keep the invitation; make frame 0's title a neutral state ("Ready · N tokens"); and make the 78px `.ac-orbit` ring the button — it reads as the primary control but is a `span`.
- `↗` means disclosure (summary), focus-action (footer button) and decoration (orbit). Use the native summary marker and drop the others. "Reduced-motion preferences are respected." is filler — cut.

Seen, judged non-material: `.animated-compiler` breakout via `left:50%; translateX(-50%)` + `100vw` (scrollbar-width overflow, possible half-pixel text); `Ⅱ` (U+2160) as the pause glyph has unpredictable font fallback; `‹ ›` transport targets are ~28×30px.
