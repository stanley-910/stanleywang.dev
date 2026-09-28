Found **seven issues** in the fix delta. The live files match the supplied “after” snapshot. TypeScript checking passed; no files were edited. Reproductions below were checked through source inspection and extracted-code harnesses.

1. **P2 — Strict Mode permanently disables following.** [animated.tsx:1950](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:1950)  
   **Reproduction:** Open the page in `next dev`, then step through Emit. Strict Mode’s effect cleanup clears the timeout but leaves `followTimer.current` nonzero. Every subsequent scheduling attempt returns immediately. The harness produced **zero callbacks and zero pending timers**, with the ref still set. This repository enables [React’s Strict Mode effect replay](https://react.dev/reference/react/StrictMode#fixing-bugs-found-by-re-running-effects-in-development).  
   **Fix:** Clear the timeout **and reset the ref to `0`** during cleanup.

2. **P2 — Ordinary wheel events become pinch events after the rail releases its grip.** [rail-curve.ts:408](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/rail-curve.ts:408)  
   **Reproduction:** Continue a non-Ctrl wheel transaction targeting the original grip after `letGo()`. The newly added `!gripped` branch forwards it with hardcoded `ctrlKey: true`. The harness confirmed `false → true`; over the canvas, this selects zoom instead of pan.  
   **Fix:** Preserve `e.ctrlKey` and the other relevant modifiers. For native scrolling panes, synthetic dispatch also needs an explicit scrolling fallback.

3. **P2 — Following can still interrupt rubber-band recovery.** [canvas-zoom.ts:401](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/canvas-zoom.ts:401)  
   **Reproduction:** Pull beyond a canvas boundary, release, and let a pending follow fire shortly after the 300ms input window. In the harness, `busy()` was false at **301ms**, while the canvas remained **13.7px outside its boundary with a spring frame pending**. `panBy()` can replace that recovery spring.  
   **Fix:** Track user-owned recovery until it finishes. Distinguish it from automatic follow springs so normal stepping remains responsive.

4. **P2 — The throttle does not guarantee that the latest step has landed.** [animated.tsx:1925](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:1925)  
   **Reproduction:** Take two steps 400ms apart at 1×, then stop. The timer fires at 450ms using the latest callback, **only 50ms into its 420ms animation**. It schedules no trailing correction. Moving nodes can therefore be measured mid-transition, and exiting `.current` rows remain eligible.  
   **Fix:** Keep the throttle, but add a guarded final follow after the latest transition completes; select the current instruction by identity rather than the last `.current` element.

5. **P3 — Cancelling a drag consumes the next unrelated click.** [animated.tsx:3434](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:3434)  
   **Reproduction:** Move a node beyond the drag threshold, cancel the pointer, then click another node. Cancellation clears `nodeDrag`, but leaves the shared `dragClick` flag set. The harness confirmed that the next ordinary click does nothing.  
   **Fix:** Clear suppression on cancellation and scope it to the completed pointer gesture. Expire it when that gesture cannot produce a click.

6. **P3 — Fading one rail axis disables resize tracking for the other.** [rail-curve.ts:553](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/rail-curve.ts:553)  
   **Reproduction:** Light both axes of a pane, keep its vertical rail hovered, and let the horizontal rail fade. `unobserve(pane)` removes observation for the entire element, although its vertical light remains. A subsequent animated resize can again leave the stationary grip stale. The extracted lifecycle confirmed this state.  
   **Fix:** Unobserve only after the pane’s last light disappears. Also unobserve disconnected panes when removing their lights.

7. **P3 — Double-click reset now leaves the card toggled.** [animated.tsx:3453](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:3453)  
   **Reproduction:** Double-click a displaced node with its card collapsed. The first click opens it; the second is ignored; double-click resets the node. The card remains open. Previously, two toggles restored its original state.  
   **Fix:** Arbitrate single/double-click actions, or provide a separate reset action. Ignoring only the second click is insufficient.

**Fix verification**

| Review | Verified | Remaining problems |
|---|---|---|
| Side pane | **1:** docking pane remains open and non-inert. **2–3:** effective width cap and current-value refs. **4:** generation guard rejects superseded fold completion. **7:** slide phase and forward-only lookup. **8:** folded controls become inert. **9:** resize values are exposed. Mouse `preventDefault()` is present on the stack. | **5:** modifier corruption above. **6:** observation lifetime bug above. |
| Listing/drag | **1:** measured right extent feeds canvas bounds; intrinsic minimum width is present. **3:** canvas-coordinate conversion and touch exclusion. **4:** position clamping, visible fit action, and `0` reset. **2:** capture, identity/button guards, and drag-state cleanup are present. | **2:** click suppression survives cancellation. **5:** recovery spring is unprotected. **6:** Strict Mode and settling problems. **8:** persistent card toggle. |
| Codegen | **1:** source implements the requested diagnostic-or-class-crash policy and rethrows other runtime exceptions. **2:** LF/CRLF spans exclude line terminators. Existing browser bundle passed class-failure cases, cleared partial instructions, and successfully compiled a subsequent valid program. | No additional defect established in this scoped change. |

The follow callback reads the latest committed closure, and its timeout does **not** survive a true unmount. Normal programmatic stepping does not itself trigger `busy()`. Initial notes `room = Infinity` still produces finite widths through `Math.min`; it is not an infinite CSS width. Canvas events coalesce through the rail’s RAF guard; no performance defect was established.

Live click/focus behavior and intrinsic-width/lane layout remain visually unverified: Computer Use denied access with “not approved to use Helium.”

