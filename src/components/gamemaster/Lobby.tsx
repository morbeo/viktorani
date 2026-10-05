import { useState } from 'react'
import { Rocket } from 'lucide-react'
import { Button, TransportPill, Icon, ControlSizePicker } from '@/components/ui'
import { RosterPanel } from '@/components/gamemaster/RosterPanel'
import { TeamManagerPanel } from '@/components/gamemaster/TeamManagerPanel'
import { GameSettingsDrawer } from '@/components/gamemaster/GameSettingsDrawer'
import { PendingJoinsPanel } from '@/components/gamemaster/PendingJoinsPanel'
import { ScreensPanel } from '@/components/gamemaster/ScreensPanel'
import type { ScreensPanelProps } from '@/components/gamemaster/ScreensPanel'
import { MessagePanel } from '@/components/gamemaster/MessagePanel'
import type { MessagePanelProps } from '@/components/gamemaster/MessagePanel'
import { QrCodePanel } from '@/components/gamemaster/QrCodePanel'
import { canStartGame, isConnected } from '@/pages/admin/gamemaster-utils'
import type { PendingJoin } from '@/pages/admin/player-connections'
import type { Game, Player, Team } from '@/db'
import type { TransportStatus, TransportType } from '@/transport/types'

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
  onAddPlayer: (name: string, teamId: string | null) => Promise<void>
  onAssignPlayer: (playerId: string, teamId: string | null) => Promise<void>
  onAdjustScore: (playerId: string, delta: number) => Promise<void>
  onUpdatePlayerNotes: (playerId: string, notes: string) => Promise<void>
  onCreateTeam: (name: string, color: string, icon: string) => Promise<void>
  onImportFromManaged: () => Promise<void>
  onRenameTeam: (teamId: string, name: string) => Promise<void>
  onDeleteTeam: (teamId: string) => Promise<void>
  onUpdateTeamNotes: (teamId: string, notes: string) => Promise<void>
  onGameChange: (patch: Partial<Game>) => void
  pendingJoins: PendingJoin[]
  onApproveJoin: (connId: string) => void
  onRejectJoin: (connId: string) => void
  screens: ScreensPanelProps
  messages: MessagePanelProps
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
  onAddPlayer,
  onAssignPlayer,
  onAdjustScore,
  onUpdatePlayerNotes,
  onCreateTeam,
  onImportFromManaged,
  onRenameTeam,
  onDeleteTeam,
  onUpdateTeamNotes,
  onGameChange,
  pendingJoins,
  onApproveJoin,
  onRejectJoin,
  screens,
  messages,
}: LobbyProps) {
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set())
  const activePlayers = players.filter(isConnected)
  const canStart = canStartGame({
    transportStatus: status,
    activePlayers: activePlayers.length,
    soloBypass,
  })

  function selectTeamMembers(teamId: string) {
    setSelectedPlayerIds(new Set(players.filter(p => p.teamId === teamId).map(p => p.id)))
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
          <GameSettingsDrawer game={game} onGameChange={onGameChange} />
          <ControlSizePicker />
          <TransportPill status={status} type={type} />
        </div>
      </div>

      {/* QR + player list */}
      <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <QrCodePanel game={game} />

        {/* Roster + team management */}
        <div className="flex flex-col gap-4">
          <PendingJoinsPanel
            pending={pendingJoins}
            onApprove={onApproveJoin}
            onReject={onRejectJoin}
          />
          <ScreensPanel {...screens} />
          <MessagePanel {...messages} />
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
            selected={selectedPlayerIds}
            onSelectedChange={setSelectedPlayerIds}
          />
          <TeamManagerPanel
            game={game}
            teams={teams}
            players={players}
            onCreateTeam={onCreateTeam}
            onImportFromManaged={onImportFromManaged}
            onRenameTeam={onRenameTeam}
            onDeleteTeam={onDeleteTeam}
            onUpdateTeamNotes={onUpdateTeamNotes}
            onSelectTeam={selectTeamMembers}
          />
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
