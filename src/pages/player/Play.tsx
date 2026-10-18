import { useEffect, useState, useRef, useCallback } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useTransportEvents } from '@/hooks/useTransport'
import { isAbortError, retry, transportManager } from '@/transport'
import { MAX_NAME_LENGTH } from '@/transport/messages'
import { LayoutRenderer } from '@/widgets/LayoutRenderer'
import { resolveLayout } from '@/widgets/layouts'
import { getDeviceId } from './device-id'
import {
  getPlayerSession,
  remotePhase,
  startPlayerSession,
  usePlayerSession,
} from './player-session'

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
  const buzzLabel = buzzed
    ? 'Buzzed!'
    : paused
      ? 'Paused'
      : session.buzzerLocked
        ? 'Locked'
        : 'BUZZ'
  const score = session.playerId ? (session.scores[session.playerId] ?? 0) : 0
  const teamScore = session.teamId ? session.scores[session.teamId] : undefined

  return (
    <div className="min-h-screen px-4 py-8 flex flex-col items-center gap-6 bg-bg">
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
              <p className="font-semibold text-text">{name}</p>
              <p className="text-sm text-muted">
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

          {ended && <Status text="The game has ended. Thanks for playing!" />}
          {paused && <Status text="The host paused the game." />}

          {/* Each visible widget brings its own top margin; -mt-6 cancels the page's gap */}
          <LayoutRenderer
            bundle={resolveLayout(session.layouts?.layouts ?? [], {
              target: 'player',
              gameId: session.layouts?.gameId ?? null,
              phase: remotePhase(session.phase, session.gameStatus),
              assignments: session.layouts?.assignments,
            })}
            target="player"
            data={{
              message: session.message,
              question: session.question,
              ended,
              buzzer: session.buzzerEnabled
                ? {
                    enabled: canBuzz,
                    label: buzzLabel,
                    onBuzz: handleBuzz,
                  }
                : null,
            }}
            breakpoint="phone"
            className="w-full -mt-6"
            cellClassName="mt-6 flex flex-col items-center"
          />
        </>
      )}
    </div>
  )
}

function Status({ text }: { text: string }) {
  return (
    <p role="status" className="text-sm text-muted">
      {text}
    </p>
  )
}

function Alert({ text }: { text: string }) {
  return (
    <p role="alert" className="text-sm text-negative">
      {text}
    </p>
  )
}
