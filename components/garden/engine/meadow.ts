import { clamp, easeOut, lerp, mulberry32, smoothstep } from './math'
import { mix, type Palette, type Rgb } from './palette'
import { Kind, type Raster, Shape } from './raster'

import type { Rect } from './ascii'
import type { Wind } from './wind'

/** The scene is laid out in strips this wide from the left edge, each from its own seed. */
export const STRIP = 240

/**
 * Grass in tufts: a few blades fanned from one root, arching and drooping at the tip, with bare
 * ground between tufts so the field reads as clumps rather than a scatter of strokes. Each blade
 * bends toward the wind with its own stiffness; a bent blade turns its paler underside up, so
 * gusts show as bright bands rolling across. A few carry drooping seed heads.
 */
export class Meadow {
  count = 0
  id = new Int32Array(0)
  x = new Float32Array(0)
  z = new Float32Array(0)
  y = new Float32Array(0)
  h = new Float32Array(0)
  lean = new Float32Array(0)
  /** Resting arch: how far the blade curls over toward its tip, signed by side. */
  curl = new Float32Array(0)
  stiff = new Float32Array(0)
  bend = new Float32Array(0)
  vel = new Float32Array(0)
  width = new Float32Array(0)
  tone = new Float32Array(0)
  head = new Uint8Array(0)
  /** 0..1 grow-in, for the opening. */
  grow = 1

  build(
    width: number,
    height: number,
    floor: (z: number) => number,
    seed: number,
    clear: Rect | null,
    wet: (x: number, y: number) => boolean = () => false,
  ) {
    // Blades keep their sway across a resize: same strip and index, same blade.
    const prev = new Map<number, [number, number]>()
    for (let i = 0; i < this.count; i++)
      prev.set(this.id[i], [this.bend[i], this.vel[i]])
    type Blade = {
      id: number
      z: number
      x: number
      jitter: number
      h: number
      lean: number
      curl: number
      stiff: number
      width: number
      tone: number
      head: number
    }
    const blades: Blade[] = []
    const feather = width * 0.08
    // Each strip draws from its own seed, so widening the window adds grass on the right and
    // leaves what's already there alone. Blades near the text thin out with a soft falloff.
    for (let s = 0; s * STRIP < width + 80; s++) {
      const rng = mulberry32(seed * 7919 + s * 104729)
      for (let t = 0; t < STRIP * 0.17; t++) {
        const z = rng() ** 1.1
        const x = (s + rng()) * STRIP - 40
        const keep = rng()
        // No grass in the river or on its banks.
        if (wet(x, floor(z))) continue
        if (clear) {
          const y = floor(z)
          const d = Math.hypot(
            Math.max(clear.left - x, 0, x - clear.right),
            Math.max(clear.top - y, 0, y - clear.bottom),
          )
          if (keep > 0.1 + 0.9 * smoothstep(0, feather, d)) continue
        }
        // One root, blades fanned out from it: the middle ones tall and upright, the outer ones
        // shorter, leaning out and curling over.
        const n = 3 + Math.floor(rng() * 5)
        const tall = lerp(0.05, 0.15, rng())
        const tilt = (rng() - 0.5) * 0.3
        const spread = lerp(0.18, 0.32, rng())
        const scale = lerp(0.25, 1.15, z ** 1.15)
        for (let j = 0; j < n; j++) {
          const side = j - (n - 1) / 2
          const out = Math.abs(side) / Math.max(1, (n - 1) / 2)
          blades.push({
            id: s * 1000 + t * 8 + j,
            z: z + j * 1e-4,
            x: x + side * 1.6 * scale + (rng() - 0.5) * 1.5,
            jitter: rng() * 2,
            h: tall * lerp(1, 0.55, out) * lerp(0.8, 1.1, rng()),
            lean: tilt + side * spread,
            curl:
              (Math.sign(side) || (rng() < 0.5 ? -1 : 1)) *
              lerp(0.2, 0.75, out) *
              lerp(0.7, 1.3, rng()),
            stiff: lerp(0.7, 1.4, rng()),
            width: lerp(2.2, 4.2, rng()),
            tone: rng(),
            head: rng() < 0.05 ? 1 : 0,
          })
        }
      }
    }
    blades.sort((a, b) => a.z - b.z)
    const n = blades.length
    this.count = n
    this.id = new Int32Array(n)
    this.x = new Float32Array(n)
    this.z = new Float32Array(n)
    this.y = new Float32Array(n)
    this.h = new Float32Array(n)
    this.lean = new Float32Array(n)
    this.curl = new Float32Array(n)
    this.stiff = new Float32Array(n)
    this.bend = new Float32Array(n)
    this.vel = new Float32Array(n)
    this.width = new Float32Array(n)
    this.tone = new Float32Array(n)
    this.head = new Uint8Array(n)
    for (let i = 0; i < n; i++) {
      const b = blades[i]
      const scale = lerp(0.25, 1.15, b.z ** 1.15)
      this.id[i] = b.id
      this.z[i] = b.z
      this.x[i] = b.x
      this.y[i] = floor(b.z) + b.jitter
      this.h[i] = height * b.h * scale
      this.lean[i] = b.lean
      this.curl[i] = b.curl
      this.stiff[i] = b.stiff
      this.width[i] = b.width * scale
      this.tone[i] = b.tone
      this.head[i] = b.head
      const was = prev.get(b.id)
      if (was) [this.bend[i], this.vel[i]] = was
    }
  }

  step(dt: number, wind: Wind) {
    const { x, y, h, stiff, bend, vel, lean, z } = this
    for (let i = 0; i < this.count; i++) {
      const tipY = y[i] - h[i] * 0.8
      const w = wind.at(x[i], tipY, z[i])
      const push = wind.push(x[i], tipY)
      const k = 14 * stiff[i]
      const target = (w * 0.42 + push * 1.6) / stiff[i]
      const acc = k * (target - bend[i]) - 2 * Math.sqrt(k) * 0.45 * vel[i]
      vel[i] += acc * dt
      bend[i] += vel[i] * dt
      bend[i] = clamp(bend[i], -1.5 - lean[i], 1.5 - lean[i])
    }
  }

  /** Draw blades whose depth is below `zMax`, starting at index `from`; returns the next index. */
  draw(
    r: Raster,
    p: Palette,
    from: number,
    zMax: number,
    haze: (z: number) => number,
  ) {
    let i = from
    const grow = easeOut(this.grow)
    // Blades in this depth band share a handful of colours: each colour is one path and one fill,
    // not a fill per blade, which is what made the raster slow.
    const blades = new Map<number, { path: Shape; color: Rgb }>()
    const seedPaths = new Map<number, { path: Shape; color: Rgb }>()
    const night = p.night
    const bucket = (
      map: Map<number, { path: Shape; color: Rgb }>,
      key: number,
      color: () => Rgb,
    ) => {
      let b = map.get(key)
      if (!b) map.set(key, (b = { path: new Shape(), color: color() }))
      return b.path
    }
    for (; i < this.count && this.z[i] < zMax; i++) {
      const H = this.h[i] * grow
      if (H < 1.5) continue
      const b = this.bend[i]
      const lean = this.lean[i]
      const W = this.width[i]
      // Bent blades show their lighter underside.
      const lit =
        Math.round(
          clamp(0.75 + 0.25 * this.tone[i] + Math.max(0, b) * 0.8, 0, 1) * 12,
        ) / 12
      const hz = Math.round(haze(this.z[i]) * (1 - night * 0.3) * 12) / 12
      const key = lit * 1000 + hz
      const color = () => mix(mix(p.grassDark, p.grassLight, lit), p.haze, hz)
      const pts: number[] = []
      let px = this.x[i]
      let py = this.y[i]
      const N = 4
      let a = lean
      for (let k = 0; k <= N; k++) {
        const s = k / N
        a = lean + this.curl[i] * s * s + b * s ** 1.5
        const w = W * (1 - s) ** 0.85
        const nx = Math.cos(a) * w * 0.5
        const ny = Math.sin(a) * w * 0.5
        pts.push(px - nx, py - ny, px + nx, py + ny)
        px += (Math.sin(a) * H) / N
        py -= (Math.cos(a) * H) / N
      }
      const path = bucket(blades, key, color)
      path.moveTo(pts[0], pts[1])
      for (let k = 1; k <= N; k++) path.lineTo(pts[k * 4], pts[k * 4 + 1])
      for (let k = N; k >= 0; k--) path.lineTo(pts[k * 4 + 2], pts[k * 4 + 3])
      path.closePath()

      if (this.head[i]) {
        // Nodding spikelets hung along the top of the culm.
        const seeds = bucket(seedPaths, key, () =>
          mix(color(), p.grassLight, 0.35),
        )
        let sx = px
        let sy = py
        let sa = a
        const sp = Math.max(1, H * 0.05)
        for (let k = 0; k < 7; k++) {
          sa += 0.22 * Math.sign(b || 1)
          sx += Math.sin(sa) * sp
          sy -= Math.cos(sa) * sp * 0.7
          seeds.moveTo(sx + sp * 0.5, sy + sp * 0.4)
          seeds.ellipse(
            sx,
            sy + sp * 0.4,
            sp * 0.32,
            sp * 0.6,
            sa + 0.6,
            0,
            Math.PI * 2,
          )
        }
      }
    }
    for (const { path, color } of blades.values())
      r.fill(path, color, Kind.Foliage)
    for (const { path, color } of seedPaths.values())
      r.fill(path, color, Kind.Fluff)
    return i
  }
}
