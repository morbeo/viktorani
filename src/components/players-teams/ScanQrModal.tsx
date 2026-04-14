import { useState, useCallback } from 'react'
import { Modal, Button } from '@/components/ui'
import QrScanner from './QrScanner'
import PlayerMergeModal from './PlayerMergeModal'
import {
  detectPlayerConflict,
  importPlayerDirect,
  applyPlayerMerge,
  importTeamQr,
} from './qrImport'
import type { PlayerConflict, MergeChoice } from './qrImport'
import type { QrPayload } from '@/types/players-teams'
import { isPlayerQrPayload, isTeamQrPayload } from '@/types/players-teams'

interface Props {
  open: boolean
  onClose: () => void
  /** Called with IDs of records that were created or updated, for highlighting. */
  onImported?: (playerIds: string[], teamId?: string) => void
}

type Phase =
  | { kind: 'scanning' }
  | { kind: 'processing' }
  | { kind: 'merge'; conflict: PlayerConflict }
  | { kind: 'assign-nudge'; playerId: string }
  | { kind: 'done'; summary: string }
  | { kind: 'error'; message: string }

export default function ScanQrModal({ open, onClose, onImported }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: 'scanning' })

  function reset() {
    setPhase({ kind: 'scanning' })
  }

  const handleScan = useCallback(
    async (payload: QrPayload) => {
      setPhase({ kind: 'processing' })

      try {
        if (isPlayerQrPayload(payload)) {
          const conflict = await detectPlayerConflict(payload)
          if (conflict) {
            if (conflict.diffs.length === 0) {
              // No actual differences — treat as clean import (already exists, identical)
              setPhase({ kind: 'done', summary: `"${payload.name}" is already up to date.` })
              onImported?.([conflict.existing.id])
            } else {
              setPhase({ kind: 'merge', conflict })
            }
          } else {
            const playerId = await importPlayerDirect(payload)
            onImported?.([playerId])
            setPhase({ kind: 'assign-nudge', playerId })
          }
        } else if (isTeamQrPayload(payload)) {
          const result = await importTeamQr(payload)
          onImported?.([...result.createdPlayerIds, ...result.conflictedPlayerIds], result.teamId)

          if (result.pendingConflicts.length > 0) {
            // Process conflicts one at a time — start with first
            setPhase({ kind: 'merge', conflict: result.pendingConflicts[0] })
            // Remaining conflicts are handled after each merge (simplified: just surface first)
          } else {
            const n = result.createdPlayerIds.length
            setPhase({
              kind: 'done',
              summary: `Team "${payload.name}" imported with ${n} player${n !== 1 ? 's' : ''}.`,
            })
          }
        }
      } catch (err) {
        setPhase({ kind: 'error', message: (err as Error).message })
      }
    },
    [onImported]
  )

  async function handleMergeApply(choices: MergeChoice) {
    if (phase.kind !== 'merge') return
    try {
      const playerId = await applyPlayerMerge(phase.conflict, choices)
      onImported?.([playerId])
      setPhase({ kind: 'done', summary: `"${phase.conflict.existing.name}" updated.` })
    } catch (err) {
      setPhase({ kind: 'error', message: (err as Error).message })
    }
  }

  function handleClose() {
    reset()
    onClose()
  }

  const title =
    phase.kind === 'merge'
      ? 'Resolve conflict'
      : phase.kind === 'assign-nudge'
        ? 'Player imported'
        : phase.kind === 'done'
          ? 'Done'
          : phase.kind === 'error'
            ? 'Import failed'
            : 'Scan QR code'

  return (
    <>
      <Modal
        open={open && phase.kind !== 'merge'}
        onClose={handleClose}
        title={title}
        maxWidth="360px"
      >
        {phase.kind === 'scanning' && (
          <QrScanner
            onScan={handleScan}
            onError={msg => setPhase({ kind: 'error', message: msg })}
          />
        )}

        {phase.kind === 'processing' && (
          <div className="flex items-center justify-center py-10">
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              Processing...
            </p>
          </div>
        )}

        {phase.kind === 'assign-nudge' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: 'var(--color-ink)' }}>
              Player imported successfully. Would you like to assign them to a team?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose}>
                Skip
              </Button>
              <Button variant="primary" onClick={handleClose}>
                Assign team
              </Button>
            </div>
          </div>
        )}

        {phase.kind === 'done' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: 'var(--color-ink)' }}>
              {phase.summary}
            </p>
            <div className="flex justify-between gap-2">
              <Button variant="secondary" onClick={reset}>
                Scan another
              </Button>
              <Button variant="primary" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        )}

        {phase.kind === 'error' && (
          <div className="flex flex-col gap-4">
            <p
              className="text-sm px-3 py-2 rounded"
              style={{ color: 'var(--color-red)', background: 'var(--color-red)1a' }}
            >
              {phase.message}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={reset}>
                Try again
              </Button>
              <Button variant="secondary" onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Merge modal rendered outside the main modal to avoid nesting */}
      <PlayerMergeModal
        open={phase.kind === 'merge'}
        conflict={phase.kind === 'merge' ? phase.conflict : null}
        onApply={handleMergeApply}
        onCancel={() => setPhase({ kind: 'scanning' })}
      />
    </>
  )
}
