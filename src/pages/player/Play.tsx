import { useEffect, useState, useRef, useCallback } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useTransportEvents } from '@/hooks/useTransport'
import { isAbortError, retry, transportManager } from '@/transport'
import { MAX_NAME_LENGTH } from '@/transport/messages'
import { PlayerTimers } from '@/components/timer/PlayerTimers'
import { getDeviceId } from './device-id'
import { getPlayerSession, startPlayerSession, usePlayerSession } from './player-session'
import { PlayerQuestion } from './PlayerQuestion'
import { AnnouncementBanner } from './AnnouncementBanner'

// ── Main Play page ────────────────────────────────────────────────────────────

type Problem =
  | { kind: 'pending' }
  | { kind: 'rejected'; reason: string }
  | { kind: 'reconnecting'; retry: number }
  | { kind: 'lost'; error: string | null }

/** Connect to the room and ask the host to restore this device's player. */
async function rejoin(roomId: string, name: string) {
  startPlayerSession()
  await transportManager.connect({ role: 'player', roomId })
  transportManager.send({
    type: 'JOIN',
    playerName: name,
    deviceId: getDeviceId(),
    teamId: null,
    newTeamName: null,
  })
}

/**
 * The player's game screen: the question as far as the host shows it, a buzz button that
 * follows the host's buzzer lock, the player's score and the host's timers. Opened without
 * a session (a reload or a shared link), or after losing the host, it reconnects and rejoins
 * by device id, retrying a few times before offering a Reconnect button. Reports
 * tab switches as FOCUS_CHANGE. Follows the host's pause, and shows the final score once
 * the game has ended. Shows the host's latest message until the player dismisses it.
 */
export default function Play() {
  const { roomId = '' } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const [storedName] = useLocalStorage('viktorani-player-name', '')
  const name = storedName.trim().slice(0, MAX_NAME_LENGTH)
  const session = usePlayerSession()
  const [problem, setProblem] = useState<Problem | null>(null)
  const [buzzed, setBuzzed] = useState(false)
  const startedRef = useRef(false)
  const leftRef = useRef(false)
  const unmountedRef = useRef(false)
  const joined = session.playerId !== null
  const ended = session.gameStatus === 'ended'
  const paused = session.gameStatus === 'paused'

  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
    }
  }, [])

  // Rejoin, retrying a few times; JOIN_ACCEPTED (or JOIN_PENDING) then replaces the problem
  const reconnect = useCallback(() => {
    setProblem(null)
    retry(() => rejoin(roomId, name), {
      cancelled: () => unmountedRef.current || leftRef.current,
      onRetry: n => setProblem({ kind: 'reconnecting', retry: n }),
    }).catch(err => {
      if (!isAbortError(err)) setProblem({ kind: 'lost', error: transportManager.error })
    })
  }, [roomId, name])

  // Opened without a session: rejoin once (refs survive StrictMode's second effect run)
  useEffect(() => {
    if (startedRef.current || joined || !name) return
    startedRef.current = true
    reconnect()
  }, [name, joined, reconnect])

  useTransportEvents(
    useCallback(event => {
      if (event.type === 'JOIN_ACCEPTED') setProblem(null)
      if (event.type === 'JOIN_PENDING') setProblem({ kind: 'pending' })
      if (event.type === 'JOIN_REJECTED') setProblem({ kind: 'rejected', reason: event.reason })
      if (event.type === 'BUZZER_UNLOCK' || event.type === 'SLIDE_CHANGE') setBuzzed(false)
    }, [])
  )

  // The host disconnects everyone right after ending the game; that is not a lost connection
  useEffect(() => {
    return transportManager.onPeerClose(() => {
      if (!leftRef.current && getPlayerSession().gameStatus !== 'ended') reconnect()
    })
  }, [reconnect])

  // Tell the host when the player switches away from the tab and back
  useEffect(() => {
    if (!joined) return
    const onVisibility = () =>
      transportManager.send({ type: 'FOCUS_CHANGE', away: document.hidden })
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [joined])

  function handleBuzz() {
    transportManager.send({ type: 'BUZZ', timestamp: Date.now() })
    setBuzzed(true)
  }

  function handleLeave() {
    leftRef.current = true
    transportManager.send({ type: 'LEAVE' })
    void transportManager.disconnect()
    navigate(`/join/${roomId}`, { replace: true })
  }

  if (!name && !joined) return <Navigate to={`/join/${roomId}`} replace />

  const canBuzz = joined && !paused && !session.buzzerLocked && !buzzed
  const score = session.playerId ? (session.scores[session.playerId] ?? 0) : 0
  const teamScore = session.teamId ? session.scores[session.teamId] : undefined

  return (
    <div
      className="min-h-screen px-4 py-8 flex flex-col items-center gap-6"
      style={{ background: 'var(--color-cream)' }}
    >
      {problem?.kind === 'pending' && <Status text="Waiting for the host to let you back in…" />}

      {problem?.kind === 'rejected' && (
        <>
          <Alert text={`You could not rejoin: ${problem.reason}`} />
          <Button variant="primary" onClick={handleLeave}>
            Join again
          </Button>
        </>
      )}

      {problem?.kind === 'reconnecting' && (
        <Status text={`Lost the connection to the host. Reconnecting… (retry ${problem.retry})`} />
      )}

      {problem?.kind === 'lost' && (
        <>
          <Alert text={`Lost the connection to the host. ${problem.error ?? ''}`.trim()} />
          <Button variant="primary" onClick={reconnect}>
            Reconnect
          </Button>
          <Button variant="ghost" onClick={handleLeave}>
            Back to join
          </Button>
        </>
      )}

      {!problem && !joined && <Status text="Connecting to the host…" />}

      {!problem && joined && (
        <>
          <header className="w-full max-w-sm flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold" style={{ color: 'var(--color-ink)' }}>
                {name}
              </p>
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                Score <span className="mono tabular-nums">{score}</span>
                {teamScore !== undefined && (
                  <>
                    {' · '}Team <span className="mono tabular-nums">{teamScore}</span>
                  </>
                )}
              </p>
            </div>
            <Button variant="ghost" onClick={handleLeave}>
              Leave
            </Button>
          </header>

          <AnnouncementBanner message={session.message} />

          {ended && <Status text="The game has ended. Thanks for playing!" />}
          {paused && <Status text="The host paused the game." />}

          {!ended && session.question && <PlayerQuestion question={session.question} />}

          {!ended && (
            <button
              type="button"
              aria-label="Buzz"
              disabled={!canBuzz}
              onClick={handleBuzz}
              className="w-64 h-64 rounded-full text-4xl font-black shadow-lg transition-colors"
              style={{
                background: canBuzz ? 'var(--color-red)' : 'var(--color-border)',
                color: canBuzz ? '#fff' : 'var(--color-muted)',
              }}
            >
              {buzzed ? 'Buzzed!' : paused ? 'Paused' : session.buzzerLocked ? 'Locked' : 'BUZZ'}
            </button>
          )}

          {!ended && <PlayerTimers />}
        </>
      )}
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

function Alert({ text }: { text: string }) {
  return (
    <p role="alert" className="text-sm" style={{ color: 'var(--color-red)' }}>
      {text}
    </p>
  )
}
