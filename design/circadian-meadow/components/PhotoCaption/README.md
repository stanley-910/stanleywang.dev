# PhotoCaption

A small pill over a photo's bottom-left corner: the title in ink, then the film and year muted. Pressing it opens every detail the photo has, above the pill.

Built: `components/ui/photo.tsx` (`Photo`), `photo.css`. Data: `app/film/photos.ts`. Page: `/film`.

## Data

Every field but the size and alt text is optional, and a caption shows only what's known.

| Field | Example | Shown |
| --- | --- | --- |
| `title` | — | Pill, in `caption-ink`. Falls back to `location` |
| `location` | Tokyo, Japan | Pill when there's no title, else "Place" in details |
| `date` | `2026-10-09` (or `2026-10`, `2026`) | Year in the pill; "Oct 9, 2026" in details |
| `camera` | Olympus Pen EE-3 | Details |
| `lens` | D.Zuiko 28mm f/3.5 | Details |
| `film` | Kodak Portra 400 | Pill without the maker ("Portra 400"); in full in details |
| `iso` | 400 | Details, only when there's no `film` (digital) |
| `shutter`, `aperture` | 1/250, f/8 | Details. None for the Pen EE-3: automatic exposure |

## Anatomy

```
┌───────────────────────────────┐
│                               │
│  ┌─────────────────────────┐  │ details, when open: caption-fill, radius-card,
│  │ Date    Oct 9, 2026     │  │ meta type, labels caption-ink-muted
│  │ Camera  Olympus Pen EE-3│  │
│  │ Lens    D.Zuiko 28mm …  │  │
│  │ Film    Kodak Portra 400│  │
│  └─────────────────────────┘  │
│  ( Tokyo, Japan  Portra 400  2026 )  pill: caption-fill, radius-pill
└───────────────────────────────┘
```

| Part | Tokens |
| --- | --- |
| Pill | `caption-fill` with a 6px backdrop blur, `radius-pill`, padding 4px 10px, `meta` mono 12px / 16px, inset `space-1` from the corner |
| Title | `caption-ink` |
| Film, year | `caption-ink-muted`, 0.75em apart. No middle dots |
| Details | `caption-fill`, `radius-card`, a two-column grid (label, value), padding `space-1` 10px |

The caption colours are fixed in every theme: the pill sits on the photo, not the page.

## Photo

Full width of its column, no radius, no shadow, the photo's own aspect ratio reserved before it loads (`width` and `height` in the data), via `next/image`. Until a photo's file is approved and exported, the frame shows `surface` with faint `hairline` hatching at the right shape.

## /film

A grid at `measure`: `repeat(auto-fill, minmax(18rem, 1fr))`, gaps `space-4` by `space-3`, so two portrait photos side by side on desktop and one per row on a phone. The page has no visible heading; the top bar names it.

## Behaviour and accessibility

The pill is a button with `aria-expanded` and `aria-controls` on the details list; it's disabled when there are no details beyond what it shows. Details are a `<dl>`. The photo carries `alt`. The focus ring on the pill is `caption-ink`, 1px, offset 2px.

## Export rule

Strip GPS from every exported file: the two Tokyo scans carry coordinates in their EXIF. Resize to 2000px on the long edge, WebP or AVIF.

## Verify

Light and dark, 1440px and 375px, with placeholder frames only: the pill reads on the hatching, opens and closes, and both photos keep their shape.
