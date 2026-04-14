import { useState } from 'react'
import { Modal, Button } from '@/components/ui'
import type { PlayerConflict, MergeChoice } from './qrImport'

interface Props {
  conflict: PlayerConflict | null
  open: boolean
  onApply: (choices: MergeChoice) => void
  onCancel: () => void
}

const DEFAULT_CHOICES: MergeChoice = { name: 'current', labels: 'current' }

export default function PlayerMergeModal({ conflict, open, onApply, onCancel }: Props) {
  const [choices, setChoices] = useState<MergeChoice>(DEFAULT_CHOICES)

  if (!conflict) return null

  const { existing, incoming, diffs } = conflict
  const diffFields = new Set(diffs.map(d => d.field))

  function choose<K extends keyof MergeChoice>(field: K, value: MergeChoice[K]) {
    setChoices(c => ({ ...c, [field]: value }))
  }

  function handleApply() {
    onApply(choices)
    setChoices(DEFAULT_CHOICES)
  }

  function handleCancel() {
    setChoices(DEFAULT_CHOICES)
    onCancel()
  }

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title={`Merge conflict — ${existing.name}`}
      maxWidth="440px"
    >
      <div className="flex flex-col gap-0 -mx-6 -mb-6">
        <p
          className="text-xs px-6 py-3 border-b"
          style={{ color: 'var(--color-muted)', borderColor: 'var(--color-border)' }}
        >
          Incoming QR matches an existing record. Choose which value to keep per field.
        </p>

        {/* Column headers */}
        <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="w-20 shrink-0" />
          <div
            className="flex-1 text-xs font-medium px-3 py-2 border-r"
            style={{
              color: 'var(--color-muted)',
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
            }}
          >
            Current
          </div>
          <div
            className="flex-1 text-xs font-medium px-3 py-2"
            style={{
              color: 'var(--color-green)',
              background: 'color-mix(in srgb, #2d7a46 6%, transparent)',
            }}
          >
            Incoming (QR)
          </div>
        </div>

        {/* Name row */}
        <DiffRow
          label="Name"
          currentValue={existing.name}
          incomingValue={incoming.name}
          hasDiff={diffFields.has('name')}
          choice={choices.name}
          onChoose={v => choose('name', v)}
        />

        {/* Labels row */}
        <DiffRow
          label="Labels"
          currentValue={
            (diffs.find(d => d.field === 'labels')?.current ?? incoming.labels.join(', ')) || '—'
          }
          incomingValue={incoming.labels.join(', ') || '—'}
          hasDiff={diffFields.has('labels')}
          choice={choices.labels}
          onChoose={v => choose('labels', v)}
        />

        {/* Collapsed unchanged fields hint */}
        {diffs.length < 2 && (
          <p
            className="text-xs text-center py-2 border-b italic"
            style={{ color: 'var(--color-muted)', borderColor: 'var(--color-border)' }}
          >
            {2 - diffs.length} unchanged field{2 - diffs.length !== 1 ? 's' : ''} — identical, no
            choice needed
          </p>
        )}

        {/* Footer */}
        <div
          className="flex justify-end gap-2 px-6 py-4"
          style={{ borderTop: '0.5px solid var(--color-border)' }}
        >
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleApply}>
            Apply merge
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Diff row ──────────────────────────────────────────────────────────────────

interface DiffRowProps {
  label: string
  currentValue: string
  incomingValue: string
  hasDiff: boolean
  choice: 'current' | 'incoming'
  onChoose: (v: 'current' | 'incoming') => void
}

function DiffRow({ label, currentValue, incomingValue, hasDiff, choice, onChoose }: DiffRowProps) {
  return (
    <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
      <div
        className="w-20 shrink-0 flex items-center px-3 py-3 text-xs border-r"
        style={{ color: 'var(--color-muted)', borderColor: 'var(--color-border)' }}
      >
        {label}
      </div>

      {/* Current */}
      <div
        className="flex-1 flex items-center gap-2 px-3 py-3 border-r text-xs"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-ink)',
        }}
      >
        {hasDiff && (
          <input
            type="radio"
            name={`merge-${label}`}
            checked={choice === 'current'}
            onChange={() => onChoose('current')}
            aria-label={`Keep current ${label}`}
            className="shrink-0"
          />
        )}
        <span className={hasDiff ? '' : 'opacity-50'}>{currentValue || '—'}</span>
      </div>

      {/* Incoming */}
      <div
        className="flex-1 flex items-center gap-2 px-3 py-3 text-xs"
        style={{
          background: hasDiff ? 'color-mix(in srgb, #2d7a46 6%, transparent)' : 'transparent',
          color: 'var(--color-ink)',
        }}
      >
        {hasDiff && (
          <input
            type="radio"
            name={`merge-${label}`}
            checked={choice === 'incoming'}
            onChange={() => onChoose('incoming')}
            aria-label={`Use incoming ${label}`}
            className="shrink-0"
          />
        )}
        <span className={hasDiff ? '' : 'opacity-50'}>{incomingValue || '—'}</span>
      </div>
    </div>
  )
}
