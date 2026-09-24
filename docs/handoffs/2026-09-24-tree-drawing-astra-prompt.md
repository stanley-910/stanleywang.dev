# Prompt: review how the AST is laid out and its edges drawn

## Context

`/projects/mini-c-prototype` is an animated walkthrough of a small C compiler.
The parse, check and emit phases draw the AST as a tree on a stage. Nodes are
monospace text labels (operators, literals, `return`, `main`, `int x`, `sum =`);
edges are SVG cubic curves from a parent's bottom to a child's top.

The author keeps spotting uneven geometry:

1. First report: in `return 4 + 2 * 3`, the edge from `+` to `4` was twice as
   long as the one from `+` to `×`. `treePositions` centred each parent over
   its whole span, and `×`'s span is wider than `4`'s.
2. I changed it to put a parent midway between its first and last child,
   clamped so its label stays inside its own span. `+`→`4` and `+`→`×` are now
   even (53px / 52px).
3. Second report (attached screenshot): `return` → `+` is now off vertical.
   `+` sits at x=29.0 but `return` is clamped to 29.6 (half its label width
   plus gap from its span's left edge), and `main` follows `return`. So any
   single-child chain above an off-centre operator leans slightly, and the
   dashed "held" edge from `return` to `+` shows it.

Rather than patch the clamp, I want a review of the whole layout and edge
drawing so it stops producing these.

## Read these (read-only; do not edit anything)

Working directory: `/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase`

- `app/projects/mini-c-prototype/trace.ts`: `treePositions` (span measure,
  placement, the new midpoint + clamp, row gaps that grow with fan-out).
- `app/projects/mini-c-prototype/animated.tsx`: `point()` (tree units →
  stage units: `spread`, `fit`, `treeLeft`, the vertical `band`/`top`, the
  late-phase 11/12 squeeze), `px()` (stage units → pixels), the edge paths
  (search for `const d = \`M ${px(` : tree edges, held stubs `.ac-held`, group
  brackets `.ac-group`, check-phase links), and how labels are placed
  (`.ac-piece`, `translate(-50%, -50%)`, `scale: fit`).
- `app/projects/mini-c-prototype/parse-view.ts`: during parse, unattached
  nodes are shifted into their holder's slot; the held stub is drawn from
  the holder to the shifted child.
- `app/projects/mini-c-prototype/animated.css`: `.ac-edges`, `.ac-held`,
  `.ac-group`, `.ac-piece`.
- `app/projects/mini-c-prototype/reference/*.trace.json`: six preset trees
  (loop, precedence, parentheses, function call, local variable, unresolved
  name) to test a layout against. The page calls
  `treePositions(trace, (n) => n.label.length * 7.2 + 2)`, gap 14.

## Questions

1. What layout algorithm should `treePositions` use? I suspect a tidy-tree
   (Reingold–Tilford / Walker, or Buchheim's linear version) with label
   widths as node sizes, so parents centre over their children *and* nothing
   overlaps, without a clamp. Confirm or propose better, and say concretely
   how to adapt it here: variable label widths, the existing fan-out row
   gaps, multiple roots, and keeping the parse-view "slot" shifting working
   (it relies on the finished layout's positions).
2. Invariants the layout should hold, stated so they can be asserted in a
   check script: e.g. a single child is exactly under its parent; a parent is
   centred between its outer children; no two labels in a row overlap; a
   subtree's shape doesn't depend on its siblings. Which of these conflict,
   and which should win?
3. Review the edge drawing: the cubic from `(p.x, p.y + r)` to
   `(q.x, q.y - r)` with both control points at the mid row, the fixed
   radius `r`, what happens with `fit` < 1 and the stretched stage (x and y
   scale differently), the held stub, the group brackets. Anything that makes
   edges look uneven, stop short, or overlap labels? Should edges leave from
   a single point under the parent or fan out along its bottom edge?
4. Anything in `point()` that would reintroduce unevenness after a correct
   layout (rounding, the 11/12 squeeze, `spread` capped at 3, the vertical
   band)?
5. Give the smallest concrete change set, in order, with pseudo-code for the
   layout. Say which preset trees change visibly and how.

Keep it concrete and under ~1500 words.
