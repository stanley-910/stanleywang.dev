# Throwaway compiler showcase UI

Question: Which presentation lets a recruiter understand a compiler in a minute while leaving useful depth for a technical reader?

Verdict: pending Stanley's review. A is the suggested starting point; B emphasizes exploration, C emphasizes reading. Delete losing variants and rewrite the selected approach for production rather than promoting this sketch wholesale.

## Run

From `/Users/stanley/Developer/portfolios/stanley-wang`:

```sh
npm run dev -- --hostname 127.0.0.1 --port 3107
```

- A, guided: http://127.0.0.1:3107/projects/mini-c-prototype?variant=A
- B, workbench: http://127.0.0.1:3107/projects/mini-c-prototype?variant=B
- C, journey: http://127.0.0.1:3107/projects/mini-c-prototype?variant=C

Use the floating arrow switcher or left/right keys outside editing controls. Source, selected example, loaded snapshot, and selected phase persist across layout switches; a reload resets them. The URL retains only the variant.

## Limits

- Original educational fixtures only. No private coursework code, real compiler calls, execution, benchmark results, or backend service.
- Four exact examples: arithmetic, looping, function calls, undeclared identifier. Editing invalidates output; custom input explicitly awaits a real compiler connection. Whitespace edits also invalidate fixtures.
- Syntax trees are excerpts, CFGs are sketches, liveness is a selected snapshot, and assembly uses an abstract instruction set and simplified calling convention. No spilling, ABI, stack frames, or algorithm iterations.
- All application state is in memory. The existing site theme control retains its existing behavior.
- The route returns not-found in production and the switcher is separately gated. No listing/navigation edits, commit, push, or deployment.
- This page's layout does not impose a template on future music, TouchDesigner, or other project pages. The eventual backend choice (including a possible Go service coordinating original-language demos) is independent.

## Verification

- Targeted ESLint and TypeScript checks passed. Production build passed; build skips lint, so lint was run separately.
- Live browser: all three variants, example selection, compile preview, semantic diagnostic, custom input suppression, source/phase preservation on switching, arrow navigation, and arrow exclusion in textarea checked.
- Desktop 1280px and mobile 390px checked; document width matched viewport. Light and dark themes inspected. Browser console showed no errors during the checked flow.
- Browser screenshot capture sometimes clipped the 1280px viewport to its narrower host panel; DOM geometry and mobile captures were used alongside it.
- Context7 was unavailable; official Next useRouter/useSearchParams documentation was consulted before implementation.
- Existing tooling drift: package.json requests Next 15.1.11 but installed build reports 15.1.1. `npm run lint` still points at `next lint`; used direct ESLint without unrelated toolchain changes.

Changed files: this directory (`page.tsx`, `prototype.tsx`, `fixtures.ts`, `prototype.css`, `NOTES.md`) and `components/PrototypeSwitcher.tsx`.

## Revision D — animated teaching compiler

New default / requested direction: http://127.0.0.1:3107/projects/mini-c-prototype?variant=D

The original A/B/C snapshot experiments remain selectable. D is a single evolving stage beside an editor, rather than another set of result slides. It is the current prototype for review; verdict remains pending Stanley.

### Real mechanisms in D

`trace.ts` implements an original tokenizer and recursive-descent expression parser with source spans, operator precedence, statement/name checks, AST construction, simple three-address code generation, and straight-line register reuse. Trace frames are immutable snapshots of presentation state; seeking backward uses the same frame data as forward playback. Input is never executed. The standalone mechanism check interprets only generated instruction objects to compare virtual/physical equivalence.

Accepted: one `int main()`, local `int` declarations (optional initialization), assignment, a single final return, non-negative integer literals, names, `+`, `-`, `*`, parentheses, whitespace, line comments. Bounds: 1,200 characters, 90 tokens, 32 AST nodes. Unsupported syntax or unresolved/uninitialized names produce source-linked diagnostics. Edits rebuild and reset the trace; selecting a different layout resets D's local state. Nothing is saved.

This is **not Stanley's Java coursework compiler**. In particular, D's allocator reuses registers using last-use information on straight-line instructions with no fixed hardware limit or spills. It is not the real compiler's CFG/liveness/interference-graph coloring allocator. Generic pseudo-assembly, no ABI/stack frames, no calls/loops, no native execution. A future Java/Go service integration remains separate work.

### Interaction

- Play/pause, previous/next, restart, scrubber, 0.5×–2× speed.
- Space toggles playback outside editing fields; J/K step. Arrow keys compare variants (ignored in input fields, including the scrubber).
- Source tokens highlight as corresponding stage chips appear; those same chips move to their AST positions. Edges draw as nodes combine; completed tree recenters, then shifts beside emitted instructions.
- Hover/focus AST nodes to inspect their source span. Register-assignment frames rewrite each instruction and reveal virtual-to-physical mappings.
- One collapsed scope disclosure; concise active operation. Reduced motion uses zero-duration transitions. Responsive editor/stage stacking on mobile.

### D verification

`node app/projects/mini-c-prototype/check-trace.cjs` passes: precedence, parentheses, locals, duplicate/missing/uninitialized names, unsupported input, syntax diagnostics, source ranges, deterministic frames/seeking, and independent virtual/physical instruction equivalence. No general test framework added.

Live checks: edited `7 * (2 + 3)` created its own AST/instructions; `/` produced immediate scope feedback; J/K and previous/next seeking worked; 2× playback reached the final frame and paused; scrubber reached final register assignment; dark/light and 390px/1050px layouts inspected. No document horizontal overflow in checked desktop/mobile layouts. Targeted ESLint and TypeScript passed. Production build validation recorded below.

New files for D: `animated.tsx`, `animated.css`, `trace.ts`, `check-trace.cjs`, and `review/`. Existing prototype route and shared switcher extended to D; no global site layout/style, listing, private compiler, or backend changes.

### Requested external design review and final visual direction

Claude CLI review completed successfully with **`claude-fable-5-1[1m]` / `--effort xhigh`**, no fallback model. Canonical model reported `claude-fable-5-1`. It was a non-mutating, code-based design review with tools disabled, limited to the original UI/CSS/trace; no coursework files. The review took about nine minutes. Durable artifacts: [prompt](review/fable-prompt.txt), [review](review/fable-review.md), [model/command evidence](review/fable-evidence.json).

Applied / confirmed against the reviewer findings:

- Motion-managed centering, shared SVG/node coordinates, animated edge geometry, and non-scaling strokes. Initial and final position units now agree.
- Source scrolling stays inside its pane; no page scrolling during playback. The instruction column scrolls internally to the current instruction.
- Whole tokens use width-aware packing; a three-row moving tray window keeps large traces from colliding with the AST. Token strings such as `return` are no longer truncated on mobile.
- Higher-contrast operation text and muted labels, larger small text, proper range-control height, quiet live announcements during playback.
- Scope disclosure overlays instead of pushing the whole stage; first frame has a neutral ready state and one clear start affordance. Kept the existing shared variant arrow shortcut (the reviewer had not received that component).
- Kept explicit editor focus/edit mode and the existing transport placement for this iteration; neither blocks the requested walkthrough and both remain open to user feedback.

Stanley then requested: ditch the green background, stay minimal, match the site’s mix of retro terminal and classy serif. D now uses the live site's white / zinc-950 backgrounds and neutral zinc foregrounds/borders, `--font-serif` (Charter first) for its heading and `--font-mono` (Berkeley Mono first) for code/controls. Green washes/glows were removed, including D's switcher. Source/node focus uses restrained neutral highlighting. Verified updated light/dark desktop and mobile screenshots; no mechanism changes for the palette adjustment.

D production build passed, with targeted lint and TypeScript checks separate because the repository skips build lint. Final preview is kept on port 3107; no commit, push, or deploy.

## Revision D2 — dense mono restyle and real-compiler reference (2026-09-20)

Stanley asked for a denser, more compact, mono-first look that still belongs to the site, "like it should feel like a compiler," citing the Commit Mono site as tone. He also asked for the real compiler's AST output for each preset so the sketch's trees can be compared to the correct ones.

### Reference artifacts

`reference/` holds artifacts from the Java coursework compiler for the four presets: `.c`, `.ast` (ASTPrinter s-expression via `Main4 -ast`), `.sem.txt`, `.dot` and `.svg` (DotPrinter via a 15-line scratch driver, `DotDump.java`, kept there for reproducibility), and `.asm` from `-gen colour` where semantic analysis passes. `reference/README.md` lists the commands. No compiler source is copied. `reference.ts` embeds the `.ast` and `.sem.txt` text for the UI.

`trace.ts` gained `toSExpression`, which renders the sketch's tree in ASTPrinter notation, and `prettySExpression`. `check-trace.cjs` now asserts the sketch matches the real compiler's tree for every preset; all four match exactly.

Grammar fix found by the comparison: real Mini-C rejects `int x = 4;` (`expected (SC) found (ASSIGN)`), so the sketch now rejects initializers with a source-linked diagnostic. The presets already avoided them.

### UI

`animated.tsx` and `animated.css` were rewritten. Same mechanism and frames; new shell:

- One-line header: small serif title, numbered phase nav (`01 tokens … 05 regs`, active inverted), `about` disclosure.
- Editor with a real line-number gutter; pre and textarea share one grid cell and scroll together. 22px row rhythm everywhere.
- Reference panel under the editor: `Main4 -ast <preset>.c` tree, `sketch tree identical` or the sketch's tree when it differs, and `Main4 -sem` output. Custom source shows a "no reference" line.
- Stage on a 22px ruled background, flat 1px pieces, focused piece inverted, thin edges, instruction listing with inverted current line.
- Status line with an inverted phase tag and `NN/NN` counter. Footer key bar in the Commit Mono style: `spc play · j k step · r reset · 1–5 phase · e edit · - + speed`, plus the scrubber. All keys work; Escape leaves the editor.
- Dev switcher restyled to the neutral shell in both themes.

Checks: `node app/projects/mini-c-prototype/check-trace.cjs` passes; targeted ESLint and `tsc --noEmit` clean; Playwright captures (cached Chromium 1217, `chromium.launch` needs an explicit `executablePath` because the installed Playwright expects a newer build) at 1280 and 390 wide in light and dark show no console errors and no horizontal overflow. Still not committed; production route still disabled.

## Revision D3 — Pratt beat folded into the Parse phase (2026-09-21)

A separate `/pratt` route with call stack, precedence ladder and decision log
was built first and judged too convoluted; it was removed. Instead the Parse
phase of variant D now carries the one idea that matters:

- `trace.ts` expression parsing is a Pratt loop with the real parser's shape
  (`expression(limit)` plus a binding table `*` 7, `+`/`-` 6, `(` resets to 0).
  Trees and instruction order are unchanged; `check-trace.cjs` still passes.
- Operator nodes are created when the operator is read, with only their left
  child, and rendered dashed (`.ac-piece.node.pending`) until the right side
  arrives. The tree visibly "waits" at `+` while `×` builds underneath.
- Captions narrate the decision without numbers: "× binds tighter than +, so 2
  goes to × first", "+ binds no tighter than ×, so × closes first", "Another -:
  the one already waiting closes first, left to right", "A group: everything
  inside closes before anything outside".
- Open question for the map: keep the toy recorder or emit these frames from
  `Parser.java` (editable) as a real trace.

## Revision D4 prep — back-end traces (2026-09-21)

Question raised: can the CFG, liveness and graph colouring be animated as later
phases? The toy recorder cannot do it, so frames now come from Java:
`RegAllocTrace` in the compiler repo writes `reference/*.regalloc.json` (see
reference/README.md). Numbers for the five passing programs, 18-register palette:

| program        | blocks | vrs | IG edges | sweeps | colours used |
|----------------|--------|-----|----------|--------|--------------|
| precedence     | 18     | 5   | 4        | 2      | 3            |
| local-variable | 22     | 8   | 5        | 2      | 3            |
| loop           | 39     | 21  | 15       | 3      | 3            |
| function-call  | 19+19  | 5+2 | 2+0      | 2      | 2            |

Observations for the phase design:
- Codegen makes every temp its own virtual register, so live ranges are one to
  three instructions long and the interference graph is sparse (max degree 4).
  With 18 colours nothing ever spills; `--k 2` on loop.c forces two spills, which
  is the interesting frame. Cap k for the demo.
- Only 27 of loop.c's 39 blocks touch a virtual register; the prologue/epilogue
  chain (blocks 0–4, 34–38) can be collapsed in the view.
- Liveness converges in two sweeps for straight-line code, three with a loop:
  sweep 1 fills 36 sets, sweep 2 changes 6 (the loop-carried ones), sweep 3
  confirms. Animate sweep 2 as "the back edge carries v5's use around."
- Decision still open: fold these into variant D as phases 05/06, or a separate
  back-end diagram that shares the phase strip. Decide on the map.

## Revision D4 — presets play the compiler's frames (2026-09-21)

Decision: frames for the presets now come from the Java compiler, not the toy
recorder. `ParseTrace` (compiler repo, `src/test/util`) emits
`reference/<name>.trace.json` with Tokens, Parse and Check phases. The parser is
untouched: the frames are derived from the token order and the AST's token
anchors. Reading tokens in order and asking which nodes start here, which
operator now holds only its left side, and which pending nodes can close,
reproduces the parser's sequence because the tree shape is the parser's.

- `reference.ts` imports the JSON; each preset's source, AST string and sem
  lines come from it. Presets added: Loop (body now `sum = sum + i * 2` so it
  has a precedence beat) and Function call.
- `animated.tsx` uses `reference.trace` when the source matches a preset and
  the toy `buildTrace` otherwise, so typing still works within the toy subset.
- New Check phase beat: dashed links from each use back to its declaration,
  including parameter and function-definition links across subtrees; an
  unresolved name is the error frame. Types are not animated (decision: paint
  statically later).
- Emit and Registers phases are empty for presets now; the toy's three-address
  code is gone from them. Next: a back-end diagram fed by
  `reference/*.regalloc.json` (liveness sweep, colouring with a k knob).
- The reference panel's "match" badge is now tautological for presets (both
  sides come from ASTPrinter). Keep it for typed sketches, or drop it.

## Variants A–C removed; reference tree grows with the diagram (2026-09-21)

Only the animated compiler remains. `prototype.tsx`, `prototype.css`,
`fixtures.ts` and `components/PrototypeSwitcher.tsx` are deleted; the page
renders `AnimatedCompiler` directly and the `?variant=` query is ignored.

The reference panel's s-expression is now built frame by frame from the same
node and attachment state as the diagram (`partialSExpression` in trace.ts):
a waiting operator prints as `BinOp(IntLiteral(4),ADD,…)` until its right side
attaches. From the end of Parse onward it is the compiler's own ASTPrinter line.
(The reference panel and `partialSExpression` were removed later; see the
handoff doc.)

## Step explanations and hover cards (2026-09-22)

Design settled in two rounds with GPT Astra 6 (via `codex exec`, transcript in the
session scratchpad). Consensus:

- The step sentence in the status strip is the doorway. Clicking it opens a popup
  anchored above it, styled like the about popup, content-sized. It starts closed,
  opens once on the first manual step (j/k or the step button), stays open across
  steps, scrubbing, and preset changes, hides during playback, and an explicit
  dismissal (Escape, outside click, clicking the sentence, opening about) keeps it
  closed until the sentence is clicked again.
- Every frame carries a structured `why` (see `Why` in `trace.ts`) written by both
  producers: the toy `buildTrace` and `util.ParseTrace` in the compiler repo. Prose
  lives only in `explain.ts`, filled from the frame's ids, so the same sentences
  serve presets and typed programs. Titles are never parsed.
- Hover on a token or node (250 ms delay, click during playback) shows a one-line
  card: kind and what is attached so far. It highlights the source span and any
  check-phase declaration link, never the subtree. One explanation at a time: a
  hover card stands in for the step popup.
- Removed: the editor's bottom bar and its edit button (click the code to edit),
  the footer's edit and phase buttons (shortcuts stay), the phase tag in the
  status strip, the centre "space run" button, and the reference panel's
  hide/show button (its label toggles). Kept: the error banner, phase nav.
- Not done from Astra's list: collapsing the reference panel by default. It stays
  open because the tree-building view was just requested.
- Emit and Registers explanations only apply to typed programs; presets stop at
  Check until the back end is traced on this page.

## Phases 03–05 from the real compiler (2026-09-22)

Presets now play every phase from the coursework compiler; the toy back end
remains only for typed programs.

- Check gains type frames (`check.type`) for declarations and return
  statements, from the analyser's own `Expr.type` and `FunDef.type`.
- Emit shows the real MIPS on virtual registers. `ParseTrace` attributes each
  instruction to the AST node being visited when it was emitted, through a
  small inert hook added to the compiler's `gen.CodeGen` (a static observer,
  null unless a tool sets it) and three-line wrappers on `ExprValCodeGen.visit`,
  `StmtCodeGen.visit`, and `FunCodeGen.visit`. `.asm` output is unchanged. This
  is the one edit outside `src/test/util`; the alternative was guessing the
  attribution from instruction patterns.
- Prologue and epilogue collapse into one frame each; a node's consecutive
  instructions form one frame (`mult` + `mflo`, address + load, call sequence).
- Registers folds into the same page rather than a separate diagram: the tree
  gives way to the interference graph on the left, the instruction list stays
  on the right and rewrites `vN` to `$tN` as each select step lands. Frames:
  CFG (with back edges named), one per liveness sweep (live-out sets appear
  beside the instructions, changed rows marked), the interference graph, one
  per simplify/select step, done. Palette is the allocator's full 18, so the
  presets never spill; `loop.k2.regalloc.json` (two registers) is kept for a
  later knob.
- Hover: instruction rows show source, def, reads, and live-out; graph nodes
  show what they hold and who they overlap. Both use the popup slot.
- `check-trace.cjs` asserts instructions equal the CFG blocks, registers equal
  the colouring result, emit ranges are consistent, and the error preset has no
  back end.
