'use client'
import { useEffect, useRef } from 'react';

export default function ArtCircuit() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    
    // Constants
    const r180 = Math.PI;
    const r90 = Math.PI / 2;
    const color = '#88888815';
    const MIN_BRANCH = 10;
    const len = 20;
    
    // Initialize canvas with proper DPI
    function initCanvas(width = window.innerWidth, height = window.innerHeight) {
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = dpr * width;
      canvas.height = dpr * height;
      ctx.scale(dpr, dpr);
    }

    // Convert polar coordinates to cartesian
    function polar2cart(x = 0, y = 0, r = 0, theta = 0) {
      const dx = r * Math.cos(theta);
      const dy = r * Math.sin(theta);
      return [x + dx, y + dy];
    }

    let steps: Function[] = [];
    let possibleSteps: Function[] = [];
    let prevSteps: Function[] = [];
    let stopped = false;

    // Draw a circuit branch
    const step = (x: number, y: number, rad: number, counter: { value: number } = { value: 0 }) => {
      // Snap to 90-degree angles for circuit-like appearance
      const snappedRad = Math.round(rad / r90) * r90;
      const length = len * (Math.random() > 0.5 ? 2 : 1); // Longer segments for circuit look
      counter.value += 1;

      const [nx, ny] = polar2cart(x, y, length, snappedRad);

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.stroke();

      // Out of bounds check
      if (nx < -100 || nx > canvas.width + 100 || ny < -100 || ny > canvas.height + 100)
        return;

      const rate = counter.value <= MIN_BRANCH ? 0.8 : 0.5;

      // Branch with 90-degree turns
      if (Math.random() < rate)
        steps.push(() => step(nx, ny, snappedRad + r90, counter));
      if (Math.random() < rate)
        steps.push(() => step(nx, ny, snappedRad - r90, counter));
    };

    // Start the animation
    function start() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 1;
      ctx.strokeStyle = color;
      prevSteps = [];
      
      // Start from corners and edges for a circuit-board look
      steps = [
        () => step(0, 0, 0),                    // Top-left
        () => step(canvas.width/2, 0, r90),       // Top-right
        () => step(0, canvas.height/2, -r90),     // Bottom-left
        () => step(canvas.width/2, canvas.height/2, r180), // Bottom-right
        // Edges
        // () => step((canvas.width)/2.4, 0, r90),     // Top middle
        // () => step(canvas.width/2.4, canvas.height/2, -r90), // Bottom middle
        // () => step(0, canvas.height/2, -r90),      // Left middle
        // () => step(canvas.width, canvas.height/2, r180), // Right middle
        // Corners
        // () => step(0, 0, 0),                    // Top-left
        // () => step(canvas.width, 0, r90),       // Top-right
        // () => step(0, canvas.height, -r90),     // Bottom-left
        // () => step(canvas.width, canvas.height, r180), // Bottom-right
        // Edges
        // () => step(canvas.width/2, 0, r90),     // Top middle
        // () => step(canvas.width/2, canvas.height, -r90), // Bottom middle
        // () => step(0, canvas.height/2, 0),      // Left middle
        // () => step(canvas.width, canvas.height/2, r180), // Right middle
      ];
      // Randomly select a single starting point for the circuit
      // steps = [possibleSteps[Math.floor(Math.random() * possibleSteps.length)]];
      // steps = possibleSteps.slice(0, Math.floor(Math.random() * possibleSteps.length));
      
      stopped = false;
      frame();
    }

    let lastTime = performance.now();
    const interval = 1000 / 40; // 40fps

    // Animation frame
    function frame() {
      if (performance.now() - lastTime < interval) {
        if (!stopped) requestAnimationFrame(frame);
        return;
      }

      prevSteps = steps;
      steps = [];
      lastTime = performance.now();

      if (!prevSteps.length) {
        stopped = true;
        return;
      }

      // Execute steps from previous frame
      prevSteps.forEach((i) => {
        if (Math.random() < 0.5)
          steps.push(i);
        else
          i();
      });

      if (!stopped) requestAnimationFrame(frame);
    }

    // Initialize and start
    initCanvas();
    start();

    // Handle resize
    const handleResize = () => {
      initCanvas();
      start();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      stopped = true;
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