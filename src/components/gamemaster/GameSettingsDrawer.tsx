import { useEffect, useId, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import { GameSettingsForm } from '@/components/game-settings/GameSettingsForm'
import type { GameSettings } from '@/components/game-settings/game-settings'
import { db } from '@/db'
import type { Game } from '@/db'

interface GameSettingsDrawerProps {
  game: Game
  /** Receives only the changed fields; the caller merges them into its current game. */
  onGameChange: (patch: Partial<Game>) => void
}

/** A "Game settings" button that opens a side drawer; each change is persisted immediately. */
export function GameSettingsDrawer({ game, onGameChange }: GameSettingsDrawerProps) {
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  async function save(settings: Partial<GameSettings>) {
    const patch: Partial<Game> = { ...settings, updatedAt: Date.now() }
    setSaving(true)
    setError(null)
    try {
      await db.games.update(game.id, patch)
      onGameChange(patch)
    } catch {
      setError('Could not save the game settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Icon icon={Settings2} size="sm" />
        Game settings
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          style={{ background: 'rgba(26,22,16,0.4)' }}
          onClick={() => setOpen(false)}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="h-full w-full max-w-sm overflow-y-auto border-l shadow-2xl flex flex-col gap-4 p-5"
            style={{ background: 'var(--color-cream)', borderColor: 'var(--color-border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 id={titleId} className="text-base font-semibold">
                Game settings
              </h2>
              <button
                type="button"
                aria-label="Close game settings"
                onClick={() => setOpen(false)}
                className="text-xl leading-none hover:opacity-60 transition-opacity"
                style={{ color: 'var(--color-muted)' }}
              >
                ×
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
              Changes apply at once. Visibility is set on the question panel.
            </p>
            <GameSettingsForm
              value={game}
              onChange={patch => void save(patch)}
              mode="live"
              disabled={saving}
            />
            {error && (
              <p role="alert" className="text-xs" style={{ color: 'var(--color-red)' }}>
                {error}
              </p>
            )}
          </aside>
        </div>
      )}
    </>
  )
}
