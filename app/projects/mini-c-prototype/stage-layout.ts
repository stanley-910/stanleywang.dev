import type { Token } from './trace'

// Tray centres in the stage's 680 × 480 coordinates. Text keeps its pixel
// size, so a narrow stage wraps earlier.
export function packTray(tokens: Token[], width: number) {
  const unit = 680 / width
  const at: Record<number, { x: number; y: number }> = {}
  let x = 20,
    y = 30
  for (const token of tokens) {
    const size = Math.min(560, (token.text.length * 7.2 + 18) * unit)
    if (x + size > 660) {
      x = 20
      y += 34
    }
    at[token.id] = { x: x + size / 2, y }
    x += size + 6 * unit
  }
  return at
}

// Reserve the full visible tray even as tokens leave it. Parse and check
// share this band; a tall tree squeezes below it rather than lifting into it.
export function treeRows(
  tray: ReturnType<typeof packTray>,
  height: number,
  tree: { depth: number; levels: number },
  half: number,
  narrow: boolean,
) {
  const last = Math.max(
    // (no tray at all: the tree starts at the top)
    Object.keys(tray).length ? 30 : 0,
    ...Object.values(tray)
      .filter((p) => p.y <= 150)
      .map((p) => p.y),
  )
  const top = (last * height) / 480 + (narrow ? 10 : 11) + 16 + half
  // A phone's short stage keeps 30px a level while there's room, rather
  // than squeezing the rows onto one another.
  const band = Math.min(
    Math.max(
      (Math.min((tree.depth / Math.max(1, tree.levels)) * 235, 295) * height) /
        480,
      narrow ? tree.depth * 30 : 0,
    ),
    Math.max(0, height - top - half - 16),
  )
  return { top, band }
}
