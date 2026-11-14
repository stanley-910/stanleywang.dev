// The home page's opening, on a fresh load: the meadow first, then the top bar drops in, then the
// bio fades up (garden.css). Navigating back to home inside the site plays a shorter one: the
// scene fades in, then the bio.

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

/** How long coming back to home runs once it starts, in ms: the bio's delay plus its fade (garden.css). */
const RETURN_MS = 800
/** How long coming back holds for the meadow before showing the page anyway, in ms. */
const RETURN_WAIT = 1500

/** Whether home has been shown in this session, so the next mount of it is a return. */
let shown = false

/** Called with the garden's first frame: starts the opening if the page is holding for it. */
export function playIntro() {
  shown = true
  const html = document.documentElement
  const held = html.dataset.intro
  if (held !== 'wait' && held !== 'back-wait') return
  const state = held === 'wait' ? 'play' : 'back'
  html.dataset.intro = state
  // Once it has run, clear it, so nothing is left holding an animation.
  setTimeout(
    () => {
      if (html.dataset.intro === state) delete html.dataset.intro
    },
    held === 'wait' ? INTRO_MS : RETURN_MS,
  )
}

/**
 * Coming back to home inside the site: holds the scene and the bio until the meadow's workers
 * are past their first frames, then the scene fades in and the bio after it (garden.css), in
 * place of the bio on a bare ground, then the land, then the flowers, each cut in at once. The
 * bar is already there and stays. Call before home's first paint.
 */
export function holdReturn() {
  const html = document.documentElement
  if (!shown || html.dataset.intro) return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  html.dataset.intro = 'back-wait'
  setTimeout(() => {
    if (html.dataset.intro === 'back-wait') playIntro()
  }, RETURN_WAIT)
}

/** Lets go of a return that never played, when home is left again before the meadow was ready. */
export function dropReturn() {
  const html = document.documentElement
  if (html.dataset.intro === 'back-wait' || html.dataset.intro === 'back')
    delete html.dataset.intro
}
