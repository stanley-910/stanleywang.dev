I’d **keep the tree throughout Check**, adding a small scope strip during name resolution and type badges during type analysis. The visible story is the same AST acquiring information. Semantic analysis is the umbrella over those two passes.

Nothing was edited; the slide copy stays as supplied.

The trace needs enrichment: `loop` currently has five resolve frames and only three type frames—two declarations and the return. [The recorder](/Users/stanley/Developer/mcgill/mini-c-compiler/src/test/util/ParseTrace.java:256) never emits its intermediate expression types.

For **semantic analysis**, preserve the completed tree’s positions. Put a quiet `names → types` indicator in the upper-left corner. Small hollow marks beside name uses become filled as bindings are established; type badges accumulate later. At completion, `ready` appears beside the root.

That makes enrichment visible: uses retain declaration references, expressions retain types, and context-sensitive statements retain their enclosing function or loop. Emit inherits this annotated tree. For example, emitting a variable access briefly reilluminates its declaration link; emitting arithmetic highlights the expression’s type.

For **name resolution**, put a compact scope strip along the stage’s bottom edge: `global`, then `main`, then nested `block` cards, progressively indented. Each card contains the declarations introduced there. A faint bracket around the active function or block subtree connects the strip to the tree.

Use these beats:

- **Enter:** the new scope card opens empty. Declarations appear as their nodes are visited.
- **Search:** invert the active use. A dotted connector reaches its current scope card; the searched name appears beside it.
- **Found:** highlight the matching declaration row and AST declaration together. Draw one solid curved arrow from use to declaration: `bound`.
- **Outer lookup:** leave the current card visibly empty for that name, then advance to its parent: `outer`. Stop at the first match.
- **Shadowing:** an inner declaration occupies its own card; the same name in the outer card dims. Lookup stops inside. Earlier bindings stay intact. Leaving the block restores the outer row.
- **Missing:** search each enclosing card, ending at `global`; the connector terminates in a cross: `not found`.
- **Duplicate:** a second declaration in the same card meets the occupied row: `duplicate`.

Keep successful connections in ordinary ink. Reserve the existing rust colour for errors; `.ac-link` currently uses `--err` even for success. After each binding, collapse its long arrow into a small hooked mark beside the use. Hover restores that arrow. This avoids the accumulated tangle in screenshot 14.

The function’s parameters and outermost body declarations share one scope in [this NameAnalyzer](/Users/stanley/Developer/mcgill/mini-c-compiler/src/java/sem/NameAnalyzer.java:68). Don’t invent an extra body scope. Nested blocks do introduce scopes.

For **type analysis**, fade the scope strip and keep the binding marks. Place a small type badge immediately beneath each checked expression. On a variable use, its declaration briefly lights before the badge appears.

At an operator, show outlined requirements at its child-edge endpoints—for multiplication, two `int` slots. Copies of the children’s badges travel upward along those edges. When both fit, the operator acquires its own `int` badge: `fits`. Children retain their badges.

For assignments, compare the value against the target’s type. For calls, align argument badges with parameter requirements, then attach the return type to the call. Conditions receive a `needs int` slot; this compiler’s comparisons produce `int`.

A mismatch leaves the incompatible badge visibly beside its requirement, joined by `≠`; colour that junction rust and label it `mismatch`. Give the failed expression a muted `unknown` badge. Don’t animate a successful type through it.

Context uses a different connection: a dotted line following the ancestor path. A `break` seeks its enclosing `while`; without one, the line ends at the function boundary with `no loop`. A return connects to its function’s return-type requirement. `char ≠ int` catches `return 'a';` inside `int main()`. Statements themselves don’t acquire expression-type badges.

**Names and types should be separate passes.** On `check.namesDone`, fill the remaining binding marks and show `bound`. Keep that pose through the existing type slide. Afterwards, change the indicator to `types` and begin badge accumulation without moving the tree.

One fidelity distinction matters: [SemanticAnalyzer](/Users/stanley/Developer/mcgill/mini-c-compiler/src/java/sem/SemanticAnalyzer.java:7) runs TypeAnalyzer even after name errors. The recorder suppresses type replay whenever semantic analysis fails. Stopping the presentation at the first cause is reasonable, but it is a presentation choice.

The page-side data needed is:

| Existing data | Addition or derivation |
|---|---|
| `check.resolve {use, decl, where}`, `links` | Derive scope membership, parent scopes and lookup path from AST containment and declaration order. `where` alone cannot describe scope. |
| `check.unresolved`, `check.builtin` | Derive the exhausted search path; built-ins resolve to a `built-in` row in global scope. |
| `check.namesDone` | Preserve the bindings accumulated so far; add scope-entry, declaration and exit beats. |
| `check.type {node,type,expected?}` | Add expression-by-expression replay, with input types, requirements and success/failure. Existing type frames are checkpoints, not sufficient evidence. |
| AST ancestors and `sem` diagnostics | Derive enclosing function/loop; normalize diagnostics into `{node, rule, actual, expected, context, outcome}`. |

Assignment targets can use the existing collapsed assignment node plus a `target` anchor, inserting resolution **before** the RHS uses. No compiler modification is necessary.

The six presets’ missing information is derivable page-side using their ASTs, tokens and compiler rules. Type/context error examples need additional replay logic: failed traces contain diagnostics but no type frames. Keep that replay bounded to supported constructs; don’t infer arbitrary types from display labels.

Every pose should depend on its frame, including search position and accumulated badges, so seeking and reduced motion preserve the explanation.

For **`loop`**, here is the proposed sequence. These are new presentation frames, excluding slides. Within each numbered range, each semicolon separates one frame.

| Frames | What the viewer sees |
|---|---|
| 1–3 | Open `main` beneath `global`; add `int i`; add `int sum`. |
| 4–6 | Bind the target in `i = 0`; bind the target in `sum = 0`; bind the condition’s `i`, all inside `main`. |
| 7 | Open the loop body’s empty `block` card. |
| 8–10 | Bind assignment-target `sum`; bind RHS `sum`; bind RHS `i`. Each lookup passes through the empty block to `main`. |
| 11–12 | Bind assignment-target `i`; bind RHS `i`, again through the outer scope. |
| 13–15 | Close the block card; bind return’s `sum` locally in `main`; show all bindings complete. |
| 16–17 | After the type slide, validate `int i`; validate `int sum`. |
| 18–20 | Target `i` gets `int`; literal `0` gets `int`; assignment accepts the match. |
| 21–23 | Target `sum` gets `int`; its `0` gets `int`; assignment accepts the match. |
| 24–27 | Condition’s `i` gets `int`; `3` gets `int`; both feed `<`, producing `int`; `while` accepts it. |
| 28–34 | Target `sum` gets `int`; RHS `sum`; `i`; `2`; badges feed `×`; its result and `sum` feed `+`; assignment accepts the result. |
| 35–39 | Target `i` gets `int`; RHS `i`; `1`; badges feed `+`; assignment accepts the result. |
| 40–42 | Return’s `sum` gets `int`; it matches `main`’s requirement; the annotated tree shows `ready`. |

For **`unresolved name`**:

1. Open `main` beneath `global`; highlight `missing`.
2. Search `main`: no matching declaration.
3. Search `global`: no match; show `not found`.
4. At the terminal names frame, keep `missing` highlighted and its failed connector visible. Don’t move focus to `main`, as screenshot 17 does. No type slide or emit follows.

For **`int x; x = "hi" * 2;`**, inside a function:

1. Declare `x`, then bind its assignment target.
2. After the handoff, target `x` receives `int`.
3. `"hi"` receives `char[3]`, including the terminator.
4. `2` receives `int`.
5. At `×`, the right badge fits; `char[3] ≠ int` remains at the left requirement.
6. Multiplication becomes `unknown`; the presentation stops at that first cause.

The smallest worthwhile build is the scope strip, one active binding arrow including assignment targets, persistent type badges, and local requirement comparisons. Keep the tree; a full symbol-table view would require visitors to learn another layout.

Useful prior art:

- [*Crafting Interpreters*, Resolving and Binding](https://craftinginterpreters.com/resolving-and-binding.html): borrow the innermost-to-outermost scope search and retained binding identity.
- [Cornell’s semantic-analysis notes](https://courses.cs.cornell.edu/cs4120/2023sp/notes/index.html): borrow the decorated AST—check children, then retain the parent’s type.
- [VS Code navigation and inlay hints](https://code.visualstudio.com/docs/editing/editingevolved): borrow restrained persistent annotations and declaration/reference inspection on demand.