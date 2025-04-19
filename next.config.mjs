import createMDX from '@next/mdx';
import remarkToc from 'remark-toc';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
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
  },
});

export default withMDX(nextConfig);
