import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui'
import { ScreenView } from '@/components/screen/ScreenView'
import { ScoreboardView } from '@/components/scoreboard/ScoreboardView'
import { useRemoteTheme } from '@/hooks/useAppTheme'
import { useTransportEvents } from '@/hooks/useTransport'
import { isAbortError, retry, transportManager } from '@/transport'
import { PlayerTimers } from '@/components/timer/PlayerTimers'
import { remotePhase } from '@/pages/player/player-session'
import type { ScreenSurface } from '@/transport/types'
import { INITIAL_SCREEN, reduceScreen } from './screen-session'
import type { ScreenSession } from './screen-session'

/**
 * Connect to the room and ask the host to let this screen, scoreboard or spectator follow
 * the game.
 */
async function joinAsScreen(roomId: string, watch: boolean, surface: ScreenSurface) {
  await transportManager.connect({ role: 'player', roomId })
  transportManager.send(
    watch
      ? { type: 'SCREEN_JOIN', watch }
      : surface === 'scoreboard'
        ? { type: 'SCREEN_JOIN', surface }
        : { type: 'SCREEN_JOIN' }
  )
}

/**
 * A projector screen on another device. Joins the room as a screen, waits for the GM to
 * approve it, then shows what the host sends to screens: the question as far as the
 * `screen` visibility allows, the timers and the scoreboard. Once the game has ended it
 * keeps the final scoreboard up. A lost connection is retried a few times (the screen then
 * waits for approval again) before it offers a Reconnect button. With `watch` it is a
 * spectator's phone, let in without approval when the game allows spectators. With
 * `surface="scoreboard"` it is a scoreboard display: approved like a screen, it shows the
 * host's scoreboard layout with the scores and the public game log.
 */
export default function RemoteScreen({
  watch = false,
  surface = 'screen',
}: {
  watch?: boolean
  surface?: ScreenSurface
}) {
  const { roomId = '' } = useParams<{ roomId: string }>()
  const [session, setSession] = useState(INITIAL_SCREEN)
  useRemoteTheme(session.theme)
  // Mirrors `session` for the connection-close handler, which runs outside React
  const sessionRef = useRef(INITIAL_SCREEN)
  const [lost, setLost] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reconnecting, setReconnecting] = useState<number | null>(null)
  const startedRef = useRef(false)
  const unmountedRef = useRef(false)

  const updateSession = useCallback((next: ScreenSession) => {
    sessionRef.current = next
    setSession(next)
  }, [])

  useTransportEvents(
    useCallback(
      event => updateSession(reduceScreen(sessionRef.current, event, surface)),
      [updateSession, surface]
    )
  )

  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
    }
  }, [])

  const connect = useCallback(() => {
    setLost(false)
    updateSession(INITIAL_SCREEN)
    retry(() => joinAsScreen(roomId, watch, surface), {
      cancelled: () => unmountedRef.current,
      onRetry: setReconnecting,
    })
      .catch(err => {
        if (isAbortError(err)) return
        setError(transportManager.error)
        setLost(true)
      })
      .finally(() => setReconnecting(null))
  }, [roomId, watch, surface, updateSession])

  // The host disconnects everyone right after ending the game; that is not a lost connection
  useEffect(() => {
    return transportManager.onPeerClose(() => {
      if (sessionRef.current.gameStatus !== 'ended') connect()
    })
  }, [connect])

  // Connect once (refs survive StrictMode's second effect run)
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    connect()
  }, [connect])

  const ended = session.gameStatus === 'ended'
  const accepted = !lost && session.status === 'accepted'

  if (accepted && surface === 'scoreboard') {
    return (
      <ScoreboardView
        layouts={session.layouts?.layouts}
        gameId={session.layouts?.gameId}
        assignments={session.layouts?.assignments}
        phase={remotePhase(session.phase, session.gameStatus)}
        data={{ rows: session.rows, logEntries: session.logEntries }}
      />
    )
  }

  if (ended && session.status === 'accepted') {
    return (
      <ScreenView
        layouts={session.layouts?.layouts}
        gameId={session.layouts?.gameId}
        assignments={session.layouts?.assignments}
        phase="ended"
        data={{
          heading: 'Game over',
          content: null,
          message: session.message,
          rows: session.rows,
          logEntries: session.logEntries,
          timers: null,
        }}
      />
    )
  }

  if (lost || session.status !== 'accepted') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-2xl bg-bg text-text">
        {lost ? (
          <>
            <p role="alert">{`Lost the connection to the host. ${error ?? ''}`.trim()}</p>
            <Button variant="primary" onClick={connect}>
              Reconnect
            </Button>
          </>
        ) : reconnecting !== null ? (
          <p role="status">Lost the connection to the host. Reconnecting… (retry {reconnecting})</p>
        ) : session.status === 'rejected' ? (
          <p role="alert">
            {watch ? "You can't watch this game" : `The host declined this ${surface}`}:{' '}
            {session.reason}
          </p>
        ) : (
          <p role="status">
            {session.status === 'pending'
              ? `Waiting for the host to approve this ${surface}…`
              : 'Connecting to the host…'}
          </p>
        )}
      </div>
    )
  }

  return (
    <ScreenView
      layouts={session.layouts?.layouts}
      gameId={session.layouts?.gameId}
      assignments={session.layouts?.assignments}
      phase={remotePhase(session.phase, session.gameStatus)}
      roundAnswers={session.roundAnswers}
      data={{
        heading: session.gameStatus === 'paused' ? 'Paused' : null,
        content: session.content,
        message: session.message,
        rows: session.rows,
        logEntries: session.logEntries,
        timers: <PlayerTimers />,
      }}
    />
  )
}
