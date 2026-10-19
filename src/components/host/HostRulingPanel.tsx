import { useState } from 'react'
import { Check, Eye, ListChecks, SkipForward, X } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import type { GameQuestion, Player, Team } from '@/db'
import type { QuestionRuling, RulingAward } from '@/db/rulings'

const RULINGS: { value: QuestionRuling; label: string; icon: typeof Check }[] = [
  { value: 'correct', label: 'Correct', icon: Check },
  { value: 'incorrect', label: 'Wrong', icon: X },
  { value: 'skipped', label: 'Skip', icon: SkipForward },
]

interface HostRulingPanelProps {
  status: GameQuestion['status']
  scoringEnabled: boolean
  players: Player[]
  teams: Team[]
  disabled?: boolean
  onRule: (ruling: QuestionRuling, award: RulingAward | null) => void
  /** Whether players and screens have been shown the correct answer. */
  revealed: boolean
  onReveal: () => void
  /** Opens the review of the round's answers; no button without it. */
  onReviewRound?: () => void
}

/**
 * Rule on the question without a buzz (#424): correct, wrong or skipped, and for a
 * correct answer, who gets the points. Works whether or not the game has a buzzer. Ruling
 * doesn't show the answer; Reveal answer does (ADR 0023).
 */
export function HostRulingPanel({
  status,
  scoringEnabled,
  players,
  teams,
  disabled = false,
  onRule,
  revealed,
  onReveal,
  onReviewRound,
}: HostRulingPanelProps) {
  // `player:<id>` or `team:<id>`, or '' for nobody
  const [awardKey, setAwardKey] = useState('')
  const present = players.filter(p => p.presence !== 'left' && p.presence !== 'kicked')
  const award = parseAward(awardKey)

  return (
    <section aria-label="Ruling" className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted">Ruling</span>
      <div className="flex flex-wrap items-center gap-2">
        {RULINGS.map(r => (
          <Button
            key={r.value}
            size="sm"
            variant={status === r.value ? 'primary' : 'secondary'}
            aria-pressed={status === r.value}
            disabled={disabled}
            onClick={() => onRule(r.value, r.value === 'correct' ? award : null)}
          >
            <Icon icon={r.icon} size="sm" />
            {r.label}
          </Button>
        ))}
        {scoringEnabled && (present.length > 0 || teams.length > 0) && (
          <label className="flex items-center gap-2 text-xs text-muted">
            Points to
            <select
              value={awardKey}
              disabled={disabled}
              onChange={e => setAwardKey(e.target.value)}
              className="px-2 py-1 rounded border text-sm border-border bg-surface text-text"
            >
              <option value="">Nobody</option>
              {teams.length > 0 && (
                <optgroup label="Teams">
                  {teams.map(t => (
                    <option key={t.id} value={`team:${t.id}`}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {present.length > 0 && (
                <optgroup label="Players">
                  {present.map(p => (
                    <option key={p.id} value={`player:${p.id}`}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
        )}
        <Button
          size="sm"
          variant="secondary"
          className="ml-auto"
          disabled={disabled || revealed}
          onClick={onReveal}
        >
          <Icon icon={Eye} size="sm" />
          {revealed ? 'Answer revealed' : 'Reveal answer'}
        </Button>
        {onReviewRound && (
          <Button size="sm" variant="secondary" disabled={disabled} onClick={onReviewRound}>
            <Icon icon={ListChecks} size="sm" />
            Round answers
          </Button>
        )}
      </div>
    </section>
  )
}

function parseAward(key: string): RulingAward | null {
  const [kind, id] = key.split(':')
  return (kind === 'player' || kind === 'team') && id ? { kind, id } : null
}
