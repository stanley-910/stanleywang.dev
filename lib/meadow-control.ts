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

export function sendMeadow(command: MeadowCommand) {
  window.dispatchEvent(new CustomEvent(MEADOW_EVENT, { detail: command }))
}

/** Whether a meadow is on this page to hear it. */
export function meadowHere() {
  return document.querySelector('.garden-canvas') !== null
}
