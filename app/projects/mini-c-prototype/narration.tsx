// The slides read aloud (Stanley, 2026-10-06): one recording of them all,
// cut into a part per slide (narration/align.py), each word lit in the note
// as it's said. The words light through the CSS Custom Highlight API, so the
// note's markup is left as it is; without it the narration only plays.
import { useEffect, useRef, useState, type RefObject } from 'react'

type Part = {
  src: string
  start: number
  end: number
  words: [string, number][]
}
type Narration = { parts: Record<string, Part> }

// Fetched the first time the narration is turned on, never before.
let loading: Promise<Narration | null> | undefined
const load = () =>
  (loading ??= fetch('/mini-c/narration.json')
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<Narration>
    })
    .catch((e) => {
      console.error('narration: could not load /mini-c/narration.json', e)
      loading = undefined
      return null
    }))

// A word as the two sides are compared: letters and digits only, and the
// numbers the voice says ("step two") as the slide writes them ("step 2").
const NUMBERS: Record<string, string> = {
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
}
const key = (word: string) => {
  const k = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  return NUMBERS[k] ?? k
}
const same = (a: string, b: string) =>
  a === b ||
  (a.length > 3 && b.length > 3 && (a.startsWith(b) || b.startsWith(a)))

// A word's letters, without the punctuation around it (`$sp` keeps its $).
const WORD = /[\p{L}\p{N}$](?:[^\s]*[\p{L}\p{N}])?/u

/** The note's words in reading order, outside its heading. */
function wordRanges(root: HTMLElement) {
  const out: { key: string; range: Range }[] = []
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.parentElement?.closest('.ac-window-head')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  })
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    for (const m of (n.textContent ?? '').matchAll(/\S+/g)) {
      const word = WORD.exec(m[0])
      const k = word && key(word[0])
      if (!word || !k) continue
      const range = document.createRange()
      range.setStart(n, m.index + word.index)
      range.setEnd(n, m.index + word.index + word[0].length)
      out.push({ key: k, range })
    }
  }
  return out
}

/**
 * When each written word is said. The heard words are lined up against the
 * written ones (their longest common run); a written word with no match (a
 * misheard "Kali" for "callee", code read as "equals") takes its place
 * between the matched words either side. Words before the first match or
 * after the last (a hint the voice skips) are never said.
 */
function timings(written: string[], part: Part): (number | undefined)[] {
  const heard = part.words.map(([w]) => key(w))
  const n = heard.length
  const m = written.length
  const w = m + 1
  const best = new Uint16Array((n + 1) * w)
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      best[i * w + j] = same(heard[i], written[j])
        ? best[(i + 1) * w + j + 1] + 1
        : Math.max(best[(i + 1) * w + j], best[i * w + j + 1])
  const at: (number | undefined)[] = new Array(m)
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (same(heard[i], written[j])) at[j++] = part.words[i++][1]
    else if (best[(i + 1) * w + j] >= best[i * w + j + 1]) i++
    else j++
  }
  let from = -1
  for (let j = 0; j < m; j++) {
    const b = at[j]
    if (b === undefined) continue
    const a = at[from]
    if (a !== undefined)
      for (let k = from + 1; k < j; k++)
        at[k] = a + ((b - a) * (k - from)) / (j - from)
    from = j
  }
  return at
}

/** The voice's speeds, round from 1x (its own, apart from the animation's). */
export const VOICE_RATES = [1, 1.25, 1.5, 2, 0.75]

/**
 * Plays `voice`'s part while `on`, at `rate`, lighting each word of the note
 * in `text` as it's said. A part plays from its start each time its slide is
 * shown, and stops at its end or when the slide goes.
 */
export function useNarration(
  on: boolean,
  voice: string | undefined,
  text: RefObject<HTMLElement | null>,
  rate = 1,
) {
  const [data, setData] = useState<Narration | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const audio = useRef<HTMLAudioElement | null>(null)
  // (a change of speed carries on mid-word rather than restarting the part)
  const rateRef = useRef(rate)
  useEffect(() => {
    rateRef.current = rate
    if (audio.current) audio.current.playbackRate = rate
  }, [rate])

  useEffect(() => {
    if (on && !data) load().then(setData)
  }, [on, data])

  useEffect(() => {
    const part = on && voice ? data?.parts[voice] : undefined
    if (!data || !part) return
    const player = (audio.current ??= new Audio())
    // (the parts are cut from two recordings; a part in the other one
    // loads it in place of this)
    const src = new URL(part.src, location.href).href
    if (player.src !== src) player.src = src
    const highlights =
      typeof CSS !== 'undefined' && 'highlights' in CSS ? CSS.highlights : null
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    let words: { range: Range; time: number }[] = []
    let lit = -1
    let frame = 0
    let gone = false
    const light = () => {
      const root = text.current
      if (!highlights || !root) return
      // (built on the first frame, after the note renders; again if a
      // re-render replaced its text)
      if (!words.length || !words[0].range.startContainer.isConnected) {
        const ranges = wordRanges(root)
        const times = timings(
          ranges.map((r) => r.key),
          part,
        )
        words = ranges.flatMap((r, i) => {
          const time = times[i]
          return time === undefined ? [] : [{ range: r.range, time }]
        })
        lit = -1
      }
      const t = player.currentTime
      let i = lit < 0 ? 0 : lit
      while (i + 1 < words.length && words[i + 1].time <= t) i++
      while (i > 0 && words[i].time > t) i--
      if (i === lit || !words[i] || words[i].time > t) return
      lit = i
      highlights.set('narration', new Highlight(words[i].range))
      // Keep the word in view when the note scrolls.
      const scroller = root.closest('.ac-window-body, .ac-note-body')
      if (!(scroller instanceof HTMLElement)) return
      const box = words[i].range.getBoundingClientRect()
      const view = scroller.getBoundingClientRect()
      if (box.bottom > view.bottom - 8 || box.top < view.top)
        scroller.scrollBy({
          top: box.top - view.top - view.height / 3,
          behavior: reduced ? 'auto' : 'smooth',
        })
    }
    const stop = () => {
      cancelAnimationFrame(frame)
      player.pause()
      highlights?.delete('narration')
      setSpeaking(false)
    }
    const tick = () => {
      if (gone) return
      if (player.currentTime >= part.end || player.ended) return stop()
      light()
      frame = requestAnimationFrame(tick)
    }
    const start = () => {
      if (gone) return
      player.currentTime = part.start
      player.playbackRate = rateRef.current
      player
        .play()
        .then(() => {
          if (gone) return
          setSpeaking(true)
          frame = requestAnimationFrame(tick)
        })
        .catch((e: unknown) => {
          // (a newer slide's play interrupting this one's is expected)
          if (!(e instanceof DOMException && e.name === 'AbortError'))
            console.error('narration: could not play', e)
        })
    }
    // A position can be set once the file's length is known.
    if (player.readyState >= HTMLMediaElement.HAVE_METADATA) start()
    else player.addEventListener('loadedmetadata', start, { once: true })
    return () => {
      gone = true
      player.removeEventListener('loadedmetadata', start)
      stop()
    }
  }, [on, voice, data, text])

  // Nothing plays on after the page is left.
  useEffect(() => () => audio.current?.pause(), [])

  return speaking
}
