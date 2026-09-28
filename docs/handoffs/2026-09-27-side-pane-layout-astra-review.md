I found **seven bugs and two risks**. References use the supplied snapshot’s line numbers. Validation used source inspection and in-memory harnesses; browser automation was unavailable. No files were edited.

1. **Bug — undocking the stack removes its redocking target.** [animated.tsx:2248](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:2248)  
   **Reproduce:** In Emit, drag the stack out, wait for the fold, then drop it back below the source. Setting `stackAt` folds `noteRef` down to its border, but `StackColumn.onCard()` still requires the floating stack’s centre to fall inside that rectangle. Redocking becomes effectively a one-pixel target.  
   **Fix:** Keep a usable docking region independent of the folded pane, or reopen the pane while dragging over the editor.

2. **Bug — a saved wide note becomes clipped on a narrower viewport.** [note-window.tsx:288](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/note-window.tsx:288)  
   **Reproduce:** Resize notes to 480px, then narrow the viewport to phone width. The section’s CSS `max-width` shrinks it, but its body remains 478px wide. The window clips the right-hand text and scrollbar. Loading and resize observation clamp position, not dimensions.  
   **Fix:** Constrain the effective dimensions whenever bounds change and make the body follow the rendered window width.

3. **Bug — dragging the clipped corner uses a stale width.** [note-window.tsx:202](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/note-window.tsx:202)  
   **Reproduce:** Load or resize an open window to 400px, hover to expose the dog-ear, then drag from its clipped triangle. The document handler captures `current()` from the initial render, when `place` is null; its width remains 264px until `shut` changes.  
   **Verified:** A 10px outward drag changed 400px to **274px**, instead of 410px.  
   **Fix:** Read the latest place through a ref, or measure the actual rendered width when the press begins. The comment claiming `current()` reads only refs is incorrect.

4. **Bug — an interrupted fold runs its obsolete completion handler.** [animated.tsx:2348](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:2348)  
   **Reproduce:** Start opening the pane, then return to the welcome before 350ms expires. Cleanup calls `move.stop()`, which resolves the animation’s promise in installed Motion 11.15.0. The old `settle()` subsequently clears the replacement animation’s height and changes `data-fold`, switching its flex rules mid-animation.  
   **Verified:** The installed `GroupPlaybackControls.then()` fires after `stop()`.  
   **Fix:** Invalidate the completion callback before stopping—using a cancellation flag or generation counter—and let only the current animation settle the DOM.

5. **Risk — pinch forwarding loses subsequent events targeting the original grip.** [rail-curve.ts:399](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/rail-curve.ts:399)  
   **Reproduce:** Begin a continuous Ctrl+wheel/trackpad pinch over a rail. Its first event calls `under()`, which clears `gripped`. Subsequent events delivered to that original grip return before forwarding **or cancelling**. Wheel transactions can retain their original target. [UI Events specification](https://w3c.github.io/uievents/split/wheel-events.html#events-wheelevents)  
   **Verified:** Two consecutive events targeting the grip forwarded only the first; the second remained uncancelled. Actual browser delivery needs device testing.  
   **Fix:** Retain a forwarding target for the gesture independently of hover/grip state, and handle modified-wheel forwarding before the `gripped` guard.

6. **Risk — idle rails do not reliably wake for animated geometry changes.** [rail-curve.ts:533](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/rail-curve.ts:533)  
   **Reproduce:** Let a hovered rail settle, then keep the pointer stationary while autoplay folds its pane or a programmatic canvas transform moves it. Those changes need not generate any registered wake event. Even a single wake can stop immediately: `moving` checks glow and longitudinal thumb position, but not horizontal position, clipping or track size.  
   **Verified:** After an idle rail moved horizontally by 100px in the harness, no RAF was pending and its grip remained at the old coordinate.  
   **Fix:** Subscribe to canvas-transform updates and pane/layout changes, retaining redraws for the duration of those animations.

7. **Bug — phase-introduction slides retain the previous phase’s pane.** [animated.tsx:2235](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:2235)  
   **Reproduce:** On Precedence, click Parse: its introduction displays the lexer’s delimiter list with `}` highlighted. Check’s introduction retains expression kinds; Registers’ introduction retains the stack instead of folding. `paneKind` and `nearest()` use the underlying previous-phase frame, while the tab and note use `shownPhase`.  
   **Fix:** Derive the pane’s phase/pass from the displayed slide, and search within that incoming pass with an explicit “ahead, unhighlighted” state.

8. **Bug — the folded source separator remains an invisible keyboard control.** [animated.css:576](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:576)  
   **Reproduce:** At the welcome or in Registers, Tab through the editor. “Resize source” remains focusable inside the clipped pane. Arrow keys still modify and persist `sourceHeight`, although the control is invisible. `pointer-events: none` only disables pointer interaction.  
   **Fix:** Remove the folded controls from keyboard/accessibility navigation, and move focus to a visible control if folding hides the currently focused separator.

9. **Bug — the new notes resize widget exposes no size to assistive technology.** [note-window.tsx:299](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/note-window.tsx:299)  
   **Reproduce:** Focus “Resize notes” with a screen reader and use its arrows. Neither its current dimensions nor limits are exposed. A focusable `separator` requires a current value; this one also changes two dimensions while declaring only a horizontal orientation. [WAI-ARIA splitter guidance](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)  
   **Fix:** Provide accessible dimension controls, or expose meaningful value/range information and explain both supported resize axes.

**Checked and found sound:**

- Canvas bounds retargeting, reduced-motion snapping, overflow restoration and reacquisition passed the harness. Combined touch/gesture input produced **1.2×**, not 1.44×.
- Firefox’s scaled scrollbar thresholds and the rail’s ordinary stage-clipping calculations are corrected. Coarse-pointer touch no longer receives the blanket overscroll containment.
- `typedShift` applies `squeeze` consistently with node positioning; badge room uses a maximum rather than addition. Overflow remained finite and nonnegative across 108 reference/phase/width cases. No additional defect established in the backdrop’s shared assembly transform.
- `nearest()` completed ordinary, detailed, early-error and teaching-trace scans without exceptions; the slide-boundary issue above remains.
- Dog-ear listeners clean up and do not rebind every render. Rolled-up handling and the nonanimated `@property` fallback appear sound.
- The nested-bracket change correctly walks past inner `]` tokens. No additional defect established in that tracer fix or the copy/chip changes.

