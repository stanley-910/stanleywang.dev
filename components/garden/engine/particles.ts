import { clamp, noise1, TAU } from './math'
import { Kind, type Raster, Shape } from './raster'

import type { Rgb } from './palette'
import type { Wind } from './wind'

export type ParticleType =
  | 'petal'
  | 'sepal'
  | 'pappus'
  | 'seed'
  | 'firefly'
  | 'mote'

export type Particle = {
  type: ParticleType
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  spin: number
  size: number
  color: Rgb
  age: number
  life: number
  /** Where it lands: the ground line at its depth. */
  floor: number
  depth: number
  landed: boolean
  seed: number
}

let nextSeed = 1

export function particle(
  p: Omit<Partial<Particle>, 'type'> & {
    type: ParticleType
    x: number
    y: number
  },
): Particle {
  return {
    vx: 0,
    vy: 0,
    rot: Math.random() * TAU,
    spin: (Math.random() - 0.5) * 6,
    size: 4,
    color: [255, 255, 255],
    age: 0,
    life: 20,
    floor: 1e9,
    depth: 0.5,
    landed: false,
    seed: nextSeed++,
    ...p,
  }
}

const MAX = 700

/**
 * Loose pieces of the garden: petals falling like leaves (tumbling, slowed whenever they turn
 * broadside), dandelion pappus floating far on the breeze, poppy seeds shaken from the capsule,
 * and fireflies after dark.
 */
export class Particles {
  list: Particle[] = []
  onLand: ((p: Particle) => void) | null = null

  add(p: Particle) {
    if (this.list.length >= MAX) this.list.shift()
    this.list.push(p)
  }

  step(dt: number, wind: Wind, width: number, height: number) {
    const out: Particle[] = []
    for (const p of this.list) {
      p.age += dt
      if (p.landed) {
        if (p.age < p.life) out.push(p)
        continue
      }
      const w = wind.at(p.x, p.y, p.depth)
      const push = wind.push(p.x, p.y)
      switch (p.type) {
        case 'petal':
        case 'sepal': {
          const broad = Math.abs(Math.sin(p.rot))
          const fall =
            (p.type === 'sepal' ? 55 : 26) * (0.35 + 0.9 * (1 - broad))
          p.vx += (w * 55 + push * 160 - p.vx) * dt * 1.6
          p.vy += (fall + Math.cos(p.rot * 2) * 10 - p.vy) * dt * 2.5
          p.rot += p.spin * dt * (1 + Math.abs(w))
          break
        }
        case 'pappus': {
          // Pappus seeds sink at only a few px/s and ride every eddy.
          const lift = noise1(p.age * 0.4 + p.seed, 3) * 18
          p.vx +=
            (w * 85 + push * 220 + noise1(p.age * 0.7, p.seed) * 14 - p.vx) *
            dt *
            1.2
          p.vy += (9 - lift - p.vy) * dt * 0.9
          p.rot += dt * 0.5
          break
        }
        case 'seed':
          p.vx += (w * 18 - p.vx) * dt * 2
          p.vy += 260 * dt
          break
        case 'firefly': {
          const t = p.age * 0.35
          p.vx += (noise1(t, p.seed) * 40 + w * 8 - p.vx) * dt * 1.5
          p.vy += (noise1(t, p.seed + 9) * 26 - p.vy) * dt * 1.5
          break
        }
        case 'mote':
          p.vx += (w * 22 + noise1(p.age * 0.3, p.seed) * 8 - p.vx) * dt
          p.vy += (noise1(p.age * 0.25, p.seed + 4) * 6 - p.vy) * dt
          break
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (
        p.x < -60 ||
        p.x > width + 60 ||
        p.y < -80 ||
        p.y > height + 40 ||
        p.age > p.life
      )
        continue
      if (p.type !== 'firefly' && p.type !== 'mote' && p.y >= p.floor) {
        p.y = p.floor
        p.landed = true
        // Fallen petals linger a while on the ground, then fade.
        p.life = p.age + (p.type === 'petal' ? 9 : 2)
        this.onLand?.(p)
        if (p.type === 'seed' || p.type === 'pappus') continue
      }
      out.push(p)
    }
    this.list = out
  }

  draw(r: Raster, night: number) {
    for (const p of this.list) {
      const fade = clamp((p.life - p.age) / 3, 0, 1) * clamp(p.age * 4, 0, 1)
      if (fade <= 0) continue
      switch (p.type) {
        case 'petal':
        case 'sepal': {
          const path = new Shape()
          const flat = p.landed ? 0.35 : Math.abs(Math.cos(p.rot))
          // A loose petal is a little smaller than the one it fell from.
          const s = p.type === 'petal' ? p.size * 0.7 : p.size
          path.ellipse(
            p.x,
            p.y,
            s * (0.25 + 0.75 * flat),
            s * 0.6,
            p.rot * 0.5,
            0,
            TAU,
          )
          if (p.type === 'petal') {
            // Its outline only, in light glyphs of its own colour. Filled, it printed as a solid
            // blob of '#' (or, as petal material, a flat tile) that blotted out flowers it crossed.
            r.stroke(path, p.color, Kind.Fluff, 2.6, fade)
          } else r.fill(path, p.color, Kind.Foliage, fade)
          break
        }
        case 'pappus': {
          // The parachute: a tuft of bristles above a hanging seed.
          const path = new Shape()
          const s = p.size
          path.moveTo(p.x, p.y + s * 1.4)
          path.lineTo(p.x, p.y)
          for (let i = -2; i <= 2; i++) {
            path.moveTo(p.x, p.y)
            path.lineTo(
              p.x + i * s * 0.45,
              p.y - s * (0.9 - Math.abs(i) * 0.12),
            )
          }
          r.stroke(path, p.color, Kind.Fluff, Math.max(0.6, s * 0.18), fade)
          break
        }
        case 'seed':
          r.dot(p.x, p.y, p.size, p.color, Kind.Disc, fade)
          break
        case 'firefly': {
          const pulse = Math.max(0, Math.sin(p.age * 2.2 + p.seed)) ** 3
          const a = fade * night * (0.15 + 0.85 * pulse)
          if (a < 0.03) break
          r.dot(p.x, p.y, p.size * 2.6, p.color, Kind.Fluff, a * 0.35)
          r.dot(p.x, p.y, p.size, p.color, Kind.Fluff, a)
          break
        }
        case 'mote':
          r.dot(p.x, p.y, p.size, p.color, Kind.Fluff, fade * 0.6 * (1 - night))
          break
      }
    }
  }
}
