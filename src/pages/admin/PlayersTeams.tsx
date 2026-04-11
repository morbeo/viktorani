import { useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import PlayerList from '@/components/players-teams/PlayerList'
import PlayerForm from '@/components/players-teams/PlayerForm'
import { Button } from '@/components/ui'

export default function PlayersTeams() {
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  return (
    <AdminLayout title="Players & Teams">
      <div className="max-w-5xl mx-auto flex flex-col gap-6 py-2">
        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search players..."
            className="flex-1 px-3 py-2 rounded border text-sm outline-none"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-cream)',
              color: 'var(--color-ink)',
            }}
          />
          <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
            + New player
          </Button>
        </div>

        {/* Player list */}
        <PlayerList search={search} />

        {/* New player form */}
        <PlayerForm open={formOpen} player={null} onClose={() => setFormOpen(false)} />
      </div>
    </AdminLayout>
  )
}
