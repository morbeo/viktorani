import React, { useCallback, useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { X, Info, AlertTriangle, AlertCircle } from 'lucide-react'
import { Icon } from './Icon'
import { ToastContext } from './toastContext'
import type { Toast, ToastOptions, ToastVariant } from './toastContext'

// Computed once at module load -- safe to use during render
const PREFERS_REDUCED_MOTION =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((message: string, options: ToastOptions = {}): string => {
    const id = crypto.randomUUID()
    const toast: Toast = {
      id,
      message,
      variant: options.variant ?? 'info',
      durationMs: options.durationMs ?? 5000,
      icon: options.icon,
    }
    setToasts(prev => [...prev, toast])
    return id
  }, [])

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastStack toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

// ── Stack ─────────────────────────────────────────────────────────────────────

function ToastStack({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      style={{ maxWidth: '360px', width: 'calc(100vw - 2rem)' }}
    >
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

// ── Item ──────────────────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, { border: string; iconColor: string }> = {
  info: { border: 'var(--color-gold)', iconColor: 'var(--color-gold)' },
  warning: { border: 'var(--color-amber, #f59e0b)', iconColor: 'var(--color-amber, #f59e0b)' },
  error: { border: 'var(--color-red)', iconColor: 'var(--color-red)' },
}

const VARIANT_ICONS: Record<ToastVariant, LucideIcon> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const reduced = PREFERS_REDUCED_MOTION

  // One-frame delay so the initial hidden state paints before the enter transition
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const dismiss = useCallback(() => {
    if (reduced) {
      onRemove(toast.id)
      return
    }
    setLeaving(true)
    setTimeout(() => onRemove(toast.id), 200)
  }, [onRemove, toast.id, reduced])

  useEffect(() => {
    if (toast.durationMs === 0) return
    const timer = setTimeout(dismiss, toast.durationMs)
    return () => clearTimeout(timer)
  }, [toast.durationMs, dismiss])

  const styles = VARIANT_STYLES[toast.variant]
  const DefaultIcon = VARIANT_ICONS[toast.variant]
  const opacity = reduced ? 1 : visible && !leaving ? 1 : 0
  const translateY = reduced ? '0px' : visible && !leaving ? '0px' : '-8px'

  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      className="pointer-events-auto flex items-start gap-3 rounded-lg px-3 py-3 shadow-lg border"
      style={{
        background: 'var(--color-surface)',
        borderColor: styles.border,
        borderLeftWidth: '3px',
        opacity,
        transform: `translateY(${translateY})`,
        transition: reduced ? 'none' : 'opacity 0.18s ease, transform 0.18s ease',
        boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
      }}
    >
      <span className="mt-0.5 shrink-0" style={{ color: styles.iconColor }}>
        {toast.icon ?? <Icon icon={DefaultIcon} size="sm" />}
      </span>
      <span className="flex-1 text-sm leading-snug" style={{ color: 'var(--color-ink)' }}>
        {toast.message}
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss notification"
        className="shrink-0 rounded transition-colors hover:bg-black/10 p-0.5 -mt-0.5 -mr-0.5"
        style={{ color: 'var(--color-muted)' }}
      >
        <Icon icon={X} size="sm" />
      </button>
    </div>
  )
}
