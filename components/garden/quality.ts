// Fits the meadow to the machine it lands on. The page's frame rate says whether the main thread
// keeps up with the display; the plants' redraw rate says whether the raster workers do. When the
// page or the workers fall behind, the plants redraw less often, since recording them is the
// biggest cost. The grid itself never coarsens: a coarser grid blurred the far flowers. After
// drei's PerformanceMonitor (a windowed vote) and hls.js (a remembered level); see
// docs/perf/2026-10-29-adaptive-and-gpu-research.md.

/** Length of one measuring window, in ms. */
const WINDOW = 250
/** Windows in a vote: 2.5 s. */
const WINDOWS = 10
/** Windows behind out of the last WINDOWS that step quality down. */
const DOWN_VOTES = 8
/** Windows in a row with time to spare before quality steps back up: 10 s. */
const UP_WINDOWS = 40
/** A window is behind under this share of the display's rate. */
const BEHIND = 0.8
/** Main-thread work per frame, as a share of the frame, low enough to try a step up. */
const SPARE = 0.5
/** Steps back up that went wrong again before the level stays put. */
const MAX_FLIPS = 2
/**
 * Windows the display's rate is the highest of: 1.5 s, shorter than a vote, so when the display
 * itself slows (a laptop dropping to 60 Hz to save power) the rate follows it before the vote can
 * count the page as behind.
 */
const RATE_WINDOWS = 6
/** Ignores the first windows after a start, while the page and the workers settle. */
const SETTLE = 8

/**
 * The ladder, cheapest loss first. Each step caps how often the plants redraw (per second); the
 * last also draws the page every other frame on a display over 90 Hz.
 *
 * Even full quality caps them. A plant redraw costs about 40 ms of CPU across the page, the workers
 * and the GPU process on an M4; uncapped, they ran 60 to 80 a second and kept four cores busy.
 * 40 a second is every third frame at 120 Hz and every other at 60, an even beat.
 */
const PLANT_CAPS = [40, 30, 20, 20]
/**
 * Plant redraws per second, and the page's frame rate, while the window is on screen but not the
 * one in use: the meadow keeps moving, slowly, for a fraction of the cost.
 */
const AWAY_PLANTS = 12
const AWAY_FPS = 30
/**
 * Worker time the plants may take, in ms a second: about one core. A machine whose frames take
 * longer redraws them less often, down to MIN_PLANTS, rather than keeping more cores busy.
 */
const PLANT_BUDGET = 1000
const MIN_PLANTS = 20
/** Plant redraws per second once nobody has touched the page for a while. */
const IDLE_PLANTS = 30
/** Refresh rates displays run at, for the measured one to snap to. */
const RATES = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240]
const HALF_RATE = 3

// Renamed when the ladder changes, so a level saved against the old one isn't read as the new.
// 3: the coarse grid is gone, and a visit that saved it starts over at full quality.
const KEY = 'garden-quality-3'

type Saved = { level: number }

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Partial<Saved>
    if (typeof s.level !== 'number') return null
    return { level: s.level }
  } catch {
    return null
  }
}

function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // Storage blocked or full: the level is relearnt next visit.
  }
}

export class Quality {
  /** The step on the ladder, 0 for full quality. */
  level = 0
  /**
   * The display's rate, from the short gaps between frames: rAF times fall on the display's
   * refresh, so a page that misses frames still shows the true rate between the ones it makes.
   */
  private hz = 0
  private rates: number[] = []
  private gaps: number[] = []
  private lastFrame = -1
  private windowStart = -1
  private frames = 0
  private work = 0
  private behind: boolean[] = []
  private spare = 0
  private settle = SETTLE
  private flips = 0
  /** Windows since the last step; a step up that has held for UP_WINDOWS no longer counts as a flip. */
  private held = 0
  private steppedUp = false
  private pinned = false
  private lastRecord = -Infinity
  /** Whether the window is out of use: on screen, but another app or window is in front. */
  away = false
  /**
   * Whether nothing is moving the scene (the cursor still, no scrub). Between plant redraws only
   * the clouds, the stars' twinkle and the light around the cursor change, so a calm page draws
   * only when a new plant frame comes back (mount.ts).
   */
  calm = false
  /** Whether nobody has touched the page for a while, so the plants can slow a little more. */
  idle = false
  /** A worker's time on one plant frame, in ms (raster.ts); 0 until known. */
  frameMs = 0
  /** Display frames per plant frame under the budget, held until the budget moves well past it. */
  private budgetBeat = 0

  constructor() {
    const saved = load()
    const slowHint =
      (navigator.hardwareConcurrency || 8) <= 4 ||
      (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection?.saveData === true
    this.level = Math.min(
      PLANT_CAPS.length - 1,
      Math.max(0, Math.round(saved?.level ?? (slowHint ? 1 : 0))),
    )
  }

  /**
   * How often the plants may redraw now, per second: the level's cap, lowered while idle and to
   * keep within PLANT_BUDGET, then snapped to a whole number of display frames so the beat is even.
   */
  plantRate() {
    if (this.away) return AWAY_PLANTS
    const hz = this.hz || 60
    const beat = (cap: number) => Math.max(1, Math.ceil(hz / cap - 0.01))
    const cap = this.idle
      ? Math.min(PLANT_CAPS[this.level], IDLE_PLANTS)
      : PLANT_CAPS[this.level]
    if (this.frameMs > 0) {
      // A frame time near a step would flip the beat back and forth as it wavers, so the budget's
      // beat moves only once it's a tenth of a frame past the next.
      const x = hz / Math.max(MIN_PLANTS, PLANT_BUDGET / this.frameMs)
      const n = this.budgetBeat
      if (!n || x > n + 0.1 || x < n - 1.1) this.budgetBeat = beat(hz / x)
    } else this.budgetBeat = 0
    return hz / Math.max(beat(cap), this.budgetBeat)
  }

  /** Whether the plants may be recorded again now, under plantRate. */
  mayRecord(now: number) {
    const cap = this.plantRate()
    // A tenth of slack so a cap that lands on the display's rate isn't missed by rAF jitter.
    if (now - this.lastRecord < (1000 / cap) * 0.9) return false
    this.lastRecord = now
    return true
  }

  /** Whether this frame should skip drawing: to run the page at AWAY_FPS, or at half the display's rate. */
  skip(frame: number) {
    if (this.away)
      return frame % Math.max(1, Math.round((this.hz || 60) / AWAY_FPS)) !== 0
    return this.level >= HALF_RATE && this.hz > 90 && frame % 2 === 1
  }

  /** Starts the windows over but keeps the display's rate, after the window goes in or out of use. */
  resettle() {
    this.windowStart = -1
    this.lastFrame = -1
    this.gaps = []
    this.behind = []
    this.spare = 0
    this.settle = Math.max(this.settle, 2)
  }

  /** Forgets the current windows, after a pause or while something else loads the page. */
  reset() {
    this.windowStart = -1
    this.lastFrame = -1
    this.gaps = []
    this.rates = []
    this.hz = 0
    this.behind = []
    this.spare = 0
    this.settle = SETTLE
  }

  /**
   * Counts one display frame, drawn or skipped, given the main thread's work on it in ms. `quiet`
   * is false while the page does work of its own (a scrub or a new hour restyling it, a resize
   * redrawing the scene).
   */
  frame(now: number, work: number, quiet: boolean) {
    if (this.lastFrame >= 0) this.gaps.push(now - this.lastFrame)
    this.lastFrame = now
    if (this.windowStart < 0) {
      this.windowStart = now
      this.frames = 0
      this.work = 0
      return
    }
    this.frames++
    this.work += work
    if (now - this.windowStart < WINDOW) return
    const span = now - this.windowStart
    const fps = (this.frames * 1000) / span
    const meanWork = this.work / this.frames
    this.windowStart = now
    this.frames = 0
    this.work = 0
    if (!quiet || this.settle > 0) this.gaps = []
    if (!quiet) return
    if (this.settle > 0) {
      this.settle--
      return
    }
    // Frames skipped on purpose still come through here, so fps counts against the display.
    const rate = this.refresh()
    if (rate > 0) this.rates.push(rate)
    if (this.rates.length > RATE_WINDOWS) this.rates.shift()
    const hz = Math.max(0, ...this.rates)
    // Votes cast against another rate no longer hold.
    if (hz !== this.hz) this.behind = []
    this.hz = hz
    // Away, the page runs slow on purpose, which says nothing about the machine.
    if (hz === 0 || this.away) return
    this.vote(fps, meanWork)
  }

  /**
   * This window's refresh rate: a short gap, but not the shortest, which a late frame catching up
   * can halve, snapped to a rate displays run at.
   */
  private refresh() {
    const gaps = this.gaps.sort((a, b) => a - b)
    this.gaps = []
    if (gaps.length < 4) return 0
    const hz = 1000 / gaps[Math.floor(gaps.length * 0.2)]
    return RATES.reduce((best, r) =>
      Math.abs(r - hz) < Math.abs(best - hz) ? r : best,
    )
  }

  private vote(fps: number, work: number) {
    this.behind.push(fps < this.hz * BEHIND)
    if (this.behind.length > WINDOWS) this.behind.shift()
    const late = this.behind.filter(Boolean).length
    if (++this.held >= UP_WINDOWS) this.steppedUp = false
    if (late >= DOWN_VOTES && this.level < PLANT_CAPS.length - 1) {
      if (this.steppedUp && ++this.flips >= MAX_FLIPS) this.pinned = true
      this.steppedUp = false
      this.set(this.level + 1)
      return
    }
    this.spare =
      late === 0 && work < (1000 / this.hz) * SPARE ? this.spare + 1 : 0
    if (this.spare >= UP_WINDOWS && this.level > 0 && !this.pinned) {
      this.steppedUp = true
      this.set(this.level - 1)
    }
  }

  private set(level: number) {
    this.level = level
    this.behind = []
    this.spare = 0
    this.held = 0
    this.settle = 2
    save({ level })
  }
}
