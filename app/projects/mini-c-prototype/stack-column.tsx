import { motion } from 'motion/react'

import type { StackFrame } from './stack-view'
import type { CSSProperties } from 'react'

// The stack column beside the emit phase's assembly (stack-view.ts works
// out the frame). High addresses at the top, growing down, as in the
// lecture slides; `$fp` points in from the left, `$sp` from the right. The
// current block's instructions play in order: a pointer slides as its
// instruction's row appears, a word is outlined when it is read and
// tinted when it is written.
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
  /** Top left in the scene, when it sits in the tree's half. */
  at?: { x: number; y: number }
}) {
  if (!frame) return null
  const done = Math.min(frame.last + 1, count) - frame.first
  const pose = frame.poses[Math.max(0, done)]
  // Block-relative: which of this block's instructions touch what.
  const start = from === null ? done : Math.max(0, from - frame.first)
  // An instruction's delay within the block, from its index.
  const delayOf = (at: number) =>
    still ? 0 : (at - frame.first - start) * stagger
  const lowest = Math.min(...frame.poses.map((p) => p.sp))
  // Words in use are those at or above `$sp`. The block may push words and
  // pop them again (a call's argument), so it shows down to its lowest.
  const block = frame.poses.slice(start, done + 1)
  const blockLow = Math.min(...block.map((p) => p.sp))
  const words: number[] = []
  for (let a = frame.top; a >= blockLow; a -= 4) words.push(a)
  const y = (addr: number) => ((frame.top - addr) / 4) * row
  const since = frame.poses[start]
  // The instruction (block-relative) after which a word comes into use,
  // or goes out of it.
  const change = (addr: number, into: boolean, after = start) => {
    for (let k = after; k < done; k++)
      if (
        addr >= frame.poses[k + 1].sp === into &&
        addr >= frame.poses[k].sp !== into
      )
        return k
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
  return (
    <div
      className="ac-stack"
      aria-label="Stack frame"
      style={at && { left: at.x, top: at.y, right: 'auto' }}
    >
      <div className="ac-label">; stack</div>
      <div className="ac-stack-body" style={{ height: y(lowest) + row }}>
        {words.map((addr) => {
          const alive = addr >= pose.sp
          const appears = addr >= since.sp ? null : change(addr, true)
          const gone = alive ? null : change(addr, false, appears ?? start)
          if (!alive && (still || gone === null)) return null
          const label = frame.labels.get(addr)
          const saved = alive
            ? addr === pose.saved
            : block.some((p) => p.saved === addr)
          const touch = touched.filter((t) => t.addr === addr).pop()
          // Signed, since they count from `$fp`: +8, 0, −4.
          const offset =
            pose.fp === null
              ? ''
              : addr - pose.fp > 0
                ? `+${addr - pose.fp}`
                : String(addr - pose.fp).replace('-', '−')
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
              key={moving ? `${addr}-${step}` : addr}
              className={`ac-stack-cell ${addr >= 0 ? 'caller' : ''} ${addr === -4 ? 'edge' : ''} ${saved ? 'saved' : ''} ${touch ? touch.kind : ''}`}
              style={
                {
                  top: y(addr),
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
              <span>{saved ? 'saved' : (label ?? '')}</span>
              <small>{saved ? '' : offset}</small>
            </motion.div>
          )
        })}
        {pointer('fp', '$fp')}
        {pointer('sp', '$sp')}
      </div>
    </div>
  )
}
