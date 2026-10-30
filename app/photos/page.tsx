import { Gallery } from './gallery'
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
      <Gallery photos={PHOTOS} />
    </section>
  )
}
