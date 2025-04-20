// Credit to antfu for this cool component
// MIT License

// Copyright (c) 2020-2021 Anthony Fu

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.


'use client'
import { useEffect, useRef } from 'react';

export default function ArtPlum() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    
    const r180 = Math.PI;
    const r90 = Math.PI / 2;
    const r15 = Math.PI / 12;
    // const color = '#88888825';
    // const color = 'rgba(0,28,240, 0.1)';
    const color = 'rgba(200,70,70, 0.1)';
    
    const MIN_BRANCH = 30;
    const len = 6;
    let stopped = false;
    
    // Initialize canvas with proper DPI
    function initCanvas(width = window.innerWidth, height = window.innerHeight) {
      const dpr = window.devicePixelRatio || 1;
      
      // Important: Set canvas dimensions BEFORE scaling
      canvas.width = dpr * width;
      canvas.height = dpr * height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      
      // Clear and reset scale on resize
      ctx.scale(dpr, dpr);
      
      return { width, height }; // Return actual dimensions for use in drawing
    }

    function polar2cart(x = 0, y = 0, r = 0, theta = 0) {
      const dx = r * Math.cos(theta);
      const dy = r * Math.sin(theta);
      return [x + dx, y + dy];
    }

    const randomMiddle = () => Math.random() * 0.6 + 0.2;

    let steps: Function[] = [];
    let prevSteps: Function[] = [];
    let animationFrame: number;

    const step = (x: number, y: number, rad: number, counter: { value: number } = { value: 0 }) => {
      const length = Math.random() * len;
      counter.value += 1;

      const [nx, ny] = polar2cart(x, y, length, rad);

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.stroke();

      const rad1 = rad + Math.random() * r15;
      const rad2 = rad - Math.random() * r15;

      // Use actual canvas dimensions for bounds checking
      if (nx < -100 || nx > canvas.width / window.devicePixelRatio + 100 || 
          ny < -100 || ny > canvas.height / window.devicePixelRatio + 100)
        return;

      const rate = counter.value <= MIN_BRANCH ? 0.8 : 0.5;

      if (Math.random() < rate)
        steps.push(() => step(nx, ny, rad1, counter));
      if (Math.random() < rate)
        steps.push(() => step(nx, ny, rad2, counter));
    };

    function start() {
      // Cancel any existing animation frame
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }

      // Get actual dimensions after DPI scaling
      const { width, height } = initCanvas();
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 1;
      ctx.strokeStyle = color;
      
      prevSteps = [];
      steps = [
        // All four starting points are necessary
        () => step(randomMiddle() * width, -5, r90),           // top
        () => step(randomMiddle() * width, height + 5, -r90),  // bottom
        () => step(-5, randomMiddle() * height, 0),            // left
        () => step(width + 5, randomMiddle() * height, r180),  // right
      ];

      // Only use top and bottom branches for narrow screens
      if (width < 500) {
        steps = steps.slice(0, 2);
      }
      
      stopped = false;
      frame();
    }

    let lastTime = performance.now();
    const interval = 1000 / 40;

    function frame() {
      if (stopped) return;

      if (performance.now() - lastTime < interval) {
        animationFrame = requestAnimationFrame(frame);
        return;
      }

      prevSteps = steps;
      steps = [];
      lastTime = performance.now();

      if (!prevSteps.length) {
        stopped = true;
        return;
      }

      prevSteps.forEach((i) => {
        if (Math.random() < 0.5)
          steps.push(i);
        else
          i();
      });

      animationFrame = requestAnimationFrame(frame);
    }

    // Initial setup
    start();

    // Debounced resize handler
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(start, 200);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      stopped = true;
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: -1,
        pointerEvents: 'none',
        maskImage: 'radial-gradient(circle, transparent, black)',
        WebkitMaskImage: 'radial-gradient(circle, transparent, black)',
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}