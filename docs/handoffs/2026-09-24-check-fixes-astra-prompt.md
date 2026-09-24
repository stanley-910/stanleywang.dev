You are fixing bugs and making small design changes in a Next.js page, then leaving the changes uncommitted for review.

Working directory: /Users/stanley/worktrees/stanley-wang/2026-09-24_check-link-fixes (a git worktree on branch `compiler-check-fixes`). Edit only files inside it. Do not commit, do not touch other checkouts, and do not run the dev server (another one is already on port 3107).

The page is a dev-only animated compiler walkthrough at `/projects/mini-c-prototype`: `app/projects/mini-c-prototype/`. The files you will mostly need are `animated.tsx` (the component, ~2500 lines), `animated.css`, `scope-tree.tsx` (the scope list in the note card), `link-route.ts` (the router for name links) and `scopes.ts`. `docs/handoffs/2026-09-24-compiler-showcase-live-markup.md` records how the check phase works, especially the sections "Name link routing", "Name pass: declarations, tint, found", "Type pass" and "Scopes, links and parse edges". Read those first. Your own earlier answer for this phase is `docs/handoffs/2026-09-24-check-visual-astra-answer.md`.

Useful facts:
- A URL like `?example=loop&frame=98` opens a preset at a step. The Check phase first resolves names (`check.declare` / `check.resolve` / `check.unresolved` steps, then one `check.namesDone` step), then checks types. The Type Analysis intro slide sits on the `namesDone` step (`slide > 0`); `typing` in `animated.tsx` turns on from that slide and lays the tree out wider (`typedTree`) to make room for type badges.
- Name links are routed once per step and stage size (`linkRoutes`, cached in `routeCache` by `index|typing|sceneWidth|sceneHeight|narrow`) and drawn as `motion.path`s (search for `className="ac-link"`). A route with `clean === false` is not drawn.
- Tree edges are plain paths recomputed every render.
- The editor marks the current step's span with a `<mark>` whose class is `ok` on a resolve step (search `frame.why.kind === 'check.resolve'` near the `<pre aria-label="Highlighted source">`).
- In the tree, once the name pass is done, a declaration is filled green and a use is outlined green (`.ac-piece.node.found` and `.found.use` in the CSS).

The owner, Stanley, reported the following while stepping through the page. The attached screenshots are his, in this order:
1. Parser, loop, step 46/179.
2. The scope list in the note card at the end of the name pass (loop).
3. Check, a custom program (loop plus `int n;`), step 101/185, during the type pass.
4. Check, loop, 98/179: the name pass's last step ("Every name has a declaration"), all links green.
5. The same step with the Type Analysis slide open: the links have rerouted around the wider typed layout.
6. Custom program, 94/185: resolving the target `i` on line 4.
7. Custom program, 97/185: resolving the target `sum` on line 6.
8. The scope list, custom program: `block` with an empty scope `–` under a dashed rail.

His points, with his words quoted:

A. Screenshot 1: "it starts within the token tray, from state 1 to state 2". The first AST node (`main`) lands inside the token tray's rows instead of below it. The tree's top was recently raised (`point()` returns `{ x, y: top + y - 110 }` for parse and check); with a four-row tray (loop) the root collides with the tray. The tree should start just below the tray, whatever its height, without jumping between parse and check.

B. Screenshots 4 and 5: "all the links move since we move into type analysis, but I don't need the links to move they can disappear." On the Type Analysis slide and in the type pass, the links from the name pass shouldn't reroute; they should go. Also: "on the last slide when they all link it only needs to stay for 3 seconds and can disappear." On the `namesDone` step, after they have all landed, the links should stay about 3 seconds and then fade out (reduced motion: no timed fade is fine, just decide something sensible and say what).

C. "as we link while stepping through the decl should light green before the string gets there, so it reduces the total time spent on animation its not link then light, its link and light at the same time." On a resolve step the declaration currently turns green only after the link has landed (the `ok` path and the found tint wait for `landed`). Make the declaration light up and the link draw at the same time, so a step's animation is shorter.

D. Screenshots 6 and 7: "inside code editor it should be usage dark green like in the final state, and decl bright green." In the editor on a resolve step, the use's mark should be the dark green that uses have in the tree when the pass is done, and the declaration's text in the editor should be marked too, in bright green. Only the current step's pair is marked.

E. "sometimes after flipping states, lines won't appear at all." Stepping back and forth, a step's link sometimes doesn't show. Find every cause: stale or missing cache entries, `clean === false` routes, AnimatePresence keys that are reused across steps so exit/enter don't replay, paths whose `pathLength` animation starts from a finished state, and anything else. Fix the causes; if a route can't be made clean, still draw something rather than nothing, and say what.

F. "upon resizing, the gray link travels with the resize but the green one is like an image on top that travels and lags behind." Tree edges update immediately on resize; the green link animates its `d` (and the router runs per size), so it trails. Links should follow a resize as immediately as the edges do; keep the draw-in animations for step changes only.

G. The scope list (screenshots 2 and 8): "i understand we are inside block, but there's no decls in here, so what's the point of having it? maybe a current scope kinda constant like a debugger window thing?" Decide how an empty scope should read. Recommendation to weigh: behave like a debugger's scope/locals panel, where the scope the current name is used in is always marked as "current" (even if empty) and empty scopes that aren't current are left out. Pick one, implement it, and explain it.

H. "lets put this scope table in the canvas itself, either whichever corner there's most space, dependent on tree growth." Move the scope list out of the note card and onto the stage during the name pass, in whichever stage corner has the most free space given the tree's layout on that step (the tree grows as parsing adds nodes, and its bounding box is known from the piece boxes). It must not overlap tree pieces or links' routes where avoidable, should not jump between corners on every step (prefer a corner chosen once per program/layout and only move if the tree would cover it), must scroll or shrink sensibly when it doesn't fit, and must still work on a narrow stage. Remove it from the note card, and undo the note card's height changes that only existed to make room for it if they're no longer needed.

Also look for bugs closely related to these (link timing, link visibility, the name-pass tints, the scope list) and fix any you find; list them.

Constraints:
- Match the code around you: its comment density and tone (short plain comments explaining why), naming and idioms. Keep UI labels terse.
- Don't change user-facing copy in `explain.ts` or the slides beyond what these fixes need; if you must add a label, keep it to a word or two and mark it as a draft in your summary.
- Keep everything reconstructible from the step index (seeking straight to a step must land on the same state), and respect reduced motion (`reduced`).
- Don't modify anything outside `app/projects/mini-c-prototype/` and `docs/handoffs/`.
- When done, run `npx tsc --noEmit -p .`, `npx eslint app/projects/mini-c-prototype/` and `npx prettier --check app/projects/mini-c-prototype/`, and fix what they report.
- Add a short section to `docs/handoffs/2026-09-24-compiler-showcase-live-markup.md` describing what changed, in the style of the existing sections.

Your final message: for each of A–H, the cause you found and what you changed (file and function), then any extra bugs found, then anything you couldn't verify without a browser and exactly which URLs and steps a reviewer should check.
