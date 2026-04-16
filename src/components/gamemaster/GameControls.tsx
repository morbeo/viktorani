import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pause, Play, Square, ChevronLeft } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import { EndGameModal } from '@/components/gamemaster/EndGameModal'
import type { Game, Player } from '@/db'
import type { UseGameLifecycleResult } from '@/hooks/useGameLifecycle'

interface GameControlsProps {
  game: Game
  players: Player[]
  onGameChange: (updated: Game) => void
  lifecycle: UseGameLifecycleResult
}

/**
 * Toolbar strip shown at the top of the active-game view.
 *
 * - "Back to games" navigates to /admin/games (always visible).
 * - Pause / Resume toggle (active ↔ paused).
 * - End game button opens a confirmation modal.
 * - All controls are disabled when the game has ended.
 */
export function GameControls({ game, players, onGameChange, lifecycle }: GameControlsProps) {
  const navigate = useNavigate()
  const [endModalOpen, setEndModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const isEnded = game.status === 'ended'
  const isPaused = game.status === 'paused'

  async function handlePauseResume() {
    setBusy(true)
    try {
      const updated = isPaused
        ? await lifecycle.resumeGame(game)
        : await lifecycle.pauseGame(game)
      onGameChange(updated)
    } finally {
      setBusy(false)
    }
  }

  async function handleEnd() {
    setBusy(true)
    try {
      const updated = await lifecycle.endGame(game, players)
      onGameChange(updated)
      setEndModalOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div
        className="flex items-center gap-2 px-4 py-2 border-b shrink-0"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        {/* Back */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin/games')}
          aria-label="Back to games list"
        >
          <Icon icon={ChevronLeft} size="sm" />
          Games
        </Button>

        {/* Game name */}
        <span
          className="flex-1 text-sm font-semibold truncate"
          style={{ color: 'var(--color-ink)' }}
        >
          {game.name}
        </span>

        {/* Status badge */}
        {isEnded && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'var(--color-muted)22', color: 'var(--color-muted)' }}
          >
            Ended
          </span>
        )}
        {isPaused && !isEnded && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'var(--color-gold)22', color: 'var(--color-gold)' }}
          >
            Paused
          </span>
        )}

        {/* Pause / Resume */}
        {!isEnded && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handlePauseResume()}
            disabled={busy}
            aria-label={isPaused ? 'Resume game' : 'Pause game'}
          >
            <Icon icon={isPaused ? Play : Pause} size="sm" />
            {isPaused ? 'Resume' : 'Pause'}
          </Button>
        )}

        {/* End */}
        {!isEnded && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setEndModalOpen(true)}
            disabled={busy}
            aria-label="End game"
          >
            <Icon icon={Square} size="sm" />
            End game
          </Button>
        )}
      </div>

      <EndGameModal
        open={endModalOpen}
        onClose={() => setEndModalOpen(false)}
        onConfirm={() => void handleEnd()}
        ending={busy}
      />
    </>
  )
}
