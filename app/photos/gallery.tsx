'use client'
import { useState } from 'react'

import { Photo } from '@/components/ui/photo'
import { PhotoViewer } from '@/components/ui/photo-viewer'

import type { Photo as PhotoData } from './photos'

/** Column counts the grid lays out for: a phone, a tablet, a desktop (shell.css picks one). */
const COLUMNS = [1, 2, 3] as const

/**
 * Deals the photos into columns, each to the shortest so far, in order, so the columns end near
 * each other and the first photos sit along the top. Heights are per unit of width, since every
 * column is as wide as the others.
 */
function deal(photos: PhotoData[], n: number) {
  const cols: number[][] = Array.from({ length: n }, () => [])
  const heights = new Array<number>(n).fill(0)
  photos.forEach((p, i) => {
    const k = heights.indexOf(Math.min(...heights))
    cols[k].push(i)
    heights[k] += p.height / p.width
  })
  return cols
}

// A masonry wall: equal columns, each photo the column's full width at its
// own shape, stacked with an even gap, so the bottoms stagger. Each column
// count is dealt here and the stylesheet shows the one that fits, so the
// layout is set before the page reaches the browser and nothing moves on load.
export function Gallery({ photos }: { photos: PhotoData[] }) {
  const [viewing, setViewing] = useState<number | null>(null)

  return (
    <>
      <div className="film-grid">
        {COLUMNS.map((n) => (
          <div key={n} className="film-cols" data-cols={n}>
            {deal(photos, n).map((col, c) => (
              <div key={c} className="film-col">
                {col.map((i) => (
                  <Photo
                    key={photos[i].id}
                    photo={photos[i]}
                    onOpen={() => setViewing(i)}
                  />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      <PhotoViewer
        photos={photos}
        index={viewing}
        onIndex={setViewing}
        onClose={() => setViewing(null)}
      />
    </>
  )
}
