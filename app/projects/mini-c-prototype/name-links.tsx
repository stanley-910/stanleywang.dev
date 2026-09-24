import { motion } from 'motion/react'

import type { Route } from './link-route'
import type { Frame } from './trace'

// Mounted anew for each step, outside the tree's AnimatePresence. A quick
// back/forward never picks up an exiting path's finished draw state.
export function NameLinks({
  links,
  routes,
  frame,
  hover,
  reduced,
  duration,
  missing,
}: {
  links: [number, number][]
  routes: Map<string, Route>
  frame: Frame
  hover: number | null
  reduced: boolean
  duration: number
  missing?: number
}) {
  const all = frame.why.kind === 'check.namesDone'
  const ease = [0.22, 1, 0.36, 1] as [number, number, number, number]
  const hold = duration * (1 + Math.max(0, links.length - 1) * 0.25) + 3
  return (
    <motion.g
      className="ac-name-links"
      initial={{ opacity: 1 }}
      animate={{ opacity: all && !reduced ? 0 : 1 }}
      transition={{
        delay: all && !reduced ? hold : 0,
        duration: reduced ? 0 : 0.25,
      }}
    >
      {links.map(([use, decl], i) => {
        const r = routes.get(`${use}-${decl}`)
        const active =
          frame.why.kind === 'check.resolve' && frame.why.use === use
        if (!r || !(all || active || hover === use || hover === decl))
          return null
        const delay = all ? i * duration * 0.25 : 0
        const drawn = { duration, delay, ease }
        return (
          <g key={`${use}-${decl}`} data-clean={r.clean}>
            {/* Geometry is a plain prop: resizing never tweens the route. */}
            <motion.path
              className="ac-link-halo"
              d={r.d}
              fill="none"
              initial={{ pathLength: reduced ? 1 : 0 }}
              animate={{ pathLength: 1 }}
              transition={drawn}
            />
            <motion.path
              className={`ac-link ${all || active ? 'ok' : ''}`}
              d={r.d}
              fill="none"
              strokeWidth={1}
              initial={{ pathLength: reduced ? 1 : 0 }}
              animate={{ pathLength: 1 }}
              transition={drawn}
            />
            <motion.circle
              className={`ac-link-end ${all || active ? 'ok' : ''}`}
              cx={r.end.x}
              cy={r.end.y}
              r={2}
              initial={{ opacity: reduced ? 1 : 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: duration * 0.25,
                delay: delay + duration,
              }}
            />
          </g>
        )
      })}
      {missing !== undefined &&
        (() => {
          const r = routes.get(`miss-${missing}`)
          if (!r) return null
          return (
            <g key={`miss-${missing}`} data-clean={r.clean}>
              {['ac-link-halo', 'ac-link'].map((className) => (
                <motion.path
                  key={className}
                  className={className}
                  d={r.d}
                  fill="none"
                  strokeWidth={className === 'ac-link' ? 1 : undefined}
                  initial={{ pathLength: reduced ? 1 : 0 }}
                  animate={{ pathLength: reduced ? 1 : [0, 1, 1, 0] }}
                  transition={{
                    duration: duration * 3,
                    times: [0, 0.45, 0.6, 1],
                    ease,
                  }}
                />
              ))}
            </g>
          )
        })()}
    </motion.g>
  )
}
