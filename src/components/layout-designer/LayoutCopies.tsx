import { useState } from 'react'
import type { Game } from '@/db'
import { Button } from '@/components/ui'

interface LayoutCopiesProps {
  /** The game whose layouts are shown, or `null` for the templates. */
  gameId: string | null
  games: readonly Pick<Game, 'id' | 'name'>[]
  onDuplicate: () => void
  /** Copy the layout into `gameId`'s layouts, or into the templates when `null`. */
  onCopyTo: (gameId: string | null) => Promise<void>
}

/**
 * Copies of the chosen layout: a duplicate next to it, a game's layout saved as a template,
 * or a template copied into a game, where it can be changed for that game alone.
 */
export function LayoutCopies({ gameId, games, onDuplicate, onCopyTo }: LayoutCopiesProps) {
  const [targetGame, setTargetGame] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const chosenGame = games.find(g => g.id === targetGame) ?? games[0]

  async function copyTo(id: string | null, message: string) {
    await onCopyTo(id)
    setDone(message)
  }

  return (
    <section aria-labelledby="layout-copies-heading" className="flex flex-col gap-2">
      <h2
        id="layout-copies-heading"
        className="text-xs font-semibold uppercase text-(--color-muted)"
      >
        Copies
      </h2>
      <Button size="sm" onClick={onDuplicate}>
        Duplicate layout
      </Button>
      {gameId ? (
        <Button size="sm" onClick={() => void copyTo(null, 'Saved as a template.')}>
          Save as template
        </Button>
      ) : (
        chosenGame && (
          <div className="flex items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-(--color-muted)">
              Copy to game
              <select
                className="rounded border border-(--color-border) bg-(--color-bg) px-2 py-1 text-sm text-(--color-text)"
                value={chosenGame.id}
                onChange={e => {
                  setTargetGame(e.target.value)
                  setDone(null)
                }}
              >
                {games.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <Button
              size="sm"
              onClick={() => void copyTo(chosenGame.id, `Copied to ${chosenGame.name}.`)}
            >
              Copy
            </Button>
          </div>
        )
      )}
      {done && (
        <p role="status" className="text-xs text-(--color-muted)">
          {done}
        </p>
      )}
    </section>
  )
}
