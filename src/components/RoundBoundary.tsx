import { useEffect, useState } from 'react'

interface RoundBoundaryProps {
  roundName: string
  roundIdx: number
  onDone: () => void
}

const DISPLAY_MS = 1600

/**
 * Full-screen overlay shown briefly when navigation crosses a round boundary.
 * Auto-dismisses after DISPLAY_MS. Parent should unmount it after onDone fires.
 */
export function RoundBoundary({ roundName, roundIdx, onDone }: RoundBoundaryProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      onDone()
    }, DISPLAY_MS)
    return () => clearTimeout(t)
  }, [onDone])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4"
      style={{
        background: 'rgba(26,22,16,0.85)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: 'var(--color-gold)' }}
      >
        Round {roundIdx + 1}
      </p>
      <h2
        className="text-4xl font-black text-center px-8"
        style={{
          fontFamily: 'Playfair Display, serif',
          color: 'var(--color-cream)',
        }}
      >
        {roundName}
      </h2>
    </div>
  )
}
