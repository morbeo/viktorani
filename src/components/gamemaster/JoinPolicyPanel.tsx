import { useState } from 'react'
import { db } from '@/db'
import type { Game } from '@/db'
import { HelpTip } from '@/components/ui'
import { JOIN_POLICY_HELP } from './join-policy-help'

type JoinPolicyKey = 'allowLateJoin' | 'allowRejoin' | 'requireApproval' | 'allowPlayerTeams'

const TOGGLES: Array<{ key: JoinPolicyKey; label: string }> = [
  { key: 'allowPlayerTeams', label: 'Players may create teams' },
  { key: 'allowLateJoin', label: 'Allow late join' },
  { key: 'allowRejoin', label: 'Allow rejoin' },
  { key: 'requireApproval', label: 'Require approval' },
]

function togglePatch(game: Game, key: JoinPolicyKey): Partial<Game> {
  const patch: Partial<Game> = { updatedAt: Date.now() }
  patch[key] = !game[key]
  return patch
}

interface JoinPolicyPanelProps {
  game: Game
  /** Receives only the changed fields; the caller merges them into its current game. */
  onGameChange: (patch: Partial<Game>) => void
}

/** Live join policy switches for the GM. Each change is persisted immediately. */
export function JoinPolicyPanel({ game, onGameChange }: JoinPolicyPanelProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle(key: JoinPolicyKey) {
    const patch = togglePatch(game, key)
    setSaving(true)
    setError(null)
    try {
      await db.games.update(game.id, patch)
      onGameChange(patch)
    } catch {
      setError('Could not save the join policy')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border p-4"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--color-muted)' }}
      >
        Joining
      </p>
      {TOGGLES.map(({ key, label }) => (
        <label key={key} className="flex items-center justify-between gap-4 cursor-pointer">
          <span className="flex items-center gap-1.5 text-sm">
            {label}
            <HelpTip label={`About ${label}`} text={JOIN_POLICY_HELP[key]} />
          </span>
          <button
            role="switch"
            aria-checked={game[key]}
            aria-label={label}
            disabled={saving}
            onClick={() => void toggle(key)}
            className="w-10 h-5 rounded-full transition-all relative shrink-0"
            style={{ background: game[key] ? 'var(--color-ink)' : 'var(--color-border)' }}
          >
            <span
              className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
              style={{ left: game[key] ? '1.25rem' : '0.125rem' }}
            />
          </button>
        </label>
      ))}
      {error && (
        <p className="text-xs" style={{ color: 'var(--color-red)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
