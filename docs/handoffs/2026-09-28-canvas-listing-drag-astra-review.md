Reviewed only the delta between the two saved diffs. The tree matched the saved “now” snapshot. No files changed. Findings below are source-backed; browser/device reproduction remains unverified because no browser was connected.

1. **Bug — horizontal assembly overflow becomes unreachable.** [animated.tsx:1835](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:1835), [animated.css:1184](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:1184)  
   **Reproduce:** Open Loop’s Registers phase with a roughly 320px stage. Its listing occupies the right half, and `beqz v7,label_3_while_end` exceeds that column. The layout calculation gives `over = 0`, so the canvas’s right bound remains 320px. Removing `overflow: auto` removes the previous horizontal scrolling path; panning now rubber-bands before revealing the overflow. Live sets can worsen this.  
   **Fix:** Include the listing’s actual horizontal content extent in canvas bounds, including operands and lanes. Give the listing sufficient intrinsic width to avoid overlapping grid columns.

2. **Bug — an abandoned press can later drag a node without a held button.** [animated.tsx:3295](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:3295)  
   **Reproduce:** Press near a node’s edge, leave it before capture begins, release outside, then hover another node. `nodeDrag` survives because cleanup relies on the node’s click. `onPointerMove` checks neither `buttons` nor `d.id === node.id`: it can move the original node while marking the hovered node as dragging. The extracted handler reproduced this. Removing a node during a press has the same cleanup gap.  
   **Fix:** Capture on pointerdown; clear the active drag on pointerup, cancellation, lost capture, and trace/node removal. Keep click suppression in a separate flag. Validate pointer identity, node identity, and held-button state.

3. **Bug — node dragging and canvas gestures can operate simultaneously.** [animated.tsx:3296](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:3296), [animated.tsx:3320](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:3320)  
   **Reproduce:** Hold a node with the mouse, pan or zoom using the trackpad, then move the mouse. The drag uses displacement from the original press divided by the *current* zoom, ignoring intervening canvas translation, so the node loses its position under the pointer. On touch, nodes inherit `touch-action: pan-y`, allowing vertical dragging to become page scrolling/cancellation. A second finger can also start canvas pinching while node dragging remains armed.  
   **Fix:** Define gesture ownership. Either suspend canvas gestures during node dragging or cancel dragging when a canvas gesture begins. For supported touch dragging, set the node’s touch policy before pointerdown and handle multiple pointers explicitly.

4. **Bug — dragged nodes can leave the reachable canvas.** [animated.tsx:1938](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:1938), [animated.tsx:1834](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:1834)  
   **Reproduce:** Drag a node well beyond the stage boundary and release. Nudges affect rendering but neither bounds nor drag constraints. Panning still uses the original tree/listing bounds; “fit” also preserves the offset. The displaced node may be unavailable for its double-click reset.  
   **Fix:** Clamp dragging to reachable bounds, or expand the canvas bounds to include nudged nodes and badges in every direction. Provide a visible reset-layout action.

5. **Bug — following can interrupt an active pan or rubber-band gesture.** [animated.tsx:1903](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:1903)  
   **Reproduce:** Pan while playback advances a long listing. A step or `asmBottom` update calls `panBy`, which starts a spring without checking active wheel/touch input. The next wheel event cancels that spring, producing competing motion. A delayed listing resize can likewise re-follow after the user starts exploring. The canvas harness confirmed that `size()` respects a pending gesture while this follow call bypasses that protection.  
   **Fix:** Expose canvas interaction state and cancel/defer automatic following when user input takes ownership. Treat the `asmBottom` retry as part of one pending step-follow request, invalidated by subsequent user input.

6. **Risk — follow measurements can target exiting rows or unfinished node positions.** [animated.tsx:1849](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:1849)  
   **Reproduce:** In the teaching-compiler fallback, scrub backward through a long Emit listing. `AnimatePresence` retains outgoing rows with their old `.current` class, and the selector chooses the last matching DOM row. It can therefore follow the outgoing instruction before the later height change corrects it. Similarly, node transforms can finish after the one-time bounding-box measurement without triggering `ResizeObserver`.  
   **Fix:** Select the row by the current frame’s instruction index, excluding exiting elements. Calculate the node’s destination bounds from layout data, or perform a guarded follow after its animation completes.

7. **Risk — dragging and reset have no keyboard equivalent.** [animated.tsx:3338](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:3338)  
   **Reproduce:** Tab to a displaced node. Enter/Space still toggle its card, but there is no keyboard operation to reposition or reset it, and its accessible name does not explain these capabilities.  
   **Fix:** Add a keyboard-accessible reset action and documented movement controls while preserving normal button activation.

8. **Nit — double-click reset also animates the card twice.** [animated.tsx:3338](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:3338), [animated.tsx:3346](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:3346)  
   **Reproduce:** Double-click a nudged node. Both clicks toggle `cardOpen` before reset runs. Its final value normally returns to the original value, but the card can flash open/closed.  
   **Fix:** Prefer a separate reset action, or explicitly arbitrate single-click versus double-click behavior.

**Checked and found sound:**

- Follow coordinates use screen pixels consistently. In-memory checks at `k = 0.5`, `1`, and `2` confirmed the pan deltas and row-priority fallback.
- Ordinary panning does **not** inherently cause a React follow loop: view coordinates are absent from the dependencies, and `lateRoom` is memoized.
- `asmBottom` uses untransformed layout measurements. Phase/trace changes reconnect the observer; absent listings reset it to zero. The bounds effect precedes the follow effect.
- `asmLeft + over` preserves emit’s column width because its containing layer also grows by `over`. The packed tree retains the intended gap before the listing. Narrow emit uses `left: 12`.
- Removing the height cap is compatible with mobile vertical bounds; horizontal overflow is the separate issue above.
- Drag displacement conversion is correct while the canvas transform stays fixed. The 4px threshold, normal drag-click suppression, and delivered `pointercancel` cleanup are sound.
- Nudges feed shared node geometry and the route-cache key. Changing detailed/plain lexer mode creates a new trace and clears offsets, so stale IDs do not carry across.

