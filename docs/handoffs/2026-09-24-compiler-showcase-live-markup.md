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
  has two, headed "Toking (Abstract Syntax) Trees" then "The Problem with Precedence" (Stanley's text: why tokens
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
  play at 160 ms. The token sizing layers apply only on lexer steps, never
  on the welcome or a slide. The character-step and parse-step sizing
  layers were removed: with the canvas fixed they only made the note tall
  and cut the source short (Stanley: shrink when it isn't needed).
- Phase tabs are names only, no 01-05 numbers: lexer, parser, check, emit,
  regs (was tokens, parse). The welcome title is capitalised: "Press space to compile
  your code!".

- Edges stay late (decided): a tree edge appears when the parser returns the
  child to its parent (`frame.attached`). An "early edges" switch that drew
  it as soon as both ends existed was tried and scrapped.
- Step titles are off by default, as a flag while Stanley reads without
  them: "[ ] step titles" in the "?" menu, `?titles=on`. The welcome and
  slides keep their header. Without titles a token step's body names the
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
- Parser slides: 1 "Toking (Abstract Syntax) Trees", 2 "The Problem with
  Precedence", 3 the same title, Stanley's aside on recursive descent plus a
  Pratt parser for infix expressions (links matklad's "Simple but Powerful
  Pratt Parsing"). I filled the parenthetical, "infix" and the last clause
  at his request. His draft said tighter operators end up *higher* in the
  AST; they end up deeper, so it says that. `Prose` now renders
  `[text](url)` links (`.prose-link`) and `*italic*`.
- Check slides follow the real `SemanticAnalyzer`, which runs `NameAnalyzer`
  then `TypeAnalyzer` (break/continue/return context is checked in the type
  pass). Before the first check step: 1 "Correct Grammar, Wrong Program"
  (Stanley's intro; "out" fixed to "our", list reordered to pass order),
  2 "Semantic Analysis" (his sentence), 3 "Name Resolution and Scoping"
  (my draft). "Type Analysis" (my draft) sits between "Every name has a
  declaration" and the first type step, via `STEP_SLIDES`: slides that open
  a pass mid-phase, placed only if the pass is reached, so a program that
  fails name resolution never shows it. The teaching compiler interleaves
  names and types, so it gets no type slide.
- The stage alone sets the work row's height. `.ac-editor` is `height: 0;
  min-height: 100%`, the source is `flex: 0 1 236px` with a three-row floor,
  and the note is `flex: 1 0.001 auto`, so a long slide grows up into the
  source (which scrolls) instead of stretching the canvas and rescaling the
  tree. Past the source's floor the note body scrolls. Mobile (one column)
  keeps the old fixed 132px source.
- The canvas fills the window: `.ac-scene` is `clamp(420px, 100dvh -
  210px, 860px)` (380px floor under 900px wide), 210px being the site
  header, tabs, stage bar and keys. At 763px tall that is 553px and the keys
  end 25px above the bottom. The editor bar and error chip don't shrink
  (the bar was squeezed by a tall note), and the source re-scrolls to the
  active line when it's resized, not only when the span moves.
- The note's top border (`.ac-split`) drags to set the source height,
  kept in localStorage (`mini-c-split`); double-click resets to automatic,
  and arrow keys move it a line at a time when focused. The note keeps at
  least ~72px. Hidden on mobile.
- Stage SVGs (`.ac-edges`, `.ac-graph`) draw in scene pixels (viewBox =
  measured scene size) instead of stretching 680 × 480 with
  `preserveAspectRatio="none"`. The stretched, non-scaling stroke made
  motion's `pathLength` dash measure in the wrong space, so long sideways
  edges stopped ~12% short of their child (Stanley spotted it on `main`'s
  edges); interference-graph lines had the same bug.
- The error chip under the source is one line with an ellipsis; hovering a
  cut message scrolls it to the end once (class `scrolling` set on
  mouseenter) and stays there until the pointer leaves, which resets it.
  It starts as soon as you hover, at about 150 px/s (at least 1 s). It
  used to wait about 0.7 s, then loop back and forth. Its tag is `.ac-diag-tag` (the old
  `.ac-diag span` rule painted every span as a badge once the message
  rendered code). No native tooltip; the scroll shows the whole message. The tag is plain
  "error" in `--err`, weight 600, same size as the message (was a small
  uppercase badge); the message keeps the panel's text colour. The chip
  rule is `.ac button.ac-diag`, since `.ac button` reset its padding and
  border. Error frames have no step header: the chip says it all, and the
  body says "The compiler stops at its first error. …".
- Stepping, the slider and phase jumps also wait for the real trace, not
  just play.
- `partialSExpression` and its `OPS` table are deleted (reference panel
  gone). `toSExpression` / `prettySExpression` stay: `check-trace.cjs`
  uses them to assert the teaching compiler's trees match the presets.
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

- Detailed parser mode (2026-09-24, removed the same day): a "[ ] detailed
  parser" option showed the parser's call stack, a precedence table cut at
  the current limit, and one step per `parseExpr` call. Stanley found it
  unreadable for visitors; the tree now shows the decisions instead (see
  "Precedence in the tree" below), so the mode, `Frame.stack`/`compare`,
  `parse.call` and their sentences are gone, and `?parser=detailed` is
  ignored. The shadow parser it needed stays, in `parse-replay.ts`, for the
  rebuilt parse steps below.
- Parse steps rebuilt for compiler traces (2026-09-24). ParseTrace.java's
  replay (compiler repo test utility, not the parser) decides what an
  incoming operator closes by comparing node ends that are still growing, so
  chains came out wrong. In `4 - n + 2 * 3 - n` the last `-` "bound tighter
  than ×" and closed before `×` and `+` did (Stanley's markup). In
  `-x * (2 + y) - f(1)`, `×` closed before the group's `)`. The compiler
  repo stays untouched, so `replayParse` in `parse-replay.ts` (was
  `parse-detail.ts`) rebuilds the
  parse steps from the shadow parser's own order, using the recorded
  tree's nodes and ParseTrace's titles and step kinds. Presets and typed
  programs both go through it (`replayedParse` on the base trace). If the
  shadow can't follow a program or leaves a node unshown, the recorded steps
  stay. On all six presets the rebuilt steps match the recorded ones:
  kinds, titles, spans, focus, and visible and attached nodes. Two
  deliberate differences:
  - an assignment statement's node now appears when its `=` is read, not
    at its target name, so the `=` leaves the token tray as `sum =` appears
    (Stanley: the `=` was still in the tray);
  - a node inside parentheses keeps its unbracketed span until the `)` is
    read (the recorded tree stores the widened one), peeled one pair at a
    time, so `((4 + 2))` closes twice: `(4 + 2)`, then `((4 + 2))`;
  - an assignment appears at its `=` token and closes by being the pending
    assignment, not by token, so `(x) = 1` (built at `(`) closes; a group
    with no node of its own, like `(x)` there, shows no group steps. The
    fallback to the recorded steps now also requires every opened node to
    have closed.
- Copy (Stanley, 2026-09-24): the last parse step reads "AST is complete
  with N nodes", his wording as written, with no final period. "Its body
  holds 6 items" and "The block closes with 1 item inside" lost their
  counts, since "items" meant declarations and statements and read as
  vague: "`main` is complete." and "The block closes." On that last step
  every edge is lit, not only the root's (which the focus rule lit before).

Open questions for Stanley, not yet decided:

- The step panel's header and body often say nearly the same thing (08: "×
  binds tighter than +, so i goes to × first" vs "× binds tighter than +, so i
  joins × first. + keeps waiting."). Drop the header, or make it a short label?
- Removing the reference panel removed the on-page check that the sketch's tree
  matches the real compiler's; `check-trace.cjs` still asserts it for the
  presets.

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
| 13 check · resolve | `?example=loop&frame=89` | |
| 14 check · names done | `?example=loop&frame=98` | |
| 15 check · types | `?example=loop&frame=99` | |
| 16 check · unresolved name | `?example=unresolved+name&frame=24` | |
| 17 check · error end | `?example=unresolved+name&frame=25` | |
| 18 emit · prologue | `?example=loop&frame=102` | |
| 19 emit · instructions | `?example=loop&frame=113` | |
| 20 emit · epilogue | `?example=loop&frame=128` | |
| 21 emit · hover instruction | `?example=loop&frame=128` | hover the 15th instruction |
| 22 regs · cfg | `?example=loop&frame=129` | |
| 23 regs · liveness sweep 1 | `?example=loop&frame=130` | |
| 24 regs · liveness last sweep | `?example=loop&frame=132` | |
| 25 regs · interference | `?example=loop&frame=133` | |
| 26 regs · simplify start | `?example=loop&frame=134` | |
| 27 regs · simplify mid | `?example=loop&frame=147` | |
| 28 regs · select start | `?example=loop&frame=157` | |
| 29 regs · select mid | `?example=loop&frame=169` | |
| 30 regs · done | `?example=loop&frame=180` | |
| 31 regs · hover register | `?example=loop&frame=180` | hover v16 |
| 32 regs · two functions | `?example=function+call&frame=77` | |
| 33 ui · playing 2x | `?example=loop&frame=61` | `=` twice, space |
| 34 ui · about open | `?example=loop&frame=85` | open "about" |
| 36–38 custom | none | paste the program below, press 3 / 5 / play to end |
| 39 custom · error | none | paste the error program below, play to end |
| 40–41 mobile | `?example=loop&frame=85`, `frame=180` | 390 px wide |

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

## Precedence in the tree (prototype, 2026-09-24)

Stanley found the detailed parser view (call stack, precedence table)
unreadable for visitors and asked for the decision to show in the tree.
GPT-6 Astra (xhigh, via `codex exec`) proposed a "held operand" treatment;
prompt and answer are in `docs/handoffs/2026-09-24-parse-visual-astra-*.md`.
It is built in `parse-view.ts`:

- The finished layout is the target. A shown node that isn't attached yet
  sits in the open slot of its nearest shown ancestor, with a dashed edge
  (`.ac-held`). After `4 +`, `2` waits where the right side of `+` goes;
  `4 - n` waits in `return`'s slot until the outer operators appear, then
  moves down as one piece.
- A "tighter" step shows the incoming operator a step early at its slot
  (dashed box, `.preview`), and the operand moves under it then.
- One cue word beside one node (`.ac-cue`): `held` (a read operand whose
  next step is a decision), `tighter`, `left first` (equal levels),
  `× first` (looser), `prefix first`, `right first` (chained `=`).
- Parentheses draw faint brackets around the group while it is read,
  solid once its `)` is read, gone once the piece is attached.
- No "one piece" step (Stanley, 2026-09-24): it only repeated the step
  before, which had already finished the group's subtree. The `)` now
  seals the group on that step (`Frame.sealed`, set by both the replay and
  the teaching compiler): the brackets go solid, the code highlight covers
  the brackets, and the note adds "The `)` closes the group, so it goes on
  as one piece." `((4 + 2))` seals both groups on one step. Recorded
  traces that fall back unrebuilt keep their closing step, without the
  cue.
- Fixes found on the way (Astra and the Fable review both flagged them):
  `+` after `-` was "looser"; it is now "equal" (level, not symbol), with
  its own wording, in both the replay and the teaching compiler. Inside
  a group, argument or index the replay no longer claims the inner
  operator "binds tighter" than one waiting outside (the limit starts
  over, so there is no contest); that step is dropped. Presets still
  rebuild identically.
- Pieces have no border at all (`.ac button { border: 0 }` beats
  `.ac-piece`), so the old dashed "pending" style never showed; the
  preview sets its border explicitly.
- The incoming operator on a "left first" or "× first" step is lit in the
  token tray: the tray lights the token at the step's span, which for
  those steps is the incoming operator, so this needed no new code.
- While a group is read, operators waiting outside it are muted
  (`.outside`): only unfinished binary or unary operators outside the
  group, not finished ones.
- Astra's empty-circle socket was not built; the dashed held edge says
  the same thing.
- The call-stack view is removed (Astra's advice); see "Detailed parser
  mode" above.
- Tree layout (Stanley, 2026-09-24): a parent sat centred over its whole
  span, so in `4 + 2 * 3` the edge to `4` was twice as long as the one to
  `×`. `treePositions` now puts a parent midway between its first and last
  child, clamped inside its own span.

## Tree layout and check names (2026-09-24)

- Tree layout: GPT-6 Astra reviewed layout and edges
  (`docs/handoffs/2026-09-24-tree-drawing-astra-*.md`). `treePositions` is
  now a tidy tree: each subtree laid out alone, siblings packed by their
  rows' label edges plus the 14-unit gap, a parent midway between its
  first and last child. Unary chains are vertical and binary branches
  mirror with no clamp (the midpoint + clamp version tilted
  `return → +`). The loop tree is about a fifth narrower. Row gaps and
  the parse slot shifts are unchanged.
- Edge ports are worked out in pixels: an edge leaves a parent's box at
  its bottom centre and reaches the child's at its top centre, the box
  being 22px (20px when small or under 640px wide) times its scale. They
  used to be 11 stage units, which drifted as the stage stretched. Held
  edges share the helper; group brackets and name links are in pixels
  too. Checked on the precedence preset: every endpoint lands on its box.
- Not done from that review: explicit label metrics (`.ac button` zeroes `.ac-piece`'s padding and border), and
  dropping the late phases' separate 11/12 squeeze.
- The parse tray shows a multiplying `*` as `×` once parsing starts
  (Stanley); a prefix `*` stays as typed.
- Assignment targets are resolved (`withNameSteps` in `scopes.ts`, compiler
  traces only). The recorder has no node for a target (the tree folds it
  into `i =`), but NameAnalyzer resolves it, target before value, so each
  target gets a resolve step in source order, before the uses on its
  right: "The target `i` refers to `int i;` on line 2." Loop gains 4
  steps and local variable 1; later frame links above are shifted. A
  target with no declaration becomes an unresolved step and is counted.
- Name links are ink, not the error colour (Astra's check answer). Only
  the step's own binding is drawn, or a hovered use's or declaration's;
  see "Name link routing" below. This replaced the pile of arcs on
  "Every name has a declaration".
- Scope strip (`scope-strip.tsx`, scopes from `scopesOf`): during the name
  pass, the bottom of the stage lists the scopes open at the current use,
  outermost first (`global`, then the function, then nested blocks), each
  with what has been declared in it so far. Scopes follow NameAnalyzer: a
  function's parameters and top-level declarations share one scope; each
  nested block has its own. The lookup is shown in one step: scopes
  searched without a match are dashed, the match is inverted, `outer` when
  it was found outside the use's own scope, `not found` (error colour) or
  `built-in` at the end. On the pass's last step every scope is listed.
  It fades out when the type pass starts.

- Fable 5.1 review (2026-09-24) fixes: target links carry on past the
  name pass when the recorder wrote no `links` (a program whose only names
  are targets); an undeclared target retitles "n names have no
  declaration" and, when no recorded use is unresolved, replaces the
  recorder's generic "Semantic analysis failed" with "“y” has no
  declaration." at the target; target titles say "in the parameters" for
  parameters; a forward function declaration (`declare` "FunDecl f")
  makes the definition visible from its token, as NameAnalyzer links calls
  to the definition (`declaredAt`); chained `=` is "groups right to left"
  with the cue `right first`, not "binds tighter". Rejected: the claim
  that hooks hide behind 7px piece padding and that tidy-tree boxes touch
  (`.ac button` zeroes the padding and border; labels are text-wide).
- The rest of that review, fixed page-side:
  - The recorder (`src/test/util/ParseTrace.java`, bundled into
    compiler.js; the compiler itself was fine, checked with MARS: `1 0 300
    7`) threw on two kinds of program. Fixed there with Stanley's OK
    (2026-09-24; ParseTrace.java is untracked in the compiler repo, backup
    of the old one in this session's scratchpad `cc/ParseTrace.java.orig`)
    and compiler.js rebuilt with the unchanged `browser/build.sh`:
    - A `return` inside `if`/`while` leaves a jump no path reaches
      (`j f_epilogue` then `j label_3_end`). `pruneUnreachable` drops its
      CFG block, and the recorder paired instructions with blocks by count.
      It now pairs them by block id (ids number every instruction and
      survive pruning) and writes `"dead": true` on the unreached one. The
      page strikes it through with "never runs", and its emit note adds
      "It never runs: the jump before it always leaves first, so the
      register allocator drops it."
    - An INVALID token (`$`) had no lexeme. It is now the text the lexer
      read or the one character at its position; the lexer's own error
      follows, which the page already words: "`$` isn't a character Mini-C
      knows on line 1."
  - Pieces were keyed by token, so an expression statement (`expr`) and
    its first operand, both anchored at `x` in `x + 1;` (or `f` in
    `f(2);`), showed one piece. A node sharing its token now gets its own
    (`pieces`, keyed `node-<id>`).
  - The shadow parser's per-rule `call` events are gone; one
    `declarations` event marks where the program node opens.
    `check-trace.cjs` is prettier-formatted and exempt from
    `no-require-imports` (a plain Node script).
  - Not changed: `CHAR_PX` (7.2) is ~9% wide for the 11px phone and
    late-phase font, which only widens gaps.

## Name link routing (2026-09-24, uncommitted)

- `link-route.ts` (Fable 5.1 extra high): an orthogonal A* over a sparse
  grid of lines beside the label boxes and through the channels between
  rows. Boxes are walls; crossing a tree edge costs a little, running
  along one or crossing it shallowly costs a lot; corners are rounded.
  A link leaves the use from its side and lands on the declaration's
  side facing it (or its bottom, or its top off centre). `d` is always
  `M` plus 14 cubics so motion can tween routes. With no clean route it
  returns the old arc and `clean: false`; the page then draws nothing.
- Wiring (`animated.tsx`, `linkRoutes`): obstacles are the frame's pieces
  (`pieceBox`: label width at `CHAR_PX` times scale plus 3px each side, so
  line ends sit off the letters), edges are the attached parent→child
  ports, bounds are the tree plus 24–28px, above the scope strip while it
  shows. Routes are cached per frame index and stage size.
- Drawing: a 3px background halo under a 1px ink line (so it passes over
  tree edges like a wire), drawn in with `pathLength`, and a 2px dot on
  the declaration once the line lands. Moving on reels it back in.
- Settled links are not drawn. Fable's design kept a 16px hook beside
  each settled use; on the loop preset they read as stray dashes sticking
  out of the labels (Stanley), so they were dropped. Hover still draws
  any binding in full.
- Checked in a visible tab (background tabs get no animation frames, so
  exits never finish there): loop check steps 84–93 and function call
  45–46 draw one link each, no leftovers, no console warnings, no route
  through a label. The second `n` in `twice` runs close beside the `+`
  edge; it doesn't touch a label.

## Name pass: declarations, tint, found (2026-09-24)

- Each declaration gets its own step where NameAnalyzer meets it
  (`check.declare`, added by `withNameSteps` in `scopes.ts`, formerly
  `withTargets`): "`int i;` puts `i` in main's scope.", "The parameter
  `int n` goes in twice's scope.", "The function `main` goes in the global
  scope, so calls anywhere below it can find it." The scope strip shows it
  going in. Loop gains 3 steps, function call 3, unresolved name 1; the
  state table above is shifted.
- From its step to the end of the name pass a declared node keeps a faint
  grey tint (`.declared`).
- A lookup's line goes out grey (`--muted`); as it lands, a green copy
  fades in over it, the dot turns green, and the declaration's tint and
  its entry in the scope strip turn green (`--ok`, delayed by `--land`,
  the draw time). On the next step the green fades back to grey as the
  line reels in.
- A name with no declaration still sends its line out, routed to the
  root (the top of the tree, where the outermost scope is), and it reels
  back in over three draw times (`missing`, `miss-<use>` route).
- Built-in calls (`print_i`) get no line.
- Tree pieces have 3px of real side padding (`.ac-piece.node`), and the
  router's boxes match it, so a link's dot sits on the border whichever
  side it lands on. Before, the router padded 3px on the sides only, so
  side landings floated off the box and top/bottom ones sat on it.
- A function's parameters sit in small dashed parens (`.ac-params`,
  `paramsOf` in `scopes.ts`), set apart from its body statements.
- A function's body is now its own `{ }` node, as in the compiler's AST
  (`FunDef` has `params` and a `Block`; `ASTPrinter` prints it). The
  recorder used to flatten it into the function node; `ParseTrace.decl`
  now makes a block node for it (compiler repo, uncommitted there; backup
  of the previous version in the session scratchpad). All six reference
  traces were regenerated with `tests/showcase/trace.sh` and
  `compiler.js` rebuilt. Against the old traces the only change is the
  new node (two per function-call trace) and its two parse frames per
  function; instruction attribution, check, emit and register frames are
  identical, and the page's parse replay still matches the recorder.
  `scopesOf` keeps a function's body block in the function's scope, as
  NameAnalyzer does. State table frames are shifted.
- A name with no declaration keeps a faint red tint (`.missing`) from its
  step to the end of the check phase, and the scope strip's cue names
  it: "`missing` not found".
- "Every name has a declaration" draws every use's link at once, each a
  quarter draw-time after the last, and reels them in on the next step.
  Links cover variables and function calls, which is what the recorder
  resolves; struct types aren't recorded as links yet.

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
