import createMDX from '@next/mdx';
import remarkToc from 'remark-toc';
import rehypePrettyCode from 'rehype-pretty-code';
import { transformerNotationFocus, transformerNotationDiff, transformerNotationHighlight, transformerNotationWordHighlight } from '@shikijs/transformers';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
};

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
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [
      [remarkToc, {
        heading: 'table of contents',
        maxDepth: 4,
        tight: true,
        ordered: false,
        skip: 'table of contents'
      }],
      [remarkGfm],
      [remarkFrontmatter],
      [remarkMath],
    ],
    rehypePlugins: [[rehypePrettyCode, options],
      [rehypeKatex]
    ],
  },
});

export default withMDX(nextConfig);