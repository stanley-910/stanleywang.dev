'use client'
import { Fragment, useEffect, useRef, useState } from 'react'

import { mountGarden } from '@/components/garden/mount'
import { currentHour, HOUR_KEY, setHour } from '@/lib/circadian'

import cipher from './poem.enc.json'

import '@/components/garden/garden.css'
import './poem.css'

// A poem over the meadow, behind a riddle whose answer is the password.
// Scrolling through it runs the scene through a day. A line
// `@ <when> [<where>]` in the plaintext pins the line after it: when that
// line stands at <where> on the screen, the scene
// shows <when>, and between pins the hour follows the scroll.
//
//   <when>   18:45, or sunrise / sunset / moonset (when the sun stands
//            just clear of the ridges, or the sun or moon has just gone
//            behind them, on this screen), any of those with an offset:
//            sunset+0:10
//   <where>  top, middle (the default), bottom, or a share of the screen
//            from its top: 85%
//
// Before the first pin the hour holds at the first pin's. A pin after the
// last line sets where that line ends up when the scroll runs out, and the
// hour there.
//
// `@ gap` leaves room, sized so the line after it is just coming up from the
// bottom when the line above stands at its pin; `@ gap 68%` sizes it for the
// line above standing at 68% of the screen instead, pinned or not.
//
// `@ end top` (or any <where>) before a line ends the scroll with that line
// there, so long as the last line still shows no lower than the end pin puts
// it; on a screen too short for both, the last line wins.

/** Where the day starts and ends when the poem pins neither. */
const DEFAULT_START = 5
/** Where the last line rests when the scroll runs out, unless pinned; with `@ end`, the lowest it may rest. */
const END_AT = 0.7
/** How fast the scene catches up with the scroll, per second. */
const EASE = 5
const WHERE: Record<string, number> = { top: 0.1, middle: 0.5, bottom: 0.9 }

type Pin = { when: string; at: number }
type Line = {
  indent: string
  text: string
  pin?: Pin
  gap?: number | 'auto'
  /** Where `@ end` asks this line to stand when the scroll runs out. */
  rest?: number
}
type Parsed = { title?: string; lines: Line[]; end?: Pin }
type Sky = { sunrise: number; sunset: number; moonset: number }

const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

/** The key a password stretches into; extractable, so the session can keep it. */
async function keyFrom(password: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password.normalize('NFC')),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: fromB64(cipher.salt),
      iterations: cipher.iterations,
    },
    base,
    { name: 'AES-GCM', length: 256 },
    true,
    ['decrypt'],
  )
}

async function decrypt(key: CryptoKey): Promise<string> {
  // A wrong password fails GCM's tag check and throws.
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(cipher.iv) },
    key,
    fromB64(cipher.ct),
  )
  return new TextDecoder().decode(plain)
}

// The key, not the password, is kept for the tab's session, so a reload
// doesn't ask again. It's filed under the ciphertext's salt: re-encrypting
// the poem leaves it unused, and the page asks afresh.
const KEY_CACHE = 'poem-key'

async function remember(key: CryptoKey) {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key))
  try {
    sessionStorage.setItem(
      KEY_CACHE,
      JSON.stringify({
        salt: cipher.salt,
        key: btoa(String.fromCharCode(...raw)),
      }),
    )
  } catch {}
}

async function recall(): Promise<CryptoKey | null> {
  let saved: { salt?: string; key?: string } | null = null
  try {
    saved = JSON.parse(sessionStorage.getItem(KEY_CACHE) ?? 'null')
  } catch {}
  if (!saved?.key || saved.salt !== cipher.salt) return null
  return crypto.subtle.importKey('raw', fromB64(saved.key), 'AES-GCM', true, [
    'decrypt',
  ])
}

function forget() {
  try {
    sessionStorage.removeItem(KEY_CACHE)
  } catch {}
}

const MARK = /^@\s*(\S+)(?:\s+(\S+))?\s*$/
const WHEN =
  /^(?:(\d{1,2}):(\d{2})|(sunrise|sunset|moonset))(?:([+-])(\d{1,2}):(\d{2}))?$/

const GAP = /^@\s*gap(?:\s+(\d+(?:\.\d+)?)%)?\s*$/
const END = /^@\s*end(?:\s+(\S+))?\s*$/

/** A <where> as a share of the screen, or null when it isn't one. */
function whereOf(where: string | undefined): number | null {
  if (where === undefined) return WHERE.middle
  const w = where.toLowerCase()
  if (w in WHERE) return WHERE[w]
  const share = /^(\d+(?:\.\d+)?)%$/.exec(w)
  return share ? Number(share[1]) / 100 : null
}

/** A pin's line, or null when it isn't one, so a poem's own `@` stays text. */
function pinOf(row: string): Pin | null {
  const m = MARK.exec(row.trim())
  if (!m || !WHEN.test(m[1])) return null
  const at = whereOf(m[2])
  return at === null ? null : { when: m[1], at }
}

/** The hour a pin names, on this screen. */
function hourOf(when: string, sky: Sky) {
  const m = WHEN.exec(when)
  if (!m) return DEFAULT_START
  const base = m[3] ? sky[m[3] as keyof Sky] : Number(m[1]) + Number(m[2]) / 60
  const off = m[4]
    ? (m[4] === '-' ? -1 : 1) * (Number(m[5]) + Number(m[6]) / 60)
    : 0
  return base + off
}

/** The plaintext as lines, each keeping its leading whitespace; blank lines stay as gaps. */
function parse(src: string): Parsed {
  const rows = src.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n')
  let title: string | undefined
  if (rows[0]?.startsWith('# ')) {
    title = rows.shift()?.slice(2).trim()
    while (rows[0]?.trim() === '') rows.shift()
  }
  const lines: Line[] = []
  let pin: Pin | undefined
  let rest: number | undefined
  for (const row of rows) {
    const e = END.exec(row.trim())
    const at = e ? whereOf(e[1]) : null
    if (at !== null) {
      rest = at
      continue
    }
    const g = GAP.exec(row.trim())
    if (g) {
      lines.push({
        indent: '',
        text: '',
        gap: g[1] ? Number(g[1]) / 100 : 'auto',
      })
      continue
    }
    const p = pinOf(row)
    if (p) {
      pin = p
      continue
    }
    const indent = row.match(/^[ \t]*/)?.[0] ?? ''
    const text = row.slice(indent.length)
    const line: Line = { indent, text }
    if (text && pin) {
      line.pin = pin
      pin = undefined
    }
    if (text && rest !== undefined) {
      line.rest = rest
      rest = undefined
    }
    lines.push(line)
  }
  while (
    lines.length &&
    !lines[lines.length - 1].text &&
    !lines[lines.length - 1].gap
  )
    lines.pop()
  return { title, lines, end: pin }
}

/** `*italic*` and `**bold**`; anything else is as written. */
function inline(text: string) {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/)
    .map((part, i) =>
      part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : part.startsWith('*') && part.endsWith('*') && part.length > 2 ? (
        <em key={i}>{part.slice(1, -1)}</em>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    )
}

type Anchor = { y: number; hour: number }

/** A line's centre, in page px. */
const centreOf = (el: Element) => {
  const b = el.getBoundingClientRect()
  return b.top + window.scrollY + b.height / 2
}

/** Sizes each `@ gap` (see the top of this file), top to bottom. */
function fitGaps(root: HTMLElement) {
  const h = window.innerHeight
  for (const gap of root.querySelectorAll<HTMLElement>('[data-gap]')) {
    // The line just above, and the first line below.
    const lines = [...root.querySelectorAll<HTMLElement>('.poem-line')]
    const above = lines.filter((l) => l.compareDocumentPosition(gap) & 4).at(-1)
    const below = lines.find((l) => gap.compareDocumentPosition(l) & 4)
    if (!above || !below) continue
    const at =
      Number(gap.dataset.gap) || Number(above.dataset.at) || WHERE.middle
    const now = gap.getBoundingClientRect().height
    const top = below.getBoundingClientRect().top + window.scrollY - now
    const want = centreOf(above) + h * (1 - at) - top
    gap.style.height = `${Math.max(0, Math.round(want))}px`
  }
}

/** Room under the poem so the scroll runs out with the last line where the poem asks. */
function fitEnd(poem: Parsed, root: HTMLElement) {
  const last = root.querySelector('.poem-line:last-of-type')
  if (!last) return
  const h = window.innerHeight
  // Where the scroll should run out: the last line no lower than its pin, and
  // an `@ end` line where it asks, if that keeps the last line high enough.
  let stop = centreOf(last) - h * (poem.end?.at ?? END_AT)
  const rest = root.querySelector<HTMLElement>('[data-rest]')
  if (rest)
    stop = Math.max(stop, centreOf(rest) - h * Number(rest.dataset.rest))
  const pad = parseFloat(getComputedStyle(root).paddingBottom) || 0
  const without = document.documentElement.scrollHeight - pad
  root.style.paddingBottom = `${Math.max(0, Math.round(stop + h - without))}px`
}

/**
 * The scroll positions where each pinned line stands where it's pinned, with
 * the hours it names, from the top of the page to its end. Hours only run
 * forward, so a pin earlier on the clock is the next day.
 */
function anchorsFor(poem: Parsed, root: HTMLElement, sky: Sky): Anchor[] {
  fitGaps(root)
  fitEnd(poem, root)
  const max = document.documentElement.scrollHeight - window.innerHeight
  const pins: Anchor[] = []
  for (const el of root.querySelectorAll<HTMLElement>('[data-when]')) {
    const y = centreOf(el) - window.innerHeight * Number(el.dataset.at)
    pins.push({
      y: Math.max(pins.at(-1)?.y ?? 0, Math.min(max, y)),
      hour: hourOf(el.dataset.when ?? '', sky),
    })
  }
  const start = pins[0]?.hour ?? DEFAULT_START
  const all = [{ y: 0, hour: start }, ...pins]
  all.push({ y: max, hour: poem.end ? hourOf(poem.end.when, sky) : start + 24 })
  for (let i = 1; i < all.length; i++)
    while (all[i].hour < all[i - 1].hour) all[i].hour += 24
  // Without a pin at the end, the day comes full circle.
  if (poem.end === undefined)
    all[all.length - 1].hour = Math.max(all[all.length - 1].hour, start + 24)
  return all
}

function hourAt(anchors: Anchor[], y: number) {
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1]
    const b = anchors[i]
    if (y <= b.y || i === anchors.length - 1) {
      const t =
        b.y > a.y ? Math.max(0, Math.min(1, (y - a.y) / (b.y - a.y))) : 1
      return a.hour + (b.hour - a.hour) * t
    }
  }
  return anchors[0].hour
}

type PoemProps = {
  className?: string
  /** The plaintext, in development only (page.tsx), to read without the password. */
  preview?: string
}

export function Poem({ className, preview }: PoemProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const poemRef = useRef<HTMLElement>(null)
  const [poem, setPoem] = useState<Parsed | null>(() =>
    preview === undefined ? null : parse(preview),
  )
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState(false)
  // Whether the session's key has been tried, so the lock doesn't flash up
  // before a poem the tab already opened.
  const [checked, setChecked] = useState(preview !== undefined)
  const inputRef = useRef<HTMLInputElement>(null)
  // When the sun meets the ridges on this screen (mount.ts), and the poem's
  // re-measure, which needs it.
  const skyRef = useRef<Sky>({ sunrise: 6.5, sunset: 18, moonset: 5.5 })
  const remeasureRef = useRef<() => void>(undefined)

  // The meadow, for the whole visit. The hour the visitor had set comes back
  // when they leave, since the poem's scroll sets it as they read.
  useEffect(() => {
    const canvas = canvasRef.current
    const root = rootRef.current
    if (!canvas || !root) return
    let before: string | null = null
    try {
      before = sessionStorage.getItem(HOUR_KEY)
    } catch {}
    const mono = getComputedStyle(document.documentElement)
      .getPropertyValue('--font-geist-mono')
      .trim()
    const unmount = mountGarden({
      canvas,
      root,
      font: mono || 'ui-monospace, Menlo, monospace',
      scrub: false,
      onSky: (sky) => {
        skyRef.current = sky
        remeasureRef.current?.()
      },
    })
    const restore = () => setHour(before === null ? null : Number(before))
    // A reload or a closed tab skips React's cleanup.
    window.addEventListener('pagehide', restore)
    return () => {
      window.removeEventListener('pagehide', restore)
      unmount()
      restore()
    }
  }, [])

  // An edit to the plaintext shows on reload.
  useEffect(() => {
    if (preview !== undefined) setPoem(parse(preview))
  }, [preview])

  // Once open, the scroll sets the hour.
  useEffect(() => {
    const el = poemRef.current
    if (!poem || !el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let anchors = anchorsFor(poem, el, skyRef.current)
    const remeasure = () => (anchors = anchorsFor(poem, el, skyRef.current))
    remeasureRef.current = remeasure
    const sized = new ResizeObserver(remeasure)
    sized.observe(el)
    window.addEventListener('resize', remeasure)
    document.fonts.ready.then(remeasure)

    // Start from the hour on screen and take the short way round to the poem's.
    let shown = currentHour().hour
    const first = hourAt(anchors, window.scrollY)
    shown += Math.round((first - shown) / 24) * 24
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const target = hourAt(anchors, window.scrollY)
      const next = reduced.matches
        ? target
        : shown + (target - shown) * (1 - Math.exp(-EASE * dt))
      if (Math.abs(next - shown) > 1e-4 || Math.abs(target - shown) > 1e-4) {
        shown = Math.abs(target - next) < 1e-3 ? target : next
        setHour(((shown % 24) + 24) % 24)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      sized.disconnect()
      window.removeEventListener('resize', remeasure)
      remeasureRef.current = undefined
    }
  }, [poem])

  // Opened earlier in this tab: open it again without asking.
  useEffect(() => {
    if (checked) return
    let live = true
    recall()
      .then((key) => (key ? decrypt(key) : null))
      .then((text) => {
        if (live && text !== null) setPoem(parse(text))
      })
      .catch(forget)
      .finally(() => live && setChecked(true))
    return () => {
      live = false
    }
  }, [checked])

  useEffect(() => {
    if (checked && !poem) inputRef.current?.focus()
  }, [checked, poem])

  const unlock = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const input = e.currentTarget.elements.namedItem(
      'answer',
    ) as HTMLInputElement
    if (!input.value || busy) return
    setBusy(true)
    setWrong(false)
    try {
      const key = await keyFrom(input.value)
      const text = await decrypt(key)
      await remember(key)
      window.scrollTo(0, 0)
      setPoem(parse(text))
    } catch {
      setWrong(true)
      input.select()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={rootRef} className={`poem-page ${className ?? ''}`}>
      <canvas ref={canvasRef} className="garden-canvas" aria-hidden="true" />
      {/* Safari tints its bars from fixed elements at the window's edges. */}
      <div className="garden-tint garden-tint-top" aria-hidden="true" />
      <div className="garden-tint garden-tint-bottom" aria-hidden="true" />
      {/* The same column locked and open, so only small flowers grow under the text. */}
      <div className="poem-column" data-clear-column>
        {poem ? (
          <article ref={poemRef} className="poem" data-no-sow>
            {poem.title ? <h1 className="poem-title">{poem.title}</h1> : null}
            {poem.lines.map((line, i) =>
              line.gap ? (
                <div
                  key={i}
                  className="poem-room"
                  data-gap={line.gap === 'auto' ? '' : line.gap}
                  aria-hidden
                />
              ) : line.text ? (
                <p
                  key={i}
                  className="poem-line"
                  data-when={line.pin?.when}
                  data-at={line.pin?.at}
                  data-rest={line.rest}
                >
                  {line.indent ? (
                    <span className="poem-indent">{line.indent}</span>
                  ) : null}
                  <span className="poem-text">{inline(line.text)}</span>
                </p>
              ) : (
                <p key={i} className="poem-gap" aria-hidden />
              ),
            )}
          </article>
        ) : (
          <form className="poem-lock" onSubmit={unlock} hidden={!checked}>
            <p className="poem-intro">
              If you want to unlock this page, you need to get past this riddle.
            </p>
            <label htmlFor="poem-answer" className="poem-riddle">
              When something is really easy, you say, &ldquo;That was
              a&nbsp;&hellip;&rdquo;
            </label>
            <input
              ref={inputRef}
              id="poem-answer"
              name="answer"
              type="text"
              className="poem-password"
              placeholder="answer"
              aria-describedby="poem-format"
              aria-invalid={wrong || undefined}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              readOnly={busy}
              onChange={() => setWrong(false)}
            />
            <span id="poem-format" className="poem-format">
              lowercase, hyphenated: like-this
            </span>
            <span className="poem-status" aria-live="polite">
              {busy ? 'opening…' : wrong ? 'not quite' : ''}
            </span>
          </form>
        )}
      </div>
    </div>
  )
}
