import { useEffect, useState, useCallback, useRef, type RefObject } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode, Rocket, Copy, Check } from 'lucide-react'
import AdminLayout from '@/components/AdminLayout'
import {
  Button,
  TransportPill,
  Icon,
  useToast,
  ControlSizeContext,
  ControlSizePicker,
} from '@/components/ui'
import type { ControlSize } from '@/components/ui'
import { NavHeader } from '@/components/NavHeader'
import { RoundBoundary } from '@/components/RoundBoundary'
import { BuzzerPanel } from '@/components/buzzer/BuzzerPanel'
import { ScoreboardPanel } from '@/components/scoreboard/ScoreboardPanel'
import { RosterPanel } from '@/components/gamemaster/RosterPanel'
import { TeamManagerPanel } from '@/components/gamemaster/TeamManagerPanel'
import { GameControls } from '@/components/gamemaster/GameControls'
import { JoinPolicyPanel } from '@/components/gamemaster/JoinPolicyPanel'
import { PendingJoinsPanel } from '@/components/gamemaster/PendingJoinsPanel'
import { ScreensPanel } from '@/components/gamemaster/ScreensPanel'
import type { ScreensPanelProps } from '@/components/gamemaster/ScreensPanel'
import { HostQuestionPanel } from '@/components/host/HostQuestionPanel'
import { db } from '@/db'
import { transportManager } from '@/transport'
import {
  buildLobbyInfo,
  buildManagedImport,
  buildQuestionContent,
  serialiseGameState,
  upsertPlayer,
  markPlayerAway,
  setPlayerAway,
  assignPlayerTeam,
} from '@/pages/admin/gamemaster-utils'
import { useNavigation } from '@/hooks/useNavigation'
import { useKeyNav } from '@/hooks/useKeyNav'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { hostNow, useBuzzer } from '@/hooks/useBuzzer'
import { useTimerList } from '@/hooks/useTimer'
import { useGameLifecycle } from '@/hooks/useGameLifecycle'
import { buildScoreEntries, readScores } from '@/hooks/useScoreboard'
import { PlayerConnections, resolveJoin } from '@/pages/admin/player-connections'
import type { JoinResult, PendingJoin } from '@/pages/admin/player-connections'
import { TimerPanel } from '@/components/timer/TimerPanel'
import type { Game, Player, Team } from '@/db'
import { MAX_SCOREBOARD_ROWS } from '@/transport/messages'
import type {
  GameEvent,
  ScoreboardRow,
  TransportStatus,
  TransportType,
  TransportEvent,
} from '@/transport/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function joinUrl(roomId: string): string {
  const base = window.location.origin + window.location.pathname
  return `${base}#/join/${roomId}`
}

const STATUS_LABEL: Record<TransportStatus, string> = {
  idle: 'Not connected',
  connecting: 'Connecting…',
  connected: 'Connected',
  disconnected: 'Disconnected',
  error: 'Connection error',
}

// Requests waiting for the GM beyond these are turned away, so a flood of connections
// cannot fill the lobby
const MAX_PENDING_JOINS = 100
const MAX_PENDING_SCREENS = 10

// ── Lobby view ────────────────────────────────────────────────────────────────

interface LobbyProps {
  game: Game
  players: Player[]
  teams: Team[]
  status: TransportStatus
  type: TransportType
  soloBypass: boolean
  onToggleSolo: () => void
  onStart: () => Promise<void>
  starting: boolean
  onKick: (playerId: string) => void
  onCreateTeam: (name: string, color: string, icon: string) => Promise<void>
  onAssignPlayer: (playerId: string, teamId: string | null) => Promise<void>
  onImportFromManaged: () => Promise<void>
  onGameChange: (patch: Partial<Game>) => void
  pendingJoins: PendingJoin[]
  onApproveJoin: (connId: string) => void
  onRejectJoin: (connId: string) => void
  screens: ScreensPanelProps
}

function Lobby({
  game,
  players,
  teams,
  status,
  type,
  soloBypass,
  onToggleSolo,
  onStart,
  starting,
  onKick,
  onCreateTeam,
  onAssignPlayer,
  onImportFromManaged,
  onGameChange,
  pendingJoins,
  onApproveJoin,
  onRejectJoin,
  screens,
}: LobbyProps) {
  const activePlayers = players.filter(p => !p.isAway)
  const canStart = soloBypass || (status === 'connected' && activePlayers.length > 0)
  const url = game.roomId ? joinUrl(game.roomId) : ''
  const [copied, setCopied] = useState(false)

  function handleCopyUrl() {
    if (!url) return
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black" style={{ fontFamily: 'Playfair Display, serif' }}>
            {game.name}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
            Lobby · waiting for players
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ControlSizePicker />
          <TransportPill status={status} type={type} />
        </div>
      </div>

      {/* Error banner */}
      {status === 'error' && (
        <div
          className="px-4 py-3 rounded-lg border text-sm"
          style={{
            borderColor: 'var(--color-red)',
            background: 'var(--color-red)11',
            color: 'var(--color-red)',
          }}
        >
          Transport failed to connect. Check your internet connection and try reloading.
        </div>
      )}

      {/* QR + player list */}
      <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* QR + room code */}
        <div
          className="rounded-xl border flex flex-col items-center gap-4 p-6"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        >
          <p
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-muted)' }}
          >
            <Icon icon={QrCode} size="sm" />
            Scan to join
          </p>

          {url ? (
            <div className="rounded-lg p-3" style={{ background: '#fff' }}>
              <QRCodeSVG value={url} size={160} level="M" />
            </div>
          ) : (
            <div
              className="w-40 h-40 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--color-border)' }}
            >
              <span style={{ color: 'var(--color-muted)' }}>—</span>
            </div>
          )}

          {game.roomId && (
            <div className="text-center w-full">
              <p className="text-xs mb-1" style={{ color: 'var(--color-muted)' }}>
                Room code
              </p>
              <p
                className="mono text-3xl font-bold"
                style={{ color: 'var(--color-ink)', letterSpacing: '0.15em' }}
              >
                {game.roomId}
              </p>

              {/* Join URL + copy */}
              <div
                className="mt-3 flex items-center gap-1.5 rounded-lg px-3 py-1.5 w-full"
                style={{ background: 'var(--color-border)' }}
              >
                <span
                  className="flex-1 text-xs truncate text-left mono"
                  style={{ color: 'var(--color-muted)' }}
                  title={url}
                >
                  {url}
                </span>
                <button
                  onClick={handleCopyUrl}
                  className="shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
                  style={{
                    background: copied ? 'var(--color-green)22' : 'transparent',
                    color: copied ? 'var(--color-green)' : 'var(--color-muted)',
                  }}
                  aria-label={copied ? 'Copied!' : 'Copy join URL'}
                  title={copied ? 'Copied!' : 'Copy join URL'}
                >
                  <Icon icon={copied ? Check : Copy} size="sm" />
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Roster + team management */}
        <div className="flex flex-col gap-4">
          <PendingJoinsPanel
            pending={pendingJoins}
            onApprove={onApproveJoin}
            onReject={onRejectJoin}
          />
          <ScreensPanel {...screens} />
          <RosterPanel players={players} teams={teams} onKick={onKick} />
          <TeamManagerPanel
            game={game}
            teams={teams}
            players={players}
            onCreateTeam={onCreateTeam}
            onAssignPlayer={onAssignPlayer}
            onImportFromManaged={onImportFromManaged}
          />
          <JoinPolicyPanel game={game} onGameChange={onGameChange} />
        </div>
      </div>

      {/* Game info strip */}
      <div
        className="rounded-lg border px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <span style={{ color: 'var(--color-muted)' }}>
          Rounds: <strong style={{ color: 'var(--color-ink)' }}>{game.roundIds.length}</strong>
        </span>
        {game.scoringEnabled && (
          <span style={{ color: 'var(--color-muted)' }}>
            Scoring: <strong style={{ color: 'var(--color-ink)' }}>on</strong>
          </span>
        )}
      </div>

      {/* Start controls */}
      <div
        className="rounded-xl border p-5 flex items-center justify-between gap-4"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <div>
          <p className="text-sm font-semibold">Ready to start?</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
            {canStart
              ? `${soloBypass ? 'Solo mode — ' : ''}${activePlayers.length} player${activePlayers.length !== 1 ? 's' : ''} connected`
              : status !== 'connected'
                ? STATUS_LABEL[status]
                : 'No players connected yet'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <button
              role="switch"
              aria-checked={soloBypass}
              onClick={onToggleSolo}
              className="w-9 h-5 rounded-full transition-all relative shrink-0"
              style={{ background: soloBypass ? 'var(--color-gold)' : 'var(--color-border)' }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: soloBypass ? '1.1rem' : '0.1rem' }}
              />
            </button>
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
              Solo mode
            </span>
          </label>

          <Button variant="primary" size="lg" onClick={onStart} disabled={!canStart || starting}>
            <Icon icon={Rocket} size="sm" />
            {starting ? 'Starting…' : 'Start game'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Active game view ──────────────────────────────────────────────────────────

interface ActiveGameProps {
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
}

type BuzzHandler = ReturnType<typeof useBuzzer>['handleIncomingBuzz']
type QuestionContent = Extract<GameEvent, { type: 'QUESTION_CONTENT' }>

function ActiveGame({
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
}: ActiveGameProps) {
  const [showBoundary, setShowBoundary] = useState(false)
  const [boundaryEntry, setBoundaryEntry] = useState<
    import('@/pages/admin/gamemaster-utils').NavEntry | null
  >(null)
  const [modalOpen] = useState(false)

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

  // Space = toggle buzzer lock (only when no modal open)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (modalOpen) return
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
  }, [modalOpen, toggleLock])

  useKeyNav({
    onNext: goNext,
    onPrev: goPrev,
    modalOpen,
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
              onAdjudicate={(id, decision) => void adjudicate(id, decision)}
              onClear={() => currentQuestionId && void clearBuzzes(currentQuestionId)}
            />
          )}

          {/* Timers — hidden when ended */}
          {!isEnded && <TimerPanel gameId={game.id} hook={timerHook} />}

          {/* Join requests and policy — hidden when ended */}
          {!isEnded && (
            <PendingJoinsPanel
              pending={pendingJoins}
              onApprove={onApproveJoin}
              onReject={onRejectJoin}
            />
          )}
          {!isEnded && <JoinPolicyPanel game={game} onGameChange={onGameChange} />}
          {!isEnded && <ScreensPanel {...screens} />}

          {/* Scoreboard — always visible; ScoreboardPanel itself gates on scoringEnabled */}
          <ScoreboardPanel game={game} />
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GameMaster() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [status, setStatus] = useState<TransportStatus>(transportManager.status)
  const [type, setType] = useState<TransportType>(transportManager.transportType)
  const [soloBypass, setSoloBypass] = useState(false)
  const [starting, setStarting] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [controlSize, setControlSize] = useLocalStorage<ControlSize>('gm-control-size', 'sm')

  const lifecycle = useGameLifecycle()

  // Merge patches into the latest state so overlapping updates (lock toggle, pause) don't
  // revert each other's fields
  const applyGamePatch = useCallback((patch: Partial<Game>) => {
    setGame(g => g && { ...g, ...patch })
  }, [])

  const gameRef = useRef<Game | null>(null)
  const buzzHandlerRef = useRef<BuzzHandler | null>(null)
  const connectionsRef = useRef(new PlayerConnections())
  const [pendingJoins, setPendingJoins] = useState<PendingJoin[]>([])
  const pendingJoinsRef = useRef<PendingJoin[]>([])
  // Players kicked this session: their rejoins always wait for approval
  const kickedRef = useRef(new Set<string>())
  // Connections that have sent a JOIN: they are players and cannot also become screens
  const joinersRef = useRef(new Set<string>())
  // Connections whose JOIN is queued or being resolved
  const resolvingRef = useRef(new Set<string>())
  // JOINs and approvals run one at a time so each sees the teams and players saved by
  // the one before (team limits, same-name team reuse)
  const joinQueueRef = useRef<Promise<void>>(Promise.resolve())
  // What players may currently see of the question; late joiners get it when admitted
  const questionContentRef = useRef<QuestionContent | null>(null)
  // Projector screens on other devices: approved ones get broadcasts, screen content and
  // the scoreboard; pending ones wait for the GM like players do
  const screensRef = useRef(new Set<string>())
  const [pendingScreens, setPendingScreens] = useState<string[]>([])
  const pendingScreensRef = useRef<string[]>([])
  const screenContentRef = useRef<QuestionContent | null>(null)
  const scoreboardRef = useRef<ScoreboardRow[]>([])

  useEffect(() => {
    gameRef.current = game
  }, [game])

  // Broadcasts (scores, timers, buzzer, navigation) reach admitted players and approved
  // screens only, never connections that are still choosing a team or waiting for approval
  useEffect(() => {
    transportManager.setBroadcastFilter(
      connId =>
        connectionsRef.current.playerFor(connId) !== undefined || screensRef.current.has(connId)
    )
    return () => transportManager.setBroadcastFilter(null)
  }, [])

  // The waiting lists live in refs, so each request sees the ones before it even before
  // React renders, and are copied to state for rendering
  const updatePendingJoins = useCallback((next: (prev: PendingJoin[]) => PendingJoin[]) => {
    pendingJoinsRef.current = next(pendingJoinsRef.current)
    setPendingJoins(pendingJoinsRef.current)
  }, [])

  const updatePendingScreens = useCallback((next: (prev: string[]) => string[]) => {
    pendingScreensRef.current = next(pendingScreensRef.current)
    setPendingScreens(pendingScreensRef.current)
  }, [])

  // Load game + existing players + teams on mount
  useEffect(() => {
    if (!id) return
    db.games.get(id).then(g => {
      if (!g) {
        setNotFound(true)
        return
      }
      setGame(g)
    })
    db.players
      .where('gameId')
      .equals(id)
      .toArray()
      .then(ps => setPlayers(ps.sort((a, b) => a.joinedAt - b.joinedAt)))
    db.teams
      .where('gameId')
      .equals(id)
      .toArray()
      .then(ts => setTeams(ts))
  }, [id])

  // Connect transport when a live game is loaded. An ended game stays offline so it
  // never re-registers the room or admits players and buzzes; restarting it reconnects.
  const gameEnded = game?.status === 'ended'
  useEffect(() => {
    if (!game || gameEnded) return

    const unsub = transportManager.onStatusChange((s, t) => {
      setStatus(s)
      setType(t)
      // Re-sync players when transport reconnects mid-game
      if (s === 'connected') {
        const g = gameRef.current
        if (g && (g.status === 'active' || g.status === 'paused')) {
          readScores(g.id)
            .then(scores =>
              transportManager.send({ type: 'GAME_STATE', state: serialiseGameState(g, scores) })
            )
            .catch(err => console.error('[GameMaster] GAME_STATE resync failed:', err))
        }
      }
    })

    transportManager
      .connect({
        role: 'host',
        roomId: game.roomId ?? '',
      })
      .catch(err => {
        console.error('[GameMaster] Transport connect failed:', err)
      })

    return () => {
      unsub()
      transportManager.disconnect()
    }
  }, [game?.id, gameEnded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save an accepted join (and the team it creates), bind the connection and send the
  // player the current state
  const admit = useCallback(
    async (connId: string, result: Extract<JoinResult, { status: 'accepted' }>) => {
      const { player, newTeam } = result
      await db.transaction('rw', db.teams, db.players, async () => {
        if (newTeam) await db.teams.add(newTeam)
        await db.players.put(player)
      })
      if (newTeam) setTeams(prev => [...prev, newTeam])
      kickedRef.current.delete(player.id)
      connectionsRef.current.bind(connId, player.id)
      setPlayers(prev => upsertPlayer(prev, player))
      transportManager.sendTo(connId, {
        type: 'JOIN_ACCEPTED',
        playerId: player.id,
        teamId: player.teamId,
      })
      const g = gameRef.current
      if (g) {
        const scores = await readScores(g.id)
        transportManager.sendTo(connId, {
          type: 'GAME_STATE',
          state: serialiseGameState(g, scores),
        })
      }
      if (questionContentRef.current) transportManager.sendTo(connId, questionContentRef.current)
      addToast(`${player.name} joined the game`, { variant: 'info', durationMs: 4000 })
    },
    [addToast]
  )

  // Question content goes only to admitted players, never to every open connection
  const handleQuestionContent = useCallback((content: QuestionContent | null) => {
    questionContentRef.current = content
    if (!content) return
    for (const connId of connectionsRef.current.connections()) {
      transportManager.sendTo(connId, content)
    }
  }, [])

  const handleScreenContent = useCallback((content: QuestionContent | null) => {
    screenContentRef.current = content
    if (!content) return
    for (const connId of screensRef.current) transportManager.sendTo(connId, content)
  }, [])

  // Names and scores for approved screens, sent whenever they change. Empty when scoring
  // is off, so the screen hides its scoreboard.
  const scoreEntries = useLiveQuery(async () => {
    if (!id) return []
    const [ps, ts] = await Promise.all([
      db.players.where('gameId').equals(id).toArray(),
      db.teams.where('gameId').equals(id).toArray(),
    ])
    return buildScoreEntries(ps, ts)
  }, [id])
  const scoreboard =
    game?.scoringEnabled && scoreEntries
      ? JSON.stringify(
          scoreEntries
            .slice(0, MAX_SCOREBOARD_ROWS)
            .map(e => ({ id: e.id, name: e.name, score: e.score }))
        )
      : '[]'
  useEffect(() => {
    const rows = JSON.parse(scoreboard) as ScoreboardRow[]
    scoreboardRef.current = rows
    for (const connId of screensRef.current) {
      transportManager.sendTo(connId, { type: 'SCOREBOARD', rows })
    }
  }, [scoreboard])

  const enqueueJoin = useCallback((task: () => Promise<void>) => {
    const run = joinQueueRef.current.then(task)
    joinQueueRef.current = run.catch(err => console.error('[GameMaster] Join failed:', err))
    return run
  }, [])

  // Apply the join policy: reject, queue for approval (new players when approval is on,
  // and anyone kicked this session) or admit
  const handleJoin = useCallback(
    async (join: PendingJoin['join'], from: string) => {
      const g = gameRef.current
      if (!g) return
      const result = await resolveJoin(g, join)
      if (result.status === 'rejected') {
        transportManager.sendTo(from, { type: 'JOIN_REJECTED', reason: result.reason })
        return
      }
      const kicked = result.rejoin && kickedRef.current.has(result.player.id)
      if ((g.requireApproval && !result.rejoin) || kicked) {
        const waiting = pendingJoinsRef.current
        if (waiting.length >= MAX_PENDING_JOINS && !waiting.some(p => p.connId === from)) {
          transportManager.sendTo(from, {
            type: 'JOIN_REJECTED',
            reason: 'Too many players are waiting. Try again later.',
          })
          return
        }
        updatePendingJoins(prev => [...prev.filter(p => p.connId !== from), { connId: from, join }])
        transportManager.sendTo(from, { type: 'JOIN_PENDING' })
        addToast(`${join.playerName} is waiting for approval`, {
          variant: 'info',
          durationMs: 4000,
        })
        return
      }
      await admit(from, result)
    },
    [addToast, admit, updatePendingJoins]
  )

  // Subscribe to player JOIN / LEAVE / FOCUS_CHANGE / BUZZ events. The sending player is
  // derived from the connection (`from`), never from the payload.
  const handleEvent = useCallback(
    async (event: TransportEvent, from: string) => {
      const g = gameRef.current
      if (!g) return

      // An approved screen only listens
      if (screensRef.current.has(from)) return

      if (event.type === 'SCREEN_JOIN') {
        if (joinersRef.current.has(from) || pendingScreensRef.current.includes(from)) return
        if (pendingScreensRef.current.length >= MAX_PENDING_SCREENS) {
          transportManager.sendTo(from, {
            type: 'JOIN_REJECTED',
            reason: 'Too many screens are waiting. Try again later.',
          })
          return
        }
        updatePendingScreens(prev => [...prev, from])
        transportManager.sendTo(from, { type: 'JOIN_PENDING' })
        addToast('A screen is waiting for approval', { variant: 'info', durationMs: 4000 })
        return
      }

      if (event.type === 'JOIN') {
        // One JOIN per connection at a time: more would only queue up database lookups
        if (pendingScreensRef.current.includes(from) || resolvingRef.current.has(from)) return
        joinersRef.current.add(from)
        resolvingRef.current.add(from)
        await enqueueJoin(() => handleJoin(event, from)).finally(() =>
          resolvingRef.current.delete(from)
        )
        return
      }

      // Everything else must come from a joined connection
      const playerId = connectionsRef.current.playerFor(from)
      if (!playerId) return

      if (event.type === 'LEAVE') {
        connectionsRef.current.unbindConnection(from)
        await db.players.update(playerId, { isAway: true })
        setPlayers(prev => markPlayerAway(prev, playerId))
      }

      if (event.type === 'FOCUS_CHANGE') {
        await db.players.update(playerId, { isAway: event.away })
        setPlayers(prev => setPlayerAway(prev, playerId, event.away))
      }

      if (event.type === 'BUZZ') {
        // Stamp arrival before any await, so a slow lookup cannot reorder buzzes
        const receivedAt = hostNow()
        // Delegate to the mounted ActiveGame's useBuzzer
        const handler = buzzHandlerRef.current
        const player = handler ? await db.players.get(playerId) : undefined
        if (handler && player) {
          void handler({
            playerId,
            playerName: player.name,
            teamId: null, // looked up in useBuzzer
            timestamp: event.timestamp,
            receivedAt,
          })
        }
      }
    },
    [addToast, enqueueJoin, handleJoin, updatePendingScreens]
  )

  useEffect(() => {
    return transportManager.onEvent(handleEvent)
  }, [handleEvent])

  // Send join choices to each new connection, and to every connection whenever they change
  // so open join screens follow the settings live (joined players ignore LOBBY_INFO)
  const lobbyInfo = game ? JSON.stringify(buildLobbyInfo(game, teams, players)) : null
  const lobbyInfoRef = useRef<string | null>(null)
  useEffect(() => {
    lobbyInfoRef.current = lobbyInfo
    if (lobbyInfo) transportManager.sendToAll(JSON.parse(lobbyInfo) as TransportEvent)
  }, [lobbyInfo])

  useEffect(() => {
    return transportManager.onPeerOpen(connId => {
      const info = lobbyInfoRef.current
      if (info) transportManager.sendTo(connId, JSON.parse(info) as TransportEvent)
    })
  }, [])

  // A dropped connection marks its player away; they can rejoin from the same device
  useEffect(() => {
    return transportManager.onPeerClose(connId => {
      updatePendingJoins(prev => prev.filter(p => p.connId !== connId))
      updatePendingScreens(prev => prev.filter(c => c !== connId))
      screensRef.current.delete(connId)
      joinersRef.current.delete(connId)
      const playerId = connectionsRef.current.unbindConnection(connId)
      if (!playerId) return
      setPlayers(prev => markPlayerAway(prev, playerId))
      db.players
        .update(playerId, { isAway: true })
        .catch(err => console.error('[GameMaster] Marking player away failed:', err))
    })
  }, [updatePendingJoins, updatePendingScreens])

  // Approve a queued join. The policy is checked again against the current game and teams,
  // which may have changed while the player waited.
  const handleApproveJoin = useCallback(
    async (connId: string) => {
      const g = gameRef.current
      const pending = pendingJoinsRef.current.find(p => p.connId === connId)
      if (!g || !pending) return
      updatePendingJoins(prev => prev.filter(p => p.connId !== connId))
      await enqueueJoin(async () => {
        const result = await resolveJoin(gameRef.current ?? g, pending.join)
        if (result.status === 'rejected') {
          transportManager.sendTo(connId, { type: 'JOIN_REJECTED', reason: result.reason })
          addToast(`${pending.join.playerName} could not join: ${result.reason}`, {
            variant: 'error',
          })
          return
        }
        await admit(connId, result)
      })
    },
    [addToast, admit, enqueueJoin, updatePendingJoins]
  )

  const handleRejectJoin = useCallback((connId: string) => {
    updatePendingJoins(prev => prev.filter(p => p.connId !== connId))
    transportManager.sendTo(connId, {
      type: 'JOIN_REJECTED',
      reason: 'The host declined your request',
    })
  }, [updatePendingJoins])

  // Approve a waiting screen and send it what the screen currently shows
  const handleApproveScreen = useCallback((connId: string) => {
    if (!pendingScreensRef.current.includes(connId)) return
    updatePendingScreens(prev => prev.filter(c => c !== connId))
    screensRef.current.add(connId)
    transportManager.sendTo(connId, { type: 'SCREEN_ACCEPTED' })
    if (screenContentRef.current) transportManager.sendTo(connId, screenContentRef.current)
    transportManager.sendTo(connId, { type: 'SCOREBOARD', rows: scoreboardRef.current })
  }, [updatePendingScreens])

  const handleRejectScreen = useCallback((connId: string) => {
    updatePendingScreens(prev => prev.filter(c => c !== connId))
    transportManager.sendTo(connId, {
      type: 'JOIN_REJECTED',
      reason: 'The host declined the screen',
    })
  }, [updatePendingScreens])

  // Kick player — mark as away in DB + state, broadcast updated game state
  const handleKick = useCallback(async (playerId: string) => {
    const g = gameRef.current
    if (!g) return
    kickedRef.current.add(playerId)
    connectionsRef.current.unbindPlayer(playerId)
    await db.players.update(playerId, { isAway: true })
    setPlayers(prev => markPlayerAway(prev, playerId))
    const scores = await readScores(g.id)
    transportManager.send({ type: 'GAME_STATE', state: serialiseGameState(g, scores) })
  }, [])

  // Create a session team, persist to DB, broadcast GAME_STATE
  const handleCreateTeam = useCallback(async (name: string, color: string, icon: string) => {
    const g = gameRef.current
    if (!g) return
    const team: Team = {
      id: crypto.randomUUID(),
      gameId: g.id,
      name,
      color,
      icon,
      score: 0,
    }
    await db.teams.add(team)
    setTeams(prev => [...prev, team])
  }, [])

  // Import all active managed teams (and their players) into the session
  const handleImportFromManaged = useCallback(async () => {
    const g = gameRef.current
    if (!g) return

    const [managedTeams, managedPlayers] = await Promise.all([
      db.managedTeams.filter(t => !t.archivedAt).toArray(),
      db.managedPlayers.filter(p => !p.archivedAt).toArray(),
    ])

    // Write teams and players atomically. Fresh game-scoped ids are minted so the same
    // managed record can be imported into more than one game; membership is carried across
    // by team name, and existing session members (matched by name) are skipped.
    await db.transaction('rw', db.teams, db.players, async () => {
      const [existingTeams, existingPlayers] = await Promise.all([
        db.teams.where('gameId').equals(g.id).toArray(),
        db.players.where('gameId').equals(g.id).toArray(),
      ])
      const { newTeams, newPlayers } = buildManagedImport({
        managedTeams,
        managedPlayers,
        existingTeams,
        existingPlayerNames: existingPlayers.map(p => p.name),
        gameId: g.id,
        now: Date.now(),
        newId: () => crypto.randomUUID(),
      })
      if (newTeams.length > 0) await db.teams.bulkAdd(newTeams)
      if (newPlayers.length > 0) await db.players.bulkAdd(newPlayers)
    })

    // Refresh state
    const [freshTeams, freshPlayers] = await Promise.all([
      db.teams.where('gameId').equals(g.id).toArray(),
      db.players.where('gameId').equals(g.id).toArray(),
    ])
    setTeams(freshTeams)
    setPlayers(freshPlayers.sort((a, b) => a.joinedAt - b.joinedAt))
  }, [])

  // Assign a player to a team (or clear), persist to DB, broadcast GAME_STATE
  const handleAssignPlayer = useCallback(async (playerId: string, teamId: string | null) => {
    const g = gameRef.current
    if (!g) return
    await db.players.update(playerId, { teamId })
    setPlayers(prev => assignPlayerTeam(prev, playerId, teamId))
    const scores = await readScores(g.id)
    transportManager.send({ type: 'GAME_STATE', state: serialiseGameState(g, scores) })
  }, [])

  // Start the game
  async function handleStart() {
    if (!game) return
    setStarting(true)
    try {
      const now = Date.now()
      const updated = { ...game, status: 'active' as const, updatedAt: now }
      await db.games.update(game.id, { status: 'active', updatedAt: now })
      setGame(updated)
      transportManager.send({ type: 'GAME_STATUS', status: 'active' })
      const scores = await readScores(game.id)
      transportManager.send({ type: 'GAME_STATE', state: serialiseGameState(updated, scores) })
    } finally {
      setStarting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const screens: ScreensPanelProps = {
    roomId: game?.roomId ?? null,
    pending: pendingScreens,
    onApprove: handleApproveScreen,
    onReject: handleRejectScreen,
  }

  if (notFound) {
    return (
      <AdminLayout title="Game not found">
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <p style={{ color: 'var(--color-muted)' }}>No game with that ID exists.</p>
          <Button variant="secondary" onClick={() => navigate('/admin/games')}>
            ← Back to games
          </Button>
        </div>
      </AdminLayout>
    )
  }

  if (!game) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <p style={{ color: 'var(--color-muted)' }}>Loading…</p>
        </div>
      </AdminLayout>
    )
  }

  if (game.status === 'waiting') {
    return (
      <AdminLayout>
        <ControlSizeContext.Provider value={{ size: controlSize, setSize: setControlSize }}>
          <Lobby
            game={game}
            players={players}
            teams={teams}
            status={status}
            type={type}
            soloBypass={soloBypass}
            onToggleSolo={() => setSoloBypass(s => !s)}
            onStart={handleStart}
            starting={starting}
            onKick={handleKick}
            onCreateTeam={handleCreateTeam}
            onAssignPlayer={handleAssignPlayer}
            onImportFromManaged={handleImportFromManaged}
            onGameChange={applyGamePatch}
            pendingJoins={pendingJoins}
            onApproveJoin={id => void handleApproveJoin(id)}
            onRejectJoin={handleRejectJoin}
            screens={screens}
          />
        </ControlSizeContext.Provider>
      </AdminLayout>
    )
  }

  // Active / paused / ended — navigation view
  return (
    <AdminLayout>
      <ControlSizeContext.Provider value={{ size: controlSize, setSize: setControlSize }}>
        <ActiveGame
          game={game}
          onGameChange={applyGamePatch}
          lifecycle={lifecycle}
          buzzHandlerRef={buzzHandlerRef}
          pendingJoins={pendingJoins}
          onApproveJoin={id => void handleApproveJoin(id)}
          onRejectJoin={handleRejectJoin}
          onQuestionContent={handleQuestionContent}
          onScreenContent={handleScreenContent}
          screens={screens}
        />
      </ControlSizeContext.Provider>
    </AdminLayout>
  )
}
