import { useEffect, useState } from 'react'
import { AlarmClock } from 'lucide-react'
import { Icon } from '@/components/ui'

interface TimerExpiredOverlayProps {
  label: string
  onDismiss: () => void
  /** Auto-dismiss after this many ms. Default 5000. */
  autoDismissMs?: number
}

/**
 * Fullscreen overlay shown when a timer hits zero.
 * Auto-dismisses after autoDismissMs or on click/keypress.
 */
export function TimerExpiredOverlay({
  label,
  onDismiss,
  autoDismissMs = 5000,
}: TimerExpiredOverlayProps) {
  const [progress, setProgress] = useState(1)

  useEffect(() => {
    const start = performance.now()
    let rafId: number

    function tick(now: number) {
      const elapsed = now - start
      const p = Math.max(0, 1 - elapsed / autoDismissMs)
      setProgress(p)
      if (p <= 0) {
        onDismiss()
        return
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [autoDismissMs, onDismiss])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  const circumference = 2 * Math.PI * 20

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 cursor-pointer"
      style={{ background: 'rgba(0,0,0,0.82)' }}
      onClick={onDismiss}
    >
      {/* Pulsing ring */}
      <div className="relative flex items-center justify-center">
        <svg width="120" height="120" viewBox="0 0 48 48">
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            strokeWidth="3"
            style={{ stroke: 'rgba(192,57,43,0.3)' }}
          />
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            style={{ stroke: 'var(--color-red)', transition: 'stroke-dashoffset 0.1s linear' }}
            transform="rotate(-90 24 24)"
          />
        </svg>
        <span className="absolute flex items-center justify-center" style={{ color: '#fff' }}>
          <Icon icon={AlarmClock} size="md" aria-hidden={false} aria-label="alarm" />
        </span>
      </div>

      {/* Message */}
      <div className="text-center px-6">
        <p
          className="text-4xl font-black mb-2"
          style={{ fontFamily: 'Playfair Display, serif', color: '#fff' }}
        >
          Time's up!
        </p>
        {label && label !== 'Timer' && (
          <p className="text-lg" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {label}
          </p>
        )}
      </div>

      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Click or press any key to dismiss
      </p>
    </div>
  )
}
