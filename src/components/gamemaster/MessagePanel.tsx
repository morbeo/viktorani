import { useId, useState } from 'react'
import { Button } from '@/components/ui'
import { isConnected } from '@/pages/admin/gamemaster-utils'
import type { MessageTarget } from '@/pages/admin/player-connections'
import { MAX_MESSAGE_LENGTH } from '@/transport/messages'
import type { Player, Team } from '@/db'

export interface MessagePanelProps {
  players: Player[]
  teams: Team[]
  /** Sends `text` (or `null` to clear) to `target`; returns how many devices it went to. */
  onSend: (target: MessageTarget, text: string | null) => number
}

interface Option {
  value: string
  label: string
  target: MessageTarget
}

const BROADCASTS: Option[] = [
  { value: 'everyone', label: 'Everyone (players and screens)', target: { kind: 'everyone' } },
  { value: 'players', label: 'All players', target: { kind: 'players' } },
  { value: 'screens', label: 'Screens', target: { kind: 'screens' } },
]

const devices = (n: number) => `${n} device${n === 1 ? '' : 's'}`

/** Push a short plain-text message to everyone, all players, the screens, a team or a player. */
export function MessagePanel({ players, teams, onSend }: MessagePanelProps) {
  const id = useId()
  const [to, setTo] = useState('everyone')
  const [text, setText] = useState('')
  const [result, setResult] = useState<string | null>(null)

  const teamOptions: Option[] = teams.map(t => ({
    value: `team:${t.id}`,
    label: t.name,
    target: { kind: 'team', teamId: t.id },
  }))
  const playerOptions: Option[] = players
    .filter(isConnected)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(p => ({
      value: `player:${p.id}`,
      label: p.name,
      target: { kind: 'player', playerId: p.id },
    }))
  const selected =
    [...BROADCASTS, ...teamOptions, ...playerOptions].find(o => o.value === to) ?? BROADCASTS[0]

  const message = text.trim()

  function handleSend() {
    const sent = onSend(selected.target, message)
    setResult(sent > 0 ? `Sent to ${devices(sent)}.` : 'Nobody to send to.')
    if (sent > 0) setText('')
  }

  function handleClear() {
    const sent = onSend({ kind: 'everyone' }, null)
    setResult(`Cleared on ${devices(sent)}.`)
  }

  return (
    <div
      className="rounded-xl border flex flex-col"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div
        className="px-4 py-3 border-b text-xs font-semibold uppercase tracking-wider"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
      >
        Message
      </div>
      <div className="px-4 py-3 flex flex-col gap-2">
        <label htmlFor={`${id}-to`} className="text-xs" style={{ color: 'var(--color-muted)' }}>
          To
        </label>
        <select
          id={`${id}-to`}
          value={selected.value}
          onChange={e => setTo(e.target.value)}
          className="px-3 py-2 rounded border text-sm outline-none"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-cream)',
            color: 'var(--color-ink)',
          }}
        >
          {BROADCASTS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          {teamOptions.length > 0 && (
            <optgroup label="Team">
              {teamOptions.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          )}
          {playerOptions.length > 0 && (
            <optgroup label="Player">
              {playerOptions.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <label htmlFor={`${id}-text`} className="text-xs" style={{ color: 'var(--color-muted)' }}>
          Message
        </label>
        <textarea
          id={`${id}-text`}
          value={text}
          maxLength={MAX_MESSAGE_LENGTH}
          rows={2}
          onChange={e => setText(e.target.value)}
          className="px-3 py-2 rounded border text-sm outline-none resize-y"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-cream)',
            color: 'var(--color-ink)',
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs mono" style={{ color: 'var(--color-muted)' }}>
            {text.length}/{MAX_MESSAGE_LENGTH}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={handleClear}>
              Clear everywhere
            </Button>
            <Button size="sm" variant="primary" disabled={!message} onClick={handleSend}>
              Send
            </Button>
          </div>
        </div>
        {result && (
          <p role="status" className="text-xs" style={{ color: 'var(--color-muted)' }}>
            {result}
          </p>
        )}
      </div>
    </div>
  )
}
