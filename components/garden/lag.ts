// Tells sustained lag from a passing hitch, to offer lo-fi (lib/lofi.ts) on a machine that can't
// keep the meadow running. Fed from mount.ts's own loop, one call per display frame, so it adds no
// rAF of its own and allocates nothing per frame. quality.ts adapts the plants' redraw rate first;
// this only speaks once the page still runs slow after that.
//
// It judges the counted frames in windows of WINDOW ms, one after another, and calls the page slow
// after STRIKES slow windows in a row. A window is slow on any of three counts:
// - the page's frame rate is under 30 (27 on a display capped at 30 Hz);
// - long frames come often, so motion judders even when the average holds up;
// - fewer than 27 plant frames a second reach the screen: the page can draw at the display's rate
//   while the plants on it stutter, which the page's frame rate never shows.
// The windows don't overlap, so one bad moment can make at most two of them slow, never three.
//
// Only frames that say something about the machine count: none while the tab is hidden or the
// loop is stopped (mount.ts resets on every start), none in the first seconds while the page and
// the workers settle, none while the page does work of its own (a scrub, a new hour, a resize),
// and none while the window is out of use (another app or window has the focus), when the meadow
// runs slow on purpose and the browser may slow the page besides. Those pause the window rather
// than clear it, so a slow machine that someone keeps scrubbing is still caught at rest; coming
// back into use starts over (mount.ts), settling time included.

/** How much of the counted frames' time each judgement covers, in ms. */
const WINDOW = 700
/**
 * Slow windows in a row before the page is called slow: two seconds of trouble, since a machine
 * either holds the meadow or doesn't and it shows at once, and more than one bad moment can make
 * (see above).
 */
const STRIKES = 3
/** Stanley's line: under 30 frames a second is not fine. */
const SLOW_FPS = 30
/**
 * The same on a display or browser capped at 30 (Chrome's Energy Saver, Low Power Mode), a tenth
 * under, so the cap itself never trips it with a little jitter.
 */
const CAPPED_FPS = 27
/**
 * A gap shorter than this, in ms, shows a display faster than 30 Hz: one capped at 30 has none
 * but the odd late frame catching up.
 */
const FAST_GAP = 25
/**
 * The share of a window's gaps that must be that short to call the display faster than 30 Hz, as
 * quality.ts reads the display's rate from the gap a fifth of the way up.
 */
const FAST_SHARE = 0.2
/**
 * A frame longer than this, in ms, is a hitch: two or more refreshes missed at 60 Hz, four at
 * 120. One refresh missed now and then is a healthy page.
 */
const HITCH = 40
/** The same on a display capped at 30 Hz, where one missed refresh already leaves a 67 ms frame. */
const CAPPED_HITCH = 50
/** Hitches a second that make a window slow: two in a window, a judder anyone can see. */
const HITCH_RATE = 2
/**
 * The plant frames a second under which the plants themselves read as stuttering, whatever the
 * page's own rate: Stanley's 30, a tenth under. A machine keeping up gets 30 or more from
 * quality.ts at rest (40 at 120 Hz, 30 at 60, 30 once idle); it only asks for 20 after stepping
 * down its ladder or running out of budget, which is the machine saying it can't hold 30.
 */
const SLOW_PLANTS = 27
/**
 * The same as a share of the page's own frame rate, for a display under 60 Hz, where the plants'
 * even beat at rest is every other frame: 24 a second at 48 Hz is that display's full rate.
 */
const PLANT_SHARE = 0.45
/**
 * On a display capped at 30 Hz the plants' slowest beat is every other refresh, 15 a second, and
 * the cap, not the machine, sets it; only under 70% of that are the workers failing to keep up.
 */
const CAPPED_SLOW_PLANTS = 10.5
/** Counted ms after a start before frames count, while the page and the workers settle. */
const SETTLE = 1500
/** A gap longer than this, in ms, is a pause (a debugger, a frozen tab), not a slow frame. */
const PAUSE = 1000
/**
 * One frame counts as at most this long, in ms, toward a window's time, so a single stall can't
 * sink a window's frame rate or plant rate on its own. It still counts as a hitch.
 */
const MAX_GAP = 100

/** Why the last window was slow, for testing; '' if it wasn't. */
type Reason = '' | 'fps' | 'hitches' | 'plants'

export class LagDetector {
  private time = 0
  private frames = 0
  private fast = 0
  private hitches = 0
  private cappedHitches = 0
  private plantFrames = 0
  private last = -1
  private lastPlant = -1
  private settled = 0
  private fired = false
  // The last window's readings, for testing (`window.__lag` in development).
  /** Display frames a second. */
  fps = 0
  /** Hitches a second. */
  hitchRate = 0
  /** Plant frames a second that reached the screen. */
  plantRate = 0
  /** Whether the display looked capped at 30 Hz. */
  capped = false
  /** What made it slow, if anything. */
  reason: Reason = ''
  /** Slow windows in a row so far. */
  strikes = 0

  constructor(private onLag: () => void) {}

  /** Starts over, after the loop stops and starts again. */
  reset() {
    this.clearWindow()
    this.last = -1
    this.lastPlant = -1
    this.settled = 0
    this.strikes = 0
    this.fps = 0
    this.hitchRate = 0
    this.plantRate = 0
    this.capped = false
    this.reason = ''
  }

  /**
   * Counts one display frame at `now`; `counts` is false for frames that say nothing about the
   * machine. `plant` is the plant frame on screen (mount.ts's `drawn`), which changes each time a
   * new one reaches it.
   */
  frame(now: number, counts: boolean, plant: number) {
    if (this.fired) return
    const gap = this.last < 0 ? -1 : now - this.last
    this.last = now
    const fresh = this.lastPlant >= 0 && plant !== this.lastPlant
    this.lastPlant = plant
    if (!counts || gap < 0 || gap > PAUSE) return
    if (this.settled < SETTLE) {
      this.settled += gap
      return
    }
    this.time += Math.min(gap, MAX_GAP)
    this.frames++
    if (gap < FAST_GAP) this.fast++
    if (gap > HITCH) this.hitches++
    if (gap > CAPPED_HITCH) this.cappedHitches++
    if (fresh) this.plantFrames++
    if (this.time < WINDOW) return
    this.judge()
    this.clearWindow()
    if (this.strikes < STRIKES) return
    this.fired = true
    this.onLag()
  }

  private judge() {
    const secs = this.time / 1000
    this.capped = this.fast < this.frames * FAST_SHARE
    this.fps = this.frames / secs
    this.hitchRate = (this.capped ? this.cappedHitches : this.hitches) / secs
    this.plantRate = this.plantFrames / secs
    const plantLine = this.capped
      ? CAPPED_SLOW_PLANTS
      : Math.min(SLOW_PLANTS, this.fps * PLANT_SHARE)
    this.reason =
      this.fps < (this.capped ? CAPPED_FPS : SLOW_FPS)
        ? 'fps'
        : this.hitchRate >= HITCH_RATE
          ? 'hitches'
          : this.plantRate < plantLine
            ? 'plants'
            : ''
    this.strikes = this.reason ? this.strikes + 1 : 0
  }

  private clearWindow() {
    this.time = 0
    this.frames = 0
    this.fast = 0
    this.hitches = 0
    this.cappedHitches = 0
    this.plantFrames = 0
  }
}
