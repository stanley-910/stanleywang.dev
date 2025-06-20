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
    dark: 'catppuccin-mocha',
    light: 'catppuccin-latte',
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
