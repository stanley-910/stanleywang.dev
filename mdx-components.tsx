import type { MDXComponents } from 'mdx/types'
import { TableOfContents } from '@/components/ui/toc'
import { Stars } from '@/components/ui/stars'
import GithubSlugger from 'github-slugger'
import { cn } from '@/lib/utils'
import Image from 'next/image';
export function useMDXComponents(components: MDXComponents): MDXComponents {
  const slugger = new GithubSlugger()
  
  return {
    ...components,
    // hr: () => <Stars asHr />,
    StarDivider: ({ variant, className }: { variant?: 1 | 2 | 3, className?: string }) => (
      <Stars asHr variant={variant} className={className} />
    ),

    strike: ({ children }) => <span className="line-through">{children}</span>,
    h1: ({ children }) => {
      const slug = slugger.slug(children?.toString() || '')
      return <h1 id={slug} className="scroll-mt-[3vh]">{children}</h1>
    },
    h2: ({ children }) => {
      const slug = slugger.slug(children?.toString() || '')
      return <h2 id={slug} className="scroll-mt-[3vh]">{children}</h2>
    },
    h3: ({ children }) => {
      const slug = slugger.slug(children?.toString() || '')
      return <h3 id={slug} className="scroll-mt-[3vh]">{children}</h3>
    },
    h4: ({ children }) => {
      const slug = slugger.slug(children?.toString() || '')
      return <h4 id={slug} className="scroll-mt-[3vh]">{children}</h4>
    },
    
    Img: ({
      src,
      alt,
      title,
      caption,
      invert = false,
      size,
      className
    }: {
      src: string
      alt: string
      title: string
      caption: string
      invert?: boolean
      size?: number
      className?: string
    }) => {
      return (
        <figure className="flex flex-col items-center">
          <img 
            title={title} 
            src={src} 
            alt={alt} 
            className={cn(
              "cover rounded-xl mx-auto",
              invert && "dark:invert",
              className
            )}
            style={size ? { width: `${size}%`, height: 'auto' } : undefined}
          />
          <figcaption className="text-center font-sans">{caption}</figcaption>
        </figure>
      )
    },
    TOC: ({ title }: { title?: string }) => {
      return <TableOfContents title={title} />
    },
  }
}
