import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pause, Play, Square, ChevronLeft, Monitor } from 'lucide-react'
import { Button, Icon, ControlSizePicker } from '@/components/ui'
import { EndGameModal } from '@/components/gamemaster/EndGameModal'
import type { Game } from '@/db'
import type { UseGameLifecycleResult } from '@/hooks/useGameLifecycle'
import { useRegisterCommands } from '@/components/command-palette/commands'
import type { Command } from '@/components/command-palette/commands'

interface GameControlsProps {
  game: Game
  /** Receives only the changed fields; the caller merges them into its current game. */
  onGameChange: (patch: Partial<Game>) => void
  lifecycle: UseGameLifecycleResult
}

/**
 * Toolbar strip shown at the top of the active-game view.
 *
 * - "Back to games" navigates to /admin/games (always visible).
 * - "Open screen" opens the projector view in a second window.
 * - Pause / Resume toggle (active ↔ paused).
 * - End game button opens a confirmation modal.
 * - All controls are disabled when the game has ended.
 */
export function GameControls({ game, onGameChange, lifecycle }: GameControlsProps) {
  const navigate = useNavigate()
  const [endModalOpen, setEndModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const isEnded = game.status === 'ended'
  const isPaused = game.status === 'paused'

  async function handlePauseResume() {
    setBusy(true)
    try {
      const patch = isPaused ? await lifecycle.resumeGame(game) : await lifecycle.pauseGame(game)
      onGameChange(patch)
    } finally {
      setBusy(false)
    }
  }

  async function handleEnd() {
    setBusy(true)
    try {
      onGameChange(await lifecycle.endGame(game))
      setEndModalOpen(false)
    } finally {
      setBusy(false)
    }
  }

  // A named window, so pressing again brings the same screen back instead of opening another
  function handleOpenScreen() {
    const { pathname, search } = window.location
    window.open(`${pathname}${search}#/admin/game/${game.id}/screen`, `viktorani-screen-${game.id}`)
  }

  // Palette commands call the latest handlers without re-registering on every render
  const handlersRef = useRef({ handlePauseResume, handleOpenScreen })
  useEffect(() => {
    handlersRef.current = { handlePauseResume, handleOpenScreen }
  })
  const commands = useMemo<Command[]>(
    () =>
      isEnded
        ? []
        : [
            {
              id: 'gm:pause',
              label: isPaused ? 'Resume game' : 'Pause game',
              group: 'Game',
              icon: isPaused ? Play : Pause,
              run: () => void handlersRef.current.handlePauseResume(),
            },
            {
              id: 'gm:screen',
              label: 'Open screen',
              group: 'Game',
              icon: Monitor,
              keywords: 'projector display window',
              run: () => handlersRef.current.handleOpenScreen(),
            },
          ],
    [isEnded, isPaused]
  )
  useRegisterCommands('game-controls', commands)

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

        <ControlSizePicker />

        <Button variant="secondary" size="sm" onClick={handleOpenScreen}>
          <Icon icon={Monitor} size="sm" />
          Open screen
        </Button>

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
