'use client'
import { useEffect, useRef } from 'react'

import { useUiHidden } from '@/lib/hide-ui'

import { mountGarden } from './mount'

import './garden.css'

type GardenHomeProps = {
  /** The bio and links laid over the meadow. Mark the bio block `.bio`. */
  children: React.ReactNode
}

// The home page's first screen: the meadow behind the top bar, with the bio
// over its ground (design/circadian-meadow, "Site pages"). Hide text, in the
// site menu, fades the text away to play in the meadow alone.
export function GardenHome({ children }: GardenHomeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const hidden = useUiHidden()

  useEffect(() => {
    const canvas = canvasRef.current
    const root = rootRef.current
    if (!canvas || !root) return
    const mono = getComputedStyle(document.documentElement)
      .getPropertyValue('--font-geist-mono')
      .trim()
    return mountGarden({
      canvas,
      root,
      font: mono || 'ui-monospace, Menlo, monospace',
    })
  }, [])

  return (
    <div ref={rootRef} className="garden-home">
      <canvas ref={canvasRef} className="garden-canvas" aria-hidden="true" />
      {/* Safari tints its bars from fixed elements at the window's edges. */}
      <div className="garden-tint garden-tint-top" aria-hidden="true" />
      <div className="garden-tint garden-tint-bottom" aria-hidden="true" />
      <div className="garden-hero">
        <div className="garden-text" inert={hidden}>
          {children}
        </div>
      </div>
    </div>
  )
}
