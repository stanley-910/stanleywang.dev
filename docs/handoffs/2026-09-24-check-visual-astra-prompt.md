# Prompt: make the check phase visible, not just narrated

## Context

`/projects/mini-c-prototype` is an animated walkthrough of a small C compiler
(tokens → parse → check → emit → regs). Audience: portfolio visitors, many of
them engineers who have never written a compiler. Each frame shows one step on
a stage (the AST, drawn as a tree) plus a one-line note under the code editor.

The parse phase now shows Pratt precedence *in the tree* (held operands wait in
their slot, a tighter operator previews and pulls the operand down, groups get
brackets, a one-word cue like "tighter" or "left first"). That worked because
you can see the decision instead of reading about it. See
`docs/handoffs/2026-09-24-parse-visual-astra-answer.md` and `parse-view.ts`.

The check phase has not had that treatment. Today it is mostly the finished
tree with one node highlighted and a sentence per step: "This `i` refers to
`int i` on line 3.", "`i + 1` has type `int`.", "Every name has a declaration."
It reads like a log. The author wants intuitive UI direction for the three
parts of this phase, in the real compiler's order:

1. **Semantic analysis**: the umbrella. Things the grammar can't express:
   `x = "hello" * true;`, calling a function that doesn't exist, `break`
   outside a loop, `return` of the wrong type. It also enriches the AST with
   what later phases need (each use linked to its declaration, each
   expression's type).
2. **Name resolution and scoping** (`NameAnalyzer`): every use of a name is
   tied to the declaration it means, through nested scopes, with shadowing and
   "not declared" errors.
3. **Type analysis** (`TypeAnalyzer`): every expression gets a type, checked
   bottom-up against operators, assignments, calls, returns and conditions.
   break/continue/return context is checked in this pass too.

Intro splash slides already exist for these (`PHASE_SLIDES.Check` and
`STEP_SLIDES` in `explain.ts`); the slide copy is the author's and is not up
for rewriting. This question is about the stage and the step frames after the
slides.

## Read these (read-only; do not edit anything)

Working directory: `/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase`

- `app/projects/mini-c-prototype/animated.tsx`: page and stage rendering. Look
  for `frame.phase === 'Check'`, `point()`, node/edge drawing, hover text.
- `app/projects/mini-c-prototype/animated.css`: styles.
- `app/projects/mini-c-prototype/trace.ts`: frame model. Check frames are
  `check.resolve {use, decl, where}`, `check.unresolved {use}`,
  `check.builtin {use}`, `check.type {node, type, expected?}`,
  `check.namesDone {unresolved}`.
- `app/projects/mini-c-prototype/explain.ts`: note sentences per frame, and
  the check slides.
- `app/projects/mini-c-prototype/parse-view.ts`: the in-tree parse treatment,
  as a reference for tone and mechanism.
- `app/projects/mini-c-prototype/reference/*.trace.json`: recorded traces for
  the six presets (loop, local variable, function call, precedence,
  parentheses, unresolved name). Look at their Check frames.
- `docs/handoffs/2026-09-24-compiler-showcase-live-markup.md`: decisions so far.
- Attached screenshots 13–17: check · resolve, names done, types, unresolved
  name, error end. They are a day old: the canvas has since grown taller, but
  the check stage looks the same.

The real compiler (read-only, don't propose changes to it; the author will not
patch it):

- `~/Developer/mcgill/mini-c-compiler/src/java/sem/SemanticAnalyzer.java`,
  `NameAnalyzer.java`, `TypeAnalyzer.java`, `BaseSemanticAnalyzer.java`
- `~/Developer/mcgill/mini-c-compiler/src/test/util/` for how traces are
  recorded.

Known gap: the page does not resolve assignment targets. In `i = i + 1;` only
the right-hand `i` gets a resolve step; the target `i` gets none, though
`NameAnalyzer` does resolve it. Treat that as fixable page-side.

## Questions

1. For each of the three parts, propose a concrete visual treatment on the
   stage: what the viewer sees (positions, motion, line style, labels,
   colour), frame by frame, and which frame fields drive it. Say what new
   data, if any, the trace needs, and whether it can be derived page-side from
   the AST and existing frames. Cover at least:
   - a use being tied to its declaration (and the scope it was found in);
   - scopes: nesting, shadowing, a name found in an outer scope, a name not
     found anywhere;
   - types flowing up the tree, and a mismatch being caught;
   - a context error (`break` outside a loop, wrong return type);
   - what the AST "gains" by the end of the phase, so emit can use it.
2. Should the stage stay a tree for all three parts, or switch view (e.g. a
   scope table, source-code overlay with arcs, a symbol panel)? Which one
   would you pick for each part, and what is the smallest version worth
   building first?
3. Should names and types be two separate passes on screen (matching the real
   compiler), and how should the handoff between them look?
4. Walk through the `loop` preset and the `unresolved name` preset frame by
   frame in your design, in plain words. Also sketch one type error, e.g.
   `int x; x = "hi" * 2;`.
5. Name any good prior art (visualizers, textbooks, IDE features, blog posts)
   and the specific idea worth borrowing from each.

Keep the answer concrete and under ~1500 words. Plain language. Note labels and
on-stage cues must be terse (one or two words).
