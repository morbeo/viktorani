const DEVICE_ID_KEY = 'viktorani-device-id'

/**
 * Stable id for this browser, created on first use and kept in `localStorage`. The host
 * uses it only to recognise a rejoin. Falls back to a fresh id when storage is blocked.
 */
export function getDeviceId(): string {
  try {
    const stored = localStorage.getItem(DEVICE_ID_KEY)
    if (stored) return stored
    const id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}
