import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { EB_Garamond } from 'next/font/google'

import { Poem } from './poem'

import type { Metadata } from 'next'

// Unlisted: nothing links here and search engines are asked to stay out. The
// poem itself is encrypted (scripts/encrypt-poem.mjs); this page only holds
// the ciphertext until someone enters the password. On the dev server it
// reads the plaintext instead, to check the layout before encrypting.

const garamond = EB_Garamond({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-poem',
})

export const metadata: Metadata = {
  title: 'stanleywang.dev',
  robots: { index: false, follow: false },
}

async function preview() {
  if (process.env.NODE_ENV !== 'development') return undefined
  try {
    return await readFile(
      path.join(process.cwd(), 'content/private/poem.txt'),
      'utf8',
    )
  } catch {
    return undefined
  }
}

export default async function Page() {
  return <Poem className={garamond.variable} preview={await preview()} />
}
