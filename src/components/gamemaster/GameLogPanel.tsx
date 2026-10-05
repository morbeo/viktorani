import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Fuse from 'fuse.js'
import { ArrowDown, ArrowUp, Download, Filter } from 'lucide-react'
import { Button, Icon, Input, Modal, Select } from '@/components/ui'
import { db } from '@/db'
import type { Game } from '@/db'
import {
  LOG_KIND_LABELS,
  buildLogRows,
  downloadGameLog,
  type LogRow,
  type LogRowKind,
} from '@/lib/game-log-rows'

/** How many rows the panel shows; downloads include every matching row. */
const LOG_LIMIT = 200

type SortKey = 'at' | 'kind' | 'who'

const formatTime = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function compareRows(a: LogRow, b: LogRow, key: SortKey): number {
  switch (key) {
    case 'at':
      return a.at - b.at
    case 'kind':
      return LOG_KIND_LABELS[a.kind].localeCompare(LOG_KIND_LABELS[b.kind])
    case 'who':
      return (a.who || a.details).localeCompare(b.who || b.details)
  }
}

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onClick,
}: {
  label: string
  sortKey: SortKey
  active: boolean
  dir: 1 | -1
  onClick: (key: SortKey) => void
}) {
  return (
    <th scope="col" className="font-medium">
      <button
        onClick={() => onClick(sortKey)}
        className="flex items-center gap-1 px-4 py-2 w-full text-left"
      >
        {label}
        {active && <Icon icon={dir === 1 ? ArrowUp : ArrowDown} size="sm" aria-hidden />}
      </button>
    </th>
  )
}

function KindFilterButton({
  kinds,
  selected,
  onToggle,
  onClear,
}: {
  kinds: LogRowKind[]
  selected: Set<LogRowKind>
  onToggle: (kind: LogRowKind) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        size="sm"
        variant={selected.size > 0 ? 'primary' : 'secondary'}
        onClick={() => setOpen(true)}
      >
        <Icon icon={Filter} size="sm" />
        Kinds{selected.size > 0 ? ` (${selected.size})` : ''}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Filter by kind" maxWidth="320px">
        <div className="flex flex-col gap-1.5" style={{ maxHeight: 320, overflowY: 'auto' }}>
          {kinds.map(k => (
            <label key={k} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
              <input
                type="checkbox"
                checked={selected.has(k)}
                onChange={() => onToggle(k)}
                className="w-4 h-4 cursor-pointer"
                style={{ accentColor: 'var(--color-ink)' }}
              />
              {LOG_KIND_LABELS[k]}
            </label>
          ))}
        </div>
        <div
          className="flex items-center justify-between pt-3 mt-2 border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button
            onClick={onClear}
            disabled={selected.size === 0}
            className="text-xs underline disabled:no-underline disabled:opacity-40"
            style={{ color: 'var(--color-muted)' }}
          >
            Clear
          </button>
          <Button size="sm" variant="primary" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </Modal>
    </>
  )
}

/**
 * Everything that happened in a game, newest first: the game log plus buzzes, rulings and
 * score changes. Searchable, filterable by kind/player/round, sortable, and downloadable as
 * CSV or JSON.
 */
export function GameLogPanel({ game }: { game: Game }) {
  const [search, setSearch] = useState('')
  const [selectedKinds, setSelectedKinds] = useState<Set<LogRowKind>>(new Set())
  const [selectedWho, setSelectedWho] = useState('')
  const [selectedRound, setSelectedRound] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('at')
  const [sortDir, setSortDir] = useState<1 | -1>(-1)

  const data = useLiveQuery(async () => {
    const [log, buzzes, scores, players, teams, gameQuestions, rounds] = await Promise.all([
      db.gameLog.where('gameId').equals(game.id).toArray(),
      db.buzzEvents.where('gameId').equals(game.id).toArray(),
      db.scoreEvents.where('gameId').equals(game.id).toArray(),
      db.players.where('gameId').equals(game.id).toArray(),
      db.teams.where('gameId').equals(game.id).toArray(),
      db.gameQuestions.where('gameId').equals(game.id).toArray(),
      db.rounds.toArray(),
    ])
    return { log, buzzes, scores, players, teams, gameQuestions, rounds }
  }, [game.id])

  const allRows = useMemo(() => {
    if (!data) return []
    const names = new Map<string, string>()
    for (const p of data.players) names.set(p.id, p.name)
    for (const t of data.teams) names.set(t.id, t.name)
    const roundNameById = new Map(data.rounds.map(r => [r.id, r.name]))
    const roundByQuestion = new Map(
      data.gameQuestions.map(gq => [gq.questionId, roundNameById.get(gq.roundId) ?? ''])
    )
    return buildLogRows(data.log, data.buzzes, data.scores, names, roundByQuestion)
  }, [data])

  const kindsPresent = useMemo(
    () => [...new Set(allRows.map(r => r.kind))].sort((a, b) => a.localeCompare(b)),
    [allRows]
  )
  const whoOptions = useMemo(
    () => [...new Set(allRows.map(r => r.who).filter(Boolean))].sort(),
    [allRows]
  )
  const roundOptions = useMemo(
    () => [...new Set(allRows.map(r => r.round).filter((r): r is string => !!r))].sort(),
    [allRows]
  )

  const hardFiltered = useMemo(
    () =>
      allRows.filter(r => {
        if (selectedKinds.size > 0 && !selectedKinds.has(r.kind)) return false
        if (selectedWho && r.who !== selectedWho) return false
        if (selectedRound && r.round !== selectedRound) return false
        return true
      }),
    [allRows, selectedKinds, selectedWho, selectedRound]
  )

  const fuse = useMemo(
    () =>
      new Fuse(hardFiltered, {
        keys: ['who', 'details'],
        threshold: 0.35,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [hardFiltered]
  )

  const rows = useMemo(() => {
    const matched = search.trim() ? fuse.search(search.trim()).map(r => r.item) : hardFiltered
    return [...matched].sort((a, b) => sortDir * compareRows(a, b, sortKey))
  }, [search, fuse, hardFiltered, sortKey, sortDir])

  function toggleKind(kind: LogRowKind) {
    setSelectedKinds(prev => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => (d === 1 ? -1 : 1))
    else {
      setSortKey(key)
      setSortDir(key === 'at' ? -1 : 1)
    }
  }

  const hasFilters = selectedKinds.size > 0 || selectedWho !== '' || selectedRound !== ''

  return (
    <div
      className="rounded-xl border flex flex-col"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div
        className="px-4 py-3 border-b flex items-center justify-between gap-2"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-muted)' }}
        >
          Game log
        </span>
        <div className="flex gap-2">
          {(['csv', 'json'] as const).map(format => (
            <Button
              key={format}
              size="sm"
              disabled={rows.length === 0}
              onClick={() => downloadGameLog(rows, game.name, format)}
              title={`Download the game log as ${format.toUpperCase()}`}
            >
              <Icon icon={Download} size="sm" />
              {format.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      <div
        className="px-4 py-3 border-b flex flex-wrap items-end gap-3"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <Input
          placeholder="Search…"
          aria-label="Search the game log"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-48"
        />
        <Select
          label="Player / team"
          value={selectedWho}
          onChange={e => setSelectedWho(e.target.value)}
          options={[
            { value: '', label: 'Everyone' },
            ...whoOptions.map(w => ({ value: w, label: w })),
          ]}
        />
        <Select
          label="Round"
          value={selectedRound}
          onChange={e => setSelectedRound(e.target.value)}
          options={[
            { value: '', label: 'All rounds' },
            ...roundOptions.map(r => ({ value: r, label: r })),
          ]}
        />
        {kindsPresent.length > 0 && (
          <KindFilterButton
            kinds={kindsPresent}
            selected={selectedKinds}
            onToggle={toggleKind}
            onClear={() => setSelectedKinds(new Set())}
          />
        )}
        {hasFilters && (
          <button
            onClick={() => {
              setSelectedKinds(new Set())
              setSelectedWho('')
              setSelectedRound('')
            }}
            className="text-xs underline"
            style={{ color: 'var(--color-muted)' }}
          >
            Clear filters
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--color-muted)' }}>
          {!data ? 'Loading…' : allRows.length === 0 ? 'Nothing has happened yet' : 'No matches'}
        </p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr
              className="text-xs text-left border-b"
              style={{ color: 'var(--color-muted)', borderColor: 'var(--color-border)' }}
            >
              <SortHeader
                label="Time"
                sortKey="at"
                active={sortKey === 'at'}
                dir={sortDir}
                onClick={toggleSort}
              />
              <SortHeader
                label="Event"
                sortKey="kind"
                active={sortKey === 'kind'}
                dir={sortDir}
                onClick={toggleSort}
              />
              <SortHeader
                label="Who / details"
                sortKey="who"
                active={sortKey === 'who'}
                dir={sortDir}
                onClick={toggleSort}
              />
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, LOG_LIMIT).map(r => (
              <tr key={r.id} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                <td
                  className="px-4 py-1.5 whitespace-nowrap tabular-nums"
                  style={{ color: 'var(--color-muted)' }}
                >
                  {formatTime(r.at)}
                </td>
                <td className="py-1.5 whitespace-nowrap">{LOG_KIND_LABELS[r.kind]}</td>
                <td className="px-4 py-1.5 break-words">
                  {r.who && <span className="font-medium">{r.who}</span>}
                  {r.who && r.details && ' · '}
                  {r.details && <span style={{ color: 'var(--color-muted)' }}>{r.details}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length > LOG_LIMIT && (
        <p className="text-xs px-4 py-2" style={{ color: 'var(--color-muted)' }}>
          Showing the latest {LOG_LIMIT} of {rows.length}. Download the log to see all of them.
        </p>
      )}
    </div>
  )
}
