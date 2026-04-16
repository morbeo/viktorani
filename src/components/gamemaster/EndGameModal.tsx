import { Modal, Button } from '@/components/ui'

interface EndGameModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  ending: boolean
}

/**
 * Confirmation modal shown before ending a game session.
 * Ending is irreversible — the game becomes read-only.
 */
export function EndGameModal({ open, onClose, onConfirm, ending }: EndGameModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="End game?">
      <p className="text-sm mb-6" style={{ color: 'var(--color-muted)' }}>
        This will end the session for all players. The game will become read-only — scores and
        buzzer actions will be disabled. This cannot be undone.
      </p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={ending}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={ending}>
          {ending ? 'Ending…' : 'End game'}
        </Button>
      </div>
    </Modal>
  )
}
