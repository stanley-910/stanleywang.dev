import type { FactIcon as Kind } from '@/lib/digest/types'

/** 14px line icons on a 16 grid, drawn in the text's own colour. The set is
 *  closed: where, who it's for, when (design/circadian-meadow/components/Digest). */
const PATHS: Record<Kind, React.ReactNode> = {
  place: (
    <>
      <path d="M8 14.2c2.9-3 4.4-5.3 4.4-7.4A4.4 4.4 0 0 0 3.6 6.800c0 2.1 1.5 4.4 4.4 7.400Z" />
      <circle cx="8" cy="6.7" r="1.5" />
    </>
  ),
  grad: (
    <>
      <path d="M1.5 6.3 8 3.200l6.5 3.100L8 9.400Z" />
      <path d="M4.3 7.800v2.900c1 .9 2.3 1.3 3.7 1.300s2.7-.4 3.7-1.300V7.8" />
      <path d="M14.5 6.300v3.4" />
    </>
  ),
  date: (
    <>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1" />
      <path d="M2.5 6.700h11M5.5 2v2.500M10.5 2v2.5" />
    </>
  ),
}

export function FactIcon({ kind }: { kind: Kind }) {
  return (
    <svg
      className="digest-fact-icon"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[kind]}
    </svg>
  )
}
