Found **five P2 issues and one P3** in this change. No files edited. Validation used source inspection and in-memory tests; live browser/device testing was unavailable because no browser was connected.

1. **P2 — Changing pane orientation permanently breaks listing follow.** [animated.tsx:3899](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:3899)  
   **Reproduce:** In Emit, resize across the `side`/`foot` threshold, wait for the old pane to exit, then advance. Both panes temporarily share `listingRef` and `instructionRef`; removing the old pane clears refs already attached to the new pane. Subsequent renders do not reattach unchanged refs.  
   **Verified:** Installed React/Motion test: two panes during transition, then one mounted pane with `ref.current === null`. The exiting pane also retains its old duration, so `resizing` does not necessarily make its exit instant—consistent with [Motion’s documented exit-prop behavior](https://motion.dev/docs/react-animate-presence#custom).  
   **Fix:** Keep one stable pane identity across orientations, or give each instance separate refs with guarded ownership.

2. **P2 — Custom scrollbar interaction does not suspend following.** [animated.tsx:3917](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:3917), [rail-curve.ts:341](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/rail-curve.ts:341)  
   **Reproduce:** During playback, drag or wheel over the listing’s custom rail. Its body-mounted grip receives those events; the listing’s handlers never update `listingHand`. The next follow can pull the listing away while it is being manipulated. A touch gesture lasting over 1.5 seconds also outlives the timestamp recorded only at `touchstart`.  
   **Verified:** Extracted handlers recorded manual rail scrolling followed immediately by an automatic smooth scroll.  
   **Fix:** Have the rail notify its owning pane of hand interaction, and retain suppression throughout active dragging/touch scrolling and briefly after release.

3. **P2 — Narrow listings move lanes over instruction operands.** [animated.css:1227](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:1227), [emit-lanes.tsx:104](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/emit-lanes.tsx:104)  
   **Reproduce:** At a 320px viewport, compile a right-nested sum of constants 1 through 18 and 99. The existing compiler produces 20 lane columns, occupying 192px. The assembly’s intrinsic minimum width reserves only its text; the absolutely positioned lanes contribute no width. Their `min()` positioning consequently pulls them left over operands. The header remains at `lanesAt`, further separating it from the lanes.  
   **Fix:** Reserve `lanesAt + lanesW` in the assembly’s minimum width and keep the lanes at `lanesAt`; let the pane scroll horizontally.

4. **P2 — Pinching over the listing’s custom rail is swallowed.** [animated.tsx:3912](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:3912), [rail-curve.ts:428](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/rail-curve.ts:428)  
   **Reproduce:** Hover the listing rail, then Ctrl+wheel/trackpad-pinch. The grip cancels the original event and forwards a synthetic event underneath. The listing is now a sibling of `.ac-scene`, so that event never reaches the canvas zoom listener; synthetic dispatch does not perform native browser zoom either.  
   **Fix:** Explicitly route the gesture to the canvas if that is intended, or preserve native zoom when the underlying pane has no canvas ancestor.

5. **P2 — The new scroll region lacks reliable keyboard access.** [animated.tsx:3912](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:3912)  
   **Reproduce:** In a browser without implicit scroll-container focusability, Tab skips the listing: neither the container nor its rows are focusable. Keyboard users cannot independently inspect hidden assembly. [MDN documents this requirement.](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow#accessibility)  
   **Fix:** Add `tabIndex={0}`, a named region and visible focus styling. Count scrolling keys as hand input and preserve native paging instead of letting the global Space handler start playback.

6. **P3 — Phone graph bounds clip physical-register captions.** [animated.tsx:1685](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:1685)  
   **Reproduce:** Open Loop’s completed Registers phase on the 300px phone stage. The lowest nodes, `v19` and `v2`, sit at approximately `y=272.85`; their captions extend to approximately `301.85`, beyond the clipped scene. At home, canvas bounds provide no vertical panning room.  
   **Fix:** Reserve the complete node-and-caption footprint below the ring, rather than the current 26px margin.

**Checked and found sound:**

- TypeScript checking and `git diff --check` passed.
- Actual listing reconciliation preserved every main instruction row through Emit → Registers and rewritten save/restore expansion. Fallback traces retained the expected current-row marker.
- Canvas tests passed for right/bottom insets, sequential inset/size changes, spring retargeting, graph homing, centre zoom, minimum zoom and user-owned recovery.
- Lane centres use `.ac-asm` layout coordinates correctly; sticky positioning preserves header flow space. `layout={rewrittenFns}` triggers remeasurement after inserted instructions.
- Normal follow scroll math accounts for the sticky header. Trailing follow and Strict Mode timer cleanup are present.
- Tree hover links remain enabled through CFG/liveness; graph appearance disables node dragging. Phone flow mode preserves the full scene height.
- Rail discovery uses overflow inspection, so it finds the new pane; bare-mode selectors target the new scroller.

