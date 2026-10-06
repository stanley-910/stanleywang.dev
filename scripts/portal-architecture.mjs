// Turns the Portal architecture diagram into a theme-aware SVG for app/projects/portal.
//
//   npx @mermaid-js/mermaid-cli@11 -i app/projects/portal/architecture.mmd -c app/projects/portal/architecture.config.json \
//     -b transparent -o /tmp/architecture.svg   (add -p with a puppeteer config if it can't find Chrome)
//   node scripts/portal-architecture.mjs /tmp/architecture.svg
//
// The config paints with placeholder colours; this swaps them for CSS variables the page sets per theme, and the
// measuring font (Menlo, close in width to Berkeley Mono) for the site's mono font.
import fs from 'node:fs'

const COLOURS = {
  '#111111': 'var(--arch-node)',
  '#222222': 'var(--arch-border)',
  '#333333': 'var(--arch-text)',
  '#0b0b0b': 'var(--arch-text)',
  '#444444': 'var(--arch-line)',
  '#aaaaaa': 'var(--arch-line)',
  '#555555': 'var(--arch-cluster)',
  '#666666': 'var(--arch-cluster-border)',
  '#777777': 'var(--arch-muted)',
  '#888888': 'transparent',
  '#A1B2C3': 'var(--arch-accent-bg)',
  '#D1E2F3': 'var(--arch-accent)',
  '#E1F2A3': 'var(--arch-accent-text)',
}

let svg = fs.readFileSync(process.argv[2], 'utf8')
for (const [hex, value] of Object.entries(COLOURS)) {
  svg = svg.replace(new RegExp(hex, 'gi'), value)
}
svg = svg
  .replace(
    /Menlo, monospace|"trebuchet ms",verdana,arial,sans-serif/g,
    'var(--font-mono)',
  )
  .replace(/my-svg/g, 'portal-architecture')
  .replace(/<filter[\s\S]*?<\/filter>/g, '')
fs.writeFileSync(
  new URL('../app/projects/portal/architecture.svg', import.meta.url),
  svg,
)
