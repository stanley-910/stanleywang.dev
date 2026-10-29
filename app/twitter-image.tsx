// Twitter/X reads its own tag; it gets the same image as Open Graph.
export { default, alt, size, contentType } from './opengraph-image'

// Segment config can't be re-exported; Next reads it from this file.
export const revalidate = 86400
