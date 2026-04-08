import { useEffect } from 'react'

/**
 * Binds → / ← arrow keys to onNext / onPrev.
 * No-op when modalOpen is true, preventing navigation while a dialog is focused.
 */
export function useKeyNav(params: {
  onNext: () => void
  onPrev: () => void
  modalOpen: boolean
  enabled: boolean // false when game is not active (lobby, ended, etc.)
}) {
  const { onNext, onPrev, modalOpen, enabled } = params

  useEffect(() => {
    if (!enabled) return

    function handler(e: KeyboardEvent) {
      // Ignore if a modal is open or focus is inside an input
      if (modalOpen) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        onNext()
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onPrev()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onNext, onPrev, modalOpen, enabled])
}
