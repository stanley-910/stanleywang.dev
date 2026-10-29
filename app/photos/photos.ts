// Photos on /photos. Every field but the size is optional: a caption shows
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
    id: 'XT302381',
    src: '/images/film/yosemite-XT302381.jpg',
    width: 4160,
    height: 6240,
    alt: 'Yosemite, CA.',
    location: 'Yosemite, CA',
    camera: 'Fujifilm X-T30 III',
    // Settings copied from the Zhangjiajie frame; the original kept no EXIF. Placeholders.
    lens: 'XF 23mm f/2.8 R WR',
    iso: 400,
    shutter: '1/60',
    aperture: 'f/4',
  },
  {
    id: 'XT304576',
    src: '/images/film/zhangjiajie-XT304576.jpg',
    width: 6240,
    height: 4160,
    alt: 'Zhangjiajie, China.',
    location: 'Zhangjiajie, China',
    camera: 'Fujifilm X-T30 III',
    lens: 'XF 23mm f/2.8 R WR',
    iso: 400,
    shutter: '1/60',
    aperture: 'f/4',
    date: '2026-09-27',
  },
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
