# Registers phase: showing register pressure and spilling

Third opinion (Opus 5.5 agent), 2026-09-24. Question: how to illustrate register pressure and spilling. Saved verbatim apart from this header. Its three copy bugs are fixed: `reg.done` now says "spilled to memory", and the Chaitin slide credits Briggs for the optimistic step. The hardcoded 18 stays until a k=3 mode exists.

## What I checked

I ran the compiled `util.RegAllocTrace` on test programs. Its output went to my scratchpad only, and I edited no files. Findings:

- **Why 18 registers never run out today.** The compiler keeps every variable in its stack frame and reloads it at each use. Registers only hold the unfinished parts of one expression. The most values live at once in any preset is 1 to 4, and the number of colours used equals that peak in every preset.
- **`RegAllocTrace` already has `--k N`.** It takes the first N of `ALL_COLORS`, so `--k 16` is not the real fallback. The real fallback uses `SAFE_COLORS`, which leaves out `$t8`/`$t9`. `ParseTrace` hardcodes `ALL_COLORS` and records only one colouring attempt.
- **Loop preset at k=3:** one spill, `v8`. It is the address of `sum`, computed at `addi v8,$fp,-12` and held until `sw v15,0(v8)`, across `sum + i * 2`. The peak is 4 live, at `li v13,2`. At k=4 nothing spills.
- **Right-nested preset at the real k=18:** `return x + (x + (… 19 deep …))`. It has 58 virtual registers and 496 edges, with a peak of 19 live at the innermost load. At 18 one value spills (`v8`). Because a spill happened, the real compiler colours again with 16, and 3 spill.
- **Bugs to fix:**
  - In `explain.ts`, the `reg.done` text says "spilled to the stack". This compiler spills to `.data` labels.
  - The "Chaitin's Algorithm" slide hardcodes 18.
  - Pushing a candidate and colouring it later is Briggs's optimistic improvement, not plain Chaitin.

## 1. What register pressure looks like

**Live strip.** Turn the live-set text at the right edge of the assembly (state 23) into a strip of dots: one dot per live value on each line, and a vertical rule at k. The final liveness `out` sets already have this data. Header labels: `live` and `k 3`.

Frame by frame, on loop at k=3:

- **Liveness sweeps:** dots fill in as the sweeps run. They are grey until the values are coloured.
- **`reg.interfere`:** the strip is complete. Line 21 has 4 dots, one past the rule, tinted with the error colour. Stage label: `peak 4`. At k=18 the same strip reads as plenty of room left, which is worth showing on every preset.
- **Simplify steps:** a value's dots fade when it goes on the stack.
- **When simplify stalls (`reg.spillCandidate`):** every node left in the graph shows a small degree badge, all ≥ k, and a cue reads `stuck`. The strip lights the candidate's range (lines 16 to 25) so the viewer sees it is the value held longest.

The strip carries the pressure. The graph carries who conflicts with whom. They differ: `v8` has degree 7 but at most 4 values are ever live together. One line of step text can say that.

## 2. Making spills happen honestly

**Recommendation: a k=3 mode recorded by the real allocator, on the loop preset.**

- `ParseTrace` gets `--k N`, taking the first N of `SAFE_COLORS`. That keeps `$t8`/`$t9` reserved as scratch, the same 16+2 split the real fallback uses. It runs the real `color()`, which is already checked against the allocator.
- Record `loop.k3.trace.json` and add a toggle in the "?" menu (`[ ] 3 registers`).
- While the mode is on, the stage shows a persistent chip `k 3 · real 18`. Honesty is then a label, not a simulation: this is the real algorithm on a smaller machine.
- The loop graph stays readable (23 nodes, 20 edges), and the spill sits inside a loop, which makes its cost easy to show.

**Later, the nested-expression preset as proof at the real k.** It is honest, but it has about 120 colouring steps and a hairball graph. It needs batched simplify steps, and the live strip does most of the work: a mountain that crosses the line at 18. It also needs the recorder to record both attempts, 18 and then `SAFE_COLORS`.

## 3. Spill candidate vs actual spill

Show it in two beats:

1. **Push.** The candidate goes onto the stack with a dashed ring and the tag `maybe`.
2. **Pop.** A row of k palette chips appears beside the node. Each neighbour's colour strikes out a chip; the trace already records the `forbidden` list.
   - If a chip survives, it lights up, the node fills, and the tag is `kept`.
   - If none survives, the node drops into a `.data` box, tagged `spilled`.

**Don't fake the `kept` outcome.** It never happened in anything I ran: the six presets at k=1 to 5, and the nested preset at 17 and 18. Every stall ended in a spill.

A likely reason (I haven't proven it for this compiler): straight-line temporaries produce chordal graphs. In a chordal graph, if the peak is ≤ k, simplify never stalls. Branches inside expressions (`&&`, `||`) are where a counterexample might hide.

Draw the optimistic win as a static figure on the slide instead: Briggs's 4-cycle at k=2. Every node has degree 2, so simplify stalls, yet two colours are enough. Label it as an illustration.

## 4. What a spill costs

Add a new frame `reg.rewrite` after `reg.done` for each function that has spills. The assembly gains tinted inserted lines:

```
addi  $t8,$fp,-12        # def of v8
la    $t9,v8             # +
sw    $t8,0($t9)         # +
...
la    $t8,v8             # +
lw    $t8,0($t8)         # +
sw    $t1,0($t8)         # use of v8
```

Next to it, a `.data` box holding `v8: .space 4`. Draw it apart from the call-stack column, with ticks from the `sw` and `lw` lines to it. The stack frame is created and dropped on every call; `.data` is one fixed slot.

Tally: `+4 lines · 2 mem · ×3`. The loop runs three times, so that is 12 extra instructions and 6 memory accesses.

Two honest asides for the step text, one line each:

- `v8` is `$fp-12`, which one instruction can recompute. Recomputing it would cost nothing.
- A fixed `.data` slot is shared by every active call, so a recursive function would overwrite its own spill. That is why real compilers spill to the stack.

Using more registers also has a cost: `pushRegisters` saves every colour a function uses. The nested preset would push and pop 16 registers.

## 5. Smallest version worth building first

1. **Live strip with the k rule.** It needs no new data and works on every current preset.
2. **`--k` in `ParseTrace`, using `SAFE_COLORS`.** Record the loop preset at k=3 and add the toggle and chip. The existing `spillCandidate`/`spill` frames and the `.spilled` style should mostly just work.
3. **Record the rewritten code.** Per function: the output lines with the index of the instruction each came from, plus a `spill` flag on inserted lines and the `.data` labels. Follow the recorder's existing pattern: reimplement the rewrite, then check it against `GraphColouringRegAlloc.INSTANCE.apply(asm)`. `rewriteInstruction` is package-private, so the recorder can't call it directly. Without this, a spilled virtual register has no entry in `registers` and would show as raw `vN`.
4. **The `reg.rewrite` frame and the `.data` box.**

Leave for later: the two-attempt recording (18 then 16) and the nested preset.

## 6. Prior art

- **Appel, *Modern Compiler Implementation*, ch. 11:** draw the select stack as a column beside the graph, with nodes sliding into it and back out.
- **Briggs, Cooper and Torczon (1994):** the 4-cycle at k=2, the standard example of optimistic colouring winning.
- **Cooper and Torczon, *Engineering a Compiler*:** "MaxLive", pressure as one number per point in the code. It is the live strip's definition.
- **Poletto and Sarkar, linear-scan papers:** live ranges drawn as bars. When two bars overlap on a line, their nodes share an edge, which could serve as a hover mode.
- **Compiler Explorer:** colour-matched source-to-assembly lines, and a diff view. Use it to tint the inserted spill lines.
- **LLVM `-Rpass-missed=regalloc` remarks:** they report spill and reload counts per loop. Borrow that as the one-line tally.
