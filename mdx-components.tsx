import type { MDXComponents } from 'mdx/types'
import { TableOfContents } from '@/components/ui/toc'
import { Stars } from '@/components/ui/stars'
import GithubSlugger from 'github-slugger'
import { cn } from '@/lib/utils'
import Image from 'next/image';

// Define Spotify component props
interface SpotifyProps {
  link: string;
  wide?: boolean;
  className?: string;
}

// Spotify component that converts Spotify links to embed URLs
const Spotify = ({ link, wide = false, className }: SpotifyProps) => {
  // Convert spotify URL to embed URL
  const embedUrl = link.replace('spotify.com', 'spotify.com/embed');
  
  return (
    <div className={cn(
      "mx-auto my-8 w-full max-w-[350px]",
      wide && "max-w-[650px]",
      className
    )}>
      <iframe
        src={embedUrl}
        width="100%"
        height={wide ? "80" : "352"}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        className="rounded-xl"
        style={{ borderRadius: '12px' }}
      />
    </div>
  );
};

export function useMDXComponents(components: MDXComponents): MDXComponents {
  const slugger = new GithubSlugger()
  
  return {
    ...components,
    // hr: () => <Stars asHr />,
    StarDivider: ({ variant, className }: { variant?: 1 | 2 | 3, className?: string }) => (
      <Stars asHr variant={variant} className={className} />
    ),
    // Add Spotify component to MDX components
    Spotify,
    strike: ({ children }) => <span className="line-through">{children}</span>,
    h1: ({ children }) => {
      const slug = slugger.slug(children?.toString() || '')
      return <h1 id={slug} className="scroll-mt-[3vh]">{children}</h1>
    },
    h2: ({ children }) => {
      const slug = slugger.slug(children?.toString() || '')
      // Exclude Footnotes heading from TOC
      if (children?.toString().toLowerCase() === 'footnotes') {
        return <h2 id={slug} className="scroll-mt-[3vh]" data-toc-exclude>{children}</h2>
      }
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
          <a href={src} target="_blank" rel="noopener noreferrer" className="no-underline">
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
