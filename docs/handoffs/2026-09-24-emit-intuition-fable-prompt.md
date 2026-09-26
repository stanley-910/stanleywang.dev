You are reviewing the design of one phase of an animated compiler walkthrough for intuitiveness. This is a review: do not edit any file. Your final message is the deliverable; it will be saved as `docs/handoffs/2026-09-24-emit-intuition-fable-answer.md`.

Working directory: /Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase (branch `compiler-showcase`, uncommitted work in progress; that is the state to review).

## The page

A dev-only page at `http://127.0.0.1:3107/projects/mini-c-prototype` (a dev server is already running; do not start one). It walks a small C-like program through lexer, parser, semantics, types, emit and register allocation, one step at a time. Code: `app/projects/mini-c-prototype/`. The phase under review is **emit** (code generation, virtual registers), plus how it hands over to **regs** (liveness and allocation).

- Open a preset at a step with `?example=<name>&frame=<n>`; names are lowercase with spaces, URL-encoded: `precedence`, `parentheses`, `local%20variable`, `loop`, `function%20call`, `unresolved%20name`. Key `5` (or the `emit` tab) jumps to the emit phase, `6` to regs; `h`/`l` step back/forward, space plays. The counter at the bottom right shows the step.
- Use a viewport at least 960x600; narrower stages hide the tree.
- A browser is available as the `chrome_devtools` tools (headless, isolated). Look at real states before judging: at least `function call` (from about step 55 to its last emit step, it has a call, arguments and a return) and `loop` (a while loop, branch labels, many registers), and step through a few statements in each, with play as well as stepping, since timing is part of the design.

Files that matter for emit: `animated.tsx` (the component, very large; search for `Emit`, `emitStage`, `withEmitBlocks`, `ac-reg`, `StackColumn`), `emit-view.ts` (how emit is grouped into steps), `reg-badges.ts` (register badges on the tree), `stack-view.ts` and `stack-column.tsx` (the stack column), `explain.ts` (the note card's copy per step, and the phase intro slides in `PHASE_SLIDES.Emit`), `animated.css`. Background and past decisions: `docs/handoffs/2026-09-24-compiler-showcase-live-markup.md`, especially "Emit in blocks and the stack column", "Liveness facts", "Register badges" and "Open items"; the earlier emit answers `docs/handoffs/2026-09-24-emit-styling-fable-answer.md` and `docs/handoffs/2026-09-24-emit-visual-astra-answer.md`.

Reference images (read them as files):

- The course's lecture slides on the call stack and calling convention, which the stack column was modelled on: `/private/tmp/claude-501/-Users-stanley-worktrees-stanley-wang-2026-09-21-compiler-showcase/e63b2209-6028-4bcd-af50-22b0ea9cd227/images/78.png` through `83.png`.
- The owner's two latest screenshots: `.../images/118.png` (a function's type badge, `main  () → int`) and `.../images/119.png` (register badges `v0`, `v2` beside two `n` leaves, as they looked before today's restyle).

## What the owner, Stanley, said (verbatim)

> why don't we have cohesive styling for registers like we do with types. the registers are ugly. honestly might need a fable 5.1 xhigh review for design for all of omit for intuitiveness, the stack makes no sense rn

> heres my thing about the stack visualization. theres no point in it if we don't explain why we need to pass it int at this specific address ,etc. or else its just too complicated for no reason. do you say we cut it or do a better job at explaining? I think its cool if we get it right

Since those messages, register badges were restyled to match type badges (thin `--line` border, page background, muted text; dashed for a register holding an address; lit like an operator's input types while travelling up to the node that reads it; a green flash when written). Judge the current look.

## Agreed but not built: live-range lanes and plain hover

These were proposed and agreed in principle; they have not been built. Your layout must account for them.

1. Live ranges beside the assembly. Each virtual register gets a thin lane right of the code, starting with a `vN` tag on the line that writes it and running dashed down to its last read. Lanes are packed (values are short-lived, so peak width is about 4 lanes in `loop`, not 23), neutral during emit, and recoloured by the physical `$t` register they get during allocation (lanes sharing a colour never overlap, which is why allocation works). In the regs phase the lanes grow upward, as the liveness pass works backwards. The recorder stores each instruction's live-in/live-out sets, so this is exact.
2. Hovering an assembly line highlights that line and the source span it came from in the editor; the note card does not repeat the instruction. The note is for the story, not a tooltip.

Lanes and the stack column both want the space right of the assembly.

## What to answer

1. **The stack: cut it, or explain it properly?** Give a recommendation, not a survey. If keep: say exactly what a viewer must understand for it to earn its space (for example why the argument `n` is at `$fp+8`, why there is a return slot, why the old `$fp` and `$ra` are saved, what `pushRegisters`/`saved` is), and design how each of those moments is shown and tied to the instruction and source that cause it: which steps, what moves, what the note says (draft copy, marked as draft), and what is left out. If cut: say what replaces its job (the loads and stores still need a reason), and whether it comes back anywhere (for example only for the call).
2. **The rest of emit, for intuitiveness.** Walk it as a first-time viewer who knows some C but not compilers: tree, register badges, the assembly blocks and their comments, the note card, the phase intro slides, pacing and grouping of steps, the handover to regs. For each thing that confuses or overloads, say what a viewer would misread and what to change. Rank by impact.
3. **Register badges.** Do they now read as one system with type badges? What should the value/address distinction, the travelling state and the written flash look like, and should badges show anything else (for example the physical register once allocated)?
4. **Layout.** One desktop layout (about 790px stage and wider) and one narrow fallback, placing tree, assembly, lanes and (if kept) the stack, as an ASCII sketch like the earlier Fable answer's.
5. **Order of work.** A short, ordered list of changes, each small enough to build and check on its own, with the files it touches.

Keep UI labels terse (a word or two); put explanations in the note card. Match the page's existing visual language (monochrome, thin lines, one green for "ok", inverted piece for focus) rather than introducing new ones. Cite files and line numbers for claims about the code, and step numbers for claims about what the page shows. State uncertainty plainly.
