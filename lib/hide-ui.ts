'use client'
import { useSyncExternalStore } from 'react'

// Hide text, from the site menu: every piece of UI fades away to leave the
// meadow alone, until the menu's corner is hovered or the page reloads. It
// lives on <html data-ui-hidden> so CSS can fade anything; nothing is stored.

const EVENT = 'uihidden'

export function isUiHidden() {
  return document.documentElement.hasAttribute('data-ui-hidden')
}

export function setUiHidden(hidden: boolean) {
  if (hidden === isUiHidden()) return
  document.documentElement.toggleAttribute('data-ui-hidden', hidden)
  window.dispatchEvent(new Event(EVENT))
}

const subscribe = (fire: () => void) => {
  window.addEventListener(EVENT, fire)
  return () => window.removeEventListener(EVENT, fire)
}

/** Whether the UI is hidden, kept current. */
export function useUiHidden() {
  return useSyncExternalStore(subscribe, isUiHidden, () => false)
}
