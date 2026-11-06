'use client'
import { useEffect, useRef } from 'react'

import { useUiHidden } from '@/lib/hide-ui'
import { askLofi, isLofi, useLofi } from '@/lib/lofi'

import { playIntro } from './intro'
import { LofiPrompt } from './lofi-prompt'
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
  const lofi = useLofi()

  useEffect(() => {
    const canvas = canvasRef.current
    const root = rootRef.current
    if (!canvas || !root) return
    // Lo-fi (lib/lofi.ts): no scene and no loop. Home takes the hour's page theme like every other
    // page (lib/circadian.ts), so the bar and the bio keep the site's own colours, day or night.
    // Read live rather than from `lofi`, which is still the server's `false` on the hydrating pass,
    // so a saved lo-fi never starts the meadow's workers for a frame.
    if (isLofi()) {
      playIntro()
      return
    }
    const mono = getComputedStyle(document.documentElement)
      .getPropertyValue('--font-geist-mono')
      .trim()
    return mountGarden({
      canvas,
      root,
      font: mono || 'ui-monospace, Menlo, monospace',
      onLag: askLofi,
    })
  }, [lofi])

  return (
    <div ref={rootRef} className="garden-home" data-lofi={lofi || undefined}>
      {/* A fresh canvas on each switch, so lo-fi doesn't keep the scene's last frame. */}
      <canvas
        key={lofi ? 'lofi' : 'scene'}
        ref={canvasRef}
        className="garden-canvas"
        aria-hidden="true"
      />
      {/* Safari tints its bars from fixed elements at the window's edges. */}
      <div className="garden-tint garden-tint-top" aria-hidden="true" />
      <div className="garden-tint garden-tint-bottom" aria-hidden="true" />
      <div className="garden-hero">
        <div className="garden-text" inert={hidden}>
          {children}
        </div>
      </div>
      <LofiPrompt />
    </div>
  )
}
