# ProjectCard

One project's row on ProjectsPage: meta on the left, the glimpse and words on the right. Not a card in the boxed sense: no fill, border or shadow around the row.

Preview: ProjectsPage's card shows every variant.

Built: `ProjectRow` in `app/projects/page.tsx`, styles in `app/projects/projects.css`.

## Anatomy

```
Portal              ┌────────────────────────────────────┐
Web                 │            glimpse (plate)         │
(pip) (gh)          └────────────────────────────────────┘
                     ▬ • •                     slide dots
                    A multiplayer canvas for trip planning…   description (body, ink)
                    [main.c snippet] / [track players]        anything to try
```

| Part | Tokens |
| --- | --- |
| Name | `body` 15px, weight 500, `ink`. The flagship's is `title` 18px |
| Kind | `category`, `meta` mono, `ink-muted` |
| Links | Stanley's existing marks (Pip, Reggie's sprite, globe, YouTube, GitHub), 16px, `ink-muted` → `ink` on hover, `space-2` apart |
| Plate | the media at its own aspect ratio, 1px `hairline` at 45%, `surface` behind letterboxed images, no radius or shadow. Opens fullscreen on click |
| Slide dots | 6px `hairline` at 55%; the current one 16px wide, `ink-muted` |
| Fullscreen | the plate on `page` with a hairline; the counter, arrows and close are `caption-fill` pills with `caption-ink` |
| Snippet | `surface`, hairline border, mono 12px; the compile button is `ink` on `page` |

## Variants

- **Flagship:** one column; meta in one line above the plate, links pushed right.
- **With glimpse:** two columns.
- **Plain:** two columns, no plate, tighter padding.

## Performance

Images load lazily and decode async; the plate reserves its aspect ratio so nothing shifts. Video is muted, loops, has `preload="metadata"`, and plays only while on screen (IntersectionObserver); with reduced motion it doesn't play.

## Open

A "what's interesting" line per project (a `note` field) would sit between the description and the extras, in `ink-muted`. It needs Stanley's words, so it's not in the data yet.
