'use client'
import { useSyncExternalStore } from 'react'

// Lo-fi: home without the meadow's animation, for machines that can't keep it running. Offered
// when components/garden/lag.ts finds the meadow running slow, or set from the terminal (`lofi
// on|off`) or the site menu. The choice is kept per viewer in localStorage; `?lofi=1` or
// `?lofi=0` overrides it for one page load without saving, and `?lofi=ask` shows the offer at
// once, for testing.

const KEY = 'lofi'
/** Set for the session once the offer is dismissed, so it isn't made again. */
const DISMISSED_KEY = 'lofi-dismissed'
/** Fired on window when lo-fi turns on or off. */
const EVENT = 'lofichange'
/** Fired on window when the meadow asks to offer lo-fi. */
export const LOFI_ASK_EVENT = 'lofiask'

/** The URL's override, read once per page load; null without one. */
let override: boolean | null | undefined

function fromUrl() {
  if (override !== undefined) return override
  const q = new URLSearchParams(location.search).get('lofi')
  override =
    q === '1' || q === 'on' ? true : q === '0' || q === 'off' ? false : null
  return override
}

export function isLofi() {
  const forced = fromUrl()
  if (forced !== null) return forced
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setLofi(on: boolean) {
  // A choice made on the page outranks the URL's for the rest of the visit.
  const was = isLofi()
  override = null
  try {
    if (on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch (err) {
    console.warn('lofi: storage blocked, the choice lasts this page only', err)
    override = on
  }
  if (was !== on) window.dispatchEvent(new Event(EVENT))
}

/** The dismissal, kept here too in case session storage is blocked. */
let dismissed = false

/** Whether the offer was dismissed this session. */
export function lofiDismissed() {
  if (dismissed) return true
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissLofi() {
  dismissed = true
  try {
    sessionStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    // Storage blocked: the offer stays down until the page reloads.
  }
}

/** Asks the page to offer lo-fi, unless it's on already or was dismissed this session. */
export function askLofi() {
  if (isLofi() || lofiDismissed()) return
  window.dispatchEvent(new Event(LOFI_ASK_EVENT))
}

/** Whether `?lofi=ask` wants the offer shown at once. */
export function lofiAskForced() {
  return new URLSearchParams(location.search).get('lofi') === 'ask'
}

const subscribe = (fire: () => void) => {
  // A choice made in another tab arrives as a storage event.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) fire()
  }
  window.addEventListener(EVENT, fire)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, fire)
    window.removeEventListener('storage', onStorage)
  }
}

/** Whether lo-fi is on, kept current; off on the server and through hydration. */
export function useLofi() {
  return useSyncExternalStore(subscribe, isLofi, () => false)
}
