import { useEffect, useState, useCallback } from 'react'
import { transportManager } from '@/transport'
import type { TransportStatus, TransportType, TransportEvent } from '@/transport/types'

export function useTransport() {
  const [status, setStatus] = useState<TransportStatus>(transportManager.status)
  const [type,   setType]   = useState<TransportType>(transportManager.transportType)

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

export function useTransportEvents(handler: (event: TransportEvent) => void) {
  useEffect(() => {
    return transportManager.onEvent(handler)
  }, [handler])
}
