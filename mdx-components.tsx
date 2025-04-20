import type { MDXComponents } from 'mdx/types'
import { TableOfContents } from '@/components/ui/toc'
import GithubSlugger from 'github-slugger'

export function useMDXComponents(components: MDXComponents): MDXComponents {
  const slugger = new GithubSlugger()
  
  return {
    ...components,
    code: ({ children }) => {
      return <code className="prose-code">{children}</code>
    },
    h1: ({ children }) => {
      const slug = slugger.slug(children?.toString() || '')
      return <h1 id={slug}>{children}</h1>
    },
    h2: ({ children }) => {
      const slug = slugger.slug(children?.toString() || '')
      return <h2 id={slug}>{children}</h2>
    },
    h3: ({ children }) => {
      const slug = slugger.slug(children?.toString() || '')
      return <h3 id={slug}>{children}</h3>
    },
    h4: ({ children }) => {
      const slug = slugger.slug(children?.toString() || '')
      return <h4 id={slug}>{children}</h4>
    },
    Cover: ({
      src,
      alt,
      caption,
    }: {
      src: string
      alt: string
      caption: string
    }) => {
      return (
        <figure>
          <img src={src} alt={alt} className="rounded-xl" />
          <figcaption className="text-center">{caption}</figcaption>
        </figure>
      )
    },
    TOC: ({ title }: { title?: string }) => {
      return <TableOfContents title={title} />
    },
  }
}
