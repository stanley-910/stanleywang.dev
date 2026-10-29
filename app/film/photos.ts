// Photos on /film. Every field but the size is optional: a caption shows
// only what's known. Files live in public/images/film, with their metadata
// (GPS included) stripped; without `src` the page draws a placeholder.
export type Photo = {
  id: string
  src?: string
  // The image's pixel size, for its shape before it loads.
  width: number
  height: number
  alt: string
  title?: string
  location?: string
  camera?: string
  lens?: string
  film?: string
  iso?: number
  shutter?: string
  aperture?: string
  // ISO date, as precise as known: '2026', '2026-10' or '2026-10-09'.
  date?: string
}

// Olympus Pen EE-3: half-frame, fixed 28mm f/3.5 and automatic exposure, so
// there's no per-shot shutter or aperture.
const PEN_EE3 = {
  camera: 'Olympus Pen EE-3',
  lens: 'D.Zuiko 28mm f/3.5',
  film: 'Kodak Portra 400',
  location: 'Tokyo, Japan',
}

export const PHOTOS: Photo[] = [
  {
    id: '000032100048',
    src: '/images/film/tokyo-000032100048.jpg',
    width: 1463,
    height: 2075,
    alt: 'Tokyo, on Portra 400.',
    date: '2026-10-09',
    ...PEN_EE3,
  },
  {
    id: '000032100062',
    src: '/images/film/tokyo-000032100062.jpg',
    width: 1463,
    height: 2075,
    alt: 'Tokyo, on Portra 400.',
    date: '2026-10-09',
    ...PEN_EE3,
  },
]
