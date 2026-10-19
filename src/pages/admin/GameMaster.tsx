import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import AdminLayout from '@/components/AdminLayout'
import { Button, useToast, ControlSizeContext } from '@/components/ui'
import type { ControlSize } from '@/components/ui'
import { TransportBanner } from '@/components/gamemaster/TransportBanner'
import type { ScreensPanelProps } from '@/components/gamemaster/ScreensPanel'
import type { MessagePanelProps } from '@/components/gamemaster/MessagePanel'
import { db } from '@/db'
import { logEvent } from '@/db/game-log'
import { loadGameLayouts } from '@/db/layouts'
import { RateLimiter } from '@/lib/rate-limit'
import { isAbortError, retry, transportManager } from '@/transport'
import {
  buildLobbyInfo,
  buildManagedImport,
  serialiseGameState,
  upsertPlayer,
  setPlayerPresence,
  isConnected,
  playersDueForRemoval,
  assignPlayerTeam,
} from '@/pages/admin/gamemaster-utils'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useGameTheme, useResolvedGameTheme } from '@/hooks/useAppTheme'
import { hostNow } from '@/hooks/useBuzzer'
import { runningTimerEvents } from '@/hooks/useTimer'
import { useGameLifecycle } from '@/hooks/useGameLifecycle'
import { usePhaseOverride } from '@/hooks/usePhaseOverride'
import { adjustScore, buildScoreEntries, readScores } from '@/hooks/useScoreboard'
import { buildLogRows, toPublicLogEntries } from '@/lib/game-log-rows'
import { PlayerConnections, messageRecipients, resolveJoin } from '@/pages/admin/player-connections'
import { buildLayoutEvent, type LayoutEvent } from '@/pages/admin/remote-layouts'
import { buildThemeEvent } from '@/pages/admin/remote-theme'
import type { ThemeEvent } from '@/pages/admin/remote-theme'
import type { JoinResult, MessageTarget, PendingJoin } from '@/pages/admin/player-connections'
import type { Game, GamePhase, Player, Team } from '@/db'
import { MAX_LOG_ENTRIES, MAX_SCOREBOARD_ROWS } from '@/transport/messages'
import type {
  LogEntry,
  ScoreboardRow,
  TransportStatus,
  TransportType,
  TransportEvent,
} from '@/transport/types'
import { Lobby } from '@/components/gamemaster/Lobby'
import { ActiveGame } from '@/components/gamemaster/ActiveGame'
import type {
  AnswerHandler,
  BuzzHandler,
  QuestionContent,
  RoundAnswersEvent,
} from '@/components/gamemaster/ActiveGame'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Send a newly admitted player or screen the game's running timers. */
async function sendRunningTimers(connId: string, gameId: string) {
  const timers = await db.timers.where('gameId').equals(gameId).toArray()
  runningTimerEvents(timers, Date.now()).forEach(e => transportManager.sendTo(connId, e))
}

/** A short, readable description of who a MESSAGE went to, for the game log. */
function describeMessageTarget(target: MessageTarget, players: Player[], teams: Team[]): string {
  switch (target.kind) {
    case 'everyone':
      return 'Everyone'
    case 'players':
      return 'All players'
    case 'screens':
      return 'Screens'
    case 'team':
      return teams.find(t => t.id === target.teamId)?.name ?? 'A team'
    case 'player':
      return players.find(p => p.id === target.playerId)?.name ?? 'A player'
  }
}

// Requests waiting for the GM beyond these are turned away, so a flood of connections
// cannot fill the lobby
const MAX_PENDING_JOINS = 100
const MAX_PENDING_SCREENS = 10
// At most this many tab switches per player are logged in any minute
const FOCUS_LOG_LIMIT = 10
const FOCUS_LOG_WINDOW_MS = 60_000
// How often each player may send or change an answer
const ANSWER_LIMIT = 10
const ANSWER_WINDOW_MS = 10_000

// ── Main component ────────────────────────────────────────────────────────────

/** How often the host checks for players disconnected past `Game.autoRemoveAfterMinutes`. */
const AUTO_REMOVE_CHECK_MS = 5_000

export default function GameMaster() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [game, setGame] = useState<Game | null>(null)
  useGameTheme(game?.themeId)
  const [players, setPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [status, setStatus] = useState<TransportStatus>(transportManager.status)
  const [type, setType] = useState<TransportType>(transportManager.transportType)
  const [transportError, setTransportError] = useState<string | null>(transportManager.error)
  const [retrying, setRetrying] = useState<number | null>(null)
  // Bumped by the banner's Retry button to open the room again
  const [connectKey, setConnectKey] = useState(0)
  const [soloBypass, setSoloBypass] = useState(false)
  const [starting, setStarting] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [appSettings, setAppSettings] = useAppSettings()
  const controlSize = appSettings.controlSize
  const setControlSize = useCallback(
    (size: ControlSize) => setAppSettings({ controlSize: size }),
    [setAppSettings]
  )

  const lifecycle = useGameLifecycle()

  // Merge patches into the latest state so overlapping updates (lock toggle, pause) don't
  // revert each other's fields
  const applyGamePatch = useCallback((patch: Partial<Game>) => {
    setGame(g => g && { ...g, ...patch })
  }, [])

  const gameRef = useRef<Game | null>(null)
  const buzzHandlerRef = useRef<BuzzHandler | null>(null)
  const answerHandlerRef = useRef<AnswerHandler | null>(null)
  const connectionsRef = useRef(new PlayerConnections())
  const [pendingJoins, setPendingJoins] = useState<PendingJoin[]>([])
  const pendingJoinsRef = useRef<PendingJoin[]>([])
  // Players kicked this session: their rejoins always wait for approval
  const kickedRef = useRef(new Set<string>())
  // Connections that have sent a JOIN: they are players and cannot also become screens
  const joinersRef = useRef(new Set<string>())
  // Connections whose JOIN is queued or being resolved
  const resolvingRef = useRef(new Set<string>())
  // Connections that have closed: a JOIN or approval still queued for one must not admit it
  const closedRef = useRef(new Set<string>())
  // Caps how many tab switches each player can add to the game log
  const focusLogLimitRef = useRef(new RateLimiter(FOCUS_LOG_LIMIT, FOCUS_LOG_WINDOW_MS))
  const answerLimitRef = useRef(new RateLimiter(ANSWER_LIMIT, ANSWER_WINDOW_MS))
  // JOINs and approvals run one at a time so each sees the teams and players saved by
  // the one before (team limits, same-name team reuse)
  const joinQueueRef = useRef<Promise<void>>(Promise.resolve())
  // What players may currently see of the question; late joiners get it when admitted
  const questionContentRef = useRef<QuestionContent | null>(null)
  // Projector screens on other devices: approved ones get broadcasts, screen content and
  // the scoreboard; pending ones wait for the GM like players do
  const screensRef = useRef(new Set<string>())
  const [connectedScreens, setConnectedScreens] = useState<string[]>([])
  const [pendingScreens, setPendingScreens] = useState<string[]>([])
  const pendingScreensRef = useRef<string[]>([])
  const screenContentRef = useRef<QuestionContent | null>(null)
  // The end-of-round review's answers while it is open, for devices that join meanwhile
  const playerRoundAnswersRef = useRef<RoundAnswersEvent | null>(null)
  const screenRoundAnswersRef = useRef<RoundAnswersEvent | null>(null)
  const scoreboardRef = useRef<ScoreboardRow[]>([])
  const logRef = useRef<LogEntry[]>([])
  // The LAYOUT each kind of remote surface gets; `null` until the stored layouts have loaded
  const playerLayoutRef = useRef<LayoutEvent | null>(null)
  const screenLayoutRef = useRef<LayoutEvent | null>(null)
  // The phase remote surfaces pick layouts for; `null` until it is known
  const phaseRef = useRef<GamePhase | null>(null)
  // The THEME players and screens get; `null` until the host's themes have loaded
  const themeRef = useRef<ThemeEvent | null>(null)

  useEffect(() => {
    gameRef.current = game
  }, [game])

  // Players follow a change of how they answer mid-game: the buzz button or the options
  const inputType = game?.inputType
  const sentInputTypeRef = useRef(inputType)
  useEffect(() => {
    if (sentInputTypeRef.current === inputType || !inputType) return
    const first = sentInputTypeRef.current === undefined
    sentInputTypeRef.current = inputType
    const g = gameRef.current
    if (first || !g || (g.status !== 'active' && g.status !== 'paused')) return
    readScores(g.id)
      .then(scores =>
        transportManager.send({
          type: 'GAME_STATE',
          state: serialiseGameState({ ...g, inputType }, scores),
        })
      )
      .catch(err => console.error('[GameMaster] GAME_STATE resync failed:', err))
  }, [inputType])

  // Mark players who stayed disconnected too long as left, freeing their place (#424)
  const playersRef = useRef<Player[]>([])
  useEffect(() => {
    playersRef.current = players
  }, [players])
  const gameId = game?.id
  const removeAfter = game && game.status !== 'ended' ? game.autoRemoveAfterMinutes : 0
  useEffect(() => {
    if (!gameId || removeAfter <= 0) return
    const id = setInterval(() => {
      const due = playersDueForRemoval(playersRef.current, removeAfter, Date.now())
      if (due.length === 0) return
      const isDue = (p: Player) => due.includes(p.id) && p.presence === 'disconnected'
      setPlayers(prev => prev.map(p => (isDue(p) ? { ...p, presence: 'left' as const } : p)))
      db.players
        .where('id')
        .anyOf(due)
        .filter(isDue)
        .modify({ presence: 'left' })
        .catch(err => console.error('[GameMaster] Removing disconnected players failed:', err))
      for (const playerId of due) {
        logEvent(gameId, 'player_left', { subjectId: playerId, data: { reason: 'timeout' } })
      }
    }, AUTO_REMOVE_CHECK_MS)
    return () => clearInterval(id)
  }, [gameId, removeAfter])

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

  const addConnectedScreen = useCallback((connId: string) => {
    screensRef.current.add(connId)
    setConnectedScreens([...screensRef.current])
  }, [])

  /** Removes a screen from `screensRef`, syncing state. Returns whether it was present. */
  const removeConnectedScreen = useCallback((connId: string) => {
    const removed = screensRef.current.delete(connId)
    if (removed) setConnectedScreens([...screensRef.current])
    return removed
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
      // The room is opened afresh, so nobody saved as connected is connected yet
      .then(ps => {
        const disconnectedAt = Date.now()
        const stale = ps.filter(isConnected).map(p => p.id)
        setPlayers(
          ps
            .map(p =>
              isConnected(p) ? { ...p, presence: 'disconnected' as const, disconnectedAt } : p
            )
            .sort((a, b) => a.joinedAt - b.joinedAt)
        )
        if (stale.length > 0) {
          db.players
            .where('id')
            .anyOf(stale)
            .modify({ presence: 'disconnected', disconnectedAt })
            .catch(err =>
              console.error('[GameMaster] Marking stale players disconnected failed:', err)
            )
        }
      })
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
      setTransportError(transportManager.error)
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

    // Retried a few times: after a reload the server may still hold the room for a moment
    let stopped = false
    retry(() => transportManager.connect({ role: 'host', roomId: game.roomId ?? '' }), {
      cancelled: () => stopped,
      onRetry: setRetrying,
    })
      .catch(err => {
        // Leaving (or remounting) before the room is ready cancels the connect on purpose
        if (isAbortError(err)) return
        console.error('[GameMaster] Transport connect failed:', err)
      })
      .finally(() => {
        if (!stopped) setRetrying(null)
      })

    return () => {
      stopped = true
      unsub()
      setRetrying(null)
      transportManager.disconnect()
    }
  }, [game?.id, gameEnded, connectKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save an accepted join (and the team it creates), bind the connection and send the
  // player the current state
  const admit = useCallback(
    async (connId: string, result: Extract<JoinResult, { status: 'accepted' }>) => {
      const { player, newTeam } = result
      if (closedRef.current.has(connId)) return
      await db.transaction('rw', db.teams, db.players, async () => {
        if (newTeam) await db.teams.add(newTeam)
        await db.players.put(player)
      })
      if (newTeam) {
        setTeams(prev => [...prev, newTeam])
        logEvent(player.gameId, 'team_created', {
          actorId: player.id,
          subjectId: newTeam.id,
          data: { name: newTeam.name },
        })
      }
      logEvent(player.gameId, result.rejoin ? 'player_rejoined' : 'player_joined', {
        actorId: player.id,
        subjectId: player.id,
        data: { name: player.name },
      })
      // Closed while saving: keep the player, disconnected
      if (closedRef.current.has(connId)) {
        const disconnectedAt = Date.now()
        setPlayers(prev =>
          setPlayerPresence(upsertPlayer(prev, player), player.id, 'disconnected', {
            disconnectedAt,
          })
        )
        db.players
          .update(player.id, { presence: 'disconnected', disconnectedAt })
          .catch(err => console.error('[GameMaster] Marking player disconnected failed:', err))
        return
      }
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
      if (playerRoundAnswersRef.current)
        transportManager.sendTo(connId, playerRoundAnswersRef.current)
      if (playerLayoutRef.current) transportManager.sendTo(connId, playerLayoutRef.current)
      if (phaseRef.current)
        transportManager.sendTo(connId, { type: 'PHASE', phase: phaseRef.current })
      if (themeRef.current) transportManager.sendTo(connId, themeRef.current)
      if (g) await sendRunningTimers(connId, g.id)
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

  // Send the end-of-round review's answers to players and screens
  const handleRoundAnswers = useCallback(
    (players: RoundAnswersEvent, screen: RoundAnswersEvent) => {
      playerRoundAnswersRef.current = players.review ? players : null
      screenRoundAnswersRef.current = screen.review ? screen : null
      for (const connId of connectionsRef.current.connections()) {
        transportManager.sendTo(connId, players)
      }
      for (const connId of screensRef.current) transportManager.sendTo(connId, screen)
    },
    []
  )

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

  // Public feed of the game log, sent to screens only (see PUBLIC_LOG_KINDS)
  const logGameRows = useLiveQuery(async () => {
    if (!id) return []
    const [log, buzzes, scores, ps, ts] = await Promise.all([
      db.gameLog.where('gameId').equals(id).toArray(),
      db.buzzEvents.where('gameId').equals(id).toArray(),
      db.scoreEvents.where('gameId').equals(id).toArray(),
      db.players.where('gameId').equals(id).toArray(),
      db.teams.where('gameId').equals(id).toArray(),
    ])
    const names = new Map<string, string>()
    for (const p of ps) names.set(p.id, p.name)
    for (const t of ts) names.set(t.id, t.name)
    return buildLogRows(log, buzzes, scores, names)
  }, [id])
  const logFeed = JSON.stringify(toPublicLogEntries(logGameRows ?? [], MAX_LOG_ENTRIES))
  useEffect(() => {
    const entries = JSON.parse(logFeed) as LogEntry[]
    logRef.current = entries
    for (const connId of screensRef.current) {
      transportManager.sendTo(connId, { type: 'LOG', entries })
    }
  }, [logFeed])

  // Stored layouts for remote players and screens, resent whenever they change. Each
  // surface picks the one for its phase itself, so a phase change needs no resend.
  const storedLayouts = useLiveQuery(() => (id ? loadGameLayouts(id) : []), [id])
  // Compared as JSON, so other game changes don't rebuild and resend the layouts
  const playerAssignments = JSON.stringify(game?.layoutAssignments?.player ?? {})
  const screenAssignments = JSON.stringify(game?.layoutAssignments?.screen ?? {})
  const playerLayout = useMemo(
    () =>
      id && storedLayouts
        ? buildLayoutEvent(storedLayouts, 'player', id, JSON.parse(playerAssignments))
        : null,
    [id, storedLayouts, playerAssignments]
  )
  const screenLayout = useMemo(
    () =>
      id && storedLayouts
        ? buildLayoutEvent(storedLayouts, 'screen', id, JSON.parse(screenAssignments))
        : null,
    [id, storedLayouts, screenAssignments]
  )
  useEffect(() => {
    playerLayoutRef.current = playerLayout
    if (!playerLayout) return
    for (const connId of connectionsRef.current.connections()) {
      transportManager.sendTo(connId, playerLayout)
    }
  }, [playerLayout])
  useEffect(() => {
    screenLayoutRef.current = screenLayout
    if (!screenLayout) return
    for (const connId of screensRef.current) transportManager.sendTo(connId, screenLayout)
  }, [screenLayout])

  // The game's theme, resolved here and sent to admitted players and approved screens
  // whenever it changes: a new game theme, or an edit to the theme or the app theme
  const resolvedTheme = useResolvedGameTheme(game?.themeId)
  useEffect(() => {
    if (!resolvedTheme) return
    const event = buildThemeEvent(resolvedTheme)
    themeRef.current = event
    for (const connId of connectionsRef.current.connections())
      transportManager.sendTo(connId, event)
    for (const connId of screensRef.current) transportManager.sendTo(connId, event)
  }, [resolvedTheme])

  // The layout phase, sent to admitted players and approved screens when it changes. The
  // running game reports it (it knows the buzzes); before the start it is the lobby.
  const [phaseOverride, setPhaseOverride] = usePhaseOverride(id ?? null)
  const handlePhase = useCallback((phase: GamePhase) => {
    if (phaseRef.current === phase) return
    phaseRef.current = phase
    const event = { type: 'PHASE', phase } as const
    for (const connId of connectionsRef.current.connections())
      transportManager.sendTo(connId, event)
    for (const connId of screensRef.current) transportManager.sendTo(connId, event)
  }, [])
  const inLobby = game?.status === 'waiting'
  useEffect(() => {
    if (inLobby) handlePhase('lobby')
  }, [inLobby, handlePhase])

  const enqueueJoin = useCallback((task: () => Promise<void>) => {
    const run = joinQueueRef.current.then(task)
    joinQueueRef.current = run.catch(err => console.error('[GameMaster] Join failed:', err))
    return run
  }, [])

  // Apply the join policy: reject, queue for approval (new players when approval is on,
  // and anyone kicked, this session or before a reload) or admit
  const handleJoin = useCallback(
    async (join: PendingJoin['join'], from: string) => {
      const g = gameRef.current
      if (!g) return
      const result = await resolveJoin(g, join)
      if (result.status === 'rejected') {
        transportManager.sendTo(from, { type: 'JOIN_REJECTED', reason: result.reason })
        return
      }
      if (result.deviceMismatch) {
        addToast(`"${join.playerName}" joined from a different device than before`, {
          variant: 'warning',
          durationMs: 6000,
        })
        logEvent(g.id, 'device_mismatch', {
          actorId: result.player.id,
          subjectId: result.deviceMismatch.playerId,
          data: { name: join.playerName },
        })
      }
      const kicked = result.rejoin && (result.kicked || kickedRef.current.has(result.player.id))
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
        const disconnectedAt = Date.now()
        await db.players.update(playerId, { presence: 'left', disconnectedAt })
        setPlayers(prev => setPlayerPresence(prev, playerId, 'left', { disconnectedAt }))
        logEvent(g.id, 'player_left', { actorId: playerId, subjectId: playerId })
      }

      if (event.type === 'FOCUS_CHANGE') {
        const presence = event.away ? 'hidden' : 'connected'
        // Log only real changes, and only so many per player, so a client switching back
        // and forth cannot flood the log
        const changed = (await db.players.get(playerId))?.presence !== presence
        await db.players.update(playerId, { presence })
        setPlayers(prev => setPlayerPresence(prev, playerId, presence))
        if (changed && focusLogLimitRef.current.allow(playerId)) {
          logEvent(g.id, event.away ? 'player_hidden' : 'player_back', {
            actorId: playerId,
            subjectId: playerId,
          })
        }
      }

      // Answers count only while the game runs, for the question shown (ADR 0023)
      if (event.type === 'ANSWER' && gameRef.current?.status === 'active') {
        const receivedAt = Date.now()
        const handler = answerHandlerRef.current
        if (handler && answerLimitRef.current.allow(playerId)) {
          const input =
            event.choice !== null ? { choice: event.choice } : { text: event.text ?? '' }
          void handler(playerId, event.questionId, input, receivedAt)
        }
      }

      // Buzzes count only while the game runs, whatever a player's device shows
      if (event.type === 'BUZZ' && gameRef.current?.status === 'active') {
        // Stamp arrival before any await, so a slow lookup cannot reorder buzzes
        const receivedAt = hostNow()
        // Delegate to the mounted ActiveGame's useBuzzer
        const handler = buzzHandlerRef.current
        const player = handler ? await db.players.get(playerId) : undefined
        if (handler && player) {
          void handler({
            playerId,
            playerName: player.name,
            teamId: player.teamId,
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

  // A dropped connection marks its player disconnected; they can rejoin from the same device
  useEffect(() => {
    return transportManager.onPeerClose(connId => {
      closedRef.current.add(connId)
      updatePendingJoins(prev => prev.filter(p => p.connId !== connId))
      updatePendingScreens(prev => prev.filter(c => c !== connId))
      const gameId = gameRef.current?.id
      if (removeConnectedScreen(connId) && gameId) logEvent(gameId, 'screen_disconnected')
      joinersRef.current.delete(connId)
      const playerId = connectionsRef.current.unbindConnection(connId)
      if (!playerId) return
      if (gameId) logEvent(gameId, 'player_disconnected', { subjectId: playerId })
      const disconnectedAt = Date.now()
      setPlayers(prev => setPlayerPresence(prev, playerId, 'disconnected', { disconnectedAt }))
      db.players
        .update(playerId, { presence: 'disconnected', disconnectedAt })
        .catch(err => console.error('[GameMaster] Marking player disconnected failed:', err))
    })
  }, [updatePendingJoins, updatePendingScreens, removeConnectedScreen])

  // Approve a queued join. The policy is checked again against the current game and teams,
  // which may have changed while the player waited.
  const handleApproveJoin = useCallback(
    async (connId: string) => {
      const g = gameRef.current
      const pending = pendingJoinsRef.current.find(p => p.connId === connId)
      if (!g || !pending) return
      updatePendingJoins(prev => prev.filter(p => p.connId !== connId))
      const name = pending.join.playerName
      logEvent(g.id, 'join_approved', { data: { name } })
      await enqueueJoin(async () => {
        const result = await resolveJoin(gameRef.current ?? g, pending.join)
        if (result.status === 'rejected') {
          logEvent(g.id, 'join_rejected', { data: { name, reason: result.reason } })
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

  const handleRejectJoin = useCallback(
    (connId: string) => {
      const g = gameRef.current
      const pending = pendingJoinsRef.current.find(p => p.connId === connId)
      if (g && pending) logEvent(g.id, 'join_rejected', { data: { name: pending.join.playerName } })
      updatePendingJoins(prev => prev.filter(p => p.connId !== connId))
      transportManager.sendTo(connId, {
        type: 'JOIN_REJECTED',
        reason: 'The host declined your request',
      })
    },
    [updatePendingJoins]
  )

  // Approve a waiting screen and send it what the screen currently shows
  const handleApproveScreen = useCallback(
    (connId: string) => {
      if (!pendingScreensRef.current.includes(connId)) return
      updatePendingScreens(prev => prev.filter(c => c !== connId))
      addConnectedScreen(connId)
      if (gameRef.current) logEvent(gameRef.current.id, 'screen_approved')
      transportManager.sendTo(connId, { type: 'SCREEN_ACCEPTED' })
      if (screenContentRef.current) transportManager.sendTo(connId, screenContentRef.current)
      if (screenRoundAnswersRef.current)
        transportManager.sendTo(connId, screenRoundAnswersRef.current)
      transportManager.sendTo(connId, { type: 'SCOREBOARD', rows: scoreboardRef.current })
      transportManager.sendTo(connId, { type: 'LOG', entries: logRef.current })
      if (screenLayoutRef.current) transportManager.sendTo(connId, screenLayoutRef.current)
      if (phaseRef.current)
        transportManager.sendTo(connId, { type: 'PHASE', phase: phaseRef.current })
      if (themeRef.current) transportManager.sendTo(connId, themeRef.current)
      const g = gameRef.current
      if (g) void sendRunningTimers(connId, g.id)
      if (g?.status === 'paused') {
        transportManager.sendTo(connId, { type: 'GAME_STATUS', status: 'paused' })
      }
    },
    [updatePendingScreens, addConnectedScreen]
  )

  // Host-initiated disconnect of an already-approved screen
  const handleDisconnectScreen = useCallback(
    (connId: string) => {
      const gameId = gameRef.current?.id
      if (removeConnectedScreen(connId) && gameId) logEvent(gameId, 'screen_disconnected')
      transportManager.closeConnection(connId)
    },
    [removeConnectedScreen]
  )

  const handleRejectScreen = useCallback(
    (connId: string) => {
      const g = gameRef.current
      if (g && pendingScreensRef.current.includes(connId)) logEvent(g.id, 'screen_rejected')
      updatePendingScreens(prev => prev.filter(c => c !== connId))
      transportManager.sendTo(connId, {
        type: 'JOIN_REJECTED',
        reason: 'The host declined the screen',
      })
    },
    [updatePendingScreens]
  )

  const handleSendMessage = useCallback(
    (target: MessageTarget, text: string | null) => {
      const recipients = messageRecipients(
        target,
        connectionsRef.current,
        screensRef.current,
        players
      )
      for (const connId of recipients) transportManager.sendTo(connId, { type: 'MESSAGE', text })
      const g = gameRef.current
      if (g && text) {
        logEvent(g.id, 'message_sent', {
          data: { name: describeMessageTarget(target, players, teams), label: text },
        })
      }
      return recipients.length
    },
    [players, teams]
  )

  // Kick player — mark as kicked in DB + state, broadcast updated game state
  const handleKick = useCallback(async (playerId: string) => {
    const g = gameRef.current
    if (!g) return
    kickedRef.current.add(playerId)
    connectionsRef.current.unbindPlayer(playerId)
    await db.players.update(playerId, { presence: 'kicked' })
    setPlayers(prev => setPlayerPresence(prev, playerId, 'kicked'))
    logEvent(g.id, 'player_kicked', { subjectId: playerId })
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
      notes: '',
    }
    await db.teams.add(team)
    setTeams(prev => [...prev, team])
    logEvent(g.id, 'team_created', { subjectId: team.id, data: { name } })
  }, [])

  const handleRenameTeam = useCallback(async (teamId: string, name: string) => {
    await db.teams.update(teamId, { name })
    setTeams(prev => prev.map(t => (t.id === teamId ? { ...t, name } : t)))
  }, [])

  const handleUpdateTeamNotes = useCallback(async (teamId: string, notes: string) => {
    await db.teams.update(teamId, { notes })
    setTeams(prev => prev.map(t => (t.id === teamId ? { ...t, notes } : t)))
  }, [])

  // Delete a session team, unassigning its members rather than removing them
  const handleDeleteTeam = useCallback(async (teamId: string) => {
    await db.transaction('rw', db.teams, db.players, async () => {
      await db.players.where('teamId').equals(teamId).modify({ teamId: null })
      await db.teams.delete(teamId)
    })
    setPlayers(prev => prev.map(p => (p.teamId === teamId ? { ...p, teamId: null } : p)))
    setTeams(prev => prev.filter(t => t.id !== teamId))
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

  // Host-added player: no device or connection, created directly from the roster
  const handleAddPlayer = useCallback(async (name: string, teamId: string | null) => {
    const g = gameRef.current
    if (!g) return
    const player: Player = {
      id: crypto.randomUUID(),
      gameId: g.id,
      name,
      teamId,
      score: 0,
      presence: 'connected',
      disconnectedAt: null,
      deviceId: crypto.randomUUID(),
      joinedAt: Date.now(),
      notes: '',
    }
    await db.players.add(player)
    setPlayers(prev => upsertPlayer(prev, player))
    logEvent(g.id, 'player_joined', { actorId: player.id, subjectId: player.id, data: { name } })
  }, [])

  const handleAdjustScore = useCallback(async (playerId: string, delta: number) => {
    const g = gameRef.current
    if (!g) return
    await adjustScore(g.id, playerId, 'player', delta)
    const updated = await db.players.get(playerId)
    if (updated) setPlayers(prev => upsertPlayer(prev, updated))
  }, [])

  const handleUpdatePlayerNotes = useCallback(async (playerId: string, notes: string) => {
    await db.players.update(playerId, { notes })
    setPlayers(prev => prev.map(p => (p.id === playerId ? { ...p, notes } : p)))
  }, [])

  // Start the game
  async function handleStart() {
    if (!game) return
    setStarting(true)
    try {
      const now = Date.now()
      const updated = { ...game, status: 'active' as const, updatedAt: now }
      await db.games.update(game.id, { status: 'active', updatedAt: now })
      logEvent(game.id, 'game_started')
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
    connected: connectedScreens,
    onApprove: handleApproveScreen,
    onReject: handleRejectScreen,
    onDisconnect: handleDisconnectScreen,
  }
  const messages: MessagePanelProps = { players, teams, onSend: handleSendMessage }

  if (notFound) {
    return (
      <AdminLayout title="Game not found">
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <p className="text-muted">No game with that ID exists.</p>
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
          <p className="text-muted">Loading…</p>
        </div>
      </AdminLayout>
    )
  }

  // An ended game is offline on purpose
  const transportBanner = gameEnded ? null : (
    <TransportBanner
      status={status}
      error={transportError}
      retrying={retrying}
      onRetry={() => setConnectKey(k => k + 1)}
    />
  )

  if (game.status === 'waiting') {
    return (
      <AdminLayout>
        <ControlSizeContext.Provider value={{ size: controlSize, setSize: setControlSize }}>
          {transportBanner}
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
            onAddPlayer={handleAddPlayer}
            onAssignPlayer={handleAssignPlayer}
            onAdjustScore={handleAdjustScore}
            onUpdatePlayerNotes={handleUpdatePlayerNotes}
            onCreateTeam={handleCreateTeam}
            onImportFromManaged={handleImportFromManaged}
            onRenameTeam={handleRenameTeam}
            onDeleteTeam={handleDeleteTeam}
            onUpdateTeamNotes={handleUpdateTeamNotes}
            onGameChange={applyGamePatch}
            pendingJoins={pendingJoins}
            onApproveJoin={id => void handleApproveJoin(id)}
            onRejectJoin={handleRejectJoin}
            screens={screens}
            messages={messages}
          />
        </ControlSizeContext.Provider>
      </AdminLayout>
    )
  }

  // Active / paused / ended — navigation view
  return (
    <AdminLayout>
      <ControlSizeContext.Provider value={{ size: controlSize, setSize: setControlSize }}>
        {transportBanner}
        <ActiveGame
          game={game}
          onGameChange={applyGamePatch}
          lifecycle={lifecycle}
          buzzHandlerRef={buzzHandlerRef}
          answerHandlerRef={answerHandlerRef}
          pendingJoins={pendingJoins}
          onApproveJoin={id => void handleApproveJoin(id)}
          onRejectJoin={handleRejectJoin}
          players={players}
          teams={teams}
          onKick={handleKick}
          onAddPlayer={handleAddPlayer}
          onAssignPlayer={handleAssignPlayer}
          onAdjustScore={handleAdjustScore}
          onUpdatePlayerNotes={handleUpdatePlayerNotes}
          onCreateTeam={handleCreateTeam}
          onQuestionContent={handleQuestionContent}
          onScreenContent={handleScreenContent}
          onRoundAnswers={handleRoundAnswers}
          screens={screens}
          messages={messages}
          layouts={storedLayouts}
          phaseOverride={phaseOverride}
          onPhaseOverride={setPhaseOverride}
          onPhase={handlePhase}
        />
      </ControlSizeContext.Provider>
    </AdminLayout>
  )
}
