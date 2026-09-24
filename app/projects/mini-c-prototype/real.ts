import type { Trace } from './trace'

// The real compiler, compiled to JavaScript by TeaVM (browser/build.sh), run
// in the visitor's browser. Each compile gets a fresh module worker, so a
// runaway program is killed by the timeout and nothing leaks between runs.
// public/mini-c/compiler.js is gitignored; without it every compile rejects
// and the page falls back to the teaching compiler.

const SCRIPT = '/mini-c/compiler.js'
export const REAL_MAX_CHARS = 1200
const TIMEOUT_MS = 2000

const workerSource = (url: string) => `
import { trace } from ${JSON.stringify(url)}
onmessage = (event) => {
  try {
    postMessage({ ok: true, json: trace(event.data) })
  } catch (error) {
    postMessage({ ok: false, error: String(error && error.message || error) })
  }
}
`

export const compileReal = (source: string, signal: AbortSignal) =>
  new Promise<Trace>((resolve, reject) => {
    if (source.length > REAL_MAX_CHARS) {
      reject(new Error(`over ${REAL_MAX_CHARS} characters`))
      return
    }
    const blob = new Blob([workerSource(new URL(SCRIPT, location.href).href)], {
      type: 'text/javascript',
    })
    const blobUrl = URL.createObjectURL(blob)
    const worker = new Worker(blobUrl, { type: 'module' })
    const done = () => {
      clearTimeout(timer)
      worker.terminate()
      URL.revokeObjectURL(blobUrl)
      signal.removeEventListener('abort', abort)
    }
    const fail = (message: string) => {
      done()
      reject(new Error(message))
    }
    const timer = setTimeout(
      () => fail(`timed out after ${TIMEOUT_MS} ms`),
      TIMEOUT_MS,
    )
    const abort = () => fail('aborted')
    signal.addEventListener('abort', abort)
    worker.onerror = (event) => {
      event.preventDefault()
      fail(event.message || `could not load ${SCRIPT}`)
    }
    worker.onmessage = (
      event: MessageEvent<{ ok: boolean; json?: string; error?: string }>,
    ) => {
      done()
      if (event.data.ok && event.data.json)
        resolve(JSON.parse(event.data.json) as Trace)
      else reject(new Error(event.data.error ?? 'compiler failed'))
    }
    worker.postMessage(source)
  })
