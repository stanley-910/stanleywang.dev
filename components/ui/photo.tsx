'use client'
import Image from 'next/image'
import { useId, useState } from 'react'

import type { Photo as PhotoData } from '@/app/film/photos'

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

// A photo with its caption pill in the bottom-left corner
// (design/circadian-meadow/components/PhotoCaption). The pill shows the
// title (or the place) with the film and year; opening it lists every
// detail the photo has.
export function Photo({ photo }: { photo: PhotoData }) {
  const [open, setOpen] = useState(false)
  const id = useId()

  const name = photo.title ?? photo.location
  const year = photo.date?.slice(0, 4)
  const brief = [photo.film && shortFilm(photo.film), year].filter(Boolean)

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

  return (
    <figure
      className="photo"
      style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
    >
      {photo.src ? (
        <Image
          src={photo.src}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          sizes="(min-width: 640px) 18rem, 100vw"
        />
      ) : (
        <div className="photo-pending" role="img" aria-label={photo.alt} />
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
