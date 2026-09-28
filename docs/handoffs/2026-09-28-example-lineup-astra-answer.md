I’d ship **ten**: drop the plain loop, replace linked list with a small struct example, and keep your other choices. Eleven isn’t inherently too many; distinct teaching value matters more than the count.

| Order | Picker label | Purpose |
|---|---|---|
| 1 | `precedence` | Small enough to follow every step; immediately explains why the tree matters. |
| 2 | `function call` | Parameters, arguments, return values, separate frames, and allocation per function. |
| 3 | `shadowing` | Makes scope resolution visibly necessary: identical names, different declarations and storage. |
| 4 | `fibonacci` | The recognizable showcase program: a real algorithm, loop, built-ins, string literal, and cast. |
| 5 | `break and continue` | Contrasting control-flow edges: skip this iteration versus leave the loop. |
| 6 | `pointer` | Address-taking, dereferencing, and modifying a value through an alias. |
| 7 | `struct fields` | A named record becomes concrete field offsets in memory. |
| 8 | `missing semicolon` | Parser failure: valid tokens, invalid structure. |
| 9 | `unresolved name` | Name-resolution failure: valid structure, missing declaration. |
| 10 | `wrong type` | Type failure: the declaration exists, but the assigned value doesn’t fit. |

Put a divider before the three errors. This gives seven successful programs and three clearly different stopping points.

I agree with dropping parentheses and local variable: visitors can add parentheses to the first example, while shadowing and pointers give local variables a purpose. I’d also cut:

- **Plain loop:** Fibonacci covers ordinary iteration; break/continue adds something distinct.
- **Linked list:** 53 tree nodes and 95 instructions exceed your limits. More importantly, the memory view doesn’t draw heap objects, so its most interesting feature lacks a visual payoff. The small struct exposes more of what the page currently explains well.

**I’d change only these two sources.** Leave the other selected programs as supplied.

For `struct fields`, simplify the shortlisted Point example by removing its second pointer lesson. It returns `30`; the compiler lays out `x` and `y` at offsets 0 and 4.

```c
struct Point {
  int x;
  int y;
};

int main() {
  struct Point p;
  p.x = 10;
  p.y = 20;
  return p.x + p.y;
}
```

For `break and continue`, add braces. The nesting becomes explicit, including in the scope/tree animation.

```c
void main() {
  int i;
  i = 0;
  while (i < 10) {
    i = i + 1;
    if (i == 5) {
      continue;
    }
    if (i == 8) {
      break;
    }
    print_i(i);
  }
}
```

Measured with the current browser compiler:

| Revised program | Characters¹ | Tree nodes | Instructions | Largest graph |
|---|---:|---:|---:|---:|
| struct fields | 114 | 21 | 27 | 13 |
| break and continue | 165 | 29 | 46 | 23 |

¹ Includes the final newline. Both reach Registers without errors. I also remeasured the other selections: Fibonacci is the largest at **36 / 55 / 30**, within your limits.

Keep Fibonacci’s descriptive names and string separator. Add a short **expected result** sentence to each example’s introductory note—especially Fibonacci, shadowing (`21`), and pointer (`43`). The page animates compilation; it doesn’t execute the resulting assembly.

**The main issues exposed by these additions:**

- **String presets uncover a correctness bug.** The preset matcher ignores whitespace inside literals. I reproduced changing Fibonacci’s `" "` to `"  "` and receiving the cached `char[2]` trace; fresh compilation correctly gives `char[3]`. Make matching literal-aware, or use exact matching and compile all edits. [reference.ts:48](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/reference.ts:48)

- **Some notes still assume arithmetic literals and operators.** Fibonacci’s string actually receives “started as a number.” The token explanation always calls `*` multiplication requiring two operands, including pointer contexts. The linked-list comparison receives “Both sides are `int`” despite comparing pointers. Use literal categories, contextual operator meanings, and actual operand types. [explain.ts:367](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/explain.ts:367), [token wording](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/explain.ts:282), [comparison wording](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/explain.ts:587)

- **Built-ins need explanations comparable to ordinary calls.** Signature hints only find functions declared in the source, excluding `print_i`, `print_s`, and `mcmalloc`. Explain `print_s`’s `char*` parameter and the explicit cast from the string array. Emit notes should identify printing/allocation services instead of only saying “service numbered in `$v0`.” [animated.tsx:740](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:740), [explain.ts:234](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/explain.ts:234)

- **Memory coverage needs accurate framing.** Multiple functions, `void main`, and declared globals already have support. Heap allocations and string storage aren’t drawn as objects. Also, pointer-taking doesn’t uniquely “force” `x` onto the stack here: the compiler already keeps ordinary locals there. [stack-view.ts:262](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/stack-view.ts:262)

- **Normalize parser errors when generating presets.** Recorded presets bypass `compileReal`, which normally replaces generic errors with useful diagnostics. Preserve “Expected `;` but found `return` on line 4.” Use the shortlist’s `x = 5` example (`pb_err_semicolon.c`); `top/err-semicolon.c` is a different fixture producing four errors. [animated.tsx:529](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:529)

- **Loops expose the linear liveness shorthand.** “From its write to its last read” needs a path-based qualification: a value is live where a possible future path reads it before another write. Break/continue makes that distinction worth teaching. [explain.ts:1314](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/explain.ts:1314)

No repository files changed.

