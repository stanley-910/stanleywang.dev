'use client'
import { useSyncExternalStore } from 'react'

// The meadow's weather (design/circadian-meadow/components/Terminal, Meadow
// effects): set from the site menu or the terminal, and drawn by home's
// meadow (components/garden/engine/weather.ts). It holds for the visit and
// isn't stored, so a reload is clear again.

export const WEATHERS = [
  'clear',
  'rain',
  'snow',
  'storm',
  'wind',
  'eclipse',
] as const
export type WeatherKind = (typeof WEATHERS)[number]

/** Fired on window when the weather changes. */
export const WEATHER_EVENT = 'weatherchange'

let weather: WeatherKind = 'clear'

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

const subscribe = (fire: () => void) => {
  window.addEventListener(WEATHER_EVENT, fire)
  return () => window.removeEventListener(WEATHER_EVENT, fire)
}

/** The weather, kept current. */
export function useWeather() {
  return useSyncExternalStore(subscribe, currentWeather, () => 'clear' as const)
}
