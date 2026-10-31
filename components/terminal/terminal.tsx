'use client'
import './terminal.css'

import { Pixelify_Sans } from 'next/font/google'
import { usePathname, useRouter } from 'next/navigation'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'

import {
  currentHour,
  DARK_FROM,
  HOUR_EVENT,
  LIGHT_FROM,
  setHour,
} from '@/lib/circadian'
import { useUiHidden } from '@/lib/hide-ui'
import { meadowHere, sendMeadow } from '@/lib/meadow-control'

import {
  complete,
  hhmm,
  parse,
  pathFor,
  phase,
  routeFor,
  run,
  type Ctx,
} from './commands'

// The terminal: a small one-bit console window that floats over every page
// (design/circadian-meadow/components/Terminal, the desk). It opens from the
// quiet word in the bottom-right corner or the ` key, and stays open as you
// move between pages, since it lives in the layout.

const bitmap = Pixelify_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-bitmap',
})

type Entry =
  | { kind: 'cmd'; path: string; text: string }
  | { kind: 'out'; lines: string[] }
  | { kind: 'boot' }

const PLACES: [string, string][] = [
  ['meadow', '~'],
  ['projects', '~/projects'],
  ['photos', '~/photos'],
  ['writing', '~/writing'],
  ['music', '~/music'],
]
const cdTo = (path: string) => (path === '~' ? 'cd ~' : `cd ${path.slice(2)}`)
const SHEETS: [string, string][] = [
  ['about.txt', 'about'],
  ['resume.pdf', 'resume'],
  ['real-testimonials.txt', 'cat real-testimonials.txt'],
  ['enjoy-your-stay.txt', 'cat enjoy-your-stay.txt'],
  ['waves.exe', './waves.exe'],
  ['fetch', 'fetch'],
]
type Item = [string, string, string?] | null
const MENUS: [string, Item[]][] = [
  [
    'Shell',
    [
      ['Clear', 'clear', '⌃L'],
      ['Fetch', 'fetch'],
      null,
      ['Close', 'exit', '`'],
    ],
  ],
  ['Go', PLACES.map(([n, p]) => [n[0].toUpperCase() + n.slice(1), cdTo(p)])],
  [
    'Meadow',
    [
      ['Follow my clock', 'time now'],
      ['Sunrise', 'time 6:30'],
      ['Sunset', 'time 19:05'],
      ['Midnight', 'time 0:00'],
      null,
      ['Gust', './waves.exe'],
      ['Calm', 'wind 0.05'],
      ['Breezy', 'wind 0.6'],
      null,
      ['Regrow', 'regrow'],
    ],
  ],
  [
    'Help',
    [
      ['Commands', 'help'],
      ['About', 'about'],
      ['Work', 'work'],
      ['Projects', 'projects'],
    ],
  ],
]

const BOOT_KEY = 'terminal-booted'
const LOADING = "Loading Stanley's Portfolio..."
const LOADING_ZH = '正在加載黃士樺的作品集'
const GLITCH = '!@#$%^&*()_+-=[]{}|;:,.<>?~©λ'

const isNight = (h: number) => !(h >= LIGHT_FROM && h < DARK_FROM)

function Line({ text }: { text: string }) {
  return (
    <>
      {parse(text).map(([t, c], i) =>
        c ? (
          <span key={i} className={c}>
            {t}
          </span>
        ) : (
          <Fragment key={i}>{t}</Fragment>
        ),
      )}
      {'\n'}
    </>
  )
}

function Prompt({ path }: { path: string }) {
  return (
    <span className="ps1">
      <span className="u">dev</span>
      <span className="m">@</span>
      <span className="h">stanley-wang</span>
      <span className="m"> {path} $ </span>
    </span>
  )
}

/**
 * The old site's opening, cut to a couple of seconds and told in the meadow's
 * terms: a few kernel lines with the real hour and wind, then the loading line
 * types itself in Chinese and glitches over into English. Any key skips it.
 */
const bootLines = (hour: number, wind: number) => [
  `{m|[ 0.000000]} stanley-wang 26.10 {m|(dev@meadow)}`,
  `{m|[ 0.000412]} mounting {h|/dev/meadow}`,
  `{m|[ 0.001187]} sun at {y|${hhmm(hour)}} {m|· ${phase(hour)}}`,
  `{m|[ 0.001903]} wind {y|${wind.toFixed(2)}}`,
  `{m|[ 0.002260]} seeding the field {g|[ OK ]}`,
]
const HINT = ['{m|type} {g|help} {m|for commands}', '']

function Boot({
  hour,
  wind,
  onDone,
}: {
  hour: number
  wind: number
  onDone: () => void
}) {
  const [lines] = useState(() => bootLines(hour, wind))
  const [shown, setShown] = useState(0)
  const [chars, setChars] = useState<string[]>([])
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    const timers: number[] = []
    const later = (ms: number, f: () => void) =>
      timers.push(window.setTimeout(f, ms))
    lines.forEach((_, i) => later(90 + i * 110, () => setShown(i + 1)))
    const t0 = 90 + lines.length * 110 + 200
    // The Chinese types in, then each character glitches over to the English.
    for (let i = 0; i < LOADING.length; i++) {
      if (i < LOADING_ZH.length)
        later(t0 + i * 40, () =>
          setChars((c) => {
            const n = [...c]
            n[i] = LOADING_ZH[i]
            return n
          }),
        )
      const at = t0 + 700 + i * 22
      for (let g = 0; g < 5; g++)
        later(at + g * 24, () =>
          setChars((c) => {
            const n = [...c]
            n[i] = GLITCH[Math.floor(Math.random() * GLITCH.length)]
            return n
          }),
        )
      later(at + 120, () =>
        setChars((c) => {
          const n = [...c]
          n[i] = LOADING[i]
          return n
        }),
      )
    }
    later(t0 + 700 + LOADING.length * 22 + 600, () => done.current())
    const skip = (e: KeyboardEvent) => {
      if (e.key === '`') return
      done.current()
    }
    window.addEventListener('keydown', skip)
    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener('keydown', skip)
    }
    // Plays once, with the hour it opened on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {lines.slice(0, shown).map((l, i) => (
        <Line key={i} text={l} />
      ))}
      {chars.length > 0 && (
        <>
          {'\n'}
          {chars.join('')}
          <span className="cur" aria-hidden />
          {'\n'}
        </>
      )}
    </>
  )
}

type Rect = { x: number; y: number; w: number; h: number }
const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, w: r.width, h: r.height }
}

export function Terminal() {
  const router = useRouter()
  const pathname = usePathname() ?? '/'
  const uiHidden = useUiHidden()
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const [typed, setTyped] = useState('')
  const [view, setView] = useState<'shell' | 'files'>('shell')
  const [menu, setMenu] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [focused, setFocused] = useState(true)
  const [typing, setTyping] = useState(false)
  const [hour, setHourState] = useState(12)
  const [follow, setFollow] = useState(true)
  const [wind, setWindState] = useState(0.2)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const win = useRef<HTMLElement>(null)
  const word = useRef<HTMLButtonElement>(null)
  const screen = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const history = useRef<string[]>([])
  const hist = useRef({ list: [] as string[], at: 0 })
  const windRef = useRef(0.2)
  const typingTimer = useRef(0)
  const zoomGen = useRef(0)

  const path = pathFor(pathname)

  // The hour, as the rest of the site has it.
  useEffect(() => {
    const read = () => {
      const { hour, set } = currentHour()
      setHourState(hour)
      setFollow(!set)
    }
    read()
    const tick = window.setInterval(read, 60000)
    window.addEventListener(HOUR_EVENT, read)
    return () => {
      clearInterval(tick)
      window.removeEventListener(HOUR_EVENT, read)
    }
  }, [])

  const focusInput = useCallback(
    () => input.current?.focus({ preventScroll: true }),
    [],
  )

  /** A few dotted outlines step from one box to the other, as the old desktops opened a window. */
  const zoom = useCallback((from: Rect, to: Rect, done: () => void) => {
    const gen = ++zoomGen.current
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      return done()
    const n = 5
    let i = 0
    const boxes: HTMLDivElement[] = []
    const step = () => {
      boxes.splice(0).forEach((b) => b.remove())
      if (gen !== zoomGen.current) return
      if (i > n) return done()
      for (let j = Math.max(0, i - 1); j <= i; j++) {
        const t = j / n
        const b = document.createElement('div')
        b.className = 'terminal-zoom'
        Object.assign(b.style, {
          left: `${from.x + (to.x - from.x) * t}px`,
          top: `${from.y + (to.y - from.y) * t}px`,
          width: `${from.w + (to.w - from.w) * t}px`,
          height: `${from.h + (to.h - from.h) * t}px`,
        })
        document.body.appendChild(b)
        boxes.push(b)
      }
      i++
      window.setTimeout(step, 34)
    }
    step()
  }, [])

  const show = useCallback(() => {
    if (open) return focusInput()
    setOpen(true)
    setFocused(true)
    // The boot plays the first time it opens in a visit; after that, just the hint.
    let booted = false
    try {
      booted = sessionStorage.getItem(BOOT_KEY) !== null
      sessionStorage.setItem(BOOT_KEY, '1')
    } catch {}
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    setEntries(
      booted || reduced ? [{ kind: 'out', lines: HINT }] : [{ kind: 'boot' }],
    )
  }, [open, focusInput])

  const hide = useCallback(() => {
    if (!open) return
    if (win.current && word.current)
      zoom(rectOf(win.current), rectOf(word.current), () => {})
    setOpen(false)
    setMenu(null)
    setEntries([])
  }, [open, zoom])

  // Opening: the outlines grow from the corner word to where the window will be.
  useEffect(() => {
    if (!open || !win.current || !word.current) return
    const w = win.current
    w.style.visibility = 'hidden'
    zoom(rectOf(word.current), rectOf(w), () => {
      w.style.visibility = ''
      focusInput()
    })
    focusInput()
  }, [open, zoom, focusInput])

  // ` opens and closes it, anywhere but in a text field other than its own.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '`' || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement
      if (
        t !== input.current &&
        t.closest('input, textarea, [contenteditable="true"]')
      )
        return
      e.preventDefault()
      if (open) hide()
      else show()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, show, hide])

  // Menus close on any click outside them.
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menu])

  // Once the boot is done, the prompt takes the keys.
  const booting = entries.some((e) => e.kind === 'boot')
  useEffect(() => {
    if (open && !booting && view === 'shell') focusInput()
  }, [open, booting, view, focusInput])

  // New output scrolls into view.
  useEffect(() => {
    const s = screen.current
    if (s) s.scrollTop = s.scrollHeight
  }, [entries, open, view])

  const execute = useCallback(
    (text: string, opts: { stay?: boolean } = {}) => {
      if (!open) show()
      const t = text.trim()
      const head = t.split(/\s+/)[0]
      if (head === 'files' || head === 'view') {
        setEntries((e) => [...e, { kind: 'cmd', path, text }])
        setView(
          head === 'files' || t.split(/\s+/)[1] === 'files' ? 'files' : 'shell',
        )
        return
      }
      let cleared = false
      const ctx: Ctx = {
        path,
        hour,
        follow,
        wind: windRef.current,
        history: history.current,
        go: (p) => router.push(routeFor(p)),
        setHour: (h) => {
          setHour(h)
          if (h === null) {
            const now = new Date()
            ctx.hour = now.getHours() + now.getMinutes() / 60
          } else ctx.hour = h
        },
        setWind: (w) => {
          windRef.current = w
          setWindState(w)
          sendMeadow({ kind: 'wind', value: w })
        },
        gust: () => sendMeadow({ kind: 'gust' }),
        regrow: (seed) => sendMeadow({ kind: 'regrow', seed }),
        meadowHere,
        open: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
        copy: (s) => void navigator.clipboard?.writeText(s).catch(() => {}),
        clear: () => (cleared = true),
        close: () => hide(),
      }
      const out = run(text, ctx)
      if (t) {
        hist.current.list.push(text)
        hist.current.at = hist.current.list.length
      }
      if (head === 'exit') return
      if (cleared) setEntries([])
      else
        setEntries((e) => [
          ...e,
          { kind: 'cmd', path, text },
          ...(out.length ? [{ kind: 'out' as const, lines: out }] : []),
        ])
      if (!opts.stay) {
        setView('shell')
        focusInput()
      }
    },
    [open, show, hide, path, hour, follow, router, focusInput],
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const h = hist.current
    if (e.key === 'Enter') {
      const v = typed
      setTyped('')
      execute(v)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      setTyped(complete(typed))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (h.at > 0) setTyped(h.list[--h.at])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (h.at < h.list.length) setTyped(h.list[++h.at] ?? '')
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      setEntries([])
    } else if (e.key === 'Escape') {
      input.current?.blur()
    }
  }

  // Drag by the title bar, kept on screen.
  const onDragStart = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button') || !win.current) return
    const r = rectOf(win.current)
    const sx = e.clientX
    const sy = e.clientY
    let moved = false
    const bar = e.currentTarget as HTMLElement
    bar.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx
      const dy = ev.clientY - sy
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return
      moved = true
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - r.w, r.x + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 30, r.y + dy)),
      })
    }
    const up = () => {
      bar.removeEventListener('pointermove', move)
      bar.removeEventListener('pointerup', up)
    }
    bar.addEventListener('pointermove', move)
    bar.addEventListener('pointerup', up)
  }

  const night = isNight(hour)
  const items = [
    ...PLACES.map(([n, p]) => ({ name: n, folder: true, run: cdTo(p), at: p })),
    ...SHEETS.map(([n, c]) => ({ name: n, folder: false, run: c, at: '' })),
  ]

  return (
    <div
      className={`terminal-root ${bitmap.variable}`}
      data-night={night ? '' : undefined}
    >
      {open && (
        <section
          ref={win}
          className={focused ? 'terminal-win focus' : 'terminal-win'}
          role="dialog"
          aria-label="Terminal"
          style={
            pos
              ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
              : undefined
          }
          onPointerDown={() => setFocused(true)}
          inert={uiHidden}
        >
          <div className="terminal-pane">
            <header className="terminal-tb" onPointerDown={onDragStart}>
              <span className="boxes">
                <button className="box" aria-label="Close" onClick={hide} />
              </span>
              <h2>Terminal{path !== '~' && <i> — {path.slice(2)}</i>}</h2>
            </header>

            <nav className="terminal-menu" aria-label="Terminal menu">
              {MENUS.map(([name, list]) => (
                <div key={name}>
                  <button
                    aria-expanded={menu === name}
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenu(menu === name ? null : name)
                    }}
                  >
                    {name}
                  </button>
                  {menu === name && (
                    <ul className="drop">
                      {list.map((it, i) => (
                        <li key={i}>
                          {it ? (
                            <button
                              onClick={() => {
                                setMenu(null)
                                execute(it[1])
                              }}
                            >
                              {it[0]}
                              {it[2] && <span>{it[2]}</span>}
                            </button>
                          ) : (
                            <hr />
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              <span className="views">
                <button
                  aria-pressed={view === 'shell'}
                  onClick={() => setView('shell')}
                >
                  Shell
                </button>
                <button
                  aria-pressed={view === 'files'}
                  onClick={() => setView('files')}
                >
                  Files
                </button>
              </span>
            </nav>

            <div className="terminal-info">
              <span>
                {view === 'files' ? `${items.length} items  ·  ${path}` : path}
              </span>
              <span>{`${phase(hour)}  ·  wind ${wind.toFixed(2)}`}</span>
            </div>

            <div className="terminal-body">
              {view === 'shell' ? (
                <div
                  ref={screen}
                  className="terminal-screen well"
                  onMouseUp={() => {
                    if (!getSelection()?.toString()) focusInput()
                  }}
                >
                  <pre className="out" aria-live="polite">
                    {entries.map((e, i) =>
                      e.kind === 'boot' ? (
                        <Boot
                          key={i}
                          hour={hour}
                          wind={wind}
                          onDone={() =>
                            setEntries((all) =>
                              all.map((x) =>
                                x.kind === 'boot'
                                  ? {
                                      kind: 'out',
                                      lines: [
                                        ...bootLines(hour, wind),
                                        '',
                                        LOADING,
                                        '',
                                        ...HINT,
                                      ],
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                      ) : e.kind === 'cmd' ? (
                        <Fragment key={i}>
                          <Prompt path={e.path} />
                          {e.text}
                          {'\n'}
                        </Fragment>
                      ) : (
                        <Fragment key={i}>
                          {e.lines.map((l, j) => (
                            <Line key={j} text={l} />
                          ))}
                        </Fragment>
                      ),
                    )}
                  </pre>
                  {!entries.some((e) => e.kind === 'boot') && (
                    <div className={typing ? 'line typing' : 'line'}>
                      <Prompt path={path} />
                      <span className="typed">{typed}</span>
                      <span className="cur" aria-hidden />
                      <input
                        ref={input}
                        aria-label="Command"
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        value={typed}
                        onChange={(e) => {
                          setTyped(e.target.value)
                          setTyping(true)
                          clearTimeout(typingTimer.current)
                          typingTimer.current = window.setTimeout(
                            () => setTyping(false),
                            500,
                          )
                        }}
                        onKeyDown={onKeyDown}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="terminal-files well"
                  role="listbox"
                  aria-label="Files"
                  onClick={() => setSelected(null)}
                >
                  <svg width="0" height="0" className="absolute" aria-hidden>
                    <pattern
                      id="terminal-dither"
                      width="2"
                      height="2"
                      patternUnits="userSpaceOnUse"
                    >
                      <rect width="2" height="2" fill="var(--k-paper)" />
                      <rect width="1" height="1" fill="var(--k-ink)" />
                    </pattern>
                  </svg>
                  {items.map((it) => {
                    const on =
                      selected === it.name || (it.folder && it.at === path)
                    const go = () =>
                      it.folder
                        ? execute(it.run, { stay: true })
                        : execute(it.run)
                    return (
                      <button
                        key={it.name}
                        role="option"
                        aria-selected={selected === it.name}
                        data-open={on ? '' : undefined}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelected(it.name)
                        }}
                        onDoubleClick={go}
                        onKeyDown={(e) => e.key === 'Enter' && go()}
                      >
                        {it.folder ? (
                          <svg viewBox="0 0 40 34" aria-hidden>
                            <path
                              className="f"
                              d="M1.5 6.5 V32.5 H38.5 V8.5 H18.5 L15.5 3.5 H4.5 L1.5 6.5 Z"
                            />
                            <path
                              className="l"
                              d="M1.5 10.5 H38.5"
                              fill="none"
                            />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 40 34" aria-hidden>
                            <path
                              className="f"
                              d="M9.5 0.5 H25 L30.5 6 V33.5 H9.5 Z"
                            />
                            <path
                              className="l"
                              d="M25 0.5 V6 H30.5 M13.5 12.5 H26.5 M13.5 16.5 H26.5 M13.5 20.5 H26.5 M13.5 24.5 H21.5"
                              fill="none"
                            />
                          </svg>
                        )}
                        <span>{it.name}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <footer className="terminal-status">
              <span>dev@stanley-wang</span>
              <span className="fill" />
              <span className="clock">
                {hhmm(hour)}
                {night ? '  ☾' : '  ☼'}
              </span>
              <span className="grow" />
            </footer>
          </div>
        </section>
      )}
      <button
        ref={word}
        className="terminal-word"
        aria-pressed={open}
        onClick={() => (open ? hide() : show())}
        data-avoid
      >
        terminal
      </button>
    </div>
  )
}
