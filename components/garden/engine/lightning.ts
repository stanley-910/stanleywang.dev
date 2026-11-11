// Lightning's colours, apart from the weather that strikes with them: the site menu's slider
// shows the same line, and reads it from here so pages without a meadow don't load the engine.

import { mix, paletteAt, type Rgb } from './palette'

const GOLDEN = paletteAt(17.75)
const NIGHT = paletteAt(22)

/** A bolt at its bluest, near and at night: `night-fluff` 30% toward `night-cosmos-vein`, a violet blue. */
const BOLT_BLUE = mix(NIGHT.fluff, NIGHT.cosmosVein, 0.3)
/** A bolt at its yellowest, far off through the rain by day: `night-fluff` 75% toward `golden-globe`. */
const BOLT_WARM = mix(NIGHT.fluff, GOLDEN.globe, 0.75)
/** How far along `lightningAt` the hour alone takes lightning: up to that yellow white. */
export const AUTO_TOP = 0.75
/**
 * Lightning's colours in a line, 0 to 1, as the site menu's slider shows them: the violet blue,
 * up to the yellow white at `AUTO_TOP`, then on to `golden-globe` itself, the warmest gold.
 */
export function lightningAt(t: number): Rgb {
  return t < AUTO_TOP
    ? mix(BOLT_BLUE, BOLT_WARM, t / AUTO_TOP)
    : mix(BOLT_WARM, GOLDEN.globe, (t - AUTO_TOP) / (1 - AUTO_TOP))
}
