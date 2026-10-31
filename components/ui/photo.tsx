'use client'
import Image from 'next/image'
import { useId, useState } from 'react'

import type { Photo as PhotoData } from '@/app/photos/photos'

import './photo.css'

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')

// '2026-10-09' → 'Oct 9, 2026'; '2026-10' → 'Oct 2026'; '2026' → '2026'.
function formatDate(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  if (!m) return String(y)
  if (!d) return `${MONTHS[m - 1]} ${y}`
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

// The film stock without its maker, for the pill: 'Kodak Portra 400' →
// 'Portra 400'.
function shortFilm(film: string) {
  return film.replace(/^(Kodak|Fujifilm|Fuji|Ilford|Cinestill)\s+/i, '')
}

// What a photo's caption says: its name (the title, or the place), the film
// and year beside it, and every detail it has, for the pill and the viewer.
export function describe(photo: PhotoData) {
  const name = photo.title ?? photo.location
  const year = photo.date?.slice(0, 4)
  const brief = [photo.film && shortFilm(photo.film), year].filter(
    (b): b is string => Boolean(b),
  )
  const details: [string, string | undefined][] = [
    ['Place', photo.title ? photo.location : undefined],
    ['Date', photo.date && formatDate(photo.date)],
    ['Camera', photo.camera],
    ['Lens', photo.lens],
    ['Film', photo.film],
    ['ISO', photo.iso && !photo.film ? String(photo.iso) : undefined],
    ['Shutter', photo.shutter],
    ['Aperture', photo.aperture],
  ]
  const known = details.filter((d): d is [string, string] => Boolean(d[1]))
  return { name, brief, known }
}

// A photo with its caption pill in the bottom-left corner
// (design/circadian-meadow/components/PhotoCaption). The pill shows the
// title (or the place) with the film and year; opening it lists every
// detail the photo has. Pressing the photo itself opens it in the viewer.
// The caption waits for the photo, and the two fade in together.
export function Photo({
  photo,
  onOpen,
}: {
  photo: PhotoData
  onOpen?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(!photo.src)
  const id = useId()
  const { name, brief, known } = describe(photo)

  return (
    <figure
      className="photo"
      data-loaded={loaded || undefined}
      style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
    >
      {photo.src ? (
        <Image
          src={photo.src}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          sizes="(min-width: 1024px) 27rem, (min-width: 640px) 50vw, 100vw"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      ) : (
        <div className="photo-pending" role="img" aria-label={photo.alt} />
      )}
      {onOpen && (
        <button
          type="button"
          className="photo-open"
          aria-label={`View ${photo.alt}`}
          onClick={onOpen}
        />
      )}
      {(name || brief.length > 0) && (
        <figcaption className="photo-caption" data-open={open || undefined}>
          {known.length > 0 && (
            <dl id={id} className="photo-details" hidden={!open}>
              {known.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <button
            type="button"
            className="photo-pill"
            aria-expanded={known.length > 0 ? open : undefined}
            aria-controls={known.length > 0 ? id : undefined}
            disabled={known.length === 0}
            onClick={() => setOpen((o) => !o)}
          >
            {name && <span className="photo-name">{name}</span>}
            {brief.map((b) => (
              <span key={b} className="photo-brief">
                {b}
              </span>
            ))}
          </button>
        </figcaption>
      )}
    </figure>
  )
}
