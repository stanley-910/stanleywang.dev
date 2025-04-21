'use client'
import { lazy, Suspense, memo } from 'react';
import { usePathname } from 'next/navigation';

const ArtPlum = lazy(() => import('./ArtPlum'));
const ArtCircuit = lazy(() => import('./ArtCircuit'));

export type BackgroundArtProps = {
  type?: 'dots' | 'plum' | 'circuit' | 'random';
};

// Memoize the component to prevent unnecessary re-renders
export const BackgroundArt = memo(function BackgroundArt({ type = 'plum' }: BackgroundArtProps) {
  // Get the current pathname
  const pathname = usePathname();
  
  // Don't render background art on writing pages
  if (pathname?.startsWith('/writing')) {
    return null;
  }

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
}); 