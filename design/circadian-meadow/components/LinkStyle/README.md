# LinkStyle

Two kinds of link, and no others.

Built: `app/styles/shell.css` (`.link`, `.link-quiet`, `.link-row`).

## In prose: `.link`

A link inside a sentence keeps an underline, because in body copy colour alone can't mark it: the link is `ink` like the words around it.

| | Value |
| --- | --- |
| Text | `ink`, the sentence's own face, size and weight |
| Underline | 1px, `hairline`, offset 3px (`text-decoration`, not a border) |
| Hover | underline turns `ink` over `duration-quick` |
| Focus | `focus` ring, 1px, offset 3px |

Company names in the bio are `.link` too, with an ExperienceCard.

## Quiet rows: `.link-quiet`

Socials and other link rows that stand apart from prose: `hi@stanleywang.cc / github / linkedin / resume`.

| | Value |
| --- | --- |
| Text | `--font-mono` 13px, `ink-muted`, weight 400, no underline |
| Separator | `/` in `hairline`, `space-1` either side |
| Hover | `ink`, weight 600 (`--weight-hover`), over `duration-quick` |

The weight comes from Geist Mono's variable axis. Mono keeps every weight the same width, so going heavier never moves the row; don't use `.link-quiet` in the sans. With reduced motion the change is instant.

The email copies on click and shows "copied" under itself for 1.5s in `meta` type; the address doesn't move.

## Don't

- No arrow suffixes in prose or rows. The one ↗ is the ExperienceCard's "open site", from Stanley's reference.
- No middle dots between links; the separator is a slash.
- No underline on quiet rows, and no colour-only links in prose.

## Verify

Light and dark: the underline is visible but quieter than the text; hovering a social changes weight with no shift (compare `getBoundingClientRect().width` before and after).
