Reviewed all 29 screenshots against **`fb84c9c`**. No files changed, servers started, or compiler tests run. The checkout advanced during review; line references below remain pinned to your supplied revision. Measurements are CSS pixels.

The two `*-10-hover-node.png` captures contain no visible hover card; findings concerning that card are marked **CSS-only**.

**Editor and side panes**

1. **P2 — Stack and type content still start too low.** The shared body supplies **8px** top padding, but the stack adds **14px margin**, making **22px** before its first cell; the type panel adds **4px padding**, making **12px** before its proof. Visible in `desk-dark-5-emit.png` and `desk-dark-4-types.png`, compared with `desk-dark-1-lexer.png`.  
   **Smallest fix:** remove those two extra offsets; standardize the outer content gap on **8px**. [animated.css:823](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:823), [animated.css:1605](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:1605), [animated.css:1616](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:1616)

2. **P3 — Docking enlarges the stack’s text.** `.ac-stack` uses **11px**, matching scope and type records, but `.ac-stack.docked` overrides it to **12px**. The larger stack labels are visible in `desk-dark-5-emit.png`.  
   **Smallest fix:** remove the docked font-size override; standardize side-pane records on **11px**, retaining the existing **19px** stack rows. [animated.css:781](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:781), [animated.css:1598](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:1598)

3. **P3 — The editor’s bottom edge becomes doubled.** A fully folded note retains its **1px top border**, adjacent to the workspace/editor’s **1px outline**. In `desk-dark-0-intro.png` and `phone-dark-6-regs.png`, that edge measures **4 device pixels at 2× = 2px**. On phones with the side-pane headline showing, its **0.5px shadow** instead joins the outline, producing **1.5px**, visible in `phone-dark-1-lexer.png`.  
   **Smallest fix:** remove the note border when `data-fold='shut'`; on phones, suppress the headline shadow while its body is closed. Standardize the exterior edge on **1px**. [animated.css:628](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:628), [animated.css:644](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:644), [animated.css:800](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:800)

4. **P3 — Clickable proof names lose their label styling. CSS-only.** Rule names alternate between `<span>` and `<button>`. The more specific `.ac button` reset overrides `.ac-proof-name`: buttons get **0px left padding and inherited 11px/15.95px type**, while spans retain **4px padding and 10px/12px type**.  
   **Smallest fix:** strengthen the label selector to `.ac .ac-proof-name`, preserving **4px clearance and 10px/12px type** for both elements. [animated.css:189](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:189), [animated.css:1665](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:1665), [type-panel.tsx:366](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/type-panel.tsx:366)

**Floating notes and cards**

5. **P3 — The note window’s internal divider is as heavy as its perimeter.** Its title/body separator remains **1px**, versus the side-pane headline’s **0.5px** hairline. Compare the two regions in `desk-light-2-parser.png`.  
   **Smallest fix:** replace `.ac-window-open`’s border with a **0.5px inset shadow**, using the same internal-divider treatment as the side pane. [animated.css:1809](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:1809), [animated.css:800](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:800)

6. **P3 — The same class-list chips change dimensions inside hover cards. CSS-only.** Side-pane chips have **4px horizontal padding, 4px gaps, and 1.45 line-height**; hover-card chips use **6px padding, 6px gaps, and 1.6 line-height**. At 11px, their bordered heights are approximately **18px versus 19.6px**.  
   **Smallest fix:** standardize both on **11px/1.45, `0 4px` padding, and 4px gaps**. [animated.css:757](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:757), [animated.css:2073](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:2073)

7. **P3 — Hiding scrollbars changes the floating note’s right inset. CSS-only.** Source, side-note, and listing panes receive a replacement **9px gutter** in `.bare` mode. `.ac-window-body` is omitted, leaving only its **3px right padding** instead of **3 + 9px**, so its text can rewrap while neighboring panes preserve their geometry.  
   **Smallest fix:** include `.ac-window-body` in the existing replacement-gutter rule; standardize the reserved rail width on **9px**. [animated.css:137](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:137), [animated.css:1832](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:1832)

**Toolbar and timeline**

8. **P3 — Maximize appears permanently highlighted.** `.ac-max` requests `--muted`, but `.ac button { color: inherit }` wins on specificity, leaving it in `--ink`. Its hover therefore produces no color change, unlike zoom controls. Visible in `desk-dark-0-intro.png` and `desk-light-0-intro.png`.  
   **Smallest fix:** use `.ac .ac-max`; standardize inactive icons on **`--muted`**, hover on **`--ink`**. [animated.css:189](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:189), [animated.css:283](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:283)

9. **P3 — The scrubber changes length when the counter reaches three digits.** Tabular numerals stabilize individual digits, but the counter has no reserved width: `90/156` occupies **6ch**, while `110/156` occupies **7ch**. The phone track’s left edge consequently moves between `phone-dark-4-types.png` and `phone-dark-5-emit.png`.  
   **Smallest fix:** reserve the counter’s maximum width per trace—**7ch for these examples**—and right-align it. [animated.css:2084](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:2084), [animated.tsx:4967](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.tsx:4967)

**Phone layout**

10. **P2 — Docked-note text starts 9px left of the editor’s text inset.** The editor headline starts at **12px page margin + 1px border + 10px padding = x23px**. The docked note title and body start at **12 + 2 = x14px**. Visible throughout the phone captures, especially `phone-dark-3-semantics.png`.  
    **Smallest fix:** give the borderless dock’s title and body **11px left padding**, aligning their text with the editor’s **10px inset inside its border**. [animated.css:353](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:353), [animated.css:2388](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:2388), [animated.css:2403](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:2403)

11. **P3 — Zoom retains desktop control sizing on phones.** Zoom buttons remain **26×26px with 14px icons**, while footer step buttons become **44×44px with 20px icons**. Visible in `phone-dark-1-lexer.png`.  
    **Smallest fix:** apply the existing phone control values—**44px buttons, 20px icons**—to zoom in the phone media query. [animated.css:862](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:862), [animated.css:2425](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:2425), [animated.css:2459](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:2459)

**Theme and register colors**

12. **P2 — Light-mode canvas rules compete with pane boundaries.** Light mode uses **`--line: #e4e4e7`** for both grid lines and structural borders. Dark mode deliberately separates them: grid **`#18181b`**, borders **`#27272a`**. Compare `desk-light-0-intro.png` with `desk-dark-0-intro.png`; the light canvas reads much more strongly ruled.  
    **Smallest fix:** use **`--wash` for grid lines in both themes**—`#f4f4f5` light, `#18181b` dark—while retaining `--line` for boundaries. [animated.css:7](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:7), [animated.css:842](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:842), [animated.css:1030](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:1030)

13. **P3 — One register uses different foreground shades across representations.** Assembly text uses **100% `--c`**, lanes use **70% `--c` mixed with ink**, and graph nodes use **72%**. The orange and blue differences are visible in `desk-light-7-regs-select.png` and its dark counterpart.  
    **Smallest fix:** share the existing **70% color / 30% ink** foreground across listing text, lanes, and node tint; retain separate background and focus treatments. [animated.css:1517](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:1517), [animated.css:1569](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:1569), [animated.css:2589](/Users/stanley/worktrees/stanley-wang/2026-09-21_compiler-showcase/app/projects/mini-c-prototype/animated.css:2589)

The existing shared values are:

- **Spacing:** 4px chip gaps; 8px body spacing; 10px pane text inset; 12px outer/popover spacing; 6px phone pane gaps; 9px scrollbar gutters.
- **Borders:** 0.5px internal headline hairline; 1px structural edges; 2px active emphasis.
- **Type:** 12px base/source/listing; 11px side records and desktop notes; 10px metadata/badges; 9px register annotations. Source/listing rows are 19px; canvas rows are 22px. Regular weight is 400, emphasized headings 600.
- **Chrome:** 28px pane headers versus 22px floating-note headers; 36px desktop versus 48px phone controls rows; 26px zoom versus 44px phone step buttons.

