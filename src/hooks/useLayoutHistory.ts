import { useCallback, useRef, useState } from 'react'
import { loadLayoutBundle, restoreLayout } from '@/db/layout-editor'
import type { LayoutBundle } from '@/widgets/layouts'

/** How many steps back undo can go. */
export const MAX_UNDO_STEPS = 50

interface History {
  layoutId: string | null
  past: LayoutBundle[]
  future: LayoutBundle[]
}

const empty = (layoutId: string | null): History => ({ layoutId, past: [], future: [] })

/**
 * Undo and redo for the layout being edited in the designer (#413).
 *
 * @remarks
 * Run every change through `edit`: it saves the layout and its widgets as they were before,
 * so `undo` can put them back and `redo` can take the change again. A new change clears the
 * redo steps. The history belongs to one layout and starts empty when another is chosen.
 */
export function useLayoutHistory(layoutId: string | null) {
  const [stored, setHistory] = useState<History>(() => empty(layoutId))
  const history = stored.layoutId === layoutId ? stored : empty(layoutId)
  // One step at a time, so a quick double press can't restore the same snapshot twice
  const busy = useRef(false)

  const edit = useCallback(
    async (change: () => Promise<unknown>) => {
      if (!layoutId) return
      const before = await loadLayoutBundle(layoutId)
      await change()
      if (!before) return
      setHistory(prev => {
        const base = prev.layoutId === layoutId ? prev : empty(layoutId)
        return { layoutId, past: [...base.past, before].slice(-MAX_UNDO_STEPS), future: [] }
      })
    },
    [layoutId]
  )

  const { past, future } = history
  const step = useCallback(
    async (direction: 'undo' | 'redo') => {
      const [from, other] = direction === 'undo' ? [past, future] : [future, past]
      const target = from.at(-1)
      if (!layoutId || !target || busy.current) return
      busy.current = true
      try {
        const now = await loadLayoutBundle(layoutId)
        await restoreLayout(target)
        const rest = from.slice(0, -1)
        const to = now ? [...other, now] : other
        setHistory(
          direction === 'undo'
            ? { layoutId, past: rest, future: to }
            : { layoutId, past: to, future: rest }
        )
      } finally {
        busy.current = false
      }
    },
    [layoutId, past, future]
  )
  const undo = useCallback(() => step('undo'), [step])
  const redo = useCallback(() => step('redo'), [step])

  return { edit, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 }
}
