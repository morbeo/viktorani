import { useLocalStorage } from './useLocalStorage'

/**
 * Tri-state display mode for row action buttons.
 *
 *   icons      — icon only (default)
 *   text       — text label only
 *   both       — icon + text label
 */
export type ActionMode = 'icons' | 'text' | 'both'

export function useActionMode() {
  return useLocalStorage<ActionMode>('action-mode', 'icons')
}
