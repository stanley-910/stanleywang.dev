import { compilerError } from './explain'

import type { Trace } from './trace'

// The real compiler, compiled to JavaScript by TeaVM (browser/build.sh), run
// in the visitor's browser. Each compile gets a fresh module worker, so a
// runaway program is killed by the timeout and nothing leaks between runs.
// Without public/mini-c/compiler.js every compile rejects and the page falls
// back to the teaching compiler. Every way a compile ends settles its
// promise exactly once, so the page is never left waiting.

const SCRIPT = '/mini-c/compiler.js'
export const REAL_MAX_CHARS = 1200
const TIMEOUT_MS = 2000
// How long compiler.js may take to load before the compile gives up.
const LOAD_MS = 15000
// Set once compiler.js has loaded in any worker; later loads hit the cache.
export let compilerLoaded = false
// The last few programs compiled, so going back to one (an example picked
// again, an edit undone) is instant rather than another compile.
const compiled = new Map<string, Trace>()
const KEEP = 24
export const compiledTrace = (source: string) => compiled.get(source)

const workerSource = (url: string) => `
import { trace } from ${JSON.stringify(url)}
postMessage({ ready: true })
onmessage = (event) => {
  try {
    postMessage({ ok: true, json: trace(event.data) })
  } catch (error) {
    postMessage({ ok: false, error: String(error && error.message || error) })
  }
}
`

// `loadMs`: how long compiler.js may take to load (an example has its
// recorded trace to fall back on, so it waits less).
export const compileReal = (
  source: string,
  signal: AbortSignal,
  loadMs = LOAD_MS,
) =>
  new Promise<Trace>((resolve, reject) => {
    const known = compiled.get(source)
    if (known) {
      resolve(known)
      return
    }
    if (source.length > REAL_MAX_CHARS) {
      reject(new Error(`over ${REAL_MAX_CHARS} characters`))
      return
    }
    if (signal.aborted) {
      reject(new Error('aborted'))
      return
    }
    const blob = new Blob([workerSource(new URL(SCRIPT, location.href).href)], {
      type: 'text/javascript',
    })
    const blobUrl = URL.createObjectURL(blob)
    let worker: Worker
    try {
      worker = new Worker(blobUrl, { type: 'module' })
    } catch (error) {
      URL.revokeObjectURL(blobUrl)
      reject(error)
      return
    }
    // Settles once, however it ends: a result, an error, a timeout, an abort.
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const done = () => {
      settled = true
      clearTimeout(timer)
      worker.terminate()
      URL.revokeObjectURL(blobUrl)
      signal.removeEventListener('abort', abort)
    }
    const fail = (message: string) => {
      if (settled) return
      done()
      reject(new Error(message))
    }
    const abort = () => fail('aborted')
    signal.addEventListener('abort', abort)
    worker.onerror = (event) => {
      event.preventDefault()
      fail(event.message || `could not load ${SCRIPT}`)
    }
    worker.onmessageerror = () => fail('unreadable reply from the compiler')
    // Until compiler.js has loaded; then the compile's own timeout.
    timer = setTimeout(() => fail(`not loaded after ${loadMs} ms`), loadMs)
    worker.onmessage = (
      event: MessageEvent<{
        ready?: boolean
        ok?: boolean
        json?: string
        error?: string
      }>,
    ) => {
      // The timeout starts once compiler.js has loaded, so a slow first
      // download isn't cut off (and restarted cold) on every compile.
      if (settled) return
      if (event.data?.ready) {
        compilerLoaded = true
        clearTimeout(timer)
        timer = setTimeout(
          () => fail(`timed out after ${TIMEOUT_MS} ms`),
          TIMEOUT_MS,
        )
        return
      }
      done()
      try {
        // {log, trace}: log is what the compiler printed (BrowserTrace.java).
        const out =
          event.data?.ok && event.data.json
            ? (JSON.parse(event.data.json) as { log: string; trace: Trace })
            : undefined
        const trace = out?.trace
        if (trace?.error) {
          // "Parsing failed (1 errors)" becomes the printed error, in words.
          const printed = compilerError(out?.log ?? '', source)
          if (printed) trace.error = printed
        }
        if (trace?.frames?.length) {
          compiled.delete(source)
          compiled.set(source, trace)
          if (compiled.size > KEEP)
            compiled.delete(compiled.keys().next().value as string)
          resolve(trace)
        } else reject(new Error(event.data?.error ?? 'compiler failed'))
      } catch (error) {
        // A reply that isn't a trace (malformed JSON, an unexpected shape).
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    }
    worker.postMessage(source)
  })
