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
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      title={isLocked ? 'Unlock buzzer (Space)' : 'Lock buzzer (Space)'}
      aria-label={isLocked ? 'Buzzer locked — click to unlock' : 'Buzzer unlocked — click to lock'}
      className="flex items-center gap-3 px-5 py-3 rounded-xl font-semibold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        minHeight: 48,
        border: '2px solid',
        borderColor: isLocked ? 'var(--color-red)' : 'var(--color-green)',
        background: isLocked ? 'var(--color-red)11' : 'var(--color-green)11',
        color: isLocked ? 'var(--color-red)' : 'var(--color-green)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span style={{ fontSize: 20 }}>{isLocked ? '🔒' : '🔓'}</span>
      <span>{isLocked ? 'Buzzer Locked' : 'Buzzer Open'}</span>
    </button>
  )
}

// Re-export so callers can import from one place
export { BuzzerLockButton as default }
