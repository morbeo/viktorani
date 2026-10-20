import { useEffect } from 'react'

/**
 * Whether the game is out of the player's sight: the page is hidden (another app or tab,
 * a locked screen) or the window lost focus (split screen, a popup, the notification
 * shade on some phones). Focus inside an embedded frame, such as a video widget, still
 * counts as being on the page.
 */
export function isAway(doc: Document = document): boolean {
  if (doc.hidden) return true
  if (doc.hasFocus()) return false
  return doc.activeElement?.tagName !== 'IFRAME'
}

/**
 * Calls `onChange` each time the player leaves the game or comes back (see {@link isAway}),
 * once per change, while `enabled`. The page is taken to be in view when it starts.
 */
export function useFocusReport(enabled: boolean, onChange: (away: boolean) => void): void {
  useEffect(() => {
    if (!enabled) return
    let away = false
    const check = () => {
      const now = isAway()
      if (now === away) return
      away = now
      onChange(now)
    }
    // A frame takes focus only after the window's blur, so look once the event is done
    let pending: ReturnType<typeof setTimeout> | undefined
    const checkSoon = () => {
      clearTimeout(pending)
      pending = setTimeout(check, 0)
    }
    document.addEventListener('visibilitychange', check)
    window.addEventListener('blur', checkSoon)
    window.addEventListener('focus', check)
    return () => {
      clearTimeout(pending)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('blur', checkSoon)
      window.removeEventListener('focus', check)
    }
  }, [enabled, onChange])
}
