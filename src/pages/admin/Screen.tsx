import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { remarkDefinitionList, defListHastHandlers } from 'remark-definition-list'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { db } from '@/db'
import type { Game, Timer } from '@/db'
import { useScoreboard } from '@/hooks/useScoreboard'
import { formatTime } from '@/hooks/useTimer'
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
            <p className="text-2xl" style={{ color: 'var(--color-muted)' }}>{t.label}</p>
          )}
          <p className="mono text-7xl font-bold tabular-nums">
            {formatTime(timerRemaining(t, now))}
          </p>
        </div>
      ))}
    </div>
  )
}

function ScreenScores({ game }: { game: Game }) {
  const { entries } = useScoreboard(game)
  if (!game.scoringEnabled || entries.length === 0) return null

  return (
    <ol className="w-full max-w-3xl flex flex-col gap-2">
      {entries.map(e => (
        <li key={e.id} className="flex items-baseline justify-between gap-6 text-3xl">
          <span className="truncate">{e.name}</span>
          <span className="mono font-bold tabular-nums">{e.score}</span>
        </li>
      ))}
    </ol>
  )
}

/**
 * The projector view of a game, opened by the GM in a second window on the host machine.
 * Reads everything from the local database, so it follows navigation, the `screen`
 * visibility toggles, timers and scores live without a transport connection.
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

  return (
    <main
      className="min-h-screen px-12 py-10 flex flex-col items-center gap-10 text-center"
      style={{ background: 'var(--color-cream)', color: 'var(--color-ink)' }}
    >
      <p className="text-2xl" style={{ color: 'var(--color-muted)' }}>
        {entry
          ? `${entry.roundName} · Question ${inRound.indexOf(entry) + 1} of ${inRound.length}`
          : game.name}
      </p>

      {content?.title && (
        <h1 className="text-6xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>
          {content.title}
        </h1>
      )}

      {content?.description && (
        <div className="note-prose text-3xl max-w-4xl">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkDefinitionList]}
            remarkRehypeOptions={{ handlers: defListHastHandlers }}
            rehypePlugins={[rehypeRaw, rehypeSanitize]}
          >
            {content.description}
          </ReactMarkdown>
        </div>
      )}

      {content?.media && content.mediaType === 'image' && (
        <img src={content.media} alt="Question media" className="max-h-[50vh] object-contain" />
      )}
      {content?.media && content.mediaType === 'audio' && (
        <audio controls src={content.media} className="w-full max-w-2xl" />
      )}
      {content?.media && content.mediaType === 'video' && (
        <video controls src={content.media} className="max-h-[50vh]" />
      )}

      {content?.options && (
        <ol className="grid grid-cols-2 gap-4 w-full max-w-4xl text-3xl text-left">
          {content.options.map((option, i) => (
            <li
              key={i}
              className="rounded-xl border px-6 py-4"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
            >
              <span className="mono mr-4" style={{ color: 'var(--color-muted)' }}>
                {String.fromCharCode(65 + i)}
              </span>
              {option}
            </li>
          ))}
        </ol>
      )}

      <ScreenTimers gameId={game.id} />
      <ScreenScores game={game} />
    </main>
  )
}
