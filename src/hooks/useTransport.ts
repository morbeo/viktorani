import { useEffect, useState, useCallback } from 'react'
import { transportManager } from '@/transport'
import type { TransportStatus, TransportType, TransportEvent } from '@/transport/types'

/**
 * Subscribe to the current transport connection status and expose a stable `send` callback.
 *
 * @remarks
 * Wraps the module-level {@link transportManager} singleton so React components
 * don't need to import it directly. Status updates trigger re-renders; `send`
 * is memoised and never changes identity.
 *
 * @returns
 * - `status` — current {@link TransportStatus} (`'idle'` when not connected).
 * - `type` — active {@link TransportType} (`null` when not connected).
 * - `send` — stable callback to dispatch a {@link TransportEvent} to the room.
 *
 * @example
 * ```tsx
 * function BuzzerButton() {
 *   const { status, send } = useTransport()
 *   return (
 *     <button
 *       disabled={status !== 'connected'}
 *       onClick={() => send({ type: 'BUZZ', playerId, playerName, timestamp: Date.now() })}
 *     >
 *       Buzz!
 *     </button>
 *   )
 * }
 * ```
 */
export function useTransport() {
  const [status, setStatus] = useState<TransportStatus>(transportManager.status)
  const [type, setType] = useState<TransportType>(transportManager.transportType)

  useEffect(() => {
    return transportManager.onStatusChange((s, t) => {
      setStatus(s)
      setType(t)
    })
  }, [])

  const send = useCallback((event: TransportEvent) => {
    transportManager.send(event)
  }, [])

  return { status, type, send }
}

/**
 * Subscribe to incoming transport events without triggering re-renders.
 *
 * @remarks
 * Registers `handler` with the transport singleton and unregisters it on
 * unmount. The handler must be stable (wrap in `useCallback`) to avoid
 * re-registering on every render.
 *
 * @param handler - Called for every {@link TransportEvent} received from the room.
 *
 * @example
 * ```tsx
 * useTransportEvents(
 *   useCallback(event => {
 *     if (event.type === 'BUZZER_LOCK') setLocked(true)
 *   }, [])
 * )
 * ```
 */
export function useTransportEvents(handler: (event: TransportEvent) => void) {
  useEffect(() => {
    return transportManager.onEvent(handler)
  }, [handler])
}
