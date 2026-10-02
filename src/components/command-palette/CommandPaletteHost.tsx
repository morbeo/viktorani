import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { getPageCommands, isPaletteShortcut, subscribeCommands } from './commands'

const CommandPalette = lazy(() => import('./CommandPalette'))

/** Opens the command palette with Ctrl/⌘+K on admin pages. The palette itself loads on first use. */
export function CommandPaletteHost() {
  const { pathname } = useLocation()
  const isAdmin = pathname.startsWith('/admin')
  const [open, setOpen] = useState(false)
  const pageCommands = useSyncExternalStore(subscribeCommands, getPageCommands)

  useEffect(() => {
    if (!isAdmin) return
    function onKeyDown(e: KeyboardEvent) {
      if (!isPaletteShortcut(e)) return
      e.preventDefault()
      setOpen(o => !o)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isAdmin])

  if (!open || !isAdmin) return null
  return (
    <Suspense fallback={null}>
      <CommandPalette pageCommands={pageCommands} onClose={() => setOpen(false)} />
    </Suspense>
  )
}
