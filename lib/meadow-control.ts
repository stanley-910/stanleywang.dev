import type { WeatherKind } from './weather'

// Commands for the home meadow from elsewhere on the page (the terminal):
// a window event that components/garden/mount.ts listens for while it runs.

export const MEADOW_EVENT = 'meadowcontrol'

export type MeadowCommand =
  /** The breeze's strength, 0 to 1 (0.2 is the meadow's own). */
  | { kind: 'wind'; value: number }
  /** One strong gust that rolls through and settles. */
  | { kind: 'gust' }
  /** A new meadow grows in, from a fresh seed. */
  | { kind: 'regrow'; seed: number }
  /** The visit's weather (lib/weather.ts), which the site menu shows too. */
  | { kind: 'weather'; value: WeatherKind }

export function sendMeadow(command: MeadowCommand) {
  window.dispatchEvent(new CustomEvent(MEADOW_EVENT, { detail: command }))
}

/**
 * The breeze the terminal reports, 0 to 1. Each meadow sets its own on mounting (home's 0.2, the
 * poem's calmer 0.13) and the terminal's `wind` command sets it after, so what it says is what blows.
 */
let breeze = 0.2

export const currentBreeze = () => breeze

export const setBreeze = (value: number) => {
  breeze = value
}

/** Whether a meadow is on this page to hear it. */
export function meadowHere() {
  return document.querySelector('.garden-canvas') !== null
}
