// Tells sustained lag from a passing hitch, to offer lo-fi (lib/lofi.ts) on a machine that can't
// keep the meadow running. Fed from mount.ts's own loop, one call per display frame, so it adds no
// rAF of its own and allocates nothing per frame. quality.ts adapts the plants' redraw rate first;
// this only speaks once the page still runs slow after that.
//
// Only frames that say something about the machine count: none while the tab is hidden or the
// loop is stopped (mount.ts resets on every start), none in the first seconds while the page and
// the workers settle, none while the page does work of its own (a scrub, a new hour, a resize),
// and none while the window is out of use and runs slow on purpose. Those pause the window rather
// than clear it, so a slow machine that someone keeps scrubbing is still caught at rest.

/** How much of the counted frames' time the judgement looks back over, in ms. */
const SPAN = 5000
/**
 * The frame rate under which a span counts as slow. Stanley's line is 30; this sits a tenth under
 * it so a display or browser capped at 30 (Chrome's Energy Saver, iOS Low Power Mode) never trips
 * it with a little jitter.
 */
const SLOW_FPS = 27
/** How often, in ms, the span is judged. */
const JUDGE_EVERY = 1000
/** Slow judgements in a row before the page is called slow: about 7 s of lag in all. */
const STRIKES = 3
/** Counted ms after a start before frames count, while the page and the workers settle. */
const SETTLE = 3000
/** A gap longer than this, in ms, is a pause (a debugger, a frozen tab), not a slow frame. */
const PAUSE = 1000
/** One frame counts as at most this long, in ms, so a single hitch can't sink a whole span. */
const MAX_GAP = 100
/** Room for SPAN of frames at 240 Hz and then some. */
const CAPACITY = 2048

export class LagDetector {
  private gaps = new Float64Array(CAPACITY)
  private head = 0
  private count = 0
  private sum = 0
  private last = -1
  private settled = 0
  private sinceJudged = 0
  private strikes = 0
  private fired = false
  /** The last span's frame rate, for testing (`window.__lag` in development). */
  fps = 0

  constructor(private onLag: () => void) {}

  /** Starts over, after the loop stops and starts again. */
  reset() {
    this.head = 0
    this.count = 0
    this.sum = 0
    this.last = -1
    this.settled = 0
    this.sinceJudged = 0
    this.strikes = 0
    this.fps = 0
  }

  /** Counts one display frame at `now`; `counts` is false for frames that say nothing about the machine. */
  frame(now: number, counts: boolean) {
    if (this.fired) return
    const gap = this.last < 0 ? -1 : now - this.last
    this.last = now
    if (!counts || gap < 0 || gap > PAUSE) return
    if (this.settled < SETTLE) {
      this.settled += gap
      return
    }
    const g = Math.min(gap, MAX_GAP)
    if (this.count === CAPACITY) this.drop()
    this.gaps[(this.head + this.count) % CAPACITY] = g
    this.count++
    this.sum += g
    while (this.sum - this.gaps[this.head] >= SPAN) this.drop()
    this.sinceJudged += g
    if (this.sinceJudged < JUDGE_EVERY || this.sum < SPAN * 0.95) return
    this.sinceJudged = 0
    this.fps = (this.count * 1000) / this.sum
    this.strikes = this.fps < SLOW_FPS ? this.strikes + 1 : 0
    if (this.strikes < STRIKES) return
    this.fired = true
    this.onLag()
  }

  private drop() {
    this.sum -= this.gaps[this.head]
    this.head = (this.head + 1) % CAPACITY
    this.count--
  }
}
