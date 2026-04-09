import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import AdminLayout from '@/components/AdminLayout'
import { Button, Badge, TransportPill } from '@/components/ui'
import { NavHeader } from '@/components/NavHeader'
import { RoundBoundary } from '@/components/RoundBoundary'
import { BuzzerPanel } from '@/components/buzzer/BuzzerPanel'
import { ScoreboardPanel } from '@/components/scoreboard/ScoreboardPanel'
import { db } from '@/db'
import { transportManager } from '@/transport'
import { serialiseGameState, upsertPlayer, markPlayerAway } from '@/pages/admin/gamemaster-utils'
import { useNavigation } from '@/hooks/useNavigation'
import { useKeyNav } from '@/hooks/useKeyNav'
import { useBuzzer } from '@/hooks/useBuzzer'
import type { Game, Player } from '@/db'
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

// ── Player row ────────────────────────────────────────────────────────────────

function PlayerRow({ player }: { player: Player }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: player.isAway ? 'var(--color-muted)' : 'var(--color-green)' }}
        title={player.isAway ? 'Away' : 'Online'}
      />
      <span className="flex-1 text-sm">{player.name}</span>
      {player.isAway && (
        <Badge style={{ background: 'var(--color-muted)22', color: 'var(--color-muted)' }}>
          away
        </Badge>
      )}
    </div>
  )
}

// ── Lobby view ────────────────────────────────────────────────────────────────

interface LobbyProps {
  game: Game
  players: Player[]
  status: TransportStatus
  type: TransportType
  soloBypass: boolean
  onToggleSolo: () => void
  onStart: () => Promise<void>
  starting: boolean
}

function Lobby({
  game,
  players,
  status,
  type,
  soloBypass,
  onToggleSolo,
  onStart,
  starting,
}: LobbyProps) {
  const activePlayers = players.filter(p => !p.isAway)
  const canStart = soloBypass || (status === 'connected' && activePlayers.length > 0)
  const url = game.roomId ? joinUrl(game.roomId) : ''

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
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-muted)' }}
          >
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
            <div className="text-center">
              <p className="text-xs mb-1" style={{ color: 'var(--color-muted)' }}>
                Room code
              </p>
              <p
                className="mono text-3xl font-bold"
                style={{ color: 'var(--color-ink)', letterSpacing: '0.15em' }}
              >
                {game.roomId}
              </p>
            </div>
          )}
        </div>

        {/* Player list */}
        <div
          className="rounded-xl border flex flex-col"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        >
          <div
            className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-muted)' }}
            >
              Players
            </span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                background:
                  activePlayers.length > 0 ? 'var(--color-green)22' : 'var(--color-border)',
                color: activePlayers.length > 0 ? 'var(--color-green)' : 'var(--color-muted)',
              }}
            >
              {activePlayers.length} online
            </span>
          </div>

          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 240 }}>
            {players.length === 0 ? (
              <div className="flex items-center justify-center h-24">
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                  Waiting for players to join…
                </p>
              </div>
            ) : (
              players.map(p => <PlayerRow key={p.id} player={p} />)
            )}
          </div>
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
            {starting ? 'Starting…' : 'Start game →'}
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
  const [status, setStatus] = useState<TransportStatus>(transportManager.status)
  const [type, setType] = useState<TransportType>(transportManager.transportType)
  const [soloBypass, setSoloBypass] = useState(false)
  const [starting, setStarting] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const gameRef = useRef<Game | null>(null)
  gameRef.current = game

  // Load game + existing players on mount
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
          status={status}
          type={type}
          soloBypass={soloBypass}
          onToggleSolo={() => setSoloBypass(s => !s)}
          onStart={handleStart}
          starting={starting}
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
