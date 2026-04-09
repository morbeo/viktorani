import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '@/components/AdminLayout'
import { Card, Button } from '@/components/ui'
import { db } from '@/db'
import { exportDatabase, importDatabase } from '@/db/snapshot'

interface Stats {
  questions: number
  rounds: number
  games: number
  notes: number
  active: number
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({
    questions: 0,
    rounds: 0,
    games: 0,
    notes: 0,
    active: 0,
  })
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [questions, rounds, games, notes, active] = await Promise.all([
        db.questions.count(),
        db.rounds.count(),
        db.games.count(),
        db.notes.count(),
        db.games.where('status').equals('active').count(),
      ])
      setStats({ questions, rounds, games, notes, active })
    }
    load()
  }, [])

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      await importDatabase(file)
      setMsg('Import successful')
      setTimeout(() => setMsg(null), 3000)
      const [questions, rounds, games, notes] = await Promise.all([
        db.questions.count(),
        db.rounds.count(),
        db.games.count(),
        db.notes.count(),
      ])
      setStats(s => ({ ...s, questions, rounds, games, notes }))
    } catch (err) {
      setMsg(`Import failed: ${(err as Error).message}`)
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const statCards = [
    { label: 'Questions', value: stats.questions, icon: '?', to: '/admin/questions' },
    { label: 'Rounds', value: stats.rounds, icon: '◎', to: '/admin/questions' },
    { label: 'Games', value: stats.games, icon: '▶', to: '/admin/games' },
    { label: 'Notes', value: stats.notes, icon: '✎', to: '/admin/notes' },
  ]

  return (
    <AdminLayout>
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-4xl font-black mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
          Viktorani
        </h1>
        <p style={{ color: 'var(--color-muted)' }}>Your bar trivia command centre.</p>
      </div>

      {/* Active game banner */}
      {stats.active > 0 && (
        <div
          className="flex items-center justify-between px-5 py-4 rounded-lg mb-8 border"
          style={{ background: 'var(--color-gold-light)', borderColor: 'var(--color-gold)' }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">▶</span>
            <span className="font-semibold">
              {stats.active} game{stats.active > 1 ? 's' : ''} currently active
            </span>
          </div>
          <Button variant="primary" size="sm" onClick={() => navigate('/admin/games')}>
            Go to Games
          </Button>
        </div>
      )}

      {/* Stat grid */}
      <div
        className="grid grid-cols-2 gap-4 mb-10"
        style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
      >
        {statCards.map(({ label, value, icon, to }) => (
          <button
            key={label}
            onClick={() => navigate(to)}
            className="text-left rounded-lg border p-5 transition-all hover:shadow-md hover:-translate-y-0.5"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            <div className="text-3xl mb-3 opacity-40">{icon}</div>
            <div className="text-3xl font-black" style={{ fontFamily: 'Playfair Display, serif' }}>
              {value}
            </div>
            <div className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
              {label}
            </div>
          </button>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Card>
          <h3 className="font-bold text-lg mb-1">Start a game</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>
            Create a new session and invite players via QR code.
          </p>
          <Button variant="primary" onClick={() => navigate('/admin/games')}>
            New game →
          </Button>
        </Card>

        <Card>
          <h3 className="font-bold text-lg mb-1">Question bank</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>
            Add, edit, and organise questions into rounds.
          </p>
          <Button variant="secondary" onClick={() => navigate('/admin/questions')}>
            Manage questions →
          </Button>
        </Card>

        <Card>
          <h3 className="font-bold text-lg mb-1">Export data</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>
            Download a full JSON backup of all your questions, games, and notes.
          </p>
          <Button variant="secondary" onClick={exportDatabase}>
            Export JSON
          </Button>
        </Card>

        <Card>
          <h3 className="font-bold text-lg mb-1">Import data</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>
            Restore from a previous export. Existing records with matching IDs will be overwritten.
          </p>
          <label
            className="inline-flex items-center justify-center gap-2 font-medium rounded transition-all cursor-pointer px-4 py-2 text-sm border"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-ink)',
              background: 'transparent',
            }}
          >
            {importing ? 'Importing…' : 'Import JSON'}
            <input
              type="file"
              accept=".json"
              className="sr-only"
              onChange={handleImport}
              disabled={importing}
            />
          </label>
          {msg && (
            <p
              className="text-xs mt-2"
              style={{
                color: msg.startsWith('Import failed') ? 'var(--color-red)' : 'var(--color-green)',
              }}
            >
              {msg}
            </p>
          )}
        </Card>
      </div>
    </AdminLayout>
  )
}
