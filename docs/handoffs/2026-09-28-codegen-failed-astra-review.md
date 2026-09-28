1. **P2 — Unexpected exceptions become normal compiler errors.** [ParseTrace.java:964](/Users/stanley/worktrees/mini-c-compiler/2026-09-25_showcase-traces/src/test/util/ParseTrace.java:964)  
   **Reproduction:** `class Foo { int x; } void main() { class Foo f; print_i(f.x); }` reaches a null `fe.decl` dereference in `ExprAddrCodeGen`. The browser returns the class DRAFT message spanning the entire source. Exceptions from `flush()` or `tagJson()` would likewise be swallowed, hiding tracer regressions. Reflection also wraps JVM `Error`s, making this catch broader on JVM than in the browser.  
   **Fix:** Unwrap reflection wrappers, handle only recognized codegen diagnostics, and rethrow unexpected exceptions. Prefer a dedicated codegen exception; minimally require `IllegalStateException` with the expected diagnostic prefix.

2. **P3 — CRLF error spans include the carriage return.** [ParseTrace.java:2096](/Users/stanley/worktrees/mini-c-compiler/2026-09-25_showcase-traces/src/test/util/ParseTrace.java:2096)  
   **Reproduction:** With CRLF source containing `f = new class Foo();`, the returned span slices to `"= new class Foo();\r"`. Subtracting one removes only `\n`.  
   **Fix:** Remove the complete line terminator when calculating the exclusive end; clamp the start to that end.

Other checks passed:

- The exact sed substitution still matches and preserves the required catch-compilation shim.
- No partial assembly leakage: instructions are cleared; emit frames, backend/register data, and layout are constructed later; `tagAt` stays local. Lanes derive from the now-empty instructions.
- `finally` clears both observers despite the return; `quiet()` restores stdout first.
- One-based offsets, last-line handling, and both regex escapes are correct.

Verified failure cleanup and a subsequent successful compile using the existing browser bundle. A fresh build was not run because this session’s filesystem is read-only.