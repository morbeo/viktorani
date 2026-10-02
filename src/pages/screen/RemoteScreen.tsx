import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui'
import { ScreenScores, ScreenView } from '@/components/screen/ScreenView'
import { useTransportEvents } from '@/hooks/useTransport'
import { transportManager } from '@/transport'
import { PlayerTimers } from '@/pages/player/Play'
import { INITIAL_SCREEN, reduceScreen } from './screen-session'

/** Connect to the room and ask the host to let this screen follow the game. */
async function joinAsScreen(roomId: string) {
  await transportManager.connect({ role: 'player', roomId })
  transportManager.send({ type: 'SCREEN_JOIN' })
}

/**
 * A projector screen on another device. Joins the room as a screen, waits for the GM to
 * approve it, then shows what the host sends to screens: the question as far as the
 * `screen` visibility allows, the timers and the scoreboard. Once the game has ended it
 * keeps the final scoreboard up.
 */
export default function RemoteScreen() {
  const { roomId = '' } = useParams<{ roomId: string }>()
  const [session, setSession] = useState(INITIAL_SCREEN)
  const [lost, setLost] = useState(false)
  const startedRef = useRef(false)

  useTransportEvents(useCallback(event => setSession(s => reduceScreen(s, event)), []))

  useEffect(() => {
    return transportManager.onPeerClose(() => setLost(true))
  }, [])

  // Connect once (refs survive StrictMode's second effect run)
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    joinAsScreen(roomId).catch(() => setLost(true))
  }, [roomId])

  function handleReconnect() {
    setLost(false)
    setSession(INITIAL_SCREEN)
    joinAsScreen(roomId).catch(() => setLost(true))
  }

  const ended = session.gameStatus === 'ended'

  if (ended && session.status === 'accepted') {
    // The host disconnects everyone right after ending the game; that is not a lost connection
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
            <p role="alert">Lost the connection to the host.</p>
            <Button variant="primary" onClick={handleReconnect}>
              Reconnect
            </Button>
          </>
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
