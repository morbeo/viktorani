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
import { RoundInfo } from '@/components/gamemaster/RoundInfo'
import { RoundBoundary } from '@/components/RoundBoundary'
import { BuzzerPanel } from '@/components/buzzer/BuzzerPanel'
import { ScoreboardPanel } from '@/components/scoreboard/ScoreboardPanel'
import { GameControls } from '@/components/gamemaster/GameControls'
import { PendingJoinsPanel } from '@/components/gamemaster/PendingJoinsPanel'
import { RosterPanel } from '@/components/gamemaster/RosterPanel'
import { ScreensPanel } from '@/components/gamemaster/ScreensPanel'
import type { ScreensPanelProps } from '@/components/gamemaster/ScreensPanel'
import { MessagePanel } from '@/components/gamemaster/MessagePanel'
import { GameLogPanel } from '@/components/gamemaster/GameLogPanel'
import type { MessagePanelProps } from '@/components/gamemaster/MessagePanel'
import { HostQuestionPanel } from '@/components/host/HostQuestionPanel'
import { Icon } from '@/components/ui'
import { db } from '@/db'
import { buildQuestionContent } from '@/pages/admin/gamemaster-utils'
import { useNavigation } from '@/hooks/useNavigation'
import { useKeyNav } from '@/hooks/useKeyNav'
import { useBuzzer } from '@/hooks/useBuzzer'
import { useTimerList } from '@/hooks/useTimer'
import type { PendingJoin } from '@/pages/admin/player-connections'
import { TimerPanel } from '@/components/timer/TimerPanel'
import { useRegisterCommands } from '@/components/command-palette/commands'
import type { Command } from '@/components/command-palette/commands'
import type { Game, GmDecision, Player, Team } from '@/db'
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
  screens: ScreensPanelProps
  messages: MessagePanelProps
}

export type BuzzHandler = ReturnType<typeof useBuzzer>['handleIncomingBuzz']
export type QuestionContent = Extract<GameEvent, { type: 'QUESTION_CONTENT' }>

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
              color: active ? 'var(--color-gold)' : 'var(--color-muted)',
              borderBottom: active ? '2px solid var(--color-gold)' : '2px solid transparent',
            }}
          >
            <Icon icon={TABS[id].icon} size="sm" />
            {TABS[id].label}
            {id === 'people' && waiting > 0 && (
              <span
                className="text-xs font-semibold px-1.5 rounded-full"
                style={{ background: 'var(--color-gold)', color: '#fff' }}
              >
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
  screens,
  messages,
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
      {
        id: 'gm:next',
        label: 'Next question',
        group: 'Game',
        icon: ArrowRight,
        shortcut: '→',
        run: goNext,
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
    game.status,
    game.buzzerLocked,
    goNext,
    goPrev,
    toggleLock,
    timers,
    startTimer,
    pauseTimer,
    resumeTimer,
    selectTab,
  ])
  useRegisterCommands('active-game', commands)

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

      <NavHeader pos={pos} seq={seq} onPrev={goPrev} onNext={goNext} />

      <HostTabs
        label="Host sections"
        tabs={['play', ...sideTabs]}
        selected={view === 'play' ? 'play' : activeSide}
        waiting={waiting}
        onSelect={selectTab}
        className="flex lg:hidden"
      />

      <div className="flex-1 min-h-0 flex">
        {/* Play: what the host uses every few seconds */}
        <div
          id="host-panel-play"
          className={`${view === 'play' ? 'block' : 'hidden'} lg:block flex-1 min-w-0 overflow-y-auto px-8 py-6`}
        >
          <div className="max-w-3xl mx-auto flex flex-col gap-6">
            {/* Question context */}
            <RoundInfo pos={pos} seq={seq} />

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

            {/* Buzzer panel — hidden when ended or when this game has no buzzer */}
            {!isEnded && game.buzzerEnabled && (
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
