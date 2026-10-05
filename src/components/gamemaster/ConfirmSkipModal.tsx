import { Modal, Button } from '@/components/ui'

interface ConfirmSkipModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

/**
 * Confirmation modal shown before leaving a question with no ruling yet, when
 * `Game.confirmUnruledNavigation` is on.
 */
export function ConfirmSkipModal({ open, onClose, onConfirm }: ConfirmSkipModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Move on without ruling?">
      <p className="text-sm mb-6" style={{ color: 'var(--color-muted)' }}>
        This question has no ruling yet. Moving on will mark it skipped.
      </p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm}>
          Next question
        </Button>
      </div>
    </Modal>
  )
}
