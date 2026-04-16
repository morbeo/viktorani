import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode, Rocket, Copy, Check } from 'lucide-react'
import AdminLayout from '@/components/AdminLayout'
import { Button, TransportPill, Icon } from '@/components/ui'
import { NavHeader } from '@/components/NavHeader'
import { RoundBoundary } from '@/components/RoundBoundary'
import { BuzzerPanel } from '@/components/buzzer/BuzzerPanel'
import { ScoreboardPanel } from '@/components/scoreboard/ScoreboardPanel'
import { RosterPanel } from '@/components/gamemaster/RosterPanel'
import { TeamManagerPanel } from '@/components/gamemaster/TeamManagerPanel'
import { db } from '@/db'
import { transportManager } from '@/transport'
import {
  serialiseGameState,
  upsertPlayer,
  markPlayerAway,
  setPlayerAway,
  assignPlayerTeam,
} from '@/pages/admin/gamemaster-utils'
import { useNavigation } from '@/hooks/useNavigation'
import { useKeyNav } from '@/hooks/useKeyNav'
import { useBuzzer } from '@/hooks/useBuzzer'
import { useTimerList, applyAutoReset } from '@/hooks/useTimer'
import { TimerPanel } from '@/components/timer/TimerPanel'
import type { Game, Player, Team } from '@/db'
import type { TransportStatus, TransportType, TransportEvent } from '@/transport/types'

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
        <TransportPill status={status} type={type} />
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
          <RosterPanel players={players} teams={teams} onKick={onKick} />
          <TeamManagerPanel
            game={game}
            teams={teams}
            players={players}
            onCreateTeam={onCreateTeam}
            onAssignPlayer={onAssignPlayer}
            onImportFromManaged={onImportFromManaged}
          />
        </div>
      </div>

      {/* Game info strip */}
      <div
        className="rounded-lg border px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <span style={{ color: 'var(--color-muted)' }}>
          Transport:{' '}
          <strong style={{ color: 'var(--color-ink)' }}>
            {game.transportMode === 'auto'
              ? 'Auto'
              : game.transportMode === 'peer'
                ? 'PeerJS'
                : 'Gun.js'}
          </strong>
        </span>
        <span style={{ color: 'var(--color-muted)' }}>
          Rounds: <strong style={{ color: 'var(--color-ink)' }}>{game.roundIds.length}</strong>
        </span>
        {game.scoringEnabled && (
          <span style={{ color: 'var(--color-muted)' }}>
            Scoring: <strong style={{ color: 'var(--color-ink)' }}>on</strong>
          </span>
        )}
        {(game.transportMode === 'gun' || game.transportMode === 'auto') && game.passphrase && (
          <span style={{ color: 'var(--color-muted)' }}>
            Passphrase:{' '}
            <span className="mono" style={{ color: 'var(--color-ink)' }}>
              {game.passphrase}
            </span>
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
}

function ActiveGame({ game }: ActiveGameProps) {
  const [showBoundary, setShowBoundary] = useState(false)
  const [boundaryEntry, setBoundaryEntry] = useState<
    import('@/pages/admin/gamemaster-utils').NavEntry | null
  >(null)
  const [modalOpen] = useState(false)

  const handleBoundary = useCallback((entry: import('@/pages/admin/gamemaster-utils').NavEntry) => {
    setBoundaryEntry(entry)
    setShowBoundary(true)
  }, [])

  const { seq, pos, goNext, goPrev, isReady } = useNavigation(game, handleBoundary)

  // Current question ID derived from nav position
  const currentQuestionId = pos ? (seq[pos.flatIndex]?.questionId ?? null) : null

  const { displayBuzzes, buzzes, toggleLock, adjudicate, clearBuzzes, handleIncomingBuzz } =
    useBuzzer(game, currentQuestionId)

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
    void applyAutoReset(timerHookRef.current.timers, changeType).then(() => {
      // Sync local state after DB writes
      timerHookRef.current.timers
        .filter(t => t.autoReset !== 'none')
        .forEach(t => timerHookRef.current.pauseTimer(t.id).catch(() => {}))
    })
  }, [pos])

  // Expose handleIncomingBuzz upward via the onBuzz prop bridge
  useEffect(() => {
    // Re-register whenever handleIncomingBuzz identity changes (questionId changed)
    // The parent GameMaster calls onBuzz which delegates here
    ;(window as unknown as Record<string, unknown>)['__vkt_handleBuzz'] = handleIncomingBuzz
  }, [handleIncomingBuzz])

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

  // Clear buzzes when question changes
  const prevQuestionId = useRef<string | null>(null)
  useEffect(() => {
    if (prevQuestionId.current && prevQuestionId.current !== currentQuestionId) {
      void clearBuzzes(prevQuestionId.current)
    }
    prevQuestionId.current = currentQuestionId
  }, [currentQuestionId, clearBuzzes])

  // Load existing buzzes when question changes is handled inside useBuzzer via questionId dep

  useKeyNav({
    onNext: goNext,
    onPrev: goPrev,
    modalOpen,
    enabled: game.status === 'active',
  })

  if (!isReady) {
    return (
      <div className="flex items-center justify-center py-20">
        <p style={{ color: 'var(--color-muted)' }}>Loading questions…</p>
      </div>
    )
  }

  if (!pos) return null

  return (
    <div className="flex flex-col h-full -mx-8 -my-6" style={{ height: 'calc(100vh - 64px)' }}>
      {showBoundary && boundaryEntry && (
        <RoundBoundary
          roundName={boundaryEntry.roundName}
          roundIdx={boundaryEntry.roundIdx}
          onDone={() => setShowBoundary(false)}
        />
      )}

      <NavHeader pos={pos} totalQ={seq.length} onPrev={goPrev} onNext={goNext} />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          {/* Question context */}
          <div style={{ color: 'var(--color-muted)' }} className="text-sm">
            {seq[pos.flatIndex]?.roundName} · Q {pos.questionIdx + 1} of {pos.roundQuestions}
            <span className="ml-3 text-xs">
              ({pos.flatIndex + 1} / {seq.length} total)
            </span>
          </div>

          {/* Buzzer panel */}
          <BuzzerPanel
            game={game}
            questionId={currentQuestionId}
            buzzes={buzzes}
            displayBuzzes={displayBuzzes}
            onToggleLock={() => void toggleLock()}
            onAdjudicate={(id, decision) => void adjudicate(id, decision)}
            onClear={() => currentQuestionId && void clearBuzzes(currentQuestionId)}
          />

          {/* Timers */}
          <TimerPanel gameId={game.id} hook={timerHook} />

          {/* Scoreboard */}
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

  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [status, setStatus] = useState<TransportStatus>(transportManager.status)
  const [type, setType] = useState<TransportType>(transportManager.transportType)
  const [soloBypass, setSoloBypass] = useState(false)
  const [starting, setStarting] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const gameRef = useRef<Game | null>(null)
  gameRef.current = game

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

  // Connect transport when game is loaded
  useEffect(() => {
    if (!game) return

    const unsub = transportManager.onStatusChange((s, t) => {
      setStatus(s)
      setType(t)
    })

    transportManager
      .connect({
        mode: game.transportMode,
        role: 'host',
        roomId: game.roomId ?? '',
        passphrase: game.passphrase ?? '',
      })
      .catch(err => {
        console.error('[GameMaster] Transport connect failed:', err)
      })

    return () => {
      unsub()
      transportManager.disconnect()
    }
  }, [game?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to player JOIN / LEAVE / BUZZ events
  const handleEvent = useCallback(async (event: TransportEvent) => {
    const g = gameRef.current
    if (!g) return

    if (event.type === 'JOIN') {
      const record = {
        id: event.playerId,
        gameId: g.id,
        name: event.playerName,
        teamId: event.teamId,
        deviceId: event.deviceId,
      }
      // Preserve existing score / joinedAt via upsert
      const existing = await db.players.get(event.playerId)
      const player: Player = {
        ...record,
        score: existing?.score ?? 0,
        isAway: false,
        joinedAt: existing?.joinedAt ?? Date.now(),
      }
      await db.players.put(player)
      setPlayers(prev => upsertPlayer(prev, record))
    }

    if (event.type === 'LEAVE') {
      await db.players.update(event.playerId, { isAway: true })
      setPlayers(prev => markPlayerAway(prev, event.playerId))
    }

    if (event.type === 'FOCUS_CHANGE') {
      await db.players.update(event.playerId, { isAway: event.away })
      setPlayers(prev => setPlayerAway(prev, event.playerId, event.away))
    }

    if (event.type === 'BUZZ') {
      // Delegate to the ActiveGame's useBuzzer via window bridge
      const handler = (window as unknown as Record<string, unknown>)['__vkt_handleBuzz'] as
        | ((p: {
            playerId: string
            playerName: string
            teamId: string | null
            timestamp: number
          }) => Promise<void>)
        | undefined
      if (handler) {
        void handler({
          playerId: event.playerId,
          playerName: event.playerName,
          teamId: null, // transport doesn't carry teamId yet; looked up in useBuzzer
          timestamp: event.timestamp,
        })
      }
    }
  }, [])

  useEffect(() => {
    return transportManager.onEvent(handleEvent)
  }, [handleEvent])

  // Kick player — mark as away in DB + state, broadcast updated game state
  const handleKick = useCallback(
    async (playerId: string) => {
      const g = gameRef.current
      if (!g) return
      await db.players.update(playerId, { isAway: true })
      setPlayers(prev => {
        const updated = markPlayerAway(prev, playerId)
        transportManager.send({ type: 'GAME_STATE', state: serialiseGameState(g, updated) })
        return updated
      })
    },
    []
  )

  // Create a session team, persist to DB, broadcast GAME_STATE
  const handleCreateTeam = useCallback(
    async (name: string, color: string, icon: string) => {
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
    },
    []
  )

  // Import all active managed teams (and their players) into the session
  const handleImportFromManaged = useCallback(async () => {
    const g = gameRef.current
    if (!g) return

    const [managedTeams, managedPlayers] = await Promise.all([
      db.managedTeams.filter(t => !t.archivedAt).toArray(),
      db.managedPlayers.filter(p => !p.archivedAt).toArray(),
    ])

    // Upsert teams — skip any already in the session (by id)
    const existingTeamIds = new Set((await db.teams.where('gameId').equals(g.id).toArray()).map(t => t.id))
    const newTeams: Team[] = managedTeams
      .filter(mt => !existingTeamIds.has(mt.id))
      .map(mt => ({
        id: mt.id,
        gameId: g.id,
        name: mt.name,
        color: mt.color,
        icon: mt.icon,
        score: 0,
      }))
    if (newTeams.length > 0) await db.teams.bulkAdd(newTeams)

    // Upsert players — skip any already in the session (by id)
    const existingPlayerIds = new Set((await db.players.where('gameId').equals(g.id).toArray()).map(p => p.id))
    const now = Date.now()
    const newPlayers: import('@/db').Player[] = managedPlayers
      .filter(mp => !existingPlayerIds.has(mp.id))
      .map((mp, i) => ({
        id: mp.id,
        gameId: g.id,
        name: mp.name,
        // Assign to first matching session team
        teamId: mp.teamIds.find(tid => managedTeams.some(mt => mt.id === tid)) ?? null,
        score: 0,
        isAway: false,
        deviceId: '',
        joinedAt: now + i,
      }))
    if (newPlayers.length > 0) await db.players.bulkAdd(newPlayers)

    // Refresh state
    const [freshTeams, freshPlayers] = await Promise.all([
      db.teams.where('gameId').equals(g.id).toArray(),
      db.players.where('gameId').equals(g.id).toArray(),
    ])
    setTeams(freshTeams)
    setPlayers(freshPlayers.sort((a, b) => a.joinedAt - b.joinedAt))
  }, [])

  // Assign a player to a team (or clear), persist to DB, broadcast GAME_STATE
  const handleAssignPlayer = useCallback(
    async (playerId: string, teamId: string | null) => {
      const g = gameRef.current
      if (!g) return
      await db.players.update(playerId, { teamId })
      setPlayers(prev => {
        const updated = assignPlayerTeam(prev, playerId, teamId)
        transportManager.send({ type: 'GAME_STATE', state: serialiseGameState(g, updated) })
        return updated
      })
    },
    []
  )

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
      transportManager.send({ type: 'GAME_STATE', state: serialiseGameState(updated, players) })
    } finally {
      setStarting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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
        />
      </AdminLayout>
    )
  }

  // Active / paused / ended — navigation view
  return (
    <AdminLayout>
      <ActiveGame game={game} />
    </AdminLayout>
  )
}
