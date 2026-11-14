import 'server-only'

import { promises as fs } from 'node:fs'
import path from 'node:path'

import { get, list, put } from '@vercel/blob'

import type { DigestRun } from './types'

// Runs live in a private Vercel Blob store at digest/<feed>/<id>.json.
// Without BLOB_READ_WRITE_TOKEN in development they live in .digest-data/ instead.

const PREFIX = 'digest/'
const FILES = 'digest-files/'

// Runs and their files delete themselves this many days after upload (Blob TTL).
const TTL_DAYS = Math.min(
  730,
  Math.max(1, Number(process.env.DIGEST_TTL_DAYS) || 45),
)
const LOCAL_DIR = path.join(process.cwd(), '.digest-data')

function blobEnabled(): boolean {
  if (process.env.BLOB_READ_WRITE_TOKEN) return true
  if (process.env.NODE_ENV === 'production')
    throw new Error('BLOB_READ_WRITE_TOKEN is not set')
  return false
}

const pathname = (feed: string, id: string) => `${PREFIX}${feed}/${id}.json`

export async function saveRun(run: DigestRun): Promise<void> {
  const body = JSON.stringify(run)
  if (blobEnabled()) {
    await put(pathname(run.feed, run.id), body, {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
      ttlDays: TTL_DAYS,
    })
    return
  }
  const file = path.join(LOCAL_DIR, pathname(run.feed, run.id))
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, body)
}

export async function getRun(
  feed: string,
  id: string,
): Promise<DigestRun | null> {
  if (blobEnabled()) {
    const res = await get(pathname(feed, id), {
      access: 'private',
      useCache: false,
    })
    if (!res || res.statusCode !== 200) return null
    return (await new Response(res.stream).json()) as DigestRun
  }
  try {
    return JSON.parse(
      await fs.readFile(path.join(LOCAL_DIR, pathname(feed, id)), 'utf8'),
    ) as DigestRun
  } catch {
    return null
  }
}

export interface RunRef {
  feed: string
  id: string
  uploadedAt: Date
}

/** Every run, newest first. */
export async function listRuns(): Promise<RunRef[]> {
  const refs: RunRef[] = []
  const add = (p: string, uploadedAt: Date) => {
    const m = p.match(/^digest\/([a-z0-9-]+)\/([a-z0-9-]+)\.json$/)
    if (m) refs.push({ feed: m[1], id: m[2], uploadedAt })
  }
  if (blobEnabled()) {
    let cursor: string | undefined
    do {
      const page = await list({ prefix: PREFIX, cursor, limit: 1000 })
      page.blobs.forEach((b) => add(b.pathname, new Date(b.uploadedAt)))
      cursor = page.hasMore ? page.cursor : undefined
    } while (cursor)
  } else {
    const root = path.join(LOCAL_DIR, PREFIX)
    const feeds = await fs.readdir(root).catch(() => [] as string[])
    for (const feed of feeds) {
      for (const f of await fs
        .readdir(path.join(root, feed))
        .catch(() => [] as string[])) {
        const st = await fs.stat(path.join(root, feed, f))
        add(`${PREFIX}${feed}/${f}`, st.mtime)
      }
    }
  }
  return refs.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
}

const filePath = (feed: string, run: string, name: string) =>
  `${FILES}${feed}/${run}/${name}`

const TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  typ: 'text/plain; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  json: 'application/json',
}

export function contentTypeFor(name: string): string {
  return TYPES[name.split('.').pop() ?? ''] ?? 'application/octet-stream'
}

export async function saveFile(
  feed: string,
  run: string,
  name: string,
  body: Buffer,
): Promise<void> {
  if (blobEnabled()) {
    await put(filePath(feed, run, name), body, {
      access: 'private',
      contentType: contentTypeFor(name),
      addRandomSuffix: false,
      allowOverwrite: true,
      ttlDays: TTL_DAYS,
    })
    return
  }
  const file = path.join(LOCAL_DIR, filePath(feed, run, name))
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, body)
}

export async function getFile(
  feed: string,
  run: string,
  name: string,
): Promise<ReadableStream<Uint8Array> | null> {
  if (blobEnabled()) {
    const res = await get(filePath(feed, run, name), {
      access: 'private',
      useCache: false,
    })
    return res && res.statusCode === 200 ? res.stream : null
  }
  try {
    const buf = await fs.readFile(
      path.join(LOCAL_DIR, filePath(feed, run, name)),
    )
    return new Response(buf).body
  } catch {
    return null
  }
}
