import { motion } from 'motion/react'
import { useLayoutEffect, useRef, useState } from 'react'

import type { Lane } from './lanes'
import type { CSSProperties } from 'react'

const LANE_GAP = 8
const LANE_LEFT = 6
const TAG_W = 26

// The room the lanes and their tags take right of the assembly.
export function lanesWidth(columns: number) {
  return columns === 0 ? 0 : LANE_LEFT + columns * LANE_GAP + TAG_W
}

// Live ranges beside emit's assembly: each virtual register's lane runs
// from the line that writes it (a dot, with its name on that line) to the
// last line that reads it (a tick on each read). A lane is dashed while a
// read is still to come. The current block's registers, and those of the
// line under the pointer, are drawn in ink. Lanes grow with the block's
// rows as they arrive.
export function EmitLanes({
  left,
  lanes,
  columns,
  count,
  range,
  focus,
  focused,
  onFocus,
  onBlur,
  stagger,
  duration,
  still,
  tint,
  layout,
}: {
  /** Where the lanes start, px from the assembly's left. */
  left: number
  lanes: Lane[]
  columns: number
  /** Instructions shown so far. */
  count: number
  /** The current block, or null off a block. */
  range: [number, number] | null
  /** `fn:vr` of the registers on the line under the pointer. */
  focus: Set<string>
  /** `fn:vr` of the register under focus, which puts the rest aside. */
  focused?: string
  onFocus: (key: string, pin: boolean) => void
  onBlur: () => void
  /** Seconds between one row of the block and the next. */
  stagger: number
  duration: number
  still: boolean
  /** Registers: a lane's physical register's colour, once it has one. */
  tint?: (key: string) => string | undefined
  /** Changes when rows move without new ones (the allocator's added lines). */
  layout?: number
}) {
  const ref = useRef<SVGSVGElement>(null)
  // Row centres, measured: labels and comments sit between the rows.
  const [centres, setCentres] = useState<number[]>([])
  const [half, setHalf] = useState(9.5)
  const previous = useRef(count)
  const shrinking = count < previous.current
  useLayoutEffect(() => {
    previous.current = count
  }, [count])
  useLayoutEffect(() => {
    const pane = ref.current?.parentElement
    if (!pane) return
    const rows = pane.querySelectorAll<HTMLElement>('[data-row]')
    const out: number[] = []
    rows.forEach((el) => {
      out[Number(el.dataset.row)] = el.offsetTop + el.offsetHeight / 2
    })
    setCentres(out)
    if (rows[0]) setHalf(rows[0].offsetHeight / 2)
  }, [count, lanes, layout])

  if (columns === 0) return null
  // New rows are measured just after they render (before paint); until
  // then lanes keep to the rows already known, so none remount.
  const known = Math.min(count, centres.length)
  const from = range?.[0] ?? count
  const inBlock = (i: number) =>
    range !== null && i >= range[0] && i <= range[1]
  // When a row of the current block arrives.
  const at = (i: number) =>
    still || shrinking ? 0 : Math.max(0, i - from) * stagger
  const fade = (i: number) => ({
    duration: still ? 0 : duration * 0.5,
    delay: at(i),
  })
  const tagX = LANE_LEFT + columns * LANE_GAP
  const bottom = known > 0 ? centres[known - 1] + half : 0

  return (
    <svg
      ref={ref}
      className="ac-lanes"
      // Past the longest line, or as far right as a narrow pane allows.
      style={{ left: `min(${left}px, 100% - ${lanesWidth(columns)}px)` }}
      width={lanesWidth(columns)}
      height={bottom + 12}
      aria-hidden
    >
      {lanes
        .filter((l) => l.def < known)
        .map((l) => {
          const key = `${l.fn}:${l.vr}`
          const x = LANE_LEFT + l.column * LANE_GAP + 0.5
          const open = l.last >= known
          const end = open ? known - 1 : l.last
          const y1 = centres[l.def]
          const y2 = open ? bottom : centres[end]
          const lit =
            focus.has(key) || inBlock(l.def) || l.reads.some((r) => inBlock(r))
          // It grows from its dot, or from where the last block left it,
          // row by row as the block's rows arrive.
          const grow = {
            duration: still
              ? 0
              : shrinking
                ? duration * 0.5
                : Math.max(
                    duration * 0.3,
                    (end - Math.max(from, l.def)) * stagger,
                  ),
            delay: at(l.def),
            ease: 'linear' as const,
          }
          return (
            <g
              key={key}
              className={`ac-lane ${lit ? 'lit' : ''} ${focused ? (focused === key ? 'focus' : 'off') : ''} ${tint?.(key) ? 'tinted' : ''}`}
              style={
                tint?.(key)
                  ? ({ '--c': tint(key) } as CSSProperties)
                  : undefined
              }
            >
              <motion.line
                className={open ? 'open' : ''}
                x1={x}
                x2={x}
                initial={{ y1, y2: y1 }}
                animate={{ y1, y2 }}
                transition={grow}
              />
              <motion.circle
                cx={x}
                cy={y1}
                r={2.5}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={fade(l.def)}
              />
              {l.reads
                .filter((r) => r < known)
                .map((r) => (
                  <motion.line
                    key={r}
                    className="read"
                    x1={x - 3}
                    x2={x + 3}
                    y1={centres[r]}
                    y2={centres[r]}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={fade(r)}
                  />
                ))}
              <motion.text
                data-vr
                x={tagX}
                y={y1}
                onMouseEnter={() => onFocus(key, false)}
                onMouseLeave={onBlur}
                onClick={() => onFocus(key, true)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={fade(l.def)}
              >
                {l.vr}
              </motion.text>
            </g>
          )
        })}
    </svg>
  )
}
