import { notFound } from 'next/navigation'

import AnimatedCompiler from './animated'

export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <AnimatedCompiler />
}
