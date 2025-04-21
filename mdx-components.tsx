import type { MDXComponents } from 'mdx/types'
import { TableOfContents } from '@/components/ui/toc'
import { Stars } from '@/components/ui/stars'
import GithubSlugger from 'github-slugger'
export function useMDXComponents(components: MDXComponents): MDXComponents {
  const slugger = new GithubSlugger()
  
  return {
    ...components,
    // hr: () => <Stars asHr />,
    StarDivider: ({ variant, className }: { variant?: 1 | 2 | 3, className?: string }) => (
      <Stars asHr variant={variant} className={className} />
    ),
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
      title,
      caption,
    }: {
      src: string
      alt: string
      title: string
      caption: string
    }) => {
      return (
        <figure>
          <img title={title} src={src} alt={alt} className="cover rounded-xl" />
          <figcaption className="text-center font-sans">{caption}</figcaption>
        </figure>
      )
    },
    TOC: ({ title }: { title?: string }) => {
      return <TableOfContents title={title} />
    },
  }
}
