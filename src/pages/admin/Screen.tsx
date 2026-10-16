import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { Game, Timer } from '@/db'
import { ScreenView } from '@/components/screen/ScreenView'
import { loadGameLayouts } from '@/db/layouts'
import { loadBuzzesForQuestion } from '@/hooks/useBuzzer'
import { usePhaseOverride } from '@/hooks/usePhaseOverride'
import { useScoreboard } from '@/hooks/useScoreboard'
import { autoPhase, effectivePhase } from '@/lib/layout-phase'
import { formatTime } from '@/hooks/useTimer'
import type { ScreenData } from '@/widgets/types'
import { buildNavSequence, buildQuestionContent, orderRounds } from '@/pages/admin/gamemaster-utils'

/** Seconds left on a timer at `now`, as the GM's timer panel computes it. */
function timerRemaining(t: Timer, now: number): number {
  if (t.paused || t.startedAt === null) return Math.max(0, t.remaining)
  return Math.max(0, t.remaining - (now - t.startedAt) / 1000)
}

/** Running timers, and paused ones that have already run, that the GM keeps visible. */
function ScreenTimers({ gameId }: { gameId: string }) {
  const timers = useLiveQuery(() => db.timers.where('gameId').equals(gameId).toArray(), [gameId])
  const shown = (timers ?? []).filter(
    t => t.visible && t.target !== 'admin' && (!t.paused || t.remaining < t.duration)
  )
  const running = shown.some(t => !t.paused)
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [running])

  if (shown.length === 0) return null

  return (
    <div className="flex flex-wrap justify-center gap-10">
      {shown.map(t => (
        <div key={t.id} className="flex flex-col items-center">
          {t.label && (
            <p className="text-2xl" style={{ color: 'var(--color-muted)' }}>
              {t.label}
            </p>
          )}
          <p className="mono text-7xl font-bold tabular-nums">
            {formatTime(timerRemaining(t, now))}
          </p>
        </div>
      ))}
    </div>
  )
}

/** The screen layout with this game's scores and timers read from the local database. */
function LocalScreen({
  game,
  heading,
  content,
  questionId,
}: {
  game: Game
  heading: string
  content: ScreenData['content']
  questionId: string | null
}) {
  const { entries } = useScoreboard(game)
  const layouts = useLiveQuery(() => loadGameLayouts(game.id), [game.id])
  // The same phase the GM's window works out, and the GM's override from it
  const buzzes = useLiveQuery(
    () => (questionId ? loadBuzzesForQuestion(game.id, questionId) : []),
    [game.id, questionId]
  )
  const [override] = usePhaseOverride(game.id)
  const phase = effectivePhase(autoPhase(game.status, buzzes ?? []), override)
  return (
    <ScreenView
      layouts={layouts}
      phase={phase}
      assignments={game.layoutAssignments?.screen}
      gameId={game.id}
      data={{
        heading,
        content,
        message: null,
        rows: game.scoringEnabled ? entries : [],
        logEntries: [],
        timers: <ScreenTimers gameId={game.id} />,
      }}
    />
  )
}

/**
 * The projector view of a game, opened by the GM in a second window on the host machine.
 * Reads everything from the local database, so it follows navigation, the `screen`
 * visibility toggles, timers, scores, stored layouts and the layout phase live without a
 * transport connection.
 */
export default function Screen() {
  const { id = '' } = useParams<{ id: string }>()
  const game = useLiveQuery(() => db.games.get(id).then(g => g ?? null), [id])
  const gameQuestions = useLiveQuery(
    () => db.gameQuestions.where('gameId').equals(id).toArray(),
    [id]
  )
  const rounds = useLiveQuery(() => db.rounds.toArray(), [])

  const seq =
    game && gameQuestions && rounds
      ? buildNavSequence(gameQuestions, orderRounds(game.roundIds, rounds))
      : []
  const flatIndex = game ? Math.max(0, Math.min(seq.length - 1, game.currentQuestionIdx)) : 0
  const entry = seq[flatIndex]
  const questionId = entry?.questionId ?? null

  const loaded = useLiveQuery(
    () => (questionId ? db.questions.get(questionId) : undefined),
    [questionId]
  )
  // Ignore the previous question's result while the new one loads
  const question = loaded?.id === questionId ? loaded : undefined

  if (game === undefined) return null
  if (game === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p role="alert">Game not found</p>
      </div>
    )
  }

  const content = question ? buildQuestionContent(question, 'screen', game.visibility.screen) : null
  const inRound = entry ? seq.filter(e => e.roundId === entry.roundId) : []
  const heading = entry
    ? `${entry.roundName} · Question ${inRound.indexOf(entry) + 1} of ${inRound.length}`
    : game.name

  return <LocalScreen game={game} heading={heading} content={content} questionId={questionId} />
}
