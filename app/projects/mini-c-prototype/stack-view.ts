// The emit phase's stack column (Astra's and Fable's emit answers,
// 2026-09-24; Astra's stack review, 2026-09-25): one function's frame.
// Addresses are bytes from where `$sp` stood when the function was
// entered, so the caller's words (return slot, arguments) sit at 0 and
// above and this frame's below; `$fp` ends up at -4.
//
// It shows how the frame is built and taken apart, and which word each
// line touches; not what the words hold (Stanley, 2026-09-25). All of it
// is what the compiler decided: the words and their names come from
// trace.layout (what MemAllocCodeGen gave each declaration), what each
// line is for from its tag (CodeGen.tag: "the address of `pair.right`",
// "a word for `twice`'s `n`", "the byte copy of `a` into `b`"), and the
// registers pushRegisters saves from what the allocator turned it into.
// `$sp` and `$fp` move as the lines say; a register holds a word's address
// from the line tagged as forming it.
import type {
  CType,
  Instruction,
  Layout,
  Place,
  Storage,
  Tag,
  Trace,
} from './trace'

export type StackPose = {
  sp: number
  /** null before `$fp` is set up, and once the caller's is restored. */
  fp: number | null
}

export type StackTouch = {
  at: number
  addr: number
  kind: 'read' | 'write'
  /** A write: the register stored. */
  reg?: string
  /** Somewhere in an object, not a known word (`cells[i]`, a copy). */
  wide?: boolean
  /** A copy's read: the loop's last line, until which the words matter. */
  until?: number
}

/** A virtual register holding a word's address (`addi v0,$fp,-8`), from
 * the line that sets it to its last read. */
export type StackPointer = {
  vr: string
  addr: number
  def: number
  last: number
}

export type WordKind =
  | 'link' // the caller's `$fp`, `$ra`
  | 'return'
  | 'param'
  | 'local'
  | 'saved' // pushRegisters
  | 'arg' // an argument pushed for a call
  | 'result' // a call's return slot
  | 'data' // a global
  | 'spare'

export type Word = { label: string; kind: WordKind }

/** A word only while a call or a register save holds it. */
export type Owner = Word & { addr: number; from: number; to: number }

/** A row of the column: one word, or a run of an array's words folded
 * into one (`cells[2…61]`). `addr` is its highest word. */
export type StackRow = {
  addr: number
  lo: number
  fold?: string
  data?: boolean
}

export type StackFrame = {
  fn: number
  name: string
  first: number
  last: number
  /** Pose after each instruction, from `first` (poses[0] is at entry). */
  poses: StackPose[]
  rows: StackRow[]
  /** Each word's row, folded words included. */
  rowOf: Map<number, number>
  words: Map<number, Word>
  owners: Owner[]
  touches: StackTouch[]
  pointers: StackPointer[]
  /** Words below `$sp` a later line still reads (the epilogue's
   * restores), after each instruction. */
  kept: Set<number>[]
  /** Highest word shown. */
  top: number
  /** The registers pushRegisters saves. */
  saved: string[]
  /** At each call, the callee's frame as it will sit under `$sp`. */
  calls: Map<number, { callee: string; words: (Word & { addr: number })[] }>
}

// Globals sit far below the stack, in the order declared.
const DATA = -1 << 20
const FP = -4

export function sizeOf(t: CType, layout: Layout): number {
  switch (t.k) {
    case 'int':
    case 'ptr':
      return 4
    case 'char':
      return 1
    case 'array':
      return t.n * sizeOf(t.of, layout)
    case 'struct':
      return layout.structs[t.name]?.size ?? 4
    default:
      return 0
  }
}

type Leaf = { off: number; size: number; name: string }

/** Every scalar inside a declaration, by byte offset: `pair.left`,
 * `cells[3]`. */
function leaves(name: string, t: CType, layout: Layout, off = 0): Leaf[] {
  if (t.k === 'array') {
    const es = sizeOf(t.of, layout)
    const out: Leaf[] = []
    for (let i = 0; i < t.n; i++)
      out.push(...leaves(`${name}[${i}]`, t.of, layout, off + i * es))
    return out
  }
  if (t.k === 'struct' && layout.structs[t.name])
    return layout.structs[t.name].fields.flatMap((f) =>
      leaves(`${name}.${f.name}`, f.type, layout, off + f.off),
    )
  return [{ off, size: Math.max(1, sizeOf(t, layout)), name }]
}

/** One word's name from the scalars in it: `cells[3]`, `s[0–3]`,
 * `p.a, p.b`. */
function wordName(inside: Leaf[]) {
  if (inside.length <= 1) return inside[0]?.name ?? ''
  const index = inside.map((l) => /^(.*)\[(\d+)\]$/.exec(l.name))
  const base = index[0]?.[1]
  if (index.every((m) => m && m[1] === base))
    return `${base}[${index[0]?.[2]}–${index[index.length - 1]?.[2]}]`
  return inside.map((l) => l.name).join(', ')
}

/** A declaration's storage, as a range of addresses. */
type Obj = { lo: number; hi: number; name: string; leaves: Leaf[] }

function place(
  s: Storage,
  lo: number,
  layout: Layout,
  asPointer: boolean,
): Obj {
  const ls = asPointer
    ? [{ off: 0, size: 4, name: s.name }]
    : leaves(s.name, s.type, layout)
  return {
    lo,
    hi: lo + Math.max(4, s.size),
    name: s.name,
    leaves: ls.map((l) => ({ ...l, off: l.off + lo })),
  }
}

const nameOfWord = (o: Obj, w: number) =>
  wordName(o.leaves.filter((l) => l.off < w + 4 && l.off + l.size > w))

const parse = (text: string) => {
  const [op, rest = ''] = text.split(/\s+(.*)/)
  return { op, a: rest ? rest.split(',').map((x) => x.trim()) : [] }
}

/** The registers a function's pushRegisters saves, as the allocator
 * expanded it; without that, every register it was given, in palette
 * order (GraphColouringRegAlloc.allColoredArchRegs). */
function savedBy(trace: Trace, fn: number): string[] {
  const push = trace.instructions.find(
    (i) => i.fn === fn && i.op === 'pushRegisters',
  )
  if (push?.out)
    return push.out.flatMap((t) => /^sw (\$\w+),/.exec(t)?.[1] ?? [])
  const used = new Set(
    Object.values(trace.backend?.functions[fn]?.colouring.result ?? {}),
  )
  return (trace.backend?.palette ?? []).filter((r) => used.has(r))
}

const built = new WeakMap<Trace, StackFrame[]>()

/** Declarations bigger than this aren't drawn: a column of a million words
 * helps no one, and naming each of them would stall the page. */
export const MAX_DRAWN_BYTES = 4096

/** The first declaration too big to draw, if any; then no frame is built. */
export function tooBig(trace: Trace) {
  const layout = trace.layout
  if (!layout) return undefined
  return [
    ...layout.globals,
    ...layout.functions.flatMap((f) => [...f.params, ...f.locals]),
    // Its size worked out here too, from the type: the compiler's own
    // (a Java int) overflows for int a[2147483647] and comes out negative.
  ].find(
    (s) =>
      s.size > MAX_DRAWN_BYTES ||
      s.size < 0 ||
      sizeOf(s.type, layout) > MAX_DRAWN_BYTES,
  )
}

export function stackFrames(trace: Trace): StackFrame[] {
  const cached = built.get(trace)
  if (cached) return cached
  if (tooBig(trace)) {
    built.set(trace, [])
    return []
  }
  const out: StackFrame[] = []
  const ins = trace.instructions
  const layout = trace.layout
  if (!layout) return []
  let start = 0
  while (start < ins.length) {
    const fn = ins[start].fn
    if (fn === undefined || ins[start].text === undefined) return []
    let end = start
    while (end + 1 < ins.length && ins[end + 1].fn === fn) end++
    const frame = build(trace, layout, fn, start, end)
    if (frame) out.push(frame)
    start = end + 1
  }
  built.set(trace, out)
  return out
}

/** An address a register holds: one word, or somewhere in an object. */
type Addr = { exact: number | null; lo: number; hi: number }

function build(
  trace: Trace,
  layout: Layout,
  fn: number,
  first: number,
  last: number,
): StackFrame | undefined {
  const ins = trace.instructions
  const name = trace.backend?.functions[fn]?.name ?? ''
  const me = layout.functions.find((f) => f.name === name)
  if (!me) return undefined
  const n = last - first + 1
  const at = (k: number) => ins[first + k]
  const code = (k: number) => parse(at(k).text ?? '')

  // ---- storage: the frame's words and the program's globals -------------
  const objects: Obj[] = []
  const byNode = new Map<number, Obj>()
  const words = new Map<number, Word>()
  const name4 = (o: Obj, kind: WordKind, node: number | null) => {
    objects.push(o)
    if (node !== null) byNode.set(node, o)
    for (let w = o.lo; w < o.hi; w += 4)
      words.set(w, { kind, label: nameOfWord(o, w) })
  }
  const ret = me.return
    ? place(
        {
          name: 'return',
          node: null,
          size: me.return.size,
          type: me.return.type,
        },
        FP + me.return.off,
        layout,
        false,
      )
    : undefined
  if (ret) name4(ret, 'return', null)
  for (const p of me.params)
    name4(
      place(p, FP + (p.off ?? 0), layout, p.type.k === 'array'),
      'param',
      p.node,
    )
  for (const l of me.locals)
    name4(place(l, FP + (l.off ?? 0), layout, false), 'local', l.node)
  words.set(FP, { label: "caller's $fp", kind: 'link' })
  const main = name === 'main'
  words.set(
    FP - 4,
    main ? { label: '', kind: 'spare' } : { label: '$ra', kind: 'link' },
  )
  let data = DATA
  for (const g of layout.globals) {
    name4(place(g, data, layout, false), 'data', g.node)
    data += Math.ceil(Math.max(4, g.size) / 4) * 4 + 4
  }
  const objectAt = (a: number) => objects.find((o) => a >= o.lo && a < o.hi)
  const saved = savedBy(trace, fn)

  // ---- `$sp` and `$fp`, line by line ------------------------------------
  const poses: StackPose[] = [{ sp: 0, fp: null }]
  for (let k = 0; k < n; k++) {
    const pose = poses[k]
    const next = { ...pose }
    const { op, a } = code(k)
    if (!at(k).dead) {
      if (/^addiu?$/.test(op) && a[0] === '$sp') {
        const from = a[1] === '$fp' ? pose.fp : pose.sp
        if (from !== null) next.sp = from + Number(a[2])
      } else if (op === 'addiu' && a[0] === '$fp' && a[1] === '$sp')
        next.fp = pose.sp
      else if (op === 'lw' && a[0] === '$fp') next.fp = null
      else if (op === 'pushRegisters') next.sp = pose.sp - 4 * saved.length
      else if (op === 'popRegisters') next.sp = pose.sp + 4 * saved.length
    }
    poses.push(next)
  }

  // ---- addresses in registers, and the words each line touches -----------
  const held = new Map<string, Addr>()
  const touches: StackTouch[] = []
  const pointers: StackPointer[] = []
  const word = (a: number): Addr => ({ exact: a, lo: a, hi: a + 4 })
  const whole = (o: Obj, off: number | null): Addr =>
    off === null
      ? { exact: null, lo: o.lo, hi: o.hi }
      : { exact: o.lo + off, lo: o.lo, hi: o.hi }
  // A place the compiler named, as addresses: null through a pointer.
  const resolve = (
    p: Place | 'return' | 'result' | null | undefined,
    k: number,
    tag: Tag,
  ) => {
    if (!p) return null
    if (p === 'return') return ret ? whole(ret, 0) : null
    if (p === 'result') {
      const callee = layout.functions.find((f) => f.name === tag.call)
      const sp = poses[k].sp
      return {
        exact: sp,
        lo: sp,
        hi: sp + Math.max(4, callee?.return?.size ?? 4),
      }
    }
    const o = p.var === null ? undefined : byNode.get(p.var)
    return o ? whole(o, p.off) : null
  }
  // `off(base)`: `$sp` and `$fp` from the pose, a register from the line
  // that formed its address.
  const operand = (m: string, k: number): Addr | null => {
    const x = /^(-?\d+)\((\$?\w+)\)$/.exec(m)
    if (!x) return null
    const off = Number(x[1])
    const base =
      x[2] === '$sp' ? poses[k].sp : x[2] === '$fp' ? poses[k].fp : undefined
    if (base !== undefined) return base === null ? null : word(base + off)
    const h = held.get(x[2])
    if (!h) return null
    return h.exact === null ? h : { ...h, exact: h.exact + off }
  }
  const touch = (
    k: number,
    t: Addr,
    width: number,
    kind: 'read' | 'write',
    reg?: string,
    until?: number,
  ) => {
    const lo = t.exact ?? t.lo
    const hi = t.exact === null ? t.hi : t.exact + width
    const wide = t.exact === null
    for (let w = Math.floor(lo / 4) * 4; w < hi; w += 4)
      touches.push({ at: first + k, addr: w, kind, reg, wide, until })
  }
  const lastUse = (reg: string, k: number) => {
    let use = first + k
    for (let d = k + 1; d < n; d++) {
      if (at(d).args.includes(reg)) use = first + d
      if (at(d).dest === reg) break
    }
    return use
  }
  // A struct copy's two ends, from the lines that start its registers.
  const copies = new Map<string, Addr>()
  for (let k = 0; k < n; k++) {
    const i: Instruction = at(k)
    const tag = i.tag
    const { op, a } = code(k)
    if (i.dead) continue
    const dest = i.dest && /^v\d+$/.test(i.dest) ? i.dest : null
    if (dest) held.delete(dest)
    const role = tag?.role
    if (tag && role === 'addr' && dest && tag.through !== 'param') {
      const h = resolve(tag.of, k, tag)
      if (h) {
        held.set(dest, h)
        pointers.push({
          vr: dest,
          addr: h.exact === null ? h.hi - 4 : Math.floor(h.exact / 4) * 4,
          def: first + k,
          last: lastUse(dest, k),
        })
      }
    }
    if ((role === 'copy.from' || role === 'copy.to') && tag) {
      // `addiu reg, base, start`: the copy runs over `bytes` from base.
      const base = operand(`0(${a[1]})`, k)
      if (base) {
        const lo = base.exact ?? base.lo
        copies.set(
          role,
          base.exact === null
            ? base
            : { exact: lo, lo, hi: lo + (tag.bytes ?? 4) },
        )
      }
      continue
    }
    if (role === 'copy.load' || role === 'copy.store') {
      const end = copies.get(role === 'copy.load' ? 'copy.from' : 'copy.to')
      if (end)
        touch(
          k,
          {
            exact: null,
            lo: end.exact ?? end.lo,
            hi: end.exact === null ? end.hi : end.exact + (tag?.bytes ?? 4),
          },
          1,
          role === 'copy.load' ? 'read' : 'write',
          undefined,
          first +
            Math.max(
              k,
              ins
                .slice(first + k, last + 1)
                .findIndex((x) => x.tag?.role === 'copy.loop') + k,
            ),
        )
      continue
    }
    if (op === 'pushRegisters' || op === 'popRegisters') {
      const lo = Math.min(poses[k].sp, poses[k + 1].sp)
      for (let w = lo; w < lo + 4 * saved.length; w += 4)
        touches.push({
          at: first + k,
          addr: w,
          kind: op === 'pushRegisters' ? 'write' : 'read',
        })
      continue
    }
    if (/^(lw|lb|lbu|sw|sb)$/.test(op)) {
      const t = operand(a[1], k)
      if (t)
        touch(
          k,
          t,
          /w$/.test(op) ? 4 : 1,
          op.startsWith('s') ? 'write' : 'read',
          op.startsWith('s') ? a[0] : undefined,
        )
    }
  }

  // ---- who holds the words below the locals, and when ---------------------
  const owners: Owner[] = []
  const hold = (addr: number, around: number, w: Word) => {
    let from = around
    while (from > 0 && poses[from].sp <= addr) from--
    let to = around
    while (to < n && poses[to + 1].sp <= addr) to++
    owners.push({ ...w, addr, from: first + from, to: first + to })
  }
  for (let k = 0; k < n; k++) {
    const { op } = code(k)
    const tag = at(k).tag
    if (op === 'pushRegisters')
      saved.forEach((r, j) =>
        hold(poses[k].sp - 4 * (j + 1), k + 1, {
          label: `saved ${r}`,
          kind: 'saved',
        }),
      )
    if (tag?.role !== 'reserve' || (tag.for !== 'arg' && tag.for !== 'result'))
      continue
    // The words this line reserves, named from the callee's layout.
    const callee = layout.functions.find((f) => f.name === tag.call)
    const lo = poses[k + 1].sp
    const s: Storage | undefined =
      tag.for === 'result'
        ? callee?.return
          ? {
              name: 'return',
              node: null,
              size: callee.return.size,
              type: callee.return.type,
            }
          : undefined
        : callee?.params.find((p) => p.node === tag.param?.var)
    const o = s && place(s, lo, layout, s.type.k === 'array')
    for (let w = lo; w < poses[k].sp; w += 4)
      hold(w, k + 1, {
        kind: tag.for,
        label: `${tag.call}: ${o ? nameOfWord(o, w) : (tag.param?.text ?? 'return')}`,
      })
  }

  // ---- the callee's frame, under `$sp` at each call --------------------
  // Its caller's `$fp`, `$ra`, its locals where MemAllocCodeGen put them,
  // and the registers it saves. A long run of words folds into one.
  const calls: StackFrame['calls'] = new Map()
  for (let k = 0; k < n; k++) {
    if (at(k).tag?.role !== 'call' && code(k).op !== 'jal') continue
    const target = at(k).tag?.call ?? code(k).a[0]
    const callee = layout.functions.find((f) => f.name === target)
    if (!callee) continue
    const fp = poses[k].sp + FP
    const ws: (Word & { addr: number })[] = [
      { addr: fp, label: "caller's $fp", kind: 'link' },
      { addr: fp - 4, label: '$ra', kind: 'link' },
    ]
    for (const l of callee.locals) {
      const o = place(l, fp + (l.off ?? 0), layout, false)
      for (let w = o.hi - 4; w >= o.lo; w -= 4)
        ws.push({ addr: w, kind: 'local', label: nameOfWord(o, w) })
    }
    const theirs = trace.backend?.functions.findIndex(
      (f) => f.name === callee.name,
    )
    let low = Math.min(...ws.map((w) => w.addr))
    for (const r of theirs === undefined || theirs < 0
      ? []
      : savedBy(trace, theirs))
      ws.push({ addr: (low -= 4), label: `saved ${r}`, kind: 'saved' })
    const shown =
      ws.length > 8
        ? [
            ...ws.slice(0, 4),
            { addr: ws[4].addr, label: '…', kind: 'spare' as const },
            ...ws.slice(-2),
          ]
        : ws
    calls.set(first + k, {
      callee: callee.name,
      words: shown.map((w) => ({ ...w, label: `${callee.name}: ${w.label}` })),
    })
  }

  // ---- words released but still read ----------------------------------
  // The epilogue's restores, and a struct a call returned, copied out
  // after the call's words come off the stack. They stay, through the line
  // that reads them, still named for whoever held them.
  const kept: Set<number>[] = Array.from({ length: n + 1 }, () => new Set())
  for (const t of touches) {
    if (t.kind !== 'read') continue
    for (
      let k = (t.until ?? t.at) - first + 1;
      k >= 0 && poses[k].sp > t.addr;
      k--
    )
      kept[k].add(t.addr)
  }
  for (const o of owners)
    while (o.to < last && kept[o.to - first + 2]?.has(o.addr)) o.to++

  // ---- rows, top down ------------------------------------------------------
  let top = 0
  let lowest = 0
  for (const w of words.keys()) if (w > DATA / 2) top = Math.max(top, w)
  for (const p of poses) lowest = Math.min(lowest, p.sp)
  for (const t of touches)
    if (t.addr > DATA / 2) lowest = Math.min(lowest, t.addr)
  // Arrays longer than six words show their first two, their last, and
  // any word a line touches at a known place; the rest fold into a row.
  const plain = new Set<number>()
  for (const t of touches) if (!t.wide) plain.add(t.addr)
  for (const p of pointers) plain.add(p.addr)
  const rows: StackRow[] = []
  const rowOf = new Map<number, number>()
  const addRange = (hi: number, lo: number, data: boolean) => {
    for (let w = hi; w >= lo; ) {
      const o = objectAt(w)
      const big =
        o && o.hi - o.lo > 24 && /\[\d+\]/.test(words.get(w)?.label ?? '')
      if (big && o) {
        const keep = (x: number) =>
          x < o.lo + 8 || x >= o.hi - 4 || plain.has(x)
        let x = w
        while (x >= o.lo) {
          if (keep(x)) {
            rowOf.set(x, rows.length)
            rows.push({ addr: x, lo: x, data })
            x -= 4
            continue
          }
          let y = x
          while (y - 4 >= o.lo && !keep(y - 4)) y -= 4
          const label = (z: number) => words.get(z)?.label ?? ''
          if (y === x) {
            rowOf.set(x, rows.length)
            rows.push({ addr: x, lo: x, data })
          } else {
            const from = /\[(\d+)/.exec(label(y))?.[1]
            const to = /(\d+)\]$/.exec(label(x))?.[1]
            for (let z = x; z >= y; z -= 4) rowOf.set(z, rows.length)
            rows.push({
              addr: x,
              lo: y,
              fold: `${o.name}[${from}…${to}]`,
              data,
            })
          }
          x = y - 4
        }
        w = o.lo - 4
        continue
      }
      rowOf.set(w, rows.length)
      rows.push({ addr: w, lo: w, data })
      w -= 4
    }
  }
  addRange(top, lowest, false)
  // Globals this function uses, under the stack.
  const globals = objects.filter(
    (o) =>
      o.lo < DATA / 2 &&
      (touches.some((t) => t.addr >= o.lo && t.addr < o.hi) ||
        pointers.some((p) => p.addr >= o.lo && p.addr < o.hi)),
  )
  for (const o of globals.reverse()) addRange(o.hi - 4, o.lo, true)

  return {
    fn,
    name,
    first,
    last,
    poses,
    rows,
    rowOf,
    words,
    owners,
    touches,
    pointers,
    kept,
    top,
    saved,
    calls,
  }
}

/** A word's name and kind on a line: whoever holds it then. */
export function wordAt(
  frame: StackFrame,
  addr: number,
  line: number,
): Word | undefined {
  const held = frame.owners.find(
    (o) => o.addr === addr && o.from <= line && line <= o.to,
  )
  return held ?? frame.words.get(addr)
}
