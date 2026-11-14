# Digest

`/digest`: a private inbox that scripts post runs to (job alerts now; price drops and flight trackers later). Stanley opens it from an iMessage link on his phone and reads it in seconds, so every choice here is for the glance: one strong word per row, whitespace between things instead of rules, and controls that speak the site's quiet mono and sit out of the way.

Built: `app/digest/page.tsx` (index), `app/digest/[feed]/[run]/page.tsx` (one run), `app/digest/login/page.tsx`, `app/digest/digest.css`, `app/digest/format.ts`. Data: `DigestRun` and `DigestItem` in `lib/digest/types.ts`, posted by producers such as `digest_payload()` in `~/Developer/job-alerts/job_alerts.py`. Copy comes from the producer, verbatim.

Related: ProjectsPage (the ledger this borrows, without its rules), LinkStyle (titles are `.link`, controls are `.link-quiet`), SiteHeader (sits above every digest page unchanged).

## The one idea

A run is a short list you skim, not a page you read. Each item is four lines at most, in falling weight: who (the company or store, `body` 500), what (the title, a `.link`), the facts (mono `meta`, `ink-muted`), and the one note that might change your mind (`small`, `ink-muted`). Nothing else competes: no rules between items, no badges, no arrows, no boxes.

## Pages

### Index (`/digest`)

```
Digest

Today
Jobs  7:49 PM
10 good, 7 maybe
Affirm, DoorDash, Databricks, Stripe, Figma, Ramp, Notion,
Datadog, Plaid, Cloudflare, Nuro, Tesla, Robinhood, …

Flights  7:42 PM
HKG to SFO dropped to $612
Cheapest since you started watching.

sign out
```

- `h1` "Digest", `body` 500.
- Runs, newest first, grouped under a day heading: "Today", "Yesterday", then "Sat, Nov 14" (in `DIGEST_TZ`). Day headings are mono `meta`, `ink-muted`, sentence case.
- A row: feed name and time (mono `meta`, `ink-muted`), the run's title as a `.link`, and its summary in `small` `ink-muted`, clamped to two lines (the run page has the rest).
- No item count: the title already says it ("10 good, 7 maybe").
- `sign out` is the page's foot, a `.link-quiet` button, lowercase like the socials row. It's the only control on the page.
- Empty: "Nothing yet." in `small` `ink-muted`.

### Run (`/digest/<feed>/<run>`)

```
digest / jobs
10 good, 7 maybe
Today, 7:49 PM
Affirm, DoorDash, Nuro

Good fits
Affirm
Software Engineer, Early Career (NYC)
New York City, San Francisco   $130k-180k   grad dates not stated   deadline rolling
Catch: Grad year unstated; confirm December 2026 grads fit the cohort.
```

- **Way back:** a `.link-row` of `.link-quiet` words, `digest / jobs`: `digest` links to the index, the feed name is the current page (`aria-current`), the slash is `hairline`. It replaces "← digest". Lowercase mono, so it reads as the top bar's sibling, not a button.
- **Head:** the run's title (`h1`, `body` 500), then when (`meta`: "Today, 7:49 PM"), then the summary (`small`, `ink-muted`). The producer key ("from mac") is not shown.
- **Sections:** consecutive items with the same `section` share a heading in mono `meta` `ink-muted` ("Good fits", "Maybes"). Items without one run on with no heading.
- **Item:** subtitle (`body` 500, `ink`), title (`.link`, opens in a new tab; plain text without a `url`), facts, note.
- **Facts** are a wrapping list, each fact its own unit, separated by `space-3` of space and no glyph. A fact longer than the line wraps inside itself.
- **Mark** prints as a `meta` word after the subtitle only when the item has no section and the mark is `good`, `maybe` or `alert` (`alert` in `ink`). Inside a section the heading already says it, and `info` means nothing to say.

### Sign in (`/digest/login`)

- The same column and `h1` "Digest" as the index, so after signing in the title stays where it was.
- A `meta` label "Password", then one row: the field (44px, square, 1px `hairline`, transparent on `page`, 16px text so iOS doesn't zoom) and `Enter`, a `.link-quiet` button 44px tall. Return submits too.
- Wrong password: "Wrong password." in `meta` under the row, `role="alert"`, tied to the field by `aria-describedby`.
- A hidden username field ("stanley") lets password managers save the login.

## Layout

| | Over 720px | 720px and under |
| --- | --- | --- |
| Column | `max-width: measure`, centred in the shell's gutters | `gutter` |
| Row | ledger: `10rem` meta column, `space-4` gap, first baselines aligned | one column, meta in one line above the body (`space-2` between its words) |
| Between blocks (head, sections, foot) | `space-5` | same |
| Section heading to first row | `space-3` | same |
| Between rows | `space-4`, no rule | same |
| Inside a row | subtitle and title 2px apart; title, facts and note `space-1` apart | same |
| Facts, note, summary | at most `measure-read` | same |
| Sign-in form | at most 20rem, `space-4` under the title | same |

## Tokens

`page`, `ink`, `ink-muted`, `hairline`, `focus`; `body`, `small` (13/19, `--leading-small`, added to `tokens.css` for this from tokens.json), `meta`; `space-1` to `space-5`, `gutter`, `measure`, `measure-read`; `radius-none`; `duration-quick`, `ease-calm` (through LinkStyle). No new tokens.

## States

- **Hover:** titles' underline goes `ink`; quiet controls go `ink` at weight 600 (LinkStyle).
- **Focus:** the global ring (`focus`, 1px, offset 3px) hugs the words. Bigger touch targets come from an invisible `::after`, not padding, so the ring never covers the next line: titles grow by `space-1` above and below (40px on a one-line title), quiet words 12px above and below and 8px each side (44px).
- **Long titles** ("Software Engineer I, Entry-Level (Graduation Date: Fall 2026-Summer 2027) - US") wrap; nothing truncates on the run page.

## Don't

- No rules between rows, no cards, no fills behind items.
- No middle dots: facts are separated by space, the meta line by its own spans.
- No arrows on the back link, no all-caps, no mark badges or colour-coded dots.
- No bordered full-width buttons.

## Verify

Light and dark (set the hour from the site menu, or `sessionStorage['hour-override']` = 12 / 22 and reload), at 1280px and 375px: the index, a 17-item jobs run with good and maybe sections, a two-item run with no sections (marks show), and sign in with and without the error. No horizontal scroll at 375px. Tab from `digest` through every title: the ring hugs each and doesn't cover the facts.
