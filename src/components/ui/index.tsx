import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from 'react'
import { X, Network, Radio, CircleDot, CircleOff } from 'lucide-react'
import { Icon } from './Icon'
import type { TransportStatus, TransportType } from '@/transport/types'

export { Icon } from './Icon'
export { Steps } from './Steps'
export type { StepConfig } from './Steps'
export { ToastProvider } from './Toast'
// eslint-disable-next-line react-refresh/only-export-components
export { useToast } from './toastUtils'
export type { Toast, ToastVariant, ToastOptions } from './toastContext'
// eslint-disable-next-line react-refresh/only-export-components
export { timerExpiredToast } from './toastUtils'
export type { ToastContextValue } from './toastContext'

// ── Button ────────────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type BtnSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: BtnSize
  children: ReactNode
}

const btnBase =
  'inline-flex items-center justify-center gap-2 font-medium rounded transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'

const btnVariants: Record<BtnVariant, string> = {
  primary: 'text-white',
  secondary: 'border',
  danger: 'text-white',
  ghost: 'hover:bg-black/5',
}

const btnSizes: Record<BtnSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

const btnStyles: Record<BtnVariant, React.CSSProperties> = {
  primary: { background: 'var(--color-ink)', color: 'var(--color-cream)' },
  secondary: {
    borderColor: 'var(--color-border)',
    color: 'var(--color-ink)',
    background: 'transparent',
  },
  danger: { background: 'var(--color-red)', color: '#fff' },
  ghost: { color: 'var(--color-muted)', background: 'transparent' },
}

export function Button({
  variant = 'secondary',
  size = 'md',
  children,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${btnBase} ${btnVariants[variant]} ${btnSizes[size]}`}
      style={{ ...btnStyles[variant], ...style }}
      {...props}
    >
      {children}
    </button>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────

interface BadgeProps {
  children: ReactNode
  color?: string
  style?: React.CSSProperties
}

export function Badge({ children, color, style }: BadgeProps) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        background: color ?? 'var(--color-gold-light)',
        color: 'var(--color-ink)',
        ...style,
      }}
    >
      {children}
    </span>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface CardProps {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}

export function Card({ children, className = '', style }: CardProps) {
  return (
    <div
      className={`rounded-lg border p-5 ${className}`}
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', ...style }}
    >
      {children}
    </div>
  )
}

// ── Input ─────────────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, id, className = '', style, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
          {label}
        </label>
      )}
      <input
        id={id}
        className={`px-3 py-2 rounded border text-sm outline-none transition-all ${className}`}
        style={{
          borderColor: 'var(--color-border)',
          background: 'var(--color-cream)',
          color: 'var(--color-ink)',
          ...style,
        }}
        {...props}
      />
    </div>
  )
}

// ── Textarea ──────────────────────────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export function Textarea({ label, id, className = '', style, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={`px-3 py-2 rounded border text-sm outline-none resize-y transition-all ${className}`}
        style={{
          borderColor: 'var(--color-border)',
          background: 'var(--color-cream)',
          color: 'var(--color-ink)',
          minHeight: 120,
          ...style,
        }}
        {...props}
      />
    </div>
  )
}

// ── Select ────────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
}

export function Select({ label, id, options, className = '', style, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
          {label}
        </label>
      )}
      <select
        id={id}
        className={`px-3 py-2 rounded border text-sm outline-none ${className}`}
        style={{
          borderColor: 'var(--color-border)',
          background: 'var(--color-cream)',
          color: 'var(--color-ink)',
          ...style,
        }}
        {...props}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  maxWidth?: string
}

export function Modal({ open, onClose, title, children, maxWidth = '480px' }: ModalProps) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(26,22,16,0.6)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-xl border shadow-2xl"
        style={{
          maxWidth,
          background: 'var(--color-cream)',
          borderColor: 'var(--color-border)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div
            className="flex items-center justify-between px-6 py-4 border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <h3 className="text-lg font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>
              {title}
            </h3>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex items-center justify-center w-7 h-7 rounded hover:bg-black/5 transition-opacity"
              style={{ color: 'var(--color-muted)' }}
            >
              <Icon icon={X} size="sm" />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function Empty({ icon = '○', message }: { icon?: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="text-4xl opacity-30">{icon}</span>
      <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
        {message}
      </p>
    </div>
  )
}

// ── Transport status pill ─────────────────────────────────────────────────────

const TRANSPORT_ICON: Record<TransportStatus, typeof Network> = {
  connected: CircleDot,
  connecting: CircleDot,
  disconnected: CircleOff,
  idle: CircleOff,
  error: CircleOff,
}

function transportTypeIcon(type: TransportType): typeof Network {
  if (type === 'peer') return Network
  if (type === 'gun') return Radio
  return CircleOff
}

export function TransportPill({ status, type }: { status: TransportStatus; type: TransportType }) {
  const color =
    status === 'connected'
      ? 'var(--color-green)'
      : status === 'connecting'
        ? 'var(--color-gold)'
        : 'var(--color-muted)'

  const label =
    status === 'connected'
      ? type === 'peer'
        ? 'PeerJS'
        : 'Gun.js'
      : status === 'connecting'
        ? 'Connecting…'
        : 'Offline'

  // Show transport type icon when connected, generic status icon otherwise
  const IconComponent = status === 'connected' ? transportTypeIcon(type) : TRANSPORT_ICON[status]

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium mono border"
      style={{ borderColor: color, color }}
    >
      <Icon icon={IconComponent} size="sm" className="shrink-0" />
      {label}
    </span>
  )
}
