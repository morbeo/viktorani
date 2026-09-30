import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Input } from '@/components/ui'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { transportManager } from '@/transport'
import { MAX_NAME_LENGTH } from '@/transport/messages'
import type { GameEvent, TransportEvent } from '@/transport/types'
import { getDeviceId } from './device-id'

type LobbyInfo = Extract<GameEvent, { type: 'LOBBY_INFO' }>

type Stage =
  | { kind: 'details' }
  | { kind: 'connecting' }
  | { kind: 'choose' }
  | { kind: 'joining' }
  | { kind: 'pending' }
  | { kind: 'rejected'; reason: string }
  | { kind: 'error'; message: string }

/** Team choice on the join screen: a team id, a new team, or playing alone. */
type Choice = string | 'new' | 'solo' | null

const ROOM_CODE_LENGTH = 6

function normaliseCode(value: string): string {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return cleaned.slice(0, ROOM_CODE_LENGTH)
}

function isAvailable(choice: Choice, lobby: LobbyInfo): boolean {
  if (choice === 'new') return lobby.allowPlayerTeams
  if (choice === 'solo') return lobby.allowIndividual
  return choice !== null && lobby.teams.some(t => t.id === choice)
}

/**
 * Player join flow: room code and name → connect → pick a team, create one or play
 * alone, as the host's LOBBY_INFO allows → JOIN. Waits on the host for approval when
 * needed and moves to `/play/:roomId` once accepted.
 */
export default function Join() {
  const params = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const [code, setCode] = useState(() => normaliseCode(params.roomId ?? ''))
  const [name, setName] = useLocalStorage('viktorani-player-name', '')
  const [stage, setStage] = useState<Stage>({ kind: 'details' })
  const [lobby, setLobby] = useState<LobbyInfo | null>(null)
  const [choice, setChoice] = useState<Choice>(null)
  const [newTeamName, setNewTeamName] = useState('')
  const acceptedRef = useRef(false)

  const handleEvent = useCallback(
    (event: TransportEvent) => {
      if (event.type === 'LOBBY_INFO') {
        setLobby(event)
        setStage(s => (s.kind === 'connecting' ? { kind: 'choose' } : s))
      } else if (event.type === 'JOIN_PENDING') {
        setStage({ kind: 'pending' })
      } else if (event.type === 'JOIN_REJECTED') {
        setStage({ kind: 'rejected', reason: event.reason })
      } else if (event.type === 'JOIN_ACCEPTED') {
        acceptedRef.current = true
        navigate(`/play/${code}`, {
          replace: true,
          state: { playerId: event.playerId, teamId: event.teamId },
        })
      }
    },
    [code, navigate]
  )

  useEffect(() => {
    return transportManager.onEvent(handleEvent)
  }, [handleEvent])

  useEffect(() => {
    return transportManager.onPeerClose(() => {
      if (!acceptedRef.current) {
        setStage({ kind: 'error', message: 'Lost the connection to the host.' })
      }
    })
  }, [])

  // Leaving the join screen without joining closes the connection; after JOIN_ACCEPTED
  // it stays open for the play screen
  useEffect(() => {
    return () => {
      if (!acceptedRef.current) void transportManager.disconnect()
    }
  }, [])

  async function handleConnect() {
    setStage({ kind: 'connecting' })
    setLobby(null)
    try {
      await transportManager.connect({ role: 'player', roomId: code })
    } catch {
      setStage({
        kind: 'error',
        message: 'Could not reach that room. Check the code and try again.',
      })
    }
  }

  function handleJoin() {
    if (!lobby || !isAvailable(choice, lobby)) return
    setStage({ kind: 'joining' })
    transportManager.send({
      type: 'JOIN',
      playerName: name.trim(),
      deviceId: getDeviceId(),
      teamId: choice !== 'new' && choice !== 'solo' ? choice : null,
      newTeamName: choice === 'new' ? newTeamName.trim() : null,
    })
  }

  function handleBack() {
    void transportManager.disconnect()
    setStage({ kind: 'details' })
  }

  const canConnect = code.length === ROOM_CODE_LENGTH && name.trim().length > 0
  const canJoin =
    !!lobby && isAvailable(choice, lobby) && (choice !== 'new' || newTeamName.trim().length > 0)

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--color-cream)' }}
    >
      <Card className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Join a game</h1>

        {stage.kind === 'details' && (
          <form
            className="flex flex-col gap-4"
            onSubmit={e => {
              e.preventDefault()
              if (canConnect) void handleConnect()
            }}
          >
            <Input
              id="join-code"
              label="Room code"
              value={code}
              onChange={e => setCode(normaliseCode(e.target.value))}
              autoCapitalize="characters"
              autoComplete="off"
              className="tracking-widest font-mono uppercase"
            />
            <Input
              id="join-name"
              label="Your name"
              value={name}
              maxLength={MAX_NAME_LENGTH}
              onChange={e => setName(e.target.value)}
              autoComplete="nickname"
            />
            <Button type="submit" variant="primary" disabled={!canConnect}>
              Continue
            </Button>
          </form>
        )}

        {stage.kind === 'connecting' && <Status text="Connecting to the room…" />}

        {(stage.kind === 'choose' || stage.kind === 'joining') && lobby && (
          <form
            className="flex flex-col gap-4"
            onSubmit={e => {
              e.preventDefault()
              if (canJoin) handleJoin()
            }}
          >
            <fieldset className="flex flex-col gap-2" disabled={stage.kind === 'joining'}>
              <legend className="text-xs font-medium mb-2" style={{ color: 'var(--color-muted)' }}>
                Pick how you play
              </legend>
              {lobby.teams.map(t => (
                <ChoiceOption
                  key={t.id}
                  label={t.name}
                  checked={choice === t.id}
                  onSelect={() => setChoice(t.id)}
                />
              ))}
              {lobby.allowPlayerTeams && (
                <ChoiceOption
                  label="Create a new team"
                  checked={choice === 'new'}
                  onSelect={() => setChoice('new')}
                />
              )}
              {choice === 'new' && lobby.allowPlayerTeams && (
                <Input
                  id="join-new-team"
                  label="Team name"
                  value={newTeamName}
                  maxLength={MAX_NAME_LENGTH}
                  onChange={e => setNewTeamName(e.target.value)}
                />
              )}
              {lobby.allowIndividual && (
                <ChoiceOption
                  label="Play on my own"
                  checked={choice === 'solo'}
                  onSelect={() => setChoice('solo')}
                />
              )}
              {lobby.teams.length === 0 && !lobby.allowPlayerTeams && !lobby.allowIndividual && (
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                  No teams are open yet. Wait for the host to add one.
                </p>
              )}
            </fieldset>
            <Button type="submit" variant="primary" disabled={!canJoin || stage.kind === 'joining'}>
              {stage.kind === 'joining' ? 'Joining…' : `Join as ${name.trim()}`}
            </Button>
            <Button type="button" variant="ghost" onClick={handleBack}>
              Back
            </Button>
          </form>
        )}

        {stage.kind === 'pending' && <Status text="Waiting for the host to let you in…" />}

        {stage.kind === 'rejected' && (
          <>
            <p role="alert" className="text-sm" style={{ color: 'var(--color-red)' }}>
              You could not join: {stage.reason}
            </p>
            <Button variant="primary" onClick={() => setStage({ kind: 'choose' })}>
              Try again
            </Button>
          </>
        )}

        {stage.kind === 'error' && (
          <>
            <p role="alert" className="text-sm" style={{ color: 'var(--color-red)' }}>
              {stage.message}
            </p>
            <Button variant="primary" onClick={handleBack}>
              Back
            </Button>
          </>
        )}
      </Card>
    </div>
  )
}

function Status({ text }: { text: string }) {
  return (
    <p role="status" className="text-sm" style={{ color: 'var(--color-muted)' }}>
      {text}
    </p>
  )
}

function ChoiceOption({
  label,
  checked,
  onSelect,
}: {
  label: string
  checked: boolean
  onSelect: () => void
}) {
  return (
    <label
      className="flex items-center gap-3 rounded border px-3 py-2 cursor-pointer text-sm"
      style={{
        borderColor: checked ? 'var(--color-ink)' : 'var(--color-border)',
        background: checked ? 'var(--color-cream)' : 'transparent',
      }}
    >
      <input type="radio" name="join-choice" checked={checked} onChange={onSelect} />
      {label}
    </label>
  )
}
