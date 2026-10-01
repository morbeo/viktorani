import { useEffect, useState, useRef, useCallback } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useTransportEvents } from '@/hooks/useTransport'
import { transportManager } from '@/transport'
import { MAX_NAME_LENGTH } from '@/transport/messages'
import { formatTime, playBeep } from '@/hooks/useTimer'
import { TimerExpiredOverlay } from '@/components/timer/TimerExpiredOverlay'
import type { GameEvent } from '@/transport/types'
import { getDeviceId } from './device-id'
import { startPlayerSession, usePlayerSession } from './player-session'

// ── Player-side timer state ───────────────────────────────────────────────────

interface PlayerTimer {
  id: string
  label: string
  duration: number
  remaining: number
  startedAt: number | null
  paused: boolean
}

interface ExpiredEntry {
  id: string
  label: string
}

function usePlayerTimers() {
  const [timers, setTimers] = useState<PlayerTimer[]>([])
  const [expired, setExpired] = useState<ExpiredEntry | null>(null)
  const [tick, setTick] = useState(0)
  const rafRef = useRef<number | null>(null)
  const timersRef = useRef<PlayerTimer[]>([])

  useEffect(() => {
    timersRef.current = timers
  }, [timers])

  useEffect(() => {
    let last = performance.now()
    function frame(now: number) {
      if (now - last >= 200) {
        last = now
        setTick(t => t + 1)
      }
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const remaining = useCallback(
    (id: string): number => {
      void tick
      const t = timersRef.current.find(x => x.id === id)
      if (!t) return 0
      if (t.paused || t.startedAt === null) return Math.max(0, t.remaining)
      return Math.max(0, t.remaining - (Date.now() - t.startedAt) / 1000)
    },
    [tick]
  )

  const handleEvent = useCallback((event: GameEvent) => {
    if (event.type === 'TIMER_START') {
      const { id, duration, label } = event
      setTimers(prev => {
        const updated: PlayerTimer = {
          id,
          label,
          duration,
          remaining: duration,
          startedAt: Date.now(),
          paused: false,
        }
        return prev.find(t => t.id === id)
          ? prev.map(t => (t.id === id ? updated : t))
          : [...prev, updated]
      })
    }
    if (event.type === 'TIMER_PAUSE') {
      setTimers(prev =>
        prev.map(t => {
          if (t.id !== event.id) return t
          const elapsed = t.startedAt !== null ? (Date.now() - t.startedAt) / 1000 : 0
          return {
            ...t,
            paused: true,
            remaining: Math.max(0, t.remaining - elapsed),
            startedAt: null,
          }
        })
      )
    }
    if (event.type === 'TIMER_RESUME') {
      setTimers(prev =>
        prev.map(t => (t.id === event.id ? { ...t, paused: false, startedAt: Date.now() } : t))
      )
    }
    if (event.type === 'TIMER_RESET') {
      const { id, duration } = event
      setTimers(prev =>
        prev.map(t =>
          t.id === id ? { ...t, duration, remaining: duration, startedAt: null, paused: true } : t
        )
      )
    }
    if (event.type === 'TIMER_EXPIRED') {
      // Host controls audio/visual flags via transport; players always get both
      // (the host already filtered — if this event arrived, players should react)
      playBeep()
      setExpired({ id: event.id, label: event.label })
    }
  }, [])

  return { timers, remaining, handleEvent, expired, dismissExpired: () => setExpired(null) }
}

// ── Player timer card ─────────────────────────────────────────────────────────

function PlayerTimerCard({ timer, remaining }: { timer: PlayerTimer; remaining: number }) {
  const pct = timer.duration > 0 ? remaining / timer.duration : 0
  const isDone = remaining <= 0 && !timer.paused && timer.startedAt !== null
  const isRunning = !timer.paused && timer.startedAt !== null
  const r = 44
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.max(0, Math.min(1, pct)))
  const color =
    pct > 0.5 ? 'var(--color-green)' : pct > 0.2 ? 'var(--color-gold)' : 'var(--color-red)'

  return (
    <div
      className="rounded-2xl border flex flex-col items-center gap-3 p-6"
      style={{
        borderColor: isDone ? 'var(--color-red)' : 'var(--color-border)',
        background: isDone ? 'var(--color-red)0d' : 'var(--color-surface)',
        transition: 'border-color 0.3s, background 0.3s',
      }}
    >
      {timer.label && (
        <p className="text-sm font-semibold" style={{ color: 'var(--color-muted)' }}>
          {timer.label}
        </p>
      )}
      <div className="relative flex items-center justify-center">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            strokeWidth="6"
            style={{ stroke: 'var(--color-border)' }}
          />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ stroke: color, transition: 'stroke-dashoffset 0.4s linear, stroke 0.4s' }}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <span
          className="mono absolute text-2xl font-bold tabular-nums"
          style={{ color: isDone ? 'var(--color-red)' : 'var(--color-ink)' }}
        >
          {formatTime(remaining)}
        </span>
      </div>
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
        {isDone ? '⏰ Time up!' : isRunning ? 'Running' : 'Paused'}
      </p>
    </div>
  )
}

// ── Timers ────────────────────────────────────────────────────────────────────

/** The host's running timers, and the overlay when one expires. */
export function PlayerTimers() {
  const { timers, remaining, handleEvent, expired, dismissExpired } = usePlayerTimers()

  useTransportEvents(
    useCallback(
      event => {
        if (
          event.type === 'TIMER_START' ||
          event.type === 'TIMER_PAUSE' ||
          event.type === 'TIMER_RESUME' ||
          event.type === 'TIMER_RESET' ||
          event.type === 'TIMER_EXPIRED'
        ) {
          handleEvent(event as GameEvent)
        }
      },
      [handleEvent]
    )
  )

  const activeTimers = timers.filter(t => t.startedAt !== null || !t.paused)

  return (
    <>
      {expired && <TimerExpiredOverlay label={expired.label} onDismiss={dismissExpired} />}
      {activeTimers.length > 0 && (
        <div className="w-full max-w-sm flex flex-col gap-4">
          {activeTimers.map(t => (
            <PlayerTimerCard key={t.id} timer={t} remaining={remaining(t.id)} />
          ))}
        </div>
      )}
    </>
  )
}

// ── Main Play page ────────────────────────────────────────────────────────────

type Problem = { kind: 'pending' } | { kind: 'rejected'; reason: string } | { kind: 'lost' }

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
 * The player's game screen: a buzz button that follows the host's buzzer lock, the
 * player's score and the host's timers. Opened without a session (a reload or a shared
 * link), it reconnects and rejoins by device id. Reports tab switches as FOCUS_CHANGE.
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
  const joined = session.playerId !== null

  // Opened without a session: rejoin once (refs survive StrictMode's second effect run)
  useEffect(() => {
    if (startedRef.current || joined || !name) return
    startedRef.current = true
    rejoin(roomId, name).catch(() => setProblem({ kind: 'lost' }))
  }, [roomId, name, joined])

  useTransportEvents(
    useCallback(
      event => {
        if (event.type === 'JOIN_ACCEPTED') setProblem(null)
        if (event.type === 'JOIN_PENDING') setProblem({ kind: 'pending' })
        if (event.type === 'JOIN_REJECTED') setProblem({ kind: 'rejected', reason: event.reason })
        if (event.type === 'BUZZER_UNLOCK' || event.type === 'SLIDE_CHANGE') setBuzzed(false)
      },
      []
    )
  )

  useEffect(() => {
    return transportManager.onPeerClose(() => {
      if (!leftRef.current) setProblem({ kind: 'lost' })
    })
  }, [])

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

  function handleReconnect() {
    setProblem(null)
    rejoin(roomId, name).catch(() => setProblem({ kind: 'lost' }))
  }

  function handleLeave() {
    leftRef.current = true
    transportManager.send({ type: 'LEAVE' })
    void transportManager.disconnect()
    navigate(`/join/${roomId}`, { replace: true })
  }

  if (!name && !joined) return <Navigate to={`/join/${roomId}`} replace />

  const canBuzz = joined && !session.buzzerLocked && !buzzed
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

      {problem?.kind === 'lost' && (
        <>
          <Alert text="Lost the connection to the host." />
          <Button variant="primary" onClick={handleReconnect}>
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
            {buzzed ? 'Buzzed!' : session.buzzerLocked ? 'Locked' : 'BUZZ'}
          </button>

          <PlayerTimers />
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
