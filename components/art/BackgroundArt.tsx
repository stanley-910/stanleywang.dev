'use client'
import { lazy, Suspense } from 'react';

const ArtPlum = lazy(() => import('./ArtPlum'));
const ArtCircuit = lazy(() => import('./ArtCircuit'));

export type BackgroundArtProps = {
  type?: 'dots' | 'plum' | 'circuit' | 'random';
};

export function BackgroundArt({ type = 'plum' }: BackgroundArtProps) {
  const artType = type === 'random' 
    ? ['plum', 'circuit'][Math.floor(Math.random() * 2)]
    : type;

  return (
    <Suspense fallback={null}>
      {artType === 'plum' ? <ArtPlum /> :
       <ArtCircuit />
       }
    </Suspense>
  );
} 