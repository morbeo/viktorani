import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '@/components/AdminLayout'
import { Icon } from '@/components/ui'
import { db } from '@/db'
import { CircleHelp, Trophy, UsersRound, Plus, Upload, Play, List, QrCode } from 'lucide-react'

interface Stats {
  questions: number
  rounds: number
  games: number
  players: number
  teams: number
  active: number
}

interface TileProps {
  icon: typeof CircleHelp
  label: string
  value: number
  sub: string
  badge?: string
  onClick: () => void
  primary: { label: string; icon: typeof Plus; onClick: (e: React.MouseEvent) => void }
  secondary: { label: string; icon: typeof Plus; onClick: (e: React.MouseEvent) => void }
}

function StatTile({ icon, label, value, sub, badge, onClick, primary, secondary }: TileProps) {
  return (
    <div
      className="rounded-lg border flex flex-col overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      aria-label={`Go to ${label}`}
    >
      {/* Body */}
      <div className="p-5 flex-1">
        <div className="flex items-start justify-between mb-3">
          <Icon icon={icon} size="md" aria-hidden />
          {badge && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--color-gold-light)', color: 'var(--color-ink)' }}
            >
              {badge}
            </span>
          )}
        </div>
        <div className="text-3xl font-black" style={{ fontFamily: 'Playfair Display, serif' }}>
          {value}
        </div>
        <div className="text-sm font-medium mt-0.5">{label}</div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
          {sub}
        </div>
      </div>

      {/* Structural footer — flush, no internal padding, split by divider */}
      <div
        className="flex border-t text-xs font-medium"
        style={{ borderColor: 'var(--color-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 transition-colors hover:bg-black/5"
          style={{ color: 'var(--color-muted)' }}
          onClick={primary.onClick}
          aria-label={primary.label}
        >
          <Icon icon={primary.icon} size="sm" aria-hidden />
          {primary.label}
        </button>
        <div className="w-px self-stretch" style={{ background: 'var(--color-border)' }} />
        <button
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 transition-colors hover:bg-black/5"
          style={{ color: 'var(--color-muted)' }}
          onClick={secondary.onClick}
          aria-label={secondary.label}
        >
          <Icon icon={secondary.icon} size="sm" aria-hidden />
          {secondary.label}
        </button>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({
    questions: 0,
    rounds: 0,
    games: 0,
    players: 0,
    teams: 0,
    active: 0,
  })

  useEffect(() => {
    async function load() {
      const [questions, rounds, games, players, teams, active] = await Promise.all([
        db.questions.count(),
        db.rounds.count(),
        db.games.count(),
        db.managedPlayers.count(),
        db.managedTeams.count(),
        db.games.where('status').equals('active').count(),
      ])
      setStats({ questions, rounds, games, players, teams, active })
    }
    load()
  }, [])

  function go(path: string) {
    return () => navigate(path)
  }

  function action(path: string) {
    return (e: React.MouseEvent) => {
      e.stopPropagation()
      navigate(path)
    }
  }

  const gamesFooter =
    stats.active > 0
      ? {
          primary: { label: 'Resume', icon: Play, onClick: action('/admin/games') },
          secondary: { label: 'New game', icon: Plus, onClick: action('/admin/games') },
        }
      : {
          primary: { label: 'New game', icon: Plus, onClick: action('/admin/games') },
          secondary: { label: 'All games', icon: List, onClick: action('/admin/games') },
        }

  return (
    <AdminLayout>
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-4xl font-black mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
          Viktorani
        </h1>
        <p style={{ color: 'var(--color-muted)' }}>Your bar trivia command centre.</p>
      </div>

      {/* Tile grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <StatTile
          icon={CircleHelp}
          label="Questions"
          value={stats.questions}
          sub={`across ${stats.rounds} round${stats.rounds !== 1 ? 's' : ''}`}
          onClick={go('/admin/questions')}
          primary={{ label: 'New question', icon: Plus, onClick: action('/admin/questions') }}
          secondary={{ label: 'Import', icon: Upload, onClick: action('/admin/questions') }}
        />

        <StatTile
          icon={Trophy}
          label="Games"
          value={stats.games}
          sub={`${stats.active} active`}
          badge={stats.active > 0 ? `${stats.active} active` : undefined}
          onClick={go('/admin/games')}
          primary={gamesFooter.primary}
          secondary={gamesFooter.secondary}
        />

        <StatTile
          icon={UsersRound}
          label="Players & Teams"
          value={stats.players}
          sub={`${stats.teams} team${stats.teams !== 1 ? 's' : ''}`}
          onClick={go('/admin/players-teams')}
          primary={{ label: 'New team', icon: Plus, onClick: action('/admin/players-teams') }}
          secondary={{ label: 'Scan QR', icon: QrCode, onClick: action('/admin/players-teams') }}
        />
      </div>
    </AdminLayout>
  )
}
