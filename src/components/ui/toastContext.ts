import { createContext } from 'react'
import type React from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastVariant = 'info' | 'warning' | 'error'

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
  /** Auto-dismiss after this many ms. Default 5000. Pass 0 to disable. */
  durationMs: number
  /** Optional icon override -- defaults to the variant icon. */
  icon?: React.ReactNode
}

export interface ToastOptions {
  variant?: ToastVariant
  durationMs?: number
  icon?: React.ReactNode
}

export interface ToastContextValue {
  addToast: (message: string, options?: ToastOptions) => string
  removeToast: (id: string) => void
}

// ── Context ───────────────────────────────────────────────────────────────────

export const ToastContext = createContext<ToastContextValue | null>(null)
