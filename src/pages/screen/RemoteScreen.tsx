import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui'
import { ScreenScores, ScreenView } from '@/components/screen/ScreenView'
import { useTransportEvents } from '@/hooks/useTransport'
import { isAbortError, retry, transportManager } from '@/transport'
import { PlayerTimers } from '@/pages/player/Play'
import { INITIAL_SCREEN, reduceScreen } from './screen-session'
import type { ScreenSession } from './screen-session'

/** Connect to the room and ask the host to let this screen follow the game. */
async function joinAsScreen(roomId: string) {
  await transportManager.connect({ role: 'player', roomId })
  transportManager.send({ type: 'SCREEN_JOIN' })
}

/**
 * A projector screen on another device. Joins the room as a screen, waits for the GM to
 * approve it, then shows what the host sends to screens: the question as far as the
 * `screen` visibility allows, the timers and the scoreboard. Once the game has ended it
 * keeps the final scoreboard up. A lost connection is retried a few times (the screen then
 * waits for approval again) before it offers a Reconnect button.
 */
export default function RemoteScreen() {
  const { roomId = '' } = useParams<{ roomId: string }>()
  const [session, setSession] = useState(INITIAL_SCREEN)
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
    useCallback(event => updateSession(reduceScreen(sessionRef.current, event)), [updateSession])
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
    retry(() => joinAsScreen(roomId), {
      cancelled: () => unmountedRef.current,
      onRetry: setReconnecting,
    })
      .catch(err => {
        if (isAbortError(err)) return
        setError(transportManager.error)
        setLost(true)
      })
      .finally(() => setReconnecting(null))
  }, [roomId, updateSession])

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

  if (ended && session.status === 'accepted') {
    return (
      <ScreenView heading="Game over" content={null}>
        <ScreenScores rows={session.rows} />
      </ScreenView>
    )
  }

  if (lost || session.status !== 'accepted') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 text-2xl"
        style={{ background: 'var(--color-cream)', color: 'var(--color-ink)' }}
      >
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
          <p role="alert">The host declined this screen: {session.reason}</p>
        ) : (
          <p role="status">
            {session.status === 'pending'
              ? 'Waiting for the host to approve this screen…'
              : 'Connecting to the host…'}
          </p>
        )}
      </div>
    )
  }

  return (
    <ScreenView
      heading={session.gameStatus === 'paused' ? 'Paused' : null}
      content={session.content}
    >
      <PlayerTimers />
      <ScreenScores rows={session.rows} />
    </ScreenView>
  )
}
