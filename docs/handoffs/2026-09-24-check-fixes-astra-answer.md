Implemented and left uncommitted. No dev server was started or changed.

| Item | Cause and change |
|---|---|
| **A** | Fixed tree offset ignored tray height. `animated.tsx::point` now uses [`packTray` / `treeRows`](/Users/stanley/worktrees/stanley-wang/2026-09-24_check-link-fixes/app/projects/mini-c-prototype/stage-layout.ts) to reserve the visible tray’s height consistently across parse and check. |
| **B** | `namesDone` links remained mounted on the type slide. `animated.tsx::naming` removes them throughout types. [`NameLinks`](/Users/stanley/worktrees/stanley-wang/2026-09-24_check-link-fixes/app/projects/mini-c-prototype/name-links.tsx) holds completed links for three seconds, then fades them. Reduced motion keeps them until the next step. |
| **C** | Landing delays controlled declaration tint and a second green path. `NameLinks` now draws one green path while `animated.css` lights the declaration immediately. |
| **D** | The editor highlighted only the use. [`animated.tsx::pairMarks`](/Users/stanley/worktrees/stanley-wang/2026-09-24_check-link-fixes/app/projects/mini-c-prototype/animated.tsx:1336) now marks the current use’s identifier dark green and its declaration’s identifier bright green. |
| **E** | Routes could disappear through missing bindings, rejected routes, or reused animation state. `linkRoutes` keys include bindings and panel geometry; resolve frames restore missing pairs. `NameLinks` remounts per step outside `AnimatePresence`. [`linkRouter`](/Users/stanley/worktrees/stanley-wang/2026-09-24_check-link-fixes/app/projects/mini-c-prototype/link-route.ts:259) retries tighter clearance and removes the six-bend cutoff. Failed routing still draws a haloed fallback arc, which may cross labels. |
| **F** | Animated path geometry lagged during resize. Link geometry now updates directly; `AnimatedCompiler` also disables position/geometry tweening during resize while retaining step animations. |
| **G** | Empty scopes lacked context. [`ScopeTree`](/Users/stanley/worktrees/stanley-wang/2026-09-24_check-link-fixes/app/projects/mini-c-prototype/scope-tree.tsx) labels the active scope `current`, shows `empty` when appropriate, and omits inactive empty scopes. Both labels are **drafts**. |
| **H** | Scopes competed with the note’s height. [`scopePanelBox`](/Users/stanley/worktrees/stanley-wang/2026-09-24_check-link-fixes/app/projects/mini-c-prototype/scope-panel.ts) selects a stable stage corner using completed-tree boxes. The panel shrinks/scrolls and becomes a routing obstacle. Removed the note’s scope-specific minimum height. |

Additional fixes: restored green use outlines despite the button border reset; deduplicated binding pairs; made playback wait through the final link hold; preserved unresolved search paths under reduced motion; removed remaining CSS animation delays under reduced motion.

All requested checks pass, plus both regression scripts. Tests covered **160 routes across five stage sizes**, including two visible fallback routes. The required Prettier check also reformatted 12 existing JSON fixtures and four Markdown files; their data and wording remain unchanged. The [handoff](/Users/stanley/worktrees/stanley-wang/2026-09-24_check-link-fixes/docs/handoffs/2026-09-24-compiler-showcase-live-markup.md:802) records the changes.

Browser behavior remains unverified: Chromium launch was blocked by the sandbox, and port 3107 serves the September 21 checkout. **Once this worktree is served**, review:

- [Loop 46](http://127.0.0.1:3107/projects/mini-c-prototype?example=loop&frame=46): tray clearance; also step 85→86 for parse/check continuity.
- [Loop 89](http://127.0.0.1:3107/projects/mini-c-prototype?example=loop&frame=89): step repeatedly through 89–98, backwards and forwards; check highlights, links and scopes while resizing.
- [Loop 98](http://127.0.0.1:3107/projects/mini-c-prototype?example=loop&frame=98): wait five seconds, leave/revisit, then press `l` for Type Analysis.
- [Loop 99](http://127.0.0.1:3107/projects/mini-c-prototype?example=loop&frame=99): steps 99–111, including hover—no name links.
- [Function call 51](http://127.0.0.1:3107/projects/mini-c-prototype?example=function+call&frame=51): steps 51–56.
- [Unresolved name 24](http://127.0.0.1:3107/projects/mini-c-prototype?example=unresolved+name&frame=24): steps 24–25 with reduced motion.
- Custom loop: add `int n;` after the opening brace, wait for compilation, then seek **94, 97, 101, 103 and 104–117**. Custom source is not URL-persisted; 101 is currently a resolve step.

Repeat at a 390px viewport and with reduced motion.

