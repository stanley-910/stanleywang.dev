import { ProjectPreview } from '@/components/ui/project-preview'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mini Compiler — Stanley Wang',
  description:
    'A compiler for a C-like language, from parsing and type checking to MIPS and register allocation. Walkthrough in progress.',
}

export default function MiniCompilerPage() {
  return (
    <ProjectPreview
      title="Mini Compiler"
      description="A compiler written in Java that translates a C-like language into MIPS assembly."
    >
      <p>
        The pipeline covers lexical analysis, parsing, name resolution, type
        checking, and code generation. A graph-colouring register allocator uses
        liveness analysis to assign registers and spill values when needed.
      </p>
      <p>
        I’m working on a walkthrough of how a small program moves through those
        stages. For now, this is just a brief introduction.
      </p>
    </ProjectPreview>
  )
}
