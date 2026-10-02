import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import AdminLayout from '@/components/AdminLayout'
import { Button, useToast, ControlSizeContext } from '@/components/ui'
import type { ControlSize } from '@/components/ui'
import { TransportBanner } from '@/components/gamemaster/TransportBanner'
import type { ScreensPanelProps } from '@/components/gamemaster/ScreensPanel'
import type { MessagePanelProps } from '@/components/gamemaster/MessagePanel'
import { db } from '@/db'
import { isAbortError, retry, transportManager } from '@/transport'
import {
  buildLobbyInfo,
  buildManagedImport,
  serialiseGameState,
  upsertPlayer,
  setPlayerPresence,
  isConnected,
  assignPlayerTeam,
} from '@/pages/admin/gamemaster-utils'
import { useAppSettings } from '@/hooks/useAppSettings'
import { hostNow } from '@/hooks/useBuzzer'
import { runningTimerEvents } from '@/hooks/useTimer'
import { useGameLifecycle } from '@/hooks/useGameLifecycle'
import { buildScoreEntries, readScores } from '@/hooks/useScoreboard'
import {
  PlayerConnections,
  messageRecipients,
  resolveJoin,
} from '@/pages/admin/player-connections'
import type { JoinResult, MessageTarget, PendingJoin } from '@/pages/admin/player-connections'
import type { Game, Player, Team } from '@/db'
import { MAX_SCOREBOARD_ROWS } from '@/transport/messages'
import type {
  ScoreboardRow,
  TransportStatus,
  TransportType,
  TransportEvent,
} from '@/transport/types'
import { Lobby } from '@/components/gamemaster/Lobby'
import { ActiveGame } from '@/components/gamemaster/ActiveGame'
import type { BuzzHandler, QuestionContent } from '@/components/gamemaster/ActiveGame'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Send a newly admitted player or screen the game's running timers. */
async function sendRunningTimers(connId: string, gameId: string) {
  const timers = await db.timers.where('gameId').equals(gameId).toArray()
  runningTimerEvents(timers, Date.now()).forEach(e => transportManager.sendTo(connId, e))
}

// Requests waiting for the GM beyond these are turned away, so a flood of connections
// cannot fill the lobby
const MAX_PENDING_JOINS = 100
const MAX_PENDING_SCREENS = 10

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
      // The room is opened afresh, so nobody saved as connected is connected yet
      .then(ps =>
        setPlayers(
          ps
            .map(p => (isConnected(p) ? { ...p, presence: 'disconnected' as const } : p))
            .sort((a, b) => a.joinedAt - b.joinedAt)
        )
      )
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
      if (newTeam) setTeams(prev => [...prev, newTeam])
      // Closed while saving: keep the player, disconnected
      if (closedRef.current.has(connId)) {
        setPlayers(prev =>
          setPlayerPresence(upsertPlayer(prev, player), player.id, 'disconnected')
        )
        db.players
          .update(player.id, { presence: 'disconnected' })
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
      const kicked =
        result.rejoin && (result.kicked || kickedRef.current.has(result.player.id))
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
        await db.players.update(playerId, { presence: 'left' })
        setPlayers(prev => setPlayerPresence(prev, playerId, 'left'))
      }

      if (event.type === 'FOCUS_CHANGE') {
        const presence = event.away ? 'hidden' : 'connected'
        await db.players.update(playerId, { presence })
        setPlayers(prev => setPlayerPresence(prev, playerId, presence))
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
      screensRef.current.delete(connId)
      joinersRef.current.delete(connId)
      const playerId = connectionsRef.current.unbindConnection(connId)
      if (!playerId) return
      setPlayers(prev => setPlayerPresence(prev, playerId, 'disconnected'))
      db.players
        .update(playerId, { presence: 'disconnected' })
        .catch(err => console.error('[GameMaster] Marking player disconnected failed:', err))
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
    const g = gameRef.current
    if (g) void sendRunningTimers(connId, g.id)
    if (g?.status === 'paused') {
      transportManager.sendTo(connId, { type: 'GAME_STATUS', status: 'paused' })
    }
  }, [updatePendingScreens])

  const handleRejectScreen = useCallback((connId: string) => {
    updatePendingScreens(prev => prev.filter(c => c !== connId))
    transportManager.sendTo(connId, {
      type: 'JOIN_REJECTED',
      reason: 'The host declined the screen',
    })
  }, [updatePendingScreens])

  const handleSendMessage = useCallback(
    (target: MessageTarget, text: string | null) => {
      const recipients = messageRecipients(
        target,
        connectionsRef.current,
        screensRef.current,
        players
      )
      for (const connId of recipients) transportManager.sendTo(connId, { type: 'MESSAGE', text })
      return recipients.length
    },
    [players]
  )

  // Kick player — mark as kicked in DB + state, broadcast updated game state
  const handleKick = useCallback(async (playerId: string) => {
    const g = gameRef.current
    if (!g) return
    kickedRef.current.add(playerId)
    connectionsRef.current.unbindPlayer(playerId)
    await db.players.update(playerId, { presence: 'kicked' })
    setPlayers(prev => setPlayerPresence(prev, playerId, 'kicked'))
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
  const messages: MessagePanelProps = { players, teams, onSend: handleSendMessage }

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
            onCreateTeam={handleCreateTeam}
            onAssignPlayer={handleAssignPlayer}
            onImportFromManaged={handleImportFromManaged}
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
          pendingJoins={pendingJoins}
          onApproveJoin={id => void handleApproveJoin(id)}
          onRejectJoin={handleRejectJoin}
          players={players}
          teams={teams}
          onKick={handleKick}
          onQuestionContent={handleQuestionContent}
          onScreenContent={handleScreenContent}
          screens={screens}
          messages={messages}
        />
      </ControlSizeContext.Provider>
    </AdminLayout>
  )
}
