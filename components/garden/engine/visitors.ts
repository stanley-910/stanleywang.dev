import type { Palette } from './palette'
import type { Head, Raster } from './raster'
import type { Wind } from './wind'

/**
 * Whoever answers a click on a flower: butterflies on home, the ladybug and bumblebee on the
 * poem. The garden steps and draws them and hands them clicks.
 */
export interface Visitors {
  /** Calls a visitor to the flower `owner` heads. */
  summon(owner: object, heads: Head[], p: Palette): void
  /** Calls one to a sown flower once it has had `seconds` to open. */
  later(owner: object, seconds: number): void
  step(
    dt: number,
    heads: Head[],
    wind: Wind,
    width: number,
    height: number,
    p: Palette,
  ): void
  draw(r: Raster, p: Palette): void
  clear(): void
  /**
   * A click at a point; true when a visitor took it, so it doesn't also sow. `reach` is the least
   * half-size of a visitor's target, px.
   */
  tap?(x: number, y: number, reach: number): boolean
  /** Under reduced motion: no flight, and only the frames a click asks for. */
  still?(on: boolean): void
  /** Ends what a tap set off, for reduced motion's frame after it. */
  calm?(): void
}
