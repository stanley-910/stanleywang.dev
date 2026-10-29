// The page's colours follow the hour: the visitor's clock, or an hour they
// set on the time slider (design/circadian-meadow/components/ReadingTime).
// A set hour holds for the visit (sessionStorage) and doesn't advance. Home's
// meadow reads and writes the same hour.
//
// Two families, never blended into each other: light from 05:30 and dark from
// 18:30. Within a family the colours drift with the hour in OKLab. next-themes
// still carries the family as `dark` / `light`, for `dark:` classes.

export type PageTheme = 'light' | 'dark'

export const LIGHT_FROM = 5.5
export const DARK_FROM = 18.5
export const THEME_KEY = 'theme'
export const HOUR_KEY = 'hour-override'
/** Fired on window when the set hour changes; `detail` is the hour or null. */
export const HOUR_EVENT = 'hourchange'

export type ReadingColours = {
  page: string
  ink: string
  inkMuted: string
  hairline: string
  surface: string
  theme: PageTheme
}

/**
 * The reading colours at `hour` (0–24). Self-contained, with no imports or
 * outside names, because THEME_SCRIPT inlines its source to paint before
 * the page shows.
 */
export function readingColours(hour: number): ReadingColours {
  // Keyframes: [hour, page, ink, ink-muted, hairline]. The dark family's
  // hours run past 24 so it reads in order across midnight.
  const LIGHT: [number, string, string, string, string][] = [
    // Dawn starts a dark, muted grey, easy on waking eyes, and brightens to
    // day; its ink deepens to keep the contrast.
    [5.5, '#8e8d8a', '#0e0e10', '#232226', '#3f3e42'],
    [7, '#b6b4b1', '#18181b', '#3a393d', '#58575b'],
    [8, '#d4d2cf', '#202023', '#4e4d51', '#727175'],
    [9, '#ebeae6', '#252522', '#63625e', '#868580'],
    [16, '#ebeae6', '#252522', '#63625e', '#868580'],
    [17.5, '#ece5da', '#2a251f', '#665e55', '#888077'],
    // Golden dims through its last hour, so the switch to dark is shorter.
    [18.5, '#d8cbb8', '#231e18', '#544a40', '#786d60'],
  ]
  const DARK: [number, string, string, string, string][] = [
    // Dusk starts as a lighter, warm dark and deepens to night's blue.
    [18.5, '#2b2225', '#efe6df', '#ab9f99', '#786a6c'],
    [19.25, '#1c1619', '#ebe1da', '#a1958f', '#6d6361'],
    [20.15, '#15131c', '#e5e0ea', '#9a94a3', '#66616e'],
    [21.4, '#10151d', '#dde2ea', '#8f97a3', '#5d646f'],
    // The middle of the night goes to black; the blue holds either side.
    [23.5, '#000000', '#d8dade', '#8a8d93', '#5b5e64'],
    [24.5, '#000000', '#d8dade', '#8a8d93', '#5b5e64'],
    [26.5, '#10151d', '#dde2ea', '#8f97a3', '#5d646f'],
    [28.5, '#10151d', '#dde2ea', '#8f97a3', '#5d646f'],
    // Before dawn the night lifts a little.
    [29.5, '#1a2230', '#e2e6ec', '#98a1ad', '#677080'],
  ]
  const lin = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  const enc = (c: number) => {
    const v = Math.max(0, Math.min(1, c))
    return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
  }
  const toLab = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) =>
      lin(parseInt(hex.slice(i, i + 2), 16) / 255),
    )
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ]
  }
  const toHex = ([L, a, b]: number[]) => {
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3)
    const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3)
    const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3)
    const rgb = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ]
    return (
      '#' +
      rgb
        .map((c) =>
          Math.round(enc(c) * 255)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
    )
  }
  const mix = (x: string, y: string, t: number) => {
    const A = toLab(x)
    const B = toLab(y)
    return toHex(A.map((v, i) => v + (B[i] - v) * t))
  }

  const h = ((hour % 24) + 24) % 24
  const light = h >= 5.5 && h < 18.5
  const keys = light ? LIGHT : DARK
  const at = light ? h : h < 12 ? h + 24 : h
  let k = keys.length - 1
  let t = 0
  if (at <= keys[0][0]) k = 0
  else
    for (let i = 0; i < keys.length - 1; i++)
      if (at < keys[i + 1][0]) {
        k = i
        t = (at - keys[i][0]) / (keys[i + 1][0] - keys[i][0])
        break
      }
  const from = keys[k]
  const to = keys[Math.min(k + 1, keys.length - 1)]
  const page = mix(from[1], to[1], t)
  return {
    page,
    ink: mix(from[2], to[2], t),
    inkMuted: mix(from[3], to[3], t),
    hairline: mix(from[4], to[4], t),
    // A step lighter than the page, as the tokens have it.
    surface: mix(page, '#ffffff', light ? 0.35 : 0.04),
    theme: light ? 'light' : 'dark',
  }
}

/** The hour the page shows: the set one, else the clock's. */
export function currentHour(): { hour: number; set: boolean } {
  try {
    const raw = sessionStorage.getItem(HOUR_KEY)
    if (raw !== null && !Number.isNaN(Number(raw)))
      return { hour: Number(raw), set: true }
  } catch {}
  const d = new Date()
  return { hour: d.getHours() + d.getMinutes() / 60, set: false }
}

/** Sets the hour for this visit, or `null` to follow the clock again. */
export function setHour(hour: number | null) {
  try {
    if (hour === null) sessionStorage.removeItem(HOUR_KEY)
    // 24:00 stays 24, so the slider's thumb stays at the day's end.
    else
      sessionStorage.setItem(
        HOUR_KEY,
        String(hour >= 0 && hour <= 24 ? hour : ((hour % 24) + 24) % 24),
      )
  } catch {}
  window.dispatchEvent(new CustomEvent(HOUR_EVENT, { detail: hour }))
}

/** Writes the colours as the page's CSS variables, the theme-color included. */
export function applyColours(c: ReadingColours) {
  const s = document.documentElement.style
  s.setProperty('--page', c.page)
  s.setProperty('--ink', c.ink)
  s.setProperty('--ink-muted', c.inkMuted)
  s.setProperty('--hairline', c.hairline)
  s.setProperty('--surface', c.surface)
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = c.page
}

// Runs in <head> before paint, ahead of next-themes' own script, so the first
// frame already has the hour's colours and family. It also keeps another
// tab's theme out: next-themes syncs the stored theme across tabs, but each
// tab's family follows its own hour, which a tab can set for itself. Added
// first, this listener stops the sync before next-themes hears it.
export const THEME_SCRIPT = `(function(){try{
var o=null;try{o=sessionStorage.getItem('${HOUR_KEY}')}catch(e){}
var n=new Date(),h=o!==null&&!isNaN(+o)?+o:n.getHours()+n.getMinutes()/60;
var c=(${readingColours.toString()})(h);
var s=document.documentElement.style;
s.setProperty('--page',c.page);s.setProperty('--ink',c.ink);s.setProperty('--ink-muted',c.inkMuted);
s.setProperty('--hairline',c.hairline);s.setProperty('--surface',c.surface);
localStorage.setItem('${THEME_KEY}',c.theme);
var m=document.createElement('meta');m.name='theme-color';m.content=c.page;document.head.appendChild(m);
addEventListener('storage',function(e){if(e.key==='${THEME_KEY}')e.stopImmediatePropagation()});
}catch(e){}})()`
