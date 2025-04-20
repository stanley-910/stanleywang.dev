import createMDX from '@next/mdx';
import remarkToc from 'remark-toc';
import rehypePrettyCode from 'rehype-pretty-code';
import { transformerNotationDiff, transformerNotationHighlight, transformerNotationWordHighlight } from '@shikijs/transformers';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
};

/** @type {import('rehype-pretty-code').Options} */
const options = {
  theme: 'catppuccin-mocha',
  transformers: [
    transformerNotationDiff(),
    transformerNotationHighlight(),
    transformerNotationWordHighlight(),
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
    ],
    rehypePlugins: [[rehypePrettyCode, options]],
  },
});

export default withMDX(nextConfig);