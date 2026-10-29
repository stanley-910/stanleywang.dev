# TableOfContents

**Status: approved and built (2026-10-29).** Mock: https://claude.ai/artifact/NjwjcR633MPTVR2u4NcfX4

One table of contents for every post. It replaces the three variants in `components/ui/toc.tsx` (`classic`, `staffline`, `vim`) and `app/styles/toc.css`.

## Problem

Today a post's tags pick one of three looks: a serif list that fades in on hover, a "§ contents" staff with amber dots, and a ":TOC" vim buffer with line numbers, an amber highlight, "~14 min left" and "1/9". Moving between posts changes how the same thing looks and behaves. None of them shows on phones.

## What it keeps

- Where you are: the current section is marked as you read.
- Nesting: up to three levels (h2, h3, h4 relative to the shallowest), indented.
- Jump to a section on click.

## What goes

The `variant` prop and `resolveVariantFromTags`; the ":TOC", "§ contents" and post-title labels; line numbers; the amber accent and highlight; the ● marker and ─ ticks; "~N min left" and "N/9"; hover-only reveal (the classic list sat at 60% opacity); underlines on every row; the active row's shift and glow; fading deeper levels; the serif; the fade-in and rise on mount. The `title` prop goes too.

## Anatomy

```
contents                      meta, ink-muted
│ Data I/O                    rail: 1px hairline
│ Initializations
│ Main Loop
│ Sample Function
│ Loss Function
│   Forward
┃   Backward                  current: ink, 500, the rail's segment in ink
│     Backprop Through Softmax
│ Closing Notes
```

## Layout

| | 1280px and up | Under 1280px |
| --- | --- | --- |
| Form | Rail in the left gutter, `position: fixed` | Inline `<details>`, closed, between the post's meta row and its first paragraph |
| Position | `left: space-4`, `top` level with the post title (top bar + `space-5`, 116px), width `gutter − 2 × space-4` | In the reading column, `space-3` above, `space-4` below when open |
| Height | At most `100vh − top − space-5`; the list scrolls inside, thin scrollbar, and keeps the current row in view (`block: 'nearest'`, on the list only) | Its natural height |
| Rows | 12px / 20px, padding 2px | 12px / 20px, padding 6px (32px rows) |

Under 1280px the gutter is too narrow for most headings, so the TOC moves into the page flow. Long headings wrap with a hanging indent at any width.

## Type and colour

- Everything in Geist Mono `meta` (12px). Mono so the current row's weight change never shifts the text.
- Label `contents`, lowercase, `ink-muted`; on phones it's the `<summary>`, with `+` / `−` after it in `ink-muted`, and turns `ink` when open. Summary row at least 44px tall.
- Rail: 1px `hairline` down the left of the list. Rows inset `space-2` (14px), plus 14px per level.
- Only `page`, `ink`, `ink-muted`, `hairline`. No new tokens.

## States

| Row | Text | Rail segment |
| --- | --- | --- |
| Rest | `ink-muted`, 400 | `hairline` |
| Hover | `ink` over `duration-quick`, `ease-calm` | `hairline` |
| Current | `ink`, 500, `aria-current="location"` | 1px `ink`, the row's full height |
| Focus | `focus` ring, 1px, offset 3px | as above |

Before the first heading nothing is current. The phone disclosure marks the current row the same way when opened mid-post.

## Behaviour

- **Headings:** h2–h4 inside the post body (not the header's h1, not anything `data-toc-exclude`, not Footnotes). IDs from `github-slugger`, as now.
- **Current section:** the last heading whose top is above 25% of the viewport height. At the bottom of the page, the last heading. One scroll listener, throttled to animation frames, or an IntersectionObserver whose band is the top 25%; either way no flicker between headings.
- **Click:** smooth scroll (instant with reduced motion), `history.replaceState` the hash, mark it current at once, focus the heading (`tabindex="-1"`). Headings get `scroll-margin-top: space-4` in CSS, replacing the inline-style timer.
- **Phones:** the disclosure stays open after a jump, so Back shows the list again.
- **Mount:** `<TOC />` in the MDX, as now, opt-in per post; no props. No entry animation.
- **No JS:** the list renders server-side from the headings if practical; otherwise it's absent, as today.

## Accessibility

`<nav aria-label="Contents">` with nested `<ol>`s that mirror the heading levels. Phones: native `<details>` / `<summary>`. Tab order: rows top to bottom.

## Hand-off

Replace `components/ui/toc.tsx` and `app/styles/toc.css` with one component and a small CSS file on the tokens above. Drop `variant=` and `title=` from the three posts' `<TOC>` and the `TocVariant` type from `mdx-components.tsx`.

## Verify

Day and night, 1440px, 1280px, 1024px and 375px: no amber anywhere; the current row changes as you scroll the RNN post, and nothing moves sideways when it does; "Backprop Through Softmax" wraps cleanly at 1280px; the phone disclosure opens, jumps, and stays open; keyboard focus is visible on every row; reduced motion jumps without smoothing.
