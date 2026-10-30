'use client'
import { useState } from 'react'

import { Photo } from '@/components/ui/photo'
import { PhotoViewer } from '@/components/ui/photo-viewer'

import type { Photo as PhotoData } from './photos'

/** Most photos on a row, so the grid stays a page to scroll, not a wall. */
const PER_ROW = 3

export function Gallery({ photos }: { photos: PhotoData[] }) {
  const [viewing, setViewing] = useState<number | null>(null)
  const rows: PhotoData[][] = []
  for (let k = 0; k < photos.length; k += PER_ROW)
    rows.push(photos.slice(k, k + PER_ROW))

  return (
    <>
      <div className="film-grid">
        {rows.map((row, r) => (
          <div key={r} className="film-row">
            {row.map((photo, k) => (
              <div
                key={photo.id}
                className="film-item"
                // Width grows with the square root of the shape, so every
                // photo covers about the same area: landscapes run wider,
                // portraits taller.
                style={
                  {
                    '--shape': Math.sqrt(photo.width / photo.height),
                  } as React.CSSProperties
                }
              >
                <Photo
                  photo={photo}
                  onOpen={() => setViewing(r * PER_ROW + k)}
                />
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
