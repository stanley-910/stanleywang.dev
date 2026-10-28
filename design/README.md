# Design system

The site's visual system is Circadian Meadow, in `design/circadian-meadow/`.

- Read `circadian-meadow/README.md` before changing anything a visitor sees. Its Site pages section covers every page other than home.
- Style through the tokens in `circadian-meadow/tokens.json`, as CSS variables (`--page`, `--ink`, `--ink-muted`, `--hairline`, …). Don't hard-code colours, fonts or sizes the system already names.
- Build a component from its spec in `circadian-meadow/components/<Name>/README.md`. If there's no spec, don't invent one: ask the `designer` agent (`.claude/agents/designer.md`) to design it first.
- The garden owns the scene colours. Its palette lives in `~/Developer/sides/ascii-garden/src/palette.ts`, and the `designer` agent regenerates the scene tokens from it.
- Check every page in both the light (day) and dark (night) page themes, at desktop and 375px wide.
