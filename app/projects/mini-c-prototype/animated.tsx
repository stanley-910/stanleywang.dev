'use client'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  explain,
  instructionHover,
  nodeHover,
  registerHover,
  tokenKind,
  LEXEMES,
} from './explain'
import { findReference, REFERENCES } from './reference'
import {
  buildTrace,
  colouredUpTo,
  instructionText,
  liveAfterSweep,
  type Token,
  treePositions,
} from './trace'
import '@/app/styles/markdown.css'
import './animated.css'

const examples = REFERENCES.map((r) => ({ name: r.name, source: r.source }))
const phases = ['Tokens', 'Parse', 'Check', 'Emit', 'Registers'] as const
const phaseLabels = ['tokens', 'parse', 'check', 'emit', 'regs']
const speeds = [0.5, 1, 1.5, 2]
const KEEP_HIDDEN = ['int', '(', ')', '{', '}', ';', '=', ',']
const HOVER_DELAY = 250
// Stage geometry: pieces live in a 680 × 480 viewBox stretched over the scene,
// but their text is fixed-size CSS pixels, so layout works in pixels.
const VIEW_W = 680
const CHAR_PX = 7.2
const EDGE_PX = 24
// Advance of one character in the 11px token card.
const CARD_CHAR_PX = 6.6
// Line height of the source editor; matches --row on .ac-source.
const SOURCE_ROW = 19
const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]
// Fill colours for the interference graph, one per physical register in use.
const INK = [
  '#2563eb',
  '#d97706',
  '#059669',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
]

// Explanation strings mark code with backticks.
function Prose({ text }: { text: string }) {
  return (
    <>
      {text
        .split('`')
        .map((part, i) =>
          i % 2 ? <code key={i}>{part}</code> : <span key={i}>{part}</span>,
        )}
    </>
  )
}

// A token step: its sentence, then every lexeme in its class, the token's own
// lexeme highlighted.
function StepNote({ text, token }: { text: string; token?: Token }) {
  const lexemes = token ? LEXEMES[token.kind] : []
  return (
    <>
      <Prose text={text} />
      {token && lexemes.length > 0 && (
        <ul className="ac-lexemes" aria-label="Lexemes in this class">
          {lexemes.map((lexeme) => (
            <li key={lexeme} className={lexeme === token.text ? 'current' : ''}>
              {lexeme}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

const INDENT = '  '

// Replace [start, end) through the browser's own editing, so undo still works
// and React sees an ordinary input event.
function replaceRange(
  area: HTMLTextAreaElement,
  start: number,
  end: number,
  text: string,
) {
  area.setSelectionRange(start, end)
  if (!document.execCommand('insertText', false, text))
    area.setRangeText(text, start, end, 'end')
}

// Tab / Shift+Tab indent and outdent the selected lines; Enter keeps the
// current indent, adding a level after `{`; `}` on a blank line outdents.
function editorKey(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
  const area = event.currentTarget
  const { value, selectionStart: start, selectionEnd: end } = area
  const lineStart = value.lastIndexOf('\n', start - 1) + 1

  if (event.key === 'Tab') {
    event.preventDefault()
    if (!event.shiftKey && start === end) {
      replaceRange(area, start, end, INDENT)
      return
    }
    const blockEnd = end > start && value[end - 1] === '\n' ? end - 1 : end
    const nextBreak = value.indexOf('\n', blockEnd)
    const lineEnd = nextBreak === -1 ? value.length : nextBreak
    const lines = value.slice(lineStart, lineEnd).split('\n')
    const changed = lines.map((line) =>
      event.shiftKey
        ? line.replace(new RegExp(`^ {1,${INDENT.length}}`), '')
        : INDENT + line,
    )
    const firstShift = changed[0].length - lines[0].length
    const totalShift = changed.join('\n').length - (lineEnd - lineStart)
    replaceRange(area, lineStart, lineEnd, changed.join('\n'))
    area.setSelectionRange(
      Math.max(lineStart, start + firstShift),
      Math.max(lineStart, end + totalShift),
    )
    return
  }

  if (event.key === 'Enter' && !event.shiftKey && !event.metaKey) {
    event.preventDefault()
    const indent = /^[ \t]*/.exec(value.slice(lineStart, start))?.[0] ?? ''
    const opens = value.slice(lineStart, start).trimEnd().endsWith('{')
    const closes = value.slice(end).trimStart().startsWith('}')
    const inner = opens ? indent + INDENT : indent
    if (opens && closes && !value.slice(end).split('\n')[0].trim().slice(1)) {
      replaceRange(area, start, end, `\n${inner}\n${indent}`)
      area.setSelectionRange(start + 1 + inner.length, start + 1 + inner.length)
    } else {
      replaceRange(area, start, end, `\n${inner}`)
    }
    return
  }

  if (event.key === '}' && start === end) {
    const before = value.slice(lineStart, start)
    if (before.length >= INDENT.length && !before.trim()) {
      event.preventDefault()
      replaceRange(area, start - INDENT.length, end, '}')
    }
  }
}

// A shallow chevron (about 140° at the tip) as two cubic segments, so the
// closed and open shapes interpolate point for point. Between them it passes
// through a wriggle and pulls in, then draws back out, like a tree edge
// shooting to its child.
const CHEVRON = {
  closed: 'M4 1 C4.5 2.33 5 3.67 5.5 5 C5 6.33 4.5 7.67 4 9',
  wriggle: 'M2 5.5 C3 3 4 8 5 5 C6 2 7 7 8 4.5',
  open: 'M1 4 C2.33 4.5 3.67 5 5 5.5 C6.33 5 7.67 4.5 9 4',
}

function Chevron({ open }: { open: boolean }) {
  const still = useReducedMotion()
  const to = open ? CHEVRON.open : CHEVRON.closed
  const from = open ? CHEVRON.closed : CHEVRON.open
  return (
    <svg className="ac-chevron" viewBox="0 0 10 10" aria-hidden="true">
      <motion.path
        initial={false}
        animate={
          still
            ? { d: to, pathLength: 1 }
            : { d: [from, CHEVRON.wriggle, to], pathLength: [1, 0.3, 1] }
        }
        transition={{
          duration: still ? 0 : 0.55,
          // Accelerate into the wriggle and ease out of it, so the middle
          // shape is passed through rather than paused on.
          times: [0, 0.35, 1],
          ease: [[0.55, 0, 0.9, 0.45], EASE],
        }}
      />
    </svg>
  )
}

const SCRAMBLE = 'abcdefghijklmnopqrstuvwxyz'

// Text that morphs into its next value: the length steps one letter per tick
// (growing leftward, shrinking rightward, as the label is right-aligned) and
// each letter cycles through random ones before settling, left to right.
function MorphText({ text }: { text: string }) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(text)
  const current = useRef(text)
  useEffect(() => {
    const from = current.current
    if (reduced || from === text) {
      current.current = text
      setShown(text)
      return
    }
    const grow = Math.sign(text.length - from.length)
    const steps = Math.abs(text.length - from.length)
    let tick = 0
    const id = window.setInterval(() => {
      tick++
      const length = from.length + grow * Math.min(tick, steps)
      let next = ''
      for (let i = 0; i < length; i++) {
        const settled = tick >= 3 + i && i < text.length
        next +=
          settled || text[i] === ' '
            ? text[i]
            : SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)]
      }
      current.current = next
      setShown(next)
      if (next === text) window.clearInterval(id)
    }, 40)
    return () => window.clearInterval(id)
  }, [text, reduced])
  return (
    <span className="ac-morph" aria-label={text}>
      {shown}
    </span>
  )
}

// The preset menu. A native <select> opens an OS-styled list, so this is a
// small listbox instead: arrows move, Enter picks, Escape closes.
function Picker({
  label,
  options,
  value,
  placeholder,
  onChange,
}: {
  label: string
  options: string[]
  value: number
  placeholder: string
  onChange: (index: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!open) return
    list.current?.focus()
    const away = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', away)
    return () => window.removeEventListener('pointerdown', away)
  }, [open])

  const show = () => {
    setActive(Math.max(0, value))
    setOpen(true)
  }
  const pick = (index: number) => {
    setOpen(false)
    button.current?.focus()
    if (index !== value) onChange(index)
  }

  return (
    <div className="ac-picker" ref={root}>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            event.stopPropagation()
            show()
          }
        }}
      >
        <Chevron open={open} />
        <MorphText text={value >= 0 ? options[value] : placeholder} />
      </button>
      {open && (
        <ul
          ref={list}
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          aria-activedescendant={`ac-pick-${active}`}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'ArrowDown' || event.key === 'j') {
              event.preventDefault()
              setActive((a) => Math.min(options.length - 1, a + 1))
            } else if (event.key === 'ArrowUp' || event.key === 'k') {
              event.preventDefault()
              setActive((a) => Math.max(0, a - 1))
            } else if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              pick(active)
            } else if (event.key === 'Escape' || event.key === 'Tab') {
              event.preventDefault()
              setOpen(false)
              button.current?.focus()
            }
          }}
        >
          {options.map((option, i) => (
            <li
              key={option}
              id={`ac-pick-${i}`}
              role="option"
              aria-selected={i === value}
              className={i === active ? 'active' : ''}
              onPointerEnter={() => setActive(i)}
              onClick={() => pick(i)}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function AnimatedCompiler() {
  const [source, setSource] = useState(examples[0].source)
  const reference = useMemo(() => findReference(source), [source])
  // Presets play the compiler's own frames; typed sketches use the toy recorder.
  const trace = useMemo(
    () => reference?.trace ?? buildTrace(source),
    [source, reference],
  )
  // The longest-worded token step of each class, for sizing the step panel.
  const tallestTokenSteps = useMemo(() => {
    const best = new Map<Token['kind'], { text: string; token: Token }>()
    for (const f of trace.frames) {
      if (f.why.kind !== 'token') continue
      const token = trace.tokens[f.why.token]
      const text = explain(trace, f)
      const seen = best.get(token.kind)
      if (!seen || text.length > seen.text.length)
        best.set(token.kind, { text, token })
    }
    return [...best.values()]
  }, [trace])
  const tree = useMemo(
    () => treePositions(trace, (n) => n.label.length * CHAR_PX + 2),
    [trace],
  )
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [hover, setHover] = useState<number | null>(null)
  const [hoverToken, setHoverToken] = useState<number | null>(null)
  // Clicking a token toggles class lists on every token card until clicked again.
  const [cardOpen, setCardOpen] = useState(false)
  const [hoverIns, setHoverIns] = useState<number | null>(null)
  const [hoverVr, setHoverVr] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const instructionRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const [sceneWidth, setSceneWidth] = useState(VIEW_W)
  const reduced = useReducedMotion()
  const index = Math.min(step, trace.frames.length - 1)
  const frame = trace.frames[index]
  const last = trace.frames.length - 1
  const end = index === last
  const error = end ? trace.error : undefined
  const hoverNode = hover === null || playing ? undefined : trace.nodes[hover]
  const hoverTok =
    hoverToken === null || playing ? undefined : trace.tokens[hoverToken]
  const activeSpan = hoverNode || hoverTok || error || frame.span

  const clearHover = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = null
    setHover(null)
    setHoverToken(null)
    setHoverIns(null)
    setHoverVr(null)
  }, [])
  // Hover waits a beat so passing the pointer over the diagram stays quiet.
  const hoverSoon = useCallback((node: number | undefined, token: number) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => {
      if (node === undefined) setHoverToken(token)
      else setHover(node)
    }, HOVER_DELAY)
  }, [])

  const seek = useCallback(
    (target: number) => {
      setPlaying(false)
      clearHover()
      setStep(Math.max(0, Math.min(last, target)))
    },
    [last, clearHover],
  )
  const move = useCallback(
    (delta: number) => seek(index + delta),
    [seek, index],
  )
  const play = useCallback(() => {
    setEditing(false)
    clearHover()
    if (end) setStep(0)
    setPlaying((p) => !p)
  }, [end, clearHover])
  const jumpPhase = useCallback(
    (phase: (typeof phases)[number]) => {
      const at = trace.frames.findIndex((f) => f.phase === phase)
      if (at >= 0) seek(at)
    },
    [trace.frames, seek],
  )
  const bumpSpeed = useCallback((delta: number) => {
    setSpeed((s) => {
      const at = speeds.indexOf(s)
      return speeds[Math.max(0, Math.min(speeds.length - 1, at + delta))]
    })
  }, [])

  // ?example=loop&frame=65 opens a state directly, and the address bar
  // follows the stage so a marked-up screen names the state it shows.
  const [linked, setLinked] = useState(false)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const example = examples.find(
      (e) => e.name.toLowerCase() === q.get('example'),
    )
    if (example) setSource(example.source)
    const at = Number(q.get('frame'))
    if (at > 0) setStep(at)
    setLinked(true)
  }, [])
  useEffect(() => {
    if (!linked || playing) return
    const url = new URL(window.location.href)
    const example = examples.find((e) => e.name === reference?.name)
    if (example) url.searchParams.set('example', example.name.toLowerCase())
    else url.searchParams.delete('example')
    url.searchParams.set('frame', String(index))
    window.history.replaceState(null, '', url)
  }, [linked, playing, reference, index])

  useEffect(() => {
    if (!playing) return
    if (end) {
      setPlaying(false)
      return
    }
    const timer = setTimeout(
      () => setStep((s) => s + 1),
      (frame.phase === 'Tokens' ? 380 : 680) / speed,
    )
    return () => clearTimeout(timer)
  }, [playing, end, index, speed, frame.phase])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('input,textarea,select,[contenteditable]')) {
        if (event.key === 'Escape') textRef.current?.blur()
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key
      if (event.code === 'Space' && !target?.closest('button,summary')) {
        event.preventDefault()
        play()
      } else if (key === 'h' || key === 'k') move(-1)
      else if (key === 'l' || key === 'j') move(1)
      else if (key === 'r') seek(0)
      else if (key === 'e') textRef.current?.focus()
      else if (key === '-') bumpSpeed(-1)
      else if (key === '=' || key === '+') bumpSpeed(1)
      else if (/^[1-5]$/.test(key)) jumpPhase(phases[Number(key) - 1])
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [move, play, seek, bumpSpeed, jumpPhase])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const observer = new ResizeObserver(([entry]) =>
      setSceneWidth(entry.contentRect.width || VIEW_W),
    )
    observer.observe(scene)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const pane = scrollRef.current
    if (pane && !editing)
      pane.scrollTop = Math.max(
        0,
        (source.slice(0, activeSpan.start).split('\n').length - 3) * SOURCE_ROW,
      )
  }, [activeSpan.start, source, editing])

  useEffect(() => {
    const pane = instructionRef.current
    const rows = pane?.querySelectorAll<HTMLElement>('.current')
    const current = rows?.[rows.length - 1]
    if (pane && current)
      pane.scrollTop = Math.max(0, current.offsetTop - pane.clientHeight + 40)
  }, [frame.instructionCount, frame.allocationCount, index])

  const update = (text: string) => {
    setSource(text)
    setStep(0)
    setPlaying(false)
    clearHover()
  }

  const late = frame.phase === 'Emit' || frame.phase === 'Registers'
  // Presets carry the real allocator's working; the Registers phase then
  // shows its interference graph instead of the tree.
  const backend = trace.backend
  const w = frame.why
  const regView = frame.phase === 'Registers' && backend !== undefined
  const fnIndex =
    'fn' in w && typeof w.fn === 'number'
      ? w.fn
      : backend
        ? backend.functions.length - 1
        : 0
  const stepIndex = 'step' in w ? w.step : w.kind === 'reg.done' ? Infinity : -1
  const coloured =
    backend && frame.phase === 'Registers'
      ? colouredUpTo(backend, fnIndex, stepIndex)
      : undefined
  const live =
    backend && w.kind === 'reg.live'
      ? liveAfterSweep(backend, w.fn, w.sweep)
      : undefined
  const changed = new Set<number>()
  if (backend && w.kind === 'reg.live') {
    const f = backend.functions[w.fn]
    const sw = f.liveness.find((x) => x.sweep === w.sweep)
    if (sw && 'changes' in sw)
      for (const c of sw.changes) changed.add(f.first + c.block)
  }
  const currentRange: [number, number] | null =
    w.kind === 'emit.instr' ||
    w.kind === 'emit.prologue' ||
    w.kind === 'emit.epilogue'
      ? [w.from, w.to]
      : 'at' in w && w.at !== null
        ? [w.at, w.at]
        : null
  const graphFn = regView ? backend.functions[fnIndex] : undefined
  const graphSteps = graphFn ? graphFn.colouring.steps : []
  const graphShown = regView && w.kind !== 'reg.cfg' && w.kind !== 'reg.live'
  const onStack = new Set<string>()
  const spilled = new Set<string>()
  for (let i = 0; i < graphSteps.length && i <= stepIndex; i++) {
    const st = graphSteps[i]
    if (st.op === 'simplify' || st.op === 'spillCandidate') onStack.add(st.vr)
    else onStack.delete(st.vr)
    if (st.op === 'spill') spilled.add(st.vr)
  }
  const stepVr = graphFn && 'step' in w ? graphSteps[w.step]?.vr : undefined
  const paletteIndex = (r: string) => backend?.palette.indexOf(r) ?? -1
  const graphPoint = (vr: string) => {
    const names = graphFn?.interference.nodes ?? []
    const i = names.indexOf(vr)
    const n = names.length
    const radius = n <= 6 ? 90 : n <= 12 ? 120 : 150
    const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2
    return { x: 172 + Math.cos(a) * radius, y: 235 + Math.sin(a) * radius }
  }
  const parsed = frame.phase !== 'Tokens'
  const transition = {
    duration: reduced ? 0 : 0.42 / speed,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  }
  // Late phases share the stage with the instruction list on the right half.
  const unit = VIEW_W / sceneWidth
  const treeRoom = (late ? sceneWidth * 0.46 : sceneWidth) - EDGE_PX * 2
  const treeWidth = tree.width * (late ? 11 / 12 : 1)
  // Spread a small tree out, shrink a wide one; shrinking scales text too.
  const spread = Math.min(treeRoom / treeWidth, 3)
  const fit = Math.min(1, spread)
  const treeLeft = EDGE_PX + (treeRoom - treeWidth * spread) / 2
  const point = (id: number) => {
    const p = tree.at[id] ?? { x: tree.width / 2, y: tree.depth }
    const x = (treeLeft + p.x * (late ? 11 / 12 : 1) * spread) * unit
    const y = 210 + (p.y / Math.max(1, tree.depth)) * 235
    return late
      ? { x, y: 60 + (y - 210) * 1.3 }
      : frame.phase === 'Check'
        ? { x, y: y - 110 }
        : { x, y }
  }
  const owners = new Map(frame.nodes.map((id) => [trace.nodes[id].token, id]))
  const shownInstructions = trace.instructions.slice(0, frame.instructionCount)
  const tokenPoints: Record<number, { x: number; y: number }> = {}
  let tokenX = 20,
    tokenY = 30
  const tray = trace.tokens.filter(
    (t) =>
      !parsed ||
      (!owners.has(t.id) &&
        !(frame.consumed.includes(t.id) && KEEP_HIDDEN.includes(t.text))),
  )
  for (const t of tray) {
    const width = Math.min(560, (t.text.length * CHAR_PX + 18) * unit)
    if (tokenX + width > VIEW_W - 20) {
      tokenX = 20
      tokenY += 34
    }
    tokenPoints[t.id] = { x: tokenX + width / 2, y: tokenY }
    tokenX += width + 6 * unit
  }
  const scanningRow = tokenPoints[Math.max(0, frame.tokenCount - 1)]?.y || 30
  const trayOffset = parsed ? 0 : Math.max(0, scanningRow - 98)
  const lines = source.split('\n')
  const line = source.slice(0, activeSpan.start).split('\n').length
  const hoverText = hoverNode
    ? nodeHover(trace, frame, hoverNode)
    : hoverIns !== null && !playing
      ? instructionHover(
          trace,
          trace.instructions[hoverIns],
          live?.[hoverIns],
          coloured ??
            (frame.phase === 'Registers' ? trace.registers : undefined),
        )
      : hoverVr !== null && !playing
        ? registerHover(trace, fnIndex, hoverVr, coloured?.[hoverVr])
        : undefined
  // Hovers replace the step text in the panel rather than float on the stage,
  // so nothing on screen says the same thing twice.
  const statusText = error
    ? error.message
    : hoverText
      ? 'hover'
      : index === 0
        ? 'press space to compile your code!'
        : frame.why.kind === 'token'
          ? `Token: \`${trace.tokens[frame.why.token].text}\``
          : frame.title
  const noteText = hoverText ?? explain(trace, frame)
  // A token step lists every lexeme in its class under the explanation.
  const stepToken =
    !hoverText && !error && frame.why.kind === 'token'
      ? trace.tokens[frame.why.token]
      : undefined
  // A token's card sits beside it on the stage; the panel keeps the step.
  const tokenCard =
    hoverTok && hoverTok.id < frame.tokenCount
      ? tokenPoints[hoverTok.id]
      : undefined
  // Closed, the card is just the class, centred under the token. Open, it
  // grows right and down to the full class list, its label nudged left.
  // Widths are exact because the text is monospace.
  const clampLeft = (left: number, width: number) =>
    Math.max(8, Math.min(left, sceneWidth - width - 8))
  const cardAt = tokenCard &&
    hoverTok && {
      closed: (() => {
        const width = tokenKind(hoverTok).length * CARD_CHAR_PX + 22
        return { left: clampLeft(tokenCard.x / unit - width / 2, width), width }
      })(),
      y: tokenCard.y - trayOffset,
    }
  const openWidth = Math.min(260, sceneWidth - 16)
  const cardBox =
    cardAt &&
    (cardOpen
      ? {
          left: clampLeft(cardAt.closed.left - 12, openWidth),
          width: openWidth,
        }
      : cardAt.closed)

  return (
    <section className="ac" data-phase={frame.phase.toLowerCase()}>
      <header className="ac-top">
        <nav className="ac-phases" aria-label="Compiler phases">
          {phases.map((phase, i) => (
            <button
              key={phase}
              className={frame.phase === phase ? 'active' : ''}
              disabled={!trace.frames.some((f) => f.phase === phase)}
              onClick={() => jumpPhase(phase)}
            >
              0{i + 1} {phaseLabels[i]}
            </button>
          ))}
        </nav>
        <details className="ac-about">
          <summary>about</summary>
          <div>
            <p>
              Step through step by step, seeing a brief depiction of how your
              code gets compiled into target machine code. This visualization is
              a port of the functionality I implemented for my compiler&apos;s
              class I took last winter,{' '}
              <a
                href="https://www.cs.mcgill.ca/~cs520/2026/"
                target="_blank"
                rel="noopener noreferrer"
                className="prose-link"
              >
                COMP520
              </a>{' '}
              at McGill University, taught by the lovely Christophe Dubach.
            </p>
          </div>
        </details>
      </header>

      <div className="ac-work">
        <section className="ac-editor" aria-label="Source editor">
          <div className="ac-bar">
            <span className="ac-file">main.c</span>
            <Picker
              label="Example program"
              options={examples.map((e) => e.name.toLowerCase())}
              value={examples.findIndex((e) => e.name === reference?.name)}
              placeholder="custom"
              onChange={(i) => update(examples[i].source)}
            />
          </div>
          <div
            className="ac-source"
            data-editing={editing}
            ref={scrollRef}
            onClick={(e) => {
              if (e.target === e.currentTarget) textRef.current?.focus()
            }}
          >
            <div className="ac-gutter" aria-hidden="true">
              {lines.map((_, i) => (
                <span key={i} className={i + 1 === line ? 'active' : ''}>
                  {i + 1}
                </span>
              ))}
            </div>
            <div className="ac-text">
              {!editing && (
                <pre aria-label="Highlighted source">
                  <code>
                    {source.slice(0, activeSpan.start)}
                    <mark className={error ? 'err' : ''}>
                      {source.slice(activeSpan.start, activeSpan.end)}
                    </mark>
                    {source.slice(activeSpan.end)}
                  </code>
                </pre>
              )}
              <textarea
                ref={textRef}
                aria-label="Edit C source"
                value={source}
                rows={lines.length}
                spellCheck={false}
                onFocus={() => {
                  setEditing(true)
                  setPlaying(false)
                }}
                onBlur={() => setEditing(false)}
                onChange={(e) => update(e.target.value)}
                onKeyDown={editorKey}
              />
            </div>
          </div>
          {trace.error && (
            <button className="ac-diag" onClick={() => seek(last)}>
              <span>error</span> {trace.error.message}
            </button>
          )}
          <section
            className={`ac-note ${error ? 'err' : ''}`}
            aria-label="Current step"
            aria-live={playing ? 'off' : 'polite'}
          >
            <div className="ac-bar">
              <span className="ac-note-title">
                <Prose text={statusText} />
              </span>
            </div>
            <div className="ac-note-body">
              {frame.phase === 'Tokens' ? (
                // Hidden layers hold the tallest step of each token class in
                // the same grid cell, so the panel keeps one height while
                // stepping through tokens and only grows if even that won't fit.
                <div className="ac-note-stack">
                  <div className="ac-note-layer">
                    <StepNote text={noteText} token={stepToken} />
                  </div>
                  {tallestTokenSteps.map((v) => (
                    <div
                      key={v.token.kind}
                      className="ac-note-layer ghost"
                      aria-hidden="true"
                    >
                      <StepNote text={v.text} token={v.token} />
                    </div>
                  ))}
                </div>
              ) : (
                <Prose text={noteText} />
              )}
            </div>
          </section>
        </section>

        <section className="ac-stage" aria-label="Animated compiler stage">
          <div className="ac-scene" ref={sceneRef}>
            <svg
              className="ac-edges"
              preserveAspectRatio="none"
              viewBox="0 0 680 480"
              aria-hidden="true"
            >
              <AnimatePresence>
                {!regView &&
                  frame.nodes.flatMap((id) => {
                    const n = trace.nodes[id],
                      p = point(id)
                    return n.children
                      .filter((child) => frame.attached.includes(child))
                      .map((child) => {
                        const q = point(child)
                        const r = 11 * fit
                        const d = `M ${p.x} ${p.y + r} C ${p.x} ${(p.y + q.y) / 2}, ${q.x} ${(p.y + q.y) / 2}, ${q.x} ${q.y - r}`
                        return (
                          <motion.path
                            key={`${id}-${child}`}
                            d={d}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1}
                            vectorEffect="non-scaling-stroke"
                            initial={{ d, pathLength: 0, opacity: 0 }}
                            animate={{
                              d,
                              pathLength: 1,
                              opacity: frame.focus === id ? 1 : 0.45,
                            }}
                            exit={{ pathLength: 0, opacity: 0 }}
                            transition={transition}
                          />
                        )
                      })
                  })}
                {!regView &&
                  (frame.links ?? []).map(([use, decl]) => {
                    const p = point(use),
                      q = point(decl)
                    const lift = 28 + Math.abs(p.x - q.x) * 0.12
                    const d = `M ${p.x} ${p.y - 11} C ${p.x} ${p.y - 11 - lift}, ${q.x} ${q.y - 11 - lift}, ${q.x} ${q.y - 11}`
                    return (
                      <motion.path
                        key={`link-${use}-${decl}`}
                        className="ac-link"
                        d={d}
                        fill="none"
                        strokeWidth={1}
                        vectorEffect="non-scaling-stroke"
                        initial={{ d, pathLength: 0, opacity: 0 }}
                        animate={{
                          d,
                          pathLength: 1,
                          opacity:
                            frame.focus === use || hover === use ? 1 : 0.55,
                        }}
                        exit={{ pathLength: 0, opacity: 0 }}
                        transition={transition}
                      />
                    )
                  })}
              </AnimatePresence>
            </svg>
            <AnimatePresence>
              {!regView &&
                trace.tokens.slice(0, frame.tokenCount).map((token) => {
                  const nodeId = owners.get(token.id)
                  const node =
                    nodeId === undefined ? undefined : trace.nodes[nodeId]
                  const consumed = frame.consumed.includes(token.id)
                  if (
                    parsed &&
                    consumed &&
                    !node &&
                    KEEP_HIDDEN.includes(token.text)
                  )
                    return null
                  const tokenPoint = tokenPoints[token.id] || { x: 340, y: 30 }
                  const p = node
                    ? point(node.id)
                    : { x: tokenPoint.x, y: tokenPoint.y - trayOffset }
                  if (!node && (p.y < 8 || p.y > 150)) return null
                  const focused = node
                    ? frame.focus === node.id || hover === node.id
                    : token.start === frame.span.start
                  const pending =
                    node !== undefined &&
                    node.children.some(
                      (child) => !frame.attached.includes(child),
                    )
                  return (
                    <motion.button
                      key={`token-${token.id}`}
                      style={{ x: '-50%', y: '-50%' }}
                      className={`ac-piece ${node ? 'node' : 'token'} kind-${token.kind} ${focused ? 'focused' : ''} ${pending ? 'pending' : ''} ${late ? 'small' : ''}`}
                      initial={{
                        left: '-5%',
                        top: (Math.min(tokenPoint.y, 98) / 480) * 100 + '%',
                        opacity: 0,
                      }}
                      animate={{
                        left: (p.x / 680) * 100 + '%',
                        top: (p.y / 480) * 100 + '%',
                        scale: node ? fit : 1,
                        opacity: 1,
                      }}
                      exit={{ opacity: 0 }}
                      transition={transition}
                      onMouseEnter={() =>
                        !playing && hoverSoon(node?.id, token.id)
                      }
                      onMouseLeave={clearHover}
                      onFocus={() => hoverSoon(node?.id, token.id)}
                      onBlur={clearHover}
                      onClick={() => {
                        setPlaying(false)
                        if (node) setHover(node.id)
                        else {
                          setHoverToken(token.id)
                          setCardOpen((open) => !open)
                        }
                      }}
                      aria-label={
                        node
                          ? `AST ${node.kind}: ${node.label}`
                          : `Token ${token.text}, ${tokenKind(token)}`
                      }
                    >
                      {node ? node.label : token.text}
                      {!parsed && focused && <small>{tokenKind(token)}</small>}
                    </motion.button>
                  )
                })}
            </AnimatePresence>
            {hoverTok && cardAt && cardBox && (
              <motion.div
                key={hoverTok.id}
                className="ac-hover"
                style={{ top: `${(cardAt.y / 480) * 100}%` }}
                initial={false}
                animate={cardBox}
                transition={{ duration: reduced ? 0 : 0.22, ease: EASE }}
              >
                {tokenKind(hoverTok)}
                <AnimatePresence initial={false}>
                  {cardOpen && (
                    <motion.div
                      className="ac-hover-list"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: reduced ? 0 : 0.22, ease: EASE }}
                    >
                      <ul
                        className="ac-lexemes"
                        aria-label="Lexemes in this class"
                        style={{ width: openWidth - 22 }}
                      >
                        {LEXEMES[hoverTok.kind].map((lexeme) => (
                          <li
                            key={lexeme}
                            className={
                              lexeme === hoverTok.text ? 'current' : ''
                            }
                          >
                            {lexeme}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
            {graphFn && (
              <svg
                className="ac-graph"
                viewBox="0 0 680 480"
                preserveAspectRatio="none"
                aria-label="Interference graph"
              >
                <AnimatePresence>
                  {graphShown &&
                    graphFn.interference.edges.map(([a, b]) => {
                      const p = graphPoint(a),
                        q = graphPoint(b)
                      const gone = onStack.has(a) || onStack.has(b)
                      return (
                        <motion.line
                          key={`ig-${a}-${b}`}
                          x1={p.x}
                          y1={p.y}
                          x2={q.x}
                          y2={q.y}
                          stroke="currentColor"
                          strokeWidth={1}
                          vectorEffect="non-scaling-stroke"
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{
                            pathLength: 1,
                            opacity: gone ? 0.12 : 0.6,
                          }}
                          exit={{ opacity: 0 }}
                          transition={transition}
                        />
                      )
                    })}
                </AnimatePresence>
              </svg>
            )}
            <AnimatePresence>
              {graphFn &&
                graphShown &&
                graphFn.interference.nodes.map((vr) => {
                  const p = graphPoint(vr)
                  const colour = coloured?.[vr]
                  const idx = colour ? paletteIndex(colour) : -1
                  return (
                    <motion.button
                      key={`vr-${vr}`}
                      className={`ac-vr ${vr === stepVr ? 'focused' : ''} ${onStack.has(vr) ? 'aside' : ''} ${spilled.has(vr) ? 'spilled' : ''}`}
                      style={{
                        x: '-50%',
                        y: '-50%',
                        background: colour ? INK[idx % INK.length] : undefined,
                        color: colour ? '#fff' : undefined,
                      }}
                      initial={{
                        opacity: 0,
                        left: `${(p.x / 680) * 100}%`,
                        top: `${(p.y / 480) * 100}%`,
                      }}
                      animate={{
                        opacity: onStack.has(vr) ? 0.35 : 1,
                        left: `${(p.x / 680) * 100}%`,
                        top: `${(p.y / 480) * 100}%`,
                      }}
                      exit={{ opacity: 0 }}
                      transition={transition}
                      onMouseEnter={() => !playing && setHoverVr(vr)}
                      onMouseLeave={clearHover}
                      onFocus={() => setHoverVr(vr)}
                      onBlur={clearHover}
                      aria-label={`Virtual register ${vr}${colour ? `, now ${colour}` : ''}`}
                    >
                      {vr}
                      {colour && <small>{colour}</small>}
                    </motion.button>
                  )
                })}
            </AnimatePresence>
            {late && (
              <motion.div
                className="ac-asm"
                ref={instructionRef}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={transition}
              >
                <div className="ac-label">
                  {frame.phase === 'Registers'
                    ? '; physical registers'
                    : '; virtual registers'}
                </div>
                <AnimatePresence>
                  {shownInstructions.map((ins, i) => {
                    const current = currentRange
                      ? i >= currentRange[0] && i <= currentRange[1]
                      : (i === shownInstructions.length - 1 &&
                          frame.phase === 'Emit') ||
                        (!backend && i === frame.allocationCount - 1)
                    const registers =
                      frame.phase !== 'Registers'
                        ? undefined
                        : (coloured ??
                          (i < frame.allocationCount
                            ? trace.registers
                            : undefined))
                    return (
                      <motion.div
                        className={`ac-ins ${current ? 'current' : ''} ${changed.has(i) ? 'changed' : ''}`}
                        key={`instruction-${i}`}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={transition}
                        onMouseEnter={() => !playing && setHoverIns(i)}
                        onMouseLeave={clearHover}
                      >
                        {ins.labels?.map((l) => <em key={l}>{l}:</em>)}
                        <span>{String(i + 1).padStart(2, '0')}</span>
                        <code>{instructionText(ins, registers)}</code>
                        {live?.[i] && (
                          <small>{live[i].out.join(' ') || '·'}</small>
                        )}
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
                {frame.phase === 'Registers' && !backend && (
                  <div className="ac-regs">
                    {Object.entries(trace.registers)
                      .filter(([v]) =>
                        trace.instructions
                          .slice(0, frame.allocationCount)
                          .some((ins) => ins.dest === v),
                      )
                      .map(([v, r]) => (
                        <motion.span
                          key={v}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={transition}
                        >
                          {v}→{r}
                        </motion.span>
                      ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>
          <div className="ac-status">
            <span className="ac-counter">
              {String(index).padStart(2, '0')}/{String(last).padStart(2, '0')}
            </span>
          </div>
        </section>
      </div>

      <footer className="ac-keys" aria-label="Controls">
        <button onClick={play} className={playing ? 'on' : ''}>
          <kbd>spc</kbd>
          {playing ? 'pause' : 'play'}
        </button>
        <span className="ac-step">
          <button onClick={() => move(-1)} disabled={index === 0}>
            <kbd>h</kbd>
          </button>
          <button onClick={() => move(1)} disabled={index === last}>
            <kbd>l</kbd>step
          </button>
        </span>
        <button onClick={() => seek(0)}>
          <kbd>r</kbd>reset
        </button>
        <button onClick={() => bumpSpeed(1)}>
          <kbd>-</kbd>
          <kbd>+</kbd>
          {speed}×
        </button>
        <input
          aria-label="Animation step"
          type="range"
          min={0}
          max={last}
          value={index}
          style={
            { '--p': `${last ? (index / last) * 100 : 0}%` } as CSSProperties
          }
          onChange={(e) => seek(Number(e.target.value))}
        />
      </footer>
    </section>
  )
}
