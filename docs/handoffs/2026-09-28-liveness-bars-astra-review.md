Found **three defects** in the delta. No files edited.

1. **P2 — Playback advances before the backward sweep finishes.** [emit-lanes.tsx:103](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/emit-lanes.tsx:103)  
   **Reproduction:** Play through Registers with motion enabled at 1×. Sweep 1 lasts **680 ms**, but the bars take **924 ms**; dots and names finish arriving at **1,134 ms**. Sweep 2 therefore appears while sweep 1’s visualization is unfinished—even when its note says liveness is settled. Speed changes preserve this mismatch.  
   **Fix:** Include the backward-growth and label-arrival duration in the playback hold for sweep 1, preferably using shared timing constants.

2. **P2 — The displayed literal regexes are still incorrectly escaped.** [explain.ts:1153](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/explain.ts:1153)  
   **Reproduction:** Open the detailed lexer table. TypeScript consumes one escaping layer, leaving `\.` instead of `\\.` and a backslash that escapes the character class’s closing bracket. Constructing either displayed pattern with `new RegExp(...)` throws **“Unterminated character class.”** Reader-based highlighting works, but the displayed rules are invalid.  
   **Fix:** Define the displayed patterns with regex literals and `.source`, or correctly preserve both backslashes with `String.raw`.

3. **P3 — CFG transitions unnecessarily remount and redraw all lanes.** [animated.tsx:4328](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:4328)  
   **Reproduction:** Step backward from sweep 1 to CFG: the key changes from `swept` to `emitted`, collapsing and regrowing existing bars and fading their labels. In **Function call**, finishing `twice` and entering `main`’s CFG also redraws all 37 instructions’ lanes; entering the following sweep redraws them again backward. This violates the page’s existing behavior of settling backward navigation without replaying sequences.  
   **Fix:** Preserve lane identity across CFG transitions and trigger backward growth explicitly when entering the intended first sweep. Settled mounts and backward navigation should initialize at their final geometry.

Verification:

- **Literal matching:** String/character readers produce `prefix` while reading and `exact` when settled, including escaped literals. The displayed-pattern portion remains unfixed.
- **Drag cleanup:** Source-verified cleanup for `late`, flow and axis changes, plus lost pointer capture.
- **Diagnostic reflow:** Executed checks confirm moved line numbers update correctly; messages without “on line N” remain unchanged.
- **Handle placement:** Source-verified that the handle follows the animated pane. Its 7 px hit area and focus indicator lie inside the clipping boundary; its z-index exceeds the scroller’s sticky header.
- **Liveness:** Bars equal virtual live-out sets on every line across **all eight successful presets**, after both the first and final sweeps. Changed-row sets clear outside later sweeps. Reduced motion zeros the new durations and delays. Rewrite changes still trigger row measurement through `layout={rewrittenFns}`.
- **Checks:** Trace checks and TypeScript passed.

Browser control was unavailable, so animation findings are source-derived; pointer hit testing, rail interactions and visual clipping remain unverified.

