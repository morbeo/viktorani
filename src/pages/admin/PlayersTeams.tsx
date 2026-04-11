import { useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import TeamList from '@/components/players-teams/TeamList'
import PlayerList from '@/components/players-teams/PlayerList'
import TeamForm from '@/components/players-teams/TeamForm'
import PlayerForm from '@/components/players-teams/PlayerForm'
import LabelFilterChips from '@/components/players-teams/LabelFilterChips'
import { Button } from '@/components/ui'

type TabId = 'teams' | 'players'

export default function PlayersTeams() {
  // ── Shared state ────────────────────────────────────────────────────────────
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)

  // ── Team pane state ─────────────────────────────────────────────────────────
  const [teamSearch, setTeamSearch] = useState('')
  const [teamLabelFilter, setTeamLabelFilter] = useState<Record<string, 'include' | 'exclude'>>({})
  const [teamFormOpen, setTeamFormOpen] = useState(false)

  // ── Player pane state ───────────────────────────────────────────────────────
  const [playerSearch, setPlayerSearch] = useState('')
  const [playerLabelFilter, setPlayerLabelFilter] = useState<Record<string, 'include' | 'exclude'>>(
    {}
  )
  const [playerFormOpen, setPlayerFormOpen] = useState(false)

  // ── Mobile tab ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('teams')

  function handleSelectTeam(teamId: string | null) {
    setSelectedTeamId(teamId)
    // Auto-switch to players pane on mobile when a team is selected
    if (teamId !== null) setActiveTab('players')
  }

  function handleNewPlayer() {
    setPlayerFormOpen(true)
  }

  return (
    <AdminLayout title="Players & Teams">
      {/* ── Shared header ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4 -mt-2" aria-label="Players and Teams actions">
        <div className="flex-1" />
        <Button variant="secondary" size="sm">
          ⌖ Scan QR
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            if (activeTab === 'teams') setTeamFormOpen(true)
            else handleNewPlayer()
          }}
        >
          + New
        </Button>
      </div>

      {/* ── Mobile tab switcher (hidden on md+) ─────────────────────────────── */}
      <div
        className="flex border-b mb-4 md:hidden"
        style={{ borderColor: 'var(--color-border)' }}
        role="tablist"
        aria-label="View switcher"
      >
        {(['teams', 'players'] as TabId[]).map(tab => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 text-sm font-medium capitalize transition-colors"
            style={{
              color: activeTab === tab ? 'var(--color-gold)' : 'var(--color-muted)',
              borderBottom:
                activeTab === tab ? '2px solid var(--color-gold)' : '2px solid transparent',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Dual pane ───────────────────────────────────────────────────────── */}
      <div className="flex gap-0 -mx-8 px-0" style={{ minHeight: 0 }}>
        {/* Teams pane — 38% on desktop, full-width on mobile when active */}
        <div
          className={`flex flex-col border-r ${activeTab === 'teams' ? 'flex' : 'hidden'} md:flex`}
          style={{
            width: '38%',
            minWidth: 0,
            borderColor: 'var(--color-border)',
          }}
          role="tabpanel"
          aria-label="Teams pane"
        >
          <PaneHeader
            title={selectedTeamId ? 'Teams' : 'Teams'}
            search={teamSearch}
            onSearch={setTeamSearch}
            searchPlaceholder="Search teams..."
            labelFilter={teamLabelFilter}
            onLabelFilter={setTeamLabelFilter}
            onNew={() => setTeamFormOpen(true)}
            newLabel="New team"
          />
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <TeamList
              search={teamSearch}
              labelFilter={teamLabelFilter}
              selectedTeamId={selectedTeamId}
              onSelect={handleSelectTeam}
            />
          </div>
        </div>

        {/* Players pane — 62% on desktop, full-width on mobile when active */}
        <div
          className={`flex flex-col ${activeTab === 'players' ? 'flex' : 'hidden'} md:flex`}
          style={{ flex: 1, minWidth: 0 }}
          role="tabpanel"
          aria-label="Players pane"
        >
          <PaneHeader
            title={selectedTeamId ? 'Players — filtered by team' : 'Players'}
            search={playerSearch}
            onSearch={setPlayerSearch}
            searchPlaceholder="Search players..."
            labelFilter={playerLabelFilter}
            onLabelFilter={setPlayerLabelFilter}
            onNew={handleNewPlayer}
            newLabel="New player"
          />
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <PlayerList
              search={playerSearch}
              labelFilter={playerLabelFilter}
              filterTeamId={selectedTeamId ?? undefined}
            />
          </div>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <TeamForm open={teamFormOpen} team={null} onClose={() => setTeamFormOpen(false)} />
      <PlayerForm
        open={playerFormOpen}
        player={null}
        defaultTeamId={selectedTeamId ?? undefined}
        onClose={() => setPlayerFormOpen(false)}
      />
    </AdminLayout>
  )
}

// ── Pane header ───────────────────────────────────────────────────────────────

interface PaneHeaderProps {
  title: string
  search: string
  onSearch: (v: string) => void
  searchPlaceholder: string
  labelFilter: Record<string, 'include' | 'exclude'>
  onLabelFilter: (f: Record<string, 'include' | 'exclude'>) => void
  onNew: () => void
  newLabel: string
}

function PaneHeader({
  title,
  search,
  onSearch,
  searchPlaceholder,
  labelFilter,
  onLabelFilter,
  onNew,
  newLabel,
}: PaneHeaderProps) {
  return (
    <div
      className="flex flex-col gap-2 px-4 py-3 border-b shrink-0"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-surface)',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold flex-1" style={{ color: 'var(--color-muted)' }}>
          {title}
        </span>
        <button
          onClick={onNew}
          className="text-xs px-2 py-1 rounded border transition-colors hover:bg-black/5"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
          aria-label={newLabel}
        >
          + {newLabel}
        </button>
      </div>
      <input
        type="search"
        value={search}
        onChange={e => onSearch(e.target.value)}
        placeholder={searchPlaceholder}
        className="w-full px-2.5 py-1.5 rounded border text-xs outline-none"
        style={{
          borderColor: 'var(--color-border)',
          background: 'var(--color-cream)',
          color: 'var(--color-ink)',
        }}
      />
      <LabelFilterChips filter={labelFilter} onChange={onLabelFilter} />
    </div>
  )
}
