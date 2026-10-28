// The page theme follows the hour: light from 05:30, dark from 18:30.
// Picking a theme by hand holds until the next of those switches, then the
// hour takes over again. next-themes still applies the theme; this decides
// which one it reads from storage.

export type PageTheme = 'light' | 'dark'

export const LIGHT_FROM = 5.5
export const DARK_FROM = 18.5
export const OVERRIDE_KEY = 'theme-override'
export const THEME_KEY = 'theme'

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
}catch(e){}})()`
