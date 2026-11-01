'use client'
import { useEffect } from 'react'

// The top bar's two menus, the site index and the site menu, share one corner
// of the screen on a phone, so opening one closes the other. A tap already
// closes the other as a click outside it; this covers the keyboard too.

const EVENT = 'menuopen'

/** Tells the other menus that `name` is opening. */
export function announceMenuOpen(name: string) {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: name }))
}

/** Calls `close` while `open` whenever another menu opens. */
export function useCloseOnOtherMenu(
  name: string,
  open: boolean,
  close: () => void,
) {
  useEffect(() => {
    if (!open) return
    const onOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== name) close()
    }
    window.addEventListener(EVENT, onOpen)
    return () => window.removeEventListener(EVENT, onOpen)
  }, [name, open, close])
}
