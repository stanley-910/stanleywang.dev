# Compiler showcase: live markup handoff

## Goal

Stanley reviews the animated compiler state by state in the live page and leaves
notes on elements; Claude applies them to `animated.tsx` / `animated.css`. This
replaces the Figma round trip, which lost detail on every capture (the slider
and stage rules were missing from every frame, highlighted source lines came out
scrambled, and layers were nested too deep to edit).

Work through the states in order. Parse (01–12) already reflects Stanley's first
note; start at **13 check · resolve**.

## Where things are

- Worktree: `~/worktrees/stanley-wang/2026-09-21_compiler-showcase`, branch
  `compiler-showcase`. The prototype, handoffs and `states.cjs` are committed
  (be702d8, 883daab header fix, 67a6ee2 live-markup work, 2026-09-24); the
  state PNGs and `.claude/launch.json` are left
  untracked on purpose. Commit again only when Stanley asks.
- Dev server: `npm run dev -- --hostname 127.0.0.1 --port 3107` from the
  worktree (check first: `lsof -iTCP:3107 -sTCP:LISTEN`). Page:
  <http://127.0.0.1:3107/projects/mini-c-prototype>. It 404s in production.
- Pre-edit copies of `animated.tsx` / `animated.css` (before the step-panel
  change): `~/.claude/projects/-Users-stanley-Developer-portfolios-stanley-wang/handoffs/compiler-showcase/`.
- Screenshots of every state: `docs/compiler-showcase-states/*.png`, regenerated
  by `docs/compiler-showcase-states/states.cjs` (see "Regenerating" below).
- Figma file (archive now, not the working surface):
  <https://www.figma.com/design/McvCUBlDFt2zhIpkM2E0Wc>. Rows by phase; 01–12
  are the new UI, 13–41 the old one, the bottom row "v1 · before frame-1 note"
  holds the originals including Stanley's annotated frame 1.

## Decisions so far

From Stanley's frame-1 note ("use this as the popup box per state"), applied on
2026-09-23:

- The page title "A compiler, in motion." is gone.
- The reference panel (real-compiler s-expression comparison) is replaced by a
  step panel under the source: header = step title (red on errors), body = the
  explanation. Instruction hovers, which have no spot on the stage, show there
  too.
- The floating "why" popover and its click/Escape handling are gone; the stage
  bar shows only the frame counter.
- State 11 "no popover" no longer exists. State 35 "reference collapsed" is
  obsolete for the same reason.

Treat the note as guidance on what not to include, not only a one-frame fix.

2026-09-24, live markup:

- Frame 0 step-panel header reads "press space to compile your code!" (was
  "ready · 45 tokens · press space", then "press space to start"). Its body is
  Stanley's welcome ("Welcome to an interactive port of a compiler I wrote…
  Enjoy.", explain.ts case `ready`).
- Panel chrome text (file name, preset picker, step header) is 12px like the
  code and body; step headers are weight 600.
- Stepping: h and k go back, l and j go forward. The footer legend shows only
  "h l step", and each key is its own button (h disabled at frame 0, l at the
  last frame). j/k are undocumented on the page.
- The work area (`.ac-work`) and the key footer (`.ac-keys`) sit on the page
  background at 90% opacity, so the site's background art only shows faintly
  through them.
- The frame slider matches the AST edges: a 1px hairline track (`--line`),
  filled in `--ink` up to the current frame (`--p` set inline), and a 2px × 12px
  playhead with a faint glow instead of the round native thumb.
- Say each thing once. Node, instruction and register hovers replace the step
  panel's text; they have no floating card. Tokens are the exception: hovering
  or clicking a token in the tray shows a small card under it on the stage:
  just the class ("symbol"), centred under the token. Clicking any token
  toggles the card open for every token until clicked again: it grows right
  and down (label nudging 12px left) to the full class list, only as wide as
  that list needs (up to 260px, then it wraps), the token
  highlighted in place. Animated with motion; instant under reduced motion.
  The panel keeps the current step. Token steps: header "Token: `;`", body
  just the class ("Symbol") above the lexeme list, with no role sentence
  (explain.ts case `token`). Step-panel headers are not underlined and render
  backtick code.
- Token classes follow the groups in `lexer/Token.java` instead of one
  "symbol" class: type (`int void char`), keyword, identifier, number, operator (`+ - * / % & .`),
  comparison (`== != < > <= >=`), logical (`&& ||`), delimiter
  (`{ } ( ) [ ] ; ,`) and assign (`=`; "assignment" was clipped under the
  token). `tokenKind` derives the class
  from the lexeme; `LEXEMES` is keyed by it. The lexer itself gives every
  lexeme its own category (PLUS, SC, ...); the groups are for reading.
- Name tokens are called "identifier" everywhere on the page (card, kind label,
  aria label, step text), via `tokenKind` in `explain.ts`. An identifier's card
  is "identifier" over its regex.
- On token steps the step panel always lists every lexeme in that class under
  the explanation, current one highlighted (no toggle). The lists (`LEXEMES`
  in `explain.ts`) come from `lexer/Token.java` in
  `~/Developer/mcgill/mini-c-compiler`; identifier and integer show their rule
  as a regex (`[A-Za-z_][A-Za-z0-9_]*`, `[0-9]+`) instead of a list. Char and string literals exist in Mini-C but have no page
  class.
- The step panel holds one height through the whole tokens phase. Hidden
  copies of the longest-worded step of each token class share a grid cell with
  the real one (`.ac-note-stack`, `tallestTokenSteps`), so the box is sized for
  the tallest at the current width. At full width everything fits and nothing
  grows; on a narrow stage the box grows once at the start of tokens (410 →
  428 px at 680 wide) and shrinks back once on entering parse.
- Exception, by request: in the tokens phase the lexeme being read carries its
  kind ("symbol", "identifier", …) in small muted text underneath. Not in parse.
- The tree layout is width-aware (`treePositions` in `trace.ts`): each subtree
  gets a slot as wide as its widest row, so labels can't overlap. The tree
  spreads out to fill the stage, up to 3× its natural width, and scales down
  uniformly (text included) when the stage is narrower. The token tray wraps in
  pixels too.
- The about popup holds only Stanley's intro (the presets/teaching-compiler
  and key-binding paragraphs were removed), linking COMP520
  to <https://www.cs.mcgill.ca/~cs520/2026/>. Links use the
  site's `.prose-link` class (`app/styles/markdown.css`), not a local style.
- The teaching compiler (typed programs) records parents first, like the real
  ParseTrace: `main` appears pending, each statement node opens before its
  value and joins `main` once complete, and "Function main is complete" closes
  the parse. Previously it built everything bottom-up with `main` last.
  Stanley wants the presets finished before more custom-program work.

- Source editor rows are 19px (`--row` on `.ac-source`, `SOURCE_ROW` in
  the scroll code). Tab indents (2 spaces; whole lines when a selection spans
  lines), Shift+Tab outdents, Enter keeps the indent and adds a level after
  `{` (splitting `{}` onto three lines), and `}` on a blank line outdents.
  Edits go through `execCommand('insertText')` so undo keeps working; Escape
  leaves the editor.
- Presets match ignoring whitespace: `findReference` compares lexemes, and
  on a whitespace-only edit it moves every span in the recorded trace onto the
  new text (`reflow` in `reference.ts`). Before this, any edit (even a Tab)
  dropped to the teaching compiler, which has no `<` or `while`.
- The preset picker is a custom listbox (`Picker`), not a native `<select>`,
  so its open list matches the page: hairline box, muted rows, the hovered row
  on `--line`, the current preset marked `>`. Arrows/j/k move, Enter picks,
  Escape closes. The current preset is plain muted text (no box or underline),
  ink on hover or while open. The open list marks the active row (hover or
  arrow keys) with one shallow chevron (~140° at the tip) that slides between
  rows in 0.18s; the current preset's row is ink. A chevron beside the closed
  name (morphing > to v) was tried and removed. When the preset changes (picked, or
  "custom" once the code is edited) the name morphs (`MorphText`): the length
  steps one letter per 40ms tick, growing leftward or shrinking rightward
  since the box is right-aligned, and each letter cycles through random ones
  before settling, left to right. A larger, sharper chevron, a flickering
  mark, a flickering border, a dither/wobble filter and a box around the name
  were tried and dropped. Reduced motion: the name swaps instantly.

- Phases can open with text-only slides (`PHASE_SLIDES` in `explain.ts`),
  shown on the frame before the phase's first step, so URLs and frame numbers
  are unchanged. The lexer has one (Stanley's "Where do we start?" over a
  lexeme/category table), between the welcome and the first token; the parser
  has two, both headed "Toking (Abstract Syntax) Trees" (Stanley's text: why tokens
  aren't enough, then precedence with `2 - 4 * 2` vs `(2 - 4) * 2`), between
  the last token and the first parse step. l/j step into a phase's slides, h/k from its first step lands on
  the last slide, Space plays straight past them, and clicking a phase tab
  (or 2-5) opens on its first slide; the lexer tab still opens the welcome.
  On a slide the tabs highlight the phase it opens. The gray "n/N" counter
  that reads "skip" on hover renders only for a deck of more than one slide.
  The lexer's slides 2-3 (whitespace, token classes) were cut.
- The welcome ends "…any machine!\u00a0Enjoy." (non-breaking, so Enjoy stays on
  the last line) then a blank line and "– Stanley". Step text keeps newlines
  (`white-space: pre-line` on the panel body).

- Detailed lexer mode: "[ ] detailed lexer" in a small "?" menu at the right
  end of the footer, after the timeline (opens upward; outside click or
  Escape closes it). It was first a toggle in the step header. On, the
  lexer steps one character at a time (`detail.ts` inserts `lex.char` steps
  before each token step, and a `lex.skip` step only for a comment (plain
  whitespace gets no step, by request); replayed from token spans, since the compiler reads whole tokens).
  The source underlines the characters read so far with the current one as a
  block, and only the finished token step fills the whole token in white;
  a skipped comment gets a faint band. The panel shows every class's
  lexemes (`CharTable`, `matchTable` in `explain.ts`). While a token is being
  read, everything it could still become is lit the same way, identifier
  included ("`i` could still become type `int`, keyword `if` or an
  identifier"): the lexer only decides at the token's end. On its last
  character only the class it becomes is inverted, and the text names the
  next character that ends it and, for words like `int`, that the type or
  keyword list wins over identifier (Stanley: identifier is only a potential
  match until the word ends with no other match). Toggling keeps the place (`origin` maps frames
  between the two lists); `?lexer=detailed` restores it. Character steps
  play at 160 ms. A hidden layer with the longest character step keeps the
  panel one height. The sizing layers (token and character) apply only on
  lexer steps, never on the welcome or a slide, so turning the mode on
  doesn't make a slide's box tall.
- Phase tabs are names only, no 01-05 numbers: lexer, parser, check, emit,
  regs (was tokens, parse). The welcome title is capitalised: "Press space to compile
  your code!".

- Edges stay late (decided): a tree edge appears when the parser returns the
  child to its parent (`frame.attached`). An "early edges" switch that drew
  it as soon as both ends existed was tried and scrapped.
- Step titles are off by default, as a flag while Stanley reads without
  them: "[ ] step titles" in the "?" menu, `?titles=on`. The welcome, slides
  and errors keep their header. Without titles a token step's body names the
  token ("`;` is a delimiter.") instead of only its class.
- Play waits for the real compiler: while a typed program is compiling, the
  play button is disabled and reads "loading compiler…" (first compile,
  downloading the 535 KB `compiler.js`) or "compiling…". Space does nothing
  until then, so the real trace can't replace a playing one and restart it.
- Real compiler errors read as sentences: `BrowserTrace.java` captures what
  the lexer and parser print and returns `{log, trace}`; `compilerError` in
  `explain.ts` turns the first line into e.g. "Expected `;` but found `=` on
  line 2." and highlights that token (was "Parsing failed (1 errors)" over
  the whole program). The error frame body says "The compiler stops at its
  first error. Fix it in the editor and it runs again."
- Parser slides are titled "Toking (Abstract Syntax) Trees" (Stanley's).
- Registers tie-break differs from the JVM in the browser; accepted as long
  as the allocation is correct.
- Tree row height follows fan-out (Stanley: four edges off one side of
  `main` blurred together). `treePositions` gives each row gap
  `1 + min(0.6, (side - 1) * 0.2)`, where `side` is the most children any
  parent in the row above has on one side of it. Two or three children keep
  the old gap. The extra height is added to the tree (it starts higher),
  not taken from other rows, up to 60 view units; past that all rows squeeze,
  so 100 declarations cost at most 1.6x on one row.
- Token card fix: clicking a second token used to pop its card open with no
  transition. Focus leaving the first token ran `clearHover` on blur, which
  unmounted the card between mousedown and click. Blur now ignores focus
  moving to another stage piece.

Open questions for Stanley, not yet decided:

- The step panel's header and body often say nearly the same thing (08: "×
  binds tighter than +, so i goes to × first" vs "× binds tighter than +, so i
  joins × first. + keeps waiting."). Drop the header, or make it a short label?
- Removing the reference panel removed the on-page check that the sketch's tree
  matches the real compiler's. `partialSExpression`, `prettySExpression`,
  `toSExpression` in `trace.ts` are now unused but kept.

## Desktop setup

1. Start a Claude Code session in the desktop app on the existing worktree folder
   above. Pick the folder directly; don't let desktop create a new worktree
   under `.claude/worktrees/`.
2. `.claude/launch.json` (untracked, in the worktree) defines the preview server
   `compiler-showcase` on 127.0.0.1:3107. Stop any other server on 3107 first.
3. Open the Browser pane, go to `/projects/mini-c-prototype?example=loop&frame=84`.
4. To point at something: Cmd+Shift+S selects an element in the Browser pane,
   then type the note. The docs don't say what the selection sends (selector,
   screenshot, source location), so name the element in words too, and include
   the URL if it isn't obvious which state you're on.

## Opening a state

The URL carries the state: `?example=<preset>&frame=<n>`, and the address bar
follows the stage as you step, so a note left on the page names the state it was
left on. Presets: `precedence`, `parentheses`, `function call`, `loop`,
`unresolved name` (the dropdown's names, lowercased). Hovers, the about panel,
playback, custom programs and the mobile width are not in the URL; set them by
hand as listed.

Keys: space play, h/k back, l/j forward, r restart, 1–5 jump to phase, e edit, -/+ speed.

| State | Link | Then |
| --- | --- | --- |
| 13 check · resolve | `?example=loop&frame=84` | |
| 14 check · names done | `?example=loop&frame=89` | |
| 15 check · types | `?example=loop&frame=90` | |
| 16 check · unresolved name | `?example=unresolved+name&frame=21` | |
| 17 check · error end | `?example=unresolved+name&frame=22` | |
| 18 emit · prologue | `?example=loop&frame=93` | |
| 19 emit · instructions | `?example=loop&frame=104` | |
| 20 emit · epilogue | `?example=loop&frame=119` | |
| 21 emit · hover instruction | `?example=loop&frame=119` | hover the 15th instruction |
| 22 regs · cfg | `?example=loop&frame=120` | |
| 23 regs · liveness sweep 1 | `?example=loop&frame=121` | |
| 24 regs · liveness last sweep | `?example=loop&frame=123` | |
| 25 regs · interference | `?example=loop&frame=124` | |
| 26 regs · simplify start | `?example=loop&frame=125` | |
| 27 regs · simplify mid | `?example=loop&frame=138` | |
| 28 regs · select start | `?example=loop&frame=148` | |
| 29 regs · select mid | `?example=loop&frame=160` | |
| 30 regs · done | `?example=loop&frame=171` | |
| 31 regs · hover register | `?example=loop&frame=171` | hover v16 |
| 32 regs · two functions | `?example=function+call&frame=70` | |
| 33 ui · playing 2x | `?example=loop&frame=60` | `=` twice, space |
| 34 ui · about open | `?example=loop&frame=83` | open "about" |
| 36–38 custom | none | paste the program below, press 3 / 5 / play to end |
| 39 custom · error | none | paste the error program below, play to end |
| 40–41 mobile | `?example=loop&frame=83`, `frame=171` | 390 px wide |

Custom program (36–38):

```c
int main() {
  int a;
  int b;
  int c;
  int d;
  a = 10;
  b = 5;
  c = 3;
  d = 8;
  return a + b * c - d;
}
```

Error program (39), which ends on an error in the sketch:

```c
int main() {
  int a;
  a = 20;
  return a / 4 * 2;
}
```

More test programs: `app/projects/mini-c-prototype/custom-examples.md`.

## Loop per state

1. Stanley opens the state, leaves notes on elements.
2. Claude restates each note as a change, flags any that conflict with an earlier
   decision above, then edits.
3. Verify: `npx tsc --noEmit -p .`, `npx eslint app/projects/mini-c-prototype`,
   reload the same URL. Stanley confirms or adds notes.
4. Append new decisions to "Decisions so far" so later states follow them.

## Regenerating screenshots

`docs/compiler-showcase-states/states.cjs` drives headless Chromium through every
state. Run it from a directory with `playwright-core` installed (the previous
session used its scratch dir; `npm i playwright-core` anywhere works) and point
it at the cached browser it names:

```sh
node states.cjs --dry        # all states -> ./states/*.png
node states.cjs --dry 20     # states up to 20
```

It still lists state 35 only via the old PNG; delete
`docs/compiler-showcase-states/35-ui-reference-collapsed.png` once 34 is redone.
Passing an `ids.json` instead of `--dry` also sends each state to Figma, which
needs fresh capture IDs from the Figma MCP and the TEMP script in `page.tsx`.

## Real compiler in the browser (2026-09-24, testing)

Stanley chose to run the real compiler client-side instead of porting more of
it into the teaching compiler, so the work can go into rendering and
presentation.

- `browser/build.sh` compiles the compiler repo's `src/java` plus
  `ParseTrace`/`RegAllocTrace` and `browser/BrowserTrace.java` to
  `public/mini-c/compiler.js` (~530 KB minified) with TeaVM 0.12 (jars in
  `~/.cache/teavm/lib`, fetched from Maven Central by
  `~/.cache/teavm/resolve.py`). `public/mini-c/` is gitignored and no compiler
  source enters this repo. `MINIFY= browser/build.sh` gives a readable build.
- The build patches a temporary copy only: `desugar.py` rewrites
  `case BaseType.INT` pattern labels as guarded patterns (javac emits an
  EnumDesc constant TeaVM can't translate); `Integer::sum` becomes a lambda;
  `Files.readString(file.toPath())` becomes a `FileInputStream` read; the
  reflective `ProgramCodeGen.generate` call becomes a direct one; the
  `Register.Virtual`/`Label` intern tables are made public so `BrowserTrace`
  clears them before each compile (a JVM run gets a fresh process).
- `real.ts` runs each compile in a fresh module worker: 1,200-char cap before
  it runs, 2 s timeout (counted once `compiler.js` has loaded) that terminates
  the worker, and abort when the source changes. The page tries it 250 ms
  after typing stops for any source that isn't a preset; the teaching compiler
  covers the wait and any failure (missing file, timeout, exception), with a
  console warning. Its error banner is held back until the real compiler has
  answered or failed, and an arriving real trace restarts at frame 0.
- Checked against the six presets in Node: tokens, tree, check lines and every
  emitted instruction match the JVM exactly, 1-40 ms per program. Only the
  Registers phase differs: `Register.Virtual` has identity `hashCode`, so the
  allocator's simplify order follows HashMap iteration over identity hashes,
  which HotSpot and TeaVM break differently. Both runs are the real
  allocator. Presets still play the recorded (JVM) traces.
- Rough edges for the presentation pass: a parse error arrives as "Parsing
  failed (1 errors)" spanning the whole source with the body "Delimiter"; the
  parser's own message goes to stderr and isn't captured.
- Shipping: Stanley plans to ship the bundle. The minified TeaVM output
  already renames every class, method and field (`ParseTrace`, `Tokeniser`
  etc. don't appear); only string literals such as error messages stay
  readable, which he accepted. No extra obfuscation.

## Open items (not started)

- Remove the TEMP Figma capture `<script>` in `page.tsx` once Figma is done with.
- Mobile layout needs a pass (40–41).
- Emit/regs on a narrow stage: the tree only gets the left ~46% beside the
  instruction list, so on a ~380px stage it scales to about a quarter size and
  its labels become unreadable. It needs a different arrangement there (tree
  above the list, or tree hidden), not more scaling.
- ParseTrace mishandles casts and `return`; the sketch rejects read-before-assign.
- Longer-term direction (real JSON traces, portfolio page) is in
  `docs/handoffs/2026-09-21-compiler-showcase-wayfinder.md`.
