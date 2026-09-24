I’d pick **a floating operand beside an open branch**. The crucial change is positional: today, [treePositions](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/trace.ts:822) lays out the finished tree, so operands arrive at their eventual positions. To reveal the decision, an operand needs a temporary position before its parent is settled.

This was a read-only review; nothing was edited.

Two treatments are worth considering:

1. **Floating operand and open socket — my choice.**

   After `a + b`, `+` has a solid left edge to `a`. Its right branch ends in a small empty circle. `b` floats just beside that circle, labelled **“held”**. The branch stops short of `b`; no attachment has happened.

   When the parser sees `*`, an outlined `×` preview appears at that socket: **“tighter”**. On consuming `*`, `×` occupies the socket and `b` slides down-left beneath it. Their edge becomes solid. `+` still has an open right branch.

   When an incoming operator loses, it stays highlighted in the token tray. The held operand settles under the waiting operator, which closes. For equal precedence, use **“left first”**. The incoming operator subsequently takes the *whole completed subtree* as its left child.

   Closing solidifies a subtree’s internal edges. It then moves as one piece toward the enclosing socket; the outer edge appears only when `attached` permits it.

   Parentheses open two faint curved brackets around a fresh working area beside the socket. The outside operator dims; operators inside compete only with each other. At `)`, the brackets briefly enclose the completed subtree: **“one piece”**. They disappear when it attaches.

   For `a = b = c`, the second `=` pulls `b` down beneath it: **“right first”**. Close `b = c`, then attach that subtree to the first assignment. This is an equal-precedence exception, so never label it “tighter.”

2. **An expanding outline around the unfinished subtree.**

   Put a dotted enclosure around the expression currently being collected. Its loose operand sits along the enclosure’s lower-right edge; completed AST edges remain solid.

   A tighter operator grows a smaller enclosure inside the current one, taking the loose operand down into it. A weaker operator remains outside while the inner enclosure closes. Equal left-associative operators trigger the same closure, labelled **“left first”**.

   On return, the enclosure tightens around its completed subtree and moves into the enclosing tree’s open branch. Parentheses use a distinct, solid curved boundary: an independent interior where the outside operator cannot compete. For chained `=`, another enclosure opens inside the right side despite the tie: **“right first”**.

   This makes nested work explicit, but several outlines could overwhelm a small stage. It also risks looking like another representation visitors must learn.

Both can use the same existing data:

- `nodes` and `consumed`: what has arrived, and whether the highlighted operator is still lookahead.
- `attached`: authoritative solid edges; preserve the handoff’s late-edge decision.
- `why`: `parse.wait`, `parse.precedence`, `parse.close`, and `parse.group` supply the meaningful beats.
- `focus`: emphasize the operator making the decision.
- `compare`: internal evidence for the decision. Its numbers needn’t appear.

Both need **explicit expression context** from the shadow replay: the waiting operator’s ID, held subtree root, incoming token ID, and grouping scope. Add decision reasons distinguishing **tighter**, **equal-left**, and **equal-right**, plus matched parentheses and their inner root. The second treatment additionally computes enclosure bounds from node positions; that is layout data.

This matters because [the current comparison mapping](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/parse-detail.ts:743) has two traps: `+` versus `-` is labelled “looser” because their symbols differ, and entering a group can describe its `+` as beating an outside `×`. Also, `compare.deeper` can mean “allowed by a reset/lowered limit,” rather than “stronger than the waiting operator.” Correct those distinctions in the prototype replay. The Java compiler needs no changes.

I’d build treatment 1 because the viewer follows **the same operand changing position**, which directly answers “who gets this?”

The smallest worthwhile version is a parser-only temporary layout, one open socket, operand/subtree movement, and a parentheses boundary. Keep completed branches stable except when an entire subtree moves under a new operator. Make every pose reconstructible from its frame so backward stepping, seeking, and reduced motion preserve the explanation. Borrow the detailed lexer’s rhythm: **show the uncertainty, then show it resolving**.

Remove the call stack and precedence table from the walkthrough, including the extra frames that only announce a function call. Retain their data for debugging. The public replacement is one local cue—**“held,” “tighter,” “left first,” “right first,” “one piece”**—beside the affected branch.

Below, each numbered item is one proposed visible frame, excluding surrounding declarations and routine parser calls.

For `4 - n + 2 * 3 - n`:

1. `4` arrives as a loose operand.
2. The first `−` takes `4` beneath its left branch; its right socket opens.
3. `n` floats beside that socket: **“held.”**
4. The upcoming `+` lights in the tray. Equal precedence: **“left first.”**
5. `n` settles under `−`; `4 - n` closes.
6. `+` enters above that completed subtree, taking it as its left child.
7. `2` floats beside `+`’s right socket.
8. Upcoming `×` previews at the socket: **“tighter.”**
9. `×` enters; `2` moves down-left beneath it. `+` keeps waiting.
10. `3` floats beside `×`’s right socket.
11. The final `−` lights in the tray. It cannot take `3`: **“× first.”**
12. `3` attaches to `×`; `2 * 3` closes.
13. The same unconsumed `−` now meets the waiting `+`. Equal precedence: **“left first.”**
14. The multiplication subtree attaches beneath `+`; the addition closes.
15. The final `−` enters above that whole subtree and takes it on the left.
16. The final `n` floats on its right.
17. At the expression’s end, `n` attaches and `−` closes.
18. The complete expression joins its surrounding statement.

The resulting grouping is `((4 - n) + (2 * 3)) - n`.

For `-x * (2 + y) - f(1)`:

1. Prefix `−` opens with one operand socket.
2. `x` floats beside it.
3. Upcoming `×` cannot take `x` away: **“prefix first.”**
4. `x` attaches; the negation closes.
5. `×` enters above `-x`, taking the whole negation on its left.
6. `(` opens a bracketed working area at `×`’s right socket. Outside `×` dims.
7. `2` arrives inside that area.
8. `+` takes `2` on its left. It faces no competition from outside the parentheses.
9. `y` floats beside `+`’s right socket.
10. Seeing `)`, `+` closes over `2` and `y`.
11. Consuming `)` seals the bracketed subtree: **“one piece.”** `×` is still open.
12. Upcoming binary `−` cannot extend `×`’s right operand: **“× first.”**
13. The group attaches to `×`; multiplication closes.
14. Binary `−` enters above the product, taking it on the left.
15. `f()` opens at its right, with an argument socket.
16. `1` arrives beneath `f()`.
17. The call’s `)` closes `f(1)`. These parentheses belong to the call; they do not create another grouping enclosure.
18. At the expression’s end, the call attaches to binary `−`, which closes.
19. The expression joins its surrounding statement.

The grouping is `((-x) * (2 + y)) - f(1)`.

Three useful references, with specific ideas to borrow:

- [matklad, *Simple but Powerful Pratt Parsing*](https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html): operators competing to hold an operand, including asymmetric binding for associativity. Translate that explanation into movement.
- [Desmos, *How Desmos uses Pratt Parsers*](https://engineering.desmos.com/articles/pratt-parser/): tighter operators grow the right subtree; returning passes a completed subtree upward, where it becomes a left operand. This closely matches the proposed motion.
- [Eli Bendersky, *Parsing expressions by precedence climbing*](https://eli.thegreenplace.net/2012/08/02/parsing-expressions-by-precedence-climbing): a parenthesized expression returns as a single operand. Borrow that for the bracketed area becoming “one piece.”

