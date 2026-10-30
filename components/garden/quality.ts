// Fits the meadow to the machine it lands on. The page's frame rate says whether the main thread
// keeps up with the display; the plants' redraw rate says whether the raster workers do. When the
// page or the workers fall behind, the plants redraw less often, since recording them is the
// biggest cost. The grid itself never coarsens: a coarser grid blurred the far flowers. Nothing is
// remembered between visits. After drei's PerformanceMonitor (a windowed vote) and hls.js (a
// level); see docs/perf/2026-10-29-adaptive-and-gpu-research.md.

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
 * The ladder, cheapest loss first. Each step caps how often the plants redraw (per second) while
 * the cursor or a scrub is moving them, and once they're calm; the last step also draws the page
 * every other frame on a display over 90 Hz.
 *
 * While something moves them they redraw on every display frame, as fast as the budget allows. A
 * plant redraw costs about 20 ms of a worker's time on an M4, a third of it the flowers, a third
 * the grass and a third turning the frame into type (docs/perf/2026-10-30-active-rate.md), so a
 * calm page caps them at 40: every third frame at 120 Hz and every other at 60, an even beat.
 */
const ACTIVE_CAPS = [Infinity, 60, 30, 20]
const PLANT_CAPS = [40, 30, 20, 20]
/**
 * How long each step down from the active rate to the calm one is held, in ms, so the motion
 * slows over a second or so (120, 60, then 40 a second at 120 Hz) rather than dropping at once.
 */
const EASE_STEP = 500
/**
 * How long, in ms, a budget must keep calling for another beat before the plants take it. A
 * worker's frame time wanders by a quarter from one second to the next on an M4, as the workers
 * land on its fast and slow cores, and a beat that followed it would flip between 120 and 60.
 */
const BEAT_HOLD = 1000
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
/**
 * The page's own time recording the plants, in ms a second, so a slow main thread keeps up with the
 * display rather than dropping frames to redraw them.
 */
const RECORD_BUDGET = 250
/**
 * The same while something moves the plants: up to three cores, and no more than a third of the
 * machine's, for the second or two it lasts. An M4's frame takes about 20 ms, 24 in a scrub, so it
 * holds 120 a second with room for a frame that runs long.
 */
const ACTIVE_BUDGET = Math.min(
  3000,
  ((typeof navigator === 'undefined' ? 0 : navigator.hardwareConcurrency) ||
    4) *
    (1000 / 3),
)
/** Plant redraws per second once nobody has touched the page for a while. */
const IDLE_PLANTS = 30
/** Refresh rates displays run at, for the measured one to snap to. */
const RATES = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240]
const HALF_RATE = 3

// Keys earlier visits saved their level under. The level now lasts only as long as the page:
// a reading taken while the machine was busy with something else needn't slow the next visit.
const OLD_KEYS = ['garden-quality', 'garden-quality-2', 'garden-quality-3']

function forget() {
  try {
    for (const key of OLD_KEYS) localStorage.removeItem(key)
  } catch {
    // Storage blocked: nothing was saved there either.
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
  /** Whether the cursor, a scrub or a new hour is moving the plants, so they redraw at the active rate. */
  moving = false
  /** How long, in ms, since they stopped moving; 0 while they move. */
  stillFor = 0
  /** Whether nobody has touched the page for a while, so the plants can slow a little more. */
  idle = false
  /** A worker's time on one plant frame, in ms (raster.ts); 0 until known. */
  frameMs = 0
  /** The page's time recording one plant frame, in ms (mount.ts); 0 until known. */
  recordMs = 0
  /** Display frames per plant frame under each budget, held until the budget moves well past it. */
  private activeBeat = { beat: 0, since: -1 }
  private calmBeat = { beat: 0, since: -1 }

  constructor() {
    forget()
    const slowHint =
      (navigator.hardwareConcurrency || 8) <= 4 ||
      (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection?.saveData === true
    // A likely slow machine starts a step down, and climbs back once the page has time to spare.
    this.level = slowHint ? 1 : 0
  }

  /**
   * How often the plants may redraw now, per second: the level's cap, lowered while idle and to
   * keep within the budget, then snapped to a whole number of display frames so the beat is even.
   * Once the page turns calm the beat lengthens one frame at a time, from the active rate to the
   * calm one.
   */
  plantRate(now: number) {
    if (this.away) return AWAY_PLANTS
    const hz = this.hz || 60
    const beat = (cap: number) => Math.max(1, Math.ceil(hz / cap - 0.01))
    const active = Math.max(
      beat(ACTIVE_CAPS[this.level]),
      this.fit(ACTIVE_BUDGET, this.activeBeat, now),
    )
    // Kept current while active too, so its hold doesn't run out unseen.
    const calmFit = this.fit(PLANT_BUDGET, this.calmBeat, now)
    if (this.moving) return hz / active
    const cap = this.idle
      ? Math.min(PLANT_CAPS[this.level], IDLE_PLANTS)
      : PLANT_CAPS[this.level]
    const calm = Math.max(beat(cap), calmFit, active)
    return hz / Math.min(calm, active + Math.floor(this.stillFor / EASE_STEP))
  }

  /**
   * Display frames per plant frame that keep the workers within `budget` ms a second and the page
   * within RECORD_BUDGET, 0 until a frame's time is known. A frame time near a step would flip the
   * beat back and forth as it wavers, so the beat moves from the one held only once it's a tenth of
   * a frame past the next, and has stayed past it for BEAT_HOLD.
   */
  private fit(
    budget: number,
    held: { beat: number; since: number },
    now: number,
  ) {
    // Without workers the page rasterises too, so its recording time alone sets the rate.
    const fits = Math.min(
      this.frameMs > 0 ? budget / this.frameMs : Infinity,
      this.recordMs > 0 ? RECORD_BUDGET / this.recordMs : Infinity,
    )
    if (!Number.isFinite(fits)) return (held.beat = 0)
    const hz = this.hz || 60
    const x = hz / Math.max(MIN_PLANTS, fits)
    const n = held.beat
    if (n && x <= n + 0.1 && x >= n - 1.1) {
      held.since = -1
      return n
    }
    if (n && held.since < 0) held.since = now
    if (n && now - held.since < BEAT_HOLD) return n
    held.since = -1
    return (held.beat = Math.max(1, Math.ceil(x - 0.01)))
  }

  /** Whether the plants may be recorded again now, under plantRate. */
  mayRecord(now: number) {
    const cap = this.plantRate(now)
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
    this.forgetBeats()
    this.settle = SETTLE
  }

  /** Drops the budgets' beats, which count display frames and so mean another rate at another hz. */
  private forgetBeats() {
    this.activeBeat = { beat: 0, since: -1 }
    this.calmBeat = { beat: 0, since: -1 }
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
    if (hz !== this.hz) {
      this.behind = []
      this.forgetBeats()
    }
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
  }
}
