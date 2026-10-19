import { useEffect, useState, useCallback, useMemo, useRef, type RefObject } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  LockOpen,
  MessageSquare,
  Pause,
  Play,
  ScrollText,
  Trophy,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { NavHeader } from '@/components/NavHeader'
import { RoundBoundary } from '@/components/RoundBoundary'
import { ConfirmSkipModal } from '@/components/gamemaster/ConfirmSkipModal'
import { RoundMarkingModal } from '@/components/gamemaster/RoundMarkingModal'
import { RoundReviewModal } from '@/components/gamemaster/RoundReviewModal'
import type { RoundReviewRow } from '@/components/gamemaster/RoundReviewModal'
import { useRoundReview } from '@/hooks/useRoundReview'
import { AutoAdvanceNotice } from '@/components/gamemaster/AutoAdvanceNotice'
import { useAutoAdvance } from '@/hooks/useAutoAdvance'
import { ScoreboardPanel } from '@/components/scoreboard/ScoreboardPanel'
import { GameControls } from '@/components/gamemaster/GameControls'
import { PendingJoinsPanel } from '@/components/gamemaster/PendingJoinsPanel'
import { RosterPanel } from '@/components/gamemaster/RosterPanel'
import { ScreensPanel } from '@/components/gamemaster/ScreensPanel'
import type { ScreensPanelProps } from '@/components/gamemaster/ScreensPanel'
import { MessagePanel } from '@/components/gamemaster/MessagePanel'
import { GameLogPanel } from '@/components/gamemaster/GameLogPanel'
import type { MessagePanelProps } from '@/components/gamemaster/MessagePanel'
import { Icon } from '@/components/ui'
import { db } from '@/db'
import { buildQuestionContent, buildRoundAnswers } from '@/pages/admin/gamemaster-utils'
import { useNavigation } from '@/hooks/useNavigation'
import { useKeyNav } from '@/hooks/useKeyNav'
import { announceScores } from '@/hooks/useScoreboard'
import { useBuzzer } from '@/hooks/useBuzzer'
import { useTimerList } from '@/hooks/useTimer'
import type { PendingJoin } from '@/pages/admin/player-connections'
import { LayoutRenderer } from '@/widgets/LayoutRenderer'
import { resolveLayout, type LayoutBundle } from '@/widgets/layouts'
import { useRegisterCommands } from '@/components/command-palette/commands'
import type { Command } from '@/components/command-palette/commands'
import type { Game, GamePhase, GmDecision, Player, Team } from '@/db'
import { PhaseControl } from '@/components/gamemaster/PhaseControl'
import { autoPhase, effectivePhase } from '@/lib/layout-phase'
import { updateQuestionStatus } from '@/db/games'
import { revealQuestion, ruleQuestion } from '@/db/rulings'
import { markAnswers, markTypedAnswers, recordAnswer } from '@/db/answers'
import type { AnswerInput, SeenAnswer } from '@/db/answers'
import type { QuestionRuling, RulingAward } from '@/db/rulings'
import { layoutCommands, phaseCommands } from '@/components/gamemaster/layout-commands'
import type { GameEvent } from '@/transport/types'
import { SCOPE_TIMER_LABELS } from '@/components/timer/timer-options'

export interface ActiveGameProps {
  game: Game
  onGameChange: (patch: Partial<Game>) => void
  lifecycle: import('@/hooks/useGameLifecycle').UseGameLifecycleResult
  buzzHandlerRef: RefObject<BuzzHandler | null>
  /** Receives the handler for players' choice answers, `null` when none are taken. */
  answerHandlerRef?: RefObject<AnswerHandler | null>
  pendingJoins: PendingJoin[]
  onApproveJoin: (connId: string) => void
  onRejectJoin: (connId: string) => void
  players: Player[]
  teams: Team[]
  onKick: (playerId: string) => void
  onAddPlayer: (name: string, teamId: string | null) => Promise<void>
  onAssignPlayer: (playerId: string, teamId: string | null) => Promise<void>
  onAdjustScore: (playerId: string, delta: number) => Promise<void>
  onUpdatePlayerNotes: (playerId: string, notes: string) => Promise<void>
  onCreateTeam: (name: string, color: string, icon: string) => Promise<void>
  /** Receives the players' content for the current question, or `null` when there is none. */
  onQuestionContent: (content: QuestionContent | null) => void
  /** Receives the screen's content for the current question, or `null` when there is none. */
  onScreenContent: (content: QuestionContent | null) => void
  /**
   * Receives the end-of-round review's revealed answers for players and the screen
   * whenever they change, with `review: null` once it closes.
   */
  onRoundAnswers?: (players: RoundAnswersEvent, screen: RoundAnswersEvent) => void
  screens: ScreensPanelProps
  messages: MessagePanelProps
  /** Stored layouts for the play column; the built-in default is used when none fits. */
  layouts?: readonly LayoutBundle[]
  /** The GM's chosen layout phase, or `null` to follow the game (#414). */
  phaseOverride?: GamePhase | null
  onPhaseOverride?: (phase: GamePhase | null) => void
  /** Receives the phase layouts are picked for whenever it changes. */
  onPhase?: (phase: GamePhase) => void
}

export type BuzzHandler = ReturnType<typeof useBuzzer>['handleIncomingBuzz']
/** Records a player's answer to the question `questionId`, if it is the one shown. */
export type AnswerHandler = (
  playerId: string,
  questionId: string,
  input: AnswerInput,
  receivedAt: number
) => Promise<void>
export type QuestionContent = Extract<GameEvent, { type: 'QUESTION_CONTENT' }>
export type RoundAnswersEvent = Extract<GameEvent, { type: 'ROUND_ANSWERS' }>

type SideTab = 'people' | 'messages' | 'scoreboard' | 'log'
type TabId = 'play' | SideTab

const TABS: Record<TabId, { label: string; icon: LucideIcon }> = {
  play: { label: 'Play', icon: Play },
  people: { label: 'People', icon: Users },
  messages: { label: 'Messages', icon: MessageSquare },
  scoreboard: { label: 'Scoreboard', icon: Trophy },
  log: { label: 'Log', icon: ScrollText },
}

interface HostTabsProps {
  label: string
  tabs: TabId[]
  selected: TabId
  /** Count shown on the People tab: joins and screens waiting for approval. */
  waiting: number
  onSelect: (tab: TabId) => void
  className: string
}

function HostTabs({ label, tabs, selected, waiting, onSelect, className }: HostTabsProps) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`border-b shrink-0 ${className}`}
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      {tabs.map(id => {
        const active = id === selected
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            aria-controls={`host-panel-${id}`}
            onClick={() => onSelect(id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium"
            style={{
              color: active ? 'var(--color-accent)' : 'var(--color-muted)',
              borderBottom: active ? '2px solid var(--color-accent)' : '2px solid transparent',
            }}
          >
            <Icon icon={TABS[id].icon} size="sm" />
            {TABS[id].label}
            {id === 'people' && waiting > 0 && (
              <span className="text-xs font-semibold px-1.5 rounded-full bg-accent text-on-accent">
                {waiting}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function ActiveGame({
  game,
  onGameChange,
  lifecycle,
  buzzHandlerRef,
  answerHandlerRef,
  pendingJoins,
  onApproveJoin,
  onRejectJoin,
  players,
  teams,
  onKick,
  onAddPlayer,
  onAssignPlayer,
  onAdjustScore,
  onUpdatePlayerNotes,
  onCreateTeam,
  onQuestionContent,
  onScreenContent,
  onRoundAnswers,
  screens,
  messages,
  layouts = [],
  phaseOverride = null,
  onPhaseOverride,
  onPhase,
}: ActiveGameProps) {
  const [showBoundary, setShowBoundary] = useState(false)
  // Narrow screens show either the play column or the side panel; wide screens show both
  const [view, setView] = useState<'play' | 'side'>('play')
  const [sideTab, setSideTab] = useState<SideTab>('people')
  const [boundaryEntry, setBoundaryEntry] = useState<
    import('@/pages/admin/gamemaster-utils').NavEntry | null
  >(null)

  const handleBoundary = useCallback((entry: import('@/pages/admin/gamemaster-utils').NavEntry) => {
    setBoundaryEntry(entry)
    setShowBoundary(true)
  }, [])

  const { seq, pos, goNext, goPrev, isReady, isEmpty } = useNavigation(game, handleBoundary)

  // The end-of-round answer review (ADR 0023). With answers shown at the end of the round,
  // Next on a round's last question opens it once, and Continue in it moves on.
  const [review, setReview] = useRoundReview(game.id)
  const [continueAfterReview, setContinueAfterReview] = useState(false)
  const reviewedRoundsRef = useRef(new Set<string>())
  const leaveRound = useCallback(() => {
    const current = pos ? seq[pos.flatIndex] : undefined
    const next = pos ? seq[pos.flatIndex + 1] : undefined
    const lastOfRound = current && next && next.roundId !== current.roundId
    if (
      game.revealTiming === 'endOfRound' &&
      current &&
      lastOfRound &&
      !reviewedRoundsRef.current.has(current.roundId)
    ) {
      setReview({ roundId: current.roundId, view: 'list' })
      setContinueAfterReview(true)
      return
    }
    void goNext()
  }, [game.revealTiming, pos, seq, goNext, setReview])
  const closeReview = useCallback(() => {
    if (review) reviewedRoundsRef.current.add(review.roundId)
    setReview(null)
    setContinueAfterReview(false)
  }, [review, setReview])
  const continueFromReview = useCallback(() => {
    closeReview()
    void goNext()
  }, [closeReview, goNext])

  // Confirm before leaving a question with no ruling, when the setting is on
  const [confirmingNav, setConfirmingNav] = useState(false)
  const confirmedGoNext = useCallback(() => {
    const current = pos ? seq[pos.flatIndex] : undefined
    if (game.confirmUnruledNavigation && current?.questionStatus === 'pending') {
      setConfirmingNav(true)
      return
    }
    leaveRound()
  }, [game.confirmUnruledNavigation, pos, seq, leaveRound])

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
  // changes what players may see, or reveals the answer
  const playerVisibility = game.visibility.players
  const revealed = gameQuestion?.revealed ?? false
  // Players pick an option or type an answer until the question is closed: its answers
  // marked, a ruling, or moving on
  const accepts =
    (game.inputType === 'choice' || game.inputType === 'text') && gameQuestion?.status === 'pending'
      ? game.inputType
      : null
  useEffect(() => {
    onQuestionContent(
      question
        ? buildQuestionContent(question, 'players', playerVisibility, revealed, accepts)
        : null
    )
  }, [question, playerVisibility, revealed, accepts, onQuestionContent])

  // Same for approved screens, with the screen's visibility
  const screenVisibility = game.visibility.screen
  useEffect(() => {
    onScreenContent(
      question ? buildQuestionContent(question, 'screen', screenVisibility, revealed) : null
    )
  }, [question, screenVisibility, revealed, onScreenContent])

  // A round's questions, in order, for the answer review and the answer sheet
  const roundRows = useCallback(
    async (roundId: string | undefined): Promise<RoundReviewRow[]> => {
      if (!roundId) return []
      const gqs = await db.gameQuestions
        .where('gameId')
        .equals(game.id)
        .filter(gq => gq.roundId === roundId)
        .sortBy('order')
      const qs = await db.questions.bulkGet(gqs.map(gq => gq.questionId))
      return gqs.map((gameQuestion, i) => ({ gameQuestion, question: qs[i] }))
    },
    [game.id]
  )

  // The round under review and its questions
  const reviewRound = review ? seq.find(e => e.roundId === review.roundId) : undefined
  const reviewRows = useLiveQuery(() => roundRows(review?.roundId), [roundRows, review?.roundId])

  // The round whose answer sheet the host has open, and its questions shown so far: one not
  // yet reached has no answers, and closing the round's answers must leave it open
  const [markingRoundId, setMarkingRoundId] = useState<string | null>(null)
  const markingRound = markingRoundId ? seq.find(e => e.roundId === markingRoundId) : undefined
  // From the navigation position, so it is known before the question's row has loaded
  const shownIds = (pos ? seq.slice(0, pos.flatIndex + 1) : []).map(e => e.gameQuestionId).join()
  const markingRows = useLiveQuery(async () => {
    const shown = new Set(shownIds.split(','))
    return (await roundRows(markingRoundId ?? undefined)).filter(r => shown.has(r.gameQuestion.id))
  }, [roundRows, markingRoundId, shownIds])

  // Send the review's revealed answers while it is open, and close it on players and screens
  const reviewOpenRef = useRef(false)
  useEffect(() => {
    if (!onRoundAnswers) return
    if (review && reviewRound && reviewRows) {
      reviewOpenRef.current = true
      const build = (target: 'players' | 'screen') =>
        buildRoundAnswers(
          reviewRound.roundName,
          review.view,
          reviewRows,
          target,
          target === 'players' ? playerVisibility : screenVisibility
        )
      onRoundAnswers(build('players'), build('screen'))
    } else if (!review && reviewOpenRef.current) {
      reviewOpenRef.current = false
      onRoundAnswers(
        { type: 'ROUND_ANSWERS', target: 'players', review: null },
        { type: 'ROUND_ANSWERS', target: 'screen', review: null }
      )
    }
  }, [review, reviewRound, reviewRows, playerVisibility, screenVisibility, onRoundAnswers])

  const { displayBuzzes, buzzes, toggleLock, adjudicate, clearBuzzes, handleIncomingBuzz } =
    useBuzzer(game, currentQuestionId, onGameChange)

  // The phase every surface's layout is picked for: from the buzzes on the question shown,
  // unless the GM holds one by hand
  const auto = autoPhase(game.status, buzzes, revealed)
  const phase = effectivePhase(auto, phaseOverride)
  useEffect(() => {
    onPhase?.(phase)
  }, [phase, onPhase])

  const timerHook = useTimerList(game.id)
  const timerHookRef = useRef(timerHook)
  useEffect(() => {
    timerHookRef.current = timerHook
  }, [timerHook])

  // Move on by itself after a correct ruling or when the question timer runs out
  const autoAdvance = useAutoAdvance({
    game,
    flatIndex: pos?.flatIndex ?? null,
    isLast: !pos || pos.flatIndex >= seq.length - 1,
    timers: timerHook.timers,
    onAdvance: goNext,
  })
  const { onCorrect } = autoAdvance

  // Show the answer of the question shown to players and screens
  const handleReveal = useCallback(async () => {
    if (currentGameQuestionId) await revealQuestion(game.id, currentGameQuestionId)
  }, [game.id, currentGameQuestionId])

  // Rule on the buzz, then record the result against the question shown. A correct buzz
  // ends the question, so it reveals the answer when the game reveals after each ruling.
  const handleAdjudicate = useCallback(
    async (buzzId: string, decision: GmDecision) => {
      await adjudicate(buzzId, decision)
      if (currentGameQuestionId) await updateQuestionStatus(currentGameQuestionId, decision)
      if (decision === 'Correct') {
        if (game.revealTiming === 'perQuestion') await handleReveal()
        onCorrect()
      }
    },
    [adjudicate, currentGameQuestionId, game.revealTiming, handleReveal, onCorrect]
  )

  // Close the question shown to new answers, marking players' choices
  const handleMark = useCallback(async () => {
    if (!currentGameQuestionId) return
    const result = await markAnswers(game, currentGameQuestionId)
    if (!result) return
    if (game.revealTiming === 'perQuestion') await handleReveal()
    if (result.status === 'correct') onCorrect()
  }, [game, currentGameQuestionId, handleReveal, onCorrect])

  // Close the round's open questions to new answers from its answer sheet, marking choices
  const handleCloseRound = useCallback(
    async (gameQuestionIds: string[]) => {
      for (const id of gameQuestionIds) await markAnswers(game, id, 'skipped')
    },
    [game]
  )

  // Mark typed answers right or wrong
  const handleMarkTyped = useCallback(
    (answers: SeenAnswer[], ruling: 'correct' | 'incorrect') =>
      markTypedAnswers(game, answers, ruling),
    [game]
  )

  // Rule on the question without a buzz, e.g. in a game with no buzzer. Players' choices
  // are marked first, so the ruling can't award a correct answer's points twice.
  const handleRule = useCallback(
    async (ruling: QuestionRuling, award: RulingAward | null) => {
      if (!currentGameQuestionId) return
      await markAnswers(game, currentGameQuestionId, ruling)
      await ruleQuestion(game, currentGameQuestionId, ruling, award)
      if (game.revealTiming === 'perQuestion') await handleReveal()
      if (ruling === 'correct') onCorrect()
    },
    [game, currentGameQuestionId, handleReveal, onCorrect]
  )

  // Auto-reset timers on navigation, then auto-start the question timer for the question
  // shown. The auto-started timer is reused from question to question rather than stacked.
  const prevPos = useRef<typeof pos>(null)
  const autoStartedForRef = useRef<number | null>(null)
  const autoTimerIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!pos) return
    const prev = prevPos.current
    prevPos.current = pos
    const changeType = prev ? (pos.roundIdx !== prev.roundIdx ? 'round' : 'question') : null
    const autoStart =
      game.autoStartTimerOnQuestionShow && autoStartedForRef.current !== pos.flatIndex
    if (autoStart) autoStartedForRef.current = pos.flatIndex
    void (async () => {
      const hook = timerHookRef.current
      if (changeType) await hook.autoReset(changeType)
      if (!autoStart) return
      const reused = hook.timers.find(t => t.id === autoTimerIdRef.current)
      if (reused?.duration === game.defaultTimerDuration) {
        await hook.restartTimer(reused.id)
        return
      }
      if (reused) await hook.deleteTimer(reused.id)
      const t = await hook.createTimer({
        gameId: game.id,
        label: SCOPE_TIMER_LABELS.question,
        duration: game.defaultTimerDuration,
        autoReset: 'question',
      })
      autoTimerIdRef.current = t.id
      await hook.startTimer(t.id)
    })()
  }, [pos, game.autoStartTimerOnQuestionShow, game.defaultTimerDuration, game.id])

  // Hand handleIncomingBuzz to the parent's transport listener; cleared on unmount
  // so buzzes are never recorded against a game that is no longer open
  useEffect(() => {
    buzzHandlerRef.current = handleIncomingBuzz
    return () => {
      buzzHandlerRef.current = null
    }
  }, [buzzHandlerRef, handleIncomingBuzz])

  // Hand the parent's transport listener a handler for answers to the question shown, in a
  // game that takes them; cleared on unmount and when the question changes. `recordAnswer`
  // checks the answer is the kind the game takes.
  useEffect(() => {
    if (!answerHandlerRef) return
    const takesAnswers = game.inputType === 'choice' || game.inputType === 'text'
    if (!takesAnswers || !currentGameQuestionId || !currentQuestionId) {
      answerHandlerRef.current = null
      return
    }
    answerHandlerRef.current = async (playerId, questionId, input, receivedAt) => {
      if (questionId !== currentQuestionId) return
      await recordAnswer(game.id, currentGameQuestionId, playerId, input, receivedAt)
    }
    return () => {
      answerHandlerRef.current = null
    }
  }, [answerHandlerRef, game.id, game.inputType, currentGameQuestionId, currentQuestionId])

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
    onNext: confirmedGoNext,
    onPrev: goPrev,
    modalOpen: confirmingNav,
    enabled: game.status === 'active',
  })

  const selectTab = useCallback((tab: TabId) => {
    if (tab === 'play') {
      setView('play')
    } else {
      setView('side')
      setSideTab(tab)
    }
  }, [])

  // Game commands for the command palette
  const { timers, startTimer, pauseTimer, resumeTimer } = timerHook
  const commands = useMemo<Command[]>(() => {
    const showScoreboard: Command = {
      id: 'gm:scoreboard',
      label: 'Show scoreboard',
      group: 'Game',
      icon: Trophy,
      keywords: 'scores',
      run: () => selectTab('scoreboard'),
    }
    if (game.status === 'ended') return [showScoreboard]
    return [
      ...(onPhaseOverride ? phaseCommands(onPhaseOverride) : []),
      ...layoutCommands({ game, phase, layouts, onGameChange }),
      {
        id: 'gm:next',
        label: 'Next question',
        group: 'Game',
        icon: ArrowRight,
        shortcut: '→',
        run: confirmedGoNext,
      },
      {
        id: 'gm:prev',
        label: 'Previous question',
        group: 'Game',
        icon: ArrowLeft,
        shortcut: '←',
        run: goPrev,
      },
      {
        id: 'gm:lock',
        label: game.buzzerLocked ? 'Unlock buzzer' : 'Lock buzzer',
        group: 'Game',
        icon: game.buzzerLocked ? LockOpen : Lock,
        shortcut: 'Space',
        keywords: 'buzzer lock unlock',
        run: () => void toggleLock(),
      },
      showScoreboard,
      ...timers.map(t => {
        const running = !t.paused && t.startedAt !== null
        const neverStarted = t.paused && t.startedAt === null && t.remaining >= t.duration
        const verb = running ? 'Pause' : neverStarted ? 'Start' : 'Resume'
        const action = running ? pauseTimer : neverStarted ? startTimer : resumeTimer
        return {
          id: `gm:timer:${t.id}`,
          label: `${verb} timer: ${t.label}`,
          group: 'Timer',
          icon: running ? Pause : Play,
          keywords: 'timer',
          run: () => void action(t.id),
        }
      }),
    ]
  }, [
    confirmedGoNext,
    goPrev,
    toggleLock,
    timers,
    startTimer,
    pauseTimer,
    resumeTimer,
    selectTab,
    onPhaseOverride,
    game,
    phase,
    layouts,
    onGameChange,
  ])
  useRegisterCommands('active-game', commands)

  if (isEmpty) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted">
          This game has no questions. Add questions to its rounds, then create a new game.
        </p>
      </div>
    )
  }

  if (!isReady) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted">Loading questions…</p>
      </div>
    )
  }

  if (!pos) return null

  const isEnded = game.status === 'ended'
  const sideTabs: SideTab[] = isEnded
    ? ['scoreboard', 'log']
    : ['people', 'messages', 'scoreboard', 'log']
  const activeSide = sideTabs.includes(sideTab) ? sideTab : 'scoreboard'
  const waiting = pendingJoins.length + screens.pending.length

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

      <NavHeader pos={pos} seq={seq} onPrev={goPrev} onNext={confirmedGoNext} />

      {autoAdvance.pending && (
        <AutoAdvanceNotice pending={autoAdvance.pending} onCancel={autoAdvance.cancel} />
      )}

      <ConfirmSkipModal
        open={confirmingNav}
        onClose={() => setConfirmingNav(false)}
        onConfirm={() => {
          setConfirmingNav(false)
          leaveRound()
        }}
      />

      {review && reviewRound && (
        <RoundReviewModal
          roundName={reviewRound.roundName}
          view={review.view}
          rows={reviewRows ?? []}
          onViewChange={view => setReview({ ...review, view })}
          onReveal={gameQuestionId => void revealQuestion(game.id, gameQuestionId)}
          onClose={closeReview}
          onContinue={continueAfterReview ? continueFromReview : undefined}
          onMarkAnswers={
            game.inputType === 'choice' || game.inputType === 'text'
              ? () => setMarkingRoundId(review.roundId)
              : undefined
          }
        />
      )}

      {markingRoundId && markingRound && (
        <RoundMarkingModal
          roundName={markingRound.roundName}
          rows={markingRows ?? []}
          players={players}
          teams={teams}
          disabled={isEnded}
          onMarkTyped={(answers, ruling) => void handleMarkTyped(answers, ruling)}
          onCloseAnswers={ids => void handleCloseRound(ids)}
          onAnnounceScores={
            game.holdScores && game.scoringEnabled
              ? () => void announceScores(game.id).then(onGameChange)
              : undefined
          }
          onClose={() => setMarkingRoundId(null)}
        />
      )}

      <HostTabs
        label="Host sections"
        tabs={['play', ...sideTabs]}
        selected={view === 'play' ? 'play' : activeSide}
        waiting={waiting}
        onSelect={selectTab}
        className="flex lg:hidden"
      />

      <div className="flex-1 min-h-0 flex">
        {/* Play: what the host uses every few seconds, laid out by the game master layout.
            Each visible widget brings its own top margin, so there's no top padding */}
        <div
          id="host-panel-play"
          className={`${view === 'play' ? 'block' : 'hidden'} lg:block flex-1 min-w-0 overflow-y-auto px-8 pb-6`}
        >
          <div className="max-w-3xl mx-auto">
            {onPhaseOverride && !isEnded && (
              <div className="flex justify-end pt-3">
                <PhaseControl auto={auto} override={phaseOverride} onOverride={onPhaseOverride} />
              </div>
            )}
            <LayoutRenderer
              bundle={resolveLayout(layouts, {
                target: 'gamemaster',
                gameId: game.id,
                phase,
                assignments: game.layoutAssignments?.gamemaster,
              })}
              target="gamemaster"
              data={{
                game,
                onGameChange,
                pos,
                seq,
                nav: { onPrev: goPrev, onNext: confirmedGoNext },
                questionId: currentQuestionId,
                question: question ?? null,
                gameQuestion: gameQuestion ?? null,
                buzzer: {
                  buzzes,
                  displayBuzzes,
                  onToggleLock: () => void toggleLock(),
                  onAdjudicate: (id, decision) => void handleAdjudicate(id, decision),
                  onClear: () => currentQuestionId && void clearBuzzes(currentQuestionId),
                },
                timers: timerHook,
                players,
                teams,
                onRule: (ruling, award) => void handleRule(ruling, award),
                onReveal: () => void handleReveal(),
                onMarkAnswers: () => void handleMark(),
                onMarkTyped: (ids, ruling) => void handleMarkTyped(ids, ruling),
                onMarkRound: () => {
                  const current = pos ? seq[pos.flatIndex] : undefined
                  if (current) setMarkingRoundId(current.roundId)
                },
                onReviewRound: () => {
                  const current = pos ? seq[pos.flatIndex] : undefined
                  if (current) setReview({ roundId: current.roundId, view: 'list' })
                },
              }}
              cellClassName="mt-6"
            />

            {/* Read-only banner for ended games */}
            {isEnded && (
              <div
                className="mt-6 px-4 py-3 rounded-lg border text-sm border-border text-muted"
                style={{
                  background: 'var(--color-border)44',
                }}
              >
                This game has ended. The scoreboard is read-only.
              </div>
            )}
          </div>
        </div>

        {/* Side panel: people, messages, the scoreboard and the log. Panels stay mounted so
            drafts and scroll positions survive switching tabs */}
        <div
          className={`${view === 'side' ? 'flex' : 'hidden'} lg:flex flex-col flex-1 lg:flex-none lg:w-[26rem] min-w-0 lg:border-l`}
          style={{ borderColor: 'var(--color-border)' }}
        >
          <HostTabs
            label="Side panel"
            tabs={sideTabs}
            selected={activeSide}
            waiting={waiting}
            onSelect={selectTab}
            className="hidden lg:flex"
          />
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {!isEnded && (
              <div
                id="host-panel-people"
                role="tabpanel"
                aria-label="People"
                hidden={activeSide !== 'people'}
                className="flex flex-col gap-4"
              >
                <PendingJoinsPanel
                  pending={pendingJoins}
                  onApprove={onApproveJoin}
                  onReject={onRejectJoin}
                />
                <ScreensPanel {...screens} />
                <RosterPanel
                  game={game}
                  players={players}
                  teams={teams}
                  onKick={onKick}
                  onAddPlayer={onAddPlayer}
                  onAssignPlayer={onAssignPlayer}
                  onAdjustScore={onAdjustScore}
                  onUpdatePlayerNotes={onUpdatePlayerNotes}
                  onCreateTeam={onCreateTeam}
                />
              </div>
            )}
            {!isEnded && (
              <div
                id="host-panel-messages"
                role="tabpanel"
                aria-label="Messages"
                hidden={activeSide !== 'messages'}
              >
                <MessagePanel {...messages} />
              </div>
            )}
            {/* ScoreboardPanel itself gates on scoringEnabled */}
            <div
              id="host-panel-scoreboard"
              role="tabpanel"
              aria-label="Scoreboard"
              hidden={activeSide !== 'scoreboard'}
            >
              <ScoreboardPanel game={game} questionId={currentQuestionId} />
            </div>
            <div id="host-panel-log" role="tabpanel" aria-label="Log" hidden={activeSide !== 'log'}>
              <GameLogPanel game={game} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
