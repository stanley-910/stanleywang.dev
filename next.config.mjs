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
const isDev = process.env.NODE_ENV === 'development'

// Enforced: directives that cannot break the site.
const contentSecurityPolicy = [
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ')

// Report-only: the full policy to enforce once the console shows no
// violations. Next's hydration and next-themes use inline scripts, and motion
// server-renders inline styles. The compiler runs in a blob: module worker;
// Vercel Analytics loads and reports through /_vercel/insights.
const contentSecurityPolicyReportOnly = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  'frame-src https://open.spotify.com https://giscus.app',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  {
    key: 'Content-Security-Policy-Report-Only',
    value: contentSecurityPolicyReportOnly,
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  async redirects() {
    return [
      // The shell lives on its own origin.
      {
        source: '/shell/:path*',
        destination: 'https://sh.stanleywang.dev/:path*',
        permanent: true,
      },
      // Temporary redirects keep these slugs available for future project pages.
      ...[
        ['eastwatch', 'https://github.com/stanley-910/eastwatch'],
        ['pi-talk', 'https://github.com/stanley-910/pi-talk'],
        ['lovebox', 'https://github.com/stanley-910/lovebox'],
        ['chani', 'https://github.com/stanley-910/chani'],
        ['dictate', 'https://github.com/stanley-910/dictate'],
      ].map(([slug, destination]) => ({
        source: `/projects/${slug}`,
        destination,
        permanent: false,
      })),
    ]
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
