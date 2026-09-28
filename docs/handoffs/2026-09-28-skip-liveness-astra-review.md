Found two issues. Line numbers refer to `ad14672`. No files edited.

1. **P2 — Existing register deep links silently open different steps.** [regs-view.ts:20](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/regs-view.ts:20)  
   **Reproduction:** `?example=precedence&frame=56` previously opened `reg.interfere`; it now opens `reg.select`, step 5. Old frame 59 now opens `reg.done`. Filtering compacts the array, while URL loading still treats `frame` as its index.  
   **Fix:** Give linked frames stable identifiers, or version positional links and translate legacy indices through the filtering. Newly generated links work.

2. **P3 — The fallback’s Liveness slide points to nonexistent bars.** [explain.ts:1277](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/explain.ts:1277)  
   **Reproduction:** Make `/mini-c/compiler.js` unavailable, enter non-preset `int main(){return 7;}`, and step into Registers after fallback settles. The slide says “the bars beside the code are those lives,” but teaching traces never show lanes: `emitStage` requires a recorded trace, and `regView` requires a backend.  
   **Fix:** Render lanes for teaching traces too, or use fallback-specific slide copy.

What I checked:

- **Executed 44 combinations:** all 11 presets × line/block emission × normal/detailed lexer. Used the commit’s actual deck-builder code.
- **Register stops:** Filtering before `withRegisterStops` produces exactly the original surviving frames, including batch boundaries and `from` fields.
- **Multiple functions:** Function call’s second graph follows the first `reg.done` correctly. Previous colours and rewritten-function count persist; the new function starts uncoloured with an empty allocation stack. Fibonacci has only one function.
- **Decks:** Register Allocation → Liveness → Graph Colouring shares the last emit frame correctly. No duplicated slide objects; Chaitin’s slides retain their anchor. Type Analysis remains correct, and failing programs gain no Registers deck.
- **Source inspection:** `fnIndex`, `stepIndex`, graph selection, listing header, homing dependencies, follow, stack pile, side-pane folding, and regs-tab navigation have no dependency on the removed frames.
- **Lexer:** Both displayed regexes compile and match ordinary and escaped literals.
- **Validation:** Trace checks and TypeScript passed, including TypeScript with sources pinned to `ad14672`. Animation behaviour was source-reviewed, not browser-verified.

Cleanup remains: the obsolete comment at `animated.tsx:1704`, `.ac-ins.changed small` at `animated.css:2232`, and the now-unreachable `reg.cfg`/`reg.live` explanation branches and their `liveAdded` dependency. Keep the raw trace variants: recorded compiler data still contains them.

