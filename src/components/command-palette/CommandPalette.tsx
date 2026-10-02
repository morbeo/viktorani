import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import Fuse from 'fuse.js'
import {
  Bug,
  CircleHelp,
  Database,
  LayoutDashboard,
  NotebookPen,
  Play,
  Plus,
  Search,
  Settings,
  Trophy,
  User,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Icon, useToast } from '@/components/ui'
import { db } from '@/db'
import { loadDemo } from '@/lib/load-demo'
import { SETTINGS_CATEGORIES } from '@/components/settings/categories'
import type { Command } from './commands'

const MAX_RESULTS = 50

const PAGES: Array<{ id: string; label: string; group: string; icon: LucideIcon; path: string }> = [
  { id: 'nav:dashboard', label: 'Dashboard', group: 'Go to', icon: LayoutDashboard, path: '/admin' },
  { id: 'nav:questions', label: 'Questions', group: 'Go to', icon: CircleHelp, path: '/admin/questions' },
  { id: 'nav:games', label: 'Games', group: 'Go to', icon: Trophy, path: '/admin/games' },
  { id: 'nav:people', label: 'Players & Teams', group: 'Go to', icon: Users, path: '/admin/players-teams' },
  { id: 'nav:notes', label: 'Notes', group: 'Go to', icon: NotebookPen, path: '/admin/notes' },
  { id: 'nav:settings', label: 'Settings', group: 'Go to', icon: Settings, path: '/admin/settings' },
  { id: 'nav:debug', label: 'Debug info', group: 'Go to', icon: Bug, path: '/admin/debug' },
  { id: 'new:game', label: 'New game', group: 'Create', icon: Plus, path: '/admin/games?new=1' },
  { id: 'new:question', label: 'New question', group: 'Create', icon: Plus, path: '/admin/questions?new=1' },
]

interface CommandPaletteProps {
  /** Commands offered by the current page, listed first. */
  pageCommands: Command[]
  onClose: () => void
}

/**
 * Ctrl/⌘+K palette: fuzzy search over navigation, create actions, settings, games, questions,
 * players, teams, notes and page commands.
 */
export default function CommandPalette({ pageCommands, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const games = useLiveQuery(() => db.games.toArray(), [])
  const questions = useLiveQuery(() => db.questions.toArray(), [])
  const players = useLiveQuery(() => db.managedPlayers.filter(p => !p.archivedAt).toArray(), [])
  const teams = useLiveQuery(() => db.managedTeams.filter(t => !t.archivedAt).toArray(), [])
  const notes = useLiveQuery(() => db.notes.toArray(), [])

  // Focus the search box, and give focus back to where it was on close
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    inputRef.current?.focus()
    return () => previous?.focus?.()
  }, [])

  const baseCommands = useMemo<Command[]>(
    () => [
      ...PAGES.map(({ path, ...page }) => ({ ...page, run: () => navigate(path) })),
      {
        id: 'action:demo',
        label: 'Load demo data',
        group: 'Action',
        icon: Database,
        keywords: 'test sample example seed',
        run: () =>
          loadDemo().then(
            name => addToast(`Demo data loaded: open "${name}" in Games`),
            () => addToast('Could not load demo data', { variant: 'error' })
          ),
      },
    ],
    [navigate, addToast]
  )

  const searchCommands = useMemo<Command[]>(
    () => [
      ...SETTINGS_CATEGORIES.map(c => ({
        id: `settings:${c.id}`,
        label: c.label,
        group: 'Settings',
        icon: Settings,
        keywords: 'settings',
        run: () => navigate(`/admin/settings/${c.id}`),
      })),
      ...(games ?? []).map(g => ({
        id: `game:${g.id}`,
        label: g.name,
        group: 'Game',
        icon: Play,
        keywords: 'open game',
        run: () => navigate(`/admin/game/${encodeURIComponent(g.id)}`),
      })),
      ...(questions ?? []).map(q => ({
        id: `question:${q.id}`,
        label: q.title,
        group: 'Question',
        icon: Search,
        keywords: 'question',
        run: () => navigate(`/admin/questions?edit=${encodeURIComponent(q.id)}`),
      })),
      ...(players ?? []).map(p => ({
        id: `player:${p.id}`,
        label: p.name,
        group: 'Player',
        icon: User,
        keywords: 'player',
        run: () => navigate(`/admin/players-teams?player=${encodeURIComponent(p.id)}`),
      })),
      ...(teams ?? []).map(t => ({
        id: `team:${t.id}`,
        label: t.name,
        group: 'Team',
        icon: Users,
        keywords: 'team',
        run: () => navigate(`/admin/players-teams?team=${encodeURIComponent(t.id)}`),
      })),
      ...(notes ?? []).map(n => ({
        id: `note:${n.id}`,
        label: n.name,
        group: 'Note',
        icon: NotebookPen,
        keywords: 'note',
        run: () => navigate(`/admin/notes/${encodeURIComponent(n.id)}`),
      })),
    ],
    [games, questions, players, teams, notes, navigate]
  )

  const all = useMemo(
    () => [...pageCommands, ...baseCommands, ...searchCommands],
    [pageCommands, baseCommands, searchCommands]
  )
  const fuse = useMemo(
    () =>
      new Fuse(all, {
        keys: [
          { name: 'label', weight: 3 },
          { name: 'group', weight: 1 },
          { name: 'keywords', weight: 1 },
        ],
        threshold: 0.4,
        ignoreLocation: true,
      }),
    [all]
  )

  const q = query.trim()
  // Without a query, list page commands and the fixed ones; everything else needs a search
  const results = (q ? fuse.search(q).map(r => r.item) : [...pageCommands, ...baseCommands]).slice(
    0,
    MAX_RESULTS
  )
  const current = Math.min(active, results.length - 1)

  function run(cmd: Command | undefined) {
    if (!cmd) return
    onClose()
    cmd.run()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(results.length ? (current + 1) % results.length : 0)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(results.length ? (current - 1 + results.length) % results.length : 0)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(results[current])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    } else if (e.key === 'Tab') {
      // Keep focus in the dialog: the search box is its only tab stop
      e.preventDefault()
    }
  }

  const listId = `${id}-list`
  const optionId = (i: number) => `${id}-opt-${i}`

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] px-4"
      style={{ background: 'rgba(26,22,16,0.5)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-lg rounded-xl border shadow-2xl overflow-hidden"
        style={{ background: 'var(--color-cream)', borderColor: 'var(--color-border)' }}
        onClick={e => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div
          className="flex items-center gap-2 px-4 py-3 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <Icon icon={Search} size="sm" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results.length ? optionId(current) : undefined}
            aria-label="Search commands"
            placeholder="Type a command, setting, game, question, player, team or note…"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setActive(0)
            }}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--color-ink)' }}
          />
          <kbd className="mono text-[10px]" style={{ color: 'var(--color-muted)' }}>
            Esc
          </kbd>
        </div>
        <ul
          id={listId}
          role="listbox"
          aria-label="Commands"
          className="max-h-80 overflow-y-auto py-1"
        >
          {results.map((cmd, i) => (
            <li
              key={cmd.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === current}
              onMouseMove={() => setActive(i)}
              onClick={() => run(cmd)}
              className="flex items-center gap-3 px-4 py-2 text-sm cursor-pointer"
              style={{ background: i === current ? 'var(--color-surface)' : 'transparent' }}
            >
              {cmd.icon && <Icon icon={cmd.icon} size="sm" />}
              <span className="flex-1 truncate" style={{ color: 'var(--color-ink)' }}>
                {cmd.label}
              </span>
              <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                {cmd.group}
              </span>
              {cmd.shortcut && (
                <kbd
                  className="mono text-[10px] px-1.5 py-0.5 rounded border"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
                >
                  {cmd.shortcut}
                </kbd>
              )}
            </li>
          ))}
        </ul>
        {results.length === 0 && (
          <p className="px-4 py-6 text-sm text-center" style={{ color: 'var(--color-muted)' }}>
            No matches
          </p>
        )}
      </div>
    </div>
  )
}
