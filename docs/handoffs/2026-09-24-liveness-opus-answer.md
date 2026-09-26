<!-- Opus 5.5 agent, 2026-09-24: liveness visual, basic blocks and fixed-point slides. Saved verbatim. -->

> Applied 2026-09-24, step 1 of §4 ("fix the facts"): the `reg.cfg` and `reg.live` notes are rewritten, and the sweep-2 note names the registers and lines from a page-side recompute (`liveAdded` in `trace.ts`, matched against the recorded sweeps on every preset). Highlighted rows show `+$fp`. The Liveness slide is replaced by "Liveness Flows Backwards", and "Sweeping to a Fixed Point" appears before any sweep 2 that changes something. Both slides are generalised from the drafts below, since they show on every preset. Gutter bars, block brackets and the CFG boxes are not built.

# Registers phase: liveness design consult (draft)

## What the trace shows

In the `loop` preset, no virtual register crosses a block boundary, and none crosses the back edge. `i` and `sum` live on the stack. Each trip round the loop recomputes their addresses and reloads them, so every `vN` is written and last read inside one run of straight-line code. The longest range is `v8`, the address of `sum`, from line 17 to line 26. At most 4 virtual registers are live at once.

The only register that travels round the loop is the frame pointer `$fp`. Line 12 (`addi v5,$fp,-8`) reads it at the top of the loop. The recorded sweeps change 39, then 6, then 0 sets. All 6 changes in sweep 2 are `$fp` becoming live on lines 28–33 (block ids 27–32) through the jump. `RegAllocTrace.liveness` counts every register when it detects a change, but `vrNames` writes out only virtual ones. So on the page, sweep 2 highlights 6 rows whose shown sets don't change.

Two current step notes are therefore wrong:
- `reg.live` sweep 2 says "Values read at the top of the loop stay live through its body". No virtual register does that.
- `reg.cfg` says "Each instruction is a block". That is true of the code but will read oddly once the page draws boxes.

I also checked the other presets: none has a back edge, and each settles in 2 sweeps. Only `&&` and `||` would create a virtual register that crosses a block boundary: the result is written in two branches and read after they meet (`ExprValCodeGen` lines 401–448). Even then it would not cross a back edge.

## 1. Per-instruction nodes or basic blocks

**Recommendation: draw basic blocks, grouped on the page, and keep a live set per instruction inside them.**

- **Are the live sets identical?** Yes, at every instruction. Both versions solve the same equations. A block just applies its instructions' rules one after another, and the iteration settles on the same unique smallest solution.
- **Number of sweeps:** the same here. His loop visits nodes in reverse order, so one sweep already pushes information up a whole straight run. I recomputed it at block level: 3 sweeps changing 5, 1 and 0 blocks, against his 39, 6 and 0 instructions.
- **Cost:** this is what actually differs. His version updates 42 nodes per sweep, 126 set updates in all. A block version with each block's reads and writes worked out once updates 5 nodes per sweep, then does one extra pass to recover per-instruction sets. The growth rate is the same and the constant is smaller. Correctness is unaffected.
- **Why blocks for visitors:** 42 nodes is unreadable. 5 boxes match slide 85.

The `loop` preset groups into 5 blocks (0-based ids):

| Box | Block ids | Instructions | Edges out |
|---|---|---|---|
| entry | 0–10 | 11 | to test |
| test | 11–15 | 5 | True to body, False to return |
| body | 16–32 | 17 | back edge to test |
| return | 33–36 | 4 | to exit |
| exit | 37–41 | 5 | none |

A new block starts at each label or jump target and after each branch or jump. The page can derive all of this from `blocks[].labels` and `.succ`, so the recorder needs no change for it.

Truthful one-liner for the page: "The compiler treats every instruction as its own node; here, runs with no jumps in or out are drawn as one box. The live sets come out the same."

## 2. The liveness stage (`loop`, 4 frames, the same count as now)

**Layout.**
- **Left half (currently empty during `reg.cfg` and `reg.live`):** the 5 boxes stacked, drawn like slide 85. Box labels are one word: entry, test, body, return, exit. The back edge arcs on the right from body to test and carries the label "back edge". The False edge from test goes to return.
- **Right half:** the assembly as now, with:
  - a thin bracket in the left gutter marking each block's line range;
  - live-range bars in the right gutter, replacing the `v0 v1` text (keep that text for hover). Each bar is a vertical line in a lane, running from the line that writes the register (a tick) to the last line that reads it (a dot). 4 or 5 lanes are enough.
  - `$fp` in a fixed, visually distinct lane (dashed, labelled `$fp`), because it is tracked but never allocated.
- **Colour:** an accent for a bar while it grows, muted once settled, like slide 86's red.

**Frames.**
1. **`reg.cfg`.** The boxes appear top-down, then the edges, with the back edge drawn last. Gutter brackets link each box to its lines. On-stage label: "5 blocks".
2. **Sweep 1.** A scanline climbs from line 42 to line 1, and the box it is inside lights up in step. Each read starts a bar that grows upward, drawn backward like slide 86, and stops at the write.
   - Spotlight `v9` (`sum`'s old value, read on line 25, written on line 19) as the one arrow the note names.
   - At the end, the `$fp` bar has a visible gap on lines 28–33, because the sweep passed the jump before it saw line 12.
   - Label: "sweep 1".
3. **Sweep 2.** The scan reaches `j` on line 33 and looks across the back edge to line 12, which reads `$fp`.
   - A `$fp` chip travels backward along the back-edge arc on the left, from test to the bottom of body.
   - On the right, `$fp`'s bar fills lines 28–33, and those 6 rows flash.
   - The `vN` bars don't move, and that is the point.
   - Label: "6 lines".
4. **Sweep 3.** The scan passes and nothing lights up. Label: "no change", then "fixed point".

**Step notes (draft):**
- Sweep 1: "Sweep 1 walks up from the last line. A read makes its register live back up to the line that writes it."
- Sweep 2: "Line 33 jumps to line 12, which reads `$fp`, so `$fp` is live from line 28 to the jump too. `i` and `sum` stay on the stack and are reloaded each trip, so no virtual register crosses the jump."
- Sweep 3: "Nothing changed, so the sets are stable."

**What drives it.**
- `reg.cfg {fn, blocks, back}` already has what it needs; boxes come from `backend.functions[fn].blocks`.
- `reg.live {fn, sweep, changed}` together with `liveness[k].changes` and the existing `liveAfterSweep` already give the virtual bars.
- The bars can be drawn from `sweep: "final"` plus the sweep-1 changes.
- Showing `$fp` needs physical registers in the recorded sets. Change `vrNames` in `RegAllocTrace.liveness` to write every register name, have the page filter to `vN` plus `$fp`, and re-record the presets. The recorder already asserts that its sets match the real allocator's.
- Fallback with no recorder change: the page recomputes the sweeps from `blocks[].uses/def/succ`, which already include `$fp`, and checks the result against the recorded virtual sets.
- On phone width, drop the left CFG and keep the gutter.

## 3. Splash slides (DRAFT, for Stanley to rewrite)

**(a) Liveness Flows Backwards** (about 80 words)
> A value is **live** from where it's written to the last place it's read. To find that, the allocator starts at each read and walks **backwards** through the code until it meets the write. Jumps turn the code into a graph, and the loop's jump back to its test is an edge like any other. In `loop`, `sum`'s old value is loaded into `v9` on line 19 and read on line 25, so it's live in between.

**(b) Sweeping to a Fixed Point** (about 90 words)
> One backward sweep isn't always enough. The sweep reaches the loop's jump, `j label_2_while_start`, before it has looked at the loop's first lines, so it doesn't yet know what the top of the loop needs. Here that's the frame pointer, `$fp`, which line 12 reads. So the allocator sweeps again, carrying what it learned round the back edge. It keeps going until a sweep changes nothing: a **fixed point**. `loop` takes three sweeps: one to fill the sets, one to carry `$fp` round, one to confirm.

**The existing "Liveness Analysis" slide:** split it. Its definition and the backward walk become (a). Its last sentence, "A loop carries values back to its start", is misleading for this compiler and should be replaced by (b), placed just in time.

**Proposed deck order for Registers:**
1. Phase slide: Register Allocation (keep as is).
2. Phase slide: Liveness Flows Backwards (new; replaces Liveness Analysis).
3. Frames: `reg.cfg`, then sweep 1.
4. Step slide: Sweeping to a Fixed Point, shown only when `back.length > 0`, just before sweep 2. The straight-line presets skip it; their sweep 2 is simply the "nothing changes" frame.
5. Frames: sweeps 2 and 3.
6. Step slide: Graph Colouring, then the `reg.interfere` frame.
7. Step slides: Chaitin's Algorithm and Why It Pays Off, then the colouring frames. Optionally move Why It Pays Off to just before `reg.done`, since it describes the result.

## 4. Smallest version worth building first

1. **Fix the facts.** Rewrite the `reg.cfg` and `reg.live` notes as above. On sweep 2, say "lines" rather than "sets". Split the slide. This is text only.
2. **Gutter bars.** Live ranges from the existing sweep data, plus the `$fp` lane with its sweep-1 gap filling on sweep 2. Get the `$fp` data from the one-line recorder change, or from the page-side recompute.
3. **Block brackets in the gutter** (grouped on the page), with the one-liner.

Together these tell the whole story: backward, per sweep, and why a second sweep exists. They reuse the existing assembly pane.

**Next:** the 5-box CFG on the left, with the `$fp` chip travelling round the back edge.

**Later, optional:** a preset using `&&`, so a virtual register visibly flows backward through the point where two branches meet.
