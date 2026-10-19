import { useLiveQuery } from 'dexie-react-hooks'
import { Check, CheckCheck, Lock, Megaphone, X } from 'lucide-react'
import { Button, Icon, Modal } from '@/components/ui'
import { db } from '@/db'
import type { Answer, Player, Team } from '@/db'
import { choiceOptions, textMatches } from '@/db/answers'
import type { SeenAnswer } from '@/db/answers'
import type { RoundReviewRow } from './RoundReviewModal'

interface RoundMarkingModalProps {
  roundName: string
  /** The round's questions, in order. */
  rows: RoundReviewRow[]
  players: Player[]
  teams: Team[]
  disabled?: boolean
  /** Marks typed answers right or wrong. */
  onMarkTyped: (answers: SeenAnswer[], ruling: 'correct' | 'incorrect') => void
  /** Closes the round's open questions to new answers, marking choices. */
  onCloseAnswers: (gameQuestionIds: string[]) => void
  /** Shows players and screens the scores as they stand, in a game that holds them. */
  onAnnounceScores?: () => void
  onClose: () => void
}

/** Who an answer counts for: the team in a team game, else the player. */
const whoOf = (a: Answer) => a.teamId ?? a.playerId

/**
 * The round's answer sheet (ADR 0023): who answered what to each of the round's questions,
 * one row per player or team and one column per question, with each one's correct count.
 * The host marks typed answers here, one by one or all that match at once, after closing the
 * round's questions to new answers. Choices are marked automatically when a question closes.
 */
export function RoundMarkingModal({
  roundName,
  rows,
  players,
  teams,
  disabled = false,
  onMarkTyped,
  onCloseAnswers,
  onAnnounceScores,
  onClose,
}: RoundMarkingModalProps) {
  const ids = rows.map(r => r.gameQuestion.id)
  const answers = useLiveQuery(
    () => db.answers.where('gameQuestionId').anyOf(ids).toArray(),
    [ids.join()]
  )
  const list = answers ?? []

  const nameOf = (who: string) =>
    teams.find(t => t.id === who)?.name ?? players.find(p => p.id === who)?.name ?? 'Unknown'
  const people = [...new Set(list.map(whoOf))]
    .map(who => ({ who, name: nameOf(who) }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const cell = new Map(list.map(a => [`${whoOf(a)}:${a.gameQuestionId}`, a]))

  const answerOf = new Map(rows.map(r => [r.gameQuestion.id, r.question?.answer ?? '']))
  const unmarked = list.filter(a => a.ruling === 'pending' && a.text !== null)
  const matching = unmarked.filter(a =>
    textMatches(a.text ?? '', answerOf.get(a.gameQuestionId) ?? '')
  )
  const open = rows.filter(r => r.gameQuestion.status === 'pending').map(r => r.gameQuestion.id)

  return (
    <Modal open onClose={onClose} title={`Mark answers · ${roundName}`} maxWidth="960px">
      <div className="flex flex-col gap-4">
        {people.length === 0 ? (
          <p className="text-sm text-muted">Nobody has answered this round's questions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="sticky left-0 bg-bg py-1 pr-3 uppercase tracking-wider">
                    Answered by
                  </th>
                  {rows.map(({ gameQuestion, question }, i) => (
                    <th key={gameQuestion.id} className="py-1 pr-3 align-bottom font-normal">
                      <span className="mono font-semibold">#{i + 1}</span>
                      {gameQuestion.status === 'pending' && (
                        <span className="ml-1 text-muted">(open)</span>
                      )}
                      <span className="block font-medium text-text">{question?.answer || '—'}</span>
                    </th>
                  ))}
                  <th className="py-1 uppercase tracking-wider">Correct</th>
                </tr>
              </thead>
              <tbody>
                {people.map(({ who, name }) => (
                  <tr key={who} className="border-t border-border">
                    <th scope="row" className="sticky left-0 bg-bg py-2 pr-3 font-medium">
                      {name}
                    </th>
                    {rows.map(({ gameQuestion, question }, i) => {
                      const a = cell.get(`${who}:${gameQuestion.id}`)
                      if (!a) {
                        return (
                          <td key={gameQuestion.id} className="py-2 pr-3 text-muted">
                            —
                          </td>
                        )
                      }
                      const shown =
                        a.choice !== null
                          ? `${String.fromCharCode(65 + a.choice)} ${question ? (choiceOptions(question)[a.choice] ?? '') : ''}`
                          : a.text
                      const tone =
                        a.ruling === 'correct'
                          ? 'text-positive'
                          : a.ruling === 'incorrect'
                            ? 'text-negative'
                            : 'text-text'
                      return (
                        <td key={gameQuestion.id} className="py-2 pr-3 align-top">
                          <span className={`block break-words ${tone}`}>{shown}</span>
                          {a.text !== null && (
                            <span className="mt-1 flex gap-1">
                              <Button
                                size="sm"
                                variant={a.ruling === 'correct' ? 'secondary' : 'ghost'}
                                aria-label={`Mark ${name} correct on question ${i + 1}`}
                                aria-pressed={a.ruling === 'correct'}
                                disabled={disabled}
                                onClick={() => onMarkTyped([a], 'correct')}
                              >
                                <Icon icon={Check} size="sm" />
                              </Button>
                              <Button
                                size="sm"
                                variant={a.ruling === 'incorrect' ? 'secondary' : 'ghost'}
                                aria-label={`Mark ${name} wrong on question ${i + 1}`}
                                aria-pressed={a.ruling === 'incorrect'}
                                disabled={disabled}
                                onClick={() => onMarkTyped([a], 'incorrect')}
                              >
                                <Icon icon={X} size="sm" />
                              </Button>
                            </span>
                          )}
                        </td>
                      )
                    })}
                    <td className="py-2 mono font-semibold">
                      {list.filter(a => whoOf(a) === who && a.ruling === 'correct').length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="mr-auto text-xs text-muted">
            {unmarked.length === 0 ? 'Everything is marked.' : `${unmarked.length} to mark.`}
          </span>
          <Button
            variant="secondary"
            disabled={disabled || open.length === 0}
            onClick={() => onCloseAnswers(open)}
          >
            <Icon icon={Lock} size="sm" />
            Close answers
          </Button>
          <Button
            variant="secondary"
            disabled={disabled || matching.length === 0}
            onClick={() => onMarkTyped(matching, 'correct')}
          >
            <Icon icon={CheckCheck} size="sm" />
            Mark matching correct
          </Button>
          {onAnnounceScores && (
            <Button variant="secondary" disabled={disabled} onClick={onAnnounceScores}>
              <Icon icon={Megaphone} size="sm" />
              Announce scores
            </Button>
          )}
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  )
}
