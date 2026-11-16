# stanleywang.dev

Stanley's personal site: Next.js App Router, plain CSS in `app/styles/` and beside each route.

## Anything a visitor sees

The site has one design system, Circadian Meadow, in `design/circadian-meadow/`. It applies to every page and component in this repo, private ones like `/digest` included.

Before changing markup or CSS:

1. Read `design/README.md` and `design/circadian-meadow/README.md`. Its Interaction section is short and applies everywhere.
2. Read the spec for the component you're touching, `design/circadian-meadow/components/<Name>/README.md`. If there's none, have the `designer` agent (`.claude/agents/designer.md`) write one first; don't invent styles.
3. Style through the tokens in `app/styles/tokens.css`. Reuse `.link` and `.link-quiet` from `app/styles/shell.css`; there are no other link styles.

Before calling it done:

- Look at it in a browser, light and dark, at 1280px and 375px. No horizontal scroll at 375px.
- Hover and click every control you touched. The pointer changes only over the words or the drawn button, and nothing moves on hover.
- Tab through it. The focus ring hugs each control.
- If the change departs from a spec, update the spec in the same commit.

## House rules

- Copy is Stanley's, verbatim. Sentence case, no emoji, no marketing voice.
- No AI attribution in commits, PRs or docs.
- Never print or commit secrets; `.env*` files stay local.
