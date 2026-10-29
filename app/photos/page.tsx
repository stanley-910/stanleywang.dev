import { Photo } from '@/components/ui/photo'

import { PHOTOS } from './photos'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Photos — Stanley Wang',
  description: 'Photographs.',
}

export default function PhotosPage() {
  return (
    <section className="film">
      <h1 className="sr-only">Photos</h1>
      <div className="film-grid">
        {PHOTOS.map((photo) => (
          <div
            key={photo.id}
            className="film-item"
            // Width grows with the square root of the shape, so every photo
            // covers about the same area: landscapes run wider, portraits
            // taller.
            style={
              {
                '--shape': Math.sqrt(photo.width / photo.height),
              } as React.CSSProperties
            }
          >
            <Photo photo={photo} />
          </div>
        ))}
      </div>
    </section>
  )
}
