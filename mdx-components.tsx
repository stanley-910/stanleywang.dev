import GithubSlugger from 'github-slugger'
import Link from 'next/link'

import { Stars } from '@/components/ui/stars'
import { TableOfContents } from '@/components/ui/toc'
import { ClickableHeader } from '@/components/ui/clickable-header'
import { cn } from '@/lib/utils'

import type { MDXComponents } from 'mdx/types'

// Define Spotify component props
interface SpotifyProps {
  link: string
  wide?: boolean
  className?: string
}

// Spotify component that converts Spotify links to embed URLs
const Spotify = ({ link, wide = false, className }: SpotifyProps) => {
  // Convert spotify URL to embed URL
  const embedUrl = link.replace('spotify.com', 'spotify.com/embed')

  return (
    <div
      className={cn(
        'mx-auto my-8 w-full max-w-[350px]',
        wide && 'max-w-[650px]',
        className,
      )}
    >
      <iframe
        src={embedUrl}
        width="100%"
        height={wide ? '80' : '352'}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        className="rounded-xl"
        style={{ borderRadius: '12px' }}
      />
    </div>
  )
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  const slugger = new GithubSlugger()

  return {
    ...components,
    // hr: () => <Stars asHr />,
    StarDivider: ({
      variant,
      className,
    }: {
      variant?: 1 | 2 | 3
      className?: string
    }) => <Stars asHr variant={variant} className={className} />,
    // Add Spotify component to MDX components
    Spotify,
    strike: ({ children }) => <span className="line-through">{children}</span>,
    // Add custom link component to handle external links
    a: ({ href, children, ...props }) => {
      const isExternal = href?.startsWith('http') || href?.startsWith('mailto:')
      if (isExternal) {
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
            {children}
          </a>
        )
      }
      return href ? (
        <Link href={href} {...props}>
          {children}
        </Link>
      ) : null
    },
    h1: ({ children }) => {
      const slug = slugger.slug(children?.toString() || '')
      return (
        <ClickableHeader level={1} slug={slug}>
          {children}
        </ClickableHeader>
      )
    },
    h2: ({ children }) => {
      const slug = slugger.slug(children?.toString() || '')
      // Exclude Footnotes heading from TOC
      if (children?.toString().toLowerCase() === 'footnotes') {
        return (
          <ClickableHeader 
            level={2} 
            slug={slug} 
            dataAttributes={{ 'data-toc-exclude': '' }}
          >
            {children}
          </ClickableHeader>
        )
      }
      return (
        <ClickableHeader level={2} slug={slug}>
          {children}
        </ClickableHeader>
      )
    },
    h3: ({ children }) => {
      const slug = slugger.slug(children?.toString() || '')
      return (
        <ClickableHeader level={3} slug={slug}>
          {children}
        </ClickableHeader>
      )
    },
    h4: ({ children }) => {
      const slug = slugger.slug(children?.toString() || '')
      return (
        <ClickableHeader level={4} slug={slug}>
          {children}
        </ClickableHeader>
      )
    },

    Img: ({
      src,
      alt,
      title,
      caption,
      invert = false,
      size,
      className,
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
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              title={title}
              src={src}
              alt={alt}
              className={cn(
                'cover mx-auto rounded-xl',
                invert && 'dark:invert',
                className,
              )}
              style={size ? { width: `${size}%`, height: 'auto' } : undefined}
            />
          </a>
          <figcaption className="text-center font-sans">{caption}</figcaption>
        </figure>
      )
    },
    TOC: ({ title }: { title?: string }) => {
      return <TableOfContents title={title} />
    },
  }
}
