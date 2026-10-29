// The home page's opening, on a fresh load only: the meadow first, then the top bar drops in,
// then the bio fades up (garden.css). Navigating back to home inside the site skips it.

/** How long the opening runs once it starts, in ms: the bio's delay plus its fade (garden.css). */
const INTRO_MS = 1800

/**
 * Runs in <head> before the first paint. On a fresh load of home it holds back the bar and the
 * bio until the garden's first frame (mount.ts); if that never comes, they show anyway.
 */
export const INTRO_SCRIPT = `(() => {
  if (location.pathname !== '/') return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const html = document.documentElement
  html.dataset.intro = 'wait'
  setTimeout(() => {
    if (html.dataset.intro !== 'wait') return
    html.dataset.intro = 'play'
    setTimeout(() => delete html.dataset.intro, ${INTRO_MS})
  }, 3000)
})()`

/** Called with the garden's first frame: starts the opening if the page is holding for it. */
export function playIntro() {
  const html = document.documentElement
  if (html.dataset.intro !== 'wait') return
  html.dataset.intro = 'play'
  // Once it has run, clear it so a later visit to home in this session shows the text at once.
  setTimeout(() => delete html.dataset.intro, INTRO_MS)
}
