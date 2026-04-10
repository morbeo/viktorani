import { useState, useCallback } from 'react'
import { Plus, Minus, ChevronDown, ChevronRight, Medal } from 'lucide-react'
import { useScoreboard } from '@/hooks/useScoreboard'
import { Icon } from '@/components/ui'
import type { Game } from '@/db'

interface FlashState {
  id: string
  delta: number
}

interface ScoreboardPanelProps {
  game: Game
}

/**
 * GM scoreboard panel.
 *
 * - Hidden entirely when `game.scoringEnabled === false`.
 * - Lists players/teams sorted by score descending.
 * - +/- buttons apply manual adjustments (default increment = lowest difficulty score).
 * - Team rows expand to show individual player breakdown.
 * - Score changes flash briefly with the delta amount.
 */
export function ScoreboardPanel({ game }: ScoreboardPanelProps) {
  const { entries, adjust, defaultIncrement } = useScoreboard(game)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [flash, setFlash] = useState<FlashState | null>(null)

  const triggerFlash = useCallback((id: string, delta: number) => {
    setFlash({ id, delta })
    setTimeout(() => setFlash(null), 900)
  }, [])

  const handleAdjust = useCallback(
    async (id: string, kind: 'player' | 'team', delta: number) => {
      await adjust(id, kind, delta)
      triggerFlash(id, delta)
    },
    [adjust, triggerFlash]
  )

  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  if (!game.scoringEnabled) return null

  return (
    <div
      className="rounded-xl border flex flex-col"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-muted)' }}
        >
          Scoreboard
        </span>
        <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
          ±{defaultIncrement} per click
        </span>
      </div>

      {/* Rows */}
      {entries.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            No players yet
          </p>
        </div>
      ) : (
        <div
          className="flex flex-col divide-y"
          style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}
        >
          {entries.map((entry, rank) => {
            const isFlashing = flash?.id === entry.id
            const isExpanded = expanded.has(entry.id)
            const hasMembers = entry.kind === 'team' && entry.members && entry.members.length > 0

            return (
              <div key={entry.id}>
                {/* Main row */}
                <div
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors"
                  style={{
                    borderColor: 'var(--color-border)',
                    background: isFlashing
                      ? flash!.delta > 0
                        ? 'var(--color-green)18'
                        : 'var(--color-red)18'
                      : undefined,
                    transition: 'background 0.15s ease',
                  }}
                >
                  {/* Rank — medal for first place */}
                  <span
                    className="w-5 text-center text-xs font-bold shrink-0 flex items-center justify-center"
                    style={{ color: rank === 0 ? 'var(--color-gold)' : 'var(--color-muted)' }}
                  >
                    {rank === 0 ? (
                      <Icon icon={Medal} size="sm" className="text-[var(--color-gold)]" />
                    ) : (
                      rank + 1
                    )}
                  </span>

                  {/* Name + expand toggle */}
                  <button
                    className="flex-1 text-sm text-left flex items-center gap-1.5 min-w-0"
                    onClick={() => hasMembers && toggleExpand(entry.id)}
                    style={{
                      cursor: hasMembers ? 'pointer' : 'default',
                      fontWeight: entry.kind === 'team' ? 600 : 400,
                    }}
                    aria-expanded={hasMembers ? isExpanded : undefined}
                    aria-label={
                      hasMembers
                        ? `${entry.name} — ${isExpanded ? 'collapse' : 'expand'} team`
                        : undefined
                    }
                  >
                    {hasMembers && (
                      <Icon
                        icon={isExpanded ? ChevronDown : ChevronRight}
                        size="sm"
                        className="shrink-0 transition-transform"
                        aria-hidden={true}
                      />
                    )}
                    <span className="truncate">{entry.name}</span>
                    {entry.kind === 'team' && (
                      <span className="text-xs shrink-0" style={{ color: 'var(--color-muted)' }}>
                        · team
                      </span>
                    )}
                  </button>

                  {/* Flash delta */}
                  <span
                    className="text-xs font-bold mono w-10 text-center shrink-0"
                    style={{
                      color: isFlashing
                        ? flash!.delta > 0
                          ? 'var(--color-green)'
                          : 'var(--color-red)'
                        : 'transparent',
                      transition: isFlashing ? 'none' : 'color 0.6s ease',
                    }}
                    aria-hidden
                  >
                    {isFlashing ? (flash!.delta > 0 ? `+${flash!.delta}` : flash!.delta) : ''}
                  </span>

                  {/* Score */}
                  <span
                    className="mono text-sm font-bold w-8 text-right shrink-0"
                    style={{ color: 'var(--color-ink)' }}
                  >
                    {entry.score}
                  </span>

                  {/* Adjust buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      className="w-7 h-7 rounded flex items-center justify-center transition-colors"
                      style={{
                        background: 'var(--color-red)18',
                        color: 'var(--color-red)',
                      }}
                      onClick={() => void handleAdjust(entry.id, entry.kind, -defaultIncrement)}
                      aria-label={`Subtract ${defaultIncrement} from ${entry.name}`}
                    >
                      <Icon icon={Minus} size="sm" />
                    </button>
                    <button
                      className="w-7 h-7 rounded flex items-center justify-center transition-colors"
                      style={{
                        background: 'var(--color-green)18',
                        color: 'var(--color-green)',
                      }}
                      onClick={() => void handleAdjust(entry.id, entry.kind, +defaultIncrement)}
                      aria-label={`Add ${defaultIncrement} to ${entry.name}`}
                    >
                      <Icon icon={Plus} size="sm" />
                    </button>
                  </div>
                </div>

                {/* Team member breakdown */}
                {isExpanded && hasMembers && (
                  <div className="flex flex-col" style={{ background: 'var(--color-cream)' }}>
                    {entry.members!.map(member => {
                      const memberFlashing = flash?.id === member.id
                      return (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 pl-10 pr-4 py-2 border-t"
                          style={{
                            borderColor: 'var(--color-border)',
                            background: memberFlashing
                              ? flash!.delta > 0
                                ? 'var(--color-green)12'
                                : 'var(--color-red)12'
                              : undefined,
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <span className="flex-1 text-xs" style={{ color: 'var(--color-muted)' }}>
                            {member.name}
                          </span>
                          <span
                            className="text-xs font-bold mono w-10 text-center shrink-0"
                            style={{
                              color: memberFlashing
                                ? flash!.delta > 0
                                  ? 'var(--color-green)'
                                  : 'var(--color-red)'
                                : 'transparent',
                            }}
                            aria-hidden
                          >
                            {memberFlashing
                              ? flash!.delta > 0
                                ? `+${flash!.delta}`
                                : flash!.delta
                              : ''}
                          </span>
                          <span
                            className="mono text-xs font-bold w-8 text-right shrink-0"
                            style={{ color: 'var(--color-muted)' }}
                          >
                            {member.score}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              className="w-6 h-6 rounded flex items-center justify-center"
                              style={{
                                background: 'var(--color-red)18',
                                color: 'var(--color-red)',
                              }}
                              onClick={() =>
                                void handleAdjust(member.id, 'player', -defaultIncrement)
                              }
                              aria-label={`Subtract ${defaultIncrement} from ${member.name}`}
                            >
                              <Icon icon={Minus} size="sm" />
                            </button>
                            <button
                              className="w-6 h-6 rounded flex items-center justify-center"
                              style={{
                                background: 'var(--color-green)18',
                                color: 'var(--color-green)',
                              }}
                              onClick={() =>
                                void handleAdjust(member.id, 'player', +defaultIncrement)
                              }
                              aria-label={`Add ${defaultIncrement} to ${member.name}`}
                            >
                              <Icon icon={Plus} size="sm" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
