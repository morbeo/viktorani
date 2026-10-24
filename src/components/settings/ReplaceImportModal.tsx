import { useState } from 'react'
import { Button, Modal } from '@/components/ui'
import type { RemovalGroup } from '@/db/snapshot'

/** Singular and plural label for each collection a replace import can shrink. */
const LABELS: Record<RemovalGroup['table'], [string, string]> = {
  difficulties: ['difficulty level', 'difficulty levels'],
  tags: ['tag', 'tags'],
  questions: ['question', 'questions'],
  rounds: ['round', 'rounds'],
  games: ['game', 'games'],
  gameQuestions: ['game question', 'game questions'],
  notes: ['note', 'notes'],
  layouts: ['layout', 'layouts'],
  widgets: ['widget', 'widgets'],
  themes: ['theme', 'themes'],
}

/** Rows a game owns: shown only as part of the game, not as a group of their own. */
const HIDDEN: ReadonlySet<RemovalGroup['table']> = new Set(['gameQuestions', 'widgets'])

/** Names listed per group before the rest are summarised as "and N more". */
const MAX_NAMES = 5

/** "3 questions" / "1 round". */
function countLabel({ table, count }: Pick<RemovalGroup, 'table' | 'count'>): string {
  const [one, many] = LABELS[table]
  return `${count} ${count === 1 ? one : many}`
}

interface Props {
  /** The picked file's name, or null when the dialog is closed. */
  fileName: string | null
  /** What the replace would remove, from `previewReplace`. */
  removals: RemovalGroup[]
  onConfirm: () => Promise<void>
  onClose: () => void
}

/** Confirmation for a replace import: lists what the database would lose before it does. */
export default function ReplaceImportModal({ fileName, removals, onConfirm, onClose }: Props) {
  const [busy, setBusy] = useState(false)
  const shown = removals.filter(g => !HIDDEN.has(g.table))
  const removesGames = removals.some(g => g.table === 'games')

  async function confirm() {
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={fileName !== null} title="Replace from backup" onClose={busy ? () => {} : onClose}>
      <div className="flex flex-col gap-4 text-sm text-text">
        <p>
          Your data will be replaced with <strong>{fileName}</strong>. Anything not in the file is
          removed.
        </p>

        {removals.length === 0 ? (
          <p className="text-muted">Nothing will be removed.</p>
        ) : (
          <div className="rounded-lg px-4 py-3 bg-negative/10">
            <p className="font-medium mb-2">This will remove:</p>
            <ul className="flex flex-col gap-2">
              {shown.map(g => (
                <li key={g.table}>
                  <span className="font-medium">{countLabel(g)}</span>
                  {g.names.length > 0 && (
                    <span className="text-muted">
                      {': '}
                      {g.names.slice(0, MAX_NAMES).join(', ')}
                      {g.names.length > MAX_NAMES && `, and ${g.names.length - MAX_NAMES} more`}
                    </span>
                  )}
                </li>
              ))}
              {shown.length === 0 && <li>Questions or widgets inside your games</li>}
            </ul>
            {removesGames && (
              <p className="text-xs mt-2 text-muted">
                Players, teams, scores and the log of removed games go with them.
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-muted">
          This cannot be undone. Export first if you want to keep a copy.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} disabled={busy}>
            {busy ? 'Replacing…' : 'Replace data'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
