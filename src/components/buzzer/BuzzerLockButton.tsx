import { Lock, LockOpen } from 'lucide-react'
import { Icon, useControlSizeStep, pickBySize } from '@/components/ui'

interface BuzzerLockButtonProps {
  isLocked: boolean
  onToggle: () => void
  disabled?: boolean
}

/**
 * Large, keyboard-accessible Lock/Unlock buzzer toggle for the GM panel.
 * Space key is handled by the parent (useKeyNav or local handler).
 */
export function BuzzerLockButton({ isLocked, onToggle, disabled }: BuzzerLockButtonProps) {
  const step = useControlSizeStep()
  const sizeClass = pickBySize(step, [
    'gap-2 px-3 py-1.5 text-sm',
    'gap-3 px-5 py-3 text-base',
    'gap-3 px-6 py-4 text-lg',
  ] as const)
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      title={isLocked ? 'Unlock buzzer (Space)' : 'Lock buzzer (Space)'}
      aria-label={isLocked ? 'Buzzer locked — click to unlock' : 'Buzzer unlocked — click to lock'}
      className={`flex items-center ${sizeClass} rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
      style={{
        minHeight: pickBySize(step, [32, 48, 56] as const),
        border: '2px solid',
        borderColor: isLocked ? 'var(--color-red)' : 'var(--color-green)',
        background: isLocked ? 'var(--color-red)11' : 'var(--color-green)11',
        color: isLocked ? 'var(--color-red)' : 'var(--color-green)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <Icon icon={isLocked ? Lock : LockOpen} size={step < 0 ? 'sm' : 'md'} />
      <span>{isLocked ? 'Buzzer Locked' : 'Buzzer Open'}</span>
    </button>
  )
}

// Re-export so callers can import from one place
export { BuzzerLockButton as default }
