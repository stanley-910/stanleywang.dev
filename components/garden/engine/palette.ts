import { clamp, smoothstep } from './math'

export type Rgb = [number, number, number]

/**
 * One time of day. Everything the garden draws takes its colour from here, so the whole
 * scene can cross-fade between keyframes as the clock moves.
 */
export interface Palette {
  skyTop: Rgb
  skyHorizon: Rgb
  ground: Rgb
  /** Halftone dots across the sky, and the clouds. */
  cloud: Rgb
  haze: Rgb
  hillFar: Rgb
  hillNear: Rgb
  grassDark: Rgb
  grassLight: Rgb
  stem: Rgb
  poppy: Rgb
  poppyDeep: Rgb
  /** The poem's rose: its petals, their shadowed insides and heart, and its leaves. */
  rose: Rgb
  roseDeep: Rgb
  roseLeaf: Rgb
  cosmos: Rgb
  cosmosVein: Rgb
  lace: Rgb
  dandelion: Rgb
  disc: Rgb
  fluff: Rgb
  globe: Rgb
  /** Panel the hero text sits in: background and the cream its glyphs are recoloured toward. */
  panelBg: Rgb
  panelInk: Rgb
  /** 0 by day, 1 at full night: flowers fold, fireflies come out, stars show. */
  night: number
  /** How much glyphs stand out from what is behind them. */
  ink: number
  /** How much the moon shows and lights the land: dimmer in the dead of night. */
  moonlight: number
}

const hex = (h: string): Rgb => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]

// Day takes the Circadian Rhythm poster's slate sky, mist and cream; the land stays neutral
// stone so the flowers and sky carry the colour.
const DAY: Palette = {
  skyTop: hex('#4b6787'),
  skyHorizon: hex('#a3afb2'),
  ground: hex('#262624'),
  cloud: hex('#e2e2d4'),
  haze: hex('#a9b1b0'),
  hillFar: hex('#5f7283'),
  hillNear: hex('#454d52'),
  grassDark: hex('#4a4c47'),
  grassLight: hex('#b3b3a2'),
  stem: hex('#8f957c'),
  poppy: hex('#c95a32'),
  poppyDeep: hex('#7a2c1c'),
  rose: hex('#b3243a'),
  roseDeep: hex('#5e1220'),
  roseLeaf: hex('#56664a'),
  cosmos: hex('#e4dccb'),
  cosmosVein: hex('#b9a9b8'),
  lace: hex('#ece6cf'),
  dandelion: hex('#e2cf86'),
  disc: hex('#2b302a'),
  fluff: hex('#f1ecda'),
  globe: hex('#e6e2d0'),
  panelBg: hex('#262624'),
  panelInk: hex('#ded9bf'),
  night: 0,
  ink: 1,
  moonlight: 1,
}

// Golden hour: the light goes amber and long before the sun touches the ridge.
const GOLDEN: Palette = {
  ...DAY,
  skyTop: hex('#4d5670'),
  skyHorizon: hex('#d9a066'),
  ground: hex('#24211f'),
  cloud: hex('#f6d3a1'),
  haze: hex('#c69a74'),
  hillFar: hex('#6f6576'),
  hillNear: hex('#45403d'),
  grassDark: hex('#4f4a42'),
  grassLight: hex('#d8bf94'),
  stem: hex('#a0957a'),
  poppy: hex('#d9531f'),
  poppyDeep: hex('#7e2414'),
  rose: hex('#bc2633'),
  roseDeep: hex('#66141e'),
  roseLeaf: hex('#5f5e43'),
  cosmos: hex('#f6dcc0'),
  cosmosVein: hex('#d39a8c'),
  lace: hex('#f8e2bf'),
  dandelion: hex('#f2c867'),
  fluff: hex('#fbe7c8'),
  globe: hex('#ffe0b0'),
  panelBg: hex('#241f1c'),
  panelInk: hex('#f3dfc0'),
  night: 0.1,
}

// Sunset: a blood-orange horizon under a bruised violet sky, everything lit from behind.
const DUSK: Palette = {
  ...DAY,
  skyTop: hex('#3a2650'),
  skyHorizon: hex('#d4502e'),
  ground: hex('#170f16'),
  cloud: hex('#ff9f73'),
  haze: hex('#b35a4e'),
  hillFar: hex('#5b3557'),
  hillNear: hex('#2c1b2b'),
  grassDark: hex('#362e2f'),
  grassLight: hex('#d98e66'),
  stem: hex('#9a6c50'),
  poppy: hex('#ff5a36'),
  poppyDeep: hex('#7d1f2a'),
  rose: hex('#c41e3a'),
  roseDeep: hex('#6a1024'),
  roseLeaf: hex('#4a4536'),
  cosmos: hex('#f7c2b0'),
  cosmosVein: hex('#b05a7a'),
  lace: hex('#ffcfae'),
  dandelion: hex('#ffb04a'),
  disc: hex('#1d0f16'),
  fluff: hex('#ffd9bf'),
  globe: hex('#ffc48f'),
  panelBg: hex('#1f1219'),
  panelInk: hex('#f6d6c0'),
  night: 0.3,
}

// After the sun: the orange drains to violet and magenta before full dark.
const TWILIGHT: Palette = {
  ...DUSK,
  skyTop: hex('#1f1a3f'),
  skyHorizon: hex('#8a3a6a'),
  ground: hex('#0d0b15'),
  cloud: hex('#c77aa3'),
  haze: hex('#6d3d6b'),
  hillFar: hex('#3a2650'),
  hillNear: hex('#1a1324'),
  grassDark: hex('#2a2234'),
  grassLight: hex('#b06a8a'),
  stem: hex('#6e5468'),
  poppy: hex('#e0507a'),
  poppyDeep: hex('#4f1d47'),
  rose: hex('#cc2840'),
  roseDeep: hex('#5c0f26'),
  roseLeaf: hex('#3a4240'),
  cosmos: hex('#e8c3dc'),
  cosmosVein: hex('#8a5aa6'),
  lace: hex('#efd0e6'),
  dandelion: hex('#d9a070'),
  globe: hex('#f2c8e0'),
  panelBg: hex('#150f1e'),
  panelInk: hex('#ecd6e6'),
  night: 0.6,
}

// Night borrows from the grass and lily references: deep ink blue, phosphor greens, cold whites.
const NIGHT: Palette = {
  skyTop: hex('#0d1424'),
  skyHorizon: hex('#1d2a3f'),
  ground: hex('#0c1117'),
  cloud: hex('#5b6c8c'),
  haze: hex('#2c3a52'),
  hillFar: hex('#243149'),
  hillNear: hex('#141e26'),
  grassDark: hex('#232a2a'),
  grassLight: hex('#7f9180'),
  stem: hex('#56685a'),
  poppy: hex('#7a68a4'),
  poppyDeep: hex('#3f3160'),
  rose: hex('#a8263c'),
  roseDeep: hex('#4e1424'),
  roseLeaf: hex('#34443a'),
  cosmos: hex('#a9b1cf'),
  cosmosVein: hex('#6a6fa6'),
  lace: hex('#d7dcf0'),
  dandelion: hex('#a9a77a'),
  disc: hex('#0b0f17'),
  fluff: hex('#e3e8ff'),
  globe: hex('#dfe4f7'),
  panelBg: hex('#0d1520'),
  panelInk: hex('#cfd6ee'),
  night: 1,
  ink: 1.1,
  moonlight: 1,
}

// The dead of night: the land, hills and sky sink to near-black with only a trace of blue,
// the moon dims, and the flowers keep their colour, so they're the brightest thing out.
const MIDNIGHT: Palette = {
  skyTop: hex('#020306'),
  skyHorizon: hex('#070b14'),
  ground: hex('#020203'),
  cloud: hex('#1a2030'),
  haze: hex('#0a0f17'),
  hillFar: hex('#0b111b'),
  hillNear: hex('#05080c'),
  grassDark: hex('#090b0b'),
  grassLight: hex('#26302b'),
  stem: hex('#2c3a31'),
  poppy: hex('#ff5470'),
  poppyDeep: hex('#7a1834'),
  rose: hex('#a82238'),
  roseDeep: hex('#521222'),
  roseLeaf: hex('#263529'),
  cosmos: hex('#d6c2ff'),
  cosmosVein: hex('#8a5cff'),
  lace: hex('#eef1ff'),
  dandelion: hex('#ffd36a'),
  disc: hex('#05070a'),
  fluff: hex('#eef3ff'),
  globe: hex('#a9b1c4'),
  panelBg: hex('#07090d'),
  panelInk: hex('#d8dce8'),
  night: 1,
  ink: 1.25,
  moonlight: 0.45,
}

const DAWN: Palette = {
  ...DAY,
  skyTop: hex('#45506a'),
  skyHorizon: hex('#a7a3a4'),
  ground: hex('#222324'),
  cloud: hex('#e8dcd8'),
  haze: hex('#a3a6ab'),
  hillFar: hex('#6a7187'),
  hillNear: hex('#474c50'),
  grassDark: hex('#464a48'),
  grassLight: hex('#b0b2a6'),
  poppy: hex('#c4604a'),
  rose: hex('#a8303e'),
  roseDeep: hex('#581620'),
  roseLeaf: hex('#56644e'),
  globe: hex('#f2e4dc'),
  panelBg: hex('#1e2a2c'),
  panelInk: hex('#e4dccd'),
  night: 0.35,
}

// Hour of day → palette keyframe.
const KEYS: [number, Palette][] = [
  [0, MIDNIGHT],
  [1.5, NIGHT],
  [4.5, NIGHT],
  [6.5, DAWN],
  [9, DAY],
  [16, DAY],
  [17.75, GOLDEN],
  [19, DUSK],
  [20.15, TWILIGHT],
  [21.4, NIGHT],
  [22.5, NIGHT],
  [23.75, MIDNIGHT],
  [24, MIDNIGHT],
]

const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

export function paletteAt(hour: number): Palette {
  const h = ((hour % 24) + 24) % 24
  let i = 0
  while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++
  const [h0, a] = KEYS[i]
  const [h1, b] = KEYS[i + 1]
  const t = smoothstep(0, 1, clamp((h - h0) / (h1 - h0 || 1), 0, 1))
  const out = { ...a } as Palette
  for (const k of Object.keys(a) as (keyof Palette)[]) {
    const va = a[k]
    const vb = b[k]
    if (typeof va === 'number' && typeof vb === 'number')
      (out[k] as number) = va + (vb - va) * t
    else (out[k] as Rgb) = mixRgb(va as Rgb, vb as Rgb, t)
  }
  return out
}

export const css = (c: Rgb, a = 1) =>
  a >= 1
    ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
    : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`

export const mix = mixRgb
export const shade = (c: Rgb, k: number): Rgb => [
  Math.min(255, c[0] * k),
  Math.min(255, c[1] * k),
  Math.min(255, c[2] * k),
]
