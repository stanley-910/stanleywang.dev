'use client'
import Image, { getImageProps } from 'next/image'
import { useEffect, useRef, useState } from 'react'

import { describe } from './photo'

import type { Photo as PhotoData } from '@/app/photos/photos'

import './photo-viewer.css'

const SIZES = '(min-width: 900px) calc(100vw - 20rem), 100vw'
/** Finger travel, in px, that turns a drag into a step to the next photo. */
const SWIPE = 60

// One photo at a time, as large as the window allows, with every detail it
// has beside it (below, on a phone). Prev and next buttons, the arrow keys
// and a sideways swipe step through the photos, wrapping at the ends; Escape,
// the close button or a press outside the photo closes it.
export function PhotoViewer({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: PhotoData[]
  index: number | null
  onIndex: React.Dispatch<React.SetStateAction<number | null>>
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; id: number } | null>(null)
  const [loaded, setLoaded] = useState<string | null>(null)
  const open = index !== null
  const n = photos.length
  const photo = open ? photos[index] : null
  // From the latest index, so two quick presses take two steps.
  const step = (by: number) =>
    onIndex((i) => (i === null ? i : (i + by + n) % n))

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    // The dialog itself takes focus, not its first button, so no ring
    // shows on a button nobody pressed; the keys still work from it.
    if (open && !d.open) {
      d.showModal()
      d.focus()
    }
    if (!open && d.open) d.close()
  }, [open])

  // Fetch the photos either side, so stepping shows them at once.
  useEffect(() => {
    if (index === null) return
    for (const k of [index + 1, index - 1]) {
      const p = photos[(k + n) % n]
      if (!p.src) continue
      const { props } = getImageProps({
        src: p.src,
        alt: '',
        width: p.width,
        height: p.height,
        sizes: SIZES,
      })
      const img = new window.Image()
      img.sizes = SIZES
      if (props.srcSet) img.srcset = props.srcSet
      img.src = props.src
    }
  }, [index, n, photos])

  // Every way out goes through the page's state, which closes the dialog:
  // its own close event didn't reliably fire, and the page kept a photo open.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowRight') step(1)
    else if (e.key === 'ArrowLeft') step(-1)
    else return
    e.preventDefault()
  }

  const slide = (dx: number, settle = false) => {
    const el = stage.current
    if (!el) return
    el.style.transition = settle ? '' : 'none'
    el.style.transform = dx ? `translateX(${dx}px)` : ''
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return
    drag.current = { x: e.clientX, id: e.pointerId }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (drag.current?.id !== e.pointerId) return
    slide(e.clientX - drag.current.x)
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (drag.current?.id !== e.pointerId) return
    const dx = e.clientX - drag.current.x
    drag.current = null
    slide(0, true)
    if (Math.abs(dx) > SWIPE) step(dx < 0 ? 1 : -1)
  }

  const { name, known } = photo
    ? describe(photo)
    : { name: undefined, known: [] }

  return (
    <dialog
      ref={dialog}
      className="viewer"
      tabIndex={-1}
      aria-label={photo ? (name ?? photo.alt) : 'Photo'}
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      // A press on the backdrop around the photo, not on it or the details.
      onClick={(e) => {
        if (e.target === e.currentTarget || e.target === stage.current)
          onClose()
      }}
    >
      {photo && (
        <>
          <button type="button" className="viewer-close" onClick={onClose}>
            close
          </button>
          <div
            ref={stage}
            className="viewer-stage"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {photo.src ? (
              <Image
                key={photo.id}
                src={photo.src}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                sizes={SIZES}
                draggable={false}
                data-loaded={loaded === photo.id || undefined}
                onLoad={() => setLoaded(photo.id)}
                onError={() => setLoaded(photo.id)}
              />
            ) : (
              <div
                className="photo-pending viewer-pending"
                role="img"
                aria-label={photo.alt}
                style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
              />
            )}
          </div>
          <div className="viewer-info">
            {name && <p className="viewer-name">{name}</p>}
            {known.length > 0 && (
              <dl className="viewer-details">
                {known.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <div className="viewer-bar">
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => step(-1)}
            >
              prev
            </button>
            <span className="viewer-count" aria-live="polite">
              {(index ?? 0) + 1} / {n}
            </span>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => step(1)}
            >
              next
            </button>
          </div>
        </>
      )}
    </dialog>
  )
}
