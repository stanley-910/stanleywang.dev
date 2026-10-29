#!/usr/bin/env node
// Encrypts a poem for app/writing/poem: the plaintext stays on this machine
// (content/private is gitignored), and only the ciphertext is committed.
//
//   node scripts/encrypt-poem.mjs [plaintext] [out]
//
// Asks for the password without echoing it, or reads POEM_PASSWORD. The page
// decrypts in the browser with the same Web Crypto calls (poem.tsx): PBKDF2-
// SHA256 stretches the password into an AES-256-GCM key, and GCM's tag tells
// a wrong password from a right one.

import { readFile, writeFile } from 'node:fs/promises'
import { stdin, stdout } from 'node:process'
import { webcrypto as crypto } from 'node:crypto'

const ITERATIONS = 600_000

const [
  src = 'content/private/poem.txt',
  out = 'app/writing/poem/poem.enc.json',
] = process.argv.slice(2)

function ask(prompt) {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY) return reject(new Error('No terminal; set POEM_PASSWORD'))
    stdout.write(prompt)
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    let value = ''
    const onData = (s) => {
      for (const ch of s) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.off('data', onData)
          stdout.write('\n')
          return resolve(value)
        }
        if (ch === '\u0003') process.exit(130)
        if (ch === '\u007f') value = value.slice(0, -1)
        else value += ch
      }
    }
    stdin.on('data', onData)
  })
}

async function password() {
  if (process.env.POEM_PASSWORD) return process.env.POEM_PASSWORD
  const first = await ask('Password: ')
  const again = await ask('Again: ')
  if (first !== again) throw new Error('Passwords differ')
  if (!first) throw new Error('Empty password')
  return first
}

const b64 = (bytes) => Buffer.from(bytes).toString('base64')

const text = await readFile(src, 'utf8')
const pass = await password()
const salt = crypto.getRandomValues(new Uint8Array(16))
const iv = crypto.getRandomValues(new Uint8Array(12))
const base = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(pass.normalize('NFC')),
  'PBKDF2',
  false,
  ['deriveKey'],
)
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
  base,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt'],
)
const ct = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  new TextEncoder().encode(text),
)

await writeFile(
  out,
  JSON.stringify(
    {
      v: 1,
      iterations: ITERATIONS,
      salt: b64(salt),
      iv: b64(iv),
      ct: b64(new Uint8Array(ct)),
    },
    null,
    2,
  ) + '\n',
)
console.log(`Wrote ${out} (${text.length} characters encrypted)`)
