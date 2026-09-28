I found **seven bugs and three risks**. Line numbers refer to the supplied snapshots. I made no edits; validation used source inspection and in-memory harnesses, not physical browser/device testing.

1. **Bug — bounds changes leave the canvas stranded outside its bounds.** [canvas-zoom.ts:348](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/canvas-zoom.ts:348)  
   Start an automatic pan in Emit, then switch to a phase without horizontal overflow before the spring finishes. `size()` skips settling while a spring exists, and that spring finishes at its obsolete destination. Resizing has the same problem: the observer clamps once, then the next animation frame overwrites it.  
   **Verified:** shrinking content from 1600 to 800px in an 800px viewport left `x = -600`, although the only valid position was `0`.  
   **Fix:** cancel or retarget active springs whenever bounds change; ensure completion uses current bounds.

2. **Bug — one-finger page scrolling is trapped over stage panes.** [animated.css:753](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:753)  
   On touch, reach the assembly pane’s bottom and swipe upward with one finger. `.ac-canvas * { overscroll-behavior: contain }` prevents the gesture from continuing onto the page. This also affects non-overflowing scroll containers and `overflow: hidden` descendants. Leaving single-touch events uncancelled does not override that CSS behavior. [MDN documents this boundary behavior.](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overscroll-behavior)  
   **Fix:** allow touch scroll chaining; scope containment to mouse/trackpad interaction or handle wheel routing explicitly.

3. **Bug — custom rails and their invisible grips escape the stage’s clipping bounds.** [rail-curve.ts:259](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/rail-curve.ts:259), [rail-curve.ts:483](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/rail-curve.ts:483)  
   Zoom a tall assembly pane to 2×, pan until it extends beyond the stage vertically, then scroll or hover its rail. The body-mounted canvas draws against the pane’s full transformed rectangle; its grip uses that same full rectangle. The rail paints outside the stage, and the invisible grip can intercept input there.  
   **Fix:** intersect drawing and grip bounds with the stage and other clipping ancestors, preserving full-track coordinates for scroll calculations.

4. **Bug — reduced motion does not disable canvas springs.** [canvas-zoom.ts:165](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/canvas-zoom.ts:165)  
   Enable reduced motion, wheel past a boundary, and release. `settle()` unconditionally starts the JavaScript spring. Only Fit, `0`, and programmatic pans receive the preference; CSS cannot disable this RAF animation.  
   **Fix:** pass the preference into `startCanvas` and clamp immediately when reduced motion is requested.

5. **Risk — Safari touchscreen pinch can be applied twice.** [canvas-zoom.ts:277](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/canvas-zoom.ts:277), [canvas-zoom.ts:307](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/canvas-zoom.ts:307)  
   Both `gesturechange` and `touchmove` independently apply pinch scaling, without arbitration. Safari’s documented event model delivers gesture events during multitouch sequences. Feeding both paths a single 1.2× pinch produced **1.44×** in the harness. Actual delivery under the current cancellation/CSS combination needs iOS testing. [Apple’s event documentation.](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html)  
   **Fix:** select one input path per gesture; ignore gesture scaling while an owned touch pair is active.

6. **Bug — pinching over a custom rail scrolls instead of zooming.** [rail-curve.ts:354](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/rail-curve.ts:354)  
   Hover the assembly rail until its grip appears, then Ctrl+wheel or trackpad-pinch. The grip is outside the scene, so the canvas listener never receives the event. Its own listener cancels it and calls `scrollBy`, ignoring `ctrlKey`. Verified with the handler harness.  
   **Fix:** route modified wheel events over stage rails through the canvas zoom handler, retaining pointer coordinates.

7. **Risk — the page overflow lock survives interrupted hover.** [canvas-zoom.ts:326](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/canvas-zoom.ts:326)  
   Hover the stage, switch applications/tabs using the keyboard, move the pointer while the page is inactive, then return without a delivered `pointerleave`. The document remains `overflow-y: hidden`; keyboard page scrolling stays blocked until hover state changes. There is no blur, visibility, or page-hide cleanup.  
   **Fix:** release on those lifecycle events, restore the previous inline value, and reacquire only after establishing current hover. Unmount cleanup already works.

8. **Bug — Firefox’s scrollbar hover detection mixes scaled and unscaled coordinates.** [animated.tsx:1009](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:1009)  
   In Firefox, zoom to 0.5× and hover the assembly scrollbar. The fallback compares viewport coordinates against `box.left + clientWidth`, without scaling `clientWidth`. That threshold can lie beyond the pane’s actual right edge, so hovering does not reveal the transparent thumb. At 2×, ordinary content can be mistaken for scrollbar space.  
   **Fix:** scale client dimensions and borders as `railOf()` does, preferably through shared geometry code.

9. **Bug — nested brackets truncate source array-size labels.** [ParseTrace.java:1623](/Users/stanley/worktrees/mini-c-compiler/2026-09-25_showcase-traces/src/test/util/ParseTrace.java:1623)  
   Input `int main(){ int a[b[2]]; return 0; }` produces **`int[b[2] a`**. The scan stops at the inner `]`, then mistakes it for the declaration dimension’s closing bracket. The parser correctly rejects this size, but the new error-path label misrepresents the source.  
   **Fix:** match brackets with nesting depth and extract the complete dimension’s source span.

10. **Risk — resting on a rail keeps a rendering loop running indefinitely.** [rail-curve.ts:493](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/rail-curve.ts:493)  
    Hover a rail and leave the pointer stationary. `resting` keeps its light alive, and `lights.size` keeps scheduling RAF indefinitely. Each frame measures geometry, writes grip placement, and redraws the full rail. The harness confirmed continued scheduling after settling.  
    **Fix:** stop scheduling once glow and position converge; restart on scroll, pointer, resize, or canvas-transform changes.

**Checked and found sound:**

- `0` respects the textarea/input/contenteditable guard and modifier keys.
- Wheel/touch listeners that cancel defaults explicitly use `passive: false`; cleanup removes listeners, observers, timers, and springs.
- Ordinary zoom-about-pointer math, rubber-band inversion, inward movement, and zero-size settling are sound.
- Canvas transforms do not trigger React updates every frame; state changes only when home status flips.
- Hover cards and links share canvas coordinates. Notes and the draggable stack remain outside the transformed layer.
- ParseTrace’s ordinary declaration/struct consumption, pending-container handling, grouped literals, multidimensional literal sizes, and method-name anchor checked out.
- No additional defect established in the notes gutter, literal-copy change, or two regenerated reference traces.

