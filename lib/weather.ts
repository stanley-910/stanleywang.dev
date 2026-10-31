'use client'
import { useSyncExternalStore } from 'react'

// The meadow's weather (design/circadian-meadow/components/Terminal, Meadow
// effects): set from the site menu or the terminal, and drawn by home's
// meadow (components/garden/engine/weather.ts). It holds for the visit and
// isn't stored, so a reload is clear again.

export const WEATHERS = ['clear', 'rain', 'snow', 'storm', 'eclipse'] as const
export type WeatherKind = (typeof WEATHERS)[number]

/** Fired on window when the weather changes. */
export const WEATHER_EVENT = 'weatherchange'

let weather: WeatherKind = 'clear'
/**
 * Lightning's colour from the site menu's slider, 0 the coolest blue to 1 the warmest gold; null
 * leaves it to the hour and each bolt's distance.
 */
let lightningTone: number | null = null
/** The moon's colour from the site menu's slider, 0 its own silver to 1 amber; null keeps its own. */
let moonTone: number | null = null

export const isWeather = (v: unknown): v is WeatherKind =>
  WEATHERS.includes(v as WeatherKind)

export function currentWeather() {
  return weather
}

export function setWeather(next: WeatherKind) {
  if (next === weather) return
  weather = next
  window.dispatchEvent(new Event(WEATHER_EVENT))
}

export function currentLightningTone() {
  return lightningTone
}

export function setLightningTone(next: number | null) {
  if (next === lightningTone) return
  lightningTone = next
  window.dispatchEvent(new Event(WEATHER_EVENT))
}

export function currentMoonTone() {
  return moonTone
}

export function setMoonTone(next: number | null) {
  if (next === moonTone) return
  moonTone = next
  window.dispatchEvent(new Event(WEATHER_EVENT))
}

const subscribe = (fire: () => void) => {
  window.addEventListener(WEATHER_EVENT, fire)
  return () => window.removeEventListener(WEATHER_EVENT, fire)
}

/** The weather, kept current. */
export function useWeather() {
  return useSyncExternalStore(subscribe, currentWeather, () => 'clear' as const)
}

/** The lightning slider's setting, kept current. */
export function useLightningTone() {
  return useSyncExternalStore(subscribe, currentLightningTone, () => null)
}

/** The moon slider's setting, kept current. */
export function useMoonTone() {
  return useSyncExternalStore(subscribe, currentMoonTone, () => null)
}
