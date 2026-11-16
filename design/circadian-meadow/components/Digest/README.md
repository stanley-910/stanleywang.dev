# Digest

`/digest`: a private inbox that scripts post runs to (job alerts now; price drops and flight trackers later). Stanley opens it from an iMessage link on his phone and reads it in seconds, so every choice here is for the glance: one strong word per row, whitespace between things instead of rules, and controls that speak the site's quiet mono and sit out of the way.

Built: `app/digest/page.tsx` (index), `app/digest/[feed]/[run]/page.tsx` (one run), `app/digest/login/page.tsx`, `app/digest/digest.css`, `app/digest/format.ts`. Data: `DigestRun` and `DigestItem` in `lib/digest/types.ts`, posted by producers such as `digest_payload()` in `~/Developer/job-alerts/job_alerts.py`. Copy comes from the producer, verbatim.

Related: ProjectsPage (the ledger this borrows, without its rules), LinkStyle (titles are `.link`, quiet controls are `.link-quiet`), SiteHeader (sits above every digest page unchanged).

## The one idea

A run is a short list you skim, not a page you read. Each item reads top to bottom in one order: who (the company or store, `body` 500), what (the title, a `.link` and the only underlined thing), the facts (mono `meta`, `ink-muted`), a few labelled lines (About, Work, Fit, Catch), and one action. Nothing else competes: no rules between or inside items, no badges, no arrows, no cards.

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
$130k-180k
(pin) New York City, San Francisco
(cap) grad dates not stated   (calendar) posted Nov 12 · rolling deadline

About  Consumer lending; pay-over-time at checkout.
Work   Backend services for the card product, in Kotlin and Python.
Fit    Two backend internships line up with the stack.
Catch  Grad year unstated; confirm December 2026 grads fit the cohort.

```

- **Way back:** a `.link-row` of `.link-quiet` words, `digest / jobs`: `digest` links to the index, the feed name is the current page (`aria-current`), the slash is `hairline`. It replaces "← digest". Lowercase mono, so it reads as the top bar's sibling, not a button.
- **Head:** the run's title (`h1`, `body` 500), then when (`meta`: "Today, 7:49 PM"), then the summary (`small`, `ink-muted`). The producer key ("from mac") is not shown.
- **Sections:** consecutive items with the same `section` share a heading in mono `meta` `ink-muted` ("Good fits", "Maybes"). Items without one run on with no heading.
- **Item:** subtitle (`body` 500, `ink`), title (`.link`, opens in a new tab; plain text without a `url`), facts, points, actions. Items sit 44px apart.
- **Title:** an inline link inside its own `p.digest-heading`, so the target is the words and a wrapped title's target follows its lines.
- **Facts:** up to four rows of mono `meta`, 6px apart, 6px under the title. A fact is plain text, or carries one of three icons: `place` (pin), `grad` (cap), `date` (calendar). A `strong` fact prints in `ink`: the pay, alone on the first row, no icon. In a row with icons, facts sit `space-3` apart, each icon 6px before its text, and a long fact wraps beside its icon; on a phone the facts stack. Two dates under one calendar are one fact, joined by a middle dot. A row of plain facts flows as one line of text with a `hairline` middle dot between them.
- **Fact icons:** 14px line drawings on a 16 grid, 1.2 stroke, round joins, `currentColor`, `aria-hidden` (`fact-icon.tsx`). The set is closed at these three; a new kind of fact goes in as text first.
- **Points** (`points` on the item): a `dl` with the label in a 3.25rem mono `meta` `ink-muted` column and the line in `small` `ink`. At most eight. Older runs with a `note` and no points show the note in `small` `ink-muted` instead.
- **Layout:** two columns that each stack on their own. Left (`14rem`): who, then the facts, so the posting can be sized up without reading. Right (at most `measure-read`): the title with copy right after it, then the points. A two-line title never pushes the facts down. At 720px and under the columns dissolve (`display: contents`) into one, in reading order: who, title, facts, points.
- **Copy:** the copy icon (two offset rounded squares, 16px, drawn like the fact icons) right after the title, in a 24px box with no edge, `ink-muted` going `ink` on hover. Labelled "Copy brief" for screen readers and as its tooltip. Clicking it prints `copied brief` under it in mono `meta` for 1.6s, the way the home page's email says `copied`; nothing moves. It never gets a row of its own.
- **Files:** any private files sit in a last row as `.digest-action` buttons (28px tall, 1px `hairline` edge, `radius-hair`, mono `meta`, `ink-muted`).
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
| Inside an index row | title and summary `space-1` apart | same |
| Inside a run item | who, title and facts 3px apart; head, points and actions `space-2` apart | same |
| Facts, note, summary | at most `measure-read` | same |
| Sign-in form | at most 20rem, `space-4` under the title | same |

## Tokens

`page`, `ink`, `ink-muted`, `hairline`, `focus`; `body`, `small` (13/19, `--leading-small`, added to `tokens.css` for this from tokens.json), `meta`; `space-1` to `space-5`, `gutter`, `measure`, `measure-read`; `radius-none`; `duration-quick`, `ease-calm` (through LinkStyle). No new tokens.

## States

- **Hover:** titles' underline goes from a faint `hairline` to full `hairline`; quiet controls go `ink` at weight 600 (LinkStyle); an action's edge and text go `ink`. Nothing changes size.
- **Targets:** the words of a title or quiet control, and the drawn edge of an action, and nothing more (the system README's Interaction section). No invisible `::after` boxes: they made the gaps around `digest` and every title clickable.
- **Focus:** the global ring (`focus`, 1px, offset 3px) hugs the same box.
- **Long titles** ("Software Engineer I, Entry-Level (Graduation Date: Fall 2026-Summer 2027) - US") wrap; nothing truncates on the run page.

## Don't

- No rules between rows, no cards, no fills behind items.
- No middle dots outside a facts row.
- No rule under or between fact rows: under a line of text it reads as a second underline.
- No Materials toggle or other disclosure inside an item; detail belongs in the copied brief.
- No arrows on the back link, no all-caps, no mark badges or colour-coded dots.
- No bordered full-width buttons, and no `.link-quiet` inside a bordered box.

## Verify

Light and dark (set the hour from the site menu, or `sessionStorage['hour-override']` = 12 / 22 and reload), at 1280px and 375px: the index, a 17-item jobs run with good and maybe sections, a two-item run with no sections (marks show), and sign in with and without the error. No horizontal scroll at 375px. Tab from `digest` through every title: the ring hugs each and doesn't cover the facts. Move the pointer across each row: it turns to a hand only over `digest`, a title's words, an action and `sign out`.
