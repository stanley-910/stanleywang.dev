'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'

import { derive, proofRoots, ProofTree } from './derivation'

import type { Trace } from './trace'

// The type pass's proofs on the stage, under the tree, built as the pass
// walks it (Stanley, 2026-09-28: "generate it under the AST tree as we
// kind of traverse it, so we see that being built simultaneously in
// full"). One proof per statement, drawn in full, each as near under its
// statement's node as the others leave room for. Every proof's place is
// kept for its finished size from the start, so nothing moves as they
// grow: rows, first come first placed, a proof going into the highest
// row with room for it, as near its place as the proofs already there let
// it.

const GAP_X = 28
const GAP_Y = 16
const EDGE = 8

type Slot = { left: number; top: number; w: number; h: number }

export function ProofStage({
  trace,
  source,
  index,
  anchor,
  top,
  width,
  onExtent,
}: {
  trace: Trace
  source: string
  index: number
  // Where each statement's node is across the canvas, in its px.
  anchor: (id: number) => number
  // Where the proofs start, under the tree.
  top: number
  // How wide the stage is, which rows fill before starting another.
  width: number
  // How far they reach, for the canvas's bounds.
  onExtent: (extent: { right: number; bottom: number }) => void
}) {
  const { first, last } = useMemo(
    () => proofRoots(trace, source),
    [trace, source],
  )
  const roots = [...first.keys()]
  const whole = useMemo(
    () => (last < 0 ? null : derive(trace, source, last)),
    [trace, source, last],
  )
  // Each finished proof's size, measured once per program.
  const [sizes, setSizes] = useState<{
    trace: Trace
    of: Map<number, { w: number; h: number }>
  } | null>(null)
  const measure = useRef<HTMLDivElement>(null)
  const measured = sizes?.trace === trace ? sizes.of : null
  useLayoutEffect(() => {
    if (measured || !measure.current) return
    const of = new Map<number, { w: number; h: number }>()
    measure.current.querySelectorAll<HTMLElement>('[data-root]').forEach((e) =>
      of.set(Number(e.dataset.root), {
        w: e.offsetWidth,
        h: e.offsetHeight,
      }),
    )
    setSizes({ trace, of })
  }, [measured, trace])

  const slots = useMemo(() => {
    const at = new Map<number, Slot>()
    if (!measured) return at
    const rows: { h: number; taken: [number, number][] }[] = []
    const row = new Map<number, number>()
    for (const root of roots) {
      const { w, h } = measured.get(root) ?? { w: 0, h: 0 }
      const ideal = Math.max(EDGE, Math.min(anchor(root) - w / 2, width - w))
      // In a row: where it can go, nearest its place; beside another
      // proof if not at its place, and never past the stage's right edge
      // unless it is wider than the stage.
      const spot = (r: (typeof rows)[number]) => {
        const fits = (l: number) =>
          l >= EDGE &&
          (l + w <= width || l === ideal) &&
          r.taken.every(([a, b]) => l + w + GAP_X <= a || b + GAP_X <= l)
        return [
          ideal,
          ...r.taken.flatMap(([a, b]) => [b + GAP_X, a - GAP_X - w]),
        ]
          .filter(fits)
          .sort((x, y) => Math.abs(x - ideal) - Math.abs(y - ideal))[0]
      }
      let r = rows.findIndex((row) => spot(row) !== undefined)
      if (r < 0) r = rows.push({ h: 0, taken: [] }) - 1
      const left = spot(rows[r]) ?? ideal
      rows[r].taken.push([left, left + w])
      rows[r].h = Math.max(rows[r].h, h)
      row.set(root, r)
      at.set(root, { left, top: 0, w, h })
    }
    const rowTop: number[] = []
    let y = top
    for (const r of rows) {
      rowTop.push(y)
      y += r.h + GAP_Y
    }
    for (const [root, s] of at) s.top = rowTop[row.get(root) ?? 0]
    return at
    // (anchor is a fresh function each render; its answers change with top)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measured, top, width, roots.join(',')])

  const extent = useMemo(() => {
    let right = 0,
      bottom = 0
    for (const s of slots.values()) {
      right = Math.max(right, s.left + s.w + EDGE)
      bottom = Math.max(bottom, s.top + s.h + GAP_Y)
    }
    return { right, bottom }
  }, [slots])
  const reported = useRef({ right: -1, bottom: -1 })
  useLayoutEffect(() => {
    const was = reported.current
    if (was.right === extent.right && was.bottom === extent.bottom) return
    reported.current = extent
    onExtent(extent)
  })

  const d = useMemo(() => derive(trace, source, index), [trace, source, index])
  const current = d.focus === null ? null : d.rootOf(d.focus)

  return (
    <div className="ac-proof-stage" aria-label="Typing derivations">
      {!measured && whole && (
        <div className="ac-proof-measure" ref={measure} aria-hidden="true">
          {roots.map((root) => (
            <div key={root} data-root={root} className="ac-proof-slot">
              <ProofTree d={whole} id={root} />
            </div>
          ))}
        </div>
      )}
      {roots.map((root) => {
        const s = slots.get(root)
        if (!s || (first.get(root) ?? Infinity) > index) return null
        const parts = d.proven(root) ? [root] : d.loose(root)
        return (
          <div
            key={root}
            className={`ac-proof-slot ${root === current ? 'now' : ''}`}
            style={{ left: s.left, top: s.top, width: s.w, minHeight: s.h }}
          >
            <div className="ac-proof-forest">
              {parts.map((id) => (
                <ProofTree key={id} d={d} id={id} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
