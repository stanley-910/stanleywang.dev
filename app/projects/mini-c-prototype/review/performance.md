# Rendering performance pass — 2026-10-01

The largest repeated cost was name-link pathfinding. Each name step rebuilt the
router and searched every accumulated binding, although usually only one link
was visible. Rendering also repeatedly searched attachment/token arrays and
rebuilt layout data.

All implementation changes are inside `app/projects/mini-c-prototype/` in the
`compiler-perf` worktree. No commits, dependency changes or changes to port 3107.
The pre-existing edits in `animated.css` and `derivation.tsx` were preserved byte
for byte. This pass makes no CSS changes.

## Changes

| File and area                                                   | Change and cost                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `animated.tsx`, `linkRoutes`                                    | Cache the router by actual obstacle boxes, edge endpoints and stage dimensions, rather than by step number or accumulated bindings. Geometry changes from badges, resize, held camera and node dragging invalidate it. Request only routes used by visible links or hover-card placement. With unchanged geometry, a sequence of L growing bindings previously repeated about O(L²) searches; it now needs O(L) distinct searches. Geometry comparison remains O(N + E) per relevant render.                          |
| `link-route.ts`, returned `route()`                             | Cache each endpoint pair's exact `Route`, including endpoint side-clearance identity in the key. Repeated requests avoid A*, its grid arrays and path construction. Reuse the zero-clearance fallback router within the same geometry too. No changes to search costs, tie-breaking, port rules, curves or fallback behavior. The stage keeps one geometry, not a history of steps.                                                                                                                                   |
| `animated.tsx`, `TreeEdge`                                      | Extract a memoized edge component with scalar geometry, class, opacity and timing props. Unchanged edges can skip component/Motion work; the parent still enumerates O(E) edges. Preserve keys, presence boundaries, initial/exit props, easing and durations. `GlidingPath` still uses its existing motion value and effect. React/Motion savings were not measured in a live browser.                                                                                                                               |
| `animated.tsx`, attachment/token membership                     | Memoize sets for current attached/consumed IDs and previous node/attachment IDs. Per-piece and per-edge membership changes from O(N) or O(T) array searches to O(1), after linear set construction. This removes quadratic scans while building edges, pending-node state, consumed tokens and arrival checks.                                                                                                                                                                                                        |
| `animated.tsx`, function lookup                                 | Build the function-name map once per trace, preserving the first match for duplicate names. Calls, built-in checks, type links and editor source marks use O(1) lookups instead of repeated O(N) searches. Reuse it for function-name membership.                                                                                                                                                                                                                                                                     |
| `animated.tsx`, layout                                          | Memoize `parseView` by trace/index and pack the full tray only when trace/width changes. Group typed rows once per trace without copying each growing row array; memoize badge shifts by their actual layout inputs. Clamp the badge lookup index after the last badge/call-signature collapse, so emit steps reuse the final typed layout. Per-node coordinates are computed once per render and shared by edges, pieces, badges and cards. Row sorting and floating-point calculations retain their original order. |
| `animated.tsx`, hover derivation; `proof-stage.tsx`, derivation | Memoize `derive` for unchanged trace/source/index. Hover measurements and moving between nodes on the same step reuse the prefix scan. The active showcase still derives only when a type proof is requested. This removes repeat prefix work, without retaining a derivation for every frame. `ProofStage` is currently unused by `AnimatedCompiler`; its identical memo is preventative.                                                                                                                            |
| `review/check-render-perf.cjs`                                  | Add a baseline comparison harness using existing TypeScript tooling. It compares rendered geometry, text and Motion props while retaining hook memo/ref state, and counts router searches. It is a computation/output check, not a DOM or animation test.                                                                                                                                                                                                                                                             |

The required checks also exposed existing formatting failures. Mechanical fixes
were needed in `rail-curve.ts`, `stack-view.ts`, `trace.ts`, `NOTES.md`,
`custom-examples.md`, `review/fable-review.md`, and all 12 `reference/*.trace.json`
files: break-continue, classes, fibonacci, function-call, loop,
missing-semicolon, pointer, precedence, shadowing, struct-fields,
unresolved-name and wrong-type. `note-window.tsx` only loses two unused ESLint
suppression comments. Its runtime code and the three formatted TS helpers have
identical JavaScript syntax trees after transpilation. Every JSON value is identical.
The generated JSON formatting accounts for almost all of the large diff.

## Evidence

The baseline was copied before editing to `/tmp/mini-c-perf-baseline`, including
the pre-existing zoom-border and assignment-proof edits. The supplied program
compiles to 73 nodes and 615 displayed frames (slider positions 0–614). A larger
case adds twelve `(*b).value = (*b).value + 1;` assignments before the return,
producing 181 nodes and 1,491 displayed frames.

One full comparison replay, including forward steps, reverse seeks, hover,
narrow layouts, slides, dragged-node offsets, speed/reduced-motion settings,
detailed lexer and block emit settings:

| Program          | Compared renders | Searches before → after | Render computation before → after |
| ---------------- | ---------------: | ----------------------: | --------------------------------: |
| Supplied program |              774 |  1,121 → 99 (91% fewer) |                   706 ms → 261 ms |
| 181-node variant |            1,844 | 7,833 → 247 (97% fewer) |               8,312 ms → 1,250 ms |
| Fibonacci        |              384 |                497 → 45 |                    167 ms → 72 ms |
| Struct fields    |              216 |                 58 → 15 |                     41 ms → 32 ms |
| Break/continue   |              298 |                108 → 16 |                     73 ms → 49 ms |

Times are totals from a Node computation harness, not browser frame times or FPS.
They exclude React reconciliation, Motion effects, layout, painting and snapshot
comparison. Timings vary; search counts are more useful evidence of the avoided
work. All 4,802 compared cases across these programs and every reference trace
had identical normalized render output, including full path strings and Motion
transition props. Event-handler bodies and actual DOM effects are not exercised.

Reproduce from the worktree root while the saved baseline is available:

```sh
node app/projects/mini-c-prototype/review/check-render-perf.cjs /tmp/mini-c-perf-baseline
```

The harness also accepts another baseline showcase directory. On failure it
writes the two render snapshots to `/tmp/mini-c-render-{before,after}.json`.

Required checks passed:

```sh
npx tsc --noEmit
npx eslint app/projects/mini-c-prototype
npx prettier --check app/projects/mini-c-prototype
```

ESLint reports only the existing `animated.tsx` import-order warning. The existing
`node app/projects/mini-c-prototype/check-trace.cjs` also passes.

## Investigated and left unchanged

- `jumped`, `heals`, `epoch`, `drawn`, step controls and playback timing: these
  coordinate unfinished exits and remounts. No throttling, dropped steps or
  special reduced-animation scrub mode was introduced.
- `canvas-zoom.ts` and CSS: preserve screen-pixel line widths and pan/zoom behavior.
- DOM measurement in editor following, hover proofs, note placement and the
  settled-exit audit: these have step/layout-specific dependencies and are needed
  for placement or recovery. No browser evidence justified changing their timing.
- `derive`'s underlying prefix algorithm: it is not part of ordinary scrubbing
  without a type hover. Memoizing repeated reads was sufficient for this pass;
  an eager per-frame proof history would add memory and trace-load work.
- `pieceBox` object reuse: rejected after comparison found it changed router
  side-clearance behavior. Separate endpoint boxes remain separate. Only their
  coordinate calculation is shared.
- Full piece/button and register-badge extraction: their event closures, keyed
  type-badge landings and animation sequences make a broad memoization change
  riskier. This pass isolates stable tree edges and removes the measured routing
  cost first. Trace-only parent/tree/register layout data was already memoized.

## Review priorities and limits

1. Check `TreeEdge` through rapid forward/backward stepping, unfinished exits,
   seeks, and resize/drag in React 19 StrictMode. Prop equality was checked;
   browser effect ordering and presence behavior remain unverified.
2. Check name links at `check.namesDone`, hover over declarations, type links,
   missing names, and hover-card placement on slides. The lazy route filter must
   continue to cover both `NameLinks` and card collision avoidance; the full links
   list still controls draw order and staggering.
3. Check a one-step function-call signature collapsing, the final type step into
   emit, and node dragging/resizing in those states. These exercise geometry
   invalidation and the final badge-layout cache.

Live browser profiling and visual interaction checks could not run: the sandbox
rejected binding the isolated preview server (`EPERM`), headless Chromium was
blocked at its macOS Mach-port registration, and the managed-browser inventory
was empty. No live FPS claim is made. The isolated preview and test scratch files
were confined to `/tmp`; the other checkout and its server were not modified.
