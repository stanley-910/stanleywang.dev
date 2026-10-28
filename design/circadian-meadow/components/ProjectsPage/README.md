# ProjectsPage

`/projects` as one ledger: each project is a row with what it is on the left and a glimpse of it working on the right. The compiler leads. Every row is ProjectCard.

Built: `app/projects/page.tsx`, `app/projects/projects.css`. Data: `PROJECTS` in `app/data.ts`, copy verbatim.

## The one idea

A project should read as its own thing before you read a word: name and kind in a narrow left column you can scan down, and on the right the thing itself (a screenshot, a recording, code you can edit and compile, music you can play). No cards, frames or icons competing with it; the page is plain `page`, rows are split by a hairline, and the glimpse is the colour.

## Order

1. **Flagship:** Mini Compiler (`FLAGSHIP` in the page). Its glimpse spans the whole measure, its name is `title` (18px), and its words run under the plate: the description, then the editable `main.c` snippet that compiles on its page.
2. **Projects with a glimpse**, in `data.ts` order: Portal, Eastwatch, Datamines, Chani, Trading Fours, Lovebox.
3. **Text-only projects** (pi-talk, OS Sim, Dictate): the same grid with no plate, tighter rows (`space-3`), grouped at the end.

## Layout

| | Desktop (over 720px) | Phone |
| --- | --- | --- |
| Column | `max-width: measure`, at `gutter` | `gutter` |
| Row grid | `10rem` meta, `space-4` gap, rest body | one column; meta in one line with links pushed right |
| Row spacing | `space-4` above, `space-5` below, hairline at 45% between | `space-3` / `space-4` |
| Description | `body`, `ink`, at most `measure-read` | same |

No entrance animation: rows are there when the page is.

## Verify

1440px and 375px, light and dark: the compiler first with its plate at full measure; rows align on the 10rem line; no horizontal scroll; a light/dark screenshot pair swaps with the theme; the Datamines video plays only on screen.

See ProjectCard for the row itself.
