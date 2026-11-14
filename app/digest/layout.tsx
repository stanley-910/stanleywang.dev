import type { Metadata } from 'next'

import './digest.css'

export const metadata: Metadata = {
  title: 'Digest',
  robots: { index: false, follow: false },
}

export default function DigestLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="digest">{children}</div>
}
