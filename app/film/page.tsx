import { Photo } from '@/components/ui/photo'

import { PHOTOS } from './photos'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Film — Stanley Wang',
  description: 'Photographs on film.',
}

export default function FilmPage() {
  return (
    <section className="film">
      <h1 className="sr-only">Film</h1>
      <div className="film-grid">
        {PHOTOS.map((photo) => (
          <Photo key={photo.id} photo={photo} />
        ))}
      </div>
    </section>
  )
}
