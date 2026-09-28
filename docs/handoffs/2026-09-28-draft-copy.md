# DRAFT copy to review (2026-09-28)

Every sentence I wrote for the compiler page, marked `// DRAFT copy` in the
source. For each: keep it, edit it, or replace it. Search `DRAFT` in a file to
jump between them. Line numbers are as of compiler-showcase `4086b9a`, plus the
uncommitted work in this batch.

## On the page: intro, About and side pane (`animated.tsx`, `explain.ts`)

- [explain.ts:330](../../app/projects/mini-c-prototype/explain.ts:330): the intro's
  bracket naming the bundle (the rest of the intro is your text).
- [animated.tsx:2930](../../app/projects/mini-c-prototype/animated.tsx:2930): the
  About's second paragraph, "The compiler is written in Java. …"
- [animated.tsx:139](../../app/projects/mini-c-prototype/animated.tsx:139),
  [:150](../../app/projects/mini-c-prototype/animated.tsx:150),
  [:2583](../../app/projects/mini-c-prototype/animated.tsx:2583): side pane
  headlines: "types", "keywords", …, "string literals", "character literals".
- `TOKEN_BLURBS` and `NODE_BLURBS` (animated.tsx, under the headlines): the
  one line under each class's headline in the side pane, e.g. statements:
  "The steps a function takes. Each starts with a keyword, is a block in
  braces, or is an expression ended by `;`."
- [animated.tsx:3234](../../app/projects/mini-c-prototype/animated.tsx:3234): "drop
  the stack here".
- [animated.tsx:3240](../../app/projects/mini-c-prototype/animated.tsx:3240): "x
  takes N bytes, too many to draw the stack (over N)."
- [animated.tsx:4305](../../app/projects/mini-c-prototype/animated.tsx:4305): the
  note under an empty `pushRegisters`/`popRegisters` line.

## Tokens (`explain.ts`, `detail.ts`)

- [explain.ts:58](../../app/projects/mini-c-prototype/explain.ts:58): `*`
  "multiplies the values either side of it or, in front of a pointer, reads
  what it points at".
- [explain.ts:288](../../app/projects/mini-c-prototype/explain.ts:288): "is one
  string literal: everything between the quotes, spaces too, is part of it"
  and "is one character literal".
- [explain.ts:1592](../../app/projects/mini-c-prototype/explain.ts:1592): the
  detailed lexer's character-by-character sentences (all but `end` and the
  last two), plus the unterminated-literal sentence at
  [:1618](../../app/projects/mini-c-prototype/explain.ts:1618) and "A second `/`
  or a `*` would start a comment instead." at
  [:1645](../../app/projects/mini-c-prototype/explain.ts:1645).
- [detail.ts:81](../../app/projects/mini-c-prototype/detail.ts:81): the title "Lexing
  error".
- [detail.ts:88](../../app/projects/mini-c-prototype/detail.ts:88): the title "Looking
  past `…`".

## Parse (`explain.ts`, `ParseTrace.java`)

- [explain.ts:366](../../app/projects/mini-c-prototype/explain.ts:366) and
  [:374](../../app/projects/mini-c-prototype/explain.ts:374): on your "started as
  … becomes …" template, for string and character literals.
- [explain.ts:429](../../app/projects/mini-c-prototype/explain.ts:429): an operator
  "becomes an operator expression that waits, dashed, for its right side".
- The parser's note for nodes without their own sentence (search "named by
  its kind" in explain.ts): "`.` becomes a method call expression.", "`*`
  becomes a value at expression.", "`class Base { }` becomes a class
  declaration." New today; it replaced "becomes a expression node".
- An expression statement's note, quoting the statement (your ask, via the
  other session): "`p.x = 10;` doesn't start with a keyword, so it's an
  expression statement: an expression, then `;`. Its expression comes next."
- [explain.ts:485](../../app/projects/mini-c-prototype/explain.ts:485): the parse
  error note ("the end of the program" and so on).
- ParseTrace.java:1880: the step title "Expected X, found Y" / "The parser
  stops at …".

## Check (`explain.ts`, `ParseTrace.java`)

- [explain.ts:499](../../app/projects/mini-c-prototype/explain.ts:499): a definition
  joining its forward declaration, a declaration of a built-in, one hiding
  another.
- [explain.ts:517](../../app/projects/mini-c-prototype/explain.ts:517): "The class
  X goes in …", "The parameter X goes in …".
- [explain.ts:528](../../app/projects/mini-c-prototype/explain.ts:528): a call that
  finds only a forward declaration.
- [explain.ts:544](../../app/projects/mini-c-prototype/explain.ts:544): a name that
  isn't a variable or isn't a function.
- [explain.ts:555](../../app/projects/mini-c-prototype/explain.ts:555): the next
  three cases, starting with "Now that the whole file has been read, …".
- [explain.ts:585](../../app/projects/mini-c-prototype/explain.ts:585): "X doesn't
  type-check: …. The compiler stops here."
- [explain.ts:632](../../app/projects/mini-c-prototype/explain.ts:632): "Every name
  has a declaration, but the name pass found N errors, so compilation stops."
- ParseTrace.java:418, 508, 517, 542, 546, 561, 585: the step titles for the
  same cases, and the error messages "“x” is not a function." / "is not a
  variable."
- ParseTrace.java:636–640, 874: how every type error message is worded
  (`“x”: <message>.`).
- ParseTrace.java:981: "“x” would take N bytes, more than a 32-bit machine can
  address."
- ParseTrace.java:2120–2121: the class-program note ("This compiler reads and
  checks classes, but its code generation doesn't support them yet, so it
  stops here.") and "Code generation stopped: …". The new Classes example
  shows the first.

## Emit (`explain.ts`)

- [explain.ts:71](../../app/projects/mini-c-prototype/explain.ts:71): the
  one-sentence meaning of each MIPS instruction (on your "this goes into this"
  wording).
- [explain.ts:148](../../app/projects/mini-c-prototype/explain.ts:148): the struct
  copy loop, line by line.
- The block-mode prologue and epilogue sentences for `pushRegisters` and
  `popRegisters`, shortened to match your line notes (the line notes
  themselves are your copy, with "helper function" read as "placeholder").
  Also "reserves N bytes for the variables it declares" and "None of these
  lines is written in your code." in the prologue note.
- [explain.ts:659](../../app/projects/mini-c-prototype/explain.ts:659): the note
  when the first virtual register opens the lanes.
- [explain.ts:837](../../app/projects/mini-c-prototype/explain.ts:837) and
  [:922](../../app/projects/mini-c-prototype/explain.ts:922): the line-by-line mode's
  sentence per line, and per prologue/epilogue line.

## Registers (`explain.ts`, `ParseTrace.java`)

- [explain.ts:714](../../app/projects/mini-c-prototype/explain.ts:714): a batch of
  pushes, "The other N go on the stack the same way: …".
- [explain.ts:731](../../app/projects/mini-c-prototype/explain.ts:731): pops that
  reuse a register.
- [explain.ts:752](../../app/projects/mini-c-prototype/explain.ts:752),
  [:755](../../app/projects/mini-c-prototype/explain.ts:755),
  [:759](../../app/projects/mini-c-prototype/explain.ts:759): spills and the retry
  with fewer registers.
- [explain.ts:765](../../app/projects/mini-c-prototype/explain.ts:765): what the
  rewrite turns placeholders and spills into.
- [explain.ts:1240](../../app/projects/mini-c-prototype/explain.ts:1240): the
  Liveness slide ("A value is **live** from where it's written …").
- [explain.ts:1332](../../app/projects/mini-c-prototype/explain.ts:1332): the retry
  slides (only programs that spill reach them).
- ParseTrace.java:1122, 1156: the step titles "f: N spills with 18 registers, so
  start again with N", "x finds no register free", "x spills to memory".

ParseTrace.java is in `~/worktrees/mini-c-compiler/2026-09-25_showcase-traces/src/test/util/`.
