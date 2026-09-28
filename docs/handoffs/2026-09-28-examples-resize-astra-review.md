Found four defects, ranked below. No files edited.

1. **P2 — Literal classes never match in the detailed lexer table.** [explain.ts:1607](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/explain.ts:1607)  
   **Reproduction:** Select Fibonacci, enable detailed lexing, and step through `" "`. The string row stops matching and never becomes exact. Confirmed directly: `matchTable('" "', 'string', 'string')` produces no matching row; neither does `'a'` for characters. Only identifiers and numbers receive pattern handling; literal patterns are compared as fixed text.  
   **Fix:** Map string/character classes to their `string`/`char` readers in pattern matching. Also make the displayed patterns escape-aware: the new patterns misrepresent valid escaped quotes and character escapes.

2. **P2 — Removing the handle during a drag leaves dragging state stuck.** [animated.tsx:4337](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:4337)  
   **Reproduction path:** Start dragging in Emit, hold the pointer down, press `1` to return to Tokens, then release. The handle unmounts, so its pointer-up/cancel handlers cannot clear `listingDrag` or `listingDragging`. Position transitions remain disabled; returning to Emit can also resume resizing from the abandoned drag on pointer movement. Switching into flow layout during a drag has the same cleanup gap. This finding is source-based, not browser-reproduced.  
   **Fix:** End the drag when the handle becomes unavailable or its axis changes. Add lost-capture cleanup for capture transfers while mounted; that alone does not cover unmounting.

3. **P2 — Whitespace reflow preserves an incorrect diagnostic line number.** [reference.ts:128](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/reference.ts:128)  
   **Reproduction:** Add a leading blank line to Missing semicolon. Confirmed: the error span moves to `return` on line **5**, while the message remains “Expected `;` but found `return` on line **4**.” Preset matching keeps using the recorded diagnostic.  
   **Fix:** Derive the displayed line from the reflowed span, or recompile whitespace-modified error presets instead of replaying their stored messages.

4. **P3 — The resize handle jumps ahead of the animated pane edge.** [animated.tsx:4340](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:4340)  
   **Reproduction path:** Enter Emit with motion enabled, resize using arrows, or double-click after making the pane substantially wider. The pane animates for 350 ms, but its sibling handle immediately takes the destination position. During that interval the visible border and draggable hit area disagree. This is evident from the animation wiring; visual verification was unavailable.  
   **Fix:** Anchor the handle to the animated pane’s edge, or drive both from the same animated dimension and presence lifecycle.

What checked out:

- `check-trace.cjs` and TypeScript checking passed.
- All **11 presets** matched fresh output from the rebuilt JavaScript bundle after filename normalization and live-path diagnostic conversion.
- **5,977 explanation frames** across normal, block, line, detailed-lexer, and register-stop transformations completed without exceptions or `undefined`/`NaN` text.
- Literal-aware preset matching rejects changed internal spaces, missing closing quotes, and changed escapes. Escaped quotes, backslashes, and a double quote inside a character literal stay together. Comment quotes can conservatively prevent matching; I found no stale-preset collision in this lineup.
- New and legacy node labels classify correctly. Parentheses do not create misleading cast-labelled nodes; `.5` is rejected by the compiler. Struct declarations remain distinguishable from struct variables, and scope/stack consumers do not depend on the replaced class labels.
- Error presets stop in the expected passes; unavailable later tabs are disabled.
- Saved dimensions are reclamped on render, width and height remain independent across layout switches, and resize-arrow directions are consistent. The picker rule adds no selectable row and its marker uses measured offsets.
- Dead-instruction filtering agrees with the allocator’s CFG output.

Browser control was unavailable, so pointer timing—including the suspected last-move/stale-closure race—remains unverified.
