# ExperienceCard

Hovering or focusing a company name in the bio opens a small card above the line: who, when, the role, and what the work was. It replaces the experience list as the way to read the roles.

Built: `components/ui/experience-card.tsx` (`ExperienceLink`), `experience-card.css`. Data: `WORK_EXPERIENCE` in `app/data.ts`, copy verbatim.

## Anatomy

```
┌──────────────────────────────────────────┐
│ [E] Electronic Arts          Summer 2026 │  logo + company (small, 500) · dates (meta, ink-muted)
│                                          │
│ Software Engineer Intern                 │  role (small, ink)
│ Commerce & Identity. Prototyped a …      │  desc (small, ink-muted)
│ ──────────────────────────────────────── │  hairline at 45%
│ open site ↗   case study                 │  footer (link-quiet, meta)
└──────────────────────────────────────────┘
        ▲ 8px (space-1)
  …at Electronic Arts. Before that, …
```

| Part | Tokens |
| --- | --- |
| Card | `surface`, 1px `hairline` at 45%, `radius-card` (6px), `shadow-card`, padding `space-2`, width `min(22rem, 100vw − 24px)` |
| Logo | 16px, `radius-hair`. Without one: the company's first letter in `meta` mono, `ink-muted`, in a 1px `hairline` square |
| Company | `small` (13px), weight 500, `ink`, one line with ellipsis |
| Dates | `meta`, `ink-muted`, right-aligned. `start–end`, or `start` alone |
| Role | `small`, `ink`, 6px under the top row |
| Description | `small`, `ink-muted`, full text, wraps |
| Footer | `link-quiet` at `meta` size, `space-3` apart, over a hairline. "open site ↗" always; "case study" when the role has one |

## Behaviour

- **Opens** on mouse hover or keyboard focus of the name. **Closes** 120ms after the pointer leaves both the name and the card, so the pointer can cross the gap; on blur unless focus moved into the card; and on Escape or a press outside.
- **Touch:** the first tap opens the card and doesn't follow the link; a second tap, or the card's "open site", opens the site. Whether a tap should open the card is decided at pointerdown, before the tap's focus opens it.
- **Click (mouse):** the name is a real link to the company's site, in a new tab.
- **Placement:** above the line, left edge on the name's first line box. It slides sideways to stay 12px inside the window, and drops below the line when there's no room above. Measured from the name, not the card.
- **Motion:** fades in and rises 4px over `duration-card` (160ms), `ease-calm`. Reduced motion: no rise, no transition.
- **No layout shift:** the card is absolutely positioned and always rendered (hidden with `visibility`), and the page clips horizontal overflow, so a closed card past the edge never widens the page.

## Themes

Off home, the card takes the page theme: light `surface` by day, dark by night. On the home scene (after the garden port) it uses the dark values in every theme, like the bio's `scene-ink`.

## Accessibility

The name has `aria-describedby` pointing at the card, so a screen reader hears the role and description. The footer links are out of the tab order while the card is closed. Focus ring as LinkStyle.

## Verify

Hover each of Electronic Arts, Flow PT team and BETA Technologies at 1440px and 375px, light and dark: the card stays on screen, nothing on the page moves, Escape closes it, and Tab from the name reaches "open site". At 375px, check `document.documentElement.scrollWidth === 375` with every card closed.

## Open

Logos: none are in the repo yet, so cards show the letter mark. Stanley to supply 32px SVGs or PNGs per company (`logo` field).
