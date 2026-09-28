import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'

import { wordAt } from './stack-view'

import type { StackFrame, StackRow } from './stack-view'
import type { DragControls } from 'motion/react'
import type { CSSProperties, PointerEvent, RefObject } from 'react'

// The stack column beside the emit phase's assembly (stack-view.ts works
// out the frame). High addresses at the top, growing down, as in the
// lecture slides; `$fp` points in from the left, `$sp` from the right. The
// current block's instructions play in order: a pointer slides as its
// instruction's row appears, a word is outlined when it is read and
// tinted when it is written. A register that holds a word's address points
// at it from the right while it is live, and on the line that stores into
// a word, it shows the register stored. It shows how the frame is built,
// not what the words hold (Stanley, 2026-09-25).
//
// It docks in the note card, under the step's sentence. Dragged a few
// pixels, it pops out and floats where it's dropped, anywhere on the
// simulation (beside the assembly, say); dropped back on the note card, it
// docks again.
export function StackColumn({
  frame,
  count,
  from,
  row,
  stagger,
  duration,
  still,
  step,
  at,
  bounds,
  dock,
  controls,
  pickup,
  onUndock,
  onMove,
  onDock,
}: {
  frame: StackFrame | undefined
  /** Instructions shown so far. */
  count: number
  /** First instruction of the current block, or null off a block. */
  from: number | null
  row: number
  /** Seconds between one row of the block and the next. */
  stagger: number
  duration: number
  still: boolean
  step: number
  /** Floating: its top left in the page's simulation; docked: undefined. */
  at?: { x: number; y: number }
  /** The simulation, where it may float. */
  bounds: RefObject<HTMLElement | null>
  /** The note card it docks in. */
  dock: RefObject<HTMLElement | null>
  controls: DragControls
  /** The pointer that popped it out, to carry on dragging. */
  pickup: RefObject<PointerEvent | null>
  onUndock: (at: { x: number; y: number }, event: PointerEvent) => void
  onMove: (at: { x: number; y: number }) => void
  onDock: () => void
}) {
  const self = useRef<HTMLDivElement>(null)
  const press = useRef<{ x: number; y: number } | null>(null)
  // Just popped out: the drag that did it carries on here.
  useEffect(() => {
    if (!at || !pickup.current) return
    controls.start(pickup.current)
    pickup.current = null
  }, [at, controls, pickup])
  if (!frame) return null
  const done = Math.min(frame.last + 1, count) - frame.first
  const pose = frame.poses[Math.max(0, done)]
  // Block-relative: which of this block's instructions touch what.
  const start = from === null ? done : Math.max(0, from - frame.first)
  // An instruction's delay within the block, from its index.
  const delayOf = (at: number) =>
    still ? 0 : (at - frame.first - start) * stagger
  // Shown so far, and the line the step is on.
  const shownTo = frame.first + done
  const line = shownTo - 1
  // On a call, the callee's frame shows under `$sp`, as it will sit.
  const call = frame.calls.get(line)
  const extra = call?.words.length ?? 0
  // Rows top down; globals sit under the stack, one row's gap below it.
  const firstData = frame.rows.findIndex((r) => r.data)
  const stackRows = firstData >= 0 ? firstData : frame.rows.length
  const rowY = (i: number) =>
    (i + (firstData >= 0 && i >= firstData ? 1 + extra : 0)) * row
  const y = (addr: number) => {
    const i = frame.rowOf.get(addr)
    if (i !== undefined) return rowY(i)
    return addr > frame.top
      ? ((frame.top - addr) / 4) * row
      : rowY(frame.rows.length)
  }
  // A word is in use while it is at or above `$sp`, and after that while a
  // later line still reads it (the epilogue's restores).
  const live = (k: number, r: StackRow) =>
    !!r.data || r.lo >= frame.poses[k].sp || frame.kept[k].has(r.addr)
  // The instruction (block-relative) after which a row comes into use,
  // or goes out of it.
  const change = (r: StackRow, into: boolean, after = start) => {
    for (let k = after; k < done; k++)
      if (live(k + 1, r) === into && live(k, r) !== into) return k
    return null
  }
  const fade = duration * 0.6
  const touched = frame.touches.filter(
    (t) => t.at >= frame.first + start && t.at < frame.first + done,
  )
  // Each pointer's path through the block, for keyframes.
  const path = (key: 'sp' | 'fp') =>
    frame.poses.slice(start, done + 1).map((p) => p[key])
  const pointer = (key: 'sp' | 'fp', label: string) => {
    const at = path(key)
    const shown = at.map((v) => (v === null ? null : y(v)))
    const last = shown[shown.length - 1]
    // Gone (the caller's `$fp` is back): it rises off the top.
    const ys = shown.map((v) => v ?? -row)
    const animate =
      still || ys.length < 2
        ? { y: ys[ys.length - 1], opacity: last === null ? 0 : 1 }
        : {
            y: ys,
            opacity: shown.map((v) => (v === null ? 0 : 1)),
          }
    const total = duration + (ys.length - 2) * stagger
    const times = ys.map((_, k) =>
      k === 0 ? 0 : Math.min(1, (duration * 0.5 + (k - 1) * stagger) / total),
    )
    return (
      <motion.span
        key={`${label}-${step}`}
        className={`ac-stack-ptr ${key}`}
        initial={{ y: ys[0], opacity: shown[0] === null ? 0 : 1 }}
        animate={animate}
        transition={
          still || ys.length < 2
            ? { duration: still ? 0 : duration, ease: 'easeOut' }
            : { duration: total, times, ease: 'easeInOut' }
        }
      >
        {label}
      </motion.span>
    )
  }
  // The register a line stores into a word, on that line.
  const storedAt = (addr: number) => {
    const store = frame.touches.find(
      (t) => t.at === line && t.addr === addr && t.kind === 'write' && t.reg,
    )
    return store?.reg && /^v\d+$/.test(store.reg) ? store.reg : undefined
  }
  // Address registers live on this line, by the row they point at.
  const pointing = new Map<number, string[]>()
  for (const p of frame.pointers) {
    const r = frame.rowOf.get(p.addr)
    if (r !== undefined && p.def <= line && line <= p.last)
      pointing.set(r, [...(pointing.get(r) ?? []), p.vr])
  }
  // Room on the right for the most registers that ever point at one word
  // together (and `$sp`), so none is cut off at the card's edge.
  const room = Math.max(
    3,
    ...frame.pointers.map(
      (p) =>
        frame.pointers
          .filter((q) => q.addr === p.addr && q.def <= p.def && p.def <= q.last)
          .map((q) => q.vr)
          .join(' ').length,
    ),
  )
  // Where it is now, in the simulation's coordinates.
  const place = () => {
    const box = self.current?.getBoundingClientRect()
    const root = bounds.current?.getBoundingClientRect()
    return box && root
      ? { x: box.left - root.left, y: box.top - root.top }
      : undefined
  }
  const onCard = () => {
    const box = self.current?.getBoundingClientRect()
    const card = dock.current?.getBoundingClientRect()
    if (!box || !card) return false
    const x = box.left + box.width / 2,
      y = box.top + box.height / 2
    return x > card.left && x < card.right && y > card.top && y < card.bottom
  }
  return (
    <motion.div
      ref={self}
      className={`ac-stack ${at ? 'floating' : 'docked'}`}
      aria-label="Stack frame"
      style={
        {
          ...(at && { left: at.x, top: at.y }),
          '--room': room + 2,
        } as CSSProperties
      }
      drag={!!at}
      dragControls={controls}
      dragConstraints={bounds}
      dragMomentum={false}
      dragElastic={0}
      onDragEnd={() => {
        if (onCard()) return onDock()
        const now = place()
        if (now) onMove(now)
      }}
      onPointerDown={(e) => {
        // (no text selection starting under a drag of the stack)
        if (e.pointerType === 'mouse') e.preventDefault()
        if (!at) press.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerMove={(e) => {
        const from = press.current
        if (at || !from) return
        if (Math.hypot(e.clientX - from.x, e.clientY - from.y) < 5) return
        press.current = null
        const now = place()
        if (now) onUndock(now, e)
      }}
      onPointerUp={() => {
        press.current = null
      }}
    >
      {/* Docked, the panel's "stack frame" title says what it is; afloat
          on the stage, it says it itself. */}
      {at && (
        <div className="ac-label">
          <span>stack</span>
          <small>$fp offset</small>
        </div>
      )}
      <div
        className="ac-stack-body"
        style={{
          height: rowY(frame.rows.length) + (firstData < 0 ? extra * row : 0),
        }}
      >
        {call?.words.map((w, j) => (
          <motion.div
            key={`call-${line}-${j}`}
            className={`ac-stack-cell ghost ${w.kind}`}
            style={{ top: (stackRows + j) * row, height: row + 1 }}
            initial={still ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: still ? 0 : fade,
              delay: still ? 0 : delayOf(line),
            }}
          >
            <span title={w.label}>
              <i>{call.callee} </i>
              {w.label.slice(call.callee.length + 2) === 'return'
                ? 'return value'
                : w.label.slice(call.callee.length + 2)}
            </span>
          </motion.div>
        ))}
        {firstData >= 0 && (
          <span className="ac-stack-gap" style={{ top: rowY(firstData) - row }}>
            .data
          </span>
        )}
        {frame.rows.map((r, i) => {
          const alive = live(Math.max(0, done), r)
          const appears = live(start, r) ? null : change(r, true)
          const gone = alive ? null : change(r, false, appears ?? start)
          if (!alive && (still || gone === null)) return null
          const word = r.fold ? undefined : wordAt(frame, r.addr, line)
          const kind = word?.kind ?? 'local'
          const label = r.fold ?? word?.label ?? ''
          // `twice: n`: the callee's name in grey.
          const [whose, what] =
            /^(\w+): (.*)$/.test(label) && (kind === 'arg' || kind === 'result')
              ? label.split(/: (.*)/)
              : [undefined, label]
          const touch = touched
            .filter((t) => frame.rowOf.get(t.addr) === i)
            .pop()
          const released = !r.data && r.lo < pose.sp
          // Signed, since they count from `$fp`: +8, 0, −4.
          const offset =
            pose.fp === null || r.fold || r.data
              ? ''
              : r.addr - pose.fp > 0
                ? `+${r.addr - pose.fp}`
                : String(r.addr - pose.fp).replace('-', '−')
          const value =
            r.fold || kind === 'link' || kind === 'saved' || kind === 'spare'
              ? undefined
              : storedAt(r.addr)
          // Keyframes: in when its instruction's row arrives, out when the
          // one that frees it does.
          const inAt = appears === null ? 0 : delayOf(frame.first + appears)
          const outAt = gone === null ? 0 : delayOf(frame.first + gone)
          const total = (gone === null ? inAt : outAt) + fade
          const opacity =
            appears !== null && gone !== null
              ? [0, 0, 1, 1, 0]
              : gone !== null
                ? [1, 1, 0]
                : [0, 0, 1]
          const at =
            appears !== null && gone !== null
              ? [0, inAt, inAt + fade, outAt, total]
              : gone !== null
                ? [0, outAt, total]
                : [0, inAt, total]
          const moving = !still && (appears !== null || gone !== null)
          return (
            <motion.div
              key={moving ? `${r.addr}-${step}` : r.addr}
              className={`ac-stack-cell ${kind} ${r.addr >= 0 && !r.data ? 'caller' : ''} ${r.addr === -4 ? 'edge' : ''} ${r.fold ? 'fold' : ''} ${released ? 'released' : ''} ${touch ? touch.kind : ''}`}
              style={
                {
                  top: rowY(i),
                  // Neighbours share a border.
                  height: row + 1,
                  '--delay': `${touch ? delayOf(touch.at) : 0}s`,
                } as CSSProperties
              }
              initial={moving ? { opacity: opacity[0] } : false}
              animate={moving ? { opacity } : { opacity: 1 }}
              transition={
                moving
                  ? {
                      duration: total,
                      times: at.map((t) => t / total),
                      ease: 'linear',
                    }
                  : { duration: 0 }
              }
            >
              <span title={label || undefined}>
                {whose && <i>{whose} </i>}
                {/* The value handed back, not the address to return to
                    ($ra, saved below $fp). */}
                {what === 'return' ? 'return value' : what}
              </span>
              {value !== undefined && (
                <motion.b
                  key={value}
                  className="ac-stack-value"
                  initial={still ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    duration: still ? 0 : fade,
                    delay: still ? 0 : delayOf(line),
                  }}
                >
                  ← {value}
                </motion.b>
              )}
              <small>{offset}</small>
            </motion.div>
          )
        })}
        {[...pointing].map(([i, regs]) => (
          <motion.span
            key={`reg-${i}`}
            className="ac-stack-ptr reg"
            style={{ top: rowY(i) }}
            initial={still ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: still ? 0 : fade }}
          >
            {regs.join(' ')}
          </motion.span>
        ))}
        {pointer('fp', '$fp')}
        {pointer('sp', '$sp')}
      </div>
    </motion.div>
  )
}
