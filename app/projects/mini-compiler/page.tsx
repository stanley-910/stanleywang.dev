import AnimatedCompiler from '../mini-c-prototype/animated'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mini Compiler — Stanley Wang',
  description:
    'A compiler for a C-like language, from parsing and type checking to MIPS and register allocation. Try out a compiler I coded from scratch.',
}

// The walkthrough itself: the real compiler, run in the browser and
// animated phase by phase (mini-c-prototype/).
export default function MiniCompilerPage() {
  return <AnimatedCompiler />
}
