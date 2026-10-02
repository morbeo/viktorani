import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode, Rocket, Copy, Check } from 'lucide-react'
import { Button, TransportPill, Icon, ControlSizePicker } from '@/components/ui'
import { RosterPanel } from '@/components/gamemaster/RosterPanel'
import { TeamManagerPanel } from '@/components/gamemaster/TeamManagerPanel'
import { JoinPolicyPanel } from '@/components/gamemaster/JoinPolicyPanel'
import { PendingJoinsPanel } from '@/components/gamemaster/PendingJoinsPanel'
import { ScreensPanel } from '@/components/gamemaster/ScreensPanel'
import type { ScreensPanelProps } from '@/components/gamemaster/ScreensPanel'
import { canStartGame } from '@/pages/admin/gamemaster-utils'
import type { PendingJoin } from '@/pages/admin/player-connections'
import type { Game, Player, Team } from '@/db'
import type { TransportStatus, TransportType } from '@/transport/types'

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

export interface LobbyProps {
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

export function Lobby({
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
  const canStart = canStartGame({
    transportStatus: status,
    activePlayers: activePlayers.length,
    soloBypass,
  })
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
