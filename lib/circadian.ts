// The page theme follows the hour: light from 05:30, dark from 18:30.
// Picking a theme by hand holds until the next of those switches, then the
// hour takes over again. next-themes still applies the theme; this decides
// which one it reads from storage.

export type PageTheme = 'light' | 'dark'

export const LIGHT_FROM = 5.5
export const DARK_FROM = 18.5
export const OVERRIDE_KEY = 'theme-override'
// page-light / page-dark, for the browser's own chrome (meta theme-color).
export const CHROME: Record<PageTheme, string> = {
  light: '#ebeae6',
  dark: '#1b1b19',
}
export const THEME_KEY = 'theme'

// Sets <meta name="theme-color"> to the page colour of `theme`.
export function setChrome(theme: PageTheme) {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = CHROME[theme]
}

export function themeAt(date: Date): PageTheme {
  const h = date.getHours() + date.getMinutes() / 60
  return h >= LIGHT_FROM && h < DARK_FROM ? 'light' : 'dark'
}

// The next moment the hour changes the theme, after `date`.
export function nextSwitch(date: Date): Date {
  const at = (hours: number, dayOffset = 0) => {
    const d = new Date(date)
    d.setDate(d.getDate() + dayOffset)
    d.setHours(Math.floor(hours), (hours % 1) * 60, 0, 0)
    return d
  }
  const tomorrow = at(LIGHT_FROM, 1)
  return [at(LIGHT_FROM), at(DARK_FROM)].find((d) => d > date) ?? tomorrow
}

// Runs in <head> before paint, ahead of next-themes' own script, so the
// first frame already has the hour's theme. Kept in step with the
// functions above by hand: it can't import them.
export const THEME_SCRIPT = `(function(){try{
var n=new Date(),h=n.getHours()+n.getMinutes()/60;
var t=h>=${LIGHT_FROM}&&h<${DARK_FROM}?'light':'dark';
var o=JSON.parse(localStorage.getItem('${OVERRIDE_KEY}')||'null');
if(o&&o.until>n.getTime()&&(o.theme==='light'||o.theme==='dark'))t=o.theme;
else localStorage.removeItem('${OVERRIDE_KEY}');
localStorage.setItem('${THEME_KEY}',t);
var m=document.createElement('meta');m.name='theme-color';
m.content=t==='light'?'${CHROME.light}':'${CHROME.dark}';document.head.appendChild(m);
}catch(e){}})()`
