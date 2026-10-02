import { useEffect, useState, useCallback, useRef, type RefObject } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { NavHeader } from '@/components/NavHeader'
import { RoundBoundary } from '@/components/RoundBoundary'
import { BuzzerPanel } from '@/components/buzzer/BuzzerPanel'
import { ScoreboardPanel } from '@/components/scoreboard/ScoreboardPanel'
import { GameControls } from '@/components/gamemaster/GameControls'
import { PendingJoinsPanel } from '@/components/gamemaster/PendingJoinsPanel'
import { ScreensPanel } from '@/components/gamemaster/ScreensPanel'
import type { ScreensPanelProps } from '@/components/gamemaster/ScreensPanel'
import { MessagePanel } from '@/components/gamemaster/MessagePanel'
import type { MessagePanelProps } from '@/components/gamemaster/MessagePanel'
import { HostQuestionPanel } from '@/components/host/HostQuestionPanel'
import { db } from '@/db'
import { buildQuestionContent } from '@/pages/admin/gamemaster-utils'
import { useNavigation } from '@/hooks/useNavigation'
import { useKeyNav } from '@/hooks/useKeyNav'
import { useBuzzer } from '@/hooks/useBuzzer'
import { useTimerList } from '@/hooks/useTimer'
import type { PendingJoin } from '@/pages/admin/player-connections'
import { TimerPanel } from '@/components/timer/TimerPanel'
import type { Game, GmDecision } from '@/db'
import { updateQuestionStatus } from '@/db/games'
import type { GameEvent } from '@/transport/types'

export interface ActiveGameProps {
  game: Game
  onGameChange: (patch: Partial<Game>) => void
  lifecycle: import('@/hooks/useGameLifecycle').UseGameLifecycleResult
  buzzHandlerRef: RefObject<BuzzHandler | null>
  pendingJoins: PendingJoin[]
  onApproveJoin: (connId: string) => void
  onRejectJoin: (connId: string) => void
  /** Receives the players' content for the current question, or `null` when there is none. */
  onQuestionContent: (content: QuestionContent | null) => void
  /** Receives the screen's content for the current question, or `null` when there is none. */
  onScreenContent: (content: QuestionContent | null) => void
  screens: ScreensPanelProps
  messages: MessagePanelProps
}

export type BuzzHandler = ReturnType<typeof useBuzzer>['handleIncomingBuzz']
export type QuestionContent = Extract<GameEvent, { type: 'QUESTION_CONTENT' }>

export function ActiveGame({
  game,
  onGameChange,
  lifecycle,
  buzzHandlerRef,
  pendingJoins,
  onApproveJoin,
  onRejectJoin,
  onQuestionContent,
  onScreenContent,
  screens,
  messages,
}: ActiveGameProps) {
  const [showBoundary, setShowBoundary] = useState(false)
  const [boundaryEntry, setBoundaryEntry] = useState<
    import('@/pages/admin/gamemaster-utils').NavEntry | null
  >(null)

  const handleBoundary = useCallback((entry: import('@/pages/admin/gamemaster-utils').NavEntry) => {
    setBoundaryEntry(entry)
    setShowBoundary(true)
  }, [])

  const { seq, pos, goNext, goPrev, isReady, isEmpty } = useNavigation(game, handleBoundary)

  // Current question ID derived from nav position
  const currentQuestionId = pos ? (seq[pos.flatIndex]?.questionId ?? null) : null
  const currentGameQuestionId = pos ? (seq[pos.flatIndex]?.gameQuestionId ?? null) : null

  const loadedQuestion = useLiveQuery(
    () => (currentQuestionId ? db.questions.get(currentQuestionId) : undefined),
    [currentQuestionId]
  )
  const loadedGameQuestion = useLiveQuery(
    () => (currentGameQuestionId ? db.gameQuestions.get(currentGameQuestionId) : undefined),
    [currentGameQuestionId]
  )
  // Ignore the previous question's result while the new one loads
  const question = loadedQuestion?.id === currentQuestionId ? loadedQuestion : undefined
  const gameQuestion =
    loadedGameQuestion?.id === currentGameQuestionId ? loadedGameQuestion : undefined

  // Send the current question to admitted players on navigation and whenever the GM
  // changes what players may see
  const playerVisibility = game.visibility.players
  useEffect(() => {
    onQuestionContent(question ? buildQuestionContent(question, 'players', playerVisibility) : null)
  }, [question, playerVisibility, onQuestionContent])

  // Same for approved screens, with the screen's visibility
  const screenVisibility = game.visibility.screen
  useEffect(() => {
    onScreenContent(question ? buildQuestionContent(question, 'screen', screenVisibility) : null)
  }, [question, screenVisibility, onScreenContent])

  const { displayBuzzes, buzzes, toggleLock, adjudicate, clearBuzzes, handleIncomingBuzz } =
    useBuzzer(game, currentQuestionId, onGameChange)

  // Rule on the buzz, then record the result against the question shown
  const handleAdjudicate = useCallback(
    async (buzzId: string, decision: GmDecision) => {
      await adjudicate(buzzId, decision)
      if (currentGameQuestionId) await updateQuestionStatus(currentGameQuestionId, decision)
    },
    [adjudicate, currentGameQuestionId]
  )

  const timerHook = useTimerList(game.id)
  const timerHookRef = useRef(timerHook)
  useEffect(() => {
    timerHookRef.current = timerHook
  }, [timerHook])

  // Auto-reset timers on navigation
  const prevPos = useRef<typeof pos>(null)
  useEffect(() => {
    if (!pos || !prevPos.current) {
      prevPos.current = pos
      return
    }
    const prev = prevPos.current
    prevPos.current = pos
    const changeType = pos.roundIdx !== prev.roundIdx ? 'round' : 'question'
    void timerHookRef.current.autoReset(changeType)
  }, [pos])

  // Hand handleIncomingBuzz to the parent's transport listener; cleared on unmount
  // so buzzes are never recorded against a game that is no longer open
  useEffect(() => {
    buzzHandlerRef.current = handleIncomingBuzz
    return () => {
      buzzHandlerRef.current = null
    }
  }, [buzzHandlerRef, handleIncomingBuzz])

  // Space = toggle buzzer lock
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.code === 'Space' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault()
        void toggleLock()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleLock])

  useKeyNav({
    onNext: goNext,
    onPrev: goPrev,
    modalOpen: false,
    enabled: game.status === 'active',
  })

  if (isEmpty) {
    return (
      <div className="flex items-center justify-center py-20">
        <p style={{ color: 'var(--color-muted)' }}>
          This game has no questions. Add questions to its rounds, then create a new game.
        </p>
      </div>
    )
  }

  if (!isReady) {
    return (
      <div className="flex items-center justify-center py-20">
        <p style={{ color: 'var(--color-muted)' }}>Loading questions…</p>
      </div>
    )
  }

  if (!pos) return null

  const isEnded = game.status === 'ended'

  return (
    <div className="flex flex-col h-full -mx-8 -my-6" style={{ height: 'calc(100vh - 64px)' }}>
      {showBoundary && boundaryEntry && (
        <RoundBoundary
          roundName={boundaryEntry.roundName}
          roundIdx={boundaryEntry.roundIdx}
          onDone={() => setShowBoundary(false)}
        />
      )}

      <GameControls game={game} onGameChange={onGameChange} lifecycle={lifecycle} />

      <NavHeader pos={pos} seq={seq} onPrev={goPrev} onNext={goNext} />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          {/* Question context */}
          <div style={{ color: 'var(--color-muted)' }} className="text-sm">
            {seq[pos.flatIndex]?.roundName} · Q {pos.questionIdx + 1} of {pos.roundQuestions}
            <span className="ml-3 text-xs">
              ({pos.flatIndex + 1} / {seq.length} total)
            </span>
          </div>

          {question && gameQuestion && (
            <HostQuestionPanel
              question={question}
              gameQuestion={gameQuestion}
              game={game}
              onGameChange={onGameChange}
            />
          )}

          {/* Read-only banner for ended games */}
          {isEnded && (
            <div
              className="px-4 py-3 rounded-lg border text-sm"
              style={{
                borderColor: 'var(--color-border)',
                background: 'var(--color-border)44',
                color: 'var(--color-muted)',
              }}
            >
              This game has ended. The scoreboard is read-only.
            </div>
          )}

          {/* Buzzer panel — hidden when ended */}
          {!isEnded && (
            <BuzzerPanel
              game={game}
              questionId={currentQuestionId}
              buzzes={buzzes}
              displayBuzzes={displayBuzzes}
              onToggleLock={() => void toggleLock()}
              onAdjudicate={(id, decision) => void handleAdjudicate(id, decision)}
              onClear={() => currentQuestionId && void clearBuzzes(currentQuestionId)}
            />
          )}

          {/* Timers — hidden when ended */}
          {!isEnded && <TimerPanel gameId={game.id} hook={timerHook} />}

          {/* Join requests — hidden when ended */}
          {!isEnded && (
            <PendingJoinsPanel
              pending={pendingJoins}
              onApprove={onApproveJoin}
              onReject={onRejectJoin}
            />
          )}
          {!isEnded && <ScreensPanel {...screens} />}
          {!isEnded && <MessagePanel {...messages} />}

          {/* Scoreboard — always visible; ScoreboardPanel itself gates on scoringEnabled */}
          <ScoreboardPanel game={game} questionId={currentQuestionId} />
        </div>
      </div>
    </div>
  )
}
