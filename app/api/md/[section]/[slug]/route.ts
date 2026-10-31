import fs from 'fs/promises'
import path from 'path'

import { BLOG_POSTS, EXPERIENCE_POSTS } from '@/app/data'

// A post as plain markdown, for the terminal's cat: the page's MDX with its
// components put back into markdown or dropped. Built once, at build time.

export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return [...BLOG_POSTS, ...EXPERIENCE_POSTS].map((p) => {
    const [, section, slug] = p.link.split('/')
    return { section, slug }
  })
}

const attr = (tag: string, name: string) =>
  tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1]

/** MDX prose to markdown; code fences pass through untouched. */
function toMarkdown(mdx: string) {
  return mdx
    .split(/(^```[\s\S]*?^```)/m)
    .map((part, i) =>
      i % 2
        ? part.replace(/^```(\S*).*$/m, '```$1')
        : part
            .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
            .replace(/<StarDivider\s*\/>/g, '* * *')
            .replace(/<Img\b[\s\S]*?\/>/g, (tag) => {
              const text = attr(tag, 'caption') ?? attr(tag, 'alt') ?? ''
              return `![${text}](${attr(tag, 'src') ?? ''})`
            })
            .replace(/<[A-Z]\w*\b[^>]*\/>/g, '')
            .replace(/<([A-Z]\w*)\b[^>]*>([\s\S]*?)<\/\1>/g, '$2')
            .replace(/^(import|export) .*$/gm, ''),
    )
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ section: string; slug: string }> },
) {
  const { section, slug } = await params
  const file = path.join(process.cwd(), 'app', section, slug, 'page.mdx')
  const mdx = await fs.readFile(file, 'utf-8')
  return new Response(toMarkdown(mdx) + '\n', {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  })
}
