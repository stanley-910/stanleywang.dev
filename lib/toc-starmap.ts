export interface StarPoint {
  x: number
  y: number
}

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dist(a: StarPoint, b: StarPoint): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function layoutStars(count: number, seed: string): StarPoint[] {
  const rng = mulberry32(hashStr(seed))
  const pts: StarPoint[] = []
  for (let i = 0; i < count; i++) {
    let p: StarPoint = { x: 0, y: 0 }
    let tries = 0
    do {
      p = { x: 5 + rng() * 90, y: 5 + rng() * 90 }
      tries++
    } while (pts.some((q) => dist(p, q) < 18) && tries < 30)
    pts.push(p)
  }
  return pts
}
