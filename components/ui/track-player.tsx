'use client'
import { PauseIcon, PlayIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { Track } from '@/app/data'

// Starting one track pauses whichever other one is playing.
const PLAY_EVENT = 'track-player:play'

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function TrackPlayer({ track }: { track: Track }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const waveRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const duration = track.duration
  const progress = Math.min(1, time / duration)

  useEffect(() => {
    const onOtherPlay = (e: Event) => {
      const audio = audioRef.current
      if (audio && (e as CustomEvent).detail !== audio) audio.pause()
    }
    window.addEventListener(PLAY_EVENT, onOtherPlay)
    return () => window.removeEventListener(PLAY_EVENT, onOtherPlay)
  }, [])

  // timeupdate fires a few times a second; follow playback per frame so
  // the fill moves smoothly.
  useEffect(() => {
    if (!playing) return
    let frame = 0
    const tick = () => {
      if (audioRef.current) setTime(audioRef.current.currentTime)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])

  const seek = useCallback(
    (seconds: number) => {
      const t = Math.max(0, Math.min(duration, seconds))
      if (audioRef.current) audioRef.current.currentTime = t
      setTime(t)
    },
    [duration],
  )

  const seekToPointer = (clientX: number) => {
    const wave = waveRef.current
    if (!wave) return
    const r = wave.getBoundingClientRect()
    seek(((clientX - r.left) / r.width) * duration)
  }

  // Sideways trackpad swipes scrub; vertical scrolling still scrolls the
  // page. Needs a non-passive listener to keep the swipe from paging back.
  useEffect(() => {
    const wave = waveRef.current
    if (!wave) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      e.preventDefault()
      const audio = audioRef.current
      seek((audio?.currentTime ?? 0) + e.deltaX * (duration / 600))
    }
    wave.addEventListener('wheel', onWheel, { passive: false })
    return () => wave.removeEventListener('wheel', onWheel)
  }, [duration, seek])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: audio }))
      void audio.play()
    } else audio.pause()
  }

  return (
    <div className="flex items-end gap-3">
      <audio
        ref={audioRef}
        src={track.src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          seek(0)
        }}
      />
      <button
        type="button"
        onClick={toggle}
        className="flex h-7 w-4 shrink-0 items-center justify-center text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
        aria-label={`${playing ? 'Pause' : 'Play'} ${track.title}`}
      >
        {playing ? (
          <PauseIcon className="h-2.5 w-2.5 fill-current" />
        ) : (
          <PlayIcon className="h-2.5 w-2.5 fill-current" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex justify-between font-mono text-xs text-zinc-600 dark:text-zinc-400">
          <span className="truncate">{track.title}</span>
          <span className="tabular-nums">
            {formatTime(time)} / {formatTime(duration)}
          </span>
        </div>
        <div
          ref={waveRef}
          role="slider"
          tabIndex={0}
          aria-label={`${track.title} position`}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          aria-valuetext={formatTime(time)}
          className="flex h-7 cursor-pointer touch-none items-center gap-[2px] text-zinc-900 outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 dark:text-zinc-100"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            seekToPointer(e.clientX)
          }}
          onPointerMove={(e) => {
            if (e.buttons) seekToPointer(e.clientX)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') seek(time - 5)
            else if (e.key === 'ArrowRight') seek(time + 5)
            else if (e.key === ' ' || e.key === 'Enter') toggle()
            else return
            e.preventDefault()
          }}
        >
          {track.peaks.map((peak, i) => (
            <span
              key={i}
              className={`flex-1 rounded-full bg-current transition-opacity duration-150 ${
                (i + 0.5) / track.peaks.length <= progress
                  ? 'opacity-80'
                  : 'opacity-20'
              }`}
              style={{ height: `${Math.round(peak * 100)}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
