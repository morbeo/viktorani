import { useCallback } from 'react'
import { useAppSettings } from './useAppSettings'

/**
 * Tri-state display mode for row action buttons.
 *
 *   icons      — icon only (default)
 *   text       — text label only
 *   both       — icon + text label
 */
export type ActionMode = 'icons' | 'text' | 'both'

export function useActionMode() {
  const [settings, update] = useAppSettings()
  const setMode = useCallback((actionMode: ActionMode) => update({ actionMode }), [update])
  return [settings.actionMode, setMode] as const
}
