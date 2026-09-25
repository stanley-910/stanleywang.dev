'use client'
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
  type MotionStyle,
} from 'motion/react'
import {
  type CSSProperties,
  Fragment,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { detailTrace } from './detail'
import { EmitLanes, lanesWidth } from './emit-lanes'
import { withEmitBlocks, withEmitLines } from './emit-view'
import {
  explain,
  instructionHover,
  NODE_KINDS,
  nodeKind,
  registerHover,
  tokenKind,
  PHASE_SLIDES,
  STEP_SLIDES,
  type Slide,
  lexemesOf,
  matchTable,
  type TokenClass,
} from './explain'
import { lanesOf, registersOf } from './lanes'
import { linkRouter, type Box, type Route } from './link-route'
import { NameLinks } from './name-links'
import { groupsOf, parentsOf, parseView } from './parse-view'
import { compileReal, compilerLoaded, REAL_MAX_CHARS } from './real'
import { findReference, REFERENCES } from './reference'
import { badgesAt, regBadges } from './reg-badges'
import { withRegisterStops } from './regs-view'
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
// One character of the assembly's 12px monospace.
const ASM_CH = 7.2
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
  // Presets play the compiler's recorded frames, the parse steps in the
  // order its parser took them, with a name step for each assignment target
  // (scopes.ts).
  // Emit line by line, or in blocks (emit-view.ts).
  const [emitBlocks, setEmitBlocks] = useState(false)
  const namedTrace = useMemo(() => {
    const recorded = reference?.trace ?? (real?.source === source && real.trace)
    return recorded
      ? { trace: withNameSteps(recorded), recorded: true }
      : { trace: buildTrace(source), recorded: false }
  }, [source, reference, real])
  const withEmit = useCallback(
    (blocks: boolean) =>
      !namedTrace.recorded
        ? namedTrace.trace
        : withRegisterStops(
            blocks
              ? withEmitBlocks(namedTrace.trace)
              : withEmitLines(namedTrace.trace),
          ),
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
  const lanes = useMemo(() => lanesOf(trace.instructions), [trace])
  // The longest operands, in characters: the lanes sit just past them.
  const operandsCh = useMemo(
    () =>
      Math.max(
        0,
        ...trace.instructions.map(
          (ins) => (ins.text ?? ins.op).split(/\s+(.*)/)[1]?.length ?? 0,
        ),
      ),
    [trace],
  )
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
      // Line by line, a run's head goes over its first line.
      if (w.kind === 'emit.prologue' || w.kind === 'emit.epilogue') {
        const from = w.of?.from ?? w.from
        // `twice_epilogue:` already says it.
        const named = trace.instructions[from]?.labels?.some((l) =>
          l.endsWith('_epilogue'),
        )
        if (!named)
          heads.set(from, w.kind === 'emit.prologue' ? 'prologue' : 'epilogue')
        previous = -1
      } else if (w.kind === 'emit.instr') {
        const from = w.of?.from ?? w.from
        const n = trace.nodes[w.node]
        // A loop's jump back belongs to its closing brace.
        const back = n.kind === 'while' && trace.instructions[from]?.op === 'j'
        const line = lineAt(back ? n.end - 1 : n.start)
        if (line !== previous && !heads.has(from))
          heads.set(from, lineText(line))
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
  // What a return must match: its function's return type. On the check
  // both badges light, the return's and the function's signature, so the
  // match speaks for itself; a condition's rule (int) is only in the step
  // text. It stays after its check, settled (or red), with the step it was
  // checked on.
  const returnNeed = useMemo(() => {
    const need = new Map<
      number,
      { text: string; step: number; ok: boolean; fn: number }
    >()
    trace.frames.forEach((f, step) => {
      if (f.why.kind !== 'check.fits' || f.why.rule !== 'return') return
      let at: number | undefined = f.why.node
      while (at !== undefined && trace.nodes[at].kind !== 'function')
        at = parents.get(at)
      if (at !== undefined)
        need.set(f.why.node, {
          text: f.why.expected,
          step,
          ok: f.why.ok,
          fn: at,
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
  // Each type badge (or what a return must match): its width in pixels and
  // the step it first shows. The type pass makes room node by node as it
  // reaches them, rather than all at once.
  const badgeTexts = useMemo(() => {
    const out: { id: number; width: number; step: number }[] = []
    const fit = (id: number, text: string, step: number) =>
      out.push({ id, width: text.length * TYPE_PX + 13, step })
    for (const [id, { type, step }] of typedStep) fit(id, type, step)
    for (const [id, { text, step }] of returnNeed) fit(id, text, step)
    for (const [id, { type, step }] of functionType) fit(id, type, step)
    trace.frames.forEach((f, step) => {
      if (f.why.kind !== 'check.expr') return
      const sig = callNeed(f.why.node)
      if (sig) fit(f.why.node, sig, step)
    })
    return out
  }, [trace, typedStep, returnNeed, functionType, callNeed])
  // Emit: the register each node leaves behind (reg-badges.ts), with room
  // for it beside the node from the phase's first step.
  const regs = useMemo(() => regBadges(trace.instructions), [trace])
  const regRoom = useMemo(() => {
    const room = new Map<number, number>()
    for (const b of regs)
      room.set(
        b.node,
        Math.max(
          room.get(b.node) ?? 0,
          (b.reg.length + (b.address ? 2 : 0)) * TYPE_PX + 13,
        ),
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
  // A declaration's type tokens (`int` in `int twice(` or `int n`) are kept
  // in its node, not thrown away like `(` or `;`. They wait in the tray
  // until the node lands, then slide into it and fade.
  const absorbedBy = useMemo(() => {
    const by = new Map<number, number>()
    for (const n of trace.nodes)
      if (n.kind === 'function' || n.kind === 'declare')
        for (const t of trace.tokens)
          if (t.start >= n.start && t.id < n.token) by.set(t.id, n.id)
    return by
  }, [trace])
  const shownAt = useMemo(() => {
    const at = new Map<number, number>()
    trace.frames.forEach((f, i) => {
      for (const id of f.nodes) if (!at.has(id)) at.set(id, i)
    })
    return at
  }, [trace])
  // A type token's state this step: waiting, sliding into its node, or gone.
  const absorbed = (id: number) => {
    const node = absorbedBy.get(id)
    const at = node === undefined ? undefined : shownAt.get(node)
    if (node === undefined || at === undefined) return undefined
    return at > index ? 'waiting' : at === index ? 'sliding' : 'gone'
  }
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
  // The stack column: docked in the note card, or floating where it was
  // dropped (top left, in the simulation's coordinates).
  const [stackAt, setStackAt] = useState<{ x: number; y: number } | null>(null)
  const stackDrag = useDragControls()
  const stackStart = useRef<ReactPointerEvent | null>(null)
  const noteRef = useRef<HTMLElement>(null)
  const [hoverIns, setHoverIns] = useState<number | null>(null)
  const [hoverVr, setHoverVr] = useState<string | null>(null)
  // A virtual register under focus in emit (`fn:vr`): where it is written
  // and read, all at once (Stanley, 2026-09-25: no replay of its life). A
  // hover shows it; a click pins it. It holds for the step it was picked on.
  const [regFocus, setRegFocus] = useState<{
    key: string
    pinned: boolean
    at: number
  } | null>(null)
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
  // Which way the last step went. Stepping back doesn't replay the step it
  // lands on: its sequences (rows in turn, a register travelling up the
  // tree, the name pass's walk, a link drawing) settle straight to where
  // that step ends, with plain tweens.
  const stepped = useRef({ index, back: false })
  if (stepped.current.index !== index)
    stepped.current = { index, back: index < stepped.current.index }
  const back = stepped.current.back
  const last = trace.frames.length - 1
  const end = index === last
  const error = end ? trace.error : undefined
  const hoverNode = hover === null || playing ? undefined : trace.nodes[hover]
  const hoverTok =
    hoverToken === null || playing ? undefined : trace.tokens[hoverToken]
  // Emit in blocks: the tree, the assembly and a stack column side by side
  // (Fable's emit styling, docs/handoffs/2026-09-24-emit-styling-fable-answer.md).
  const emitStage = namedTrace.recorded && frame.phase === 'Emit'
  // Hovering a line of the emit blocks marks the source it came from; the
  // note keeps telling the step's story.
  const hoverAsm =
    emitStage && hoverIns !== null && !playing
      ? trace.nodes[trace.instructions[hoverIns]?.node ?? -1]
      : undefined
  const focusLane =
    emitStage && regFocus?.at === index && !playing
      ? lanes.lanes.find(
          (l) =>
            `${l.fn}:${l.vr}` === regFocus.key &&
            l.def < frame.instructionCount,
        )
      : undefined
  // The lines it has lived through so far; an open lane ends at the last.
  const lifecycle = focusLane
    ? [focusLane.def, ...focusLane.reads].filter(
        (i) => i < frame.instructionCount,
      )
    : []
  // The source marks the node that writes it.
  const defNode = focusLane ? trace.instructions[focusLane.def].node : null
  const focusAsm = defNode === null ? undefined : trace.nodes[defNode]
  // A declaration reads as its type and name (`int n`), in the source as
  // on the stage, not the name alone.
  const declSpan = (decl: number) => ({
    start: trace.nodes[decl].start,
    end: trace.tokens[trace.nodes[decl].token].end,
  })
  const stepSpan =
    frame.why.kind === 'check.declare' ? declSpan(frame.why.decl) : frame.span
  const activeSpan =
    hoverNode || hoverTok || focusAsm || hoverAsm || error || stepSpan
  const hovering = !!(hoverNode || hoverTok || focusAsm || hoverAsm || error)
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
  const focusReg = (key: string, pin: boolean) => {
    if (playing) return
    setRegFocus((f) =>
      pin
        ? f?.pinned && f.key === key && f.at === index
          ? null
          : { key, pinned: true, at: index }
        : f?.pinned && f.at === index
          ? f
          : { key, pinned: false, at: index },
    )
  }
  const blurReg = () => setRegFocus((f) => (f?.pinned ? f : null))
  // A click anywhere but on a register lets a pinned one go.
  const pinned = !!focusLane && !!regFocus?.pinned
  useEffect(() => {
    if (!pinned) return
    const away = (event: PointerEvent) => {
      if (
        !(event.target instanceof Element && event.target.closest('[data-vr]'))
      )
        setRegFocus(null)
    }
    window.addEventListener('pointerdown', away)
    return () => window.removeEventListener('pointerdown', away)
  }, [pinned])
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
    if (q.get('emit') === 'blocks') setEmitBlocks(true)
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
    if (emitBlocks) url.searchParams.set('emit', 'blocks')
    else url.searchParams.delete('emit')
    url.searchParams.set('frame', String(index))
    window.history.replaceState(null, '', url)
  }, [linked, playing, reference, index, detailed, titles, emitBlocks])

  // The name pass walks the tree between the names it looks at: from the
  // last one up to where their paths meet, then down to this one. Its
  // edges light in turn, [parent, child, down], before the lookup draws.
  const walk = useMemo(() => {
    const nameAt = (f: Frame | undefined) => {
      const v = f?.why
      if (v?.kind === 'check.declare') return v.decl
      if (
        v?.kind === 'check.resolve' ||
        v?.kind === 'check.unresolved' ||
        v?.kind === 'check.builtin'
      )
        return v.use
      return undefined
    }
    const to = nameAt(trace.frames[index])
    const from = nameAt(trace.frames[index - 1]) ?? trace.root
    if (to === undefined || from === undefined || from === to) return []
    const up = (id: number) => {
      const out = [id]
      for (let p = parents.get(id); p !== undefined; p = parents.get(p))
        out.push(p)
      return out
    }
    const rise = up(from)
    const fall = up(to)
    const meet = rise.find((id) => fall.includes(id))
    if (meet === undefined) return []
    const edges: [number, number, boolean][] = []
    for (let i = 0; rise[i] !== meet; i++)
      edges.push([rise[i + 1], rise[i], false])
    for (let i = fall.indexOf(meet); i > 0; i--)
      edges.push([fall[i], fall[i - 1], true])
    return edges
  }, [trace, index, parents])
  // Seconds per lit edge, at 1×.
  // One eased stroke along the whole walk (ease in and out, sine). Timed by
  // the edges it crosses: 0.5s for three (main down to `twice()`, which
  // Stanley liked), shorter hops quicker at that pace, longer walks adding
  // 0.14s an edge. Each edge draws during its share of the curve, with the
  // curve's own slice as its easing, so the speed carries across edges.
  const walkTime =
    reduced || back || !walk.length
      ? 0
      : walk.length <= 3
        ? (0.5 * walk.length) / 3
        : 0.5 + (walk.length - 3) * 0.14
  const walkEase = (x: number) => (1 - Math.cos(Math.PI * x)) / 2
  const walkWhen = (y: number) => Math.acos(1 - 2 * y) / Math.PI
  const walkEdge = (i: number) => {
    const n = walk.length
    const from = walkWhen(i / n),
      to = walkWhen((i + 1) / n)
    return {
      delay: from * walkTime,
      duration: (to - from) * walkTime,
      ease: (u: number) => n * walkEase(from + u * (to - from)) - i,
    }
  }

  // Play holds an emit step until its animation is done (Fable's pacing
  // fix): the rows arriving one after another, then any register read on
  // them travelling up the tree, then a beat. Milliseconds at 1×, from the
  // same numbers the stage uses (0.42s moves, rows 0.35 of that apart,
  // badges travelling 1.5 of it).
  const emitHold = (() => {
    const v = frame.why
    if (
      v.kind !== 'emit.instr' &&
      v.kind !== 'emit.prologue' &&
      v.kind !== 'emit.epilogue'
    )
      return 680
    const rows = trace.instructions.slice(v.from, v.to + 1)
    const reads = rows.some((ins) =>
      (ins.text?.match(/\bv\d+\b/g) ?? []).some((r) => r !== ins.dest),
    )
    return Math.max(
      680,
      420 + (rows.length - 1) * 147 + (reads ? 630 : 0) + 260,
    )
  })()

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
            : emitHold + walkTime * 1000) / speed,
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
    walkTime,
    emitHold,
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
      if (pinned && key === 'Escape') {
        event.preventDefault()
        return setRegFocus(null)
      }
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
  }, [move, play, seek, bumpSpeed, jumpTab, pinned])

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
  // The type pass, from its slide on (the slide's deck sits on the name
  // pass's last frame).
  const typing =
    frame.phase === 'Check' &&
    namesDoneAt >= 0 &&
    (index > namesDoneAt ||
      (index === namesDoneAt && slide > 0 && decks.has(index)))
  // Each node's widest badge so far.
  const badgeRoom = useMemo(() => {
    const room = new Map<number, number>()
    for (const { id, width, step } of badgeTexts)
      if (step <= index) room.set(id, Math.max(room.get(id) ?? 0, width))
    return room
  }, [badgeTexts, index])
  // The type pass keeps the check layout; badges push nodes aside only
  // where they would collide (typedShift, below).
  const tree = late ? regTree : baseTree
  const room = late ? regRoom : undefined
  // Late phases share the stage with the instruction list on the right half.
  const unit = VIEW_W / sceneWidth
  // Emit: the tree keeps its check-phase layout on the left, up to 60% of
  // the stage; the assembly, with its live-range lanes just past the
  // longest line, keeps the room it needs on the right. The stack sits in
  // a free corner of the tree's side. On a narrow stage the tree gives way
  // and the stack goes back beside the assembly.
  const lanesW = lanesWidth(lanes.columns)
  const lanesAt = 34 + (9 + operandsCh) * ASM_CH
  const asmLeft = Math.min(sceneWidth * 0.6, sceneWidth - lanesAt - lanesW - 24)
  const emitTreeShown = asmLeft >= 260
  const twoColumn = emitStage && emitTreeShown
  // Registers, and emit without room for the tree, draw it small and flat.
  const compact = late && !twoColumn
  const treeRoom =
    (late ? (emitStage ? asmLeft : sceneWidth * 0.46) : sceneWidth) -
    EDGE_PX * 2
  const squeeze = late && !emitStage ? 11 / 12 : 1
  const treeWidth = tree.width * squeeze
  // Spread a small tree out, shrink a wide one; shrinking scales text too.
  // Emit's two columns don't shrink it: a tree wider than its column
  // keeps its size and the column scrolls sideways under the assembly,
  // which stays put (Stanley, 2026-09-25).
  const spread = Math.min(
    twoColumn ? Math.max(treeRoom / treeWidth, 1) : treeRoom / treeWidth,
    3,
  )
  const fit = Math.min(1, spread)
  const treeLeft = EDGE_PX + Math.max(0, (treeRoom - treeWidth * spread) / 2)
  const emitOver = twoColumn ? Math.max(0, treeWidth - treeRoom) : 0
  // Type pass: the tree stays where the checks left it. Row by row, top
  // down, a node whose label and badge would run into the one left of it
  // moves right just enough, and its subtree moves with it. Only if that
  // runs off the stage does the whole tree slide left. So a step moves
  // nothing unless its new badge needs the space. In pixels, since badges
  // don't stretch with the layout's spread.
  // How far the type pass's tree runs past the stage's right edge; the
  // stage scrolls sideways that far rather than squeeze it (Stanley,
  // 2026-09-25).
  let typedOver = 0
  const typedShift = (() => {
    if (!typing) return undefined
    const shift = new Map<number, number>()
    const baseX = (id: number) => treeLeft + (tree.at[id]?.x ?? 0) * spread
    const rows = new Map<number, number[]>()
    for (const n of trace.nodes) {
      const row = tree.at[n.id]?.y
      if (row === undefined) continue
      rows.set(row, [...(rows.get(row) ?? []), n.id])
    }
    let right = -Infinity
    let left = Infinity
    for (const row of [...rows.keys()].sort((a, b) => a - b)) {
      let edge = -Infinity
      const ids = rows.get(row) ?? []
      ids.sort((a, b) => baseX(a) - baseX(b))
      for (const id of ids) {
        const parent = parents.get(id)
        let x =
          baseX(id) + (parent === undefined ? 0 : (shift.get(parent) ?? 0))
        const half = ((trace.nodes[id].label.length * CHAR_PX + 16) * fit) / 2
        if (x - half < edge + 10 * fit) x = edge + 10 * fit + half
        shift.set(id, x - baseX(id))
        edge = x + half + (badgeRoom.get(id) ?? 0) * fit
        right = Math.max(right, edge)
        left = Math.min(left, x - half)
      }
    }
    // Slide left only as far as the stage's left edge; past that (a wide
    // tree on a phone), the rest runs off the right and the stage scrolls.
    const end = EDGE_PX + treeRoom
    const slide = Math.min(
      Math.max(0, right - end),
      Math.max(0, left - EDGE_PX),
    )
    typedOver = Math.max(0, right - slide - end)
    for (const [id, d] of shift) shift.set(id, d - slide)
    return shift
  })()
  const over = typedOver + emitOver
  // Back to the left once nothing runs past the edge.
  useEffect(() => {
    if (!over && sceneRef.current) sceneRef.current.scrollLeft = 0
  }, [over])
  // Emit: a step whose node sits out of the tree's column scrolls it in.
  useEffect(() => {
    const scene = sceneRef.current
    if (!emitOver || !scene) return
    const node = scene.querySelector<HTMLElement>('.ac-piece.focused')
    if (!node) return
    const box = node.getBoundingClientRect()
    const x = box.left - scene.getBoundingClientRect().left
    const seen = asmLeft - 16
    if (x >= 16 && x + box.width <= seen) return
    scene.scrollTo({
      left: scene.scrollLeft + x + box.width / 2 - seen / 2,
      behavior: reduced ? 'auto' : 'smooth',
    })
  }, [index, emitOver, asmLeft, reduced])
  const deck = decks.get(index)
  const intro = slide > 0 ? deck?.slides[slide - 1] : undefined
  // On a slide the tabs show the phase it opens.
  const shownPhase = intro && deck ? deck.phase : frame.phase
  // Parse: unattached nodes wait in their holder's open slot (parse-view.ts).
  const working = parseView(trace, index, parents, groups, baseTree.at)
  const pieceHalf = ((compact || narrow ? 20 : 22) * fit) / 2
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
    const x =
      (treeLeft + p.x * squeeze * spread + (typedShift?.get(id) ?? 0)) * unit
    // Crowded rows keep their extra room until the stage's floor. Then
    // the tree fits below the tray instead of raising its root into it.
    const row = p.y / Math.max(1, tree.depth)
    const band = Math.min((tree.depth / Math.max(1, tree.levels)) * 235, 295)
    return compact
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
    // Stepping back, a badge already there doesn't fade in again.
    const fresh = typed.step === index && !back
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
    // A return's check lights its function's return type, `→ int`, too.
    if (
      w.kind === 'check.fits' &&
      w.rule === 'return' &&
      returnNeed.get(w.node)?.fn === id
    )
      states.push(w.ok ? 'returns-ok' : 'returns-bad')
    if (w.kind === 'check.fits' && (w.value === id || w.node === id)) {
      states.push(w.ok ? 'ok' : 'bad')
      if (!w.ok && w.value === id) text = `${typed.type} ≠ ${w.expected}`
    }
    return { text, state: states.join(' '), delay }
  }
  // Parse: the node landing this step. Like a token in the lexer, it shows
  // its class under it and the class's kinds under the note.
  const landing =
    !intro &&
    (w.kind === 'parse.node' || w.kind === 'parse.wait') &&
    trace.nodes[w.node].kind !== 'program'
      ? nodeKind(trace.nodes[w.node])
      : undefined
  // Where a landing node's class sits (parse): under it, else right, left
  // or above, whichever crosses no edge on the stage and covers no other
  // piece. The right is taken when the node has a parse cue there.
  const landingSpot = (() => {
    if (!landing || (w.kind !== 'parse.node' && w.kind !== 'parse.wait'))
      return undefined
    const id = w.node
    const c = toPx(point(id))
    const half = pieceBox(id).w / 2
    const tw = landing.cls.length * 6.1 + 2
    const th = 13
    const top = c.y - pieceHalf
    const spots = [
      { side: 'below', x: c.x - tw / 2, y: top + 24 },
      { side: 'right', x: c.x + half + 6, y: c.y - th / 2 },
      { side: 'left', x: c.x - half - 6 - tw, y: c.y - th / 2 },
      { side: 'above', x: c.x - tw / 2, y: c.y + pieceHalf - 24 - th },
    ].filter((s) => s.side !== 'right' || working.cue?.node !== id)
    // Every edge drawn this step, sampled along its cubic.
    const edges = [
      ...frame.nodes.flatMap((p) =>
        trace.nodes[p].children
          .filter((ch) => frame.attached.includes(ch))
          .map((ch) => edgeUp(p, ch)),
      ),
      ...working.held.map(([holder, child]) => edgePath(holder, child)),
    ]
    const points = edges.flatMap((d) => {
      const [x0, y0, x1, y1, x2, y2, x3, y3] = (
        d.match(/-?\d+(?:\.\d+)?/g) ?? []
      ).map(Number)
      return Array.from({ length: 21 }, (_, k) => {
        const t = k / 20,
          u = 1 - t
        return {
          x:
            u ** 3 * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * x3,
          y:
            u ** 3 * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3,
        }
      })
    })
    const others = frame.nodes.filter((n) => n !== id).map(pieceBox)
    const cost = (s: { x: number; y: number }) =>
      points.filter(
        (p) =>
          p.x > s.x - 3 &&
          p.x < s.x + tw + 3 &&
          p.y > s.y - 3 &&
          p.y < s.y + th + 3,
      ).length *
        100 +
      others.filter(
        (b) =>
          b.x < s.x + tw &&
          b.x + b.w > s.x &&
          b.y < s.y + th &&
          b.y + b.h > s.y,
      ).length
    return spots.reduce((a, b) => (cost(b) < cost(a) ? b : a)).side
  })()
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
  // Past the name pass, hovering a name or a declaration still draws its
  // links, wherever the tree is on the stage.
  const hoverLinked =
    !!hoverNode &&
    !regView &&
    !(emitStage && !emitTreeShown) &&
    links.some(([u, d]) => u === hoverNode.id || d === hoverNode.id)
  const linkRoutes = (() => {
    if (!(naming || hoverLinked) || (!links.length && !missing))
      return undefined
    const key = `${index}|${sceneWidth}|${sceneHeight}|${narrow}|${JSON.stringify(links)}`
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
    const router = linkRouter(boxes, {
      edges,
      walls: [],
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
  // The root has no token of its own (it is anchored at the first), so it
  // never takes one from the tray.
  const owners = new Map(
    shownNodes
      .filter((id) => trace.nodes[id].kind !== 'program')
      .map((id) => [trace.nodes[id].token, id]),
  )
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
  const rowStagger = back ? 0 : transition.duration * 0.35
  const functionNames = new Set(
    trace.nodes.filter((n) => n.kind === 'function').map((n) => n.label),
  )
  const tray = trace.tokens.filter(
    (t) =>
      !parsed ||
      (!owners.has(t.id) &&
        (absorbed(t.id) === undefined
          ? !(frame.consumed.includes(t.id) && KEEP_HIDDEN.includes(t.text))
          : absorbed(t.id) !== 'gone')),
  )
  const tokenPoints = packTray(tray, sceneWidth)
  const scanningRow = tokenPoints[Math.max(0, frame.tokenCount - 1)]?.y || 30
  const trayOffset = parsed ? 0 : Math.max(0, scanningRow - 98)
  const resolve = frame.why.kind === 'check.resolve' ? frame.why : undefined
  const pairMarks = resolve
    ? [
        { ...trace.tokens[trace.nodes[resolve.use].token], kind: 'use' },
        { ...declSpan(resolve.decl), kind: 'decl' },
      ].sort((a, b) => a.start - b.start)
    : undefined
  const lines = source.split('\n')
  const line = source.slice(0, activeSpan.start).split('\n').length
  const hoverText =
    hoverIns !== null && !playing && !emitStage
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
  // The name pass: the note card holds the scopes instead of a sentence.
  const scopeCard = naming && !hoverText
  const statusText = error
    ? error.message
    : scopeCard
      ? 'Declarations per scope'
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
    titles ||
    scopeCard ||
    (!!intro && !hoverText) ||
    (index === 0 && !hoverText && !error)
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
  // A token's or a node's card sits under it on the stage; the panel keeps
  // the step. A token's names its class and opens to the class's lexemes; a
  // node's names its class in the grammar and opens to that class's kinds.
  const card = (() => {
    if (hoverTok && hoverTok.id < frame.tokenCount) {
      const at = tokenPoints[hoverTok.id]
      if (!at) return undefined
      return {
        key: `token-${hoverTok.id}`,
        title: tokenKind(hoverTok),
        list: lexemesOf(hoverTok) as readonly string[],
        current: hoverTok.text,
        label: 'Lexemes in this class',
        x: at.x,
        y: at.y - trayOffset,
      }
    }
    if (hoverNode) {
      const { cls, kind } = nodeKind(hoverNode)
      return {
        key: `node-${hoverNode.id}`,
        title: cls,
        list: cls === 'global' ? [] : NODE_KINDS[cls],
        current: kind,
        label: 'Kinds in this class',
        ...point(hoverNode.id),
      }
    }
    return undefined
  })()
  const cardText = card?.title.length ?? 0
  // Closed, the card is just the class, centred under the piece. Open, it
  // grows right and down to the full class list, its label nudged left.
  // Widths are exact because the text is monospace.
  const clampLeft = (left: number, width: number) =>
    Math.max(8, Math.min(left, sceneWidth - width - 8))
  const cardAt = card && {
    closed: (() => {
      const width = cardText * CARD_CHAR_PX + 22
      return { left: clampLeft(card.x / unit - width / 2, width), width }
    })(),
    y: card.y,
  }
  // Open, it is only as wide as the class list needs (items are 6px padding
  // and a 1px border each side, 6px apart), up to 260 before it wraps.
  const listWidth = (card?.list ?? []).reduce(
    (w, l, i) => w + l.length * CARD_CHAR_PX + 14 + (i ? 6 : 0),
    0,
  )
  const openWidth = Math.min(
    260,
    sceneWidth - 16,
    Math.max(listWidth + 24, cardText * CARD_CHAR_PX + 22),
  )
  // A node's card keeps clear of the links on the stage: under the node,
  // else above, right or left of it, whichever crosses no link and covers
  // the fewest other pieces. A token's always sits under it.
  const cardPlace = (() => {
    if (!card || !cardAt) return undefined
    const c = toPx({ x: card.x, y: card.y })
    const w = cardAt.closed.width
    const h = 30
    const under = { left: cardAt.closed.left, top: c.y + 16, side: false }
    if (!hoverNode) return under
    const half = pieceBox(hoverNode.id).w / 2
    const spots = [
      under,
      { left: cardAt.closed.left, top: c.y - 16 - h, side: false },
      { left: c.x + half + 8, top: c.y - h / 2, side: true },
      { left: c.x - half - 8 - w, top: c.y - h / 2, side: true },
    ]
    const drawn = [...(linkRoutes?.entries() ?? [])]
      .filter(([key]) => {
        const [u, d] = key.split('-').map(Number)
        return (
          u === hoverNode.id ||
          d === hoverNode.id ||
          (frame.why.kind === 'check.resolve' && frame.why.use === u)
        )
      })
      .map(([, r]) => r.d)
    // Points along each route, from the corners of its cubics.
    const along = drawn.flatMap((d) => {
      const n = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
      const pts: { x: number; y: number }[] = []
      for (let i = 0; i + 1 < n.length; i += 2)
        pts.push({ x: n[i], y: n[i + 1] })
      return pts.flatMap((p, i) => {
        const q = pts[i + 1]
        if (!q) return [p]
        const steps = Math.max(
          1,
          Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 3),
        )
        return Array.from({ length: steps }, (_, k) => ({
          x: p.x + ((q.x - p.x) * k) / steps,
          y: p.y + ((q.y - p.y) * k) / steps,
        }))
      })
    })
    const others = frame.nodes.filter((id) => id !== hoverNode.id).map(pieceBox)
    const cost = (s: { left: number; top: number }) => {
      if (
        s.left < 4 ||
        s.top < 4 ||
        s.left + w > sceneWidth - 4 ||
        s.top + h > sceneHeight - 4
      )
        return Infinity
      const hits = along.filter(
        (p) =>
          p.x > s.left - 3 &&
          p.x < s.left + w + 3 &&
          p.y > s.top - 3 &&
          p.y < s.top + h + 3,
      ).length
      const covered = others.reduce(
        (sum, b) =>
          sum +
          Math.max(0, Math.min(s.left + w, b.x + b.w) - Math.max(s.left, b.x)) *
            Math.max(0, Math.min(s.top + h, b.y + b.h) - Math.max(s.top, b.y)),
        0,
      )
      return hits * 10000 + covered
    }
    const best = spots.reduce((a, b) => (cost(b) < cost(a) ? b : a))
    return cost(best) === Infinity ? under : best
  })()
  const cardBox =
    cardAt &&
    cardPlace &&
    // A card with no list (the root's) stays as it is when clicked.
    (cardOpen && card.list.length > 0
      ? {
          left: clampLeft(
            cardPlace.left - (cardPlace.side ? 0 : 12),
            openWidth,
          ),
          top: cardPlace.top,
          width: openWidth,
        }
      : {
          left: clampLeft(cardPlace.left, cardAt.closed.width),
          top: cardPlace.top,
          width: cardAt.closed.width,
        })

  const stackColumn = (at?: { x: number; y: number }) => (
    <StackColumn
      key={at ? `${at.x},${at.y}` : 'docked'}
      frame={stacks.find(
        (f) =>
          f.first < frame.instructionCount &&
          frame.instructionCount - 1 <= f.last,
      )}
      count={frame.instructionCount}
      from={back ? null : (currentRange?.[0] ?? null)}
      row={ASM_ROW}
      stagger={rowStagger}
      duration={transition.duration}
      still={!!reduced}
      step={index}
      at={at}
      bounds={rootRef}
      dock={noteRef}
      controls={stackDrag}
      pickup={stackStart}
      onUndock={(to, event) => {
        stackStart.current = event
        setStackAt(to)
      }}
      onMove={setStackAt}
      onDock={() => setStackAt(null)}
    />
  )
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
            ref={noteRef}
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
              ) : scopeCard ? (
                <ScopeTree
                  trace={trace}
                  scopes={scopes}
                  frame={frame}
                  duration={transition.duration}
                />
              ) : (
                <>
                  <Prose text={noteText} />
                  {emitStage && !stackAt && stackColumn()}
                  {landing && !hoverText && (
                    <ul className="ac-lexemes" aria-label="Kinds in this class">
                      {NODE_KINDS[landing.cls].map((kind) => (
                        <li
                          key={kind}
                          className={kind === landing.kind ? 'current' : ''}
                        >
                          {kind}
                        </li>
                      ))}
                    </ul>
                  )}
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
            className={`ac-scene ${emitStage && !emitTreeShown ? 'treeless' : ''} ${over ? 'scroll-x' : ''}`}
            ref={sceneRef}
          >
            <svg
              className="ac-edges"
              viewBox={`0 0 ${sceneWidth + over} ${sceneHeight}`}
              style={over ? { width: sceneWidth + over } : undefined}
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
              {naming && walkTime > 0 && (
                <g key={`walk-${index}`} className="ac-walk">
                  {walk.map(([parent, child, down], i) => (
                    <motion.path
                      key={`${parent}-${child}`}
                      d={down ? edgePath(parent, child) : edgeUp(parent, child)}
                      fill="none"
                      initial={{ pathLength: 0, opacity: 1 }}
                      animate={{ pathLength: 1, opacity: 0 }}
                      transition={{
                        pathLength: {
                          delay: walkEdge(i).delay / speed,
                          duration: walkEdge(i).duration / speed,
                          ease: walkEdge(i).ease,
                        },
                        opacity: {
                          delay: (walkTime + 0.42) / speed,
                          duration: 0.4 / speed,
                        },
                      }}
                    />
                  ))}
                </g>
              )}
              {linkRoutes && (
                <NameLinks
                  delay={walkTime / speed}
                  hoverOnly={!naming}
                  key={`${source}|${detailed}|${emitBlocks}|${index}|${slide}`}
                  links={links}
                  routes={linkRoutes}
                  frame={frame}
                  hover={hover}
                  reduced={!!reduced || back}
                  duration={transition.duration}
                  missing={naming ? missing?.use : undefined}
                />
              )}
            </svg>
            <AnimatePresence>
              {!regView &&
                pieces.map(({ token, nodeId, key }) => {
                  const node =
                    nodeId === undefined ? undefined : trace.nodes[nodeId]
                  const consumed = frame.consumed.includes(token.id)
                  const typeToken =
                    parsed && !node ? absorbed(token.id) : undefined
                  if (typeToken === 'gone') return null
                  if (
                    parsed &&
                    consumed &&
                    !node &&
                    typeToken === undefined &&
                    KEEP_HIDDEN.includes(token.text)
                  )
                    return null
                  const tokenPoint = tokenPoints[token.id] || { x: 340, y: 30 }
                  const sliding = typeToken === 'sliding'
                  const into = absorbedBy.get(token.id)
                  const p = node
                    ? point(node.id)
                    : sliding && into !== undefined
                      ? point(into)
                      : { x: tokenPoint.x, y: tokenPoint.y - trayOffset }
                  if (!node && !sliding && (p.y < 8 || p.y > 150)) return null
                  // A focused register moves the focus to the node that
                  // writes it.
                  const focused = node
                    ? (focusLane
                        ? defNode === node.id
                        : frame.focus === node.id) || hover === node.id
                    : // A step about a node lights the node, even one
                      // anchored at this token (the root, at the first).
                      frame.focus === null && token.start === frame.span.start
                  const life =
                    node !== undefined &&
                    lifecycle.some(
                      (r) => trace.instructions[r].node === node.id,
                    )
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
                      className={`ac-piece ${node ? 'node' : 'token'} kind-${token.kind} ${focused ? 'focused' : ''} ${pending ? 'pending' : ''} ${compact ? 'small' : ''} ${node && node.id === working.preview ? 'preview' : ''} ${node && working.outside.includes(node.id) ? 'outside' : ''} ${declared ? 'declared' : ''} ${found ? 'found' : ''} ${use ? 'use' : ''} ${missing ? 'missing' : ''} ${life ? 'life' : ''}`}
                      initial={{
                        left: '-5%',
                        top: (Math.min(tokenPoint.y, 98) / 480) * 100 + '%',
                        opacity: 0,
                      }}
                      animate={{
                        left: (p.x / 680) * 100 + '%',
                        top: (p.y / 480) * 100 + '%',
                        scale: node ? fit : sliding ? fit * 0.8 : 1,
                        opacity: sliding ? [1, 1, 0] : 1,
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
                        else setHoverToken(token.id)
                        setCardOpen((open) => !open)
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
                      {landing &&
                        node &&
                        (w.kind === 'parse.node' || w.kind === 'parse.wait') &&
                        node.id === w.node && (
                          <small className={`ac-class ${landingSpot ?? ''}`}>
                            {landing.cls}
                          </small>
                        )}
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
                          {badge.text.includes('→') ? (
                            <>
                              {badge.text.slice(0, badge.text.indexOf('→'))}
                              <span className="returns">
                                {badge.text.slice(badge.text.indexOf('→'))}
                              </span>
                            </>
                          ) : (
                            badge.text
                          )}
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
                    const width =
                      ((b.reg.length + (b.address ? 2 : 0)) * TYPE_PX + 8) * fit
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
                    const shows =
                      fresh && !back
                        ? Math.max((b.def - from) * rowStagger, arrive)
                        : 0
                    // Stepping back, a spent badge just fades where it was.
                    const gone = back && b.state.endsWith('spent')
                    const spent = !back && b.state.endsWith('spent')
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
                        // A register written twice (both arms of `&&`) has a badge per write.
                        key={`reg-${b.reg}-${b.def}`}
                        data-vr
                        className={`ac-reg ${b.address ? 'address' : ''} ${b.state} ${focusLane && focusLane.vr !== b.reg ? 'off' : ''}`}
                        onMouseEnter={() =>
                          focusReg(
                            `${trace.instructions[b.def].fn}:${b.reg}`,
                            false,
                          )
                        }
                        onMouseLeave={blurReg}
                        onClick={() =>
                          focusReg(
                            `${trace.instructions[b.def].fn}:${b.reg}`,
                            true,
                          )
                        }
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
                            : { ...pct(held), opacity: gone ? 0 : 1 }
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
                        {/* An address points at its word in the stack. */}
                        {b.address ? `${b.reg} →` : b.reg}
                      </motion.span>
                    )
                  },
                )}
            </AnimatePresence>
            {card && cardAt && cardBox && (
              <motion.div
                key={card.key}
                className="ac-hover"
                initial={false}
                animate={cardBox}
                transition={{ duration: reduced ? 0 : 0.22, ease: EASE }}
              >
                {card.title}
                <AnimatePresence initial={false}>
                  {cardOpen && card.list.length > 0 && (
                    <motion.div
                      className="ac-hover-list"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: reduced ? 0 : 0.22, ease: EASE }}
                    >
                      <ul
                        className="ac-lexemes"
                        aria-label={card.label}
                        style={{ width: openWidth - 22 }}
                      >
                        {card.list.map((lexeme) => (
                          <li
                            key={lexeme}
                            className={lexeme === card.current ? 'current' : ''}
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
                      // At a stop, only the current register's edges stay:
                      // they are what its choice depends on.
                      const mine = stepVr === a || stepVr === b
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
                            opacity: mine
                              ? 0.9
                              : stepVr !== undefined || gone
                                ? 0.1
                                : 0.6,
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
              // The assembly stays put while a wide tree scrolls: a track
              // as wide as the scroll, and in it a sticky pane the stage's
              // width.
              <div
                className="ac-pin-track"
                style={{ width: sceneWidth + over }}
              >
                <div className="ac-pin" style={{ width: sceneWidth }}>
                  <motion.div
                    className={`ac-asm blocks ${focusLane ? 'reg-focus' : ''}`}
                    ref={instructionRef}
                    style={{ left: emitTreeShown ? asmLeft : 12 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={transition}
                  >
                    <div className="ac-label">
                      ; virtual registers
                      {/* Over the lanes, once the first register is written. */}
                      {lanes.lanes.some(
                        (l) => l.def < frame.instructionCount,
                      ) && (
                        <motion.span
                          className="ac-lanes-head"
                          style={{
                            left: `min(${lanesAt}px, 100% - ${lanesW}px)`,
                          }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={transition}
                        >
                          ; live
                        </motion.span>
                      )}
                    </div>
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
                            data-row={i}
                            className={`ac-ins ${current ? 'current' : ''} ${ins.dead ? 'dead' : ''} ${i === hoverIns && !playing ? 'hover' : ''} ${focusLane && i >= focusLane.def && i <= focusLane.last ? 'live' : ''}`}
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
                                <code>
                                  {args.split(/\b(v\d+)\b/).map((part, j) => {
                                    if (j % 2 === 0) return part
                                    const key = `${ins.fn}:${part}`
                                    const on =
                                      key === regFocus?.key && !!focusLane
                                    return (
                                      <span
                                        key={j}
                                        data-vr
                                        className={`ac-arg ${on ? 'focus' : ''} ${on && j === 1 && i === focusLane.def ? 'def' : ''}`}
                                        onMouseEnter={() =>
                                          focusReg(key, false)
                                        }
                                        onMouseLeave={blurReg}
                                        onClick={() => focusReg(key, true)}
                                      >
                                        {part}
                                      </span>
                                    )
                                  })}
                                </code>
                              </>
                            )}
                          </motion.div>
                        </Fragment>
                      )
                    })}
                    <EmitLanes
                      left={lanesAt}
                      lanes={lanes.lanes}
                      columns={lanes.columns}
                      count={frame.instructionCount}
                      range={back ? null : currentRange}
                      focused={focusLane && regFocus?.key}
                      onFocus={focusReg}
                      onBlur={blurReg}
                      focus={
                        new Set(
                          hoverIns !== null && !playing
                            ? registersOf(trace.instructions[hoverIns]).map(
                                (r) =>
                                  `${trace.instructions[hoverIns].fn}:${r}`,
                              )
                            : [],
                        )
                      }
                      stagger={rowStagger}
                      duration={transition.duration}
                      still={!!reduced}
                    />
                  </motion.div>
                </div>
              </div>
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
                          data-row={i}
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
                {/* Emit's lanes carry on: each takes its register's colour
                    once the allocator picks one. The liveness sweeps use
                    this column for their sets instead. */}
                {regView && w.kind !== 'reg.live' && (
                  <EmitLanes
                    left={lanesAt}
                    lanes={lanes.lanes}
                    columns={lanes.columns}
                    count={frame.instructionCount}
                    range={null}
                    focus={
                      new Set(
                        stepVr === undefined ? [] : [`${fnIndex}:${stepVr}`],
                      )
                    }
                    onFocus={() => {}}
                    onBlur={() => {}}
                    stagger={rowStagger}
                    duration={transition.duration}
                    still={!!reduced}
                    tint={(key) => {
                      const colour = coloured?.[key.split(':')[1]]
                      return colour
                        ? INK[paletteIndex(colour) % INK.length]
                        : undefined
                    }}
                  />
                )}
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
      {emitStage && stackAt && stackColumn(stackAt)}

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
