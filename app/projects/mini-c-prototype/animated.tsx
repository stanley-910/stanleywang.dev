'use client'
import {
  ChevronLeft,
  ChevronRight,
  Fullscreen,
  Maximize,
  Minimize,
  Pin,
  Settings,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import {
  AnimatePresence,
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  type MotionStyle,
  type ValueAnimationTransition,
} from 'motion/react'
import {
  type ComponentProps,
  type CSSProperties,
  Fragment,
  memo,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { startCanvas, type Canvas, type CanvasRest } from './canvas-zoom'
import { derive, ProofTree } from './derivation'
import { detailTrace } from './detail'
import { EmitLanes, lanesWidth } from './emit-lanes'
import {
  isPlaceholder,
  withEmitBlocks,
  withEmitLines,
  withoutPlaceholders,
} from './emit-view'
import {
  explain,
  NODE_KINDS,
  nodeKind,
  tokenKind,
  PHASE_SLIDES,
  README_SLIDES,
  STEP_SLIDES,
  type Slide,
  lexemesOf,
  lexState,
  matchTable,
  type TokenClass,
} from './explain'
import { springLayout } from './graph-layout'
import { lanesOf, registersOf } from './lanes'
import { linkRouter, type Box, type Route } from './link-route'
import { NameLinks } from './name-links'
import { NoteWindow } from './note-window'
import { groupsOf, parentsOf, parseView } from './parse-view'
import { startRailCurve } from './rail-curve'
import {
  compileReal,
  compiledTrace,
  compilerLoaded,
  REAL_MAX_CHARS,
} from './real'
import { FIRST_ERROR, findReference, REFERENCES } from './reference'
import { badgesAt, regBadges } from './reg-badges'
import { withoutLiveness } from './regs-view'
import { ScopeTree } from './scope-tree'
import { scopesOf } from './scopes'
import { StackColumn } from './stack-column'
import { MAX_DRAWN_BYTES, stackFrames, tooBig } from './stack-view'
import { packTray, treeRows } from './stage-layout'
import {
  attemptOf,
  buildTrace,
  colouredUpTo,
  instructionText,
  rewritten,
  type Frame,
  type LexDecision,
  type Token,
  type Trace,
  treePositions,
} from './trace'
import { withTypeSteps } from './type-view'
import '@/app/styles/markdown.css'
import './animated.css'

const examples = REFERENCES.map((r) => ({ name: r.name, source: r.source }))
type Phase = Frame['phase']

// The notes window's name on a step, by phase (Check's two passes apart).
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
  'check.typeError',
  'check.typesDone',
] as const
const isTypeStep = (f: Frame) =>
  (TYPE_KINDS as readonly string[]).includes(f.why.kind)
const speeds = [0.5, 1, 1.5, 2]
const KEEP_HIDDEN = ['int', '(', ')', '{', '}', ';', '=', ',']
const HOVER_DELAY = 250
// How long an example waits for compiler.js to load before it plays the
// trace recorded from it instead (a typed program waits real.ts's LOAD_MS).
const PRESET_LOAD_MS = 4000
// The keyboard, as the settings menu lists it.
const KEYS: [string[], string][] = [
  [['spc'], 'play / pause'],
  [['←', '→'], 'step'],
  [['h', 'l'], 'step'],
  [['r'], 'reset'],
  [['-', '+'], 'speed'],
  [['1–6'], 'phase'],
  [['0'], 'fit'],
  [['f'], 'maximize'],
  [['e'], 'edit'],
]
// A held step arrow steps again after this long, then this often (about a
// held key's repeat).
const HOLD_DELAY_MS = 350
const HOLD_REPEAT_MS = 50
// How far one press of the stage's zoom buttons goes.
const ZOOM_STEP = 1.25
// The most the editor takes: four times what the compiler will run
// (REAL_MAX_CHARS), so a longer program is told it's too long, and a huge
// paste stops here.
const MAX_EDIT_CHARS = 4 * REAL_MAX_CHARS
// How long the pointer rests on a scrollbar before its thumb shows.
const DWELL_MS = 150
// Stage geometry: pieces live in a 680 × 480 viewBox stretched over the scene,
// but their text is fixed-size CSS pixels, so layout works in pixels.
const VIEW_W = 680
const VIEW_H = 480
const CHAR_PX = 7.2
// Space between neighbouring labels in the tree.
const TREE_GAP = 14
// A type badge's characters (10px).
const TYPE_PX = 6
const EDGE_PX = 24
// The share of the stage's width the parser's view gives the statement it
// is in, while it builds a tree too wide to show whole.
const SCOPE_ROOM = 0.6
type PaneKind = 'token' | 'chars' | 'kinds' | 'scopes'
// The side pane's headline over a class's list (DRAFT copy).
const TOKEN_HEADS: Record<string, string> = {
  type: 'types',
  keyword: 'keywords',
  operator: 'operators',
  comparison: 'comparisons',
  logical: 'logical operators',
  delimiter: 'delimiters',
  assign: 'assignment',
  identifier: 'identifiers',
  number: 'numbers',
  // DRAFT copy
  string: 'string literals',
  character: 'character literals',
}
const NODE_HEADS: Record<string, string> = {
  declaration: 'declarations',
  statement: 'statements',
  expression: 'expressions',
}
// DRAFT copy: what a class is, one line under its headline.
const TOKEN_BLURBS: Record<string, string> = {
  type: 'Keywords that name a kind of value, to declare variables and functions with.',
  keyword:
    "Words the language keeps for its own structure, so they can't be names.",
  operator: 'Symbols that work out a value from the values beside them.',
  comparison: 'Compare two values: 1 if true, 0 if false.',
  logical: 'Join two conditions: both true, or either.',
  delimiter: 'Punctuation that groups code or separates its parts.',
  assign: 'Stores the value on its right in the place on its left.',
  // Stanley's line (2026-10-02), its "and anything else" filled in from
  // the grammar: what else an IDENT names.
  identifier:
    'Names that identify variables, functions, and structs, as well as parameters, fields, and classes.',
  number: 'A whole number, in decimal digits.',
  string: 'Text between double quotes.',
  character: 'One character between single quotes.',
}
const NODE_BLURBS: Record<string, string> = {
  declaration:
    "Introduce a name: a variable, a struct's field, a function, or a struct or class type.",
  statement:
    'The steps a function takes. Each starts with a keyword, is a block in braces, or is an expression ended by `;`.',
  expression:
    'Anything that works out to a value: a number, a name, a call, or operators on other expressions.',
}
// DRAFT copy: each kind of node in the AST guide, an example of it in
// Mini-C and one line on what it is.
const NODE_NOTES: Record<string, Record<string, [string, string]>> = {
  declaration: {
    variable: ['int x;', 'A name for a value of its type.'],
    field: ['struct p { int x; };', 'A variable inside a struct or class.'],
    function: ['int f(int a) { … }', 'Parameters, a return type, and a body.'],
    prototype: ['int f(int a);', 'A function declared without its body.'],
    struct: ['struct p { … };', 'A type made of named fields.'],
    class: [
      'class C extends B { … }',
      'A struct with methods, which can extend another class.',
    ],
  },
  statement: {
    block: ['{ … }', 'Statements in braces, run in order.'],
    while: ['while (c) …', 'Runs its body while the condition is not 0.'],
    if: ['if (c) … else …', 'Runs one branch or the other.'],
    return: ['return x;', 'Leaves the function, with a value or without.'],
    continue: ['continue;', "Skips to the loop's next pass."],
    break: ['break;', 'Leaves the loop.'],
    expression: [
      'f(x);',
      'An expression run for what it does, its value dropped.',
    ],
  },
  expression: {
    number: ['42', 'A whole number.'],
    character: ["'a'", 'One character.'],
    string: ['"hi"', 'Text, as an array of characters.'],
    name: ['x', 'A variable, read for its value.'],
    call: ['f(1, 2)', 'Calls a function with arguments.'],
    operator: ['a + b', 'Works out a value from one or two others.'],
    assignment: ['x = 4', 'Stores a value in a place.'],
    index: ['a[i]', "An array's element."],
    field: ['s.x', "A struct's field."],
    'value at': ['*p', 'What a pointer points to.'],
    'address of': ['&x', 'Where a variable is, as a pointer.'],
    sizeof: ['sizeof(int)', "A type's size in bytes."],
    cast: ['(char*) p', 'A value taken as another type.'],
    new: ['new class C()', 'A new object of a class.'],
    'method call': ['c.f(x)', 'Calls a method on an object.'],
  },
}
// Advance of one character in the 11px token card.
const CARD_CHAR_PX = 6.6
// The built-in functions' signatures (SemanticUtils.builtIns): declared
// nowhere in the program, so a call to one shows it from here.
const BUILTINS: Record<string, string> = {
  print_s: '(char*) → void',
  print_i: '(int) → void',
  print_c: '(char) → void',
  read_c: '() → char',
  read_i: '() → int',
  mcmalloc: '(int) → void*',
}
// Room the `built-in` tag after a built-in's signature takes, in the
// badge's characters.
const BUILTIN_TAG = ' built-in'.length
// Operators that want ints on both sides (the compiler's BinOp rule);
// `==` and `!=` want the two sides the same instead.
const INT_OPS = new Set([
  '+',
  '-',
  '×',
  '/',
  '%',
  '<',
  '>',
  '<=',
  '>=',
  '&&',
  '||',
])
// The most a row takes while the parse view is on one statement.
const SCOPE_ROW_PX = 72
// Line height of the source editor; matches --row on .ac-source.
const SOURCE_ROW = 19
// Width of the editor's line-number gutter; matches .ac-source's columns.
const GUTTER_PX = 34
// The emit pane's rows and stack words, one to one with the editor's.
const ASM_ROW = SOURCE_ROW
// One character of the assembly's 12px monospace.
const ASM_CH = 7.2
// A dragged source height, kept per browser.
const SPLIT_KEY = 'mini-c-split'
// Whether the step's note sits in the pane under the source or floats.
const DOCK_KEY = 'mini-c-note-docked'
const NOTE_MIN_KEY = 'mini-c-note-minimized'
const SPLIT_MIN = SOURCE_ROW * 3 + 8
const WIDTH_KEY = 'mini-c-editor-width'
// The listing pane's width beside the stage, and its height along the
// bottom, once dragged.
const LISTING_W_KEY = 'mini-c-listing-width'
const LISTING_H_KEY = 'mini-c-listing-height'
// The editor column's range when its border with the stage is dragged; the
// stage keeps at least STAGE_MIN.
const EDITOR_MIN = 240
const STAGE_MIN = 360
// Scrollbars turned off in the options menu, per browser.
const BARE_KEY = 'mini-c-no-scrollbars'
const GUIDE_KEY = 'mini-c-no-guide'
const GUIDE_PIN_KEY = 'mini-c-guide-pinned'
const GUIDE_WINDOW_KEY = 'mini-c-guide-window'
// The AST guide beside the parser: off in the options menu, and its window.
const AST_KEY = 'mini-c-no-ast-guide'
const AST_WINDOW_KEY = 'mini-c-ast-window'
const AST_W = 300
// DRAFT copy: what Mini-C takes, beside the editor while it's in use, for
// someone who writes C the usual way. From the course's grammar and
// SemanticUtils' built-ins; every example was run through compiler.js, the
// right ones compiling and the `not` ones failing (2026-10-02).
// What's selected in the guide, as Markdown: a rule's title a heading,
// code in backticks, an example a fenced block (Stanley, 2026-10-02).
// Within one example it is that code as it stands.
function guideMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (!(node instanceof Element || node instanceof DocumentFragment)) return ''
  const inner = () => [...node.childNodes].map(guideMarkdown).join('')
  if (!(node instanceof Element)) return inner()
  if (node.classList.contains('ac-window-bar')) return ''
  switch (node.tagName) {
    case 'PRE': {
      // (its label on the box around it, when that is selected too)
      const label = node.parentElement?.getAttribute('data-label')
      return `\n${label ? `${label}:\n\n` : ''}\`\`\`c\n${(node.textContent ?? '').replace(/\n+$/, '')}\n\`\`\`\n\n`
    }
    case 'CODE':
      return `\`${node.textContent ?? ''}\``
    case 'H4':
      return `### ${inner().trim()}\n\n`
    case 'P':
      return `${inner().trim()}\n\n`
    default:
      return inner()
  }
}

// (`not`: the usual C for the same thing, which Mini-C rejects)
// An example's lines, its `//` comments muted.
function GuideCode({ code }: { code: string }) {
  return code.split('\n').map((line, i, all) => (
    <span
      key={i}
      className={line.trimStart().startsWith('//') ? 'cm' : undefined}
    >
      {line}
      {i < all.length - 1 && '\n'}
    </span>
  ))
}

// (`text`: a paragraph, or several)
type GuideRule = {
  title: string
  text?: string | string[]
  code?: string
  not?: string
}
const GUIDE: GuideRule[] = [
  {
    title: 'Declarations',
    // At the top of the function, then the rest of it (Stanley, 2026-10-02).
    code: 'void main() {\n  int x;\n  int y;\n  // rest of function\n  x = 4;\n  ...\n}',
    not: 'int x = 4;',
  },
  {
    title: 'Loops',
    text: 'There is no `for`, `do` or `switch`.',
    code: 'i = 0;\nwhile (i < 10) {\n  i = i + 1;\n}',
  },
  {
    // Every operator Mini-C has, a statement each (compiled with
    // compiler.js, 2026-10-02).
    title: 'Operators',
    code: [
      '// arithmetic',
      'x = a + b - c * d / e % f;',
      'x = -a;',
      '// comparison and logic',
      'y = a < b || a <= b || a > b;',
      'y = a >= b && a == b && a != b;',
      '// address and dereference',
      'p = &x;',
      'x = *p;',
      '// fields and indexing',
      'x = s.f + arr[0];',
      '// sizeof and casts',
      "x = sizeof(int) + (int)'c';",
    ].join('\n'),
  },
  {
    title: 'Field access',
    code: '// s is a struct\ns.field = 1;\n// p points to a struct\n(*p).field = 1;',
    not: 'p->field = 1;',
  },
  {
    title: 'Types',
    text: '`int`, `char` and `void`, structs, pointers and arrays.',
    code: 'struct node {\n  int value;\n  struct node* next;\n};\nchar name[8];',
  },
  {
    title: 'Built-ins',
    text: 'In place of the standard library:',
    // Their signatures as SemanticUtils declares them, each with what it
    // does and the cast the compiler's own tests write with it (tests/*.c:
    // print_s((char*)"..."), (struct Node*)mcmalloc(sizeof(struct Node))).
    code: [
      '// prints a string: (char*)"hi"',
      'void print_s(char* s);',
      '// prints an int',
      'void print_i(int i);',
      '// prints a char',
      'void print_c(char c);',
      '// reads a char from input',
      'char read_c();',
      '// reads an int from input',
      'int read_i();',
      '// allocates memory; cast it',
      'void* mcmalloc(int size);',
    ].join('\n'),
    not: 'malloc(size);\nprintf(format, ...);',
  },
]
const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]
// The interference graph keeps below a step's note (about four lines).
const NOTE_BAND = 104
// An interference node's radius, and the gap its edges stop short by.
const VR_RIM = 19 + 4
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

// Links only to where the page's own copy links: text from a visitor's
// program (a string, an error message) can't add one.
const LINK_HOSTS = new Set(['matklad.github.io'])
const linkable = (href: string) => {
  try {
    const url = new URL(href)
    return url.protocol === 'https:' && LINK_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

// Explanation strings mark code with backticks.
// `[Precedence](example:Precedence)` opens that example (`onExample`).
function Prose({
  text,
  onExample,
}: {
  text: string
  onExample?: (name: string) => void
}) {
  return (
    <>
      {text.split('`').map((part, i) =>
        i % 2 ? (
          <code key={i}>{part}</code>
        ) : (
          <span key={i}>
            {part.split(INLINE).map((run, j) => {
              const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(run)
              const example = link?.[2].match(/^example:(.+)$/)?.[1]
              if (link && example && onExample)
                return (
                  <button
                    key={j}
                    type="button"
                    className="ac-hint-link"
                    onClick={() => onExample(example)}
                  >
                    {link[1]}
                  </button>
                )
              if (link && linkable(link[2]))
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

// Detailed lexer mode: every class's lexemes, lit while the characters read
// so far could still become one; on the step that settles the token only the
// class it becomes is marked.
function CharTable({
  read,
  reader,
  final,
}: {
  read: string
  reader?: LexDecision
  final?: TokenClass
}) {
  return (
    // aria-hidden: it sits in the live step note, and the sentence above it
    // already says what matches.
    <table className="ac-char-table" aria-hidden="true">
      <tbody>
        {matchTable(read, reader, final).map((row) => (
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
// A path whose shape glides to each new `d`, through a motion value the
// effect below animates. As a plain `animate={{ d }}` it froze: in
// development, React's StrictMode detaches and reattaches the refs of a
// keyed child it moves (a socket shifting along when another arrives), and
// Motion takes the detach for an unmount, stops the glide it had just
// started, and on reattach counts the new shape as reached. The effect runs
// again on that reattach, and resumes from where the path is (2026-10-01).
// Everything else (pathLength, opacity, exit) stays Motion's to animate.
function GlidingPath({
  d,
  glide,
  ...rest
}: { d: string; glide: ValueAnimationTransition<string> } & Omit<
  ComponentProps<typeof motion.path>,
  'd'
>) {
  const shape = useMotionValue(d)
  useEffect(() => {
    const run = animate(shape, d, glide)
    return () => run.stop()
    // (a new shape starts a glide; the timing is read as it starts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape, d])
  return <motion.path d={shape} {...rest} />
}

// Most steps only light a different edge. Keep settled paths out of
// Motion's render work; their presence and the stage's epoch still govern
// arrivals and exits (Stanley, 2026-10-01).
const TreeEdge = memo(function TreeEdge({
  d,
  className,
  opacity,
  duration,
  drawTime,
  moveTime,
  immediate,
}: {
  d: string
  className?: string
  opacity: number
  duration: number
  drawTime: number
  moveTime: number
  immediate: boolean
}) {
  // A detached edge (a step back) goes at once: it keeps the places it had,
  // so while the view moves under it, it would hang where the tree was.
  const leave = {
    duration: Math.min(0.15, duration / 2),
    ease: 'easeOut' as const,
  }
  return (
    <GlidingPath
      data-edge=""
      className={className}
      d={d}
      glide={immediate ? { duration: 0 } : { duration: moveTime, ease: EASE }}
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity }}
      exit={{
        pathLength: 0,
        opacity: 0,
        transition: leave,
      }}
      transition={{
        duration,
        ease: EASE,
        ...(immediate && {
          d: { duration: 0 },
          left: { duration: 0 },
          top: { duration: 0 },
          scale: { duration: 0 },
        }),
        // An attached edge's stroke draws across the step, evenly, rather
        // than mostly in its first fifth as the page's easing would.
        pathLength: { duration: drawTime, ease: 'easeInOut' },
      }}
    />
  )
})

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
  rule,
}: {
  label: string
  options: string[]
  value: number
  placeholder: string
  onChange: (index: number) => void
  /** A rule above this row: where a new group starts. */
  rule?: number
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
              className={`${i === active ? 'active' : ''} ${i === rule ? 'ruled' : ''}`}
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
  // Every program goes through the real compiler in a worker (real.ts),
  // the examples too (Stanley, 2026-10-02). While it loads, and if it
  // fails, an example shows the trace recorded from it ahead of time and a
  // typed program the teaching compiler's.
  const [real, setReal] = useState<{ source: string; trace: Trace } | null>(
    null,
  )
  const live =
    real?.source === source ? real.trace : compiledTrace(source) || undefined
  // The last source the real compiler gave up on; until then the teaching
  // compiler's errors are held back, as the real trace may replace them.
  const [realFailed, setRealFailed] = useState<string | null>(null)
  const realPending =
    !live && realFailed !== source && source.length <= REAL_MAX_CHARS
  // The compiler's frames, live or recorded: the parse steps in the order
  // its parser took them, and the name and type steps its analysers
  // recorded.
  // Emit line by line, or in blocks (emit-view.ts).
  const [emitBlocks, setEmitBlocks] = useState(false)
  const namedTrace = useMemo(() => {
    const recorded = live ?? reference?.trace
    return recorded
      ? { trace: recorded, recorded: true }
      : { trace: buildTrace(source), recorded: false }
  }, [source, reference, live])
  const withEmit = useCallback(
    (blocks: boolean) =>
      !namedTrace.recorded
        ? namedTrace.trace
        : withTypeSteps(
            withoutLiveness(
              withoutPlaceholders(
                blocks
                  ? withEmitBlocks(namedTrace.trace)
                  : withEmitLines(namedTrace.trace),
              ),
            ),
          ),
    [namedTrace],
  )
  const baseTrace = useMemo(() => withEmit(emitBlocks), [withEmit, emitBlocks])
  // Detailed lexer mode reads a character per step instead of a token.
  const [detailed, setDetailed] = useState(false)
  // Step titles over the explanation; off while Stanley reads without them.
  const [titles, setTitles] = useState(false)
  // The footer's settings menu (its cog), which holds the view switches.
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
  // About: its own tab on a wide screen; on a phone, where the tabs need
  // the row, it opens from the settings menu. Either way a press anywhere
  // else closes it (Stanley, 2026-10-02).
  const [aboutOpen, setAboutOpen] = useState(false)
  const aboutRef = useRef<HTMLDetailsElement>(null)
  const { resolvedTheme, setTheme } = useTheme()
  useEffect(() => {
    if (!aboutOpen) return
    const away = (event: PointerEvent) => {
      if (!aboutRef.current?.contains(event.target as Node)) setAboutOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setAboutOpen(false)
      // (back to what opened it: the menu's cog on a phone, its tab here)
      const phone = window.matchMedia('(max-width: 640px)').matches
      ;(phone
        ? moreRef.current?.querySelector('button')
        : aboutRef.current?.querySelector('summary')
      )?.focus()
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [aboutOpen])
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
    () => treePositions(trace, (n) => n.label.length * CHAR_PX + 2, TREE_GAP),
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
        ...trace.instructions.map((ins) => {
          const args = (ins.text ?? ins.op).split(/\s+(.*)/)[1] ?? ''
          // (as long again once registers have their real names: v8 → $t3)
          return Math.max(
            args.length,
            args.replace(/(?<!\$)\bv\d+\b/g, '$t0').length,
          )
        }),
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
      // A name or literal typed on its own step (type-view.ts); a
      // declaration's type is already in its label, and a function's
      // shows as its signature (functionType).
      if (
        f.why.kind === 'check.type' &&
        trace.nodes[f.why.node].kind !== 'declare' &&
        trace.nodes[f.why.node].kind !== 'function' &&
        !at.has(f.why.node)
      )
        at.set(f.why.node, { type: f.why.type, step: i })
      if (
        f.why.kind !== 'check.expr' &&
        f.why.kind !== 'check.fits' &&
        f.why.kind !== 'check.typeError'
      )
        return
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
            f.why.kind === 'check.fits' ||
            f.why.kind === 'check.typeError') &&
          f.span.start >= fn.start &&
          f.span.end <= fn.end,
      )
      if (!name || !result || step < 0) continue
      out.set(fn.id, { type: `(${params.join(', ')}) → ${result}`, step })
    }
    return out
  }, [trace])
  const functions = useMemo(() => {
    const byName = new Map<string, Trace['nodes'][number]>()
    for (const n of trace.nodes)
      if (n.kind === 'function' && !byName.has(n.label)) byName.set(n.label, n)
    return byName
  }, [trace])
  // What a call's arguments must match, its function's signature:
  // `twice : (int) → int`. A parameter's type is written out, never worked
  // out; the arguments are what get derived and checked against it.
  const callNeed = useCallback(
    (id: number) => {
      const n = trace.nodes[id]
      if (n.kind !== 'call') return undefined
      const name = n.label.replace(/\(\)$/, '')
      const fn = functions.get(name)
      const sig = fn ? functionType.get(fn.id)?.type : BUILTINS[name]
      return sig ? `${name} : ${sig}` : undefined
    },
    [trace, functionType, functions],
  )
  // A call to a built-in: its signature is tagged so, having no
  // declaration in the program to link to.
  const builtinCall = useCallback(
    (id: number) => {
      const n = trace.nodes[id]
      const name = n.label.replace(/\(\)$/, '')
      return n.kind === 'call' && name in BUILTINS && !functions.has(name)
    },
    [trace, functions],
  )
  // Each type badge (or what a return must match): its width in pixels and
  // the step it first shows. The type pass makes room node by node as it
  // reaches them, rather than all at once.
  const badgeTexts = useMemo(() => {
    const out: { id: number; width: number; step: number; only?: boolean }[] =
      []
    const fit = (id: number, text: string, step: number, only?: boolean) =>
      out.push({ id, width: text.length * TYPE_PX + 13, step, only })
    for (const [id, { type, step }] of typedStep) fit(id, type, step)
    for (const [id, { type, step }] of functionType) fit(id, type, step)
    trace.frames.forEach((f, step) => {
      if (f.why.kind !== 'check.expr') return
      const sig = callNeed(f.why.node)
      if (sig)
        fit(
          f.why.node,
          builtinCall(f.why.node) ? sig + ' '.repeat(BUILTIN_TAG) : sig,
          step,
          // (a call's signature shows on its own step only)
          true,
        )
    })
    return out
  }, [trace, typedStep, functionType, callNeed, builtinCall])
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
  // The step a name was found to have no declaration (or was declared
  // twice, or never defined); from there on, in the check phase, it keeps a
  // red tint.
  const missingStep = useMemo(() => {
    const at = new Map<number, number>()
    trace.frames.forEach((f, i) => {
      if (f.why.kind === 'check.unresolved') at.set(f.why.use, i)
      if (f.why.kind === 'check.nameError' && !at.has(f.why.node))
        at.set(f.why.node, i)
    })
    return at
  }, [trace])
  // Name-link routes survive steps with the same geometry (below).
  const routeCache = useRef<{
    trace: Trace
    key: string
    router: ReturnType<typeof linkRouter>
  } | null>(null)
  // Once parsing starts, a `*` that multiplies waits in the tray as the `×`
  // the tree will show; a prefix `*` stays as typed.
  // A declaration's type tokens (`int` in `int twice(` or `int n`) are kept
  // in its node, not thrown away like `(` or `;`. They wait in the tray
  // until the node lands, then slide into it and fade. So do the other
  // tokens a declaration or expression reads without a node of their own:
  // `[3]` in `int a[3]`, a struct's fields, the `]` of `a[0]`, the `x` of
  // `.x`. Each goes to the innermost node around it.
  const absorbedBy = useMemo(() => {
    const by = new Map<number, number>()
    const anchors = new Set(trace.nodes.map((n) => n.token))
    const width = (id: number) => trace.nodes[id].end - trace.nodes[id].start
    for (const n of trace.nodes)
      if (n.kind === 'function' || n.kind === 'declare')
        for (const t of trace.tokens)
          if (t.start >= n.start && t.id < n.token) by.set(t.id, n.id)
    for (const n of trace.nodes) {
      if (n.kind !== 'declare' && n.kind !== 'expr') continue
      for (const t of trace.tokens) {
        if (t.start < n.start || t.end > n.end || t.id < n.token) continue
        if (anchors.has(t.id) || KEEP_HIDDEN.includes(t.text)) continue
        const held = by.get(t.id)
        if (held === undefined || width(n.id) < width(held)) by.set(t.id, n.id)
      }
    }
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
      // (a slide about the bars needs them: the teaching compiler, when the
      // real one can't run, draws none)
      const shown = slides?.filter(
        (s) =>
          (namedTrace.recorded || !s.lanes) &&
          (!s.onlyIn || s.onlyIn === reference?.name) &&
          s.notIn !== reference?.name,
      )
      if (first > 0 && shown?.length)
        at.set(first - 1, { phase: phase as Phase, slides: shown })
    }
    for (const { phase, starts, slides } of STEP_SLIDES) {
      const first = trace.frames.findIndex(
        (f, i) => i > 0 && f.phase === phase && starts(f, trace.frames[i - 1]),
      )
      if (first <= 0) continue
      // (a pass that now opens its phase, as colouring does in Registers,
      // follows the phase's own slides)
      const deck = at.get(first - 1)
      if (!deck) at.set(first - 1, { phase, slides })
      else if (deck.phase === phase)
        at.set(first - 1, { phase, slides: [...deck.slides, ...slides] })
    }
    // The welcome's own slides come first on its step, before the lexer's.
    const opening = at.get(0)
    at.set(0, {
      phase: opening?.phase ?? trace.frames[0]?.phase ?? 'Tokens',
      slides: [...README_SLIDES, ...(opening?.slides ?? [])],
    })
    return at
  }, [trace.frames, namedTrace.recorded, reference?.name])
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [hover, setHover] = useState<number | null>(null)
  const [hoverToken, setHoverToken] = useState<number | null>(null)
  // Clicking a token toggles class lists on every token card until clicked again.
  const [cardOpen, setCardOpen] = useState(false)
  // PROTOTYPE (Stanley, 2026-09-27: "grab a node and drag it … like
  // Obsidian graph"): a tree node dragged on the stage stays where it's
  // dropped, its edges, badges and links following, until it's
  // double-clicked or the program changes. Offsets in stage units (680 ×
  // 480).
  const [nudged, setNudged] = useState<Map<number, { x: number; y: number }>>(
    () => new Map(),
  )
  const [dragging, setDragging] = useState<number | null>(null)
  const nodeDrag = useRef<{
    id: number
    pointer: number
    at: { x: number; y: number }
    from: { x: number; y: number }
    moved: boolean
  } | null>(null)
  // When a drag last ended: the click that follows it isn't one.
  const dragEnd = useRef(0)
  // The stack column: docked in the note card, or floating where it was
  // dropped (top left, in the simulation's coordinates).
  const [stackAt, setStackAt] = useState<{ x: number; y: number } | null>(null)
  const stackDrag = useDragControls()
  const stackStart = useRef<ReactPointerEvent | null>(null)
  // The stack's place by the listing, where it docks (stackPane): under it
  // in a pane of its own when the listing is a column at the side, folded
  // to its bar or as tall as dragged (null: as tall as the stack); beside
  // it when the listing runs along the bottom (Stanley, 2026-10-01).
  const [stackFold, setStackFold] = useState(false)
  const [stackH, setStackH] = useState<number | null>(null)
  const stackSplit = useRef<{ y: number; h: number; max: number } | null>(null)
  const stackDockRef = useRef<HTMLDivElement>(null)
  const noteRef = useRef<HTMLElement>(null)
  const [hoverIns, setHoverIns] = useState<number | null>(null)
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
  // Kept for the visit only: each load opens with the note fitting its
  // text (Stanley, 2026-10-02: a saved split left the welcome scrolling).
  // An older visit's saved split is cleared.
  useEffect(() => {
    try {
      localStorage.removeItem(SPLIT_KEY)
    } catch {}
  }, [])
  const saveSplit = (height: number | null) => setSourceHeight(height)
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
  // The listing pane's size once its edge has been dragged; null keeps the
  // size its lines need (width) or half the stage (height).
  const [listingSize, setListingSize] = useState<{
    w: number | null
    h: number | null
  }>({ w: null, h: null })
  const listingDrag = useRef<{
    at: number
    size: number
    axis: 'w' | 'h'
  } | null>(null)
  const [listingDragging, setListingDragging] = useState(false)
  // A phone is one screen: the stage takes what the listing, the source
  // and the dock leave. The listing's top edge trades height with the
  // stage; the source's top edge with the listing, or with the stage
  // before there is one; the dock's with the stage. The note fits its
  // text, gliding from step to step, until its edge is dragged; then it
  // keeps that height (Stanley, 2026-10-01). Null: the default size.
  const NOTE_H = 84
  type FlowSizes = {
    listing: number | null
    source: number | null
    note: number | null
  }
  const [flowSizes, setFlowSizes] = useState<FlowSizes>({
    listing: null,
    source: null,
    note: null,
  })
  type FlowEdge = 'listing' | 'editor' | 'note'
  type FlowFrom = {
    listing: number
    source: number
    note: number
    scene: number
  }
  const flowDrag = useRef<{
    edge: FlowEdge
    at: number
    from: FlowFrom
  } | null>(null)
  // The stage and its listing together: what a phone's listing is cut from.
  const stageRef = useRef<HTMLElement>(null)
  const [stageHeight, setStageHeight] = useState(0)
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(([entry]) =>
      setStageHeight(entry.contentRect.height),
    )
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])
  // A phone's side pane (the class, the scopes, the stack) shows only its
  // name until tapped open.
  const [sideOpen, setSideOpen] = useState(false)
  // The step's note, docked in the pane under the source over what that
  // pane keeps, or floating in its own window with that pane's record
  // (Stanley, 2026-09-29: one place for both, not two). Trial: the lexer's
  // steps only, on a wide screen; elsewhere it floats as before.
  const [noteDocked, setNoteDocked] = useState(true)
  useEffect(() => {
    try {
      if (localStorage.getItem(DOCK_KEY) === '0') setNoteDocked(false)
    } catch {}
  }, [])
  // Docked, the note can fold down to its bar at the bottom of the editor,
  // the source taking its room (Stanley, 2026-10-01).
  const [noteMin, setNoteMin] = useState(false)
  useEffect(() => {
    try {
      if (localStorage.getItem(NOTE_MIN_KEY) === '1') setNoteMin(true)
    } catch {}
  }, [])
  const minimizeNote = (min: boolean) => {
    setNoteMin(min)
    try {
      localStorage.setItem(NOTE_MIN_KEY, min ? '1' : '0')
    } catch {}
  }
  const dockNote = (docked: boolean) => {
    setNoteDocked(docked)
    try {
      localStorage.setItem(DOCK_KEY, docked ? '1' : '0')
    } catch {}
  }
  useEffect(() => {
    try {
      const w = Number(localStorage.getItem(LISTING_W_KEY))
      const h = Number(localStorage.getItem(LISTING_H_KEY))
      setListingSize({ w: w > 0 ? w : null, h: h > 0 ? h : null })
    } catch {}
  }, [])
  const saveListing = (axis: 'w' | 'h', size: number | null) => {
    setListingSize((s) => ({ ...s, [axis]: size }))
    try {
      const key = axis === 'w' ? LISTING_W_KEY : LISTING_H_KEY
      if (size === null) localStorage.removeItem(key)
      else localStorage.setItem(key, String(Math.round(size)))
    } catch {}
  }
  // Scrollbars off: panes scroll by wheel, touch or keys, and keep only
  // the dashed rail as a hint (animated.css, `.ac.bare`).
  const [bare, setBare] = useState(false)
  // The syntax guide beside the editor while it has focus; off from the ?
  // menu (Stanley, 2026-10-02).
  const [guideOn, setGuideOn] = useState(true)
  const [guideHeld, setGuideHeld] = useState(false)
  // Pinned (its pin, or moved or sized by hand), it stays up as a window
  // of its own; unpinned, it goes, and next opens by the editor again
  // (Stanley, 2026-10-02).
  const [guidePinned, setGuidePinned] = useState(false)
  const [guideEpoch, setGuideEpoch] = useState(0)
  useEffect(() => {
    try {
      setGuidePinned(localStorage.getItem(GUIDE_PIN_KEY) === '1')
    } catch {}
  }, [])
  const pinGuide = (on: boolean) => {
    setGuidePinned(on)
    try {
      if (on) localStorage.setItem(GUIDE_PIN_KEY, '1')
      else {
        localStorage.removeItem(GUIDE_PIN_KEY)
        localStorage.removeItem(GUIDE_WINDOW_KEY)
      }
    } catch {}
    if (on) return
    setGuideHeld(false)
    setGuideEpoch((n) => n + 1)
  }
  useEffect(() => {
    try {
      setGuideOn(localStorage.getItem(GUIDE_KEY) !== '1')
    } catch {}
  }, [])
  const saveGuide = (on: boolean) => {
    setGuideOn(on)
    try {
      if (on) localStorage.removeItem(GUIDE_KEY)
      else localStorage.setItem(GUIDE_KEY, '1')
    } catch {}
  }
  // The AST guide: every kind of node the parser makes, by class, while the
  // parser runs. Its × turns it off until the settings menu turns it back on.
  const [astOn, setAstOn] = useState(true)
  // The kind pointed at in it, whose note shows under its class.
  const [astPick, setAstPick] = useState<{ cls: string; kind: string } | null>(
    null,
  )
  useEffect(() => {
    try {
      setAstOn(localStorage.getItem(AST_KEY) !== '1')
    } catch {}
  }, [])
  const saveAst = (on: boolean) => {
    setAstOn(on)
    try {
      if (on) localStorage.removeItem(AST_KEY)
      else localStorage.setItem(AST_KEY, '1')
    } catch {}
  }
  // Maximized: the tool covers the window, the site's header and all, until
  // back (or Esc). It opens that way (Stanley, 2026-09-29).
  const [max, setMax] = useState(true)
  useEffect(() => {
    if (!max) return
    const page = document.documentElement
    const was = page.style.overflow
    page.style.overflow = 'hidden'
    return () => {
      page.style.overflow = was
    }
  }, [max])
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
  // the pointer rests on the scrollbar, but not when a step scrolls the pane
  // (the assembly follows the current row), the pane is only hovered, or the
  // pointer just crosses the bar on its way in. Only the axis scrolled or
  // hovered lights: data-reveal holds "x", "y" or both.
  // An attribute rather than a class, so a render doesn't clear it.
  const rootRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const timers = new Map<Element, ReturnType<typeof setTimeout>>()
    // The thumb is light in the rail (rail-curve.ts), which does its own
    // lighting, on a scroll and on a dwell.
    const curve = startRailCurve(root)
    const reveal = (pane: Element, axes: string, ms: number) => {
      pane.setAttribute('data-reveal', axes)
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
      if (curve) return
      const pane = paneOf(e.target)
      if (!pane) return
      const axes =
        e instanceof WheelEvent
          ? Math.abs(e.deltaX) > Math.abs(e.deltaY)
            ? 'x'
            : 'y'
          : 'x y'
      reveal(pane, axes, 900)
    }
    // The bar the pointer is resting on; it lights after DWELL_MS there.
    let resting: {
      pane: Element
      axis: string
      timer: ReturnType<typeof setTimeout>
    } | null = null
    const moved = (e: PointerEvent) => {
      if (curve) return
      const pane = paneOf(e.target)
      // A scrollbar is what lies past the pane's client area, on an axis
      // that scrolls (an empty gutter kept by scrollbar-gutter isn't one).
      let axis: string | null = null
      if (pane) {
        const box = pane.getBoundingClientRect()
        const p = pane as HTMLElement
        // On the zoomed stage the box is scaled and the client sizes aren't.
        const kx = box.width / p.offsetWidth || 1
        const ky = box.height / p.offsetHeight || 1
        if (
          pane.scrollHeight > pane.clientHeight &&
          e.clientX > box.left + (pane.clientLeft + pane.clientWidth) * kx
        )
          axis = 'y'
        else if (
          pane.scrollWidth > pane.clientWidth &&
          e.clientY > box.top + (pane.clientTop + pane.clientHeight) * ky
        )
          axis = 'x'
      }
      if (!pane || !axis) {
        if (resting) clearTimeout(resting.timer)
        resting = null
        return
      }
      // Already lit: keep it lit while the pointer stays on it.
      if (pane.getAttribute('data-reveal')?.includes(axis)) {
        reveal(pane, axis, 600)
        return
      }
      if (resting?.pane === pane && resting.axis === axis) return
      if (resting) clearTimeout(resting.timer)
      const on = { pane, axis }
      resting = {
        ...on,
        timer: setTimeout(() => reveal(on.pane, on.axis, 600), DWELL_MS),
      }
    }
    root.addEventListener('wheel', scrolled, { passive: true })
    root.addEventListener('touchmove', scrolled, { passive: true })
    root.addEventListener('pointermove', moved)
    return () => {
      root.removeEventListener('wheel', scrolled)
      root.removeEventListener('touchmove', scrolled)
      root.removeEventListener('pointermove', moved)
      for (const t of timers.values()) clearTimeout(t)
      if (resting) clearTimeout(resting.timer)
      curve?.()
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
  // The stage pans and zooms (canvas-zoom.ts).
  const canvasRef = useRef<HTMLDivElement>(null)
  const canvas = useRef<Canvas | null>(null)
  // The pass a hand last moved the view in, and the one showing (follow).
  const handHeld = useRef<string | null>(null)
  const passRef = useRef('')
  const [rest, setRest] = useState<CanvasRest>({
    home: true,
    least: false,
    most: false,
  })
  const [sceneWidth, setSceneWidth] = useState(VIEW_W)
  const [sceneHeight, setSceneHeight] = useState(VIEW_H)
  // The phone layout's smaller pieces (animated.css, max-width 640px).
  const [narrow, setNarrow] = useState(false)
  const reduced = useReducedMotion()
  // A whole step within the trace, whatever set it (a link's ?frame=0.5).
  const index = Math.max(
    0,
    Math.min(Number.isSafeInteger(step) ? step : 0, trace.frames.length - 1),
  )
  const frame = trace.frames[index]
  // Membership is asked for every edge and piece, not just once per step.
  const attached = useMemo(() => new Set(frame.attached), [frame.attached])
  const consumed = useMemo(() => new Set(frame.consumed), [frame.consumed])
  // Which way the last step went. Stepping back doesn't replay the step it
  // lands on: its sequences (rows in turn, a register travelling up the
  // tree, the name pass's walk, a link drawing) settle straight to where
  // that step ends, with plain tweens.
  const stepped = useRef({ index, back: false })
  if (stepped.current.index !== index)
    stepped.current = { index, back: index < stepped.current.index }
  const back = stepped.current.back
  // Jumps: a seek of more than a step (the scrubber, a tab, reset) or a new
  // program. The stage's animated groups start over at each one, drawn in
  // place: an exit cut short by the same piece coming back (scrubbing back
  // and forth over a long program) otherwise left it on the stage for good
  // (Stanley, 2026-10-01: trails of tokens and edges). Single steps animate
  // as before.
  const jumped = useRef({ index, trace, count: 0 })
  if (jumped.current.index !== index || jumped.current.trace !== trace)
    jumped.current = {
      index,
      trace,
      count:
        jumped.current.count +
        (jumped.current.trace !== trace ||
        Math.abs(index - jumped.current.index) > 1
          ? 1
          : 0),
    }
  // Heals: the same for single steps, once a step has settled, if any
  // piece, edge or socket is still on the stage that the step doesn't
  // draw (holding an arrow back and forth cuts exits short too; below).
  const [heals, setHeals] = useState(0)
  const epoch = jumped.current.count + heals
  // (the first mount animates in as ever; after a jump, drawn in place;
  // each group's key is its own, as they share a parent)
  const firstMount = epoch === 0
  // What this render draws in each checked group, counted as it's drawn.
  const drawn = useRef({ pieces: 0, edges: 0, held: 0 })
  drawn.current = { pieces: 0, edges: 0, held: 0 }
  const count = <T,>(group: keyof typeof drawn.current, list: T[]) => {
    drawn.current[group] = list.filter(Boolean).length
    return list
  }
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
  // A character the tokeniser only looked at, to see where the token ends.
  const peeked =
    frame.why.kind === 'lex.char' && lexState(trace, frame.why).look

  const clearHover = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = null
    setHover(null)
    setHoverToken(null)
    setHoverIns(null)
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
      if (!(
        event.target instanceof Element && event.target.closest('[data-vr]')
      ))
        setRegFocus(null)
    }
    window.addEventListener('pointerdown', away)
    return () => window.removeEventListener('pointerdown', away)
  }, [pinned])
  useEffect(() => {
    if (compiledTrace(source)) return
    const abort = new AbortController()
    // (an example at once, and with less patience for a slow load: its
    // recorded trace is the same program's)
    const timer = setTimeout(
      () => {
        compileReal(
          source,
          abort.signal,
          reference ? PRESET_LOAD_MS : undefined,
        ).then(
          (trace) => {
            setReal({ source, trace })
            // An example's live trace is the one it already shows: its step
            // (a link's ?frame=) stays. Anything else starts from the top,
            // as an edit does.
            if (reference) return
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
      },
      reference ? 0 : 250,
    )
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
  // Holding a step arrow steps on as a held key does: once, then again
  // after a pause, then quickly, until it's let go anywhere.
  const moveNow = useRef(move)
  useEffect(() => {
    moveNow.current = move
  }, [move])
  const holdTimer = useRef(0)
  const stopHold = useCallback(() => {
    clearTimeout(holdTimer.current)
    holdTimer.current = 0
    window.removeEventListener('pointerup', stopHold)
    window.removeEventListener('pointercancel', stopHold)
    window.removeEventListener('blur', stopHold)
  }, [])
  const startHold = (delta: number) => {
    stopHold()
    moveNow.current(delta)
    const again = (wait: number) => {
      holdTimer.current = window.setTimeout(() => {
        moveNow.current(delta)
        again(HOLD_REPEAT_MS)
      }, wait)
    }
    again(HOLD_DELAY_MS)
    window.addEventListener('pointerup', stopHold)
    window.addEventListener('pointercancel', stopHold)
    window.addEventListener('blur', stopHold)
  }
  useEffect(() => stopHold, [stopHold])
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
    if (Number.isSafeInteger(at) && at > 0) setStep(at)
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
    // Only once the stage settles: WebKit throws after 100 replaceState
    // calls in 10s, which a scrub or a held step key passes in seconds,
    // and a throw here takes the whole page down. Losing the address bar
    // is fine; losing the page isn't.
    const t = window.setTimeout(() => {
      try {
        window.history.replaceState(window.history.state, '', url)
      } catch {}
    }, 250)
    return () => window.clearTimeout(t)
  }, [linked, playing, reference, index, detailed, titles, emitBlocks])

  // The name pass walks the tree between the names it looks at: from the
  // last one up to where their paths meet, then down to this one. Its
  // edges light in turn, [parent, child, down], before the lookup draws.
  const walk = useMemo(() => {
    const nameAt = (f: Frame | undefined) => {
      const v = f?.why
      if (v?.kind === 'check.declare') return v.decl
      if (v?.kind === 'check.nameError') return v.node
      if (
        v?.kind === 'check.resolve' ||
        v?.kind === 'check.unresolved' ||
        v?.kind === 'check.builtin' ||
        v?.kind === 'check.link'
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
      (ins.text?.match(/(?<!\$)\bv\d+\b/g) ?? []).some((r) => r !== ins.dest),
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
      // (a separator's arrows size it; they aren't steps)
      if (event.defaultPrevented) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key
      if (pinned && key === 'Escape') {
        event.preventDefault()
        return setRegFocus(null)
      }
      if (key === 'Escape' && max) {
        event.preventDefault()
        return setMax(false)
      }
      if (event.code === 'Space' && !target?.closest('button,summary')) {
        event.preventDefault()
        play()
      } else if (key === 'h' || key === 'k' || key === 'ArrowLeft') move(-1)
      else if (key === 'l' || key === 'j' || key === 'ArrowRight') move(1)
      else if (key === 'r') seek(0)
      else if (key === '0') {
        handHeld.current = null
        canvas.current?.home(!reduced)
        setNudged(new Map())
      } else if (key === 'e') textRef.current?.focus()
      else if (key === '-') bumpSpeed(-1)
      else if (key === '=' || key === '+') bumpSpeed(1)
      else if (/^[1-6]$/.test(key)) jumpTab(tabs[Number(key) - 1])
      else if (key === 'f') setMax((m) => !m)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [move, play, seek, bumpSpeed, jumpTab, pinned, reduced, max])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const observer = new ResizeObserver(([entry]) => {
      setSceneWidth(entry.contentRect.width || VIEW_W)
      setSceneHeight(entry.contentRect.height || VIEW_H)
    })
    observer.observe(scene)
    return () => observer.disconnect()
  }, [])
  // A phone's width: from the query itself, so it holds even before the
  // stage is first measured (a page loaded out of sight).
  useEffect(() => {
    const query = window.matchMedia('(max-width: 640px)')
    const update = () => setNarrow(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    const scene = sceneRef.current,
      layer = canvasRef.current
    if (!scene || !layer) return
    canvas.current = startCanvas(scene, layer, setRest, () => {
      handHeld.current = passRef.current
    })
    return () => {
      canvas.current?.stop()
      canvas.current = null
    }
  }, [])
  // Where the note window sits over the canvas, in the canvas's own pixels
  // (it doesn't pan or zoom with it): a hover card keeps out from under it.
  const [noteShade, setNoteShade] = useState<{
    left: number
    top: number
    right: number
    bottom: number
  } | null>(null)
  useLayoutEffect(() => {
    const layer = canvasRef.current
    const note = layer?.closest('.ac')?.querySelector<HTMLElement>('.ac-window')
    if (hover === null || !layer || !note) return setNoteShade(null)
    const l = layer.getBoundingClientRect()
    const n = note.getBoundingClientRect()
    const k = l.width / Math.max(1, layer.offsetWidth)
    setNoteShade({
      left: (n.left - l.left) / k,
      top: (n.top - l.top) / k,
      right: (n.right - l.left) / k,
      bottom: (n.bottom - l.top) / k,
    })
  }, [hover, index, slide])
  // A new program starts with its nodes where the layout puts them.
  useEffect(() => setNudged(new Map()), [trace])
  // A new program starts fitted.
  useEffect(() => canvas.current?.home(false), [trace])

  // Keep the active line third from the top, and again whenever the source
  // is resized (a tall note shrinks it mid-token). Sideways, the pane stays
  // at its left edge unless the step's mark would be out of view.
  useEffect(() => {
    const pane = scrollRef.current
    if (!pane || editing) return
    const row = source.slice(0, activeSpan.start).split('\n').length
    const scroll = () => {
      pane.scrollTop = Math.max(0, (row - 3) * SOURCE_ROW)
      const mark =
        pane.querySelector<HTMLElement>('.ac-text mark.cursor') ??
        pane.querySelector<HTMLElement>('.ac-text mark')
      const x = mark?.offsetLeft ?? 0
      const width = Math.min(mark?.offsetWidth ?? 0, 80)
      const seen = pane.clientWidth - GUTTER_PX
      if (x < pane.scrollLeft || x + width > pane.scrollLeft + seen - 16)
        pane.scrollLeft = x < seen * 0.8 ? 0 : x - seen * 0.3
    }
    scroll()
    const observer = new ResizeObserver(scroll)
    observer.observe(pane)
    return () => observer.disconnect()
  }, [activeSpan.start, source, editing])

  const update = (text: string) => {
    if (text.length > MAX_EDIT_CHARS) text = text.slice(0, MAX_EDIT_CHARS)
    setSource(text)
    setStep(0)
    setSlide(0)
    setPlaying(false)
    clearHover()
  }
  // A slide's link to an example (the parser's to Precedence) opens it on
  // the first slide only it has, once its slides are laid out.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const openExample = (name: string) => {
    const example = examples.find((e) => e.name === name)
    if (!example) return
    update(example.source)
    setOpenOn(name)
  }
  useEffect(() => {
    if (!openOn || reference?.name !== openOn) return
    for (const [at, deck] of decks) {
      const i = deck.slides.findIndex((s) => s.onlyIn === openOn)
      if (i < 0) continue
      setStep(at)
      setSlide(i + 1)
      break
    }
    setOpenOn(null)
  }, [openOn, reference?.name, decks])

  const late = frame.phase === 'Emit' || frame.phase === 'Registers'
  // Emit and registers: the listing slides out in a pane of its own over
  // the stage's right side, or along its bottom when the stage is too
  // narrow for both. The tree keeps the whole stage and the layout the
  // checks gave it; what the pane covers, the canvas pans out from under
  // (Stanley, 2026-09-28: "it's more controlled and it doesn't fuck with
  // the bounds of the scrollable canvas").
  const lanesW = lanesWidth(lanes.columns)
  // (the lanes sit just past the longest line)
  const lanesAt = 34 + (9 + operandsCh) * ASM_CH
  // The listing's width, lanes included; the pane adds its scrollbar's
  // gutter and its border, so a listing that fits never scrolls sideways.
  const listingMin = Math.ceil(lanesAt + lanesW + 12)
  const listingFits = Math.round(
    Math.min(Math.max(listingMin + 9 + 1, 240), sceneWidth * 0.55),
  )
  const listingSide = sceneWidth - listingFits >= 280
  // Dragged, it can be narrower than its lines (it scrolls sideways) or
  // wider, as long as some of the stage stays in view; the stack's pane
  // under it scrolls sideways too (Stanley, 2026-10-01: it needn't be
  // as wide as the stack).
  const clampListingW = (w: number) =>
    Math.round(Math.min(Math.max(w, 160), sceneWidth - 200))
  const clampListingH = (h: number) =>
    Math.round(Math.min(Math.max(h, 96), sceneHeight - 96))
  const listingW =
    listingSize.w === null ? listingFits : clampListingW(listingSize.w)
  // A short stage (a phone's) keeps all of itself: the pane goes under it
  // and the page grows, rather than covering half of it.
  // (a phone's always: a taller stage, dragged so, keeps the pane under it)
  const listingFlow = !listingSide && (narrow || sceneHeight < 480)
  // (a phone's: under half its stage, as dragged, always leaving the
  // stage its floor)
  const FLOW_STAGE_MIN = 120
  const flowListing = Math.round(
    Math.max(
      96,
      Math.min(
        flowSizes.listing ?? Math.min(220, stageHeight * 0.45),
        stageHeight - FLOW_STAGE_MIN,
      ),
    ),
  )
  const listingH = listingFlow
    ? narrow
      ? flowListing
      : 200
    : listingSize.h === null
      ? Math.round(sceneHeight * 0.5)
      : clampListingH(listingSize.h)
  // Drag an edge on a phone: what one side gains, the other gives up,
  // within each one's floor. The editor, its note at the bottom, keeps one
  // height (`source` here) that only its bottom grip changes, against the
  // stage: the note grows up into the source, never into the stage
  // (Stanley, 2026-10-01).
  const FLOW_TOP_MIN = 150
  const flowTop = Math.max(
    FLOW_TOP_MIN,
    flowSizes.source ??
      Math.round(
        Math.min(
          340,
          (typeof window === 'undefined' ? 700 : window.innerHeight) * 0.42,
        ),
      ),
  )
  // The note's body at most: the editor less its bar, the note's bar and
  // a few of the source's rows.
  const noteCap = flowTop - 28 - 28 - 64
  // (fitting its text, the note is as tall as it is now)
  const noteNow = () =>
    rootRef.current?.querySelector<HTMLElement>(
      '.ac-window.docked .ac-window-body',
    )?.offsetHeight ?? NOTE_H
  const flowFrom = (): FlowFrom => ({
    listing: listingH,
    source: flowTop,
    note: flowSizes.note ?? noteNow(),
    scene: sceneHeight,
  })
  const flowBy = (edge: FlowEdge, dy: number, from: FlowFrom): FlowSizes => {
    const room = Math.max(0, from.scene - FLOW_STAGE_MIN)
    if (edge === 'note') {
      // (down to one line: 18px and the body's 10px under it)
      const by = Math.max(from.note - noteCap, Math.min(dy, from.note - 28))
      return { ...flowSizes, note: from.note - by }
    }
    if (edge === 'listing') {
      const by = Math.max(-room, Math.min(dy, from.listing - 96))
      return { ...flowSizes, listing: from.listing - by }
    }
    const by = Math.min(room, Math.max(dy, FLOW_TOP_MIN - from.source))
    const source = from.source + by
    // (a note dragged taller than the smaller editor leaves room for)
    const note =
      flowSizes.note === null
        ? null
        : Math.min(flowSizes.note, source - 28 - 28 - 64)
    return { ...flowSizes, source, note }
  }
  const flowSplit = (edge: FlowEdge) => (
    <div
      className={`ac-flowsplit ${edge}`}
      role="separator"
      aria-orientation="horizontal"
      aria-label={
        edge === 'note'
          ? 'Resize note'
          : edge === 'listing'
            ? 'Resize stage and assembly'
            : 'Resize code and stage'
      }
      aria-valuenow={
        edge === 'note'
          ? (flowSizes.note ?? NOTE_H)
          : edge === 'listing'
            ? listingH
            : flowTop
      }
      aria-valuemin={
        edge === 'note' ? 28 : edge === 'listing' ? 96 : FLOW_TOP_MIN
      }
      aria-valuetext={`${
        edge === 'note'
          ? (flowSizes.note ?? NOTE_H)
          : edge === 'listing'
            ? listingH
            : flowTop
      } px tall; arrow keys resize`}
      tabIndex={0}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        flowDrag.current = { edge, at: e.clientY, from: flowFrom() }
        setListingDragging(true)
      }}
      onPointerMove={(e) => {
        const d = flowDrag.current
        if (d) setFlowSizes(flowBy(d.edge, e.clientY - d.at, d.from))
      }}
      onPointerUp={() => {
        flowDrag.current = null
        setListingDragging(false)
      }}
      onLostPointerCapture={() => {
        flowDrag.current = null
        setListingDragging(false)
      }}
      onPointerCancel={() => {
        flowDrag.current = null
        setListingDragging(false)
      }}
      // Back to the sizes it opens at.
      onDoubleClick={() =>
        setFlowSizes({ listing: null, source: null, note: null })
      }
      onKeyDown={(e) => {
        const dy = e.key === 'ArrowUp' ? -20 : e.key === 'ArrowDown' ? 20 : 0
        if (!dy) return
        e.preventDefault()
        e.stopPropagation()
        setFlowSizes(flowBy(edge, dy, flowFrom()))
      }}
    />
  )
  // Less room than the sizes were dragged in (the listing arriving, a
  // shorter screen): the editor gives back what the stage needs to keep
  // its floor.
  useEffect(() => {
    if (!narrow || flowDrag.current) return
    const short = Math.ceil(FLOW_STAGE_MIN - sceneHeight)
    if (short < 1) return
    setFlowSizes((s) => {
      const source = Math.max(FLOW_TOP_MIN, flowTop - short)
      return source === s.source ? s : { ...s, source }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrow, sceneHeight])
  const cover = {
    right: late && listingSide ? listingW : 0,
    bottom: late && !listingSide && !listingFlow ? listingH : 0,
  }
  // The stage the pane leaves in view.
  const viewW = sceneWidth - cover.right
  const viewH = sceneHeight - cover.bottom
  // A drag the pane can't finish (it closes, goes under the stage, or
  // moves to its other edge) ends there.
  useEffect(() => {
    listingDrag.current = null
    setListingDragging(false)
  }, [late, listingFlow, listingSide])
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
      ? colouredUpTo(
          backend,
          fnIndex,
          stepIndex,
          'abandoned' in w ? w.abandoned : undefined,
        )
      : undefined
  const currentRange: [number, number] | null =
    w.kind === 'emit.instr' ||
    w.kind === 'emit.prologue' ||
    w.kind === 'emit.epilogue'
      ? [w.from, w.to]
      : 'at' in w && w.at !== null
        ? [w.at, w.at]
        : null
  // Functions the allocator is done with: the listing shows the code it
  // wrote for them, saves, restores and spill code included.
  const rewrittenFns = regView
    ? w.kind === 'reg.done'
      ? fnIndex + 1
      : fnIndex
    : 0
  const graphFn = regView ? backend.functions[fnIndex] : undefined
  const graphSteps = graphFn ? attemptOf(graphFn, w).steps : []
  const graphShown = regView
  // The live ranges beside the listing, from emit to the end of registers.
  const lanesShown = emitStage || regView
  // The allocator's stack: simplify pushes a register, select pops it. A
  // register set aside stays in place in the graph, numbered by when it
  // went on; select brings them back from the highest number down.
  const pushedAs = new Map<string, number>()
  const candidates = new Set<string>()
  const spilled = new Set<string>()
  for (let i = 0, pushes = 0; i <= stepIndex && i < graphSteps.length; i++) {
    const st = graphSteps[i]
    if (st.op === 'simplify' || st.op === 'spillCandidate') {
      pushedAs.set(st.vr, ++pushes)
      if (st.op === 'spillCandidate') candidates.add(st.vr)
    } else pushedAs.delete(st.vr)
    if (st.op === 'spill') spilled.add(st.vr)
  }
  const onStack = new Set(pushedAs.keys())
  const stepVr = graphFn && 'step' in w ? graphSteps[w.step]?.vr : undefined
  const paletteIndex = (r: string) => backend?.palette.indexOf(r) ?? -1
  // (to a tenth, so a resize by a few pixels doesn't lay it out again)
  // (a phone's graph gets the stage less a little room below it:
  // graphPoint)
  const GRAPH_FOOT = 16
  const viewAspect =
    Math.round(
      (viewW / Math.max(1, narrow ? viewH - GRAPH_FOOT : viewH)) * 10,
    ) / 10
  const graphLayout = useMemo(
    () =>
      graphFn
        ? springLayout(
            graphFn.interference.nodes,
            graphFn.interference.edges,
            viewAspect,
          )
        : undefined,
    [graphFn, viewAspect],
  )
  // In stage units, within the view the listing's pane leaves and below a
  // step's note: the layout at its own size, shrunk only when the view is
  // too small for it.
  const graphPoint = (vr: string) => {
    const p = graphLayout?.at.get(vr) ?? { x: 0, y: 0 }
    // A phone's note is docked, not over the stage: no band for it at the
    // top, a little room at the bottom, and a whole node's circle clear of
    // the edges.
    const margin = narrow ? 26 : 28
    const top = narrow ? 0 : Math.min(NOTE_BAND, viewH * 0.25)
    const bottom = narrow ? GRAPH_FOOT : 0
    const room = viewH - top - bottom
    const fit = Math.min(
      1,
      (viewW / 2 - margin) / Math.max(1, graphLayout?.halfW ?? 0),
      (room / 2 - margin) / Math.max(1, graphLayout?.halfH ?? 0),
    )
    // (a phone's short stage packs the nodes closer, still a gap apart)
    const k = Math.max(narrow ? 0.5 : 0.7, fit)
    const x = viewW / 2 + p.x * k
    const y = top + room / 2 + p.y * k
    return { x: (x * VIEW_W) / sceneWidth, y: (y * VIEW_H) / sceneHeight }
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
    ...((resizing || dragging !== null || listingDragging) && {
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
  // The room each node's badge takes this step: a call's signature on its
  // step, then just its type, so the tree closes up again once the
  // signature collapses (Stanley, 2026-10-01).
  // Past the last badge (and a one-step signature's collapse), emit keeps
  // the same room. Its steps needn't lay the typed tree out again.
  const lastBadgeStep = useMemo(
    () => Math.max(-1, ...badgeTexts.map((b) => b.step + 1)),
    [badgeTexts],
  )
  const badgeIndex = Math.min(index, lastBadgeStep)
  const badgeRoom = useMemo(() => {
    const room = new Map<number, number>()
    for (const { id, width, step, only } of badgeTexts)
      if (only ? step === badgeIndex : step <= badgeIndex)
        room.set(id, Math.max(room.get(id) ?? 0, width))
    return room
  }, [badgeTexts, badgeIndex])
  // Every phase keeps the check layout, so the tree holds its shape from
  // the parse to the registers; badges (types, then registers) push nodes
  // aside only where they would collide (typedShift, below). Emit used to
  // lay the tree out again with its register badges' room, which moved
  // nodes and bent edges between the type pass and emit (Stanley,
  // 2026-09-27).
  const tree = baseTree
  // Emit keeps the room each type badge took, and more where its register
  // badge is wider, so nodes stay where the type pass left them.
  const lateRoom = useMemo(() => {
    const room = new Map(badgeRoom)
    for (const [id, w] of regRoom) room.set(id, Math.max(room.get(id) ?? 0, w))
    return room
  }, [badgeRoom, regRoom])
  const shiftRoom = typing ? badgeRoom : late ? lateRoom : undefined
  const unit = VIEW_W / sceneWidth
  // The whole stage, in every phase: emit and registers keep the tree's
  // size and shape, and it runs on under the listing's pane, which stays
  // put while the canvas pans (Stanley, 2026-09-25, 2026-09-27 and
  // 2026-09-28).
  const treeRoom = sceneWidth - EDGE_PX * 2
  const treeWidth = tree.width
  // Spread a small tree out, shrink a wide one; shrinking scales text too.
  const wholeSpread = Math.min(treeRoom / treeWidth, 3)
  // While the parser builds a tree too wide for the stage, the view is on
  // the statement it's in (the nearest the latest node is under whose
  // parent is a block or the program: a whole declaration at the top) and
  // the rows up to the root, at full size unless it outgrows the stage;
  // the finished tree, at its last step, is shown whole (Stanley,
  // 2026-10-01: not every node small from the first). Nodes keep the
  // finished tree's places, so earlier statements sit off to the side. A
  // small tree is laid out whole throughout, as before.
  // Parse: unattached nodes wait in their holder's open slot (parse-view.ts).
  const working = useMemo(
    () => parseView(trace, index, parents, groups, baseTree.at),
    [trace, index, parents, groups, baseTree],
  )
  const scope = (() => {
    if (
      wholeSpread >= 1 ||
      frame.phase !== 'Parse' ||
      frame.why.kind === 'parse.done' ||
      (slide > 0 && decks.has(index)) ||
      !frame.nodes.length
    )
      return undefined
    const root = trace.root
    const opens = (id: number | undefined) =>
      id === undefined ||
      id === root ||
      trace.nodes[id].kind === 'block' ||
      trace.nodes[id].kind === 'program'
    let top = frame.focus ?? frame.nodes[frame.nodes.length - 1]
    while (!opens(parents.get(top))) top = parents.get(top) as number
    const path = new Set<number>()
    for (let up = parents.get(top); up !== undefined; up = parents.get(up))
      path.add(up)
    const under = (id: number) => {
      for (let x: number | undefined = id; x !== undefined; x = parents.get(x))
        if (x === top) return true
      return false
    }
    let lo = Infinity,
      hi = -Infinity,
      depth = 0
    const rows = new Set<number>()
    // Where each node is drawn: its slot, and the room a node waiting in
    // its holder's slot is given (working.shift), as point() places it;
    // the operator being previewed is drawn too.
    const drawnIds =
      working.preview === undefined
        ? frame.nodes
        : [...frame.nodes, working.preview]
    for (const id of drawnIds) {
      const slot = tree.at[id]
      const shift = working.shift.get(id)
      const at =
        slot && shift ? { x: slot.x + shift.x, y: slot.y + shift.y } : slot
      if (!at || (!path.has(id) && !under(id))) continue
      depth = Math.max(depth, at.y)
      rows.add(at.y)
      // (the path sets the rows only: across, the statement alone, so it
      // stays readable however far along its block it is)
      if (path.has(id)) continue
      const half = (trace.nodes[id].label.length * CHAR_PX + 2) / 2
      lo = Math.min(lo, at.x - half)
      hi = Math.max(hi, at.x + half)
    }
    // (its rows below the root, as the layout counts levels)
    const levels = Math.max(1, rows.size - 1)
    return lo < hi
      ? { lo, width: hi - lo, depth: Math.max(depth, 1), levels }
      : undefined
  })()
  // (the statement in at most SCOPE_ROOM of the stage's width, so what's
  // around it stays in view: at the full width it took, the view sat so
  // close that the rest of the tree was gone, Stanley, 2026-10-01; a hand
  // can still zoom in as far as it likes)
  const naturalSpread = scope
    ? Math.max(wholeSpread, Math.min((treeRoom * SCOPE_ROOM) / scope.width, 1))
    : wholeSpread
  const natural = {
    spread: naturalSpread,
    treeLeft: scope
      ? EDGE_PX +
        (treeRoom - scope.width * naturalSpread) / 2 -
        scope.lo * naturalSpread
      : EDGE_PX + Math.max(0, (treeRoom - treeWidth * naturalSpread) / 2),
    // The rows the view spaces the tree over: the statement's, or all.
    viewDepth: scope?.depth ?? tree.depth,
    viewLevels: scope?.levels ?? tree.levels,
  }
  // A step that attaches a node draws that edge first, up from the child
  // to its parent, and only then brings in the nodes it adds (a new
  // statement's `a =` after `char* s` joins its block), so the reader sees
  // the one finished before the next begins (Stanley, 2026-10-01). Stepping
  // back has no order to show.
  const prevFrame = index > 0 ? trace.frames[index - 1] : undefined
  const previousNodes = useMemo(() => new Set(prevFrame?.nodes), [prevFrame])
  const previousAttached = useMemo(
    () => new Set(prevFrame?.attached),
    [prevFrame],
  )
  const attaches =
    !back && !!prevFrame && frame.attached.some((c) => !previousAttached.has(c))
  const isNew = (id: number) => !!prevFrame && !previousNodes.has(id)
  // Such a step takes about as long as any other: the fill its first part,
  // the move and the arrivals the rest (Stanley, 2026-10-01: two steps'
  // length was too slow).
  const fillTime = attaches ? transition.duration * 0.45 : 0
  const moveTime = attaches
    ? transition.duration - fillTime
    : transition.duration
  // The order of such a step: the edge fills where the tree is, then the
  // view moves to the step's statement, and the step's new nodes come in
  // with it. So for the fill the camera stays where the last step left it
  // (`held`), and is let go after (Stanley, 2026-10-01: it slid first).
  type Camera = typeof natural
  const camera = useRef<{
    index: number
    natural: Camera
    held: Camera | null
    released: boolean
  }>({ index, natural, held: null, released: false })
  if (camera.current.index !== index) {
    const was = camera.current
    const moved =
      was.natural.spread !== natural.spread ||
      was.natural.treeLeft !== natural.treeLeft ||
      was.natural.viewDepth !== natural.viewDepth ||
      was.natural.viewLevels !== natural.viewLevels
    camera.current = {
      index,
      natural,
      held:
        attaches && moved && index === was.index + 1 && !reduced
          ? was.natural
          : null,
      released: false,
    }
  } else camera.current.natural = natural
  const [, letGo] = useState(0)
  useEffect(() => {
    if (!camera.current.held) return
    const timer = window.setTimeout(() => {
      camera.current.held = null
      camera.current.released = true
      letGo((n) => n + 1)
    }, fillTime * 1000)
    return () => clearTimeout(timer)
    // (each step decides afresh; the fill's length is read as it starts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])
  const shown = camera.current.held ?? natural
  const spread = shown.spread
  const fit = Math.min(1, spread)
  const treeLeft = shown.treeLeft
  const viewDepth = shown.viewDepth
  const viewLevels = shown.viewLevels
  // What a step's new nodes wait for: the fill, unless the view was just
  // let go (they come in with its move) or nothing attached.
  const arrive = attaches && !camera.current.released ? fillTime : 0
  // Pieces and paths move in what's left of the step.
  const moveTransition = { ...transition, duration: moveTime }
  // A path's glide to its new shape (GlidingPath): the step's timing, or at
  // once while a hand moves something.
  const pathGlide: ValueAnimationTransition<string> =
    resizing || dragging !== null || listingDragging
      ? { duration: 0 }
      : { duration: moveTime, ease: transition.ease }
  // Type pass, emit and registers: the tree stays where the checks left
  // it. Row by row, top
  // down, a node whose label and badge would run into the one left of it
  // moves right just enough, and its subtree moves with it. Only if that
  // runs off the stage does the whole tree slide left. So a step moves
  // nothing unless its new badge needs the space. In pixels, since badges
  // don't stretch with the layout's spread.
  // How far the type pass's tree runs past the stage's right edge; the
  // stage scrolls sideways that far rather than squeeze it (Stanley,
  // 2026-09-25).
  const typedRows = useMemo(() => {
    const rows = new Map<number, number[]>()
    for (const n of trace.nodes) {
      const row = tree.at[n.id]?.y
      if (row === undefined) continue
      const ids = rows.get(row)
      if (ids) ids.push(n.id)
      else rows.set(row, [n.id])
    }
    return [...rows].sort(([a], [b]) => a - b).map(([, ids]) => ids)
  }, [trace, tree])
  const { shift: typedShift, over } = useMemo(() => {
    if (!shiftRoom) return { shift: undefined, over: 0 }
    const shift = new Map<number, number>()
    const baseX = (id: number) => treeLeft + (tree.at[id]?.x ?? 0) * spread
    let right = -Infinity
    let left = Infinity
    for (const row of typedRows) {
      let edge = -Infinity
      const ids = [...row].sort((a, b) => baseX(a) - baseX(b))
      for (const id of ids) {
        const parent = parents.get(id)
        let x =
          baseX(id) + (parent === undefined ? 0 : (shift.get(parent) ?? 0))
        // The label width and gap baseTree packed the tree with, so a row
        // with no badges yet already fits and nothing moves.
        const half = ((trace.nodes[id].label.length * CHAR_PX + 2) * fit) / 2
        const gap = TREE_GAP * fit
        // (half a pixel of slack for rounding in the packed layout)
        if (x - half < edge + gap - 0.5) x = edge + gap + half
        shift.set(id, x - baseX(id))
        edge = x + half + (shiftRoom.get(id) ?? 0) * fit
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
    for (const [id, d] of shift) shift.set(id, d - slide)
    return { shift, over: Math.max(0, right - slide - end) }
  }, [
    shiftRoom,
    treeLeft,
    tree,
    spread,
    typedRows,
    parents,
    trace,
    fit,
    treeRoom,
  ])
  // Parse, on one statement of a wide tree: the rest of the tree runs off
  // both sides of the stage, and panning reaches it (in px, from the
  // stage's left edge).
  const parseReach = (() => {
    if (frame.phase !== 'Parse') return { left: 0, right: 0 }
    let left = 0,
      right = 0
    const ids =
      working.preview === undefined
        ? frame.nodes
        : [...frame.nodes, working.preview]
    for (const id of ids) {
      const slot = tree.at[id]
      if (!slot) continue
      const x = treeLeft + (slot.x + (working.shift.get(id)?.x ?? 0)) * spread
      const half = ((trace.nodes[id].label.length * CHAR_PX + 2) * fit) / 2
      left = Math.min(left, x - half - EDGE_PX)
      right = Math.max(right, x + half + EDGE_PX)
    }
    return { left: Math.floor(left), right: Math.ceil(right) }
  })()
  // Registers draws its interference graph in place of the tree.
  const treeShown = !graphShown
  // The canvas's bounds: the stage, and whatever runs past its right edge;
  // the graph, just the view the pane leaves.
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    c.inset(cover.right, cover.bottom)
    if (treeShown)
      // (a phone keeps room under the tree to pan it clear of the controls)
      c.size(
        Math.max(sceneWidth + over, parseReach.right),
        sceneHeight + (narrow ? GRAPH_FOOT : 0),
        parseReach.left,
      )
    else c.size(viewW, viewH)
  }, [
    sceneWidth,
    sceneHeight,
    over,
    parseReach.left,
    parseReach.right,
    cover.right,
    cover.bottom,
    treeShown,
    viewW,
    viewH,
    narrow,
  ])
  // A new graph starts in view.
  useEffect(() => {
    if (graphShown) canvas.current?.home(!reduced)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphShown, fnIndex])
  // The listing's pane scrolls by hand too; a step leaves it be for a
  // while after.
  const listingRef = useRef<HTMLDivElement>(null)
  const listingHand = useRef(0)
  // When a step last scrolled it.
  const listingAuto = useRef(0)
  useEffect(() => {
    const pane = listingRef.current
    if (!pane) return
    // (once the step's scroll is over, the next one is a hand's)
    const ended = () => {
      listingAuto.current = 0
    }
    pane.addEventListener('scrollend', ended)
    return () => pane.removeEventListener('scrollend', ended)
  }, [late])
  const touchListing = () => {
    listingHand.current = performance.now()
  }
  // Emit and registers: a step scrolls the listing to its current block
  // and pans the canvas to the node it came from with its register badge,
  // each just far enough to bring it in.
  const follow = () => {
    if (pinnedError) return followError()
    if (typing) return followFocus()
    if (naming) return followNames()
    if (!late) return
    const M = 24
    // How far to move one axis to bring [lo, hi] into [lo0 + m, hi0 - m];
    // what doesn't fit shows from its start.
    const into = (lo: number, hi: number, lo0: number, hi0: number, m = M) =>
      hi - lo > hi0 - lo0 - 2 * m
        ? lo0 + m - lo
        : lo < lo0 + m
          ? lo0 + m - lo
          : hi > hi0 - m
            ? hi0 - m - hi
            : 0
    const pane = listingRef.current
    const rows =
      instructionRef.current?.querySelectorAll<HTMLElement>('.ac-ins.current')
    if (
      pane &&
      rows?.length &&
      performance.now() - listingHand.current > 1500
    ) {
      const box = pane.getBoundingClientRect()
      // Four lines of context either side of the current ones, as the
      // cursor walks up or down (less in a short pane).
      const dy = into(
        rows[0].getBoundingClientRect().top,
        rows[rows.length - 1].getBoundingClientRect().bottom,
        box.top,
        box.bottom,
        Math.min(4 * 19, box.height / 4),
      )
      if (Math.abs(dy) > 1) {
        listingAuto.current = performance.now()
        pane.scrollTo({
          top: pane.scrollTop - dy,
          behavior: reduced ? 'auto' : 'smooth',
        })
      }
    }
    if (!emitStage || frame.focus === null) return
    // (on a phone, a little clear of the bottom)
    bringIn([frame.focus], {
      side: M,
      above: M,
      below: M + (narrow ? GRAPH_FOOT : 0),
      right: (lateRoom.get(frame.focus) ?? 0) * fit,
    })
  }
  // A hand on the view (a drag, the wheel, a pinch, the zoom buttons)
  // stops the steps panning it for the rest of that pass, so the reader
  // can look elsewhere, back up the tree say; the next pass, or Fit,
  // follows again (Stanley, 2026-09-28).
  const pass = `${frame.phase}${typing ? ':types' : ''}`
  useEffect(() => {
    passRef.current = pass
  })
  const handOff = () => handHeld.current === pass
  // The type pass: the node being checked in view, its children's edges
  // and their labels under it (the proofs it used to frame are gone,
  // Stanley, 2026-10-01).
  const followFocus = () => {
    if (frame.focus !== null)
      bringIn([frame.focus], {
        side: 40,
        above: 24,
        below: narrow ? GRAPH_FOOT : 120,
      })
  }
  // Pans just far enough to bring the nodes in (with `right` more px past
  // the first, for its badge), inside margins; all of them if they fit,
  // else the first. Measured where the pieces are headed (pieceBox), not
  // where they are mid-move, so the view moves with the step, as the
  // parser's does (Stanley, 2026-10-01). Nothing moves for what's already
  // in view, or against a hand on the canvas this pass.
  const bringIn = (
    ids: number[],
    m: { side: number; above: number; below: number; right?: number },
  ) => {
    const c = canvas.current
    const shown = ids.filter((id) => frame.nodes.includes(id))
    if (!c || !shown.length || c.busy() || handOff()) return
    const v = c.view()
    const boxes = shown.map((id, i) => {
      const b = pieceBox(id)
      return {
        l: v.x + b.x * v.k,
        r: v.x + (b.x + b.w) * v.k + (i ? 0 : (m.right ?? 0) * v.k),
        t: v.y + b.y * v.k,
        b: v.y + (b.y + b.h) * v.k,
      }
    })
    const all = boxes.reduce((a, b) => ({
      l: Math.min(a.l, b.l),
      r: Math.max(a.r, b.r),
      t: Math.min(a.t, b.t),
      b: Math.max(a.b, b.b),
    }))
    const fits =
      all.r - all.l <= viewW - 2 * m.side &&
      all.b - all.t <= viewH - m.above - m.below
    const at = fits ? all : boxes[0]
    // (what doesn't fit shows from its start)
    const into = (
      lo: number,
      hi: number,
      size: number,
      m0: number,
      m1: number,
    ) =>
      lo < m0 || hi - lo > size - m0 - m1
        ? m0 - lo
        : hi > size - m1
          ? size - m1 - hi
          : 0
    const dx = into(at.l, at.r, viewW, m.side, m.side)
    const dy = into(at.t, at.b, viewH, m.above, m.below)
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) c.panBy(dx, dy, !reduced)
  }
  // The name pass: the step's name and the declaration it's tied to in
  // view, or the name alone when both don't fit (Stanley, 2026-10-01: the
  // camera follows every pass's action, as the parser's does).
  const followNames = () => {
    const w = frame.why
    const ids =
      w.kind === 'check.declare'
        ? [w.decl]
        : w.kind === 'check.resolve' || w.kind === 'check.link'
          ? [w.use, w.decl]
          : w.kind === 'check.unresolved' || w.kind === 'check.builtin'
            ? [w.use]
            : frame.focus !== null
              ? [frame.focus]
              : []
    bringIn(ids, { side: 40, above: 24, below: narrow ? GRAPH_FOOT : 48 })
  }
  // An error: its node or token in view, however the pass had the view.
  const followError = () => {
    const c = canvas.current
    const piece = errorAnchor()
    const scene = sceneRef.current
    if (!c || !piece || !scene || c.busy() || handOff()) return
    const at = scene.getBoundingClientRect()
    const side = 24,
      above = 24,
      below = narrow ? GRAPH_FOOT : 48
    const into = (
      lo: number,
      hi: number,
      size: number,
      m0: number,
      m1: number,
    ) => (lo < m0 ? m0 - lo : hi > size - m1 ? size - m1 - hi : 0)
    const dx = into(
      piece.left - at.left,
      piece.right - at.left,
      viewW,
      side,
      side,
    )
    const dy = into(
      piece.top - at.top,
      piece.bottom - at.top,
      viewH,
      above,
      below,
    )
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) c.panBy(dx, dy, !reduced)
  }
  // (the latest follow, for a timer set by an earlier step)
  const followRef = useRef(follow)
  useEffect(() => {
    followRef.current = follow
  })
  // As the step starts, the view moving with it (bringIn measures where
  // pieces are headed); an error's, after it lands, as it measures the
  // pieces themselves. Never against a hand on the canvas. One follow at a
  // time: steps coming faster than that (playing) are caught up by the
  // next, which reads the latest step.
  const followTimer = useRef(0)
  const lastStep = useRef(0)
  // (read in effects: `pinnedError` is worked out further down)
  const followDelay = () =>
    (reduced || !pinnedError ? 0 : transition.duration) * 1000 + 30
  const followDelayRef = useRef(followDelay)
  useEffect(() => {
    followDelayRef.current = followDelay
  })
  useEffect(() => {
    lastStep.current = performance.now()
    if (followTimer.current) return
    const fire = () => {
      followTimer.current = 0
      followRef.current()
      // Once more when the latest step has landed, if it came after this
      // one was set.
      const left =
        followDelayRef.current() - (performance.now() - lastStep.current)
      if (left > 0) followTimer.current = window.setTimeout(fire, left)
    }
    followTimer.current = window.setTimeout(fire, followDelay())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    index,
    late,
    emitStage,
    frame.instructionCount,
    frame.allocationCount,
    frame.focus,
    typing,
    lateRoom,
    fit,
    reduced,
    listingSide,
  ])
  // Heals (above): once the step has settled, anything a checked group
  // still shows past what it draws is an exit that never finished. The
  // wait starts over whenever what's drawn changes too, not just on a
  // step: a resize that drops tray tokens starts exits of its own, which
  // get their time to finish rather than being cut short.
  const healWait = useRef({ key: '', timer: 0 })
  useEffect(() => {
    const want = drawn.current
    const key = [index, slide, epoch, want.pieces, want.edges, want.held].join()
    if (key === healWait.current.key) return
    healWait.current.key = key
    clearTimeout(healWait.current.timer)
    // (a step's new nodes can wait out its attach first: `arrive`)
    const settle = (reduced ? 0 : transition.duration * 2) * 1000 + 250
    healWait.current.timer = window.setTimeout(() => {
      const scene = sceneRef.current
      if (!scene) return
      const on = (selector: string) => scene.querySelectorAll(selector).length
      if (
        on('[data-piece]') > want.pieces ||
        on('[data-edge]') > want.edges ||
        on('[data-held]') > want.held
      )
        setHeals((h) => h + 1)
    }, settle)
  })
  useEffect(
    () => () => {
      clearTimeout(healWait.current.timer)
      // (Strict Mode unmounts and mounts again: the next commit re-arms)
      healWait.current.key = ''
    },
    [],
  )
  useEffect(
    () => () => {
      clearTimeout(followTimer.current)
      // (Strict Mode runs this and mounts again: a stale id would block
      // every follow after)
      followTimer.current = 0
    },
    [],
  )

  const deck = decks.get(index)
  const intro = slide > 0 ? deck?.slides[slide - 1] : undefined
  // The welcome and its slides are one readme, counted on their own; the
  // lexer's slides after them, theirs.
  const readmeCount =
    index === 0 ? (deck?.slides.filter((s) => s.readme).length ?? 0) : 0
  const onReadme = index === 0 && (slide === 0 || !!intro?.readme)
  const slideCount = onReadme
    ? readmeCount + 1
    : (deck?.slides.length ?? 0) - readmeCount
  const slideAt = onReadme ? slide + 1 : slide - readmeCount
  // The register allocator's slides sit on emit's last step: the stack
  // stays out of them, and the first lights every virtual register the
  // listing uses, all the new ones emit made (Stanley, 2026-10-01).
  const allocSlides = !!intro && deck?.phase === 'Registers'
  const allocIntro = allocSlides && deck?.slides[0] === intro
  // (the sweep starts at the first line with a virtual register)
  const firstLit = allocIntro
    ? Math.max(
        0,
        trace.instructions.findIndex((ins) =>
          /(?<!\$)\bv\d+\b/.test(ins.text ?? ''),
        ),
      )
    : 0
  // On a slide the tabs show the phase it opens.
  const shownPhase = intro && deck ? deck.phase : frame.phase
  const shownTab = tabs.find(
    (t) =>
      t.phase === shownPhase &&
      (t.phase !== 'Check' || 'types' in t === typing),
  )
  const pieceHalf = ((narrow ? 20 : 22) * fit) / 2
  // A phone drops the token tray's room once the parse has emptied it.
  const trayGone = narrow && frame.phase !== 'Tokens' && frame.phase !== 'Parse'
  const fullTray = useMemo(
    () => packTray(trace.tokens, sceneWidth),
    [trace, sceneWidth],
  )
  const { top: treeTop, band: rowsBand } = treeRows(
    trayGone ? {} : fullTray,
    sceneHeight,
    { depth: viewDepth, levels: viewLevels },
    pieceHalf,
    narrow,
  )
  // Close in on a statement, its few rows keep a tree's spacing rather
  // than spreading over the stage's height.
  const treeBand = scope
    ? Math.min(rowsBand, viewLevels * SCOPE_ROW_PX)
    : rowsBand
  // A pointer's place on the canvas, in its own (unzoomed) px.
  const canvasPoint = (cx: number, cy: number) => {
    const box = sceneRef.current?.getBoundingClientRect()
    const v = canvas.current?.view() ?? { x: 0, y: 0, k: 1 }
    return {
      x: (cx - (box?.left ?? 0) - v.x) / v.k,
      y: (cy - (box?.top ?? 0) - v.y) / v.k,
    }
  }
  // A dragged node stays on the canvas, where panning can reach it.
  const keepReachable = (id: number, n: { x: number; y: number }) => {
    const base = point(id)
    const at = {
      x: base.x - (nudged.get(id)?.x ?? 0),
      y: base.y - (nudged.get(id)?.y ?? 0),
    }
    const w = ((sceneWidth + over) * VIEW_W) / sceneWidth
    const h = VIEW_H
    const pad = 12
    return {
      x: Math.min(w - pad, Math.max(pad, at.x + n.x)) - at.x,
      y: Math.min(h - pad, Math.max(pad, at.y + n.y)) - at.y,
    }
  }
  // Geometry is shared by pieces, edges, badges, cards and the router.
  // Render-local caches also follow the held camera and a live node drag.
  const points = new Map<number, { x: number; y: number }>()
  const point = (id: number) => {
    const cached = points.get(id)
    if (cached) return cached
    const slot = tree.at[id] ?? { x: tree.width / 2, y: tree.depth }
    const at = slot
    const shift = working.shift.get(id)
    const p = shift ? { x: at.x + shift.x, y: at.y + shift.y } : at
    const n = nudged.get(id)
    const x =
      (treeLeft + p.x * spread + (typedShift?.get(id) ?? 0)) * unit +
      (n?.x ?? 0)
    // Crowded rows keep their extra room until the stage's floor. Then
    // the tree fits below the tray instead of raising its root into it.
    const row = p.y / Math.max(1, viewDepth)
    const pnt = {
      x,
      y: ((treeTop + row * treeBand) * VIEW_H) / sceneHeight + (n?.y ?? 0),
    }
    points.set(id, pnt)
    return pnt
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
  // A return's check: a line from the returned value's type up to the
  // return type in its function's signature, `→ int`, green when they
  // match (Stanley, 2026-10-01). A return statement has no type of its
  // own: the match is the whole rule.
  const returnCheck = (() => {
    const w = frame.why
    if (!typing || w.kind !== 'check.fits' || w.rule !== 'return')
      return undefined
    const fn = returnNeed.get(w.node)?.fn
    const valueType = typedStep.get(w.value)?.type
    const sig = fn !== undefined ? functionType.get(fn)?.type : undefined
    if (fn === undefined || !valueType || !sig) return undefined
    // A badge sits 5px right of its piece, 3px of padding and a border in
    // from its text, 6px a character (`.ac-piece small.ac-type`).
    const badgeAt = (id: number) => {
      const b = pieceBox(id)
      return { x: b.x + b.w + 5 * fit, y: b.y + b.h / 2 }
    }
    const v = badgeAt(w.value)
    const f = badgeAt(fn)
    const half = 7.5 * fit
    const from = {
      x: v.x + ((valueType.length * TYPE_PX + 8) * fit) / 2,
      y: v.y - half,
    }
    const arrow = sig.indexOf('→')
    const to = {
      x: f.x + (4 + ((arrow + sig.length) / 2) * TYPE_PX) * fit,
      y: f.y + half,
    }
    const mid = (from.y + to.y) / 2
    return {
      ok: w.ok,
      value: w.value,
      fn,
      d: `M ${from.x} ${from.y} C ${from.x} ${mid}, ${to.x} ${mid}, ${to.x} ${to.y}`,
    }
  })()
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
  // The type pass, as the tree: the checks the step's rule makes, each on
  // the edge down to the child it holds to a type, green or red as the
  // child's badge fits or doesn't: an operator's operands, a call's
  // arguments, an assignment's value, both sides of `==`, a condition and
  // a returned value (rules.tex). A literal's edge too: `"hi" + 1` fails
  // on it, and its badge goes green with the rest (Stanley, 2026-10-01:
  // only `×`'s edge went green under `4 + ×`).
  const asserts = (() => {
    const w = frame.why
    if (!typing || (w.kind !== 'check.expr' && w.kind !== 'check.fits'))
      return undefined
    const n = trace.nodes[w.node]
    const kids = n.children
    const held =
      w.kind === 'check.fits'
        ? [w.value]
        : n.kind === 'call' ||
            INT_OPS.has(n.label) ||
            n.label === '==' ||
            n.label === '!='
          ? kids
          : n.label === '=' && kids.length === 2
            ? [kids[1]]
            : []
    const bad = w.kind === 'check.expr' ? w.bad : w.ok ? undefined : w.value
    const out = new Map<number, { ok: boolean }>()
    for (const k of held)
      out.set(k, { ok: w.ok || (bad !== undefined && bad !== k) })
    return { node: w.node, edges: out }
  })()
  const typeBadge = (id: number) => {
    const w = frame.why
    // A call, on its step, shows the signature its arguments are checked
    // against; after, its own type.
    const sig =
      w.kind === 'check.expr' && w.node === id ? callNeed(id) : undefined
    if (sig && w.kind === 'check.expr')
      return {
        text: sig,
        state: `need ${w.ok ? 'ok' : 'bad'} ${builtinCall(id) ? 'builtin' : ''}`,
        delay: 0,
      }
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
        // Its operands go green as they check out: a call's arguments
        // against its signature, an assignment's sides against each other.
        if (w.ok) states.push('ok')
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
      ? nodeKind(trace.nodes[w.node], trace)
      : undefined
  // Where a landing node's class sits (parse): under it, else right, left
  // or above, whichever crosses no edge on the stage and covers no other
  // piece. Covering a neighbour costs as much as a whole edge (21 samples)
  // through the class: text over text is the worst of them.
  const landingSpot = (() => {
    if (!landing || (w.kind !== 'parse.node' && w.kind !== 'parse.wait'))
      return undefined
    // A cue on the node says more than its class, which the list under the
    // note lights anyway; the two side by side crowded a neighbour.
    if (working.cue?.node === w.node) return 'none'
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
    ]
    // Every edge drawn this step, sampled along its cubic.
    const edges = [
      ...frame.nodes.flatMap((p) =>
        trace.nodes[p].children
          .filter((ch) => attached.has(ch))
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
      ).length *
        2100
    return spots.reduce((a, b) => (cost(b) < cost(a) ? b : a)).side
  })()
  const naming =
    frame.phase === 'Check' &&
    !typing &&
    !intro &&
    w.kind !== 'check.type' &&
    w.kind !== 'check.expr' &&
    w.kind !== 'check.fits' &&
    w.kind !== 'check.typeError' &&
    w.kind !== 'check.typesDone'
  // Resolve frames are authoritative, including traces missing `links`.
  const bindings = new Map(frame.links ?? [])
  if (w.kind === 'check.resolve' || w.kind === 'check.link')
    bindings.set(w.use, w.decl)
  // A field access's line in its struct: `.x` on a `struct Point`, its
  // `int x` (the struct's type as the type pass has it by now).
  const fieldDecl = (id: number) => {
    const n = trace.nodes[id]
    if (n.kind !== 'expr' || !n.label.startsWith('.') || !n.children.length)
      return undefined
    const struct = typedStep
      .get(n.children[0])
      ?.type.match(/^struct (\w+)$/)?.[1]
    const decl = trace.nodes.find(
      (d) => d.kind === 'declare' && d.label === `struct ${struct} { }`,
    )
    return decl?.children.find((c) =>
      trace.nodes[c].label.endsWith(` ${n.label.slice(1)}`),
    )
  }
  // Type pass: a step links its node to the declaration its type comes
  // from: a name to its declaration (type-view.ts), a call to its
  // function's, a field to its line in the struct.
  const typeLink: [number, number] | undefined = (() => {
    if (w.kind === 'check.type')
      return w.decl !== undefined ? [w.node, w.decl] : undefined
    if (w.kind !== 'check.expr') return undefined
    const n = trace.nodes[w.node]
    if (n.kind === 'call') {
      const name = n.label.replace(/\(\)$/, '')
      const fn = functions.get(name)
      return fn ? [w.node, fn.id] : undefined
    }
    const field = fieldDecl(w.node)
    return field !== undefined ? [w.node, field] : undefined
  })()
  if (typeLink) bindings.set(...typeLink)
  const links = [...bindings]
  // Past the name pass, hovering a name or a declaration still draws its
  // links, wherever the tree is on the stage.
  const hoverLinked =
    !!hoverNode &&
    treeShown &&
    links.some(([u, d]) => u === hoverNode.id || d === hoverNode.id)
  const linkRoutes = (() => {
    if (!(naming || hoverLinked || typeLink) || (!links.length && !missing))
      return undefined
    const boxes = frame.nodes.map(pieceBox)
    const edges = frame.nodes.flatMap((id) =>
      trace.nodes[id].children
        .filter((c) => attached.has(c))
        .map((c) => {
          const p = toPx(point(id)),
            q = toPx(point(c))
          return {
            from: { x: p.x, y: p.y + pieceHalf },
            to: { x: q.x, y: q.y - pieceHalf },
          }
        }),
    )
    // Only geometry invalidates pathfinding, not the step or its bindings.
    // Actual boxes include badge shifts, the held camera and dragged nodes.
    const key = JSON.stringify([sceneWidth, sceneHeight, boxes, edges])
    if (routeCache.current?.trace !== trace || routeCache.current.key !== key)
      routeCache.current = {
        trace,
        key,
        router: linkRouter(boxes, {
          edges,
          walls: [],
          bounds: { x: 4, y: 4, w: sceneWidth - 8, h: sceneHeight - 8 },
        }),
      }
    const { router } = routeCache.current
    const routes = new Map<string, Route>()
    for (const [use, decl] of links) {
      // NameLinks draws these; a hovered card also avoids the current
      // resolve's line, even on the slide before the next pass.
      if (
        (naming && w.kind === 'check.namesDone') ||
        typeLink?.[0] === use ||
        ((naming || (!!hoverNode && !typing)) &&
          (w.kind === 'check.resolve' || w.kind === 'check.link') &&
          w.use === use) ||
        hover === use ||
        hover === decl
      )
        routes.set(
          `${use}-${decl}`,
          router.route(pieceBox(use), pieceBox(decl)),
        )
    }
    if (missing)
      routes.set(
        `miss-${missing.use}`,
        router.route(pieceBox(missing.use), pieceBox(missing.root)),
      )
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
  // Emit's listing leaves out pushRegisters and popRegisters (their labels
  // stay); the allocator's adds them. Lines are numbered as shown.
  const hideHolds = frame.phase === 'Emit'
  const rowNumbers = useMemo(() => {
    let n = 0
    return trace.instructions.map((ins) =>
      hideHolds && isPlaceholder(ins.op) ? 0 : ++n,
    )
  }, [trace, hideHolds])
  const rowStagger = back ? 0 : transition.duration * 0.35
  const functionNames = functions
  const tray = trace.tokens.filter(
    (t) =>
      !parsed ||
      (!owners.has(t.id) &&
        (absorbed(t.id) === undefined
          ? !(consumed.has(t.id) && KEEP_HIDDEN.includes(t.text))
          : absorbed(t.id) !== 'gone')),
  )
  const tokenPoints = packTray(tray, sceneWidth)
  const scanningRow = tokenPoints[Math.max(0, frame.tokenCount - 1)]?.y || 30
  const trayOffset = parsed ? 0 : Math.max(0, scanningRow - 98)
  const resolve =
    frame.why.kind === 'check.resolve' || frame.why.kind === 'check.link'
      ? frame.why
      : undefined
  // (a return's check: the value returned and the signature it must fit)
  const signatureSpan = (fn: number) => {
    const f = trace.nodes[fn]
    const body = trace.tokens.find((t) => t.id > f.token && t.text === '{')
    return {
      start: f.start,
      end: body ? trace.tokens[body.id - 1].end : f.end,
    }
  }
  // The type pass in the editor: what the step checks, and where each
  // part's type comes from, so the matching types read in the source as
  // they do on the tree (Stanley, 2026-10-01, from the return's `int
  // main()` and `p.x + p.y`). A part is green, or red where the check
  // broke; its type's source is its declaration (`struct Point p`), its
  // field's line in the struct (`int x`), its function's signature, or,
  // for a return, the enclosing function's. A literal, or an expression
  // the pass typed on an earlier step, is its own source. Types come from
  // declarations, never from what was assigned: `p.x` is `int` with or
  // without `p.x = 10`.
  type Mark = {
    start: number
    end: number
    kind: 'use' | 'decl'
    tone: 'ok' | 'bad'
  }
  const typeMarks = (() => {
    if (!typing) return undefined
    const w = frame.why
    const marks: Mark[] = []
    const span = (id: number) => ({
      start: trace.nodes[id].start,
      end: trace.nodes[id].end,
    })
    const sourceOf = (id: number) => {
      const n = trace.nodes[id]
      if (n.kind === 'call') {
        const name = n.label.replace(/\(\)$/, '')
        const fn = functions.get(name)
        return fn ? signatureSpan(fn.id) : undefined
      }
      const decl = bindings.get(id) ?? fieldDecl(id)
      return decl !== undefined ? declSpan(decl) : undefined
    }
    const add = (id: number, ok = true) => {
      const tone = ok ? 'ok' : 'bad'
      marks.push({ ...span(id), kind: 'use', tone })
      const from = sourceOf(id)
      if (from) marks.push({ ...from, kind: 'decl', tone })
    }
    if (w.kind === 'check.type') {
      const n = trace.nodes[w.node]
      if (n.kind === 'function')
        marks.push({ ...signatureSpan(w.node), kind: 'decl', tone: 'ok' })
      else if (n.kind === 'declare')
        marks.push({ ...declSpan(w.node), kind: 'decl', tone: 'ok' })
      else add(w.node)
    } else if (w.kind === 'check.expr') {
      const held = [...(asserts?.edges ?? [])]
      if (held.length) for (const [id, { ok }] of held) add(id, ok)
      else add(w.node, w.ok)
      // What the parts are held to: an assignment's target's type, a
      // call's signature.
      const n = trace.nodes[w.node]
      const to =
        n.label === '=' && n.children.length === 2
          ? sourceOf(n.children[0])
          : n.kind === 'call'
            ? sourceOf(w.node)
            : undefined
      if (to) marks.push({ ...to, kind: 'decl', tone: w.ok ? 'ok' : 'bad' })
    } else if (w.kind === 'check.fits') {
      add(w.value, w.ok)
      const tone = w.ok ? 'ok' : 'bad'
      if (w.rule === 'return' && returnCheck)
        marks.push({ ...signatureSpan(returnCheck.fn), kind: 'decl', tone })
      if (w.rule === 'assign') {
        const decl = bindings.get(w.node)
        if (decl !== undefined)
          marks.push({ ...declSpan(decl), kind: 'decl', tone })
      }
    } else return undefined
    // In source order, one mark to a stretch (two uses of one name share
    // its declaration).
    const out: Mark[] = []
    for (const m of marks.sort((a, b) => a.start - b.start))
      if (!out.length || m.start >= out[out.length - 1].end) out.push(m)
    return out.length ? out : undefined
  })()
  const pairMarks: Mark[] | undefined = resolve
    ? [
        {
          ...trace.tokens[trace.nodes[resolve.use].token],
          kind: 'use' as const,
          tone: 'ok' as const,
        },
        {
          ...declSpan(resolve.decl),
          kind: 'decl' as const,
          tone: 'ok' as const,
        },
      ].sort((a, b) => a.start - b.start)
    : typeMarks
  const lines = source.split('\n')
  // The longest line, in characters (a tab as its two columns): the text
  // column is that wide, so a long line scrolls the whole pane sideways
  // instead of hiding inside the textarea.
  const columns = Math.max(
    0,
    ...lines.map((l) => l.replace(/\t/g, '  ').length),
  )
  const line = source.slice(0, activeSpan.start).split('\n').length
  // The name pass: the note card holds the scopes instead of a sentence.
  const statusText = error
    ? error.message
    : intro?.readme
      ? // (the readme's pages are named by their file: background.txt)
        ''
      : intro
        ? intro.title
        : index === 0
          ? // No line over the welcome (Stanley, 2026-10-02).
            ''
          : frame.why.kind === 'token'
            ? `Token: \`${trace.tokens[frame.why.token].text}\``
            : frame.title
  // The notes window's name: the tab it's under, slides and steps alike;
  // a slide's own title is the heading inside (Stanley, 2026-09-28).
  const noteFile = error
    ? 'error.log'
    : index === 0 && onReadme
      ? // hello.txt, then background.txt (Stanley, 2026-10-02)
        `${(intro?.title ?? 'hello').toLowerCase()}.txt`
      : `${shownTab?.label ?? 'notes'}.txt`
  const noteText =
    intro?.body ??
    (error &&
    // A type error's step says what didn't fit, and that it stops there.
    !(
      ((frame.why.kind === 'check.expr' || frame.why.kind === 'check.fits') &&
        !frame.why.ok) ||
      frame.why.kind === 'check.typeError'
    )
      ? 'The compiler stops at its first error. Fix it in the editor and it runs again.'
      : explain(trace, frame, titles))
  // The note's first line, over its text: what it is about, when there's
  // a header to show (the welcome, a slide, an error, or step titles on).
  const showTitle = titles || !!intro || index === 0 || !!error
  const heading = showTitle && statusText && (
    <span className="ac-window-head">
      <Prose text={statusText} />
    </span>
  )
  const slideRows = (rows: [string, string][], head?: [string, string]) => (
    <table className="ac-slide-table">
      <thead>
        <tr>
          <th>{head?.[0] ?? 'lexeme'}</th>
          <th>{head?.[1] ?? 'category'}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([lexeme, category]) => (
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
  // A slide's code blocks, one per example.
  const slideCode = intro?.code && (
    <>
      {[intro.code].flat().map((code) => (
        <pre key={code} className="ac-slide-code">
          <code>{code}</code>
        </pre>
      ))}
    </>
  )
  // A slide's small two-column table, under its body, and its hint last.
  const slideTable = (intro?.table ||
    intro?.hint ||
    (intro?.code && !intro.codeFirst) ||
    intro?.quote) && (
    <>
      {intro.quote && (
        <blockquote className="ac-slide-quote">
          <Prose text={intro.quote} />
        </blockquote>
      )}
      {!intro.codeFirst && slideCode}
      {intro.table && slideRows(intro.table, intro.head)}
      {intro.hint === 'detailedLexer' && (
        // Stanley's copy (2026-10-02): the setting it names flips here, and
        // the settings menu opens to show it.
        <p className="ac-slide-hint">
          Hint:{' '}
          <button
            type="button"
            className="ac-hint-link"
            onClick={() => {
              switchLexer(!detailed)
              setMoreOpen(true)
            }}
          >
            {detailed ? 'turn off' : 'turn on'} detailed lexer
          </button>{' '}
          in <Settings className="ac-hint-cog" aria-label="settings" /> to see
          the character-by-character handling.
        </p>
      )}
    </>
  )
  // Hidden layers size the panel for the tallest lexer step, but only on the
  // steps themselves: the welcome and slides keep their own height.
  const sizing = !intro && index > 0
  const noteBody =
    frame.phase === 'Tokens' ? (
      // Hidden layers hold the tallest step of each token class in the
      // same grid cell, so the note keeps one height while stepping
      // through tokens and only grows if even that won't fit.
      <div className="ac-note-stack">
        <div className="ac-note-layer">
          {heading}
          {intro?.codeFirst && slideCode}
          <Prose text={noteText} onExample={openExample} />
          {slideTable}
        </div>
        {(sizing ? tallestTokenSteps : []).map((v) => (
          <div
            key={tokenKind(v.token)}
            className="ac-note-layer ghost"
            aria-hidden="true"
          >
            <Prose text={v.text} />
          </div>
        ))}
      </div>
    ) : (
      <>
        {heading}
        {intro?.codeFirst && slideCode}
        <Prose text={noteText} onExample={openExample} />
        {slideTable}
      </>
    )
  // What the pane under the source keeps: each pass's own record (Stanley,
  // 2026-09-27). The lexer shows the token's class, the parser the node's,
  // the name pass its scopes, the type pass its rule, emit the stack frame.
  // A pass is steady: a step with nothing of its own keeps what the last
  // one showed, and before its first (a pass opening on a step without
  // one) it shows the first to come, nothing lit. With nothing to keep
  // (the welcome, register allocation) the pane folds away.
  // A slide opens the pass after its frame, so the pane is that pass's,
  // looking ahead with nothing lit. Emit and registers keep none: the
  // stack has its own, by the listing (stackPane), and the pane under the
  // source holds the note, as every pass's does (Stanley, 2026-10-01).
  const panePhase = intro && deck ? deck.phase : frame.phase
  const paneKind: PaneKind | null =
    index === 0 && !intro
      ? null
      : panePhase === 'Tokens'
        ? detailed
          ? 'chars'
          : 'token'
        : panePhase === 'Parse'
          ? 'kinds'
          : panePhase === 'Check'
            ? // (the type pass's rule shows on hover, by its node: no pane)
              typing
              ? null
              : 'scopes'
            : null
  // The nearest step in this pass that passes `test`: this one or back,
  // else the first ahead (`ahead`); only ahead on a slide.
  const nearest = (test: (f: Frame) => boolean) => {
    const same = (i: number) => trace.frames[i]?.phase === panePhase
    for (let i = index; !intro && i > 0 && same(i); i--)
      if (test(trace.frames[i])) return { at: i, ahead: false }
    // (into the pass, if a slide sits before it, and not past its end)
    let inside = false
    for (let i = index + 1; i < trace.frames.length; i++) {
      if (!same(i)) {
        if (inside) break
        continue
      }
      inside = true
      if (test(trace.frames[i])) return { at: i, ahead: true }
    }
    return undefined
  }
  const paneToken = (() => {
    if (paneKind !== 'token') return undefined
    const near = nearest((f) => f.why.kind === 'token')
    const why = near && trace.frames[near.at].why
    if (!near || why?.kind !== 'token') return undefined
    const token = trace.tokens[why.token]
    const list = lexemesOf(token) as readonly string[]
    // (a pattern, the identifiers' or the numbers', is the one entry)
    const current = near.ahead
      ? undefined
      : list.length === 1
        ? list[0]
        : token.text
    return { cls: tokenKind(token), list, current }
  })()
  const paneChars = (() => {
    if (paneKind !== 'chars') return undefined
    const near = nearest((f) => f.why.kind === 'lex.char')
    const why = near && trace.frames[near.at].why
    if (near?.ahead) return { read: '', reader: undefined, final: undefined }
    return why?.kind === 'lex.char' ? lexState(trace, why) : undefined
  })()
  const paneNode = (() => {
    if (paneKind !== 'kinds') return undefined
    const near = nearest(
      (f) =>
        (f.why.kind === 'parse.node' || f.why.kind === 'parse.wait') &&
        trace.nodes[f.why.node].kind !== 'program',
    )
    const why = near && trace.frames[near.at].why
    if (!near || (why?.kind !== 'parse.node' && why?.kind !== 'parse.wait'))
      return undefined
    const { cls, kind } = nodeKind(trace.nodes[why.node], trace)
    return cls === 'global'
      ? undefined
      : { cls, list: NODE_KINDS[cls], current: near.ahead ? undefined : kind }
  })()
  const paneList = paneToken ?? paneNode
  // DRAFT copy: the class names over the lists.
  const paneLabel =
    paneKind === 'token'
      ? paneToken && (TOKEN_HEADS[paneToken.cls] ?? `${paneToken.cls}s`)
      : paneKind === 'chars'
        ? 'characters'
        : paneKind === 'kinds'
          ? paneNode && NODE_HEADS[paneNode.cls]
          : paneKind === 'scopes'
            ? 'symbol table'
            : ''
  const paneBlurb =
    paneKind === 'token'
      ? paneToken && TOKEN_BLURBS[paneToken.cls]
      : paneKind === 'kinds'
        ? paneNode && NODE_BLURBS[paneNode.cls]
        : undefined
  // The class the pane keeps (its blurb, its lexemes or kinds, or the
  // characters read so far), under its name when the note sits over it.
  const paneRecord = (named: boolean) => (
    <>
      {named && paneLabel && <h3 className="ac-pane-head">{paneLabel}</h3>}
      {paneBlurb && (
        <p className="ac-pane-blurb">
          <Prose text={paneBlurb} />
        </p>
      )}
      {paneChars && (
        <CharTable
          read={paneChars.read}
          reader={paneChars.reader}
          final={paneChars.final}
        />
      )}
      {paneList && (
        <ul
          className="ac-lexemes"
          aria-label={
            paneToken ? 'Lexemes in this class' : 'Kinds in this class'
          }
        >
          {paneList.list.map((entry) => (
            <li
              key={entry}
              className={entry === paneList.current ? 'current' : ''}
            >
              {entry}
            </li>
          ))}
        </ul>
      )}
    </>
  )
  const oversized = useMemo(() => tooBig(trace), [trace])
  const stackNow = stacks.find(
    (f) =>
      f.first < frame.instructionCount && frame.instructionCount - 1 <= f.last,
  )
  // Whether the pass's pane has anything in it yet: a slide before the
  // pass, or a pass before its first token, node, rule, declaration or
  // stack word, leaves it empty (a lookahead to the first isn't enough).
  const paneFilled =
    paneKind === 'token'
      ? paneToken?.current !== undefined
      : paneKind === 'chars'
        ? !!paneChars?.read
        : paneKind === 'kinds'
          ? paneNode?.current !== undefined
          : paneKind === 'scopes'
            ? scopes.scopes.some((sc) =>
                sc.decls.some((d) => scopes.declaredStep(d) <= index),
              )
            : false
  // With nothing to keep, the pane folds away: its top border, the divider,
  // runs down to the bottom and the source grows into the room; it comes
  // back up when a pass has something. `data-fold` on the editor: 'shut'
  // folded, 'moving' while the pane's height is animated, absent open.
  // (the trial's reach: the welcome, every pass's slides, and the lexer's,
  // parser's and name pass's steps, on a wide screen)
  const welcome = index === 0 && !intro
  const passStep =
    !welcome &&
    !intro &&
    !error &&
    (panePhase === 'Tokens' || panePhase === 'Parse' || paneKind === 'scopes')
  // A lexer, parser or name-pass step has no sentence of its own: the
  // class it's in (or the symbol table) says it, named in the note's
  // header (Stanley, 2026-09-30). The finished tree keeps its sentence.
  const classStep = passStep && frame.why.kind !== 'parse.done'
  // Nor does a type-pass step, and with the typing rule section gone its
  // note would be empty, so there is none: a node's rule shows on hover,
  // by the node (Stanley, 2026-10-01). Its slide and an error keep theirs.
  const typeStep =
    !welcome && !intro && !error && typing && panePhase === 'Check'
  // Emit's and the allocator's steps: their note docks in the pane under
  // the source, or floats, as the other passes' do (Stanley, 2026-10-01).
  const lateStep = !welcome && !intro && !error && late
  // An lvalue error has a note as a step does, docked or floating: the bar
  // says what can't be assigned to, the note why, which the stage can't show.
  const errorNote =
    !!error &&
    (frame.why.kind === 'check.expr' || frame.why.kind === 'check.typeError') &&
    !!frame.why.lvalue
  // A slide, the finished tree and a late step stand alone in the note:
  // the pass's record comes in with its first step.
  const noteAlone = !!intro || (passStep && !classStep) || lateStep || errorNote
  // On a phone there is no window to undock: the record goes down to the
  // note docked at the bottom, and the pane under the source folds away
  // (Stanley, 2026-10-01).
  const paneNote = welcome || !!intro || passStep || lateStep || errorNote
  const noteInPane = paneNote && noteDocked && !narrow
  const paneInWindow = paneNote && (!noteDocked || narrow)
  const noteName = classStep && paneLabel ? paneLabel : noteFile
  const paneOpen =
    noteInPane || (paneKind !== null && paneFilled && !paneInWindow)
  // (a phone's side pane, open only while there is one to show)
  const sideShown = sideOpen && paneOpen
  const folded = useRef<boolean | null>(null)
  // Only the latest fold settles the pane: a stopped animation still
  // resolves, and its settle would undo the one that replaced it.
  const foldRun = useRef(0)
  useLayoutEffect(() => {
    const note = noteRef.current
    const editor = note?.parentElement
    if (!note || !editor) return
    const was = folded.current
    folded.current = !paneOpen
    if (was === !paneOpen) return
    const run = ++foldRun.current
    const settle = () => {
      if (run !== foldRun.current) return
      note.style.height = ''
      if (paneOpen) delete editor.dataset.fold
      else editor.dataset.fold = 'shut'
    }
    // The first render, or reduced motion: no animation.
    if (was === null || reduced) return settle()
    // From where it is (a fold turned back partway), to where it rests
    // open, measured before it moves.
    const midway = editor.dataset.fold === 'moving' ? note.offsetHeight : null
    delete editor.dataset.fold
    note.style.height = ''
    const natural = note.offsetHeight
    const from = midway ?? (paneOpen ? 0 : natural)
    const to = paneOpen ? natural : 0
    editor.dataset.fold = 'moving'
    note.style.height = `${from}px`
    const move = animate(
      note,
      { height: [`${from}px`, `${to}px`] },
      { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
    )
    move.then(settle)
    return () => move.stop()
  }, [paneOpen, reduced])
  // A wide screen's error is told on the stage (the badges, the proof) and
  // in the error bar over the pane, not in the notes window (Stanley,
  // 2026-10-01: its card said the same again).
  const pinnedError = !!error && !narrow
  // Where an error is on the stage, for the view to bring it in: the
  // pieces whose token is in the error's span, a tree node before a token,
  // the first in the source.
  const errorAnchor = () => {
    if (!error) return undefined
    const pieces = [
      ...(sceneRef.current?.querySelectorAll<HTMLElement>(
        '.ac-piece[data-start]',
      ) ?? []),
    ]
      .map((el) => ({ el, start: Number(el.dataset.start) }))
      .filter(({ start }) => start >= error.start && start < error.end)
      .sort(
        (a, b) =>
          Number(b.el.classList.contains('node')) -
            Number(a.el.classList.contains('node')) || a.start - b.start,
      )
    return pieces[0]?.el.getBoundingClientRect()
  }
  // The note window first opens at the stage's top left.
  const windowStart = () => {
    const root = rootRef.current
    const stage = root?.querySelector('.ac-stage')
    if (!root || !stage) return { x: 16, y: 16 }
    const r = root.getBoundingClientRect()
    const s = stage.getBoundingClientRect()
    return { x: s.left - r.left + 12, y: s.top - r.top + 12 }
  }
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
    if (hoverNode && !typing) {
      const { cls, kind } = nodeKind(hoverNode, trace)
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
  // A node's card at the node's own size: on a shrunk tree, full size it
  // dwarfed the labels (Stanley, 2026-10-01). A token's, at the tray's.
  const ck = hoverNode ? fit : 1
  // Closed, the card is just the class, centred under the piece. Open, it
  // grows right and down to the full class list, its label nudged left.
  // Widths are exact because the text is monospace.
  const clampLeft = (left: number, width: number) =>
    Math.max(8, Math.min(left, sceneWidth - width - 8))
  const cardAt = card && {
    closed: (() => {
      const width = (cardText * CARD_CHAR_PX + 22) * ck
      return { left: clampLeft(card.x / unit - width / 2, width), width }
    })(),
    y: card.y,
  }
  // Open, it is only as wide as the class list needs (items are 6px padding
  // and a 1px border each side, 6px apart), up to 260 before it wraps.
  const listWidth = (card?.list ?? []).reduce(
    (w, l, i) => w + (l.length * CARD_CHAR_PX + 14 + (i ? 6 : 0)) * ck,
    0,
  )
  const openWidth = Math.min(
    260 * ck,
    sceneWidth - 16,
    Math.max(listWidth + 24 * ck, (cardText * CARD_CHAR_PX + 22) * ck),
  )
  // Open, the list wraps at the card's width: its rows of items (6px apart)
  // under the title, for the height the placing below allows for.
  const openHeight = (() => {
    const inner = (openWidth - 22 * ck) / ck
    let rows = card?.list.length ? 1 : 0,
      x = 0
    for (const l of card?.list ?? []) {
      const w = l.length * CARD_CHAR_PX + 14
      if (x > 0 && x + 6 + w > inner) {
        rows++
        x = w
      } else x += (x ? 6 : 0) + w
    }
    return (30 + (rows ? 10 + rows * 19.6 + (rows - 1) * 6 : 0)) * ck
  })()
  // A node's card keeps clear of it and of the links on the stage: right of
  // the node, else under, left or above it, whichever crosses no link and
  // covers the fewest other pieces at its open size. Each grows away from
  // the node as it opens, and shrinks back the same way: right and under
  // from their top left, left from its right edge, above from its bottom.
  // A token's card always sits under it.
  type Spot = {
    left: number
    top: number
    side: 'right' | 'under' | 'left' | 'above'
  }
  const cardPlace = (() => {
    if (!card || !cardAt) return undefined
    const c = toPx({ x: card.x, y: card.y })
    const under: Spot = {
      left: cardAt.closed.left,
      top: c.y + 16 * ck,
      side: 'under',
    }
    const cardNode = hoverNode?.id
    if (cardNode === undefined) return under
    const half = pieceBox(cardNode).w / 2
    const spots: Spot[] = [
      { left: c.x + half + 8 * ck, top: c.y - 15 * ck, side: 'right' },
      under,
      { left: c.x - half - 8 * ck, top: c.y - 15 * ck, side: 'left' },
      { left: cardAt.closed.left, top: c.y - 16 * ck, side: 'above' },
    ]
    const drawn = [...(linkRoutes?.entries() ?? [])]
      .filter(([key]) => {
        const [u, d] = key.split('-').map(Number)
        return (
          u === cardNode ||
          d === cardNode ||
          ((frame.why.kind === 'check.resolve' ||
            frame.why.kind === 'check.link') &&
            frame.why.use === u)
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
    const others = frame.nodes.filter((id) => id !== cardNode).map(pieceBox)
    // Judged open (or closed, for a card with no list), so opening it
    // never needs another spot.
    const open = card.list.length > 0
    const w = open ? openWidth : cardAt.closed.width
    const h = open ? openHeight : 30 * ck
    const cost = (spot: Spot) => {
      const s = {
        left:
          spot.side === 'left'
            ? spot.left - w
            : spot.side === 'right'
              ? spot.left
              : spot.left - (open ? 12 : 0),
        top: spot.side === 'above' ? spot.top - h : spot.top,
      }
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
      const shaded =
        noteShade &&
        s.left < noteShade.right &&
        s.left + w > noteShade.left &&
        s.top < noteShade.bottom &&
        s.top + h > noteShade.top
      return (shaded ? 1e9 : 0) + hits * 10000 + covered
    }
    const best = spots.reduce((a, b) => (cost(b) < cost(a) ? b : a))
    if (cost(best) < Infinity) return best
    // Nowhere it fits whole (a phone's short stage): under or above,
    // whichever has more room, held inside the stage even if that covers
    // the node.
    return c.y > sceneHeight - c.y
      ? {
          ...spots[3],
          top: Math.max(Math.min(h + 4, sceneHeight - 4), spots[3].top),
        }
      : { ...under, top: Math.max(4, Math.min(under.top, sceneHeight - h - 4)) }
  })()
  const cardBox = (() => {
    if (!cardAt || !cardPlace) return undefined
    // A card with no list (the root's) stays as it is when clicked.
    const open = !!card && cardOpen && card.list.length > 0
    const width = open ? openWidth : cardAt.closed.width
    const side = cardPlace.side
    return {
      left:
        side === 'left'
          ? Math.max(8, cardPlace.left - width)
          : side === 'right'
            ? Math.min(cardPlace.left, sceneWidth - width - 8)
            : clampLeft(cardPlace.left - (open ? 12 : 0), width),
      top: cardPlace.top,
      width,
      // (above, it hangs from its bottom edge, so it grows upward)
      y: side === 'above' ? '-100%' : '0%',
    }
  })()

  // The type pass: hovering a node, or its type, shows the rule that gave
  // it, one level up, as the typing rule section did (Stanley,
  // 2026-10-01: it replaces that section and the class card). It sits over
  // the node, else under it, at the node's size.
  const wantsProof = typing && !!hoverNode
  const derivation = useMemo(
    () => (wantsProof ? derive(trace, trace.text ?? source, index) : undefined),
    [wantsProof, trace, source, index],
  )
  const proof =
    hoverNode && derivation?.proven(hoverNode.id)
      ? { d: derivation, id: hoverNode.id }
      : undefined
  const proofRef = useRef<HTMLDivElement>(null)
  const [proofSize, setProofSize] = useState<{
    key: string
    w: number
    h: number
  } | null>(null)
  const proofKey = proof ? `${proof.id}-${index}-${fit}` : ''
  useLayoutEffect(() => {
    const el = proofRef.current
    if (!el) return
    const next = { key: proofKey, w: el.offsetWidth, h: el.offsetHeight }
    setProofSize((was) =>
      was?.key === next.key && was.w === next.w && was.h === next.h
        ? was
        : next,
    )
  }, [proofKey])
  const proofAt = (() => {
    if (!proof) return undefined
    const size = proofSize?.key === proofKey ? proofSize : undefined
    if (!size) return { left: 0, top: 0, measured: false }
    const box = pieceBox(proof.id)
    const gap = 8 * fit
    const above = box.y - gap - size.h
    return {
      left: Math.max(
        4,
        Math.min(box.x + box.w / 2 - size.w / 2, sceneWidth - size.w - 4),
      ),
      top: above >= 4 ? above : box.y + box.h + gap,
      measured: true,
    }
  })()

  const stackColumn = (at?: { x: number; y: number }) => (
    <StackColumn
      key={at ? `${at.x},${at.y}` : 'docked'}
      frame={stackNow}
      count={frame.instructionCount}
      from={back ? null : (currentRange?.[0] ?? null)}
      row={ASM_ROW}
      stagger={rowStagger}
      duration={transition.duration}
      still={!!reduced}
      step={index}
      at={at}
      bounds={rootRef}
      dock={stackDockRef}
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
  // Popped out by its button: afloat at the top of the stage, left of
  // where it docks, as the note window is undocked by its own.
  const popStack = () => {
    const root = rootRef.current?.getBoundingClientRect()
    const dock = stackDockRef.current?.getBoundingClientRect()
    const stage = stageRef.current?.getBoundingClientRect()
    if (!root || !dock || !stage) return
    // Its width out on the stage (.ac-stack.floating), read off the docked
    // one before it goes, so it lands clear of the listing.
    const docked = stackDockRef.current?.querySelector<HTMLElement>('.ac-stack')
    let w = 280
    if (docked) {
      docked.classList.replace('docked', 'floating')
      w = docked.offsetWidth
      docked.classList.replace('floating', 'docked')
    }
    setStackAt({
      x: Math.max(8, dock.left - root.left - w - 8),
      y: Math.max(8, stage.top - root.top + 16),
    })
  }
  // (DRAFT copy)
  const stackTooBig = emitStage && oversized && (
    <p className="ac-type-done">
      {`${oversized.name} takes ${oversized.size.toLocaleString()} bytes, too many to draw the stack (over ${MAX_DRAWN_BYTES.toLocaleString()}).`}
    </p>
  )
  const stackDocked = stackAt ? (
    // DRAFT copy (dropped on, or clicked, it takes the stack back)
    <button
      type="button"
      className="ac-dock-slot"
      onClick={() => setStackAt(null)}
    >
      drop the stack here
    </button>
  ) : (
    stackColumn()
  )
  const stackShown = emitStage && !allocSlides && (!!stackNow || !!oversized)
  // The listing a column at the side: the stack in a pane under it, with
  // a bar to fold it or pop it out and a border to size it by, as the
  // note's pane under the source has.
  const stackBelow = listingSide && !listingFlow
  const stackPane = stackShown && stackBelow && (
    <section
      className={`ac-stackpane ${stackFold ? 'folded' : ''}`}
      style={{
        width: listingW - 1,
        height: stackFold ? undefined : (stackH ?? undefined),
      }}
      aria-label="Stack frame"
    >
      {!stackFold && (
        // Drag the border to size it; double-click resets.
        <div
          className="ac-split"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize stack"
          tabIndex={0}
          onPointerDown={(e) => {
            const pane = e.currentTarget.parentElement
            const listing = pane?.parentElement
            if (!pane || !listing) return
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
            stackSplit.current = {
              y: e.clientY,
              h: pane.offsetHeight,
              max: listing.clientHeight - 96,
            }
          }}
          onPointerMove={(e) => {
            const d = stackSplit.current
            if (d)
              setStackH(
                Math.round(
                  Math.min(d.max, Math.max(29, d.h - (e.clientY - d.y))),
                ),
              )
          }}
          onPointerUp={() => {
            stackSplit.current = null
          }}
          onDoubleClick={() => setStackH(null)}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
            e.preventDefault()
            e.stopPropagation()
            const pane = e.currentTarget.parentElement
            const listing = pane?.parentElement
            if (!pane || !listing) return
            const step = e.key === 'ArrowUp' ? ASM_ROW : -ASM_ROW
            setStackH(
              Math.min(
                listing.clientHeight - 96,
                Math.max(29, pane.offsetHeight + step),
              ),
            )
          }}
        />
      )}
      <div className="ac-bar">
        <span className="ac-note-title">stack frame</span>
        <span className="ac-bar-tools">
          {!stackAt && !stackFold && stackNow && (
            <button
              type="button"
              className="ac-note-undock"
              aria-label="Pop out stack"
              title="Pop out"
              onClick={popStack}
            >
              ↗
            </button>
          )}
          <button
            type="button"
            className="ac-note-undock"
            aria-label={stackFold ? 'Expand stack' : 'Collapse stack'}
            aria-expanded={!stackFold}
            title={stackFold ? 'Expand' : 'Collapse'}
            onClick={() => setStackFold(!stackFold)}
          >
            {stackFold ? '+' : '−'}
          </button>
        </span>
      </div>
      {!stackFold && (
        <div className="ac-stackpane-body" ref={stackDockRef}>
          {stackDocked}
          {stackTooBig}
        </div>
      )}
    </section>
  )
  // The listing along the bottom (or a phone's, under the stage): the
  // stack one more column, right of the lanes, no border between.
  const stackBeside = stackShown && !stackBelow && (
    <div className="ac-stackbeside" ref={stackDockRef}>
      {stackDocked}
      {stackTooBig}
    </div>
  )
  // The syntax guide (GUIDE): up while the editor or it has focus, or
  // pinned; a window as the note's, its bar to drag, its edges to size.
  const guideUp = guidePinned || editing || guideHeld
  const guideWindow = guideOn && (
    <NoteWindow
      key={guideEpoch}
      className="guide"
      title="mini-c.txt"
      label="Mini-C syntax"
      noun="guide"
      storeKey={GUIDE_WINDOW_KEY}
      openWidth={300}
      live={false}
      bounds={rootRef}
      area={workRef}
      start={windowStart}
      away={!guideUp}
      onHandle={() => {
        if (!guidePinned) pinGuide(true)
      }}
      lead={
        <button
          type="button"
          className={`ac-window-box ac-window-pin ${guidePinned ? 'on' : ''}`}
          aria-label={guidePinned ? 'Unpin guide' : 'Pin guide'}
          aria-pressed={guidePinned}
          title={guidePinned ? 'Unpin' : 'Pin'}
          onClick={() => pinGuide(!guidePinned)}
        >
          <Pin aria-hidden="true" />
        </button>
      }
      trail={
        // Off until the settings menu's "syntax guide" turns it back on.
        <button
          type="button"
          className="ac-window-box ac-window-close"
          aria-label="Close guide"
          title="Close"
          onClick={() => saveGuide(false)}
        >
          ×
        </button>
      }
      rootProps={{
        // Pressed, it holds itself up before the editor lets go, so its
        // text can be selected and copied.
        tabIndex: -1,
        onPointerDown: () => setGuideHeld(true),
        onFocus: () => setGuideHeld(true),
        onBlur: (e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null))
            setGuideHeld(false)
        },
        onCopy: (e) => {
          const sel = window.getSelection()
          if (!sel || sel.isCollapsed || !sel.rangeCount) return
          const md = guideMarkdown(sel.getRangeAt(0).cloneContents())
            .replace(/\n{3,}/g, '\n\n')
            .trim()
          if (!md) return
          e.preventDefault()
          e.clipboardData.setData('text/plain', md)
        },
      }}
    >
      <div className="ac-guide-text">
        {GUIDE.map((r) => (
          <section key={r.title}>
            <h4>{r.title}</h4>
            {[r.text ?? []].flat().map((t) => (
              <p key={t}>
                <Prose text={t} />
              </p>
            ))}
            {/* Each block names its language in its corner: the
                        right way is Mini-C, the usual way only C. */}
            {r.code && (
              <div className="ac-guide-ex" data-label="Mini-C">
                <pre>
                  <code>
                    <GuideCode code={r.code} />
                  </code>
                </pre>
              </div>
            )}
            {r.not && (
              <div className="ac-guide-ex bad" data-label="C">
                <pre>
                  <code>
                    <GuideCode code={r.not} />
                  </code>
                </pre>
              </div>
            )}
          </section>
        ))}
      </div>
    </NoteWindow>
  )
  // The AST guide: up through the parser's slides and steps, at the
  // stage's top right; its − rolls it up, its × turns it off. The kind the
  // parser is on is lit; the one pointed at (else that one) has its note.
  const astUp = panePhase === 'Parse' && !welcome && !narrow
  const astNow =
    paneNode?.current !== undefined
      ? { cls: paneNode.cls, kind: paneNode.current }
      : null
  const astShown = astPick ?? astNow
  const astWindow = astOn && (
    <NoteWindow
      className="guide ast"
      title="ast.txt"
      label="AST guide"
      noun="guide"
      storeKey={AST_WINDOW_KEY}
      openWidth={AST_W}
      live={false}
      bounds={rootRef}
      area={workRef}
      start={() => {
        const root = rootRef.current
        const stage = root?.querySelector('.ac-stage')
        if (!root || !stage) return { x: 16, y: 16 }
        const r = root.getBoundingClientRect()
        const s = stage.getBoundingClientRect()
        return { x: s.right - r.left - AST_W - 12, y: s.top - r.top + 12 }
      }}
      away={!astUp}
      trail={
        <button
          type="button"
          className="ac-window-box ac-window-close"
          aria-label="Close AST guide"
          title="Close"
          onClick={() => saveAst(false)}
        >
          ×
        </button>
      }
    >
      <div
        className="ac-guide-text ac-ast-text"
        onPointerLeave={() => setAstPick(null)}
      >
        {(['declaration', 'statement', 'expression'] as const).map((cls) => {
          const note =
            astShown?.cls === cls ? NODE_NOTES[cls][astShown.kind] : undefined
          return (
            <section key={cls}>
              <h4>{NODE_HEADS[cls]}</h4>
              <p>
                <Prose text={NODE_BLURBS[cls]} />
              </p>
              <ul className="ac-lexemes" aria-label={`Kinds of ${cls}`}>
                {NODE_KINDS[cls].map((kind) => (
                  <li
                    key={kind}
                    tabIndex={0}
                    className={[
                      astNow?.cls === cls && astNow.kind === kind
                        ? 'current'
                        : '',
                      astPick?.cls === cls && astPick.kind === kind
                        ? 'picked'
                        : '',
                    ].join(' ')}
                    onPointerEnter={() => setAstPick({ cls, kind })}
                    onFocus={() => setAstPick({ cls, kind })}
                    onBlur={() => setAstPick(null)}
                  >
                    {kind}
                  </li>
                ))}
              </ul>
              {note && (
                <div className="ac-ast-note">
                  <code>{note[0]}</code>
                  <span>{note[1]}</span>
                </div>
              )}
            </section>
          )
        })}
      </div>
    </NoteWindow>
  )
  // The step's note: docked at the bottom of the editor on a phone, under
  // the source it grows up into; a window over the stage elsewhere.
  const noteWindow = !noteInPane &&
    (!pinnedError || errorNote) &&
    !typeStep && (
      <NoteWindow
        docked={narrow}
        height={flowSizes.note}
        cap={noteCap}
        onDock={paneInWindow && !narrow ? () => dockNote(true) : undefined}
        title={noteName}
        error={!!error}
        live={!playing}
        bounds={rootRef}
        area={workRef}
        start={windowStart}
        foot={
          (intro || onReadme) &&
          deck &&
          slideCount > 1 && (
            <div className="ac-note-foot">
              <button
                type="button"
                className="ac-slides"
                aria-label="Skip intro"
                // (the readme skips to the lexer's slides, if it has any)
                onClick={() =>
                  onReadme && deck.slides.length > readmeCount
                    ? setSlide(readmeCount + 1)
                    : seek(index + 1)
                }
              >
                <span className="count">
                  {slideAt}/{slideCount}
                </span>
                <span className="skip">skip</span>
              </button>
            </div>
          )
        }
      >
        {!classStep && noteBody}
        {paneInWindow &&
          !noteAlone &&
          (paneFilled || classStep) &&
          paneRecord(!classStep)}
        {paneInWindow && classStep && paneKind === 'scopes' && (
          <ScopeTree
            trace={trace}
            scopes={scopes}
            frame={frame}
            step={index}
            duration={transition.duration}
          />
        )}
      </NoteWindow>
    )

  return (
    <section
      ref={rootRef}
      className={`ac ${bare ? 'bare' : ''} ${max ? 'max' : ''}`}
      data-phase={frame.phase.toLowerCase()}
    >
      <header className="ac-top">
        {/* A phone's tool is the whole screen: this is its way out. */}
        <Link href="/projects" className="ac-home" aria-label="Projects">
          <ChevronLeft aria-hidden="true" />
        </Link>
        <nav className="ac-phases" aria-label="Compiler phases">
          {tabs.map((tab) => {
            const types = 'types' in tab
            const active = tab === shownTab
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
        <details
          ref={aboutRef}
          className="ac-about"
          open={aboutOpen}
          onToggle={(e) => setAboutOpen(e.currentTarget.open)}
        >
          <summary>about</summary>
          <div>
            {/* Stanley's copy (2026-10-02). */}
            <p>
              The compiler was built for{' '}
              <a
                href="https://www.cs.mcgill.ca/~cs520/2026/"
                target="_blank"
                rel="noopener noreferrer"
                className="prose-link"
              >
                COMP 520
              </a>
              , taught in Winter 2026 by Professor Christophe Dubach.
            </p>
            <p>
              Any code you write is live-compiled directly in your browser, made
              possible by{' '}
              <a
                href="https://teavm.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="prose-link"
              >
                TeaVM
              </a>
              , which <strong>transpiles</strong> my compiler&apos;s Java source
              code into minified JavaScript.
            </p>
          </div>
        </details>
        {/* Full screen and back, in one place (Stanley, 2026-10-02). */}
        <button
          type="button"
          className="ac-max"
          aria-label={max ? 'Exit full screen' : 'Full screen'}
          title={max ? 'Exit full screen (f)' : 'Full screen (f)'}
          onClick={() => setMax((m) => !m)}
        >
          {max ? (
            <Minimize aria-hidden="true" />
          ) : (
            <Fullscreen aria-hidden="true" />
          )}
        </button>
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
        <section
          className="ac-editor"
          aria-label="Source editor"
          style={
            narrow
              ? ({ '--flow-top': `${flowTop}px` } as CSSProperties)
              : undefined
          }
        >
          <div className="ac-bar">
            <span className="ac-file">main.c</span>
            <Picker
              label="Example program"
              options={examples.map((e) => e.name.toLowerCase())}
              value={examples.findIndex((e) => e.name === reference?.name)}
              placeholder="custom"
              onChange={(i) => update(examples[i].source)}
              rule={FIRST_ERROR}
            />
          </div>
          <div
            className="ac-source"
            data-editing={editing}
            data-sized={sourceHeight !== null}
            style={
              narrow
                ? undefined
                : sourceHeight === null
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
            <div
              className="ac-text"
              style={{ '--cols': columns } as CSSProperties}
            >
              {!editing && (
                <pre aria-label="Highlighted source">
                  <code>
                    {pairMarks ? (
                      <>
                        {pairMarks.map((mark, i) => (
                          <Fragment key={mark.start}>
                            {source.slice(
                              i ? pairMarks[i - 1].end : 0,
                              mark.start,
                            )}
                            <mark className={`${mark.tone} ${mark.kind}`}>
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
                          // being read as a block, one only looked at as an
                          // outline (a newline as a space before it).
                          <>
                            <mark className="reading">
                              {source.slice(activeSpan.start, cursor)}
                            </mark>
                            <mark className={peeked ? 'cursor peek' : 'cursor'}>
                              {source[cursor] === '\n' ? ' ' : source[cursor]}
                            </mark>
                            {source[cursor] === '\n' && '\n'}
                          </>
                        ) : (
                          <mark
                            key={index}
                            className={
                              hoverNode || hoverTok
                                ? ''
                                : error ||
                                    frame.why.kind === 'check.unresolved' ||
                                    frame.why.kind === 'lex.error'
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
                // Past the compiler's limit it says so; past this, nothing
                // more is taken, so a huge paste can't swamp the editor.
                maxLength={MAX_EDIT_CHARS}
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
            // Folded away, nothing in it can be reached (its separator).
            inert={!paneOpen}
            className={`ac-note ${error ? 'err' : ''} ${sideShown ? 'open' : ''} ${narrow && paneInWindow ? 'gone' : ''} ${noteInPane && noteMin ? 'min' : ''}`}
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
            {noteInPane ? (
              <div className="ac-bar">
                <span className="ac-note-file">{noteName}</span>
                <span className="ac-bar-tools">
                  <button
                    type="button"
                    className="ac-note-undock"
                    aria-label="Undock notes"
                    title="Undock"
                    onClick={() => dockNote(false)}
                  >
                    ↗
                  </button>
                  <button
                    type="button"
                    className="ac-note-undock"
                    aria-label={noteMin ? 'Expand notes' : 'Minimize notes'}
                    aria-expanded={!noteMin}
                    title={noteMin ? 'Expand' : 'Minimize'}
                    onClick={() => minimizeNote(!noteMin)}
                  >
                    {noteMin ? '+' : '−'}
                  </button>
                </span>
              </div>
            ) : (
              paneLabel && (
                <div className="ac-bar">
                  <span className="ac-note-title">{paneLabel}</span>
                  {/* (a phone's: the box opens and closes the pane) */}
                  {narrow && (
                    <button
                      type="button"
                      className="ac-side-box"
                      aria-label={sideShown ? 'Close pane' : 'Open pane'}
                      aria-expanded={sideShown}
                      onClick={() => setSideOpen(!sideShown)}
                    >
                      {sideShown ? '−' : '+'}
                    </button>
                  )}
                </div>
              )
            )}
            <div className={`ac-note-body ${noteInPane ? 'with-note' : ''}`}>
              {noteInPane ? (
                <>
                  {!classStep && <div className="ac-note-step">{noteBody}</div>}
                  {!noteAlone &&
                    (paneFilled || classStep) &&
                    paneRecord(!classStep)}
                </>
              ) : (
                paneRecord(false)
              )}
              {!(noteInPane && noteAlone) && paneKind === 'scopes' && (
                <ScopeTree
                  trace={trace}
                  scopes={scopes}
                  frame={frame}
                  step={index}
                  duration={transition.duration}
                />
              )}
            </div>
          </section>
          {narrow && noteWindow && (
            <div className="ac-flownote">
              {flowSplit('note')}
              {noteWindow}
            </div>
          )}
          {narrow && flowSplit('editor')}
        </section>

        <section
          ref={stageRef}
          className="ac-stage"
          aria-label="Animated compiler stage"
        >
          <div className="ac-view">
            <div className="ac-scene" ref={sceneRef}>
              <div className="ac-canvas" ref={canvasRef}>
                <svg
                  className="ac-edges"
                  viewBox={`0 0 ${sceneWidth + over} ${sceneHeight}`}
                  style={over ? { width: sceneWidth + over } : undefined}
                  aria-hidden="true"
                >
                  <AnimatePresence key={`edges-${epoch}`} initial={firstMount}>
                    {treeShown &&
                      count(
                        'edges',
                        frame.nodes.flatMap((id) => {
                          const n = trace.nodes[id]
                          return n.children
                            .filter((child) => attached.has(child))
                            .map((child) => {
                              const d = edgeUp(id, child)
                              return (
                                <TreeEdge
                                  key={`${id}-${child}`}
                                  className={(() => {
                                    // (an edge the step's node asserts)
                                    const a =
                                      asserts?.node === id
                                        ? asserts.edges.get(child)
                                        : undefined
                                    return a
                                      ? `assert ${a.ok ? 'ok' : 'bad'}`
                                      : undefined
                                  })()}
                                  d={d}
                                  opacity={
                                    frame.focus === id ||
                                    frame.why.kind === 'parse.done'
                                      ? 1
                                      : 0.45
                                  }
                                  duration={transition.duration}
                                  drawTime={
                                    attaches ? fillTime : transition.duration
                                  }
                                  moveTime={moveTime}
                                  immediate={
                                    resizing ||
                                    dragging !== null ||
                                    listingDragging
                                  }
                                />
                              )
                            })
                        }),
                      )}
                    {working.group &&
                      working.group.nodes.length > 0 &&
                      (() => {
                        // Brackets around the group being read, solid once its
                        // `)` is read; none before it holds a node (around an
                        // empty slot they showed nothing, Stanley, 2026-10-01).
                        const g = working.group
                        const ids = g.nodes
                        // All in pixels, so the brackets keep their shape
                        // however the stage is stretched.
                        const half = (id: number) =>
                          (trace.nodes[id].label.length * CHAR_PX * fit) / 2 +
                          12
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
                  {count(
                    'held',
                    working.held.map(([holder, id]) => {
                      // A dashed socket: shown, not yet attached. A node shown
                      // this step was called for, so its socket draws down from
                      // the holder as the call descends; one adopted from an
                      // earlier step (`4` moving under `+`) only fades in. A
                      // dash pattern can't also carry pathLength, so a solid
                      // mask draws instead. It goes at once when its node is
                      // attached (the solid edge draws over it) or the step
                      // drops it: outside AnimatePresence, so no exit can be
                      // left hanging. In development, StrictMode's detach of
                      // a moved child stopped those exits, and scrubbing left
                      // sockets behind until the settle check (2026-10-01).
                      const d = edgePath(holder, id)
                      const key = `held-${holder}-${id}`
                      const called = index > 0 && !previousNodes.has(id)
                      return (
                        <motion.g
                          key={key}
                          data-held=""
                          initial={{ opacity: called ? 0.5 : 0 }}
                          animate={{ opacity: 0.5 }}
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
                              <GlidingPath
                                d={d}
                                glide={pathGlide}
                                fill="none"
                                stroke="#fff"
                                strokeWidth={4}
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ ...transition, delay: arrive }}
                              />
                            </mask>
                          )}
                          <GlidingPath
                            className="ac-held"
                            d={d}
                            glide={pathGlide}
                            fill="none"
                            strokeWidth={1}
                            mask={called ? `url(#${key})` : undefined}
                          />
                        </motion.g>
                      )
                    }),
                  )}
                  {naming && walkTime > 0 && (
                    <g key={`walk-${index}`} className="ac-walk">
                      {walk.map(([parent, child, down], i) => (
                        <motion.path
                          key={`${parent}-${child}`}
                          d={
                            down
                              ? edgePath(parent, child)
                              : edgeUp(parent, child)
                          }
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
                      current={typeLink?.[0]}
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
                  {returnCheck && (
                    <motion.path
                      key={`return-${index}`}
                      className={`ac-return-link ${returnCheck.ok ? 'ok' : 'bad'}`}
                      d={returnCheck.d}
                      fill="none"
                      strokeWidth={1}
                      initial={{ pathLength: reduced || back ? 1 : 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{
                        duration: reduced ? 0 : transition.duration,
                        delay: reduced || back ? 0 : transition.duration * 0.5,
                        ease: 'easeInOut',
                      }}
                    />
                  )}
                </svg>
                <AnimatePresence key={`pieces-${epoch}`} initial={firstMount}>
                  {treeShown &&
                    count(
                      'pieces',
                      pieces.map(({ token, nodeId, key }) => {
                        const node =
                          nodeId === undefined ? undefined : trace.nodes[nodeId]
                        const isConsumed = consumed.has(token.id)
                        const typeToken =
                          parsed && !node ? absorbed(token.id) : undefined
                        if (typeToken === 'gone') return null
                        if (
                          parsed &&
                          isConsumed &&
                          !node &&
                          typeToken === undefined &&
                          KEEP_HIDDEN.includes(token.text)
                        )
                          return null
                        const tokenPoint = tokenPoints[token.id] || {
                          x: 340,
                          y: 30,
                        }
                        const sliding = typeToken === 'sliding'
                        const into = absorbedBy.get(token.id)
                        const p = node
                          ? point(node.id)
                          : sliding && into !== undefined
                            ? point(into)
                            : { x: tokenPoint.x, y: tokenPoint.y - trayOffset }
                        if (!node && !sliding && (p.y < 8 || p.y > 150))
                          return null
                        // A focused register moves the focus to the node that
                        // writes it.
                        const focused = node
                          ? (focusLane
                              ? defNode === node.id
                              : frame.focus === node.id) || hover === node.id
                          : // A step about a node lights the node, even one
                            // anchored at this token (the root, at the first).
                            frame.focus === null &&
                            token.start === frame.span.start
                        const life =
                          node !== undefined &&
                          lifecycle.some(
                            (r) => trace.instructions[r].node === node.id,
                          )
                        const pending =
                          node !== undefined &&
                          node.children.some((child) => !attached.has(child))
                        const declaredAt =
                          node === undefined
                            ? undefined
                            : declaredStep.get(node.id)
                        const declared =
                          declaredAt !== undefined &&
                          declaredAt <= index &&
                          naming
                        const allFound =
                          naming && frame.why.kind === 'check.namesDone'
                        const found =
                          (allFound &&
                            links.some(
                              ([u, d]) => u === node?.id || d === node?.id,
                            )) ||
                          (naming &&
                            node !== undefined &&
                            (resolve?.decl === node.id ||
                              resolve?.use === node.id))
                        // Uses have a quiet outline; declarations are filled.
                        const use =
                          (allFound && links.some(([u]) => u === node?.id)) ||
                          (naming &&
                            node !== undefined &&
                            resolve?.use === node.id)
                        const missingAt =
                          node === undefined
                            ? undefined
                            : missingStep.get(node.id)
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
                            data-piece=""
                            data-start={token.start}
                            className={`ac-piece ${node ? 'node' : 'token'} kind-${token.kind} ${focused ? 'focused' : ''} ${pending ? 'pending' : ''} ${node && node.id === working.preview ? 'preview' : ''} ${node && working.outside.includes(node.id) ? 'outside' : ''} ${declared ? 'declared' : ''} ${found ? 'found' : ''} ${use ? 'use' : ''} ${missing ? 'missing' : ''} ${life ? 'life' : ''} ${sliding ? 'absorbed' : ''} ${node && dragging === node.id ? 'dragged' : ''}`}
                            initial={{
                              left: '-5%',
                              top:
                                (Math.min(tokenPoint.y, 98) / 480) * 100 + '%',
                              opacity: 0,
                            }}
                            animate={{
                              left: (p.x / 680) * 100 + '%',
                              top: (p.y / 480) * 100 + '%',
                              scale: node ? fit : sliding ? fit * 0.8 : 1,
                              opacity: sliding ? [1, 1, 0] : 1,
                            }}
                            exit={{ opacity: 0 }}
                            transition={
                              // (a node this step adds waits for the edge it
                              // attaches: `arrive`)
                              node && arrive && isNew(node.id)
                                ? { ...moveTransition, delay: arrive }
                                : moveTransition
                            }
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
                            onPointerDown={(e) => {
                              // (mouse and pen: a finger pans the canvas)
                              if (
                                !node ||
                                e.button !== 0 ||
                                graphShown ||
                                e.pointerType === 'touch'
                              )
                                return
                              e.currentTarget.setPointerCapture(e.pointerId)
                              nodeDrag.current = {
                                id: node.id,
                                pointer: e.pointerId,
                                at: canvasPoint(e.clientX, e.clientY),
                                from: nudged.get(node.id) ?? { x: 0, y: 0 },
                                moved: false,
                              }
                            }}
                            onPointerMove={(e) => {
                              const d = nodeDrag.current
                              if (
                                !d ||
                                !node ||
                                d.pointer !== e.pointerId ||
                                d.id !== node.id ||
                                !(e.buttons & 1)
                              )
                                return
                              // In the canvas's own px, so a pan or zoom during
                              // the drag doesn't slip the node from the pointer.
                              const p = canvasPoint(e.clientX, e.clientY)
                              const dx = p.x - d.at.x,
                                dy = p.y - d.at.y
                              const k = canvas.current?.view().k ?? 1
                              if (!d.moved) {
                                if (Math.hypot(dx, dy) * k < 4) return
                                d.moved = true
                                setPlaying(false)
                                setDragging(node.id)
                                clearHover()
                              }
                              setNudged((m) =>
                                new Map(m).set(
                                  d.id,
                                  keepReachable(d.id, {
                                    x: d.from.x + dx * (VIEW_W / sceneWidth),
                                    y: d.from.y + dy * (VIEW_H / sceneHeight),
                                  }),
                                ),
                              )
                            }}
                            onPointerUp={() => {
                              if (nodeDrag.current?.moved)
                                dragEnd.current = performance.now()
                              nodeDrag.current = null
                              setDragging(null)
                            }}
                            onPointerCancel={() => {
                              // (no click comes after a cancel)
                              nodeDrag.current = null
                              setDragging(null)
                            }}
                            onLostPointerCapture={() => {
                              nodeDrag.current = null
                              setDragging(null)
                            }}
                            onDoubleClick={() => {
                              if (!node || !nudged.has(node.id)) return
                              // The double-click's first click toggled the card;
                              // a reset leaves it as it was.
                              setCardOpen((open) => !open)
                              setNudged((m) => {
                                const next = new Map(m)
                                next.delete(node.id)
                                return next
                              })
                            }}
                            onClick={(e) => {
                              // A drag isn't a click, nor is the second of a
                              // double-click that puts a dragged node back
                              // (onDoubleClick). Any other click again in the
                              // same spot toggles the card again.
                              if (
                                performance.now() - dragEnd.current < 300 ||
                                (e.detail > 1 && !!node && nudged.has(node.id))
                              )
                                return
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
                            {!parsed && focused && (
                              <small>{tokenKind(token)}</small>
                            )}
                            {landing &&
                              landingSpot !== 'none' &&
                              node &&
                              (w.kind === 'parse.node' ||
                                w.kind === 'parse.wait') &&
                              node.id === w.node && (
                                <small
                                  className={`ac-class ${landingSpot ?? ''}`}
                                >
                                  {landing.cls}
                                </small>
                              )}
                            {node && working.cue?.node === node.id && (
                              <small className="ac-cue">
                                {working.cue.text}
                              </small>
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
                                    {badge.text.slice(
                                      0,
                                      badge.text.indexOf('→'),
                                    )}
                                    <span className="returns">
                                      {badge.text.slice(
                                        badge.text.indexOf('→'),
                                      )}
                                    </span>
                                  </>
                                ) : (
                                  badge.text
                                )}
                              </small>
                            )}
                          </motion.button>
                        )
                      }),
                    )}
                </AnimatePresence>
                <AnimatePresence key={`badges-${epoch}`} initial={firstMount}>
                  {frame.phase === 'Emit' &&
                    badgesAt(regs, frame.instructionCount, currentRange).map(
                      (b, _, poses) => {
                        // Centres in scene pixels; a badge sits just right of its
                        // node's box and shrinks with the tree, as a type badge
                        // does, so it fits the room the layout keeps for it.
                        const width =
                          ((b.reg.length + (b.address ? 2 : 0)) * TYPE_PX + 8) *
                          fit
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
                        const total =
                          leaves + travel + transition.duration * 0.3
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
                                      (travel * i) /
                                        Math.max(1, path.length - 1),
                                  ),
                                ),
                              ]
                        // In as it is written, out once it has arrived.
                        const arrived = leaves + travel
                        const fade = [
                          at(Math.min(shows, arrived)),
                          at(
                            Math.min(
                              shows + transition.duration * 0.3,
                              arrived,
                            ),
                          ),
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
                                    left: [held, ...path].map(
                                      (q) => pct(q).left,
                                    ),
                                    top: [held, ...path].map((q) => pct(q).top),
                                    opacity: fresh
                                      ? [0, 0, 1, 1, 0]
                                      : [1, 1, 0],
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
                {proof && proofAt && (
                  <div
                    ref={proofRef}
                    key={`proof-${proof.id}`}
                    className="ac-hover-proof"
                    style={{
                      left: proofAt.left,
                      top: proofAt.top,
                      maxWidth: sceneWidth - 8,
                      visibility: proofAt.measured ? undefined : 'hidden',
                      ['--ck' as string]: fit,
                    }}
                    aria-hidden
                  >
                    <ProofTree d={proof.d} id={proof.id} limit={1} />
                  </div>
                )}
                {card && cardAt && cardBox && (
                  <motion.div
                    key={card.key}
                    className="ac-hover"
                    style={{ '--ck': ck } as MotionStyle}
                    initial={false}
                    animate={cardBox}
                    transition={{ duration: reduced ? 0 : 0.22, ease: EASE }}
                  >
                    {card.title}
                    <AnimatePresence initial={false}>
                      {cardOpen && card.list.length > 0 && (
                        <motion.div
                          className="ac-hover-list"
                          initial={{ gridTemplateRows: '0fr', opacity: 0 }}
                          animate={{ gridTemplateRows: '1fr', opacity: 1 }}
                          exit={{ gridTemplateRows: '0fr', opacity: 0 }}
                          transition={{
                            duration: reduced ? 0 : 0.22,
                            ease: EASE,
                          }}
                        >
                          <div>
                            <ul
                              className="ac-lexemes"
                              aria-label={card.label}
                              style={{ width: openWidth - 22 * ck }}
                            >
                              {card.list.map((lexeme) => (
                                <li
                                  key={lexeme}
                                  className={
                                    lexeme === card.current ? 'current' : ''
                                  }
                                >
                                  {lexeme}
                                </li>
                              ))}
                            </ul>
                          </div>
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
                    <AnimatePresence
                      key={`graph-edges-${epoch}`}
                      initial={firstMount}
                    >
                      {graphShown &&
                        graphFn.interference.edges.map(([a, b]) => {
                          const p = toPx(graphPoint(a)),
                            q = toPx(graphPoint(b))
                          // From rim to rim, clear of the names inside.
                          const d = Math.max(
                            1,
                            Math.hypot(q.x - p.x, q.y - p.y),
                          )
                          const trim = Math.min(VR_RIM, d / 2 - 1) / d
                          const tx = (q.x - p.x) * trim,
                            ty = (q.y - p.y) * trim
                          const gone = onStack.has(a) || onStack.has(b)
                          // At a stop, only the current register's edges stay:
                          // they are what its choice depends on.
                          const mine = stepVr === a || stepVr === b
                          return (
                            <motion.line
                              key={`ig-${a}-${b}`}
                              x1={p.x + tx}
                              y1={p.y + ty}
                              x2={q.x - tx}
                              y2={q.y - ty}
                              stroke="currentColor"
                              strokeWidth={1}
                              strokeLinecap="round"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{
                                pathLength: 1,
                                opacity: gone
                                  ? 0.1
                                  : mine
                                    ? 0.85
                                    : stepVr !== undefined
                                      ? 0.18
                                      : 0.45,
                              }}
                              exit={{ opacity: 0 }}
                              transition={transition}
                            />
                          )
                        })}
                    </AnimatePresence>
                  </svg>
                )}
                <AnimatePresence
                  key={`graph-nodes-${epoch}`}
                  initial={firstMount}
                >
                  {graphFn &&
                    graphShown &&
                    graphFn.interference.nodes.map((vr) => {
                      const p = graphPoint(vr)
                      const colour = coloured?.[vr]
                      const idx = colour ? paletteIndex(colour) : -1
                      const order = pushedAs.get(vr)
                      return (
                        <motion.span
                          key={`vr-${vr}`}
                          className={`ac-vr ${vr === stepVr ? 'focused' : ''} ${order ? 'aside' : ''} ${candidates.has(vr) ? 'candidate' : ''} ${spilled.has(vr) ? 'spilled' : ''} ${colour ? 'coloured' : ''}`}
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
                            opacity: 1,
                            left: `${(p.x / 680) * 100}%`,
                            top: `${(p.y / 480) * 100}%`,
                          }}
                          exit={{ opacity: 0 }}
                          transition={transition}
                          role="img"
                          aria-label={`Virtual register ${vr}${colour ? `, now ${colour}` : order ? `, set aside ${order}` : ''}`}
                        >
                          {vr}
                          {colour && <small>{colour}</small>}
                          {order && <i>{order}</i>}
                        </motion.span>
                      )
                    })}
                </AnimatePresence>
              </div>
              {/* Zoom, in the corner of the view the listing's pane
              leaves. */}
              <div
                className="ac-zoom"
                role="group"
                aria-label="Zoom"
                style={{ right: cover.right + 8, bottom: cover.bottom + 8 }}
              >
                <button
                  type="button"
                  aria-label="Zoom out"
                  title="Zoom out"
                  disabled={rest.least}
                  onClick={() => {
                    handHeld.current = pass
                    canvas.current?.zoomBy(1 / ZOOM_STEP, !reduced)
                  }}
                >
                  <ZoomOut aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Zoom in"
                  title="Zoom in"
                  disabled={rest.most}
                  onClick={() => {
                    handHeld.current = pass
                    canvas.current?.zoomBy(ZOOM_STEP, !reduced)
                  }}
                >
                  <ZoomIn aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Fit"
                  title="Fit (0)"
                  disabled={rest.home && nudged.size === 0}
                  onClick={() => {
                    handHeld.current = null
                    canvas.current?.home(!reduced)
                    setNudged(new Map())
                  }}
                >
                  <Maximize aria-hidden="true" />
                </button>
              </div>
            </div>
            {/* A phone's grip in the gap between the stage and the
                listing: here, outside the listing's clip, where it can sit
                in that gap and follow it as the listing slides in. */}
            {late && listingFlow && narrow && (
              <div className="ac-flowsplit-at">{flowSplit('listing')}</div>
            )}
            {/* Emit and registers: one listing in its own pane, the same
            through both, so the step from one to the other changes its
            registers and lines, not where or how it's drawn. */}
            <AnimatePresence initial={false}>
              {late && (
                <motion.div
                  // One pane whichever edge it's on: two, crossing over on a
                  // resize, would share the refs, and the one leaving would
                  // clear them from the one staying.
                  key="listing"
                  className={`ac-listing ${listingSide ? 'side' : 'foot'} ${listingFlow ? 'flow' : ''}`}
                  initial={
                    listingSide
                      ? { width: 0, height: '100%' }
                      : { width: '100%', height: 0 }
                  }
                  animate={
                    listingSide
                      ? { width: listingW, height: '100%' }
                      : { width: '100%', height: listingH }
                  }
                  exit={
                    listingSide
                      ? { width: 0, height: '100%' }
                      : { width: '100%', height: 0 }
                  }
                  transition={{
                    duration: reduced || resizing || listingDragging ? 0 : 0.35,
                    ease: EASE,
                  }}
                >
                  {/* Drag the listing's edge to size it, as the editor's is;
                    double-click resets. On a phone, where it sits under the
                    stage, its top edge drags, and the source's below it
                    (flowSplit). Inside the pane, it rides its edge as it
                    slides. */}
                  {!listingFlow && (
                    <div
                      className={`ac-listsplit ${listingSide ? 'side' : 'foot'}`}
                      role="separator"
                      aria-orientation={listingSide ? 'vertical' : 'horizontal'}
                      aria-label="Resize assembly"
                      aria-valuenow={listingSide ? listingW : listingH}
                      aria-valuemin={listingSide ? 160 : 96}
                      aria-valuemax={
                        listingSide ? sceneWidth - 200 : sceneHeight - 96
                      }
                      tabIndex={0}
                      onPointerDown={(e) => {
                        e.preventDefault()
                        e.currentTarget.setPointerCapture(e.pointerId)
                        listingDrag.current = listingSide
                          ? { at: e.clientX, size: listingW, axis: 'w' }
                          : { at: e.clientY, size: listingH, axis: 'h' }
                        setListingDragging(true)
                      }}
                      onPointerMove={(e) => {
                        const d = listingDrag.current
                        if (!d) return
                        // (the pane grows away from the edge it's on)
                        const size =
                          d.axis === 'w'
                            ? clampListingW(d.size - (e.clientX - d.at))
                            : clampListingH(d.size - (e.clientY - d.at))
                        setListingSize((s) => ({ ...s, [d.axis]: size }))
                      }}
                      onPointerUp={() => {
                        const d = listingDrag.current
                        if (d)
                          saveListing(d.axis, listingSize[d.axis] ?? d.size)
                        listingDrag.current = null
                        setListingDragging(false)
                      }}
                      onLostPointerCapture={() => {
                        listingDrag.current = null
                        setListingDragging(false)
                      }}
                      onPointerCancel={() => {
                        listingDrag.current = null
                        setListingDragging(false)
                      }}
                      onDoubleClick={() =>
                        saveListing(listingSide ? 'w' : 'h', null)
                      }
                      onKeyDown={(e) => {
                        const grow = listingSide
                          ? e.key === 'ArrowLeft'
                            ? 20
                            : e.key === 'ArrowRight'
                              ? -20
                              : 0
                          : e.key === 'ArrowUp'
                            ? 20
                            : e.key === 'ArrowDown'
                              ? -20
                              : 0
                        if (!grow) return
                        e.preventDefault()
                        e.stopPropagation()
                        if (listingSide)
                          saveListing('w', clampListingW(listingW + grow))
                        else saveListing('h', clampListingH(listingH + grow))
                      }}
                    />
                  )}
                  <div
                    className="ac-listing-scroll"
                    ref={listingRef}
                    style={
                      listingSide
                        ? { width: listingW - 1 }
                        : { height: listingH - 1 }
                    }
                    onWheel={touchListing}
                    onTouchStart={touchListing}
                    onPointerDown={touchListing}
                    onKeyDown={touchListing}
                    // Scrolled by anything but a step (its rail, a finger
                    // still on it): a hand's too.
                    onScroll={() => {
                      if (performance.now() - listingAuto.current > 1000)
                        touchListing()
                    }}
                    tabIndex={0}
                    role="region"
                    aria-label="Assembly"
                  >
                    <div
                      className={`ac-asm listing ${emitStage ? 'blocks' : ''} ${focusLane ? 'reg-focus' : ''}`}
                      ref={instructionRef}
                      // (the lanes are drawn over it, so it keeps their room)
                      style={lanesShown ? { minWidth: listingMin } : undefined}
                    >
                      {shownInstructions.map((ins, i) => {
                        const current = currentRange
                          ? i >= currentRange[0] && i <= currentRange[1]
                          : !emitStage &&
                            ((frame.phase === 'Emit' &&
                              i === shownInstructions.length - 1) ||
                              (frame.phase === 'Registers' &&
                                !backend &&
                                i === frame.allocationCount - 1))
                        // A block's rows arrive one after another.
                        const enter = {
                          ...transition,
                          delay:
                            emitStage && current && currentRange
                              ? (i - currentRange[0]) * rowStagger
                              : 0,
                        }
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
                          ins.op === 'pushRegisters' ||
                          ins.op === 'popRegisters'
                        // Functions the allocator is done with: the code it
                        // wrote, saves, restores and spill code included.
                        const lines =
                          ins.fn !== undefined && ins.fn < rewrittenFns
                            ? rewritten(ins)
                            : undefined
                        // The line the instruction became; for a placeholder,
                        // its first save or restore.
                        const anchor = lines?.length
                          ? Math.max(
                              0,
                              lines.findIndex((l) => !l.added),
                            )
                          : -1
                        const head = asmHeads.get(i)
                        const operands = (text: string) =>
                          emitStage
                            ? text.split(/(?<!\$)\b(v\d+)\b/).map((part, j) => {
                                if (j % 2 === 0) return part
                                const key = `${ins.fn}:${part}`
                                const on = key === regFocus?.key && !!focusLane
                                return (
                                  <span
                                    key={j}
                                    data-vr
                                    className={`ac-arg ${on ? 'focus' : ''} ${on && j === 1 && i === focusLane.def ? 'def' : ''} ${allocIntro ? 'lit' : ''}`}
                                    // (lit row by row, down the listing)
                                    style={
                                      allocIntro
                                        ? ({
                                            '--lit-at': i - firstLit,
                                          } as CSSProperties)
                                        : undefined
                                    }
                                    onMouseEnter={() => focusReg(key, false)}
                                    onMouseLeave={blurReg}
                                    onClick={() => focusReg(key, true)}
                                  >
                                    {part}
                                  </span>
                                )
                              })
                            : regView
                              ? // A physical register takes its lane's colour
                                // as it replaces a virtual one. (Every
                                // register is its own part, so a part keeps
                                // its place as `v7` becomes `$t1`.)
                                text
                                  .split(/(\$[a-z]+\d+|\bv\d+\b)/)
                                  .map((part, j) => {
                                    const idx = j % 2 ? paletteIndex(part) : -1
                                    return idx < 0 ? (
                                      part
                                    ) : (
                                      <span
                                        key={`${j}-${part}`}
                                        className="ac-phys"
                                        style={
                                          {
                                            '--c': INK[idx % INK.length],
                                          } as CSSProperties
                                        }
                                      >
                                        {part}
                                      </span>
                                    )
                                  })
                              : text
                        // The instruction's own row: the same element from
                        // emit to registers, so it isn't drawn again.
                        const row = (line?: {
                          text: string
                          added?: boolean
                        }) => {
                          const [lineOp, lineArgs = ''] = line
                            ? line.text.split(/\s+(.*)/)
                            : [op, args]
                          return (
                            <motion.div
                              key="row"
                              data-row={i}
                              className={`ac-ins ${current ? 'current' : ''} ${ins.dead ? 'dead' : ''} ${line?.added ? 'added' : ''} ${i === hoverIns && !playing ? 'hover' : ''} ${focusLane && i >= focusLane.def && i <= focusLane.last ? 'live' : ''}`}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={enter}
                              onMouseEnter={() =>
                                emitStage && !playing && setHoverIns(i)
                              }
                              onMouseLeave={clearHover}
                            >
                              <span>{rowNumbers[i]}</span>
                              {hold && !line ? (
                                <code className="ac-hold">{op}</code>
                              ) : (
                                <>
                                  <b>{lineOp}</b>
                                  <code>{operands(lineArgs)}</code>
                                </>
                              )}
                              {ins.dead && <small>never runs</small>}
                              {/* DRAFT copy */}
                              {lines?.length === 0 && (
                                <small>
                                  {ins.op === 'pushRegisters'
                                    ? 'nothing to save'
                                    : 'nothing to restore'}
                                </small>
                              )}
                            </motion.div>
                          )
                        }
                        return (
                          <Fragment key={`instruction-${i}`}>
                            {[
                              ...(ins.labels ?? []).map((l) => (
                                <motion.div
                                  key={`label-${l}`}
                                  className={`ac-asm-label ${functionNames.has(l) ? 'fn' : ''}`}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={enter}
                                >
                                  {l}:
                                </motion.div>
                              )),
                              head && (
                                <motion.div
                                  key="head"
                                  className="ac-asm-head"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={enter}
                                >
                                  ; {head}
                                </motion.div>
                              ),
                              ...(lines?.length
                                ? lines.map((line, j) =>
                                    j === anchor ? (
                                      row(line)
                                    ) : (
                                      <motion.div
                                        key={`added-${j}`}
                                        className="ac-ins added"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={transition}
                                        onMouseEnter={() =>
                                          emitStage &&
                                          !playing &&
                                          setHoverIns(i)
                                        }
                                        onMouseLeave={clearHover}
                                      >
                                        <span />
                                        <b>{line.text.split(/\s+(.*)/)[0]}</b>
                                        <code>
                                          {operands(
                                            line.text.split(/\s+(.*)/)[1] ?? '',
                                          )}
                                        </code>
                                      </motion.div>
                                    ),
                                  )
                                : hideHolds && hold
                                  ? []
                                  : [row()]),
                            ]}
                          </Fragment>
                        )
                      })}
                      {/* The lanes carry on into registers: each takes its
                      register's colour once the allocator picks one. */}
                      {lanesShown && (
                        <EmitLanes
                          // At the column's right edge when it's wider than
                          // the lines (its gutter and border, the listing's
                          // 12px), else just past the longest line
                          // (Stanley, 2026-10-01).
                          left={
                            listingSide && !listingFlow
                              ? Math.max(lanesAt, listingW - 10 - 12 - lanesW)
                              : lanesAt
                          }
                          lanes={lanes.lanes}
                          columns={lanes.columns}
                          count={frame.instructionCount}
                          range={emitStage && !back ? currentRange : null}
                          focused={
                            emitStage ? focusLane && regFocus?.key : undefined
                          }
                          onFocus={emitStage ? focusReg : () => {}}
                          onBlur={emitStage ? blurReg : () => {}}
                          focus={
                            new Set(
                              emitStage
                                ? hoverIns !== null && !playing
                                  ? registersOf(
                                      trace.instructions[hoverIns],
                                    ).map(
                                      (r) =>
                                        `${trace.instructions[hoverIns].fn}:${r}`,
                                    )
                                  : []
                                : stepVr === undefined
                                  ? []
                                  : [`${fnIndex}:${stepVr}`],
                            )
                          }
                          stagger={rowStagger}
                          duration={transition.duration}
                          still={!!reduced}
                          layout={rewrittenFns}
                          tint={
                            regView
                              ? (key) => {
                                  const colour = coloured?.[key.split(':')[1]]
                                  return colour
                                    ? INK[paletteIndex(colour) % INK.length]
                                    : undefined
                                }
                              : undefined
                          }
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
                    </div>
                    {stackBeside}
                  </div>
                  {stackPane}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>
      {emitStage && !allocSlides && stackAt && stackColumn(stackAt)}
      {/* On a phone the note and the controls dock to the bottom of the
          screen, so a step and what it means stay in view with the stage
          (animated.css); elsewhere the dock is no box at all. */}
      <div
        className="ac-dock"
        style={
          narrow && flowSizes.note !== null
            ? ({ '--note-h': `${flowSizes.note}px` } as CSSProperties)
            : undefined
        }
      >
        {!narrow && noteWindow}
        {guideWindow}
        {astWindow}

        <footer className="ac-keys" aria-label="Controls">
          <button
            onClick={play}
            className={playing ? 'on' : ''}
            disabled={realPending}
          >
            {realPending
              ? compilerLoaded
                ? 'compiling…'
                : 'loading compiler…'
              : playing
                ? 'pause'
                : 'play'}
          </button>
          <span className="ac-step">
            {/* A press steps and a hold keeps stepping (startHold); Enter or
              Space on the focused button steps once (detail 0). */}
            <button
              aria-label="Step back"
              title="Step back (←)"
              onPointerDown={(e) => {
                if (e.button !== 0) return
                e.preventDefault()
                startHold(-1)
              }}
              onClick={(e) => e.detail === 0 && move(-1)}
              disabled={realPending || (index === 0 && slide === 0)}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <button
              aria-label="Step forward"
              title="Step forward (→)"
              onPointerDown={(e) => {
                if (e.button !== 0) return
                e.preventDefault()
                startHold(1)
              }}
              onClick={(e) => e.detail === 0 && move(1)}
              disabled={realPending || index === last}
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </span>
          <button className="ac-roomy" onClick={() => seek(0)}>
            reset
          </button>
          {/* A click goes round the speeds; - and + step through them. */}
          <button
            className="ac-roomy"
            aria-label={`Speed ${speed}x`}
            onClick={() =>
              setSpeed((s) => speeds[(speeds.indexOf(s) + 1) % speeds.length])
            }
          >
            {/* A plain x, a touch bigger than × (Stanley, 2026-10-02) */}
            {speed}x
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
          <span
            className="ac-counter"
            // Room for the widest count, so the scrubber doesn't move when
            // the step gains a digit.
            style={{ minWidth: `${String(last).length * 2 + 1}ch` }}
          >
            {String(index).padStart(2, '0')}/{String(last).padStart(2, '0')}
          </span>
          <div className="ac-more" ref={moreRef}>
            <button
              type="button"
              aria-label="Settings"
              title="Settings"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((o) => !o)}
            >
              {/* A cog, not a ? (Stanley, 2026-10-02). */}
              <Settings aria-hidden="true" />
            </button>
            {moreOpen && (
              <div className="ac-more-menu" role="menu">
                {/* A phone's bar has room only to step; reset and the speed
                  move in here. */}
                <button
                  type="button"
                  role="menuitem"
                  className="ac-cramped"
                  onClick={() => {
                    seek(0)
                    setMoreOpen(false)
                  }}
                >
                  reset
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="ac-cramped"
                  onClick={() =>
                    setSpeed(
                      (s) => speeds[(speeds.indexOf(s) + 1) % speeds.length],
                    )
                  }
                >
                  speed {speed}x
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="ac-cramped"
                  onClick={() => {
                    setAboutOpen(true)
                    setMoreOpen(false)
                  }}
                >
                  about
                </button>
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
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={guideOn}
                  onClick={() => saveGuide(!guideOn)}
                >
                  <span aria-hidden="true">{guideOn ? '[x]' : '[ ]'}</span>
                  syntax guide
                </button>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={astOn}
                  onClick={() => saveAst(!astOn)}
                >
                  <span aria-hidden="true">{astOn ? '[x]' : '[ ]'}</span>
                  AST guide
                </button>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={resolvedTheme === 'dark'}
                  onClick={() =>
                    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
                  }
                >
                  <span aria-hidden="true">
                    {resolvedTheme === 'dark' ? '[x]' : '[ ]'}
                  </span>
                  dark mode
                </button>
                {/* The keys, kept here rather than on every button. */}
                <dl className="ac-more-keys">
                  {KEYS.map(([keys, what]) => (
                    <Fragment key={keys.join()}>
                      <dt>
                        {keys.map((k) => (
                          <kbd key={k}>{k}</kbd>
                        ))}
                      </dt>
                      <dd>{what}</dd>
                    </Fragment>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </footer>
      </div>
    </section>
  )
}
