import createMDX from '@next/mdx'
import remarkToc from 'remark-toc'
import rehypePrettyCode from 'rehype-pretty-code'
import {
  transformerNotationFocus,
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from '@shikijs/transformers'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No dev badge: it sat on the compiler's phone controls. (Next 15.1's
  // form; from 15.2 it's `devIndicators: false`.)
  devIndicators: { appIsrStatus: false, buildActivity: false },
  // Temporary redirects keep these slugs available for future project pages.
  async redirects() {
    return [
      ['eastwatch', 'https://github.com/stanley-910/eastwatch'],
      ['pi-talk', 'https://github.com/stanley-910/pi-talk'],
      ['lovebox', 'https://github.com/stanley-910/lovebox'],
      ['chani', 'https://github.com/stanley-910/chani'],
      ['dictate', 'https://github.com/stanley-910/dictate'],
    ].map(([slug, destination]) => ({
      source: `/projects/${slug}`,
      destination,
      permanent: false,
    }))
  },
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
  // Disable ESLint during production builds
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
}

/** @type {import('rehype-pretty-code').Options} */
const options = {
  theme: {
    dark: 'gruvbox-dark-hard',
    light: 'gruvbox-light-hard',
  },
  keepBackground: false,
  transformers: [
    transformerNotationDiff(),
    transformerNotationHighlight(),
    transformerNotationWordHighlight(),
    transformerNotationFocus(),
  ],
}

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [
      [
        remarkToc,
        {
          heading: 'table of contents',
          maxDepth: 4,
          tight: true,
          ordered: false,
          skip: 'table of contents',
        },
      ],
      remarkGfm,
      remarkFrontmatter,
      remarkMath,
      [
        remarkRehype,
        // {
        //   allowDangerousHtml: true,
        //   footnoteBackContent: '↑',
        // },
      ],
    ],
    rehypePlugins: [[rehypePrettyCode, options], [rehypeKatex]],
  },
})

export default withMDX(nextConfig)
