import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Music — Stanley Wang',
}

export default function MusicPage() {
  return (
    <section>
      <h1 className="sr-only">Music</h1>
      <p className="page-soon">soon</p>
    </section>
  )
}
