import { useContext } from 'react'
import { createElement } from 'react'
import { AlarmClock } from 'lucide-react'
import { Icon } from './Icon'
import { ToastContext } from './toastContext'
import type { ToastContextValue } from './toastContext'

export type { ToastContextValue }
export type { Toast, ToastVariant, ToastOptions } from './toastContext'

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Fires a timer-expired warning toast.
 * Kept here (not in Toast.tsx) so Toast.tsx remains a component-only file,
 * satisfying react-refresh/only-export-components.
 */
export function timerExpiredToast(addToast: ToastContextValue['addToast'], label: string): void {
  addToast(label && label !== 'Timer' ? `Time's up! — ${label}` : "Time's up!", {
    variant: 'warning',
    durationMs: 8000,
    icon: createElement(Icon, { icon: AlarmClock, size: 'sm' }),
  })
}
