Use a **width-aware Buchheim tidy tree**, then calculate edge attachments in CSS pixels. The clamp and the edge offsets are separate defects.

I checked all six presets with an in-memory prototype. No files were changed.

For [`treePositions`](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/trace.ts:792), your proposed algorithm is appropriate. Preserve child order, separate subtrees using their contours at each depth, and centre parents between their outer child centres. A wide parent enlarges the subtree’s contour; it never needs clamping.

D3’s Buchheim implementation would keep this change small. Use `nodeSize([1, 1])` and a separation function returning `(width(a) + width(b))/2 + gap`. Variable widths belong in separation; avoid `.size(...)`, which normalizes the result into a prescribed rectangle. [D3 tree documentation](https://d3js.org/d3-hierarchy/tree)

Concrete pseudocode:

```text
roots = all parentless nodes, preserving source order
root = invisible parent of roots

buchheim(
  root,
  nodeSize = [1, 1],
  separation = (a, b) => width(a)/2 + 14 + width(b)/2
)
// Contour conflicts translate whole subtrees;
// parents centre between first and last child centres.

nodes = descendants excluding invisible root
if empty: return empty layout

level[n] = depth[n] - 1
lo = min(x[n] - width(n)/2)
hi = max(x[n] + width(n)/2)
x[n] += 7 - lo
width = hi - lo + 14

rowGap = existing fan-out calculation using final x and integer levels
rowY = prefixSum(rowGap)
y[n] = rowY[level[n]]
return positions, width, depth = last(rowY), levels = max(level)
```

Use `trace.root` to identify the principal root without silently dropping other parentless nodes in partial/error traces. Exclude the invisible root from row-gap calculations.

[`parseView`](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/parse-view.ts:117) can retain its existing shift calculation: `holderShift + slotPosition − nodePosition`. Keep one finished layout throughout playback. Attached descendants continue inheriting the same translation.

A finished tidy layout does **not** prove every temporary parse arrangement is collision-free: a wide descendant can temporarily occupy a narrow ancestor’s slot. All six presets passed my shifted-label rectangle checks at 680×480, 500×860 and 320×300 using the current width estimate.

The layout’s assertions should be:

- **Unary alignment:** `abs(x[parent] − x[child]) < ε`.
- **Parent centring:** `abs(2*x[parent] − x[first] − x[last]) < ε`.
- **Row clearance:** adjacent label intervals have at least `gap − ε` between them.
- **Order:** children and subtrees retain source order.
- **Horizontal subtree independence:** laying out a subtree alone preserves every `x[node] − x[subtreeRoot]`.
- **Reflection:** reversing every child list reflects the horizontal layout.
- **Bounds:** every label interval lies within the reported width.
- **Parse preservation:** a moved attached component receives one translation, and its held root lands exactly in its holder’s slot.

Use floating-point tolerance, not integer rounding.

These horizontal requirements coexist. **Full two-dimensional subtree independence conflicts with the current global row gaps:** another parent’s fan-out can enlarge a shared row. Keep aligned rows and fan-out spacing; restrict independence to horizontal layout coordinates. Viewport fitting also changes screen distances, so assert independence before projection.

Equal edge lengths are appropriate for a binary pair with equal-height children. They are not a general requirement for every child of a many-child parent. Fixed viewport height, readable labels and arbitrarily deep trees also cannot all be guaranteed.

The ordinary cubic in [`animated.tsx`](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:1298) is sound: mirrored endpoints produce mirrored curves. Its **endpoint offsets use the wrong units**, however.

`r = 11 * fit` passes through `px()`, becoming:

```text
edge offset = 11 × fit × sceneHeight / 480 CSS pixels
label half-height = 11 × fit CSS pixels    // normal desktop label
```

At scene height 860, that leaves approximately `8.7 × fit` pixels between the endpoint and the label box. On mobile, the offset becomes 6.875 pixels at `fit=1`, while the 20-pixel label needs 10. Late labels also have height 20, but the renderer still uses 11.

Convert centres to pixels first, then construct ports:

```text
P = parentCentrePx + (0, parentHeightPx * fit/2 + clearancePx)
Q = childCentrePx  - (0, childHeightPx  * fit/2 + clearancePx)
mid = (P.y + Q.y)/2
path = M P C (P.x, mid), (Q.x, mid), Q
```

Require `Q.y > P.y`; insufficient space needs a larger row gap or smaller labels. Keep the SVG’s existing pixel-sized viewBox—the old stretched-path-length problem has already been addressed.

Keep **one bottom-centre port per parent**. It makes operators read naturally and preserves mirrored binary branches. Fanning attachment points across a one-character operator adds little space and makes geometry depend unnecessarily on label width.

Other edge findings:

- **Held edges:** use the same port/path helper with the shifted child position. They currently duplicate the ordinary-edge formula. Their `2 3` dash pattern can leave the last visible dash short even when the path endpoint is correct; a small solid terminal mark can make contact explicit.
- **Group brackets:** horizontal padding is converted from pixels, but vertical padding `18` and curvature offsets `5` remain stage units. Their appearance therefore changes with scene dimensions. Calculate bounds and curvature entirely in pixels, including preview borders and the visible cue—`one piece` currently extends beyond the measured label.
- **Check links:** their `11` offset ignores `fit`, and their lift mixes horizontal stage distance with vertical stage units. Fixing units will not prevent crossings. At 680×480, the existing function-call link from the second `n` to `int n` intersects `+`; several loop links intersect labels. Route these through obstacle-free lanes around inflated label rectangles.
- **CSS metrics:** [` .ac button`](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:35) overrides the normal `.ac-piece` padding, border and font declarations through specificity. The apparent seven-pixel padding is therefore absent on ordinary nodes. Establish deliberate computed dimensions before changing the width estimate; do not blindly add padding from the `.ac-piece` rule.

[`point()`](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:856) does **not** round coordinates. Its common affine transformations preserve unary alignment and horizontal midpoint symmetry, including under unequal x/y scaling.

The remaining caveats are:

- `spread ≤ 3` changes overall spacing, not symmetry. A more compact tree may simply receive more expansion.
- The `11/12` squeeze also preserves symmetry. Below the spread cap it cancels out of position scaling, while affecting `fit`; remove this separate adjustment and use explicit label metrics consistently.
- The vertical band preserves relative row-gap proportions, but caps their total height. Deep trees can lose label clearance. The current “plain row keeps its height” comment only holds before that cap, within a fixed tree depth.

The smallest change set, in order:

1. Make label dimensions explicit and consistent between CSS and geometry.
2. Replace span allocation/clamping with Buchheim; retain the row-gap pass and parse shifts.
3. Share pixel-based bounds and ports across ordinary edges, held edges and brackets; remove the independent squeeze.
4. Give check links obstacle-aware routes, then run layout and rendered-geometry assertions across presets, forests, wide unary labels and parse frames.

With today’s width estimate and seven-pixel outer margins, the prototype changes are:

| Preset | Layout width | Visible effect |
|---|---:|---|
| Precedence | 69.6 → 64.4 | Vertical `main → return → +`; tighter binary branches |
| Parentheses | 69.6 → 64.4 | Fixes the opposite lean above `×`; tighter branches |
| Loop | 444 → 346.6 | Largest compaction; descendants share previously empty space; first row gap falls from 1.6 to 1.4 |
| Local variable | 157.6 → 148.8 | Statement branches move closer |
| Function call | 177.6 → 174 | Function subtrees move slightly closer |
| Unresolved name | 89.6 → 89.6 | Horizontal layout unchanged |

Those are layout widths; final screen distances also depend on `spread`.