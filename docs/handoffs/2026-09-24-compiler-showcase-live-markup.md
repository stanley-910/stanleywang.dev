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
  `compiler-showcase`. Everything under `app/projects/mini-c-prototype/` and
  `docs/` is untracked. No commit is authorised.
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

- Frame 0 step-panel header reads "press space to start" (was "ready · 45
  tokens · press space").
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
  or clicking a token in the tray shows a small card beside it on the stage
  ("`;` · symbol · ends this statement", from `tokenHover` in `explain.ts`),
  and the panel keeps the current step. Token steps: header "Token: `;`", body
  just the class ("Symbol") above the lexeme list, with no role sentence
  (explain.ts case `token`). Step-panel headers are not underlined and render
  backtick code.
- Name tokens are called "identifier" everywhere on the page (card, kind label,
  aria label, step text), via `tokenKind` in `explain.ts`. An identifier's card
  is just "`sum` · identifier", with no role sentence.
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
  to <https://www.cs.mcgill.ca/~cs520/2026/>. Frame 0's step panel keeps "Step
  through to watch the source become a tree, then instructions." Links use the
  site's `.prose-link` class (`app/styles/markdown.css`), not a local style.

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
