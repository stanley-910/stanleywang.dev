import type { Box } from './link-route'

// Choose from the completed tree, not the current scope's contents. At a
// fixed layout, seeking and playing therefore choose the same corner.
export function scopePanelBox(
  boxes: Box[],
  width: number,
  height: number,
  rows = 10,
): Box {
  const gap = 10
  const maxW = Math.min(210, width - gap * 2)
  // Padding and the header, then a row per line.
  const maxH = Math.min(42 + rows * 20, 246, height * 0.44)
  const minW = Math.min(maxW, 120)
  const minH = Math.min(maxH, 60)
  const padded = boxes.map((b) => ({
    x: b.x - 8,
    y: b.y - 8,
    w: b.w + 16,
    h: b.h + 16,
  }))
  let best: { box: Box; score: number } | undefined
  // Bottom corners first when two fits are equally good.
  for (const [right, bottom] of [
    [false, true],
    [true, true],
    [false, false],
    [true, false],
  ]) {
    const widths = [
      maxW,
      minW,
      ...padded.map((b) => (right ? width - gap - b.x - b.w : b.x - gap)),
    ]
    const heights = [
      maxH,
      minH,
      ...padded.map((b) => (bottom ? height - gap - b.y - b.h : b.y - gap)),
    ]
    for (const w of new Set(widths.filter((w) => w >= minW && w <= maxW)))
      for (const h of new Set(heights.filter((h) => h >= minH && h <= maxH))) {
        const box = {
          x: right ? width - gap - w : gap,
          y: bottom ? height - gap - h : gap,
          w,
          h,
        }
        const overlap = padded.reduce(
          (sum, b) =>
            sum +
            Math.max(0, Math.min(box.x + w, b.x + b.w) - Math.max(box.x, b.x)) *
              Math.max(
                0,
                Math.min(box.y + h, b.y + b.h) - Math.max(box.y, b.y),
              ),
          0,
        )
        // Any clear fit wins over a larger one that covers a label.
        const score = overlap ? -overlap : w * h
        if (!best || score > best.score) best = { box, score }
      }
  }
  return best?.box ?? { x: gap, y: gap, w: maxW, h: maxH }
}
