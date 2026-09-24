import { notFound } from 'next/navigation'

import AnimatedCompiler from './animated'

export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <>
      {/* TEMP: Figma code-to-canvas capture; remove after capturing */}
      <script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async />
      <AnimatedCompiler />
    </>
  )
}
