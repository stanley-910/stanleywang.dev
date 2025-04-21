'use client'
import { lazy, Suspense, useMemo } from 'react';
import { usePathname } from 'next/navigation';

const ArtPlum = lazy(() => import('./ArtPlum'));
const ArtCircuit = lazy(() => import('./ArtCircuit'));

export type BackgroundArtProps = {
  type?: 'dots' | 'plum' | 'circuit' | 'random';
};

export function BackgroundArt({ type = 'plum' }: BackgroundArtProps) {
  const pathname = usePathname();
  
  // Don't render background art on writing pages
  if (pathname?.startsWith('/writing')) {
    return null;
  }

  // Memoize the art type selection to prevent recalculation on re-renders
  const artType = useMemo(() => {
    if (type === 'random') {
      // Use a more stable random selection based on pathname
      const hash = pathname?.split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
      }, 0) || 0;
      return ['plum', 'circuit'][Math.abs(hash) % 2];
    }
    return type;
  }, [type, pathname]);

  // Wrap the art component in a fixed position container to prevent reflow
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <div className="absolute inset-0 w-full h-full">
        <Suspense fallback={null}>
          {artType === 'plum' ? <ArtPlum /> : <ArtCircuit />}
        </Suspense>
      </div>
    </div>
  );
}