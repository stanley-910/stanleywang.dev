'use client'
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type MotionStyle,
} from 'motion/react'
import {
  type CSSProperties,
  Fragment,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { detailTrace } from './detail'
import { withEmitBlocks } from './emit-view'
import {
  explain,
  instructionHover,
  nodeHover,
  registerHover,
  tokenKind,
  PHASE_SLIDES,
  STEP_SLIDES,
  type Slide,
  lexemesOf,
  matchTable,
  type TokenClass,
} from './explain'
import { linkRouter, type Box, type Route } from './link-route'
import { NameLinks } from './name-links'
import { replayedParse } from './parse-replay'
import { groupsOf, parentsOf, parseView } from './parse-view'
import { compileReal, compilerLoaded, REAL_MAX_CHARS } from './real'
import { findReference, REFERENCES } from './reference'
import { badgesAt, regBadges } from './reg-badges'
import { scopePanelBox } from './scope-panel'
import { ScopeTree } from './scope-tree'
import { scopesOf, withNameSteps } from './scopes'
import { StackColumn } from './stack-column'
import { stackFrames } from './stack-view'
import { packTray, treeRows } from './stage-layout'
import {
  buildTrace,
  colouredUpTo,
  instructionText,
  liveAdded,
  liveAfterSweep,
  type Frame,
  type Token,
  type Trace,
  treePositions,
} from './trace'
import '@/app/styles/markdown.css'
import './animated.css'

const examples = REFERENCES.map((r) => ({ name: r.name, source: r.source }))
type Phase = Frame['phase']
// The tabs: the check phase shows as its two passes, names then types.
const tabs = [
  { label: 'lexer', phase: 'Tokens' },
  { label: 'parser', phase: 'Parse' },
  { label: 'semantics', phase: 'Check' },
  { label: 'types', phase: 'Check', types: true },
  { label: 'emit', phase: 'Emit' },
  { label: 'regs', phase: 'Registers' },
] as const
const TYPE_KINDS = [
  'check.type',
  'check.expr',
  'check.fits',
  'check.typesDone',
] as const
const isTypeStep = (f: Frame) =>
  (TYPE_KINDS as readonly string[]).includes(f.why.kind)
const speeds = [0.5, 1, 1.5, 2]
const KEEP_HIDDEN = ['int', '(', ')', '{', '}', ';', '=', ',']
const HOVER_DELAY = 250
// Stage geometry: pieces live in a 680 × 480 viewBox stretched over the scene,
// but their text is fixed-size CSS pixels, so layout works in pixels.
const VIEW_W = 680
const VIEW_H = 480
const CHAR_PX = 7.2
// A type badge's characters (10px).
const TYPE_PX = 6
const EDGE_PX = 24
// Advance of one character in the 11px token card.
const CARD_CHAR_PX = 6.6
// Line height of the source editor; matches --row on .ac-source.
const SOURCE_ROW = 19
// The emit pane's rows and stack words, one to one with the editor's.
const ASM_ROW = SOURCE_ROW
// A dragged source height, kept per browser.
const SPLIT_KEY = 'mini-c-split'
const SPLIT_MIN = SOURCE_ROW * 3 + 8
const WIDTH_KEY = 'mini-c-editor-width'
// The editor column's range when its border with the stage is dragged; the
// stage keeps at least STAGE_MIN.
const EDITOR_MIN = 240
const STAGE_MIN = 360
// Scrollbars turned off in the options menu, per browser.
const BARE_KEY = 'mini-c-no-scrollbars'
const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]
// The allocator's stack, down the stage's left edge in the Registers phase.
const PILE_W = 46
// Colours for the interference graph, one per physical register in use.
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

// Outside code: [text](url) links, **bold**, and *italic* (letters on both
// inner edges, so a lone `*` operator in prose stays literal).
const INLINE = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[A-Za-z][^*]*[A-Za-z]\*)/

// Explanation strings mark code with backticks.
function Prose({ text }: { text: string }) {
  return (
    <>
      {text.split('`').map((part, i) =>
        i % 2 ? (
          <code key={i}>{part}</code>
        ) : (
          <span key={i}>
            {part.split(INLINE).map((run, j) => {
              const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(run)
              if (link)
                return (
                  <a
                    key={j}
                    className="prose-link"
                    href={link[2]}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link[1]}
                  </a>
                )
              if (/^\*\*.+\*\*$/.test(run))
                return <strong key={j}>{run.slice(2, -2)}</strong>
              if (/^\*.+\*$/.test(run))
                return <em key={j}>{run.slice(1, -1)}</em>
              return run
            })}
          </span>
        ),
      )}
    </>
  )
}

// A token step: its sentence, then every lexeme in its class, the token's own
// lexeme highlighted.
function StepNote({ text, token }: { text: string; token?: Token }) {
  const lexemes = token ? lexemesOf(token) : []
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

// Detailed lexer mode: every class's lexemes, lit while the characters read
// so far could still become one; on a token's last character only the class
// it becomes is marked.
function CharTable({ read, final }: { read: string; final?: TokenClass }) {
  return (
    // aria-hidden: it sits in the live step note, and the sentence above it
    // already says what matches.
    <table className="ac-char-table" aria-hidden="true">
      <tbody>
        {matchTable(read, final).map((row) => (
          <tr key={row.cls} className={row.match}>
            <th>{row.cls}</th>
            <td>
              {row.lexemes.map((l) => (
                <code key={l.text} className={l.match}>
                  {l.text}
                </code>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Detailed lexer mode inserts steps. `toBase` maps its frames back to the
// plain trace's, so switching the mode keeps the place.
function layered(
  base: Trace,
  source: string,
  lexer: boolean,
): { trace: Trace; toBase: (number | null)[] } {
  if (!lexer) return { trace: base, toBase: base.frames.map((_, i) => i) }
  const { trace, origin } = detailTrace(base, source)
  return { trace, toBase: origin }
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
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const rows = useRef<(HTMLLIElement | null)[]>([])
  // Rows only have offsets once the list is on screen; render the mark after.
  const [measured, setMeasured] = useState(false)
  useLayoutEffect(() => setMeasured(open), [open])

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
          {/* One shallow chevron that slides to whichever row is active. */}
          {measured && (
            <motion.svg
              className="ac-pick-mark"
              viewBox="0 0 10 10"
              aria-hidden="true"
              initial={false}
              animate={{ y: rows.current[active]?.offsetTop ?? 0 }}
              transition={{ duration: reduced ? 0 : 0.18, ease: EASE }}
            >
              <path d="M4 1 L5.5 5 L4 9" />
            </motion.svg>
          )}
          {options.map((option, i) => (
            <li
              ref={(el) => {
                rows.current[i] = el
              }}
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
  // Typed programs go through the real compiler in a worker (real.ts); the
  // teaching compiler covers the wait and any failure.
  const [real, setReal] = useState<{ source: string; trace: Trace } | null>(
    null,
  )
  // The last source the real compiler gave up on; until then the teaching
  // compiler's errors are held back, as the real trace may replace them.
  const [realFailed, setRealFailed] = useState<string | null>(null)
  const realPending =
    !reference &&
    real?.source !== source &&
    realFailed !== source &&
    source.length <= REAL_MAX_CHARS
  // Presets play the compiler's recorded frames, with the parse steps
  // rebuilt in the parser's own order (parse-replay.ts says why) and a name
  // step for each assignment target (scopes.ts).
  // Emit in blocks (emit-view.ts); off shows a step per node, as before.
  const [emitBlocks, setEmitBlocks] = useState(true)
  const namedTrace = useMemo(() => {
    const recorded = reference?.trace ?? (real?.source === source && real.trace)
    return recorded
      ? { trace: withNameSteps(replayedParse(recorded)), recorded: true }
      : { trace: buildTrace(source), recorded: false }
  }, [source, reference, real])
  const withEmit = useCallback(
    (blocks: boolean) =>
      blocks && namedTrace.recorded
        ? withEmitBlocks(namedTrace.trace)
        : namedTrace.trace,
    [namedTrace],
  )
  const baseTrace = useMemo(() => withEmit(emitBlocks), [withEmit, emitBlocks])
  // Detailed lexer mode reads a character per step instead of a token.
  const [detailed, setDetailed] = useState(false)
  // Step titles over the explanation; off while Stanley reads without them.
  const [titles, setTitles] = useState(false)
  // The footer's "?" menu, which holds the view switches.
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!moreOpen) return
    const away = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [moreOpen])
  const view = useMemo(
    () => layered(baseTrace, source, detailed),
    [baseTrace, source, detailed],
  )
  const trace = view.trace
  // The longest-worded token step of each class, for sizing the step panel.
  const tallestTokenSteps = useMemo(() => {
    const best = new Map<string, { text: string; token: Token }>()
    for (const f of trace.frames) {
      if (f.why.kind !== 'token') continue
      const token = trace.tokens[f.why.token]
      const text = explain(trace, f, titles)
      const seen = best.get(tokenKind(token))
      if (!seen || text.length > seen.text.length)
        best.set(tokenKind(token), { text, token })
    }
    return [...best.values()]
  }, [trace, titles])
  const baseTree = useMemo(
    () => treePositions(trace, (n) => n.label.length * CHAR_PX + 2),
    [trace],
  )
  const parents = useMemo(() => parentsOf(trace), [trace])
  // Emit in blocks: each function's stack frame, and a comment row naming
  // the source line over the first block from it (as objdump -S does).
  const stacks = useMemo(() => stackFrames(trace), [trace])
  const asmHeads = useMemo(() => {
    const heads = new Map<number, string>()
    const all = trace.text ?? ''
    const lineAt = (at: number) => all.slice(0, at).split('\n').length - 1
    const lineText = (n: number) => {
      const t = all.split('\n')[n]?.trim() ?? ''
      return t.length > 26 ? `${t.slice(0, 25)}…` : t
    }
    let previous = -1
    for (const f of trace.frames) {
      const w = f.why
      if (w.kind === 'emit.prologue' || w.kind === 'emit.epilogue') {
        heads.set(w.from, w.kind === 'emit.prologue' ? 'prologue' : 'epilogue')
        previous = -1
      } else if (w.kind === 'emit.instr') {
        const n = trace.nodes[w.node]
        // A loop's jump back belongs to its closing brace.
        const back =
          n.kind === 'while' && trace.instructions[w.from]?.op === 'j'
        const line = lineAt(back ? n.end - 1 : n.start)
        if (line !== previous && !heads.has(w.from))
          heads.set(w.from, lineText(line))
        previous = line
      }
    }
    return heads
  }, [trace])
  const groups = useMemo(() => groupsOf(trace.frames), [trace])
  const scopes = useMemo(() => scopesOf(trace), [trace])
  // The name pass ends here; the scope tree is shown up to it.
  const namesDoneAt = useMemo(
    () => trace.frames.findIndex((f) => f.why.kind === 'check.namesDone'),
    [trace],
  )
  // The step each declaration goes into its scope; from there to the end
  // of the name pass it keeps a tint.
  const declaredStep = useMemo(() => {
    const at = new Map<number, number>()
    trace.frames.forEach((f, i) => {
      if (f.why.kind === 'check.declare') at.set(f.why.decl, i)
    })
    return at
  }, [trace])
  // Type pass: the step each node gets its type, and the type. From there
  // to the end of the check phase it shows beside the node.
  const typedStep = useMemo(() => {
    const at = new Map<number, { type: string; step: number }>()
    trace.frames.forEach((f, i) => {
      if (f.why.kind !== 'check.expr' && f.why.kind !== 'check.fits') return
      for (const [id, type] of f.why.typed)
        if (!at.has(id)) at.set(id, { type, step: i })
    })
    return at
  }, [trace])
  // What a return must match, named by its function: `main: int`. The
  // function is out of sight up the tree; a condition's rule (int) is only
  // in the step text.
  // It stays after its check, settled (or red), with the step it was
  // checked on.
  const returnNeed = useMemo(() => {
    const need = new Map<number, { text: string; step: number; ok: boolean }>()
    trace.frames.forEach((f, step) => {
      if (f.why.kind !== 'check.fits' || f.why.rule !== 'return') return
      let at: number | undefined = f.why.node
      while (at !== undefined && trace.nodes[at].kind !== 'function')
        at = parents.get(at)
      if (at !== undefined)
        need.set(f.why.node, {
          text: `${trace.nodes[at].label}: ${f.why.expected}`,
          step,
          ok: f.why.ok,
        })
    })
    return need
  }, [trace, parents])
  // A function's own type, `(int) → int`, read off its declaration: what
  // comes before its name, and its parameters (declarations before the
  // body's `{`). It is known before the body is checked, so it shows from
  // the type pass's first step inside the function and stays.
  const functionType = useMemo(() => {
    const out = new Map<number, { type: string; step: number }>()
    for (const fn of trace.nodes) {
      if (fn.kind !== 'function') continue
      const name = trace.tokens[fn.token]
      const body = trace.tokens.find((t) => t.id > fn.token && t.text === '{')
      const result = trace.tokens
        .filter((t) => t.start >= fn.start && t.id < fn.token)
        .map((t) => t.text)
        .join('')
      const params = fn.children
        .map((c) => trace.nodes[c])
        .filter((c) => c.kind === 'declare' && (!body || c.token < body.id))
        .map((c) => c.label.slice(0, c.label.lastIndexOf(' ')).trim())
      const step = trace.frames.findIndex(
        (f) =>
          (f.why.kind === 'check.type' ||
            f.why.kind === 'check.expr' ||
            f.why.kind === 'check.fits') &&
          f.span.start >= fn.start &&
          f.span.end <= fn.end,
      )
      if (!name || !result || step < 0) continue
      out.set(fn.id, { type: `(${params.join(', ')}) → ${result}`, step })
    }
    return out
  }, [trace])
  // What a call's arguments must match, its function's signature:
  // `twice: (int) → int`. A parameter's type is written out, never worked
  // out; the arguments are what get derived and checked against it.
  const callNeed = useCallback(
    (id: number) => {
      const n = trace.nodes[id]
      if (n.kind !== 'call') return undefined
      const name = n.label.replace(/\(\)$/, '')
      const fn = trace.nodes.find(
        (f) => f.kind === 'function' && f.label === name,
      )
      const sig = fn && functionType.get(fn.id)
      return sig ? `${name}: ${sig.type}` : undefined
    },
    [trace, functionType],
  )
  // Room for each node's type badge (or what a return must match), in tree
  // units. The type pass lays the tree out with it from its first step, so
  // badges don't jump the tree as they appear.
  const badgeRoom = useMemo(() => {
    const room = new Map<number, number>()
    const fit = (id: number, text: string) =>
      room.set(id, Math.max(room.get(id) ?? 0, text.length * TYPE_PX + 13))
    for (const [id, { type }] of typedStep) fit(id, type)
    for (const [id, { text }] of returnNeed) fit(id, text)
    for (const [id, { type }] of functionType) fit(id, type)
    for (const n of trace.nodes) {
      const sig = callNeed(n.id)
      if (sig) fit(n.id, sig)
    }
    return room
  }, [trace, typedStep, returnNeed, functionType, callNeed])
  const typedTree = useMemo(
    () =>
      treePositions(
        trace,
        (n) => n.label.length * CHAR_PX + 2 + (badgeRoom.get(n.id) ?? 0),
      ),
    [trace, badgeRoom],
  )
  // Emit: the register each node leaves behind (reg-badges.ts), with room
  // for it beside the node from the phase's first step.
  const regs = useMemo(() => regBadges(trace.instructions), [trace])
  const regRoom = useMemo(() => {
    const room = new Map<number, number>()
    for (const b of regs)
      room.set(
        b.node,
        Math.max(room.get(b.node) ?? 0, b.reg.length * TYPE_PX + 13),
      )
    return room
  }, [regs])
  const regTree = useMemo(
    () =>
      treePositions(
        trace,
        (n) => n.label.length * CHAR_PX + 2 + (regRoom.get(n.id) ?? 0),
      ),
    [trace, regRoom],
  )
  // The step a name was found to have no declaration; from there on, in
  // the check phase, it keeps a red tint.
  const missingStep = useMemo(() => {
    const at = new Map<number, number>()
    trace.frames.forEach((f, i) => {
      if (f.why.kind === 'check.unresolved') at.set(f.why.use, i)
    })
    return at
  }, [trace])
  // Name-link routes, worked out once per step and stage size (below).
  const routeCache = useRef<{
    trace: Trace
    key: string
    routes: Map<string, Route>
  } | null>(null)
  // Once parsing starts, a `*` that multiplies waits in the tray as the `×`
  // the tree will show; a prefix `*` stays as typed.
  const times = useMemo(
    () =>
      new Set(
        trace.nodes
          .filter((n) => n.kind === 'binary' && n.label === '×')
          .map((n) => n.token),
      ),
    [trace],
  )
  const [step, setStep] = useState(0)
  // A phase's slides sit on the frame before its first step (the lexer's on
  // the welcome), and a pass's before its first step; `slide` counts through
  // them, 0 meaning the frame itself.
  const [slide, setSlide] = useState(0)
  const decks = useMemo(() => {
    const at = new Map<number, { phase: Phase; slides: Slide[] }>()
    for (const [phase, slides] of Object.entries(PHASE_SLIDES)) {
      const first = trace.frames.findIndex(
        (f) => f.phase === phase && f.why.kind !== 'ready',
      )
      if (first > 0 && slides)
        at.set(first - 1, { phase: phase as Phase, slides })
    }
    for (const { phase, starts, slides } of STEP_SLIDES) {
      const first = trace.frames.findIndex(
        (f, i) => i > 0 && f.phase === phase && starts(f, trace.frames[i - 1]),
      )
      if (first > 0 && !at.has(first - 1)) at.set(first - 1, { phase, slides })
    }
    return at
  }, [trace.frames])
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
  // The source's height once its border with the note has been dragged;
  // null lets the note grow up into it as it needs.
  const [sourceHeight, setSourceHeight] = useState<number | null>(null)
  const drag = useRef<{ y: number; height: number; max: number } | null>(null)
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(SPLIT_KEY))
      if (saved > 0) setSourceHeight(saved)
    } catch {}
  }, [])
  const saveSplit = (height: number | null) => {
    setSourceHeight(height)
    try {
      if (height === null) localStorage.removeItem(SPLIT_KEY)
      else localStorage.setItem(SPLIT_KEY, String(Math.round(height)))
    } catch {}
  }
  // The editor column's width once its border with the stage has been
  // dragged; null keeps the stylesheet's width for the screen size.
  const [editorWidth, setEditorWidth] = useState<number | null>(null)
  const widthDrag = useRef<{ x: number; width: number; max: number } | null>(
    null,
  )
  const workRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(WIDTH_KEY))
      if (saved > 0) setEditorWidth(saved)
    } catch {}
  }, [])
  // Scrollbars off: panes scroll by wheel, touch or keys, and keep only
  // the dashed rail as a hint (animated.css, `.ac.bare`).
  const [bare, setBare] = useState(false)
  useEffect(() => {
    try {
      setBare(localStorage.getItem(BARE_KEY) === '1')
    } catch {}
  }, [])
  const saveBare = (on: boolean) => {
    setBare(on)
    try {
      if (on) localStorage.setItem(BARE_KEY, '1')
      else localStorage.removeItem(BARE_KEY)
    } catch {}
  }
  // A scrollbar's thumb shows while its pane is scrolled by hand, and while
  // the pointer is on the scrollbar, but not when a step scrolls the pane
  // (the assembly follows the current row) or the pane is only hovered.
  // An attribute rather than a class, so a render doesn't clear it.
  const rootRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const timers = new Map<Element, ReturnType<typeof setTimeout>>()
    const reveal = (pane: Element, ms: number) => {
      pane.setAttribute('data-reveal', '')
      clearTimeout(timers.get(pane))
      timers.set(
        pane,
        setTimeout(() => pane.removeAttribute('data-reveal'), ms),
      )
    }
    const paneOf = (target: EventTarget | null) => {
      for (
        let el = target instanceof Element ? target : null;
        el && root.contains(el);
        el = el.parentElement
      ) {
        const style = getComputedStyle(el)
        const scrolls =
          (/auto|scroll/.test(style.overflowY) &&
            el.scrollHeight > el.clientHeight) ||
          (/auto|scroll/.test(style.overflowX) &&
            el.scrollWidth > el.clientWidth)
        if (scrolls) return el
      }
      return null
    }
    const scrolled = (e: Event) => {
      const pane = paneOf(e.target)
      if (pane) reveal(pane, 900)
    }
    const moved = (e: PointerEvent) => {
      const pane = paneOf(e.target)
      if (!pane) return
      // The scrollbar is what lies past the pane's client area.
      const box = pane.getBoundingClientRect()
      const onBar =
        e.clientX > box.left + pane.clientLeft + pane.clientWidth ||
        e.clientY > box.top + pane.clientTop + pane.clientHeight
      if (onBar) reveal(pane, 600)
    }
    root.addEventListener('wheel', scrolled, { passive: true })
    root.addEventListener('touchmove', scrolled, { passive: true })
    root.addEventListener('pointermove', moved)
    return () => {
      root.removeEventListener('wheel', scrolled)
      root.removeEventListener('touchmove', scrolled)
      root.removeEventListener('pointermove', moved)
      for (const t of timers.values()) clearTimeout(t)
    }
  }, [])
  const saveWidth = (width: number | null) => {
    setEditorWidth(width)
    try {
      if (width === null) localStorage.removeItem(WIDTH_KEY)
      else localStorage.setItem(WIDTH_KEY, String(Math.round(width)))
    } catch {}
  }
  const widthRange = () => {
    const work = workRef.current
    const editor = work?.querySelector('.ac-editor')
    if (!work || !editor) return null
    return {
      width: editor.getBoundingClientRect().width,
      max: Math.max(EDITOR_MIN, work.getBoundingClientRect().width - STAGE_MIN),
    }
  }
  const clampWidth = (width: number, max: number) =>
    Math.min(max, Math.max(EDITOR_MIN, width))
  // The note keeps at least a few lines under the dragged border.
  const splitRange = () => {
    const pane = scrollRef.current
    const editor = pane?.parentElement
    if (!pane || !editor) return null
    const above = pane.getBoundingClientRect().top
    const bottom = editor.getBoundingClientRect().bottom
    return {
      height: pane.getBoundingClientRect().height,
      max: Math.max(SPLIT_MIN, bottom - above - 72),
    }
  }
  const clampSplit = (height: number, max: number) =>
    Math.min(max, Math.max(SPLIT_MIN, height))
  const textRef = useRef<HTMLTextAreaElement>(null)
  const instructionRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const [sceneWidth, setSceneWidth] = useState(VIEW_W)
  const [sceneHeight, setSceneHeight] = useState(VIEW_H)
  // The phone layout's smaller pieces (animated.css, max-width 640px).
  const [narrow, setNarrow] = useState(false)
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
  const hovering = !!(hoverNode || hoverTok || error)
  const cursor =
    !hovering && frame.why.kind === 'lex.char' ? frame.why.at : undefined

  const clearHover = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = null
    setHover(null)
    setHoverToken(null)
    setHoverIns(null)
    setHoverVr(null)
  }, [])
  useEffect(() => {
    if (reference) return
    const abort = new AbortController()
    const timer = setTimeout(() => {
      compileReal(source, abort.signal).then(
        (trace) => {
          // A different trace: start it from the top, as an edit does.
          setReal({ source, trace })
          setStep(0)
          setSlide(0)
          clearHover()
        },
        (error: Error) => {
          if (error.message === 'aborted') return
          setRealFailed(source)
          console.warn('real compiler:', error.message)
        },
      )
    }, 250)
    return () => {
      clearTimeout(timer)
      abort.abort()
    }
  }, [source, reference, clearHover])
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
      // Like play, stepping waits for the real trace, which starts at 0.
      if (realPending) return
      setPlaying(false)
      clearHover()
      setSlide(0)
      setStep(Math.max(0, Math.min(last, target)))
    },
    [last, clearHover, realPending],
  )
  // Stepping walks through a phase's slides before its first step, and
  // stepping back from that step lands on the last slide.
  const move = useCallback(
    (delta: number) => {
      if (realPending) return
      const deck = decks.get(index)
      const before = decks.get(index - 1)
      if (deck && slide + delta >= 0 && slide + delta <= deck.slides.length) {
        setPlaying(false)
        clearHover()
        setSlide(slide + delta)
      } else if (before && delta < 0 && slide === 0) {
        seek(index - 1)
        setSlide(before.slides.length)
      } else seek(index + delta)
    },
    [seek, index, slide, clearHover, decks, realPending],
  )
  const play = useCallback(() => {
    // The real trace would replace this one mid-play and restart it.
    if (realPending) return
    setEditing(false)
    clearHover()
    if (end) setStep(0)
    // Space compiles straight away; the slides are for stepping.
    setSlide(0)
    setPlaying((p) => !p)
  }, [end, clearHover, realPending])
  const jumpPhase = useCallback(
    (phase: Phase) => {
      // Phases after the lexer open on their first slide.
      // The phase's own deck is its earliest; later ones open its passes.
      const deck = [...decks]
        .sort(([a], [b]) => a - b)
        .find(([, d]) => d.phase === phase)
      if (deck && phase !== 'Tokens') {
        seek(deck[0])
        setSlide(1)
        return
      }
      const at = trace.frames.findIndex((f) => f.phase === phase)
      if (at >= 0) seek(at)
    },
    [trace.frames, seek, decks],
  )
  // The types tab opens on the Type Analysis slide, on the name pass's
  // last step, or on the first type step without one.
  const jumpTab = useCallback(
    (tab: (typeof tabs)[number]) => {
      if (!('types' in tab)) return jumpPhase(tab.phase)
      const done = trace.frames.findIndex(
        (f) => f.why.kind === 'check.namesDone',
      )
      if (done >= 0 && decks.get(done)?.phase === 'Check') {
        seek(done)
        setSlide(1)
        return
      }
      const at = trace.frames.findIndex(isTypeStep)
      if (at >= 0) seek(at)
    },
    [trace.frames, seek, decks, jumpPhase],
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
    if (q.get('lexer') === 'detailed') setDetailed(true)
    if (q.get('titles') === 'on') setTitles(true)
    if (q.get('emit') === 'log') setEmitBlocks(false)
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
    if (detailed) url.searchParams.set('lexer', 'detailed')
    else url.searchParams.delete('lexer')
    // Detailed parser mode is gone; old links drop its parameter.
    url.searchParams.delete('parser')
    if (titles) url.searchParams.set('titles', 'on')
    else url.searchParams.delete('titles')
    if (emitBlocks) url.searchParams.delete('emit')
    else url.searchParams.set('emit', 'log')
    url.searchParams.set('frame', String(index))
    window.history.replaceState(null, '', url)
  }, [linked, playing, reference, index, detailed, titles, emitBlocks])

  useEffect(() => {
    if (!playing) return
    if (end) {
      setPlaying(false)
      return
    }
    const timer = setTimeout(
      () => setStep((s) => s + 1),
      (frame.why.kind === 'lex.char' || frame.why.kind === 'lex.skip'
        ? 160
        : frame.why.kind === 'check.namesDone' && frame.links?.length
          ? reduced
            ? 680
            : 420 * (1 + (frame.links.length - 1) * 0.25) + 3250 * speed
          : frame.phase === 'Tokens'
            ? 380
            : 680) / speed,
    )
    return () => clearTimeout(timer)
  }, [
    playing,
    end,
    index,
    speed,
    reduced,
    frame.phase,
    frame.why.kind,
    frame.links,
  ])

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
      else if (/^[1-6]$/.test(key)) jumpTab(tabs[Number(key) - 1])
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [move, play, seek, bumpSpeed, jumpTab])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const observer = new ResizeObserver(([entry]) => {
      setSceneWidth(entry.contentRect.width || VIEW_W)
      setSceneHeight(entry.contentRect.height || VIEW_H)
      setNarrow(window.matchMedia('(max-width: 640px)').matches)
    })
    observer.observe(scene)
    return () => observer.disconnect()
  }, [])

  // Keep the active line third from the top, and again whenever the source
  // is resized (a tall note shrinks it mid-token).
  useEffect(() => {
    const pane = scrollRef.current
    if (!pane || editing) return
    const row = source.slice(0, activeSpan.start).split('\n').length
    const scroll = () => {
      pane.scrollTop = Math.max(0, (row - 3) * SOURCE_ROW)
    }
    scroll()
    const observer = new ResizeObserver(scroll)
    observer.observe(pane)
    return () => observer.disconnect()
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
    setSlide(0)
    setPlaying(false)
    clearHover()
  }

  const late = frame.phase === 'Emit' || frame.phase === 'Registers'
  // Emit in blocks: the tree, the assembly and a stack column side by side
  // (Fable's emit styling, docs/handoffs/2026-09-24-emit-styling-fable-answer.md).
  const emitStage = emitBlocks && namedTrace.recorded && frame.phase === 'Emit'
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
  // Registers the recorded sets leave out (`$fp` going round a loop's back
  // edge), marked on the lines a later sweep adds them to.
  const fixedAdded =
    backend && w.kind === 'reg.live' && w.sweep > 1
      ? liveAdded(backend, w.fn, w.sweep)
      : undefined
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
  // The allocator's stack: simplify pushes a register, select pops it. Its
  // rows are sized for the deepest it gets, so they don't shift as it grows.
  const stack: { vr: string; candidate: boolean }[] = []
  const spilled = new Set<string>()
  let deepest = 0
  for (let i = 0, depth = 0; i < graphSteps.length; i++) {
    const st = graphSteps[i]
    const push = st.op === 'simplify' || st.op === 'spillCandidate'
    depth += push ? 1 : -1
    deepest = Math.max(deepest, depth)
    if (i > stepIndex) continue
    if (push) stack.push({ vr: st.vr, candidate: st.op === 'spillCandidate' })
    else {
      const at = stack.findIndex((e) => e.vr === st.vr)
      if (at >= 0) stack.splice(at, 1)
    }
    if (st.op === 'spill') spilled.add(st.vr)
  }
  const onStack = new Set(stack.map((e) => e.vr))
  const pileBottom = sceneHeight - 16
  const pileRow = Math.min(20, (sceneHeight - 60) / Math.max(1, deepest))
  const stepVr = graphFn && 'step' in w ? graphSteps[w.step]?.vr : undefined
  const paletteIndex = (r: string) => backend?.palette.indexOf(r) ?? -1
  const graphPoint = (vr: string) => {
    const names = graphFn?.interference.nodes ?? []
    const i = names.indexOf(vr)
    const n = names.length
    const radius = n <= 6 ? 90 : n <= 12 ? 120 : 150
    const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2
    // The stack takes the left edge, so the ring sits right of it.
    return {
      x: 198 + Math.cos(a) * Math.min(radius, 100),
      y: 235 + Math.sin(a) * radius,
    }
  }
  const parsed = frame.phase !== 'Tokens'
  // Stage points to scene pixels. The SVGs draw in pixels rather than
  // stretching the 680 × 480 box: a stretched, non-scaling stroke measured
  // pathLength in the wrong space, so long edges stopped short.
  const toPx = (p: { x: number; y: number }) => ({
    x: (p.x * sceneWidth) / VIEW_W,
    y: (p.y * sceneHeight) / VIEW_H,
  })
  const previousLayout = useRef({
    trace,
    index,
    slide,
    sceneWidth,
    sceneHeight,
    narrow,
  })
  const resizing =
    previousLayout.current.trace === trace &&
    previousLayout.current.index === index &&
    previousLayout.current.slide === slide &&
    (previousLayout.current.sceneWidth !== sceneWidth ||
      previousLayout.current.sceneHeight !== sceneHeight ||
      previousLayout.current.narrow !== narrow)
  useLayoutEffect(() => {
    previousLayout.current = {
      trace,
      index,
      slide,
      sceneWidth,
      sceneHeight,
      narrow,
    }
  })
  const transition = {
    duration: reduced ? 0 : 0.42 / speed,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    ...(resizing && {
      d: { duration: 0 },
      left: { duration: 0 },
      top: { duration: 0 },
      scale: { duration: 0 },
    }),
  }
  // The type pass makes room beside each node for its type, from its
  // slide on (the slide's deck sits on the name pass's last frame).
  const typing =
    frame.phase === 'Check' &&
    namesDoneAt >= 0 &&
    (index > namesDoneAt ||
      (index === namesDoneAt && slide > 0 && decks.has(index)))
  const tree = typing ? typedTree : late ? regTree : baseTree
  const room = typing ? badgeRoom : late ? regRoom : undefined
  // Late phases share the stage with the instruction list on the right half.
  const unit = VIEW_W / sceneWidth
  // Emit in blocks: the assembly (about 280px) and the stack column (176px)
  // keep their room and the tree takes what is left, up to a third; on a
  // narrow stage it gives way.
  const emitTree = Math.min(sceneWidth / 3, sceneWidth - 470)
  const emitTreeShown = emitTree >= 150
  const treeRoom =
    (late
      ? emitStage
        ? Math.max(emitTree, 0)
        : sceneWidth * 0.46
      : sceneWidth) -
    EDGE_PX * 2
  const squeeze = late && !emitStage ? 11 / 12 : 1
  const treeWidth = tree.width * squeeze
  // Spread a small tree out, shrink a wide one; shrinking scales text too.
  const spread = Math.min(treeRoom / treeWidth, 3)
  const fit = Math.min(1, spread)
  const treeLeft = EDGE_PX + (treeRoom - treeWidth * spread) / 2
  const deck = decks.get(index)
  const intro = slide > 0 ? deck?.slides[slide - 1] : undefined
  // On a slide the tabs show the phase it opens.
  const shownPhase = intro && deck ? deck.phase : frame.phase
  // Parse: unattached nodes wait in their holder's open slot (parse-view.ts).
  const working = parseView(trace, index, parents, groups, baseTree.at)
  const pieceHalf = ((late || narrow ? 20 : 22) * fit) / 2
  const { top: treeTop, band: treeBand } = treeRows(
    packTray(trace.tokens, sceneWidth),
    sceneHeight,
    tree,
    pieceHalf,
    narrow,
  )
  const point = (id: number) => {
    const slot = tree.at[id] ?? { x: tree.width / 2, y: tree.depth }
    // A label and its badge share the slot, so the label sits left of centre.
    const at = room ? { ...slot, x: slot.x - (room.get(id) ?? 0) / 2 } : slot
    const shift = working.shift.get(id)
    const p = shift ? { x: at.x + shift.x, y: at.y + shift.y } : at
    const x = (treeLeft + p.x * squeeze * spread) * unit
    // Crowded rows keep their extra room until the stage's floor. Then
    // the tree fits below the tray instead of raising its root into it.
    const row = p.y / Math.max(1, tree.depth)
    const band = Math.min((tree.depth / Math.max(1, tree.levels)) * 235, 295)
    return late
      ? { x, y: 60 + row * band * 1.3 }
      : { x, y: ((treeTop + row * treeBand) * VIEW_H) / sceneHeight }
  }
  // Edges meet a node's box at its top and bottom centre. Ports are worked
  // out in pixels, where the box's height is (22px, 20px when small or on
  // a phone, times the node's scale); in stage units they drifted as the
  // stage stretched.
  const edgePath = (from: number, to: number) => {
    const p = toPx(point(from)),
      q = toPx(point(to))
    const y0 = p.y + pieceHalf,
      y1 = q.y - pieceHalf
    const mid = (y0 + y1) / 2
    return `M ${p.x} ${y0} C ${p.x} ${mid}, ${q.x} ${mid}, ${q.x} ${y1}`
  }
  // The same edge drawn from the child up: a finished piece is handed back
  // to its parent, as a recursive-descent call returns.
  const edgeUp = (parent: number, child: number) => {
    const p = toPx(point(parent)),
      q = toPx(point(child))
    const y0 = p.y + pieceHalf,
      y1 = q.y - pieceHalf
    const mid = (y0 + y1) / 2
    return `M ${q.x} ${y1} C ${q.x} ${mid}, ${p.x} ${mid}, ${p.x} ${y0}`
  }
  // Name links pathfind around the tree's labels and across its edges
  // (link-route.ts, Fable 5.1's router). A piece is exactly as wide as its
  // label plus its 3px side padding (`.ac-piece.node`), and as tall as its
  // box, so a link's dot sits on the border whichever side it lands on.
  const pieceBox = (id: number): Box => {
    const c = toPx(point(id))
    const w = (trace.nodes[id].label.length * CHAR_PX + 6) * fit
    return { x: c.x - w / 2, y: c.y - pieceHalf, w, h: pieceHalf * 2 }
  }
  // A name with no declaration still searches: its line heads for the top
  // of the tree, where the outermost scope is, and comes back empty.
  const missing =
    frame.why.kind === 'check.unresolved' &&
    trace.root !== undefined &&
    trace.root !== frame.why.use
      ? { use: frame.why.use, root: trace.root }
      : undefined
  // A node's type badge on this step. New ones fade in, an operator's own
  // after its operands'; a checked value and what it must fit go green when
  // the check lands; a mismatch shows what was needed.
  const typeBadge = (id: number) => {
    const w = frame.why
    const need = returnNeed.get(id)
    if (w.kind === 'check.fits' && w.node === id && need)
      return {
        text: need.text,
        state: `need ${w.ok ? 'ok' : 'bad'}`,
        delay: 0,
      }
    if (need && need.step < index)
      return { text: need.text, state: need.ok ? '' : 'bad', delay: 0 }
    // A call, on its step, shows the signature its arguments are checked
    // against; after, its own type.
    const sig =
      w.kind === 'check.expr' && w.node === id ? callNeed(id) : undefined
    if (sig && w.kind === 'check.expr')
      return { text: sig, state: `need ${w.ok ? 'ok' : 'bad'}`, delay: 0 }
    const typed = typedStep.get(id) ?? functionType.get(id)
    if (!typed || typed.step > index) return undefined
    const fresh = typed.step === index
    const states = fresh ? ['new'] : []
    let text = typed.type
    let delay = 0
    if (w.kind === 'check.expr') {
      if (fresh && w.node === id) delay = transition.duration
      if (trace.nodes[w.node].children.includes(id)) {
        states.push('input')
        // A call's arguments go green with its signature.
        if (w.ok && trace.nodes[w.node].kind === 'call') states.push('ok')
      }
      if (!w.ok && w.bad === id) {
        states.push('bad')
        text = `${typed.type} ≠ ${w.expected}`
      }
      if (!w.ok && w.node === id) states.push('unknown')
    }
    if (w.kind === 'check.fits' && (w.value === id || w.node === id)) {
      states.push(w.ok ? 'ok' : 'bad')
      if (!w.ok && w.value === id) text = `${typed.type} ≠ ${w.expected}`
    }
    return { text, state: states.join(' '), delay }
  }
  const naming =
    frame.phase === 'Check' &&
    !typing &&
    !intro &&
    w.kind !== 'check.type' &&
    w.kind !== 'check.expr' &&
    w.kind !== 'check.fits' &&
    w.kind !== 'check.typesDone'
  // Resolve frames are authoritative, including traces missing `links`.
  const bindings = new Map(frame.links ?? [])
  if (w.kind === 'check.resolve') bindings.set(w.use, w.decl)
  const links = [...bindings]
  // Check starts with the complete tree. Choose against every piece so
  // the corner and its scroll area stay put as the scope contents grow.
  const scopeBox = naming
    ? scopePanelBox(
        trace.nodes.map((n) => pieceBox(n.id)),
        sceneWidth,
        sceneHeight,
        1 +
          scopes.scopes.reduce(
            (rows, scope) =>
              rows +
              scope.decls.length +
              (scope.node !== null && trace.nodes[scope.node].kind === 'block'
                ? 2
                : 0),
            0,
          ),
      )
    : undefined
  const linkRoutes = (() => {
    if (!naming || (!links.length && !missing)) return undefined
    const key = `${index}|${sceneWidth}|${sceneHeight}|${narrow}|${JSON.stringify(links)}|${JSON.stringify(scopeBox)}`
    const cached = routeCache.current
    if (cached?.trace === trace && cached.key === key) return cached.routes
    const boxes = frame.nodes.map(pieceBox)
    const edges = frame.nodes.flatMap((id) =>
      trace.nodes[id].children
        .filter((c) => frame.attached.includes(c))
        .map((c) => {
          const p = toPx(point(id)),
            q = toPx(point(c))
          return {
            from: { x: p.x, y: p.y + pieceHalf },
            to: { x: q.x, y: q.y - pieceHalf },
          }
        }),
    )
    // Keep the whole stage available for a detour around the scope panel.
    const router = linkRouter(boxes, {
      edges,
      walls: scopeBox ? [scopeBox] : [],
      bounds: { x: 4, y: 4, w: sceneWidth - 8, h: sceneHeight - 8 },
    })
    const routes = new Map(
      links.map(([use, decl]) => [
        `${use}-${decl}`,
        router.route(pieceBox(use), pieceBox(decl)),
      ]),
    )
    if (missing)
      routes.set(
        `miss-${missing.use}`,
        router.route(pieceBox(missing.use), pieceBox(missing.root)),
      )
    routeCache.current = { trace, key, routes }
    return routes
  })()
  const shownNodes =
    working.preview === undefined
      ? frame.nodes
      : [...frame.nodes, working.preview]
  const owners = new Map(shownNodes.map((id) => [trace.nodes[id].token, id]))
  // Stage pieces: every token read so far, as its node once it has one. A
  // node sharing its token with another (an expression statement and its
  // first operand, both anchored at `x` in `x + 1;`) gets a piece of its own.
  const pieces: { token: Token; nodeId?: number; key: string }[] = [
    ...trace.tokens.slice(0, frame.tokenCount).map((token) => ({
      token,
      nodeId: owners.get(token.id),
      key: `token-${token.id}`,
    })),
    ...shownNodes
      .filter((id) => owners.get(trace.nodes[id].token) !== id)
      .map((id) => ({
        token: trace.tokens[trace.nodes[id].token],
        nodeId: id,
        key: `node-${id}`,
      })),
  ]
  const shownInstructions = trace.instructions.slice(0, frame.instructionCount)
  const rowStagger = transition.duration * 0.35
  const functionNames = new Set(
    trace.nodes.filter((n) => n.kind === 'function').map((n) => n.label),
  )
  const tray = trace.tokens.filter(
    (t) =>
      !parsed ||
      (!owners.has(t.id) &&
        !(frame.consumed.includes(t.id) && KEEP_HIDDEN.includes(t.text))),
  )
  const tokenPoints = packTray(tray, sceneWidth)
  const scanningRow = tokenPoints[Math.max(0, frame.tokenCount - 1)]?.y || 30
  const trayOffset = parsed ? 0 : Math.max(0, scanningRow - 98)
  const resolve = frame.why.kind === 'check.resolve' ? frame.why : undefined
  const pairMarks = resolve
    ? [
        { ...trace.tokens[trace.nodes[resolve.use].token], kind: 'use' },
        { ...trace.tokens[scopes.declaredAt(resolve.decl)], kind: 'decl' },
      ].sort((a, b) => a.start - b.start)
    : undefined
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
      : intro
        ? intro.title
        : index === 0
          ? 'Press space to compile your code!'
          : frame.why.kind === 'token'
            ? `Token: \`${trace.tokens[frame.why.token].text}\``
            : frame.title
  const noteText =
    hoverText ??
    intro?.body ??
    (error &&
    // A type error's step says what didn't fit, and that it stops there.
    !(
      (frame.why.kind === 'check.expr' || frame.why.kind === 'check.fits') &&
      !frame.why.ok
    )
      ? 'The compiler stops at its first error. Fix it in the editor and it runs again.'
      : explain(trace, frame, titles))
  // Without step titles, only the welcome and slides keep a header; an
  // error is already spelled out in the chip above.
  const showTitle =
    titles || (!!intro && !hoverText) || (index === 0 && !hoverText && !error)
  // A slide's small two-column table, under its body.
  const slideTable = !hoverText && intro?.table && (
    <table className="ac-slide-table">
      <thead>
        <tr>
          <th>{intro.head?.[0] ?? 'lexeme'}</th>
          <th>{intro.head?.[1] ?? 'category'}</th>
        </tr>
      </thead>
      <tbody>
        {intro.table.map(([lexeme, category]) => (
          <tr key={lexeme}>
            <td>
              <code>{lexeme}</code>
            </td>
            <td>{category}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
  // A token step lists every lexeme in its class under the explanation.
  const stepToken =
    !hoverText && !error && !intro && frame.why.kind === 'token'
      ? trace.tokens[frame.why.token]
      : undefined
  // A character step shows the class tables under the explanation.
  const charStep =
    !hoverText && !error && !intro && frame.why.kind === 'lex.char'
      ? frame.why
      : undefined
  const charRead =
    charStep &&
    trace.tokens[charStep.token].text.slice(
      0,
      charStep.at - trace.tokens[charStep.token].start + 1,
    )
  // Hidden layers size the panel for the tallest lexer step, but only on the
  // steps themselves: the welcome and slides keep their own height.
  const sizing = !intro && index > 0
  // Switching a mode keeps the place: the same recorded step in the new
  // list (from an inserted step, the recorded one after it).
  const switchLexer = (lexer: boolean) => {
    const at = view.toBase.findIndex((o, i) => i >= index && o !== null)
    const base = at >= 0 ? view.toBase[at] : 0
    const next = layered(baseTrace, source, lexer)
    setStep(Math.max(0, next.toBase.indexOf(base)))
    setDetailed(lexer)
    setPlaying(false)
    clearHover()
  }
  // Switching emit views keeps the place: the first step of the other view
  // that has emitted at least as much.
  const switchEmit = (blocks: boolean) => {
    const at = view.toBase.findIndex((o, i) => i >= index && o !== null)
    const base = at >= 0 ? (view.toBase[at] ?? 0) : 0
    const was = baseTrace.frames[base]
    const nextBase = withEmit(blocks)
    const match = nextBase.frames.findIndex(
      (f) =>
        f.phase === was.phase && f.instructionCount >= was.instructionCount,
    )
    const next = layered(nextBase, source, detailed)
    setStep(Math.max(0, next.toBase.indexOf(match >= 0 ? match : base)))
    setEmitBlocks(blocks)
    setPlaying(false)
    clearHover()
  }
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
  // Open, it is only as wide as the class list needs (items are 6px padding
  // and a 1px border each side, 6px apart), up to 260 before it wraps.
  const listWidth = hoverTok
    ? lexemesOf(hoverTok).reduce(
        (w, l, i) => w + l.length * CARD_CHAR_PX + 14 + (i ? 6 : 0),
        0,
      )
    : 0
  const openWidth = Math.min(
    260,
    sceneWidth - 16,
    Math.max(
      listWidth + 24,
      hoverTok ? tokenKind(hoverTok).length * CARD_CHAR_PX + 22 : 0,
    ),
  )
  const cardBox =
    cardAt &&
    (cardOpen
      ? {
          left: clampLeft(cardAt.closed.left - 12, openWidth),
          width: openWidth,
        }
      : cardAt.closed)

  return (
    <section
      ref={rootRef}
      className={`ac ${bare ? 'bare' : ''}`}
      data-phase={frame.phase.toLowerCase()}
    >
      <header className="ac-top">
        <nav className="ac-phases" aria-label="Compiler phases">
          {tabs.map((tab) => {
            const types = 'types' in tab
            const active =
              shownPhase === tab.phase &&
              (tab.phase !== 'Check' || types === typing)
            return (
              <button
                key={tab.label}
                className={active ? 'active' : ''}
                disabled={
                  !trace.frames.some((f) =>
                    types ? isTypeStep(f) : f.phase === tab.phase,
                  )
                }
                onClick={() => jumpTab(tab)}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
        <details className="ac-about">
          <summary>about</summary>
          <div>
            <p>
              Step through step by step, seeing a brief depiction of how your
              code gets compiled into target machine code. This simulation was
              built by bundling my compiler source code with TeaVM. Every
              program you compile here uses the code I wrote for my
              compiler&apos;s class I took last winter,{' '}
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

      <div
        className="ac-work"
        ref={workRef}
        style={
          editorWidth === null
            ? undefined
            : ({ '--editor-w': `${editorWidth}px` } as CSSProperties)
        }
      >
        {/* Drag the border to size the editor column; double-click resets. */}
        <div
          className="ac-colsplit"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize editor"
          tabIndex={0}
          onPointerDown={(e) => {
            const range = widthRange()
            if (!range) return
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
            widthDrag.current = { x: e.clientX, ...range }
          }}
          onPointerMove={(e) => {
            const d = widthDrag.current
            if (d) setEditorWidth(clampWidth(d.width + e.clientX - d.x, d.max))
          }}
          onPointerUp={() => {
            if (widthDrag.current) saveWidth(editorWidth)
            widthDrag.current = null
          }}
          onDoubleClick={() => saveWidth(null)}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
            e.preventDefault()
            e.stopPropagation()
            const range = widthRange()
            if (!range) return
            const step = e.key === 'ArrowLeft' ? -20 : 20
            saveWidth(clampWidth(range.width + step, range.max))
          }}
        />
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
            data-sized={sourceHeight !== null}
            style={
              sourceHeight === null
                ? undefined
                : ({ '--source-h': `${sourceHeight}px` } as CSSProperties)
            }
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
                    {pairMarks ? (
                      <>
                        {pairMarks.map((mark, i) => (
                          <Fragment key={mark.kind}>
                            {source.slice(
                              i ? pairMarks[i - 1].end : 0,
                              mark.start,
                            )}
                            <mark className={`ok ${mark.kind}`}>
                              {source.slice(mark.start, mark.end)}
                            </mark>
                          </Fragment>
                        ))}
                        {source.slice(pairMarks[pairMarks.length - 1].end)}
                      </>
                    ) : (
                      <>
                        {source.slice(0, activeSpan.start)}
                        {cursor !== undefined ? (
                          // Detailed lexer: read so far underlined, the character
                          // being read as a block.
                          <>
                            <mark className="reading">
                              {source.slice(activeSpan.start, cursor)}
                            </mark>
                            <mark className="cursor">{source[cursor]}</mark>
                          </>
                        ) : (
                          <mark
                            key={index}
                            className={
                              hoverNode || hoverTok
                                ? ''
                                : error || frame.why.kind === 'check.unresolved'
                                  ? 'err'
                                  : frame.why.kind === 'lex.skip'
                                    ? 'skip'
                                    : ''
                            }
                          >
                            {source.slice(activeSpan.start, activeSpan.end)}
                          </mark>
                        )}
                        {source.slice(activeSpan.end)}
                      </>
                    )}
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
          {trace.error && !realPending && (
            <button
              className="ac-diag"
              onClick={() => seek(last)}
              onMouseEnter={(e) => {
                // One line; on hover a long message scrolls to its end and stays.
                const msg = e.currentTarget.lastElementChild as HTMLElement
                const over = msg.scrollWidth - msg.clientWidth
                msg.style.setProperty('--shift', `${-over}px`)
                // About 150px/s, at least 1s.
                msg.style.setProperty('--scroll', `${Math.max(1, over / 150)}s`)
                msg.classList.toggle('scrolling', over > 0)
              }}
              onMouseLeave={(e) =>
                e.currentTarget.lastElementChild?.classList.remove('scrolling')
              }
            >
              <span className="ac-diag-tag">error</span>
              <span className="ac-diag-msg">
                <span>
                  <Prose text={trace.error.message} />
                </span>
              </span>
            </button>
          )}
          <section
            className={`ac-note ${error ? 'err' : ''}`}
            aria-label="Current step"
            aria-live={playing ? 'off' : 'polite'}
          >
            {/* Drag the border to size the source; double-click resets. */}
            <div
              className="ac-split"
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize source"
              tabIndex={0}
              onPointerDown={(e) => {
                const range = splitRange()
                if (!range) return
                e.preventDefault()
                e.currentTarget.setPointerCapture(e.pointerId)
                drag.current = { y: e.clientY, ...range }
              }}
              onPointerMove={(e) => {
                const d = drag.current
                if (d)
                  setSourceHeight(clampSplit(d.height + e.clientY - d.y, d.max))
              }}
              onPointerUp={() => {
                if (drag.current) saveSplit(sourceHeight)
                drag.current = null
              }}
              onDoubleClick={() => saveSplit(null)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
                e.preventDefault()
                e.stopPropagation()
                const range = splitRange()
                if (!range) return
                const step = e.key === 'ArrowUp' ? -SOURCE_ROW : SOURCE_ROW
                saveSplit(clampSplit(range.height + step, range.max))
              }}
            />
            {showTitle && (
              <div className="ac-bar">
                <span className="ac-note-title">
                  <Prose text={statusText} />
                </span>
              </div>
            )}
            <div className="ac-note-body">
              {frame.phase === 'Tokens' ? (
                // Hidden layers hold the tallest step of each token class in
                // the same grid cell, so the panel keeps one height while
                // stepping through tokens and only grows if even that won't fit.
                <div className="ac-note-stack">
                  <div className="ac-note-layer">
                    <StepNote text={noteText} token={stepToken} />
                    {charRead !== undefined && (
                      <CharTable
                        read={charRead}
                        final={
                          charStep?.next !== undefined
                            ? tokenKind(trace.tokens[charStep.token])
                            : undefined
                        }
                      />
                    )}
                    {slideTable}
                  </div>
                  {(sizing ? tallestTokenSteps : []).map((v) => (
                    <div
                      key={tokenKind(v.token)}
                      className="ac-note-layer ghost"
                      aria-hidden="true"
                    >
                      <StepNote text={v.text} token={v.token} />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <Prose text={noteText} />
                  {slideTable}
                </>
              )}
            </div>
            {intro && deck && deck.slides.length > 1 && (
              <div className="ac-note-foot">
                <button
                  type="button"
                  className="ac-slides"
                  aria-label="Skip intro"
                  onClick={() => seek(index + 1)}
                >
                  <span className="count">
                    {slide}/{deck.slides.length}
                  </span>
                  <span className="skip">skip</span>
                </button>
              </div>
            )}
          </section>
        </section>

        <section className="ac-stage" aria-label="Animated compiler stage">
          <div
            className={`ac-scene ${emitStage && !emitTreeShown ? 'treeless' : ''}`}
            ref={sceneRef}
          >
            <svg
              className="ac-edges"
              viewBox={`0 0 ${sceneWidth} ${sceneHeight}`}
              aria-hidden="true"
            >
              <AnimatePresence>
                {!regView &&
                  frame.nodes.flatMap((id) => {
                    const n = trace.nodes[id]
                    return n.children
                      .filter((child) => frame.attached.includes(child))
                      .map((child) => {
                        const d = edgeUp(id, child)
                        return (
                          <motion.path
                            key={`${id}-${child}`}
                            d={d}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1}
                            initial={{ d, pathLength: 0, opacity: 0 }}
                            animate={{
                              d,
                              pathLength: 1,
                              // The finished tree is lit throughout.
                              opacity:
                                frame.focus === id ||
                                frame.why.kind === 'parse.done'
                                  ? 1
                                  : 0.45,
                            }}
                            exit={{ pathLength: 0, opacity: 0 }}
                            transition={transition}
                          />
                        )
                      })
                  })}
                {working.held.map(([holder, id]) => {
                  // A dashed socket: shown, not yet attached. A node shown
                  // this step was called for, so its socket draws down from
                  // the holder as the call descends; one adopted from an
                  // earlier step (`4` moving under `+`) only fades in. A
                  // dash pattern can't also carry pathLength, so a solid
                  // mask draws instead.
                  const d = edgePath(holder, id)
                  const key = `held-${holder}-${id}`
                  const called =
                    index > 0 && !trace.frames[index - 1].nodes.includes(id)
                  return (
                    <motion.g
                      key={key}
                      initial={{ opacity: called ? 0.5 : 0 }}
                      animate={{ opacity: 0.5 }}
                      exit={{ opacity: 0 }}
                      transition={transition}
                    >
                      {called && (
                        <mask
                          id={key}
                          maskUnits="userSpaceOnUse"
                          x={0}
                          y={0}
                          width={sceneWidth}
                          height={sceneHeight}
                        >
                          <motion.path
                            d={d}
                            fill="none"
                            stroke="#fff"
                            strokeWidth={4}
                            initial={{ d, pathLength: 0 }}
                            animate={{ d, pathLength: 1 }}
                            transition={transition}
                          />
                        </mask>
                      )}
                      <motion.path
                        className="ac-held"
                        d={d}
                        fill="none"
                        strokeWidth={1}
                        mask={called ? `url(#${key})` : undefined}
                        initial={{ d }}
                        animate={{ d }}
                        transition={transition}
                      />
                    </motion.g>
                  )
                })}
                {working.group &&
                  (() => {
                    // Brackets around the group being read, solid once its
                    // `)` is read.
                    const g = working.group
                    const ids = g.nodes.length ? g.nodes : [g.slot]
                    // All in pixels, so the brackets keep their shape
                    // however the stage is stretched.
                    const half = (id: number) =>
                      (trace.nodes[id].label.length * CHAR_PX * fit) / 2 + 12
                    const at = ids.map((id) => toPx(point(id)))
                    const xs = at.flatMap((p, i) => [
                      p.x - half(ids[i]),
                      p.x + half(ids[i]),
                    ])
                    const ys = at.map((p) => p.y)
                    const x0 = Math.min(...xs),
                      x1 = Math.max(...xs)
                    const y0 = Math.min(...ys) - pieceHalf - 8,
                      y1 = Math.max(...ys) + pieceHalf + 8
                    const my = (y0 + y1) / 2
                    const left = `M ${x0 + 5} ${y0} Q ${x0 - 5} ${my}, ${x0 + 5} ${y1}`
                    const right = `M ${x1 - 5} ${y0} Q ${x1 + 5} ${my}, ${x1 - 5} ${y1}`
                    return [left, right].map((d, i) => (
                      <motion.path
                        key={`group-${i}`}
                        className={`ac-group ${g.closed ? 'closed' : ''}`}
                        d={d}
                        fill="none"
                        strokeWidth={1}
                        initial={{ d, opacity: 0 }}
                        animate={{ d, opacity: g.closed ? 0.9 : 0.5 }}
                        exit={{ opacity: 0 }}
                        transition={transition}
                      />
                    ))
                  })()}
              </AnimatePresence>
              {naming && linkRoutes && (
                <NameLinks
                  key={`${source}|${detailed}|${emitBlocks}|${index}|${slide}`}
                  links={links}
                  routes={linkRoutes}
                  frame={frame}
                  hover={hover}
                  reduced={!!reduced}
                  duration={transition.duration}
                  missing={missing?.use}
                />
              )}
            </svg>
            {scopeBox && (
              <ScopeTree
                trace={trace}
                scopes={scopes}
                frame={frame}
                box={scopeBox}
                stageHeight={sceneHeight}
                duration={transition.duration}
              />
            )}
            <AnimatePresence>
              {!regView &&
                pieces.map(({ token, nodeId, key }) => {
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
                  const declaredAt =
                    node === undefined ? undefined : declaredStep.get(node.id)
                  const declared =
                    declaredAt !== undefined && declaredAt <= index && naming
                  const allFound =
                    naming && frame.why.kind === 'check.namesDone'
                  const found =
                    (allFound &&
                      links.some(
                        ([u, d]) => u === node?.id || d === node?.id,
                      )) ||
                    (naming &&
                      node !== undefined &&
                      (resolve?.decl === node.id || resolve?.use === node.id))
                  // Uses have a quiet outline; declarations are filled.
                  const use =
                    (allFound && links.some(([u]) => u === node?.id)) ||
                    (naming && node !== undefined && resolve?.use === node.id)
                  const missingAt =
                    node === undefined ? undefined : missingStep.get(node.id)
                  const missing =
                    missingAt !== undefined &&
                    missingAt <= index &&
                    frame.phase === 'Check'
                  const badge =
                    node && frame.phase === 'Check'
                      ? typeBadge(node.id)
                      : undefined
                  return (
                    <motion.button
                      key={key}
                      style={
                        {
                          x: '-50%',
                          y: '-50%',
                        } as MotionStyle
                      }
                      className={`ac-piece ${node ? 'node' : 'token'} kind-${token.kind} ${focused ? 'focused' : ''} ${pending ? 'pending' : ''} ${late ? 'small' : ''} ${node && node.id === working.preview ? 'preview' : ''} ${node && working.outside.includes(node.id) ? 'outside' : ''} ${declared ? 'declared' : ''} ${found ? 'found' : ''} ${use ? 'use' : ''} ${missing ? 'missing' : ''}`}
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
                      onBlur={(e) => {
                        // Moving to another piece is not leaving: clearing
                        // here unmounted the card between mousedown and
                        // click, so a clicked card popped open unanimated.
                        const to = e.relatedTarget as Element | null
                        if (!to?.closest('.ac-piece')) clearHover()
                      }}
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
                      {node
                        ? node.label
                        : parsed && times.has(token.id)
                          ? '×'
                          : token.text}
                      {!parsed && focused && <small>{tokenKind(token)}</small>}
                      {node && working.cue?.node === node.id && (
                        <small className="ac-cue">{working.cue.text}</small>
                      )}
                      {badge && (
                        // Keyed by step so a landing replays on the next one.
                        <small
                          key={index}
                          className={`ac-type ${badge.state}`}
                          style={
                            {
                              '--delay': `${badge.delay}s`,
                              '--land': `${transition.duration}s`,
                            } as CSSProperties
                          }
                        >
                          {badge.text}
                        </small>
                      )}
                    </motion.button>
                  )
                })}
            </AnimatePresence>
            <AnimatePresence>
              {frame.phase === 'Emit' &&
                (!emitStage || emitTreeShown) &&
                badgesAt(regs, frame.instructionCount, currentRange).map(
                  (b, _, poses) => {
                    // Centres in scene pixels; a badge sits just right of its
                    // node's box and shrinks with the tree, as a type badge
                    // does, so it fits the room the layout keeps for it.
                    const width = (b.reg.length * TYPE_PX + 8) * fit
                    const box = pieceBox(b.node)
                    const held = {
                      x: box.x + box.w + 5 * fit + width / 2,
                      y: box.y + box.h / 2,
                    }
                    const pct = (p: { x: number; y: number }) => ({
                      left: `${(p.x / sceneWidth) * 100}%`,
                      top: `${(p.y / sceneHeight) * 100}%`,
                    })
                    const from = currentRange?.[0] ?? 0
                    // A read register takes its time up the edge; it is the
                    // point of the operation's step.
                    const travel = transition.duration * 1.5
                    const fresh = b.state.startsWith('new')
                    // A result waits for the registers it is made from to
                    // arrive.
                    const arrive = Math.max(
                      0,
                      ...poses
                        .filter(
                          (q) =>
                            q.state.endsWith('spent') &&
                            q.to === b.node &&
                            q.node !== b.node,
                        )
                        .map((q) => (q.use - from) * rowStagger + travel),
                    )
                    const shows = fresh
                      ? Math.max((b.def - from) * rowStagger, arrive)
                      : 0
                    const spent = b.state.endsWith('spent')
                    // A spent badge rides the edge up into the node that
                    // reads it, then goes.
                    let path = [held]
                    if (spent && b.to !== null && b.to !== b.node) {
                      const c = toPx(point(b.node)),
                        p = toPx(point(b.to))
                      const bottom = { x: p.x, y: p.y + pieceHalf }
                      path =
                        parents.get(b.node) === b.to
                          ? [
                              held,
                              { x: c.x, y: c.y - pieceHalf },
                              { x: (c.x + p.x) / 2, y: (c.y + p.y) / 2 },
                              bottom,
                            ]
                          : [held, bottom]
                    }
                    const leaves = (b.use - from) * rowStagger
                    const total = leaves + travel + transition.duration * 0.3
                    const at = (t: number) => (total ? t / total : 1)
                    // It waits until the row that reads it, then moves.
                    const times =
                      path.length === 1
                        ? [0, 1]
                        : [
                            0,
                            ...path.map((_, i) =>
                              at(
                                leaves +
                                  (travel * i) / Math.max(1, path.length - 1),
                              ),
                            ),
                          ]
                    // In as it is written, out once it has arrived.
                    const arrived = leaves + travel
                    const fade = [
                      at(Math.min(shows, arrived)),
                      at(Math.min(shows + transition.duration * 0.3, arrived)),
                      at(arrived),
                    ]
                    return (
                      <motion.span
                        key={`reg-${b.reg}`}
                        className={`ac-reg ${b.address ? 'address' : ''} ${b.state}`}
                        style={
                          {
                            x: '-50%',
                            y: '-50%',
                            scale: fit,
                            '--delay': `${shows}s`,
                          } as MotionStyle
                        }
                        initial={{ opacity: 0, ...pct(held) }}
                        animate={
                          spent
                            ? {
                                left: [held, ...path].map((q) => pct(q).left),
                                top: [held, ...path].map((q) => pct(q).top),
                                opacity: fresh ? [0, 0, 1, 1, 0] : [1, 1, 0],
                              }
                            : { ...pct(held), opacity: 1 }
                        }
                        exit={{ opacity: 0 }}
                        transition={
                          spent
                            ? {
                                duration: total,
                                ease: 'easeInOut',
                                left: { duration: total, times },
                                top: { duration: total, times },
                                opacity: {
                                  duration: total,
                                  times: fresh
                                    ? [0, ...fade, 1]
                                    : [0, fade[2], 1],
                                },
                              }
                            : { ...transition, delay: shows }
                        }
                        aria-hidden
                      >
                        {b.reg}
                      </motion.span>
                    )
                  },
                )}
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
                        {lexemesOf(hoverTok).map((lexeme) => (
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
                viewBox={`0 0 ${sceneWidth} ${sceneHeight}`}
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
                          x1={(p.x * sceneWidth) / VIEW_W}
                          y1={(p.y * sceneHeight) / VIEW_H}
                          x2={(q.x * sceneWidth) / VIEW_W}
                          y2={(q.y * sceneHeight) / VIEW_H}
                          stroke="currentColor"
                          strokeWidth={1}
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
                      className={`ac-vr ${vr === stepVr && !onStack.has(vr) ? 'focused' : ''} ${onStack.has(vr) ? 'aside' : ''} ${spilled.has(vr) ? 'spilled' : ''} ${colour ? 'coloured' : ''}`}
                      style={
                        {
                          x: '-50%',
                          y: '-50%',
                          '--c': colour ? INK[idx % INK.length] : undefined,
                        } as MotionStyle
                      }
                      initial={{
                        opacity: 0,
                        left: `${(p.x / 680) * 100}%`,
                        top: `${(p.y / 480) * 100}%`,
                      }}
                      animate={{
                        // On the stack, it leaves an outline behind.
                        opacity: onStack.has(vr) ? 0.3 : 1,
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
            {graphFn && graphShown && deepest > 0 && (
              // Open at the top, as deep as the stack gets.
              <div
                className="ac-pile-box"
                style={{
                  top: pileBottom - deepest * pileRow - 2,
                  width: PILE_W + 4,
                  height: deepest * pileRow + 4,
                }}
              >
                <span className="ac-label">; stack</span>
              </div>
            )}
            <AnimatePresence>
              {graphFn &&
                graphShown &&
                stack.map((e, i) => {
                  // Pushed from its place in the graph, popped back to it.
                  const home = toPx(graphPoint(e.vr))
                  const slot = {
                    left: 12 + PILE_W / 2,
                    top: pileBottom - (i + 0.5) * pileRow,
                  }
                  return (
                    <motion.span
                      key={`pile-${fnIndex}-${e.vr}`}
                      className={`ac-pile ${e.vr === stepVr ? 'focused' : ''} ${e.candidate ? 'candidate' : ''}`}
                      style={{
                        x: '-50%',
                        y: '-50%',
                        width: PILE_W,
                        height: pileRow - 3,
                        lineHeight: `${pileRow - 5}px`,
                      }}
                      initial={{ left: home.x, top: home.y, opacity: 1 }}
                      animate={{ ...slot, opacity: 1 }}
                      exit={{
                        left: home.x,
                        top: home.y,
                        opacity: 0,
                        // It fades as it lands back in the graph.
                        transition: {
                          ...transition,
                          opacity: {
                            duration: transition.duration * 0.3,
                            delay: transition.duration * 0.7,
                          },
                        },
                      }}
                      transition={transition}
                      aria-hidden
                    >
                      {e.vr}
                    </motion.span>
                  )
                })}
            </AnimatePresence>
            {emitStage && (
              <>
                <motion.div
                  className="ac-asm blocks"
                  ref={instructionRef}
                  style={{ left: emitTreeShown ? emitTree : 12 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={transition}
                >
                  <div className="ac-label">; virtual registers</div>
                  {shownInstructions.map((ins, i) => {
                    const current =
                      currentRange !== null &&
                      i >= currentRange[0] &&
                      i <= currentRange[1]
                    // A block's rows arrive one after another.
                    const enter = {
                      ...transition,
                      delay: current ? (i - currentRange[0]) * rowStagger : 0,
                    }
                    const head = asmHeads.get(i)
                    const [op, args = ''] = (ins.text ?? ins.op).split(
                      /\s+(.*)/,
                    )
                    const hold =
                      ins.op === 'pushRegisters' || ins.op === 'popRegisters'
                    return (
                      <Fragment key={`instruction-${i}`}>
                        {ins.labels?.map((l) => (
                          <motion.div
                            key={l}
                            className={`ac-asm-label ${functionNames.has(l) ? 'fn' : ''}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={enter}
                          >
                            {l}:
                          </motion.div>
                        ))}
                        {head && (
                          <motion.div
                            className="ac-asm-head"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={enter}
                          >
                            ; {head}
                          </motion.div>
                        )}
                        <motion.div
                          className={`ac-ins ${current ? 'current' : ''} ${ins.dead ? 'dead' : ''}`}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={enter}
                          onMouseEnter={() => !playing && setHoverIns(i)}
                          onMouseLeave={clearHover}
                        >
                          <span>{i + 1}</span>
                          {hold ? (
                            <code className="ac-hold">{op}</code>
                          ) : (
                            <>
                              <b>{op}</b>
                              <code>{args}</code>
                            </>
                          )}
                        </motion.div>
                      </Fragment>
                    )
                  })}
                </motion.div>
                <StackColumn
                  frame={stacks.find(
                    (f) =>
                      f.first < frame.instructionCount &&
                      frame.instructionCount - 1 <= f.last,
                  )}
                  count={frame.instructionCount}
                  from={currentRange?.[0] ?? null}
                  row={ASM_ROW}
                  stagger={rowStagger}
                  duration={transition.duration}
                  still={!!reduced}
                  step={index}
                />
              </>
            )}
            {late && !emitStage && (
              <motion.div
                className="ac-asm listing"
                ref={instructionRef}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
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
                    const [op, args = ''] = instructionText(
                      ins,
                      registers,
                    ).split(/\s+(.*)/)
                    const hold =
                      ins.op === 'pushRegisters' || ins.op === 'popRegisters'
                    // Laid out as the emit blocks are: labels on their own
                    // rows, then number, op and operands in columns.
                    return (
                      <motion.div
                        key={`instruction-${i}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={transition}
                      >
                        {ins.labels?.map((l) => (
                          <div
                            key={l}
                            className={`ac-asm-label ${functionNames.has(l) ? 'fn' : ''}`}
                          >
                            {l}:
                          </div>
                        ))}
                        <div
                          className={`ac-ins ${current ? 'current' : ''} ${changed.has(i) ? 'changed' : ''} ${ins.dead ? 'dead' : ''}`}
                          onMouseEnter={() => !playing && setHoverIns(i)}
                          onMouseLeave={clearHover}
                        >
                          <span>{i + 1}</span>
                          {hold ? (
                            <code className="ac-hold">{op}</code>
                          ) : (
                            <>
                              <b>{op}</b>
                              <code>{args}</code>
                            </>
                          )}
                          {live?.[i] && (
                            <small>
                              {live[i].out.join(' ') || '·'}
                              {fixedAdded
                                ?.get(i)
                                ?.filter((r) => !r.startsWith('v'))
                                .map((r) => <i key={r}> +{r}</i>)}
                            </small>
                          )}
                          {ins.dead && <small>never runs</small>}
                        </div>
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
        <button
          onClick={play}
          className={playing ? 'on' : ''}
          disabled={realPending}
        >
          <kbd>spc</kbd>
          {realPending
            ? compilerLoaded
              ? 'compiling…'
              : 'loading compiler…'
            : playing
              ? 'pause'
              : 'play'}
        </button>
        <span className="ac-step">
          <button
            onClick={() => move(-1)}
            disabled={realPending || (index === 0 && slide === 0)}
          >
            <kbd>h</kbd>
          </button>
          <button
            onClick={() => move(1)}
            disabled={realPending || index === last}
          >
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
          disabled={realPending}
          style={
            { '--p': `${last ? (index / last) * 100 : 0}%` } as CSSProperties
          }
          onChange={(e) => seek(Number(e.target.value))}
        />
        <div className="ac-more" ref={moreRef}>
          <button
            type="button"
            aria-label="Options"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((o) => !o)}
          >
            ?
          </button>
          {moreOpen && (
            <div className="ac-more-menu" role="menu">
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={detailed}
                onClick={() => switchLexer(!detailed)}
              >
                <span aria-hidden="true">{detailed ? '[x]' : '[ ]'}</span>
                detailed lexer
              </button>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={titles}
                onClick={() => setTitles((t) => !t)}
              >
                <span aria-hidden="true">{titles ? '[x]' : '[ ]'}</span>
                step titles
              </button>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={emitBlocks}
                onClick={() => switchEmit(!emitBlocks)}
              >
                <span aria-hidden="true">{emitBlocks ? '[x]' : '[ ]'}</span>
                emit in blocks
              </button>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={!bare}
                onClick={() => saveBare(!bare)}
              >
                <span aria-hidden="true">{bare ? '[ ]' : '[x]'}</span>
                scrollbars
              </button>
            </div>
          )}
        </div>
      </footer>
    </section>
  )
}
