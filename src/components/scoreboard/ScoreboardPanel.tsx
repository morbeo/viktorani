import { useState, useCallback, useRef, type ReactNode } from 'react'
import { Plus, Minus, ChevronDown, ChevronRight, Medal } from 'lucide-react'
import { useScoreboard, useScoreHistory } from '@/hooks/useScoreboard'
import { Icon, useControlSizeStep, pickBySize } from '@/components/ui'
import type { Game, ScoreChangeReason } from '@/db'

interface FlashState {
  id: string
  delta: number
}

interface ScoreboardPanelProps {
  game: Game
  /** The question being played, recorded with each score change. */
  questionId?: string | null
}

const REASON_LABELS: Record<ScoreChangeReason, string> = {
  step: 'adjusted',
  set: 'set',
  correct: 'correct answer',
}

/** How many score changes the history shows. */
const HISTORY_LIMIT = 50

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

/**
 * GM scoreboard panel.
 *
 * - Hidden entirely when `game.scoringEnabled === false`.
 * - A table of players/teams sorted by score descending.
 * - +/- buttons apply manual adjustments (default increment = lowest difficulty score);
 *   clicking a score lets the GM type a new one (Enter or leaving the field saves, Esc cancels).
 * - Team rows expand to show individual player breakdown.
 * - Score changes flash briefly with the delta amount.
 * - A collapsible history lists the latest score changes, newest first.
 */
export function ScoreboardPanel({ game, questionId = null }: ScoreboardPanelProps) {
  const { entries, adjust, set, defaultIncrement } = useScoreboard(game, questionId)
  const history = useScoreHistory(game.id)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showHistory, setShowHistory] = useState(false)
  const [flash, setFlash] = useState<FlashState | null>(null)
  const step = useControlSizeStep()
  const adjustSize = pickBySize(step, ['w-6 h-6', 'w-7 h-7', 'w-9 h-9'] as const)
  const memberAdjustSize = pickBySize(step, ['w-5 h-5', 'w-6 h-6', 'w-8 h-8'] as const)

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

  const handleSet = useCallback(
    async (id: string, kind: 'player' | 'team', from: number, to: number) => {
      await set(id, kind, to)
      const delta = Math.max(0, Math.round(to)) - from
      if (delta !== 0) triggerFlash(id, delta)
    },
    [set, triggerFlash]
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

      {entries.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            No players yet
          </p>
        </div>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr
              className="text-xs text-left border-b"
              style={{ color: 'var(--color-muted)', borderColor: 'var(--color-border)' }}
            >
              <th scope="col" className="w-10 px-4 py-2 font-medium text-center">
                #
              </th>
              <th scope="col" className="py-2 font-medium">
                Name
              </th>
              <th scope="col" className="w-10 py-2">
                <span className="sr-only">Change</span>
              </th>
              <th scope="col" className="w-20 py-2 font-medium text-right">
                Score
              </th>
              <th scope="col" className="w-24 px-4 py-2 font-medium text-right">
                Adjust
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.flatMap((entry, rank) => {
              const isExpanded = expanded.has(entry.id)
              const hasMembers = entry.kind === 'team' && entry.members && entry.members.length > 0

              return [
                <ScoreRow
                  key={entry.id}
                  name={entry.name}
                  score={entry.score}
                  flashDelta={flash?.id === entry.id ? flash.delta : null}
                  increment={defaultIncrement}
                  buttonSize={adjustSize}
                  onAdjust={delta => void handleAdjust(entry.id, entry.kind, delta)}
                  onSet={to => void handleSet(entry.id, entry.kind, entry.score, to)}
                  rank={
                    rank === 0 ? (
                      <Icon icon={Medal} size="sm" className="text-[var(--color-gold)] mx-auto" />
                    ) : (
                      rank + 1
                    )
                  }
                  label={
                    <button
                      className="text-left flex items-center gap-1.5 min-w-0 max-w-full"
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
                  }
                />,
                ...(isExpanded && hasMembers
                  ? entry.members!.map(member => (
                      <ScoreRow
                        key={member.id}
                        member
                        name={member.name}
                        score={member.score}
                        flashDelta={flash?.id === member.id ? flash.delta : null}
                        increment={defaultIncrement}
                        buttonSize={memberAdjustSize}
                        onAdjust={delta => void handleAdjust(member.id, 'player', delta)}
                        onSet={to => void handleSet(member.id, 'player', member.score, to)}
                        label={<span className="pl-5">{member.name}</span>}
                      />
                    ))
                  : []),
              ]
            })}
          </tbody>
        </table>
      )}

      {/* Score history */}
      <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
        <button
          className="w-full px-4 py-2 flex items-center gap-1.5 text-xs font-medium"
          style={{ color: 'var(--color-muted)' }}
          onClick={() => setShowHistory(v => !v)}
          aria-expanded={showHistory}
        >
          <Icon icon={showHistory ? ChevronDown : ChevronRight} size="sm" aria-hidden={true} />
          Score history ({history.length})
        </button>
        {showHistory &&
          (history.length === 0 ? (
            <p className="px-4 pb-3 text-xs" style={{ color: 'var(--color-muted)' }}>
              No score changes yet
            </p>
          ) : (
            <ol className="px-4 pb-3 flex flex-col gap-1 text-xs max-h-64 overflow-y-auto">
              {history.slice(0, HISTORY_LIMIT).map(event => (
                <li key={event.id} className="flex gap-2">
                  <span className="mono shrink-0" style={{ color: 'var(--color-muted)' }}>
                    {formatTime(event.timestamp)}
                  </span>
                  <span className="truncate">{event.name}</span>
                  <span className="mono shrink-0">
                    {event.from} → {event.to}
                  </span>
                  <span className="shrink-0" style={{ color: 'var(--color-muted)' }}>
                    {REASON_LABELS[event.reason]}
                  </span>
                </li>
              ))}
            </ol>
          ))}
      </div>
    </div>
  )
}

interface ScoreRowProps {
  name: string
  score: number
  /** Rank cell content; team members have none. */
  rank?: ReactNode
  label: ReactNode
  /** A team member's row, shown under its team. */
  member?: boolean
  flashDelta: number | null
  increment: number
  buttonSize: string
  onAdjust: (delta: number) => void
  onSet: (score: number) => void
}

function ScoreRow({
  name,
  score,
  rank,
  label,
  member = false,
  flashDelta,
  increment,
  buttonSize,
  onAdjust,
  onSet,
}: ScoreRowProps) {
  const flashing = flashDelta !== null
  const up = flashing && flashDelta > 0
  const tint = member ? '12' : '18'

  return (
    <tr
      className="border-t"
      style={{
        borderColor: 'var(--color-border)',
        background: flashing
          ? `var(--color-${up ? 'green' : 'red'})${tint}`
          : member
            ? 'var(--color-cream)'
            : undefined,
        transition: 'background 0.15s ease',
      }}
    >
      <td
        className="px-4 py-2 text-center text-xs font-bold"
        style={{ color: 'var(--color-muted)' }}
      >
        {rank}
      </td>
      <td
        className={`py-2 max-w-0 ${member ? 'text-xs' : ''}`}
        style={member ? { color: 'var(--color-muted)' } : undefined}
      >
        {label}
      </td>
      <td
        className="py-2 text-xs font-bold mono text-center"
        style={{ color: flashing ? `var(--color-${up ? 'green' : 'red'})` : 'transparent' }}
        aria-hidden
      >
        {flashing ? (up ? `+${flashDelta}` : flashDelta) : ''}
      </td>
      <td className="py-2 text-right">
        <ScoreCell name={name} score={score} member={member} onSet={onSet} />
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center justify-end gap-1">
          <button
            className={`${buttonSize} rounded flex items-center justify-center transition-colors`}
            style={{ background: 'var(--color-red)18', color: 'var(--color-red)' }}
            onClick={() => onAdjust(-increment)}
            aria-label={`Subtract ${increment} from ${name}`}
          >
            <Icon icon={Minus} size="sm" />
          </button>
          <button
            className={`${buttonSize} rounded flex items-center justify-center transition-colors`}
            style={{ background: 'var(--color-green)18', color: 'var(--color-green)' }}
            onClick={() => onAdjust(+increment)}
            aria-label={`Add ${increment} to ${name}`}
          >
            <Icon icon={Plus} size="sm" />
          </button>
        </div>
      </td>
    </tr>
  )
}

/** A score that turns into a number field when clicked. */
function ScoreCell({
  name,
  score,
  member,
  onSet,
}: {
  name: string
  score: number
  member: boolean
  onSet: (score: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  // Set once the edit has ended, so the blur that follows Enter or Esc doesn't save again
  const doneRef = useRef(false)

  function start() {
    doneRef.current = false
    setDraft(String(score))
  }

  function finish(save: boolean) {
    if (doneRef.current || draft === null) return
    doneRef.current = true
    setDraft(null)
    const value = Number(draft)
    if (save && draft.trim() !== '' && Number.isFinite(value) && value !== score) onSet(value)
  }

  const textClass = `mono font-bold ${member ? 'text-xs' : 'text-sm'}`

  if (draft === null) {
    return (
      <button
        className={`${textClass} px-1.5 py-0.5 rounded hover:underline`}
        style={{ color: member ? 'var(--color-muted)' : 'var(--color-ink)' }}
        onClick={start}
        title="Click to type a new score"
        aria-label={`Set score for ${name}, now ${score}`}
      >
        {score}
      </button>
    )
  }

  return (
    <input
      type="number"
      min={0}
      step={1}
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') finish(true)
        else if (e.key === 'Escape') finish(false)
      }}
      onBlur={() => finish(true)}
      aria-label={`New score for ${name}`}
      className={`${textClass} w-16 px-1.5 py-0.5 rounded border text-right outline-none`}
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-cream)',
        color: 'var(--color-ink)',
      }}
    />
  )
}
